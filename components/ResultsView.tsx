import React from 'react';
import { AnalysisResult } from '../types';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend
} from 'recharts';

interface Props {
  result: AnalysisResult;
  onReset: () => void;
}

const ResultsView: React.FC<Props> = ({ result, onReset }) => {
  const isHighRisk = result.riskAssessment.isConcern;
  const isCritical = result.riskAssessment.level === 'Critical';
  const riskLevel = result.riskAssessment.level;

  // Add a "Baseline" to the data so the graph always shows a comparison and doesn't look empty
  const radarData = [
    { subject: 'Empathy', Student: result.traits.empathy, Baseline: 60, fullMark: 100 },
    { subject: 'Logic', Student: result.traits.logic, Baseline: 50, fullMark: 100 },
    { subject: 'Integrity', Student: result.traits.integrity, Baseline: 65, fullMark: 100 },
    { subject: 'Resilience', Student: result.traits.resilience, Baseline: 55, fullMark: 100 },
    { subject: 'Ambition', Student: result.traits.ambition, Baseline: 50, fullMark: 100 },
    { subject: 'Social', Student: result.traits.social_calibration, Baseline: 60, fullMark: 100 },
  ];

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Critical': return 'bg-red-600 border-red-800 text-white';
      case 'High': return 'bg-orange-500 border-orange-700 text-white';
      case 'Moderate': return 'bg-yellow-400 border-yellow-600 text-slate-900';
      default: return 'bg-emerald-500 border-emerald-700 text-white';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 animate-fade-in pb-20">
      {/* Header Banner */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Comprehensive Profile</h1>
        <p className="text-slate-500">Analysis Depth: <span className="text-brand-600 font-semibold">Phase 2 Deep Dive</span></p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Archetype & Risk (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Main Card */}
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 overflow-hidden relative">
            <div className={`absolute top-0 left-0 w-full h-2 ${isHighRisk ? 'bg-red-500' : 'bg-brand-500'}`}></div>
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">Dominant Archetype</h2>
            <h1 className={`text-3xl font-extrabold mb-4 ${isHighRisk ? 'text-red-700' : 'text-brand-700'}`}>
              {result.archetype}
            </h1>
            <p className="text-slate-600 leading-relaxed text-sm">
              {result.archetypeDescription}
            </p>
          </div>

          {/* Risk Panel */}
          <div className={`p-6 rounded-2xl border-2 shadow-sm ${isHighRisk ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
             <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-slate-700">Risk Assessment Model</h3>
               <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getRiskColor(riskLevel)}`}>
                 {riskLevel} Risk
               </span>
             </div>
             
             {result.riskAssessment.flags.length > 0 ? (
               <div className="space-y-2">
                 <p className="text-xs text-slate-500 uppercase font-semibold">Detected Patterns:</p>
                 <ul className="space-y-1">
                   {result.riskAssessment.flags.map((flag, i) => (
                     <li key={i} className="flex items-start text-sm text-slate-700 bg-slate-50 p-2 rounded">
                       <svg className="w-4 h-4 mr-2 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                       {flag}
                     </li>
                   ))}
                 </ul>
               </div>
             ) : (
               <div className="flex items-center text-emerald-700 text-sm bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                 <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 No maladaptive behavioral flags detected.
               </div>
             )}
          </div>
        </div>

        {/* Center Column: Charts (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 h-full flex flex-col">
             <h3 className="font-semibold text-slate-900 mb-2 text-center">Hexagonal Personality Map</h3>
             <p className="text-xs text-center text-slate-400 mb-6">6-Axis Dimensional Analysis</p>
             
             {/* Graph Container with Explicit Height */}
             <div className="flex-grow min-h-[300px] w-full relative">
               <ResponsiveContainer width="100%" height="100%">
                 <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                   <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" />
                   <PolarAngleAxis 
                     dataKey="subject" 
                     tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }} 
                   />
                   <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                   
                   {/* Baseline Radar for Context */}
                   <Radar
                     name="Avg. Student"
                     dataKey="Baseline"
                     stroke="#94a3b8"
                     strokeWidth={1}
                     fill="#f1f5f9"
                     fillOpacity={0.4}
                   />
                   
                   {/* Student Radar */}
                   <Radar
                     name="Student"
                     dataKey="Student"
                     stroke={isHighRisk ? '#dc2626' : '#7c3aed'}
                     strokeWidth={3}
                     fill={isHighRisk ? '#fee2e2' : '#8b5cf6'}
                     fillOpacity={0.5}
                   />
                   
                   <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}/>
                   <Tooltip 
                     contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                     itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                   />
                 </RadarChart>
               </ResponsiveContainer>
             </div>
             
             <div className="grid grid-cols-2 gap-2 mt-4">
                {Object.entries(result.traits).map(([trait, score]) => (
                  <div key={trait} className="bg-slate-50 p-2 rounded border border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500 capitalize">{trait.replace('_', ' ')}</span>
                    <span className={`text-sm font-bold ${isHighRisk && trait === 'integrity' && score < 40 ? 'text-red-600' : 'text-slate-800'}`}>
                      {score}%
                    </span>
                  </div>
                ))}
             </div>
           </div>
        </div>

        {/* Right Column: Career & Advice (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
            {isCritical ? (
              <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                <h3 className="font-bold text-red-900 mb-2 flex items-center">
                   <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                   Counseling Required
                </h3>
                <p className="text-sm text-red-800">
                   Specific behavioral patterns suggest professional counseling is the primary recommendation over career guidance at this stage.
                </p>
              </div>
            ) : (
              <>
                <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Strategic Career Paths
                </h3>
                <div className="space-y-4">
                  {result.careerPathSuggestions.map((path, idx) => (
                    <div key={idx} className="group p-3 hover:bg-brand-50 rounded-lg transition-colors border border-transparent hover:border-brand-100">
                      <div className="font-bold text-slate-800 group-hover:text-brand-700">{path.title}</div>
                      <div className="text-xs text-slate-500 leading-snug">{path.description}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100 shadow-sm">
            <h3 className="font-bold text-indigo-900 mb-3 text-sm uppercase tracking-wide">Growth Counsel</h3>
            <p className="text-sm text-indigo-800 italic leading-relaxed">
              "{result.counselingAdvice}"
            </p>
          </div>

          <button onClick={onReset} className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors">
            Start New Assessment
          </button>
        </div>

      </div>
    </div>
  );
};

export default ResultsView;