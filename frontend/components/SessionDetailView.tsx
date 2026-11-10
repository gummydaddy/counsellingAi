import React, { useState, useEffect, useCallback } from 'react';
import { CounsellingSession, SessionType, Answer, MCQAnswer, SessionStatus, AppStep, AssessmentPhase, AnalysisResult, SessionProgress } from '../types.ts';
import ChatSession from './ChatSession.tsx';
import { sessionService } from '../services/session.service.ts';
import { crossSessionAnalysis, CrossSessionInsight, SessionRelation } from '../services/crossSessionAnalysis.ts';
import { authService } from '../services/auth.service.ts';
import { KnowledgeBaseService } from '../services/knowledgeBaseService.ts';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts';

interface Props {
  sessionId: string;
  onBack: () => void;
  onRetry?: (sessionId: string, step: AppStep) => void;
}

const SESSION_ICONS: Record<SessionType, string> = {
  school: '🎓',
  medical: '🩺',
  psychological: '🧠',
  career: '💼',
  relationship: '❤️',
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

const getSessionTheme = (type: SessionType) => {
  switch (type) {
    case 'medical': return { title: 'Clinical Medical Report', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: '🩺' };
    case 'psychological': return { title: 'Psychological Insight Audit', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: '🧠' };
    case 'career': return { title: 'Strategic Executive Summary', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '💼' };
    case 'relationship': return { title: 'Relationship Dynamics Audit', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', icon: '❤️' };
    case 'school': default: return { title: 'Student Academic Roadmap', color: 'text-brand-700', bg: 'bg-brand-50', border: 'border-brand-200', icon: '🎓' };
  }
};

type Tab = 'results' | 'questions' | 'answers' | 'chat' | 'insights';

const SessionDetailView: React.FC<Props> = ({ sessionId, onBack, onRetry }) => {
  const [session, setSession] = useState<CounsellingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('results');
  const [crossSessionInsights, setCrossSessionInsights] = useState<CrossSessionInsight[]>([]);
  const [relatedSessions, setRelatedSessions] = useState<SessionRelation[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [aiStats, setAiStats] = useState({ totalSessionsLearned: 0, experienceLevel: 'Novice' });
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    const user = authService.getCurrentUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    // Guard: don't fetch if sessionId is empty/invalid
    if (!sessionId || sessionId.trim() === '') {
      setError('No session selected');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const sessionData = await sessionService.getSession(user.id, sessionId);
      if (sessionData) {
        setSession(sessionData);
      } else {
        setError('Session not found');
      }
    } catch (err) {
      console.error('Failed to fetch session:', err);
      setError('Failed to load session from server');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const loadCrossSessionData = useCallback(async () => {
    const user = authService.getCurrentUser();
    if (!user || !session?.userId || session.userId !== user.id || !session.result) return;

    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const [insights, relations, stats] = await Promise.all([
        crossSessionAnalysis.generateCrossSessionInsights(user.id),
        crossSessionAnalysis.findRelatedSessions(user.id, session.id),
        KnowledgeBaseService.getStats(),
      ]);
      setCrossSessionInsights(insights);
      setRelatedSessions(relations);
      setAiStats(stats);
    } catch (err) {
      console.error('Failed to load cross-session data:', err);
      setInsightsError('Failed to load insights from server');
    } finally {
      setInsightsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session?.status === 'completed' && session.result) {
      loadCrossSessionData();
    }
  }, [session, loadCrossSessionData]);

  const theme = session ? getSessionTheme(session.sessionType) : getSessionTheme('school');
  const labels = session ? getTraitLabels(session.sessionType) : getTraitLabels('school');
  const result = session?.result;
  const isHighRisk = result?.riskAssessment?.isConcern;
  const isIncomplete = session?.status === 'in_progress' || session?.status === 'error';
  const isCompleted = session?.status === 'completed';
  const progress = session?.progress;

  const getNextStep = useCallback(() => {
    if (!progress) return { label: 'Start Session', step: AppStep.WELCOME };
    if (session?.status === 'error' && progress.errorStep) {
      return { label: `Retry from ${progress.errorStep}`, step: progress.errorStep };
    } else if (progress.analysisCompleted) {
      return { label: 'View Results', step: AppStep.RESULTS };
    } else if (progress.assessmentCompleted) {
      return { label: 'Continue to Analysis', step: AppStep.ANALYZING };
    } else if (progress.phase1Generated) {
      return { label: 'Continue Assessment', step: AppStep.ASSESSMENT };
    } else if (progress.mcqCompleted) {
      return { label: 'Continue to Foundation Questions', step: AppStep.GENERATING_PHASE1 };
    } else if (session?.counselorNotes !== null) {
      return { label: 'Continue to MCQ Phase', step: AppStep.MCQ_PHASE };
    }
    return { label: 'Start Session', step: AppStep.WELCOME };
  }, [progress, session]);

  const nextStep = getNextStep();

  const radarData = (result && result.traits && typeof result.traits.empathy === 'number') ? [
    { subject: labels[0], Value: result.traits.empathy, fullMark: 100 },
    { subject: labels[1], Value: result.traits.logic, fullMark: 100 },
    { subject: labels[2], Value: result.traits.integrity, fullMark: 100 },
    { subject: labels[3], Value: result.traits.resilience, fullMark: 100 },
    { subject: labels[4], Value: result.traits.ambition, fullMark: 100 },
    { subject: labels[5], Value: result.traits.social_calibration, fullMark: 100 },
  ] : [];

  const allQuestions = [
    ...(session?.phase1Questions || []).map(q => ({ ...q, phase: 'Foundation' as const, phaseOrder: 1 })),
    ...(session?.assessmentQuestions || []).map(q => ({ ...q, phase: 'Assessment' as const, phaseOrder: 2 })),
  ].sort((a, b) => a.phaseOrder - b.phaseOrder);

  const allAnswers = [
    ...(session?.mcqAnswers || []).map(a => ({ type: 'mcq' as const, ...a, questionType: 'MCQ' })),
    ...(session?.assessmentAnswers || []).map(a => ({ type: 'text' as const, ...a, questionType: 'Assessment' })),
  ];

  const tabs: { id: Tab; label: string; count?: number; disabled?: boolean }[] = [
    { id: 'results', label: 'Results', disabled: !isCompleted },
    { id: 'questions', label: 'Questions', count: allQuestions.length },
    { id: 'answers', label: 'Answers', count: allAnswers.length },
    { id: 'chat', label: 'Chat', disabled: !isCompleted },
    { id: 'insights', label: 'Insights', count: crossSessionInsights.length + relatedSessions.length, disabled: insightsLoading },
  ];

  useEffect(() => {
    if (tabs.find(t => t.id === activeTab)?.disabled) {
      const available = tabs.find(t => !t.disabled);
      if (available) setActiveTab(available.id);
    }
  }, [activeTab, tabs]);

  const handleContinue = useCallback(() => {
    if (onRetry && session) {
      onRetry(sessionId, nextStep.step);
    } else {
      onBack();
    }
  }, [onRetry, session, sessionId, nextStep.step, onBack]);

  const handleRetry = useCallback(async () => {
    if (!session || !onRetry) return;
    setLoading(true);
    setError(null);
    try {
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const retriedSession = await sessionService.retryFromStep(user.id, session.id, nextStep.step);
      if (retriedSession) {
        setSession(retriedSession);
      } else {
        setError('Failed to retry session');
      }
    } catch (err) {
      console.error('Retry failed:', err);
      setError('Failed to retry session');
    } finally {
      setLoading(false);
    }
  }, [session, onRetry, nextStep.step]);

  const getProgressPercent = (prog: SessionProgress | undefined): number => {
    if (!prog) return 10;
    if (prog.analysisCompleted) return 100;
    if (prog.assessmentCompleted) return 75;
    if (prog.phase1Generated) return 50;
    if (prog.mcqCompleted) return 25;
    return 10;
  };

  const getProgressLabel = (prog: SessionProgress | undefined): string => {
    if (!prog) return 'Starting session...';
    if (prog.analysisCompleted) return 'Analysis complete';
    if (prog.assessmentCompleted) return 'Assessment complete, analyzing...';
    if (prog.phase1Generated) return 'Questions generated, in assessment...';
    if (prog.mcqCompleted) return 'MCQ complete, generating questions...';
    return 'Starting session...';
  };

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <span className="ml-4 text-slate-600">Loading session...</span>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-8">
        <div className="text-center py-16">
          <button onClick={onBack} className="mb-6 p-2 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-4xl mb-4 block">⚠️</span>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Unable to Load Session</h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">{error || 'Session not found'}</p>
          <div className="flex gap-4 justify-center">
            <button onClick={fetchSession} className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg">
              Try Again
            </button>
            <button onClick={onBack} className="px-6 py-3 bg-slate-600 text-white rounded-xl font-bold shadow-lg">
              Back to Sessions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-3 flex-1">
          <span className="text-2xl">{SESSION_ICONS[session.sessionType]}</span>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">{session.title}</h1>
            <p className="text-xs text-slate-500">
              {new Date(session.createdAt).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-bold rounded-full ${session.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                session.status === 'error' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
              }`}>
              {session.status}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Session Progress</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Counselor Notes', icon: '📝', done: session.counselorNotes !== null },
            { label: 'MCQ Phase', icon: '✏️', done: progress?.mcqCompleted },
            { label: 'Foundation Questions', icon: '🧩', done: progress?.phase1Generated },
            { label: 'Assessment', icon: '📋', done: progress?.assessmentCompleted },
            { label: 'Analysis', icon: '🔬', done: progress?.analysisCompleted },
          ].map((phase, i) => {
            const completedCount = [
              session.counselorNotes !== null,
              progress?.mcqCompleted,
              progress?.phase1Generated,
              progress?.assessmentCompleted,
              progress?.analysisCompleted,
            ].filter(Boolean).length;
            const isCurrent = i === completedCount && !phase.done;
            return (
              <div key={phase.label} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${phase.done
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : isCurrent
                    ? 'bg-brand-50 text-brand-700 border border-brand-200 animate-pulse'
                    : 'bg-slate-50 text-slate-400 border border-slate-200'
                }`}>
                <span className="text-base">{phase.icon}</span>
                <span>{phase.label}</span>
                {phase.done && <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-1" aria-label="Session tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-all border-b-2 border-transparent hover:text-brand-600 disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === tab.id
                  ? 'border-brand-600 text-brand-600'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <span className="flex items-center gap-1">
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${activeTab === tab.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                    {tab.count}
                  </span>
                )}
                {tab.disabled && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
{/* RESULTS TAB */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            {isCompleted && result && result.traits ? (
              <div>
                {/* Profile Card */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-4 space-y-6">
                    <div className={`bg-white p-8 rounded-3xl shadow-xl border-t-8 ${theme.border} relative overflow-hidden`}>
                      <div className={`absolute top-0 right-0 p-4 opacity-5 text-6xl`}>{theme.icon}</div>
                      <h2 className="text-xs font-black tracking-widest text-slate-400 uppercase mb-3">Professional Archetype</h2>
                      <h1 className={`text-3xl font-extrabold mb-4 leading-none ${isHighRisk ? 'text-red-700' : theme.color}`}>
                        {result.archetype}
                      </h1>
                      <p className="text-slate-600 leading-relaxed text-sm font-medium">{result.archetypeDescription}</p>
                    </div>

                    {/* Risk Assessment - Enhanced */}
                    <div className={`p-6 rounded-3xl border-2 shadow-sm ${isHighRisk ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800">Risk Assessment</h3>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${isHighRisk ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {result.riskAssessment.level}
                        </span>
                      </div>
                      
                      {/* Risk Level Indicator */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500">Risk Level</span>
                          <span className="font-bold text-slate-800">{result.riskAssessment.level}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              result.riskAssessment.level === 'Critical' ? 'bg-red-600' :
                              result.riskAssessment.level === 'High' ? 'bg-orange-500' :
                              result.riskAssessment.level === 'Moderate' ? 'bg-yellow-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${result.riskAssessment.level === 'Critical' ? 100 : result.riskAssessment.level === 'High' ? 75 : result.riskAssessment.level === 'Moderate' ? 50 : 25}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Detailed Analysis */}
                      <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Clinical Analysis</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{result.riskAssessment.detailedAnalysis}</p>
                      </div>

                      {/* Risk Flags */}
                      {result.riskAssessment.flags.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Identified Risk Factors</p>
                          <div className="flex flex-wrap gap-2">
                            {result.riskAssessment.flags.map((flag: string, i: number) => (
                              <span key={i} className="px-3 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-100">
                                {flag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Concern Indicator */}
                      {result.riskAssessment.isConcern && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                          <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p className="text-xs text-red-700 font-medium">Professional follow-up recommended</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Specialized Insights + Radar */}
                  <div className="lg:col-span-8 space-y-6">
                    {/* Specialized Insights Card - Comprehensive */}
                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                      <h3 className={`font-black ${theme.color} mb-6 text-sm uppercase tracking-widest flex items-center gap-2`}>
                        <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                        {theme.title}
                      </h3>

                      {/* Diagnosis Section */}
                      {(result.professionalDiagnosis || result.primaryPrecautions?.length || result.suggestedMedicines?.length) && (
                        <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            Clinical Diagnosis & Medical Guidance
                          </h4>
                          {result.professionalDiagnosis && (
                            <div className="mb-4">
                              <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Primary Diagnosis</p>
                              <p className="text-slate-800 font-semibold leading-relaxed">{result.professionalDiagnosis}</p>
                            </div>
                          )}
                          {result.primaryPrecautions?.length && (
                            <div className="mb-4">
                              <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Recommended Precautions</p>
                              <ul className="space-y-2">
                                {result.primaryPrecautions.map((p: string, i: number) => (
                                  <li key={i} className="text-sm text-slate-600 flex gap-2">
                                    <span className="text-red-400">•</span> {p}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {result.suggestedMedicines?.length && (
                            <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                              <p className="text-xs font-bold text-red-800 mb-2 uppercase">Suggested Support (OTC / Lifestyle)</p>
                              <p className="text-sm text-red-700 font-medium italic">{result.suggestedMedicines.join(', ')}</p>
                              <p className="text-[10px] text-red-400 mt-2 uppercase font-black">Educational Purposes Only - Consult a licensed physician</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Root Causes Section */}
                      {result.rootCauses?.length && (
                        <div className="mb-8 p-6 bg-purple-50 rounded-2xl border border-purple-100">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            Diagnostic Root Causes
                          </h4>
                          <div className="space-y-2">
                            {result.rootCauses.map((c: string, i: number) => (
                              <div key={i} className="p-3 bg-white text-purple-800 text-sm font-medium rounded-xl border border-purple-100 flex items-center gap-3">
                                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                                <span>{c}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Therapeutic Focus / Counseling Advice Section */}
                      {result.counselingAdvice && (
                        <div className="mb-8 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            Therapeutic Focus & Counseling Guidance
                          </h4>
                          <p className="text-sm text-indigo-900 font-medium leading-relaxed italic">{result.counselingAdvice}</p>
                        </div>
                      )}

                      {/* Interpersonal Strategy Section */}
                      {result.interpersonalStrategy && (
                        <div className="mb-8 p-6 bg-pink-50 rounded-2xl border border-pink-100">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                            Interpersonal Strategy
                          </h4>
                          <p className="text-sm text-pink-900 font-medium leading-relaxed">{result.interpersonalStrategy}</p>
                        </div>
                      )}

                      {/* Action Plan Section */}
                      {result.suggestedActionPlan?.length && (
                        <div className="mb-8">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                            Milestone Action Plan
                          </h4>
                          <div className="space-y-3">
                            {result.suggestedActionPlan.map((item: string, i: number) => (
                              <div key={i} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className={`w-8 h-8 rounded-full ${theme.bg} ${theme.color} flex items-center justify-center text-xs font-black border ${theme.border} flex-shrink-0`}>
                                  {i + 1}
                                </div>
                                <p className="text-sm text-slate-700 font-medium leading-relaxed mt-0.5">{item}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Career Path Suggestions - Detailed */}
                      {result.careerPathSuggestions?.length && (
                        <div className="mb-8">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Career Path Recommendations
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {result.careerPathSuggestions.map((path: any, i: number) => (
                              <div key={i} className={`p-5 rounded-2xl border ${theme.border} ${theme.bg} hover:shadow-md transition-shadow`}>
                                <div className="flex items-start gap-3 mb-3">
                                  <div className={`w-10 h-10 rounded-xl ${theme.bg} ${theme.color} flex items-center justify-center text-lg flex-shrink-0`}>
                                    {['🎓', '💼', '🔬', '🎨', '🏥', '⚖️', '💻', '🏗️', '🌱', '📊'][i % 10]}
                                  </div>
                                  <h5 className={`font-bold text-sm ${theme.color}`}>{path.title}</h5>
                                </div>
                                <p className="text-xs text-slate-600 mb-2 leading-relaxed">{path.description}</p>
                                <div className="pt-2 border-t border-slate-200">
                                  <p className="text-[10px] text-slate-400 font-medium uppercase mb-1">Strategic Fit</p>
                                  <p className="text-sm text-slate-700 font-medium">{path.strategicFit}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Summary Note */}
                      <div className="p-4 bg-brand-50 rounded-xl border border-brand-100">
                        <p className="text-xs text-brand-700 font-medium">This analysis is based on your assessment responses and is intended for educational and self-reflection purposes. For clinical or professional decisions, please consult qualified specialists in the relevant fields.</p>
                      </div>
                    </div>

                    {/* Trait Radar */}
                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
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
                        <div className="mt-6 w-full pt-6 border-t border-slate-100">
                          <p className="text-[10px] text-slate-400 font-black uppercase text-center mb-4">Recommended Career Pathings</p>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {result.careerPathSuggestions?.slice(0, 3).map((p: any, i: number) => (
                              <span key={i} className={`px-3 py-1 rounded-lg text-[10px] font-bold border ${theme.border} ${theme.bg} ${theme.color}`}>
                                {p.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat Session */}
                <div className="mt-10 pt-8 border-t border-slate-200">
                  <ChatSession
                    result={result}
                    answers={session.assessmentAnswers || []}
                    sessionType={session.sessionType}
                    sessionId={session.id}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-16 px-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-50 rounded-full mb-6 animate-pulse">
                  <span className="text-4xl">{SESSION_ICONS[session.sessionType]}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Session In Progress</h2>
                <p className="text-slate-600 mb-8 max-w-md mx-auto">
                  Complete the remaining phases to generate your professional analysis report.
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={handleContinue}
                    className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-100 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {nextStep.label}
                  </button>
                  <button onClick={onBack} className="px-8 py-3 bg-slate-600 text-white rounded-xl font-bold shadow-lg">
                    Back to Sessions
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* QUESTIONS TAB */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            {allQuestions.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl mb-4 block">❓</span>
                <p className="text-slate-500">No questions generated yet. Complete previous phases to see questions here.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800">All Questions ({allQuestions.length})</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('answers')}
                      className="px-3 py-1 text-xs font-bold bg-brand-100 text-brand-700 rounded-full hover:bg-brand-200 transition"
                    >
                      View Answers →
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {allQuestions.map((q, i) => (
                    <div key={`${q.phase}-${i}`} className="bg-white p-5 rounded-xl border border-slate-100 hover:border-brand-200 transition">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-sm font-bold">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-brand-50 text-brand-700">
                              {q.phase}
                            </span>
                            {q.category && (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-600">
                                {q.category}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-800 font-medium">{q.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ANSWERS TAB */}
        {activeTab === 'answers' && (
          <div className="space-y-4">
            {allAnswers.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl mb-4 block">💬</span>
                <p className="text-slate-500">No answers recorded yet. Complete phases to see your responses here.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800">Your Responses ({allAnswers.length})</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('questions')}
                      className="px-3 py-1 text-xs font-bold bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition"
                    >
                      ← View Questions
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {allAnswers.map((a, i) => (
                    <div key={`${a.type}-${i}`} className="bg-white p-5 rounded-xl border border-slate-100">
                      <div className="flex items-start gap-3">
                        <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${a.type === 'mcq' ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'
                          }`}>
                          {a.type === 'mcq' ? '✏️' : '📝'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${a.type === 'mcq' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'
                              }`}>
                              {a.questionType}
                            </span>
                          </div>
                          <p className="text-slate-600 font-medium mb-2">{a.questionText}</p>
                          <div className={`px-3 py-2 rounded-lg font-medium inline-block ${a.type === 'mcq'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-purple-50 text-purple-800 border border-purple-200'
                            }`}>
                            {a.type === 'mcq' ? a.selectedOption : a.userResponse}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <div className="h-[500px]">
            {isCompleted && result ? (
              <ChatSession
                result={result}
                answers={session.assessmentAnswers || []}
                sessionType={session.sessionType}
                sessionId={session.id}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl">💬</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Chat Unavailable</h3>
                <p className="text-slate-600 mb-4 max-w-md mx-auto">
                  Complete the session to unlock AI chat with your personalized specialist.
                </p>
                <button
                  onClick={handleContinue}
                  className="px-6 py-2 bg-brand-600 text-white rounded-xl font-bold shadow"
                >
                  {nextStep.label}
                </button>
              </div>
            )}
          </div>
        )}

        {/* INSIGHTS TAB */}
        {activeTab === 'insights' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Cross-Session Insights</h3>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>AI Experience: <span className="font-bold text-brand-600">{aiStats.experienceLevel}</span></span>
                <span className="mx-2">|</span>
                <span>{aiStats.totalSessionsLearned} Sessions Learned</span>
              </div>
            </div>

            {insightsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                <span className="ml-3 text-slate-600">Analyzing your session history...</span>
              </div>
            ) : insightsError ? (
              <div className="text-center py-12">
                <span className="text-4xl mb-4 block">⚠️</span>
                <h4 className="text-lg font-bold text-slate-800 mb-2">Failed to Load Insights</h4>
                <p className="text-slate-500 mb-4">{insightsError}</p>
                <button
                  onClick={loadCrossSessionData}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700"
                >
                  Retry
                </button>
              </div>
            ) : crossSessionInsights.length === 0 && relatedSessions.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl mb-4 block">🧠</span>
                <h4 className="text-lg font-bold text-slate-800 mb-2">No Insights Yet</h4>
                <p className="text-slate-500 mb-4">Complete more sessions to unlock cross-session pattern analysis.</p>
                <p className="text-xs text-slate-400">Insights are generated from patterns across your completed sessions.</p>
              </div>
            ) : (
              <>
                {crossSessionInsights.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse"></span>
                      Pattern Insights
                    </h4>
                    {crossSessionInsights.map((insight, i) => (
                      <div key={i} className={`bg-white p-5 rounded-xl border-l-4 ${insight.type === 'risk' ? 'border-red-500' : insight.type === 'trend' ? 'border-emerald-500' : 'border-brand-500'} shadow-sm`}>
                        <div className="flex items-start gap-3">
                          <span className={`text-2xl ${insight.type === 'risk' ? 'text-red-500' : insight.type === 'trend' ? 'text-emerald-500' : 'text-brand-500'}`}>
                            {insight.type === 'risk' ? '⚠️' : insight.type === 'trend' ? '📈' : '🔍'}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-bold text-slate-900">{insight.title}</h5>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${insight.type === 'risk' ? 'bg-red-100 text-red-700' : insight.type === 'trend' ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'}`}>
                                {insight.type}
                              </span>
                            </div>
                            <p className="text-slate-600 text-sm">{insight.description}</p>
                            {insight.actionable && (
                              <p className="text-brand-600 text-sm font-medium mt-2">💡 {insight.actionable}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {relatedSessions.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      Related Sessions ({relatedSessions.length})
                    </h4>
                    {relatedSessions.map((rel, i) => (
                      <div key={`${rel.sessionId}-${i}`} className="bg-white p-4 rounded-xl border border-slate-100 hover:border-purple-200 transition">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-lg">
                            {SESSION_ICONS[rel.sessionId.split('-')[0] as SessionType] || '📋'}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-slate-800">Similarity: <span className="text-purple-600 font-bold">{Math.round(rel.similarity * 100)}%</span></p>
                            <p className="text-sm text-slate-500">Shared: {rel.sharedTraits.join(', ') || 'None'}</p>
                            {rel.sharedPatterns.length > 0 && (
                              <p className="text-xs text-purple-600 mt-1">{rel.sharedPatterns[0]}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>

      {/* Footer Actions for Incomplete Sessions */}
      {!isCompleted ? (
        <div className="mt-8 pt-6 border-t border-slate-200 flex gap-4 justify-center">
          {session.status === 'error' && (
            <button
              onClick={handleRetry}
              disabled={loading}
              className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-100 flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry from {progress?.errorStep || 'Failed Step'}
            </button>
          )}
          <button
            onClick={handleContinue}
            className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-100 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {nextStep.label}
          </button>
          <button onClick={onBack} className="px-8 py-3 bg-slate-600 text-white rounded-xl font-bold shadow-lg">
            Back to Sessions
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default SessionDetailView;