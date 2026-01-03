import { db } from './db';
import { PATHWAYS, STATIONS, getPathwayForESI } from './pathways';

/**
 * Queue Priority Engine
 * Implements "Sickest First" + "Aging" Fairness
 */

// Priority Weights
const ESI_WEIGHTS = {
    1: 1000, // Emergency
    2: 800,  // Urgent
    3: 500,  // Standard
    4: 200,  // Fast Track
    5: 100   // Admin
};

const AGING_FACTOR = 2; // +2 points per minute of waiting

// Helper now imported from pathways.js
// const getPathwayForESI ... removed

// Multi-Room Configuration
const STATION_SUB_ROOMS = {
    'vision_test': ['A', 'B', 'C'],
    'refraction': ['A', 'B', 'C'],
    'doctor_consult': ['A', 'B', 'C']
};

export const QueueSystem = {
    /**
     * Initialize a patient into the queue system
     */
    startJourney: (tokenId, esiLevel, category) => {
        const visit = db.getVisit(tokenId);
        if (!visit) return;

        // Get Pathway based on Category (Priority) or ESI
        const pathway = getPathwayForESI(esiLevel, category);

        // Save the chosen pathway to the visit record
        visit.pathway = pathway;
        visit.currentStation = pathway[0];
        visit.stationStatus = 'waiting';
        visit.category = category; // Persist category
        visit.entryTime = Date.now(); // Keep entryTime here

        const firstStation = pathway[0];
        console.log(`[QueueSystem] Starting Journey for ${tokenId}`);
        console.log(`[QueueSystem] Category: ${category}, ESI: ${esiLevel}`);
        console.log(`[QueueSystem] Pathway:`, pathway);

        QueueSystem.addToStation(firstStation, visit);
    },

    /**
     * Add patient to a specific station queue
     */
    addToStation: (station, visit) => {
        let targetQueue = station;
        let assignedRoom = null;

        // 1. Check if station has sub-rooms
        if (STATION_SUB_ROOMS[station]) {
            const rooms = STATION_SUB_ROOMS[station];
            const queues = db.getQueues();

            // Load Balancing: Find room with shortest queue
            let minLength = Infinity;
            let bestRoom = rooms[0];

            rooms.forEach(room => {
                const subQueueName = `${station}_${room}`;
                const length = (queues[subQueueName] || []).length;
                if (length < minLength) {
                    minLength = length;
                    bestRoom = room;
                }
            });

            assignedRoom = bestRoom;
            targetQueue = `${station}_${assignedRoom}`;
            visit.assignedRoom = assignedRoom; // Persist assignment
            console.log(`[QueueSystem] Load Balancing: Assigned ${visit.tokenId} to ${targetQueue}`);
        } else {
            visit.assignedRoom = null; // Reset if moving to single-room station
        }

        const queueItem = {
            tokenId: visit.tokenId,
            name: visit.patientId, // or name lookup
            esiLevel: visit.esiLevel || 3,
            entryTime: Date.now(),
            baseScore: ESI_WEIGHTS[visit.esiLevel || 3] || 100,
            assignedRoom: assignedRoom
        };
        db.addToQueue(targetQueue, queueItem, visit.esiLevel);
    },

    /**
     * Get sorted list for a station (The Display Logic)
     */
    getStationQueue: (station) => {
        const queues = db.getQueues();
        const rawList = queues[station] || [];

        if (rawList.length <= 1) return rawList;

        const now = Date.now();

        // Enrich with scores
        const scoredList = rawList.map(item => {
            const waitMinutes = (now - item.entryTime) / 60000;
            const agingScore = waitMinutes * AGING_FACTOR;
            const totalScore = item.baseScore + agingScore;

            return {
                ...item,
                waitMinutes: Math.floor(waitMinutes),
                totalScore
            };
        });

        // 🟢 Keep first patient fixed
        const firstPatient = {
            ...scoredList[0],
            estimatedStationWait: QueueSystem.STATION_TIMES[station] || 5 // Now Serving typically has avg service time left
        };

        // 🔄 Sort the rest
        const restPatients = scoredList
            .slice(1)
            .sort((a, b) => b.totalScore - a.totalScore)
            .map((p, index) => ({
                ...p,
                // Wait = (My Position + 1) * Service Time
                estimatedStationWait: (index + 1) * (QueueSystem.STATION_TIMES[station] || 5)
            }));

        return [firstPatient, ...restPatients];
    },


    /**
     * Complete current station and move to next
     */
    advancePatient: (tokenId) => {
        console.log(`[QueueSystem] Advancing ${tokenId}`);
        const visit = db.getVisit(tokenId);
        if (!visit || !visit.pathway) {
            console.error(`[QueueSystem] Visit or Pathway not found for ${tokenId}`);
            return null;
        }

        // Refresh pathway from source of truth to handle HMR/Code updates
        // CRITICAL FIX: Use Category to prevent reverting to default ESI pathway
        const freshPathway = getPathwayForESI(visit.esiLevel || 3, visit.category);
        visit.pathway = freshPathway;

        console.log(`[QueueSystem] Current Station: ${visit.currentStation}`);
        console.log(`[QueueSystem] Pathway:`, visit.pathway);

        const currentIndex = visit.pathway.indexOf(visit.currentStation);
        console.log(`[QueueSystem] Current Index: ${currentIndex}`);

        if (currentIndex === -1 || currentIndex >= visit.pathway.length - 1) {
            console.log(`[QueueSystem] End of line or invalid index`);
            visit.stationStatus = 'completed';

            // Clean up last queue
            let sourceQueue = visit.currentStation;
            if (visit.assignedRoom) {
                sourceQueue = `${visit.currentStation}_${visit.assignedRoom}`;
            }
            db.removeFromQueue(sourceQueue, tokenId);

            return { next: null, message: "Journey Completed" };
        }

        const nextStation = visit.pathway[currentIndex + 1];
        console.log(`[QueueSystem] Next Station: ${nextStation}`);

        // 🟢 Remove from current station queue (Fix for duplication)
        // Handle Multi-Room Removal
        let sourceQueue = visit.currentStation;
        if (visit.assignedRoom) {
            sourceQueue = `${visit.currentStation}_${visit.assignedRoom}`;
        }
        db.removeFromQueue(sourceQueue, tokenId);

        // Reset assigned room for next station (will be re-calculated in addToStation)
        visit.assignedRoom = null;

        // Move to next
        visit.currentStation = nextStation;
        visit.stationStatus = 'waiting';
        visit.entryTime = Date.now();

        if (nextStation !== STATIONS.DISCHARGE) {
            console.log(`[QueueSystem] Adding to station: ${nextStation}`);
            QueueSystem.addToStation(nextStation, visit);
        }

        return { next: nextStation };
    },

    getPatientStatus: (tokenId) => {
        const visit = db.getVisit(tokenId);
        if (!visit) return null;

        const station = visit.currentStation;
        let position = 0;
        let estimatedWait = 0;

        const queues = db.getQueues();

        // Handle Multi-Room or Single Room queue fetch for current position
        let currentQueue = [];
        if (visit.assignedRoom) {
            currentQueue = queues[`${station}_${visit.assignedRoom}`] || [];
        } else {
            currentQueue = queues[station] || [];
        }

        const now = Date.now();

        const sortedQueue = [...currentQueue]
            .map(item => {
                const waitMinutes = (now - item.entryTime) / 60000;
                const agingScore = waitMinutes * AGING_FACTOR;
                const totalScore = item.baseScore + agingScore;
                return { ...item, totalScore };
            })
            .sort((a, b) => b.totalScore - a.totalScore); // Descending score

        // Find position
        // Note: The logic in getStationQueue fixes the 0th index, but here we just need relative position.
        // If sorting logic matches getStationQueue, index is enough.
        const index = sortedQueue.findIndex(p => p.tokenId === tokenId);

        if (index !== -1) {
            position = index + 1;

            // 1. Calculate Wait at CURRENT Station
            // We use the specific station time.
            const currentStationTime = QueueSystem.STATION_TIMES[station] || 5;
            const currentStationWait = position * currentStationTime;

            // 2. Calculate Wait for FUTURE Stations
            // Get remaining pathway
            const currentPathIndex = visit.pathway.indexOf(station);
            let futureWait = 0;

            if (currentPathIndex !== -1 && currentPathIndex < visit.pathway.length - 1) {
                const remainingPathway = visit.pathway.slice(currentPathIndex + 1);
                const futureEstimate = QueueSystem.estimateJourneyDuration(remainingPathway);
                futureWait = futureEstimate.totalMinutes;
            }

            estimatedWait = currentStationWait + futureWait;
        }

        // 3. Get Patient Details (Mock/Real)
        // In a real app, visit.patientId would link to specific patient.
        // For demo, we might not always have it or it might be "Unknown".
        // We'll try to fetch or fallback to a consistent mock based on Token ID hash to make it look "real" without full auth.
        let patientDetails = {};
        if (visit.patientId && visit.patientId !== "Unknown") {
            const p = db.getPatient(visit.patientId);
            if (p) patientDetails = { name: p.name, age: p.age, gender: p.gender, phone: p.phone };
        } else {
            // Generate consistent "Fake" data based on Token suffix for demo
            const idSuffix = parseInt(tokenId.split('-')[1] || "100");
            const names = ["Ramanathan S", "Meenakshi K", "Senthil Kumar", "Anitha R", "John Doe", "Mohammed A"];
            patientDetails = {
                name: names[idSuffix % names.length],
                age: 20 + (idSuffix % 60),
                gender: idSuffix % 2 === 0 ? "Male" : "Female",
                phone: "Unknown"
            };
        }

        return {
            tokenId,
            name: visit.name || patientDetails.name,
            age: patientDetails.age,
            gender: patientDetails.gender,
            phone: patientDetails.phone,
            complaint: visit.complaint || "Routine Checkup",
            currentStation: station,
            pathway: visit.pathway,
            queuePosition: position,
            estimatedWait,
            esiLevel: visit.esiLevel,
            status: visit.stationStatus
        };
    },
    STATION_SUB_ROOMS, // Export for API usage
    STATION_TIMES: {
        'vision_test': 5,
        'refraction': 10,
        'investigation': 15,
        'dilation': 20,
        'fundus_photo': 7,
        'doctor_consult': 10,
        'pharmacy': 5,
        'registration': 2,
        'trauma_center': 15
    },

    /**
     * Calculate Total Estimated Journey Time
     */
    estimateJourneyDuration: (pathway) => {
        let totalMinutes = 0;
        const details = [];
        const queues = db.getQueues();

        pathway.forEach(station => {
            if (!station) return;

            // 1. Get Processing Time
            const procTime = QueueSystem.STATION_TIMES[station] || 5;

            // 2. Get Queue Length
            let queueLen = 0;
            const subRooms = QueueSystem.STATION_SUB_ROOMS[station];

            if (subRooms) {
                // Multi-Room: Sum all rooms
                let totalPeople = 0;
                subRooms.forEach(r => {
                    totalPeople += (queues[`${station}_${r}`] || []).length;
                });
                // Throughput is 3x (approx)
                // If 10 people total, effectively ~3.3 people ahead in "speed"
                queueLen = Math.ceil(totalPeople / subRooms.length);
            } else {
                // Single Room
                queueLen = (queues[station] || []).length;
            }

            // 3. Calc Wait at this station
            const waitTime = queueLen * procTime;

            totalMinutes += (waitTime + procTime); // Wait + Service

            details.push({
                station,
                queueLen,
                procTime,
                estimatedWait: waitTime
            });
        });

        return { totalMinutes, details };
    }
};
