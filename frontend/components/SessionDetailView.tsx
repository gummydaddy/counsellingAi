import React, { useState, useEffect } from 'react';
import { CounsellingSession, SessionType, Answer, MCQAnswer, SessionStatus } from '../types.ts';
import ChatSession from './ChatSession.tsx';
import { sessionService } from '../services/session.service.ts';
import { crossSessionAnalysis, CrossSessionInsight, SessionRelation } from '../services/crossSessionAnalysis.ts';
import { authService } from '../services/auth.service.ts';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts';

interface Props {
  session: CounsellingSession;
  onBack: () => void;
  onRetry?: (session: CounsellingSession) => void;
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

const SessionDetailView: React.FC<Props> = ({ session, onBack, onRetry }) => {
  const [activeTab, setActiveTab] = useState<Tab>('results');
  const theme = getSessionTheme(session.sessionType);
  const labels = getTraitLabels(session.sessionType);
  const result = session.result;
  const isHighRisk = result?.riskAssessment?.isConcern;
  const isIncomplete = session.status === 'in_progress' || session.status === 'error';

  // Cross-session analysis state
  const [crossSessionInsights, setCrossSessionInsights] = useState<CrossSessionInsight[]>([]);
  const [relatedSessions, setRelatedSessions] = useState<SessionRelation[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user && session.userId === user.id && result) {
      loadCrossSessionData();
    }
  }, [session, result]);

  const loadCrossSessionData = () => {
    const user = authService.getCurrentUser();
    if (!user) return;
    
    setInsightsLoading(true);
    try {
      const insights = crossSessionAnalysis.generateCrossSessionInsights(user.id);
      const relations = crossSessionAnalysis.findRelatedSessions(user.id, session.id);
      setCrossSessionInsights(insights);
      setRelatedSessions(relations);
    } catch (error) {
      console.error('Failed to load cross-session data:', error);
    } finally {
      setInsightsLoading(false);
    }
  };

  const radarData = result ? [
    { subject: labels[0], Value: result.traits.empathy, fullMark: 100 },
    { subject: labels[1], Value: result.traits.logic, fullMark: 100 },
    { subject: labels[2], Value: result.traits.integrity, fullMark: 100 },
    { subject: labels[3], Value: result.traits.resilience, fullMark: 100 },
    { subject: labels[4], Value: result.traits.ambition, fullMark: 100 },
    { subject: labels[5], Value: result.traits.social_calibration, fullMark: 100 },
  ] : [];

  const allQuestions = [
    ...session.phase1Questions.map(q => ({ ...q, phase: 'Foundation' })),
  ];

  const allAnswers = [
    ...session.mcqAnswers.map(a => ({ type: 'mcq' as const, ...a })),
    ...session.assessmentAnswers.map(a => ({ type: 'text' as const, ...a })),
  ];

