'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { playSuccessTone, playErrorTone } from '../../utils/soundUtils';
import { predictWaitTime, getProcessInsights } from '../../lib/aiModel';

import { analyzeMedicalContext } from '../../lib/genAiTriage';
import { loadModel, classifySemantic } from '../../lib/edgeAi';
import { getPathwayForESI } from '../../lib/pathways'; // Client-safe import

import DigitalTicket from '../../components/DigitalTicket';

export default function ComplaintMappingPage() {

async function sendSMS() {
  const patientData = JSON.parse(
    localStorage.getItem("current_patient")
  );

  if (!patientData) {
    console.error("Phone number missing");
    return;
  }

  const message = "✅ Your appointment is confirmed at EyeCare Hospital.";

  const res = await fetch("/api/send-whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phoneNumber: patientData.phone,
      message: message,
    }),
  });

  const data = await res.json();
  console.log("WhatsApp response:", data);
}
  const router = useRouter();
  const searchParams = useSearchParams();

  const complaint = searchParams.get('complaint');
  const serverCategory = searchParams.get('category');
  const serverConfidence = searchParams.get('confidence');
  const serverSeverity = searchParams.get('severity');
  const serverReasoning = searchParams.get('reasoning');
  const stressLevel = searchParams.get('stress');
  const pain = searchParams.get('pain');
  const risksParam = searchParams.get('risks');
  const mlScore = searchParams.get('ml');
  const esiLevelParam = searchParams.get('esi_level');
  const esiActionParam = searchParams.get('esi_action');

  const [mappedComplaint, setMappedComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [isCorrecting, setIsCorrecting] = useState(false);

  // Digital Ticket State
  const [showTicket, setShowTicket] = useState(false);
  const [ticketData, setTicketData] = useState(null);

  // Edge AI State
  const [edgeAiResult, setEdgeAiResult] = useState(null);
  const [modelLoading, setModelLoading] = useState(true);

  useEffect(() => {
    // Initialize Edge AI
    const initEdgeAi = async () => {
      const loaded = await loadModel();
      setModelLoading(false);
      if (loaded && complaint) {
        const result = await classifySemantic(complaint);
        setEdgeAiResult(result);
      }
    };
    initEdgeAi();
  }, [complaint]);

  useEffect(() => {
    if (complaint) {
      // Simulate "Thinking" time for effect, though processing is fast
      setTimeout(() => {
        try {
          const category = serverCategory || "OPD_GENERAL";
          const waitTime = predictWaitTime(category);
          const insights = getProcessInsights();

          setMappedComplaint({
            complaint,
            category,
            description: getCategoryDescription(category),
            waitTime: waitTime,
            severity: serverSeverity || "low",
            confidence: serverConfidence || 0.9,
            reasoning: serverReasoning || "Standard Triage",
            stress: stressLevel || "normal",
            painDetected: pain === 'true',
            riskFactors: risksParam ? JSON.parse(risksParam) : [],
            esiLevel: esiLevelParam ? parseInt(esiLevelParam) : 3,
            esiAction: esiActionParam || "General Assessment"
          });

          setAiInsights(insights);
          playSuccessTone();
          setLoading(false);
        } catch (err) {
          console.error(err);
          setError('Error mapping complaint');
          playErrorTone();
          setLoading(false);
        }
      }, 1500);
    } else {
      router.push('/');
    }
  }, [complaint, serverCategory, serverConfidence, serverSeverity, serverReasoning, stressLevel, pain, router]);

  const getCategoryDescription = (cat) => {
    const map = {
      'OPD_GENERAL': 'General Consultation',
      'REFRACTION': 'Vision Testing',
      'OPHTHALMOLOGY': 'Specialist Care',
      'EMERGENCY': 'Urgent Care Unit',
      'GENERAL_CHECKUP': 'Routine Exam'
    };
    return map[cat] || 'Consultation';
  };

  const handleNext = () => {

    if (mappedComplaint) {
      // Innovation: Digital Token Generation
      // Instead of just routing, we show the ticket first.
      const selectedEsi = mappedComplaint.esiLevel || 3;
      const selectedCategory = mappedComplaint.category;

      const journey = getPathwayForESI(selectedEsi, selectedCategory);

      const newToken = {
        tokenId: `AEH-${Math.floor(Math.random() * 900) + 100}`,
        category: mappedComplaint.category,
        waitTime: mappedComplaint.waitTime,
        timestamp: new Date().toISOString(),
        counter: Math.floor(Math.random() * 5) + 1,
        pathway: journey // Passed to Ticket
      };
      setTicketData(newToken);
      setShowTicket(true);
      playSuccessTone();
      sendSMS();


      // 1. Enter Patient into Intelligent Queue System
      fetch('/api/queue/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: newToken.tokenId,
          esiLevel: mappedComplaint.esiLevel || 3,
          patientId: "Unknown" // Hook to Auth if available
        })
      }).catch(err => console.error("Queue Entry Failed", err));

      // 2. Sync to EMR
      fetch('/api/emr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: newToken.tokenId,
          complaint: mappedComplaint.complaint,
          category: newToken.category,
          severity: mappedComplaint.severity
        })
      }).catch(err => console.error("EMR Sync Failed", err));
    }
  };

  const handleCorrection = async () => {
    // Simple prompt for demo purposes. In real app, this would be a modal.
    const newCategory = prompt("Please enter the correct category (e.g., RETINA, CORNEA):", "RETINA");

    if (newCategory) {
      try {
        // Send feedback to Reinforcement Learning Endpoint
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            complaint: mappedComplaint.complaint,
            originalCategory: mappedComplaint.category,
            correctedCategory: newCategory.toUpperCase(),
            reasoning: "Doctor manual correction"
          })
        });

        alert(`✅ Learning Recorded! The AI has adjusted its weights for "${mappedComplaint.complaint}" to map to "${newCategory.toUpperCase()}" in the future.`);

        // Optimistically update UI
        setMappedComplaint(prev => ({
          ...prev,
          category: newCategory.toUpperCase(),
          description: "Correction Applied (Doctor Verified)",
          confidence: 1.0 // Doctor is always right
        }));

      } catch (err) {
        console.error(err);
        alert("Failed to save feedback");
      }
    }
  };

  if (!complaint) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-8 border border-slate-200">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">
            AI Triage Analysis
          </h1>
          <p className="text-sm text-slate-400 mt-2 uppercase tracking-wide">
            Powered by Historical Data Models
          </p>
        </div>

        {/* Input Review */}
        <div className="mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-full text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 1.5a6 6 0 00-6 6v1.5a6 6 0 006 6 6 6 0 006-6v-1.5a6 6 0 00-6-6z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase">Detected Complaint</h2>
            <p className="text-xl text-slate-800 font-medium capitalize">{complaint}</p>
          </div>
        </div>

        {showTicket && ticketData ? (
          <div className="animate-fadeIn">
            <DigitalTicket tokenData={ticketData} />
            <div className="mt-8 text-center">
              <button
                onClick={() => router.push('/')}
                className="text-slate-400 text-sm hover:text-slate-600 underline"
              >
                Start New Patient
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center py-12">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-500 mb-4"></div>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-sky-500">AI</div>
            </div>
            <p className="text-lg text-slate-600 animate-pulse">Analyzing severity & routing...</p>
            <p className="text-xs text-slate-400 mt-2">Accessing 'OPArrivalPattern' database...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg mb-6 border border-red-200">
            {error}
          </div>
        ) : mappedComplaint && (
          <div className="space-y-6">

            {/* AI Analysis Cards */}
            <div className="grid md:grid-cols-2 gap-4">

              {/* Category Card */}
              <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-100">
                <h2 className="text-xs font-bold text-emerald-600 uppercase mb-2">Recommended Department</h2>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-emerald-800">{mappedComplaint.category.replace('_', ' ')}</span>
                  <span className="text-sm text-emerald-600 mt-1">{mappedComplaint.description}</span>
                </div>
              </div>

              {/* Predictive Wait Time Card */}
              <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-100 relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-xs font-bold text-indigo-600 uppercase mb-2">Predicted Wait Time</h2>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-indigo-800">{mappedComplaint.waitTime}</span>
                    <span className="text-sm text-indigo-600 font-medium">mins</span>
                  </div>
                  <p className="text-xs text-indigo-400 mt-2">Based on Real-Time Arrival Analysis</p>
                </div>
                {/* Background Chart Effect */}
                <div className="absolute bottom-0 right-0 opacity-10">
                  <svg width="100" height="60" viewBox="0 0 100 60" fill="none" className="text-indigo-600">
                    <path d="M0 60L20 40L40 50L60 20L80 30L100 0V60H0Z" fill="currentColor" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Voice Stress & Reasoning */}
            <div className="grid grid-cols-1 gap-4">
              {/* GenAI Reasoning */}
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                <h3 className="text-xs font-bold text-purple-600 uppercase mb-2 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5z" clipRule="evenodd" />
                  </svg>
                  GenAI Logic
                </h3>
                <p className="text-sm text-purple-800 italic">
                  "{mappedComplaint.reasoning}"
                </p>
              </div>

              {/* Edge AI Neural Analysis Box */}
              <div className="p-4 rounded-lg border bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900 relative overflow-hidden transition-all duration-500">
                <div className="flex items-center gap-2 mb-2 relative z-10">
                  <div className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse"></div>
                  <h3 className="font-bold uppercase text-xs tracking-wider">Neural Semantic Engine (TF.js)</h3>
                </div>

                {modelLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-3 w-3 border-b-2 border-fuchsia-600 rounded-full"></div>
                    <p className="text-xs italic opacity-75">Loading Tensor Model...</p>
                  </div>
                ) : edgeAiResult ? (
                  <div className="relative z-10 animate-fadeIn">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-lg font-bold">{edgeAiResult.category}</span>
                      <span className="text-xs bg-fuchsia-200 px-2 py-1 rounded text-fuchsia-800 font-bold">
                        {Math.round(edgeAiResult.confidence * 100)}% Match
                      </span>
                    </div>
                    <p className="text-xs text-fuchsia-600 mb-1">Matched Concept:</p>
                    <p className="text-sm font-medium italic">"{edgeAiResult.matchReason.replace('Semantic match with: ', '')}"</p>
                  </div>
                ) : (
                  <p className="text-sm">Semantic analysis unavailable.</p>
                )}

                {/* Decorative tensor background */}
                <div className="absolute top-0 right-0 opacity-5 transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" fill="none" />
                    <circle cx="50" cy="50" r="20" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M10 50 L90 50 M50 10 L50 90" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              {/* Voice Stress Removed per user request */}
              {/* Risk Factor Alert (Intelligent Triage) */}
              {mappedComplaint.riskFactors && mappedComplaint.riskFactors.length > 0 && (
                <div className="col-span-1 md:col-span-2 p-4 bg-orange-50 rounded-lg border border-orange-200 animate-pulse">
                  <div className="flex items-center gap-2 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-orange-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <h3 className="font-bold text-orange-700 uppercase">High Risk Patient Context</h3>
                  </div>
                  <ul className="list-disc list-inside text-sm text-orange-800 font-medium ml-2">
                    {mappedComplaint.riskFactors.map((risk, idx) => (
                      <li key={idx}>{risk}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-orange-600 mt-2 italic">Priority upgraded based on medical history.</p>
                </div>
              )}

              {/* ML Confidence Badge (Always Visible for Transparency) */}
              {mlScore && (
                <div className="col-span-1 md:col-span-2 p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${mlScore > 50 ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></div>
                    <span className="text-xs font-bold text-slate-600 uppercase">ML Risk Probability</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${mlScore > 50 ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
                    }`}>
                    {mlScore}% {mlScore > 50 ? "High Risk" : "Low Risk"}
                  </span>
                </div>
              )}

            </div>

            {/* Confidence Bar */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-slate-500">AI Confidence Score</span>
                  <span className="font-bold text-slate-700">{Math.round(mappedComplaint.confidence * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all duration-1000"
                    style={{ width: `${mappedComplaint.confidence * 100}%` }}
                  ></div>
                </div>
              </div>
              <div className="text-right border-l pl-4 border-slate-200">
                <div className="text-xs text-slate-400 mb-1">Triage Priority</div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`
                        px-3 py-1.5 rounded text-sm font-bold shadow-sm
                        ${mappedComplaint.esiLevel === 1 ? 'bg-red-600 text-white animate-pulse' :
                      mappedComplaint.esiLevel === 2 ? 'bg-orange-500 text-white' :
                        mappedComplaint.esiLevel === 3 ? 'bg-yellow-400 text-black' :
                          mappedComplaint.esiLevel === 4 ? 'bg-green-500 text-white' :
                            'bg-blue-500 text-white'}
                      `}>
                    ESI LEVEL {mappedComplaint.esiLevel}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500">{mappedComplaint.esiAction}</span>
                </div>
              </div>
            </div>

            {/* Doctor Feedback / Correction Loop (Reinforcement Learning) */}
            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs text-center text-slate-400 mb-3">Is this assessment accurate?</p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleNext}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:shadow-sky-200 transition-all transform hover:-translate-y-1 flex-1"
                >
                  ✅ Confirm & Print
                </button>

                <button
                  onClick={handleCorrection}
                  className="bg-white hover:bg-slate-50 text-slate-500 font-semibold py-3 px-6 rounded-full border border-slate-300 transition-all flex items-center gap-2"
                >
                  <span>✏️ Correct Triage</span>
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}