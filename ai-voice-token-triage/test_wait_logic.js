const { QueueSystem } = require('./lib/queueSystem');
const { db } = require('./lib/db');

// Mock Data
console.log("--- Setting up Mock Queues ---");

// 1. Vision Test (Multi-Room: A, B, C)
// We add 6 people. Load balancer should distribute 2, 2, 2.
// Effective queue length for new guy: 2.
// Wait: 2 * 5m = 10m.
for (let i = 0; i < 6; i++) {
    QueueSystem.addToStation('vision_test', { tokenId: `V-${i}`, esiLevel: 3, patientId: `P-${i}` });
}

// 2. Pharmacy (Single Room)
// We add 5 people.
// Wait: 5 * 5m = 25m.
for (let i = 0; i < 5; i++) {
    QueueSystem.addToStation('pharmacy', { tokenId: `PH-${i}`, esiLevel: 3, patientId: `PH-${i}` });
}

console.log("\n--- Running Estimation ---");
const pathway = ['vision_test', 'pharmacy'];
const estimate = QueueSystem.estimateJourneyDuration(pathway);

console.log("Total Minutes:", estimate.totalMinutes);
console.log("Breakdown:", JSON.stringify(estimate.details, null, 2));

// Expected:
// Vision: (6/3) * 5 = 10 wait + 5 service = 15.
// Pharmacy: 5 * 5 = 25 wait + 5 service = 30.
// Total: 45.

if (estimate.totalMinutes === 45) {
    console.log("\n✅ SUCCESS: Calculation matches expected logic.");
} else {
    console.log(`\n❌ FAILURE: Expected 45, got ${estimate.totalMinutes}`);
}
