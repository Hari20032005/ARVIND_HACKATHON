'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function PatientPortal() {
    const params = useParams();
    const tokenId = params.tokenId;
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    // Station Display Names & Rooms
    const STATION_INFO = {
        'vision_test': { name: 'Vision Testing', room: 'Room 104', icon: '👁️' },
        'refraction': { name: 'Refraction (Glasses)', room: 'Room 105', icon: '👓' },
        'dilation': { name: 'Dilation Waiting', room: 'Dilation Area', icon: '💧' },
        'fundus_photo': { name: 'Fundus Imaging', room: 'Room 108', icon: '📸' },
        'investigation': { name: 'Lab Investigation', room: 'Lab 1', icon: '🔬' },
        'doctor_consult': { name: 'Doctor Consultation', room: 'Room 201', icon: '👨‍⚕️' },
        'pharmacy': { name: 'Pharmacy', room: 'Ground Floor', icon: '💊' },
        'trauma_center': { name: 'Trauma Center', room: 'Red Zone', icon: '🚨' }
    };

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch(`/api/patient-status?tokenId=${tokenId}`);
                if (res.ok) {
                    const data = await res.json();
                    setStatus(data);
                }
                setLoading(false);
            } catch (e) {
                console.error(e);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, [tokenId]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading your journey...</div>;
    if (!status) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-red-400">Token Invalid</div>;

    const currentInfo = STATION_INFO[status.currentStation] || { name: status.currentStation, room: 'Unknown', icon: '📍' };

    // Calculate Progress
    const totalSteps = status.pathway.length;
    const currentStepIndex = status.pathway.indexOf(status.currentStation);
    const progress = ((currentStepIndex + 1) / totalSteps) * 100;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-10">
            {/* Header Area */}
            <div className="bg-slate-900 text-white p-6 pt-8 rounded-b-[3rem] shadow-2xl mb-8 relative overflow-hidden">
                {/* Abstract Background Shapes */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-3xl opacity-20 -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500 rounded-full blur-3xl opacity-10 -ml-10 -mb-10"></div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Token Number</p>
                            <h1 className="text-6xl font-black tracking-tighter text-white">{tokenId}</h1>
                            <div className="mt-2 flex items-center gap-2 text-blue-200">
                                <span className="font-semibold text-lg">{status.name}</span>
                                <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                                <span className="opacity-75">{status.age}y / {status.gender}</span>
                            </div>
                            <div className="inline-block mt-3 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs font-bold text-slate-300 uppercase tracking-wide">
                                {status.complaint}
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-xl text-center shadow-lg ${status.esiLevel === 1 ? 'bg-red-500 text-white' :
                            status.esiLevel === 2 ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'
                            }`}>
                            <div className="text-[10px] font-bold uppercase opacity-80">ESI Level</div>
                            <div className="text-2xl font-black">{status.esiLevel}</div>
                        </div>
                    </div>

                    {/* Main Status High-Contrast Card */}
                    <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-xl transform translate-y-4">
                        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-4">
                            <span className="text-3xl">{currentInfo.icon}</span>
                            <div>
                                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Current Station</div>
                                <div className="text-xl font-black leading-tight">{currentInfo.name}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                                <div className="text-blue-400 text-[10px] font-bold uppercase mb-1">Queue Position</div>
                                <div className="text-4xl font-black text-blue-600">
                                    {status.queuePosition > 0 ? `#${status.queuePosition}` : <span className="text-2xl">NOW</span>}
                                </div>
                            </div>
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center">
                                <div className="text-emerald-500 text-[10px] font-bold uppercase mb-1">Est. Wait Time</div>
                                <div className="text-4xl font-black text-emerald-600">{status.estimatedWait}<span className="text-lg text-emerald-400 ml-1">m</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Wayfinding / Action */}
            {/* Wayfinding / Action */}
            <div className="px-6 mb-10 pt-10">
                <div className="bg-amber-50 p-6 rounded-2xl border-l-8 border-amber-400 shadow-sm">
                    <h3 className="text-amber-500 text-[10px] font-black uppercase tracking-widest mb-3">ACTION REQUIRED</h3>
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-xl shrink-0">
                            🏃
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-800 leading-none mb-2">Go to {currentInfo.room}</div>
                            <div className="text-slate-500 font-medium">Follow the <span className="bg-blue-100 text-blue-700 px-1 rounded">Blue Line</span> on the floor</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Journey Timeline */}
            <div className="px-6 pb-12">
                <h3 className="text-slate-300 text-xs font-black uppercase tracking-widest mb-6 ml-2">YOUR JOURNEY</h3>
                <div className="relative pl-4 border-l-2 border-slate-200 space-y-10">
                    {status.pathway.map((step, idx) => {
                        const info = STATION_INFO[step] || { name: step, icon: '📍' };
                        const isCompleted = idx < currentStepIndex;
                        const isCurrent = idx === currentStepIndex;
                        const isFuture = idx > currentStepIndex;

                        return (
                            <div key={step} className={`relative pl-8 transition-all duration-500 ${isFuture ? 'opacity-40 grayscale' : 'opacity-100'}`}>
                                {/* Timeline Dot */}
                                <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 shadow-sm z-10 box-content
                                    ${isCompleted ? 'bg-emerald-500 border-white ring-2 ring-emerald-100' :
                                        isCurrent ? 'bg-blue-600 border-white ring-4 ring-blue-200 scale-125' :
                                            'bg-slate-200 border-white'}`}>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className={`text-xl ${isFuture ? 'opacity-50' : 'opacity-100'}`}>{info.icon}</div>
                                    <div>
                                        <div className={`font-bold text-lg leading-tight ${isCurrent ? 'text-slate-900 text-xl' : 'text-slate-700'}`}>
                                            {info.name}
                                        </div>
                                        {isCurrent && (
                                            <div className="text-blue-600 text-xs font-bold uppercase tracking-wider mt-1 animate-pulse">In Progress</div>
                                        )}
                                        {isCompleted && (
                                            <div className="text-emerald-600 text-xs font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                                                <span>✓ Completed</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