const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'results', label: 'Results' },
    { id: 'questions', label: 'Questions', count: allQuestions.length },
    { id: 'answers', label: 'Answers', count: allAnswers.length },
    { id: 'chat', label: 'Chat' },
    { id: 'insights', label: 'Insights', count: crossSessionInsights.length + relatedSessions.length },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
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
            {session.status === 'in_progress' && (
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-700 text-xs font-bold rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
                In Progress
              </span>
            )}
            {session.status === 'error' && (
              <span className="px-3 py-1 bg-red-500/20 text-red-700 text-xs font-bold rounded-full flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Error
              </span>
            )}
            {session.status === 'completed' && (
              <span className="px-3 py-1 bg-green-500/20 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Completed
              </span>
            )}
            {isIncomplete && onRetry && (
              <button
                onClick={() => onRetry(session)}
                className="px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-lg shadow-brand-100"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {session.status === 'error' ? 'Retry' : 'Continue'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs text-slate-400">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Results Tab */}
      {activeTab === 'results' && result && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Archetype & Risk */}
            <div className="space-y-6">
              <div className={`bg-white p-6 rounded-2xl shadow-sm border-t-4 ${theme.border}`}>
                <p className="text-xs font-black tracking-widest text-slate-400 uppercase mb-2">Archetype</p>
                <h2 className={`text-2xl font-extrabold mb-3 ${isHighRisk ? 'text-red-700' : theme.color}`}>
                  {result.archetype}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">{result.archetypeDescription}</p>
              </div>

              <div className={`p-6 rounded-2xl border-2 ${isHighRisk ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-800 text-sm">Risk Assessment</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    isHighRisk ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {result.riskAssessment.level}
                  </span>
                </div>
                <p className="text-sm text-slate-700 italic leading-relaxed">
                  {result.riskAssessment.detailedAnalysis}
                </p>
                {result.riskAssessment.flags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {result.riskAssessment.flags.map((flag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Radar Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-widest text-center">Trait Signature</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Traits"
                      dataKey="Value"
                      stroke="#2563eb"
                      strokeWidth={2}
                      fill="#dbeafe"
                      fillOpacity={0.6}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Counseling Advice */}
          {result.counselingAdvice && (
            <div className="mt-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest mb-3">Counseling Advice</h3>
              <p className="text-sm text-slate-700 leading-relaxed">{result.counselingAdvice}</p>
            </div>
          )}

          {/* Career Paths */}
          {result.careerPathSuggestions?.length > 0 && (
            <div className="mt-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest mb-4">Career Path Suggestions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.careerPathSuggestions.map((path, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${theme.border} ${theme.bg}`}>
                    <p className={`font-bold text-sm ${theme.color}`}>{path.title}</p>
                    <p className="text-xs text-slate-600 mt-1">{path.description}</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">{path.strategicFit}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Specialized Fields */}
          {(result.professionalDiagnosis || result.rootCauses?.length || result.suggestedActionPlan?.length || result.interpersonalStrategy) && (
            <div className="mt-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest mb-4">Specialized Insights</h3>
              {result.professionalDiagnosis && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Diagnosis</p>
                  <p className="text-sm text-slate-700">{result.professionalDiagnosis}</p>
                </div>
              )}
              {result.rootCauses?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Root Causes</p>
                  <div className="flex flex-wrap gap-2">
                    {result.rootCauses.map((c, i) => (
                      <span key={i} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium border border-purple-100">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.suggestedActionPlan?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Action Plan</p>
                  <ol className="space-y-1">
                    {result.suggestedActionPlan.map((step, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="font-bold text-brand-600">{i + 1}.</span> {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {result.interpersonalStrategy && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Interpersonal Strategy</p>
                  <p className="text-sm text-slate-700">{result.interpersonalStrategy}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results tab but no result */}
      {activeTab === 'results' && !result && (
        <div className="text-center py-16 text-slate-400">
          {isIncomplete ? (
            <div className="space-y-4">
              <p className="text-lg font-medium">
                {session.status === 'error' ? 'Session Interrupted' : 'Session In Progress'}
              </p>
              <p className="text-sm">
                {session.status === 'error' 
                  ? `Error at ${session.progress.errorStep ? session.progress.errorStep : 'unknown step'}: ${session.progress.lastError || 'Unknown error'}`
                  : 'Continue from where you left off'}
              </p>
              <div className="w-full max-w-md mx-auto mt-6">
                <div className="w-full bg-slate-200 rounded-full h-2.5 mb-2">
                  <div 
                    className="bg-brand-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${getProgressPercent(session.progress)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-500">{getProgressLabel(session.progress)}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-lg font-medium">No results available</p>
              <p className="text-sm mt-1">This session was not completed.</p>
            </>
          )}
        </div>
      )}

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <div className="space-y-4 animate-fade-in">
          {session.phase1Questions.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Assessment Questions</h3>
              {session.phase1Questions.map((q, i) => (
                <div key={q.id} className="bg-white p-5 rounded-xl border border-slate-100 mb-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{q.text}</p>
                      <span className="text-[10px] text-slate-400 mt-1 inline-block uppercase font-medium">{q.category}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {session.phase1Questions.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-lg font-medium">No questions recorded</p>
            </div>
          )}
        </div>
      )}

      {/* Answers Tab */}
      {activeTab === 'answers' && (
        <div className="space-y-6 animate-fade-in">
          {/* MCQ Answers */}
          {session.mcqAnswers.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Multiple Choice Responses</h3>
              {session.mcqAnswers.map((a, i) => (
                <div key={i} className="bg-white p-5 rounded-xl border border-slate-100 mb-3 shadow-sm">
                  <p className="text-sm font-medium text-slate-800 mb-2">{a.questionText}</p>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                    <p className="text-sm text-brand-700 font-medium">{a.selectedOption}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Assessment Answers */}
          {session.assessmentAnswers.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Free-text Responses</h3>
              {session.assessmentAnswers.map((a, i) => (
                <div key={i} className="bg-white p-5 rounded-xl border border-slate-100 mb-3 shadow-sm">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold">
                      Q{i + 1}
                    </span>
                    <p className="text-sm font-medium text-slate-800">{a.questionText}</p>
                  </div>
                  <div className="ml-9 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-sm text-slate-700 leading-relaxed">{a.userResponse}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {session.mcqAnswers.length === 0 && session.assessmentAnswers.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-lg font-medium">No answers recorded</p>
            </div>
          )}
        </div>
      )}

      {/* Chat Tab */}
      {activeTab === 'chat' && result && (
        <div className="animate-fade-in">
          <ChatSession 
            result={result} 
            answers={session.assessmentAnswers} 
            sessionType={session.sessionType} 
          />
        </div>
      )}

      {activeTab === 'chat' && !result && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">Chat not available</p>
          <p className="text-sm mt-1">This session was not completed.</p>
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && (
        <div className="space-y-6 animate-fade-in">
          {/* Cross-Session Insights */}
          {crossSessionInsights.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Cross-Session Insights
              </h3>
              <div className="space-y-4">
                {crossSessionInsights.map((insight, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                        insight.type === 'risk' ? 'bg-red-100 text-red-600' :
                        insight.type === 'trend' ? 'bg-emerald-100 text-emerald-600' :
                        insight.type === 'pattern' ? 'bg-brand-100 text-brand-600' :
                        'bg-purple-100 text-purple-600'
                      }`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {insight.type === 'risk' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />}
                          {insight.type === 'trend' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 4v8m0-8l-8 8-4-4-6 6" />}
                          {insight.type === 'pattern' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m-4 0h8m-4 0l2-4-2-4" />}
                          {insight.type === 'correlation' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />}
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 mb-1">{insight.title}</h4>
                        <p className="text-sm text-slate-600 leading-relaxed mb-3">{insight.description}</p>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
                            Confidence: {Math.round(insight.confidence * 100)}%
                          </span>
                          {insight.actionable && (
                            <span className="px-2 py-1 bg-brand-100 text-brand-700 rounded-full font-medium">
                              💡 {insight.actionable}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Sessions */}
          {relatedSessions.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Related Sessions ({relatedSessions.length})
              </h3>
              <div className="space-y-3">
                {relatedSessions.slice(0, 5).map((rel, i) => (
                  <div key={rel.sessionId} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-bold">
                          {Math.round(rel.similarity * 100)}%
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">Session {i + 1}</p>
                          <p className="text-xs text-slate-500">Similarity: {Math.round(rel.similarity * 100)}%</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {rel.sharedTraits.map(trait => (
                          <span key={trait} className="px-2 py-1 bg-brand-50 text-brand-700 text-[10px] font-medium rounded-full">
                            {trait}
                          </span>
                        ))}
                        {rel.sharedPatterns.map(pattern => (
                          <span key={pattern} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded-full">
                            {pattern}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {crossSessionInsights.length === 0 && relatedSessions.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-lg font-medium">No cross-session insights yet</p>
              <p className="text-sm mt-1">Complete more sessions to unlock pattern analysis and related session discovery.</p>
            </div>
          )}

          {insightsLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-sm text-slate-500">Analyzing patterns...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const getProgressPercent = (progress: any): number => {
  if (progress.mcqCompleted) return 25;
  if (progress.phase1Generated) return 40;
  if (progress.assessmentCompleted) return 75;
  if (progress.analysisCompleted) return 100;
  return 10;
};

const getProgressLabel = (progress: any): string => {
  if (progress.analysisCompleted) return 'Analysis complete';
  if (progress.assessmentCompleted) return 'Assessment complete, analyzing...';
  if (progress.phase1Generated) return 'Questions generated, in assessment...';
  if (progress.mcqCompleted) return 'MCQ complete, generating questions...';
  return 'Starting session...';
};

export default SessionDetailView;
