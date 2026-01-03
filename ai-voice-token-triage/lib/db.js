import fs from 'fs';
import path from 'path';

// Data Directory Setup
const dataDir = path.join(process.cwd(), 'data');
const patientsFile = path.join(dataDir, 'patients.json');

// Ensure directory exists
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
        console.error("Mkdir failed", e);
    }
}

// Helper to Load Patients
function loadPatients() {
    try {
        if (fs.existsSync(patientsFile)) {
            const fileData = fs.readFileSync(patientsFile, 'utf8');
            return JSON.parse(fileData);
        }
    } catch (error) {
        console.error("Error loading patients.json:", error);
    }
    // Default/Fallback Data
    return [
        { id: "P001", name: "Ramanathan S", age: 65, gender: "Male", phone: "9876543210", history: { glaucoma: true, diabetes: true, hypertension: false, one_eyed: false } }
    ];
}

// === GLOBAL STATE (Persists across HMR in Dev) ===
if (!global.appDb) {
    global.appDb = {
        patients: loadPatients(),
        visits: [],
        stationQueues: {
            // Multi-room Stations
            vision_test_A: [], vision_test_B: [], vision_test_C: [],
            refraction_A: [], refraction_B: [], refraction_C: [],
            doctor_consult_A: [], doctor_consult_B: [], doctor_consult_C: [],

            // Single room stations
            registration: [],
            vision_test: [], // Keep for backward compat/safety
            refraction: [],
            doctor_consult: [],

            iop_check: [],
            dilation: [],
            fundus_photo: [],
            investigation: [],
            emergency_room: [], // legacy name
            trauma_center: [],
            pharmacy: []
        },
        emrRecords: []
    };
}

const state = global.appDb;

export const db = {
    // Patients
    getPatient: (id) => {
        const strId = String(id).trim();
        return state.patients.find(p => String(p.id) === strId || String(p.phone) === strId);
    },
    getAllPatients: () => state.patients,
    createPatient: (patientData) => {
        // Generate ID if missing
        if (!patientData.id) {
            patientData.id = `AEH${1000 + state.patients.length + 1}`;
        }
        state.patients.push(patientData);

        // Persist to File
        try {
            fs.writeFileSync(patientsFile, JSON.stringify(state.patients, null, 4));
        } catch (e) {
            console.error("Failed to save patients.json:", e);
        }
        return patientData;
    },

    // Visits
    createVisit: (visit) => {
        state.visits.push(visit);
        return visit;
    },
    getVisit: (tokenId) => state.visits.find(v => v.tokenId === tokenId),
    getAllVisits: () => state.visits,

    // EMR
    addEMRRecord: (record) => {
        state.emrRecords.push(record);
        return record;
    },
    getEMRRecords: () => state.emrRecords,

    // Queue Management
    getQueues: () => state.stationQueues,
    addToQueue: (station, patient, esiLevel) => {
        if (!state.stationQueues[station]) {
            state.stationQueues[station] = [];
        }

        const queue = state.stationQueues[station];

        // 🟥 Emergency case
        if (esiLevel === 1) {
            // If only 0 or 1 patient, safe to push
            if (queue.length <= 1) {
                queue.push(patient);
                return;
            }

            // Find insertion index starting AFTER index 0
            let insertIndex = queue.length; // Default to end

            for (let i = 1; i < queue.length; i++) {
                // Find first person with LOWER priority (Higher ESI)
                // e.g. if we see ESI 3, and we are ESI 1, we insert HERE (before the 3).
                if (queue[i].esiLevel > esiLevel) {
                    insertIndex = i;
                    break;
                }
            }

            queue.splice(insertIndex, 0, patient);
        }
        else {
            // Normal case
            queue.push(patient);
        }
    },


    removeFromQueue: (station, tokenId) => {
        if (!state.stationQueues[station]) return;
        state.stationQueues[station] = state.stationQueues[station].filter(p => p.tokenId !== tokenId);
    },
    // Reset utility if needed (e.g., end of day)
    resetDailyData: () => {
        state.visits = [];
        Object.keys(state.stationQueues).forEach(k => state.stationQueues[k] = []);
        state.emrRecords = [];
    }
};
