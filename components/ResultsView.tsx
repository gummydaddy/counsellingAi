import React from 'react';
import { AnalysisResult } from '../types';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip
} from 'recharts';

interface Props {
  result: AnalysisResult;
  onReset: () => void;
}

const ResultsView: React.FC<Props> = ({ result, onReset }) => {
  const isHighRisk = result.riskAssessment.isConcern;
  const riskLevel = result.riskAssessment.level;

  const radarData = [
    { subject: 'Empathy', A: result.traits.empathy, fullMark: 100 },
    { subject: 'Logic', A: result.traits.logic, fullMark: 100 },
    { subject: 'Leadership', A: result.traits.leadership, fullMark: 100 },
    { subject: 'Aggression', A: result.traits.aggression, fullMark: 100 },
    { subject: 'Integrity', A: result.traits.integrity, fullMark: 100 },
  ];

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Critical': return 'bg-red-600 border-red-800 text-white';
      case 'High': return 'bg-orange-500 border-orange-700 text-white';
      case 'Moderate': return 'bg-yellow-400 border-yellow-600 text-slate-900';
      default: return 'bg-green-500 border-green-700 text-white';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 animate-fade-in pb-20">
      {/* Header Banner */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Analysis Complete</h1>
        <p className="text-slate-500">Based on your psychological profile</p>
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
          <div className={`p-6 rounded-2xl border-2 shadow-sm ${isHighRisk ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
             <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-slate-700">Behavioral Risk Index</h3>
               <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getRiskColor(riskLevel)}`}>
                 {riskLevel}
               </span>
             </div>
             
             {result.riskAssessment.flags.length > 0 ? (
               <div className="space-y-2">
                 <p className="text-xs text-slate-500 uppercase font-semibold">Flagged Patterns:</p>
                 <ul className="space-y-1">
                   {result.riskAssessment.flags.map((flag, i) => (
                     <li key={i} className="flex items-start text-sm text-slate-700">
                       <svg className="w-4 h-4 mr-2 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                       {flag}
                     </li>
                   ))}
                 </ul>
               </div>
             ) : (
               <div className="flex items-center text-green-700 text-sm">
                 <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 No behavioral red flags detected.
               </div>
             )}
             
             {isHighRisk && (
               <div className="mt-4 pt-4 border-t border-red-200">
                  <p className="text-xs text-red-800 font-semibold">
                    Recommendation: Please consult with a school counselor to discuss these results specifically regarding {result.riskAssessment.flags[0] || 'behavioral patterns'}.
                  </p>
               </div>
             )}
          </div>
        </div>

        {/* Center Column: Charts (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 h-full flex flex-col">
             <h3 className="font-semibold text-slate-900 mb-6 text-center">Psychometric Profile</h3>
             <div className="flex-grow min-h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                 <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                   <PolarGrid stroke="#e2e8f0" />
                   <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                   <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                   <Radar
                     name="Student"
                     dataKey="A"
                     stroke={isHighRisk ? '#ef4444' : '#2563eb'}
                     fill={isHighRisk ? '#fee2e2' : '#dbeafe'}
                     fillOpacity={0.6}
                   />
                   <Tooltip />
                 </RadarChart>
               </ResponsiveContainer>
             </div>
             <div className="mt-4 text-center">
                <div className="text-xs text-slate-400">
                  High Integrity + High Logic = <span className="text-slate-600 font-medium">Engineer/Builder</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  High Integrity + High Empathy = <span className="text-slate-600 font-medium">Doctor/Healer</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  High Leadership + Flexible Ethics = <span className="text-slate-600 font-medium">Politician/Leader</span>
                </div>
             </div>
           </div>
        </div>

        {/* Right Column: Career & Advice (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Predicted Career Matches
            </h3>
            <div className="space-y-3">
              {result.careerPathSuggestions.map((path, idx) => (
                <div key={idx} className="group p-3 rounded-lg border border-slate-100 hover:border-brand-200 hover:bg-brand-50 transition-all cursor-default">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-slate-800 group-hover:text-brand-700">{path.title}</h4>
                    <span className="text-xs font-mono text-slate-400">MATCH {98 - (idx * 5)}%</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-snug">{path.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 text-slate-200 p-6 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-5 rounded-full blur-xl"></div>
            <h3 className="text-lg font-bold text-white mb-3 flex items-center">
              AI Counselor Note
            </h3>
            <p className="text-sm leading-relaxed text-slate-300 italic">
              "{result.counselingAdvice}"
            </p>
          </div>
        </div>

      </div>

      <div className="flex justify-center mt-12">
        <button 
          onClick={onReset}
          className="group px-8 py-3 bg-white border border-slate-300 text-slate-600 font-medium rounded-full hover:bg-slate-800 hover:text-white hover:border-transparent transition-all shadow-sm"
        >
          Begin New Assessment
          <span className="inline-block transition-transform group-hover:rotate-180 ml-2">↻</span>
        </button>
      </div>
    </div>
  );
};

export default ResultsView;