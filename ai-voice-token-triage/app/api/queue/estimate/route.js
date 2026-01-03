import { NextResponse } from 'next/server';
import { QueueSystem } from '../../../../lib/queueSystem';
import { getPathwayForESI } from '../../../../lib/pathways';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const esiLevel = parseInt(searchParams.get('esi') || '3');

        if (!category && !esiLevel) {
            return NextResponse.json({ error: "Category or ESI required" }, { status: 400 });
        }

        // 1. Determine Pathway
        const pathway = getPathwayForESI(esiLevel, category);

        // 2. Calculate Estimate
        const estimate = QueueSystem.estimateJourneyDuration(pathway);

        return NextResponse.json({
            category,
            esiLevel,
            pathway,
            ...estimate
        });

    } catch (error) {
        console.error("Estimate API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
