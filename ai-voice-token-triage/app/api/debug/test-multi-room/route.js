import { NextResponse } from 'next/server';
import { QueueSystem } from '../../../../lib/queueSystem';
import { db } from '../../../../lib/db';

export async function GET() {
    try {
        // Reset for testing
        // db.resetDailyData(); // Optional: risky if live data exists

        const debugLog = [];

        // 1. Create 4 Patients
        const patients = ['P1', 'P2', 'P3', 'P4'];

        patients.forEach(pid => {
            const tokenId = `TEST-${pid}`;
            // Cleanup previous tests
            db.removeFromQueue('vision_test_A', tokenId);
            db.removeFromQueue('vision_test_B', tokenId);
            db.removeFromQueue('vision_test_C', tokenId);

            // Mock Visit in DB
            let visit = db.getVisit(tokenId);
            if (!visit) {
                visit = db.createVisit({
                    tokenId,
                    patientId: pid,
                    esiLevel: 3,
                    timestamp: new Date().toISOString()
                });
            }

            // Start Journey
            QueueSystem.startJourney(tokenId, 3, "General");

            // Check assignment
            const v = db.getVisit(tokenId);
            debugLog.push(`Patient ${tokenId} assigned to Room: ${v.assignedRoom}`);
        });

        // 2. Check Queue Depths
        const queues = db.getQueues();
        debugLog.push(`Queue A Length: ${queues['vision_test_A']?.length}`);
        debugLog.push(`Queue B Length: ${queues['vision_test_B']?.length}`);
        debugLog.push(`Queue C Length: ${queues['vision_test_C']?.length}`);

        return NextResponse.json({
            message: "Test Complete",
            log: debugLog,
            queues: {
                A: queues['vision_test_A'],
                B: queues['vision_test_B'],
                C: queues['vision_test_C']
            }
        });
    } catch (e) {
        return NextResponse.json({ error: e.message, stack: e.stack });
    }
}
