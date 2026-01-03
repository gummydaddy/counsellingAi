
import React, { useState } from 'react';
import { AnalysisResult, SessionType, Answer } from '../types';
import { generateMetaInsight } from '../services/geminiService';
import { KnowledgeBaseService } from '../services/knowledgeBaseService';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts';

interface Props {
  result: AnalysisResult;
  answers: Answer[]; // Added to allow insight generation
  onReset: () => void;
}

const ResultsView: React.FC<Props> = ({ result, answers, onReset }) => {
  const [isLearning, setIsLearning] = useState(false);
  const [hasLearned, setHasLearned] = useState(false);
  
  const sessionType = result.sessionType || 'school';
  const isHighRisk = result.riskAssessment.isConcern;
  const riskLevel = result.riskAssessment.level;

  const handleValidateAndGrow = async () => {
    setIsLearning(true);
    try {
      const insight = await generateMetaInsight(result, answers);
      KnowledgeBaseService.addInsight({
        sessionType: sessionType,
        pattern: insight.pattern,
        recommendation: insight.recommendation,
        timestamp: Date.now()
      });
      setHasLearned(true);
    } catch (e) {
      console.error("Learning failed", e);
    } finally {
      setIsLearning(false);
    }
  };

  const getTraitLabels = (type: SessionType) => {
    switch (type) {
      case 'medical': return ['Compliance', 'Logic', 'Body Trust', 'Resilience', 'Energy', 'Anxiety Control'];
      case 'psychological': return ['Self-Awareness', 'Logic', 'Emotional Reg', 'Resilience', 'Coping', 'Social Trust'];
      case 'career': return ['Empathy', 'Logic', 'Integrity', 'Resilience', 'Ambition', 'Leadership'];
      case 'relationship': return ['Empathy', 'Logic', 'Conflict Res', 'Resilience', 'Vulnerability', 'Boundaries'];
      case 'school': default: return ['Curiosity', 'Logic', 'Discipline', 'Resilience', 'Ambition', 'Peer Relations'];
    }
  };

  const labels = getTraitLabels(sessionType);
  const radarData = [
    { subject: labels[0], Student: result.traits.empathy, fullMark: 100 },
    { subject: labels[1], Student: result.traits.logic, fullMark: 100 },
    { subject: labels[2], Student: result.traits.integrity, fullMark: 100 },
    { subject: labels[3], Student: result.traits.resilience, fullMark: 100 },
    { subject: labels[4], Student: result.traits.ambition, fullMark: 100 },
    { subject: labels[5], Student: result.traits.social_calibration, fullMark: 100 },
  ];

  const getSessionTheme = (type: SessionType) => {
    switch (type) {
      case 'medical': return { title: 'Patient Clinical Synopsis', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: '🩺', suggestionHeader: 'Recommended Interventions' };
      case 'psychological': return { title: 'Mental Health Audit', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: '🧠', suggestionHeader: 'Therapeutic Focus Areas' };
      case 'career': return { title: 'Professional Executive Summary', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '💼', suggestionHeader: 'Strategic Career Paths' };
      case 'relationship': return { title: 'Interpersonal Dynamics Audit', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', icon: '❤️', suggestionHeader: 'Relationship Milestones' };
      case 'school': default: return { title: 'Student Developmental Report', color: 'text-brand-700', bg: 'bg-brand-50', border: 'border-brand-200', icon: '🎓', suggestionHeader: 'Academic Career Paths' };
    }
  };

  const theme = getSessionTheme(sessionType);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 animate-fade-in pb-20 print:p-0">
      <div className="flex flex-col md:flex-row justify-between items-center mb-12">
        <div className="text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <span className="text-2xl">{theme.icon}</span>
            <h1 className="text-4xl font-bold text-slate-900">{theme.title}</h1>
          </div>
          <p className="text-slate-500 italic">Self-Evolving Intelligence Mode Active</p>
        </div>
        
        {!hasLearned ? (
          <button 
            onClick={handleValidateAndGrow}
            disabled={isLearning}
            className="mt-4 md:mt-0 px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow-lg hover:shadow-brand-100 transition-all flex items-center disabled:opacity-50"
          >
            {isLearning ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span> Learning...</>
            ) : (
              <><span className="mr-2">🧠</span> Validate & Feed AI Intelligence</>
            )}
          </button>
        ) : (
          <div className="mt-4 md:mt-0 px-6 py-3 bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-200 animate-bounce">
            ✓ Knowledge Added to Global Memory
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className={`bg-white p-6 rounded-2xl shadow-lg border-t-8 ${theme.border}`}>
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">Assessed Archetype</h2>
            <h1 className={`text-3xl font-extrabold mb-4 ${isHighRisk ? 'text-red-700' : theme.color}`}>
              {result.archetype}
            </h1>
            <p className="text-slate-600 leading-relaxed text-sm">{result.archetypeDescription}</p>
          </div>

          <div className={`p-6 rounded-2xl border-2 shadow-sm ${isHighRisk ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
             <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-slate-700">Safety & Risk Analysis</h3>
               <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase bg-slate-100`}>{riskLevel} Risk</span>
             </div>
             <div className="mb-4 text-sm text-slate-700 italic border-l-4 border-slate-300 pl-3">
               {result.riskAssessment.detailedAnalysis}
             </div>
          </div>
        </div>

        <div className="lg:col-span-4">
           <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 h-full">
             <h3 className="font-semibold text-slate-900 mb-6 text-center">Trait Intelligence Profile</h3>
             <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                   <PolarGrid stroke="#cbd5e1" />
                   <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} />
                   <Radar
                     name="Patient Profile"
                     dataKey="Student"
                     stroke={isHighRisk ? '#dc2626' : '#2563eb'}
                     strokeWidth={3}
                     fill={isHighRisk ? '#fee2e2' : '#dbeafe'}
                     fillOpacity={0.5}
                   />
                   <Tooltip />
                 </RadarChart>
               </ResponsiveContainer>
             </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
            <h3 className={`font-bold ${theme.color} mb-4`}>★ {theme.suggestionHeader}</h3>
            <div className="space-y-4">
              {result.careerPathSuggestions.map((path, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-slate-50 hover:bg-slate-50 transition-all">
                  <div className="font-bold text-slate-800 text-sm">{path.title}</div>
                  <div className="text-[10px] text-slate-500">{path.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${theme.bg} p-6 rounded-2xl border ${theme.border}`}>
            <h3 className="font-bold text-slate-800 mb-3 text-sm uppercase">Growth Counsel Report</h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{result.counselingAdvice}</p>
          </div>

          <button onClick={onReset} className="w-full py-4 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">
            End Session & Return
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
