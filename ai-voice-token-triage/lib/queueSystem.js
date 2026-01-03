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
        const firstPatient = scoredList[0];

        // 🔄 Sort the rest
        const restPatients = scoredList
            .slice(1)
            .sort((a, b) => b.totalScore - a.totalScore);

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
        const queue = queues[station] || [];

        const now = Date.now();

        const sortedQueue = [...queue]
            .map(item => {
                const waitMinutes = (now - item.entryTime) / 60000;
                const agingScore = waitMinutes * AGING_FACTOR;
                const totalScore = item.baseScore + agingScore;
                return { ...item, totalScore };
            })
            .sort((a, b) => b.totalScore - a.totalScore);

        const index = sortedQueue.findIndex(p => p.tokenId === tokenId);

        if (index !== -1) {
            position = index + 1;
            estimatedWait = position * 5; // 5 min heuristic
        }

        return {
            tokenId,
            name: visit.name || "Guest",
            currentStation: station,
            pathway: visit.pathway,
            queuePosition: position,
            estimatedWait,
            esiLevel: visit.esiLevel,
            status: visit.stationStatus
        };
    },
    STATION_SUB_ROOMS // Export for API usage
};

