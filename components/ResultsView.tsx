
import React, { useState, useEffect } from 'react';
import { AnalysisResult, SessionType, Answer } from '../types.ts';
import { generateMetaInsight } from '../services/geminiService.ts';
import { KnowledgeBaseService } from '../services/knowledgeBaseService.ts';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts';

interface Props {
  result: AnalysisResult;
  answers: Answer[];
  onReset: () => void;
}

const ResultsView: React.FC<Props> = ({ result, answers, onReset }) => {
  const [isLearning, setIsLearning] = useState(false);
  const [hasLearned, setHasLearned] = useState(false);
  const [experienceLevel, setExperienceLevel] = useState('Novice');
  
  const sessionType = result.sessionType || 'school';
  const isHighRisk = result.riskAssessment.isConcern;
  const riskLevel = result.riskAssessment.level;

  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await KnowledgeBaseService.getStats();
        setExperienceLevel(stats.experienceLevel);
      } catch (error) {
        console.error("Failed to load stats", error);
      }
    };
    loadStats();
  }, []);

  const handleValidateAndGrow = async () => {
    setIsLearning(true);
    try {
      const insight = await generateMetaInsight(result, answers);
      await KnowledgeBaseService.addInsight({
        sessionType: sessionType,
        pattern: insight.pattern,
        recommendation: insight.recommendation,
        timestamp: Date.now()
      });
      setHasLearned(true);
      
      // Update experience level after learning
      const stats = await KnowledgeBaseService.getStats();
      setExperienceLevel(stats.experienceLevel);
    } catch (e) {
      console.error("Learning failed", e);
    } finally {
      setIsLearning(false);
    }
  };

  const getTraitLabels = (type: SessionType) => {
    switch (type) {
      case 'medical': return ['Compliance', 'Logic', 'Body Trust', 'Resilience', 'Energy', 'Anxiety Control'];
      case 'psychological': return ['Insight', 'Logic', 'Emotion Reg', 'Resilience', 'Coping', 'Self-Worth'];
      case 'career': return ['Ambition', 'Logic', 'Integrity', 'Resilience', 'Leadership', 'Diplomacy'];
      case 'relationship': return ['Empathy', 'Logic', 'Conflict Res', 'Resilience', 'Vulnerability', 'Boundaries'];
      case 'school': default: return ['Curiosity', 'Logic', 'Discipline', 'Resilience', 'Ambition', 'Social'];
    }
  };

  const labels = getTraitLabels(sessionType);
  const radarData = [
    { subject: labels[0], Value: result.traits.empathy, fullMark: 100 },
    { subject: labels[1], Value: result.traits.logic, fullMark: 100 },
    { subject: labels[2], Value: result.traits.integrity, fullMark: 100 },
    { subject: labels[3], Value: result.traits.resilience, fullMark: 100 },
    { subject: labels[4], Value: result.traits.ambition, fullMark: 100 },
    { subject: labels[5], Value: result.traits.social_calibration, fullMark: 100 },
  ];

  const getSessionTheme = (type: SessionType) => {
    switch (type) {
      case 'medical': return { title: 'Clinical Medical Report', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: '🩺', specializedHeader: 'Primary Diagnosis' };
      case 'psychological': return { title: 'Psychological Insight Audit', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: '🧠', specializedHeader: 'Root Cause Analysis' };
      case 'career': return { title: 'Strategic Executive Summary', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '💼', specializedHeader: 'Executive Roadmap' };
      case 'relationship': return { title: 'Relationship Dynamics Audit', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', icon: '❤️', specializedHeader: 'Interpersonal Strategy' };
      case 'school': default: return { title: 'Student Academic Roadmap', color: 'text-brand-700', bg: 'bg-brand-50', border: 'border-brand-200', icon: '🎓', specializedHeader: 'Future Success Path' };
    }
  };

  const theme = getSessionTheme(sessionType);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div className="text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
            <span className="text-3xl p-3 bg-white rounded-2xl shadow-sm border border-slate-100">{theme.icon}</span>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{theme.title}</h1>
              <p className="text-xs text-slate-400 font-mono tracking-tighter uppercase">Professional Intelligence Level: {experienceLevel}</p>
            </div>
          </div>
        </div>
        
        {!hasLearned ? (
          <button 
            onClick={handleValidateAndGrow}
            disabled={isLearning}
            className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow-lg hover:shadow-brand-100 transition-all flex items-center disabled:opacity-50"
          >
            {isLearning ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span> Finalizing Learning...</>
            ) : (
              <><span className="mr-2">🧩</span> Validate Clinical Accuracy</>
            )}
          </button>
        ) : (
          <div className="px-6 py-3 bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-200 shadow-sm animate-fade-in">
            ✓ Clinical Rule Recorded
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Profile Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className={`bg-white p-8 rounded-3xl shadow-xl border-t-8 ${theme.border} relative overflow-hidden`}>
            <div className={`absolute top-0 right-0 p-4 opacity-5 text-6xl`}>{theme.icon}</div>
            <h2 className="text-xs font-black tracking-widest text-slate-400 uppercase mb-3">Professional Archetype</h2>
            <h1 className={`text-3xl font-extrabold mb-4 leading-none ${isHighRisk ? 'text-red-700' : theme.color}`}>
              {result.archetype}
            </h1>
            <p className="text-slate-600 leading-relaxed text-sm font-medium">{result.archetypeDescription}</p>
          </div>

          <div className={`p-6 rounded-3xl border-2 shadow-sm ${isHighRisk ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
             <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-slate-800">Professional Risk Assessment</h3>
               <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${isHighRisk ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{riskLevel}</span>
             </div>
             <p className="text-sm text-slate-700 italic border-l-4 border-slate-200 pl-4 py-1 leading-relaxed">
               {result.riskAssessment.detailedAnalysis}
             </p>
          </div>
        </div>

        {/* Specialized Insight Card (The Heart of the Request) */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 h-full flex flex-col">
             <h3 className={`font-black ${theme.color} mb-6 text-sm uppercase tracking-widest flex items-center gap-2`}>
               <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
               {theme.specializedHeader}
             </h3>

             {/* Medical Specialization */}
             {sessionType === 'medical' && (
               <div className="space-y-6 animate-fade-in">
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Diagnosis</p>
                    <p className="text-slate-800 font-semibold">{result.professionalDiagnosis || "Observation ongoing."}</p>
                 </div>
                 <div>
                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Suggested Precautions</p>
                    <ul className="space-y-2">
                      {result.primaryPrecautions?.map((p, i) => (
                        <li key={i} className="text-sm text-slate-600 flex gap-2">
                          <span className="text-red-400">•</span> {p}
                        </li>
                      ))}
                    </ul>
                 </div>
                 <div className="mt-auto p-4 bg-red-50 rounded-2xl border border-red-100">
                    <p className="text-xs font-bold text-red-800 mb-2 uppercase">Suggested Support (OTC Only)</p>
                    <p className="text-sm text-red-700 font-medium italic">"{result.suggestedMedicines?.join(', ') || 'Consult a physical doctor for specific medication.'}"</p>
                    <p className="text-[10px] text-red-400 mt-2 uppercase font-black">Educational Purposes Only</p>
                 </div>
               </div>
             )}

             {/* Psychological Specialization */}
             {sessionType === 'psychological' && (
               <div className="space-y-6 animate-fade-in">
                 <div>
                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Diagnostic Root Causes</p>
                    <div className="space-y-2">
                      {result.rootCauses?.map((c, i) => (
                        <div key={i} className="p-3 bg-purple-50 text-purple-800 text-xs font-bold rounded-xl border border-purple-100">
                          {c}
                        </div>
                      ))}
                    </div>
                 </div>
                 <div>
                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Therapeutic Focus</p>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{result.counselingAdvice}</p>
                 </div>
               </div>
             )}

             {/* Career / School / Relationship Defaults */}
             {['career', 'school', 'relationship'].includes(sessionType) && (
               <div className="space-y-6 animate-fade-in">
                 <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                    <p className="text-xs font-black text-indigo-400 mb-2 uppercase">Strategy Overview</p>
                    <p className="text-sm text-indigo-900 font-medium leading-relaxed italic">
                      {sessionType === 'relationship' ? result.interpersonalStrategy : result.counselingAdvice}
                    </p>
                 </div>
                 <div>
                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Milestone Action Plan</p>
                    <div className="space-y-3">
                      {(result.suggestedActionPlan || result.careerPathSuggestions.map(p => p.title)).map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full ${theme.bg} ${theme.color} flex items-center justify-center text-[10px] font-black border ${theme.border}`}>
                            {i+1}
                          </div>
                          <p className="text-sm text-slate-700 font-bold">{typeof item === 'string' ? item : item}</p>
                        </div>
                      ))}
                    </div>
                 </div>
               </div>
             )}
           </div>
        </div>

        {/* Trait Radar */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center">
             <h3 className="font-bold text-slate-900 mb-8 text-sm uppercase tracking-widest">Clinical Trait Signature</h3>
             <div className="h-[280px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                   <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                   <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} />
                   <Radar
                     name="Patient Data"
                     dataKey="Value"
                     stroke={isHighRisk ? '#dc2626' : theme.color.includes('blue') ? '#2563eb' : theme.color.includes('emerald') ? '#059669' : '#4f46e5'}
                     strokeWidth={3}
                     fill={isHighRisk ? '#fee2e2' : theme.bg.replace('bg-', '#').replace('-50', '')}
                     fillOpacity={0.6}
                   />
                   <Tooltip />
                 </RadarChart>
               </ResponsiveContainer>
             </div>
             <div className="mt-6 w-full pt-6 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-black uppercase text-center mb-4">Recommended Career Pathings</p>
                <div className="flex flex-wrap gap-2 justify-center">
                   {result.careerPathSuggestions.slice(0, 3).map((p, i) => (
                     <span key={i} className={`px-3 py-1 rounded-lg text-[10px] font-bold border ${theme.border} ${theme.bg} ${theme.color}`}>
                       {p.title}
                     </span>
                   ))}
                </div>
             </div>
           </div>

           <button onClick={onReset} className="w-full py-5 rounded-3xl bg-slate-900 text-white font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
             End Session & Log Report
           </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
