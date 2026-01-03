'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import { playSuccessTone, playErrorTone } from '../../utils/soundUtils';

export default function TokenGeneration() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get('category');
  const complaint = decodeURIComponent(searchParams.get('complaint') || '');

  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileUrl, setMobileUrl] = useState('');
  const [emrSyncStatus, setEmrSyncStatus] = useState('pending'); // pending, syncing, success, failed

  useEffect(() => {
    if (category && complaint) {
      // Generate a mock token with the required information
      // Generate a mock token with the required information
      setTimeout(async () => {
        try {
          // 🚀 Fetch Smart Wait Estimate
          let smartWaitTime = 40;
          try {
            // We can't easily pass ESI here without full logic, but we can pass category
            // The API defaults to ESI 3 if not provided
            const res = await fetch(`/api/queue/estimate?category=${encodeURIComponent(category)}`);
            const data = await res.json();
            if (data.totalMinutes) smartWaitTime = data.totalMinutes;
          } catch (e) {
            console.error("Estimate fetch failed", e);
          }

          const newToken = {
            id: `A-${Math.floor(100 + Math.random() * 900)}`, // Format: A-101 to A-999
            complaint: complaint,
            category: category,
            assignedDoctor: "Dr. Senthil Kumar", // Assigned based on category
            stationList: getStationsForCategory(category),
            timestamp: new Date().toISOString(),
            queuePosition: Math.floor(Math.random() * 20) + 1, // Random position between 1-20
            estimatedWaitTime: smartWaitTime
          };

          setToken(newToken);
          setMobileUrl(`${window.location.origin}/mobile-token/${newToken.id}`);

          // Sync to EMR after token generation
          syncToEMR(newToken);
          playSuccessTone(); // Play success sound
          setLoading(false);
        } catch (err) {
          setError('Error generating token');
          playErrorTone(); // Play error sound
          console.error(err);
          setLoading(false);
        }
      }, 2000);
    } else {
      router.push('/routing');
    }
  }, [category, complaint, router]);

  // Sync token data to EMR
  const syncToEMR = async (tokenData) => {
    setEmrSyncStatus('syncing');

    try {
      const response = await fetch('/api/emr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'pushToEMR',
          data: tokenData
        })
      });

      const result = await response.json();

      if (result.success) {
        setEmrSyncStatus('success');
        playSuccessTone(); // Play success sound for EMR sync
      } else {
        console.error('EMR sync failed:', result.message);
        setEmrSyncStatus('failed');
        playErrorTone(); // Play error sound for EMR sync failure
      }
    } catch (error) {
      console.error('EMR sync error:', error);
      setEmrSyncStatus('failed');
      playErrorTone(); // Play error sound for EMR sync failure
    }
  };

  // Helper functions
  const getStationsForCategory = (cat) => {
    const routes = {
      "OPD_GENERAL": [
        { id: 1, name: "Registration", completed: false, current: true },
        { id: 2, name: "Vitals", completed: false, current: false },
        { id: 3, name: "Doctor Consultation", completed: false, current: false },
        { id: 4, name: "Pharmacy", completed: false, current: false }
      ],
      "REFRACTION": [
        { id: 1, name: "Registration", completed: false, current: true },
        { id: 2, name: "Refraction Test", completed: false, current: false },
        { id: 3, name: "Doctor Consultation", completed: false, current: false },
        { id: 4, name: "Optical Shop", completed: false, current: false }
      ],
      "OPHTHALMOLOGY": [
        { id: 1, name: "Registration", completed: false, current: true },
        { id: 2, name: "Triage", completed: false, current: false },
        { id: 3, name: "Doctor Consultation", completed: false, current: false },
        { id: 4, name: "Procedure Room", completed: false, current: false },
        { id: 5, name: "Pharmacy", completed: false, current: false }
      ],
      "GENERAL_CHECKUP": [
        { id: 1, name: "Registration", completed: false, current: true },
        { id: 2, name: "Vitals", completed: false, current: false },
        { id: 3, name: "Doctor Consultation", completed: false, current: false }
      ],
      "EMERGENCY": [
        { id: 1, name: "Triage", completed: false, current: true },
        { id: 2, name: "Emergency Doctor", completed: false, current: false },
        { id: 3, name: "Specialist Consultation", completed: false, current: false }
      ],
      "GENERAL": [
        { id: 1, name: "Registration", completed: false, current: true },
        { id: 2, name: "Triage", completed: false, current: false },
        { id: 3, name: "Doctor Consultation", completed: false, current: false }
      ]
    };

    return routes[cat] || routes["GENERAL"];
  };

  const calculateWaitTime = (cat) => {
    const timeEstimates = {
      "OPD_GENERAL": 45,
      "REFRACTION": 60,
      "OPHTHALMOLOGY": 75,
      "GENERAL_CHECKUP": 30,
      "EMERGENCY": 15,
      "GENERAL": 40
    };

    return timeEstimates[cat] || 40; // Default to 40 minutes
  };

  const handlePrint = () => {
    window.print();
  };

  if (!category || !complaint) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-700">Missing required information</p>
          <button
            onClick={() => router.push('/routing')}
            className="mt-4 bg-primary-500 hover:bg-primary-600 text-white font-bold py-2 px-6 rounded-full"
          >
            Back to Routing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-primary-700 mb-2">
          Your Token
        </h1>
        <p className="text-lg text-center text-gray-600 mb-8">Please proceed to the appropriate station</p>

        {loading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
            <p className="text-lg text-gray-600">Generating your token...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg mb-6">
            {error}
          </div>
        ) : token && (
          <div className="space-y-8">
            {/* Token Card */}
            <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-blue-500 text-center mb-8">
              <div className="text-8xl font-bold text-blue-700 mb-4">
                {token.id}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <p className="text-sm text-gray-600 font-medium">Complaint:</p>
                  <p className="font-semibold text-lg text-gray-800">{token.complaint}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <p className="text-sm text-gray-600 font-medium">Category:</p>
                  <p className="font-semibold text-lg text-gray-800">{token.category}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <p className="text-sm text-gray-600 font-medium">Assigned Doctor:</p>
                  <p className="font-semibold text-lg text-gray-800">{token.assignedDoctor}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <p className="text-sm text-gray-600 font-medium">Estimated Wait:</p>
                  <p className="font-semibold text-lg text-gray-800">{token.estimatedWaitTime} min</p>
                </div>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center my-8 p-4 bg-white rounded-lg border-2 border-blue-500">
              <QRCodeCanvas
                value={mobileUrl}
                size={180}
                bgColor="#ffffff"
                fgColor="#0259d2"
                level="H"
                includeMargin={true}
              />
              <p className="mt-4 text-base text-gray-700 font-medium">Scan to access your token details on mobile</p>
            </div>

            {/* Station Timeline */}
            <div className="mt-10">
              <h2 className="text-2xl font-bold text-center mb-8 text-gray-800">Your Journey</h2>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 h-full w-1 bg-gradient-to-b from-blue-500 to-blue-300 transform translate-x-1/2"></div>

                {/* Station steps */}
                {token.stationList.map((station, index) => (
                  <div key={station.id} className="relative" style={{ marginLeft: '2rem' }}>
                    {/* Station circle */}
                    <div className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center ${station.current ? 'bg-blue-500 text-white' :
                        station.completed ? 'bg-green-500 text-white' :
                          'bg-gray-300 text-gray-700'
                      }`}>
                      {station.current ? (
                        <span className="font-bold">{index + 1}</span>
                      ) : station.completed ? (
                        <span className="font-bold">✓</span>
                      ) : (
                        <span className="font-bold">{index + 1}</span>
                      )}
                    </div>

                    {/* Station info */}
                    <div className={`p-4 rounded-lg ml-14 ${station.current ? 'bg-blue-50 border border-blue-200' :
                        station.completed ? 'bg-green-50 border border-green-200' :
                          'bg-gray-50 border border-gray-200'
                      }`}>
                      <h3 className={`font-semibold ${station.current ? 'text-blue-700' :
                          station.completed ? 'text-green-700' :
                            'text-gray-700'
                        }`}>
                        {station.name}
                      </h3>
                      {station.current && (
                        <p className="text-blue-600 font-semibold">Current Station</p>
                      )}
                      {station.completed && (
                        <p className="text-green-600 font-semibold">Completed</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* EMR Sync Status */}
            <div className={`mt-6 p-4 rounded-lg border flex items-center ${emrSyncStatus === 'pending' ? 'border-gray-300 bg-gray-50' :
                emrSyncStatus === 'syncing' ? 'border-yellow-300 bg-yellow-50' :
                  emrSyncStatus === 'success' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
              }`}>
              <div className={`w-3 h-3 rounded-full mr-3 ${emrSyncStatus === 'pending' ? 'bg-gray-400' :
                  emrSyncStatus === 'syncing' ? 'bg-yellow-500 animate-pulse' :
                    emrSyncStatus === 'success' ? 'bg-green-500' :
                      'bg-red-500'
                }`}></div>
              <div className="flex-grow">
                <p className="font-bold text-gray-800">Auroitech – Eyenotes (Mock API)</p>
                <p className="text-sm">
                  {emrSyncStatus === 'pending' ? 'Preparing to sync...' :
                    emrSyncStatus === 'syncing' ? 'Syncing to EMR system...' :
                      emrSyncStatus === 'success' ? 'Successfully synced to EMR' :
                        'EMR sync failed'}
                </p>
              </div>
              {emrSyncStatus === 'syncing' && (
                <div className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-3"></div>
              )}
            </div>

            {/* Print Button */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
              <button
                onClick={handlePrint}
                className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-full shadow-lg transition duration-300 transform hover:scale-105"
              >
                Print Token
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-full shadow-lg transition duration-300 transform hover:scale-105"
              >
                New Registration
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}