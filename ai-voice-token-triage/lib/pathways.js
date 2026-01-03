/**
 * Clinical Pathways Definition
 * Maps ESI Levels to Station Sequences
 */

export const STATIONS = {
    // REGISTRATION Removed
    VISION: 'vision_test',
    REFRACTION: 'refraction',
    DILATION: 'dilation',
    FUNDUS: 'fundus_photo',
    INVESTIGATION: 'investigation',
    // IOP Removed
    DOCTOR: 'doctor_consult',
    EMERGENCY: 'trauma_center',
    PHARMACY: ''
    // DISCHARGE Removed
};

export const PATHWAYS = {
    // 🔴 ESI-1
    1: [
        STATIONS.EMERGENCY
    ],

    // 🟠 ESI-2
    2: [
        STATIONS.VISION,
        STATIONS.DOCTOR,
        STATIONS.INVESTIGATION,
        STATIONS.PHARMACY
    ],

    // 🟡 ESI-3
    3: [
        STATIONS.VISION,
        STATIONS.REFRACTION,
        STATIONS.DILATION,
        STATIONS.DOCTOR,
        STATIONS.PHARMACY
    ],

    // 🟢 ESI-4
    4: [
        STATIONS.VISION,
        STATIONS.REFRACTION,
        STATIONS.PHARMACY
    ],

    // 🔵 ESI-5
    5: [
        STATIONS.PHARMACY
    ]
};

// Specific Complaint-Based Pathways (User Defined)
export const COMPLAINT_PATHWAYS = {
    // 1. Redness
    'REDNESS': [
        STATIONS.VISION,
        STATIONS.DOCTOR,
        STATIONS.PHARMACY
    ],
    // 2. Blurred Vision (Simple)
    'BLURRED_VISION': [
        STATIONS.VISION,
        STATIONS.DOCTOR,
        STATIONS.PHARMACY
    ],
    'BLURRED_VISION_2': [
        STATIONS.VISION,
        STATIONS.REFRACTION,
        STATIONS.INVESTIGATION,
        STATIONS.DILATION,
        STATIONS.DOCTOR
    ],
    // 3. Pain
    'PAIN': [
        STATIONS.VISION,
        STATIONS.INVESTIGATION,
        STATIONS.DOCTOR,
        STATIONS.PHARMACY
    ],
    // 4. Detailed Blurred Vision / Refractive
    'REFRACTIVE_ERROR': [
        STATIONS.VISION,
        STATIONS.REFRACTION,
        STATIONS.INVESTIGATION,
        STATIONS.DILATION,
        STATIONS.DOCTOR,
        STATIONS.PHARMACY
    ],
    // 5. Chemical / Trauma
    'TRAUMA': [

        STATIONS.VISION,
        STATIONS.DOCTOR,
        STATIONS.PHARMACY

    ],
    // 6. Routine Checkup
    'ROUTINE': [
        STATIONS.VISION,
        STATIONS.REFRACTION,
        STATIONS.FUNDUS,
        STATIONS.DOCTOR,
        STATIONS.PHARMACY
    ],
    'ROUTINE_2': [
        STATIONS.VISION,
        STATIONS.REFRACTION,
        STATIONS.INVESTIGATION,
        STATIONS.DOCTOR,
        STATIONS.PHARMACY
    ]
};

export function getPathwayForESI(esiLevel, category) {
    // 1. Check for Specific Category Match First
    console.log(category)
    let cat = null
    if (category == "Gradual Vision Loss") {
        cat = "BLURRED_VISION"
    }
    else if (category == "Eye Pain (Undifferentiated)") {
        cat = "PAIN"
    }
    else if (category == "Red Eye (Stable)") {
        cat = "REDNESS"
    }
    else if (category == "Refraction / Vision Check") {
        cat = "ROUTINE"
    }
    else if (category == "EMERGENCY") {
        cat = "TRAUMA"
    }
    if (cat && COMPLAINT_PATHWAYS[cat]) {
        return COMPLAINT_PATHWAYS[cat];
    }
    // 2. Fallback to ESI Level
    return PATHWAYS[esiLevel] || PATHWAYS[3];
}




















