'use client';

import { QRCodeCanvas } from 'qrcode.react';
// Using qrcode.react which is the standard React wrapper, 
// wait, I installed 'qrcode'. Let me check usage for 'qrcode' package in React.
// Actually standard 'qrcode' is for node/browser JS. 
// For simpler React usage, I should have installed 'qrcode.react' or just use 'qrcode' to generate data URL.
// I will use 'qrcode' to generate a data URL string.

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export default function DigitalTicket({ tokenData }) {
    const [qrSrc, setQrSrc] = useState('');

    const getStationDetails = (id) => {
        const stations = {
            'vision_test': { name: 'Vision', room: 'Rm 104' },
            'refraction': { name: 'Refraction', room: 'Rm 105' },
            'dilation': { name: 'Dilation', room: 'Area A' },
            'fundus_photo': { name: 'Fundus', room: 'Rm 108' },
            'investigation': { name: 'Lab', room: 'Lab 1' },
            'doctor_consult': { name: 'Doctor', room: 'Rm 201' },
            'trauma_center': { name: 'Trauma', room: 'Red Zone' },
            'pharmacy': { name: 'Pharmacy', room: 'Grnd Flr' }
        };
        return stations[id] || { name: id, room: '' };
    };


    useEffect(() => {
        // Generate QR Data URL
        const generateQR = async () => {
            try {
                // Generate Full URL for Patient Companion App
                // Using ngrok public URL for mobile access
                const baseUrl = "https://297371881447.ngrok-free.app";
                const qrUrl = `${baseUrl}/patient/${tokenData.tokenId}`;

                const qr = await QRCode.toDataURL(qrUrl, {
                    width: 200,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#ffffff'
                    }
                });
                setQrSrc(qr);
            } catch (err) {
                console.error(err);
            }
        };
        generateQR();
    }, [tokenData]);

    return (
        <div className="bg-white p-6 rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full mx-auto relative overflow-hidden print:shadow-none print:border-2 print:border-black">

            {/* Cutout Circles for Ticket Look */}
            <div className="absolute -left-3 top-1/2 w-6 h-6 bg-slate-50 rounded-full"></div>
            <div className="absolute -right-3 top-1/2 w-6 h-6 bg-slate-50 rounded-full"></div>

            <div className="text-center border-b-2 border-dashed border-slate-200 pb-6 mb-6">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aravind Eye Hospital</h2>

                {/* ESI Stripe */}
                <div className={`w-full h-1 mt-2 mb-1 rounded-full ${tokenData.category === 'EMERGENCY' ? 'bg-red-500' :
                    tokenData.category === 'OPHTHALMOLOGY' ? 'bg-orange-500' :
                        'bg-green-500'
                    }`}></div>

                <h1 className="text-3xl font-black text-slate-800 mt-2">TOKEN</h1>
                <div className={`text-5xl font-black my-4 tracking-tighter ${tokenData.category === 'EMERGENCY' ? 'text-red-600' :
                    tokenData.category === 'OPHTHALMOLOGY' ? 'text-orange-600' :
                        'text-emerald-600'
                    }`}>
                    {tokenData.tokenId}
                </div>
                <div className="inline-block bg-slate-100 text-slate-600 px-3 py-1 rounded text-xs font-bold uppercase">
                    {tokenData.category.replace('_', ' ')}
                </div>
            </div>

            <div className="flex flex-col items-center justify-center space-y-4">
                {qrSrc ? (
                    <img src={qrSrc} alt="Token QR" className="w-32 h-32 border-4 border-white shadow-sm" />
                ) : (
                    <div className="w-32 h-32 bg-slate-100 animate-pulse rounded"></div>
                )}

                <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">Estimated Wait Time</p>
                    <p className="text-2xl font-bold text-slate-700">{tokenData.estimatedWaitTime} mins</p>
                </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                {/* Pathway / Journey Display */}
                {tokenData.pathway && (
                    <div className="mb-4">
                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Your Care Journey</p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {tokenData.pathway.map((stationId, idx) => {
                                const details = getStationDetails(stationId);
                                return (
                                    <div key={idx} className="flex items-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs font-bold text-slate-700">{details.name}</span>
                                            <span className="text-[9px] text-slate-400 font-mono bg-slate-50 px-1 rounded border border-slate-100">
                                                {details.room}
                                            </span>
                                        </div>
                                        {idx < tokenData.pathway.length - 1 && (
                                            <svg className="w-4 h-4 mx-1 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <p className="text-[10px] text-slate-400 uppercase">Please show this at Counter {tokenData.counter}</p>
                <div className="mt-4 print:hidden">
                    <button
                        onClick={() => window.print()}
                        className="flex items-center justify-center gap-2 mx-auto bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                        </svg>
                        Print Ticket
                    </button>
                </div>
                <p className="text-[10px] text-slate-300 mt-4">{new Date().toLocaleString()}</p>
            </div>
        </div>
    );
}
