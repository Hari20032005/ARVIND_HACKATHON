import { NextResponse } from 'next/server';
import { QueueSystem } from '../../../../lib/queueSystem';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const station = searchParams.get('id');

        if (!station) {
            return NextResponse.json({ error: "Station ID required" }, { status: 400 });
        }

        // Logic for Multi-Room Stations
        const subRooms = QueueSystem.STATION_SUB_ROOMS[station];
        if (subRooms) {
            const roomsData = subRooms.map(roomSuffix => {
                const subQueueName = `${station}_${roomSuffix}`;
                const queue = QueueSystem.getStationQueue(subQueueName);
                return {
                    id: roomSuffix,
                    name: `Room ${roomSuffix}`,
                    queue: queue,
                    count: queue.length,
                    nextPatient: queue.length > 0 ? queue[0] : null
                };
            });

            return NextResponse.json({
                station,
                isMultiRoom: true,
                rooms: roomsData
            });
        }

        // Default Single Room Logic
        const queue = QueueSystem.getStationQueue(station);

        return NextResponse.json({
            station,
            isMultiRoom: false,
            queue,
            count: queue.length,
            nextPatient: queue.length > 0 ? queue[0] : null
        });
    } catch (error) {
        console.error("Station API Error:", error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
