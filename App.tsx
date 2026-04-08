
import React, { useState, useEffect, useCallback } from 'react';
import { AppStep, Answer, AnalysisResult, Question, MCQAnswer, SessionType, CounsellingSession } from './types.ts';
import type { User } from './services/auth.service.ts';
import { SESSION_MCQ_POOLS } from './constants.ts';
import { analyzeStudentAnswers, generatePhase1Questions } from './services/geminiService.ts';
import { KnowledgeBaseService } from './services/knowledgeBaseService.ts';
import { authService } from './services/auth.service.ts';
import { sessionService } from './services/session.service.ts';
import WelcomeScreen from './components/WelcomeScreen.tsx';
import Assessment from './components/Assessment.tsx';
import ResultsView from './components/ResultsView.tsx';
import MCQPhase from './components/MCQPhase.tsx';
import SessionSelectionScreen from './components/SessionSelectionScreen.tsx';
import { CounselorNotesLayer } from './components/CounselorNotesLayer.tsx';
import AdminComponents from './components/AdminComponents.tsx';
import SessionSidebar from './components/SessionSidebar.tsx';
import SessionDetailView from './components/SessionDetailView.tsx';



const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [step, setStep] = useState<AppStep>(AppStep.WELCOME);
  const [sessionType, setSessionType] = useState<SessionType>('school');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [phase1Questions, setPhase1Questions] = useState<Question[]>([]);
  const [counselorNotes, setCounselorNotes] = useState<string | null>(null);
  const [sessionAnswers, setSessionAnswers] = useState<Answer[]>([]);
  const [mcqAnswers, setMcqAnswers] = useState<MCQAnswer[]>([]);

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sessions, setSessions] = useState<CounsellingSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [viewingSession, setViewingSession] = useState<CounsellingSession | null>(null);

  // Default state to prevent undefined errors before data loads
  const [aiStats, setAiStats] = useState({ totalSessionsLearned: 0, experienceLevel: 'Novice' });

  const checkAuth = useCallback(() => {
    const user = authService.getCurrentUser();
    const authStatus = !!user;
    setCurrentUser(user);
    setIsAuthenticated(authStatus);
  }, []);

  const loadSessions = useCallback((userId: string) => {
    const userSessions = sessionService.getSessions(userId);
    setSessions(userSessions);
  }, []);

  // Auth check
  useEffect(() => {
    checkAuth();
    const interval = setInterval(checkAuth, 2000);
    window.addEventListener('storage', checkAuth);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkAuth);
    };
  }, [checkAuth]);

  // Load sessions when user authenticates
  useEffect(() => {
    if (currentUser) {
      loadSessions(currentUser.id);
    }
  }, [currentUser, loadSessions]);

  // PRODUCTION UPDATE: Fetch stats asynchronously (mimicking DB call)
  useEffect(() => {
    const fetchStats = async () => {
      const stats = await KnowledgeBaseService.getStats();
      setAiStats(stats);
    };
    fetchStats();
  }, [step]); // Re-fetch when step changes (e.g. after a session ends)


  const handleStart = () => {
    setViewingSession(null);
    setActiveSessionId(null);
    setStep(AppStep.SESSION_SELECTION);
  };

  const handleSessionSelect = (type: SessionType) => {
    setSessionType(type);
    setStep(AppStep.NOTES_PROMPT);
  };

  const handleNotesProvided = async (notes: string | null) => {
    setCounselorNotes(notes);
    if (notes) {
      setStep(AppStep.GENERATING_PHASE1);
      try {
        const generatedQuestions = await generatePhase1Questions(null, sessionType, notes);
        setPhase1Questions(generatedQuestions);
        setStep(AppStep.ASSESSMENT);
      } catch (e: any) {
        setErrorMsg(`Context ingestion failed: ${e.message || 'Check your API Key settings.'}`);
        setStep(AppStep.ERROR);
      }
    } else {
      setStep(AppStep.MCQ_PHASE);
    }
  };

  const handleMCQComplete = async (answers: MCQAnswer[]) => {
    setMcqAnswers(answers);
    setStep(AppStep.GENERATING_PHASE1);
    try {
      const generatedQuestions = await generatePhase1Questions(answers, sessionType, null);
      setPhase1Questions(generatedQuestions);
      setStep(AppStep.ASSESSMENT);
    } catch (e: any) {
      setErrorMsg(`Generation failed: ${e.message || 'Ensure your API Key is correctly configured in Vercel.'}`);
      setStep(AppStep.ERROR);
    }
  };

  const handleAssessmentComplete = async (answers: Answer[]) => {
    setSessionAnswers(answers);
    setStep(AppStep.ANALYZING);
    try {
      const analysis = await analyzeStudentAnswers(answers, sessionType);
      setResult(analysis);
      setStep(AppStep.RESULTS);

      // Save session to storage
      if (currentUser) {
        const savedSession = sessionService.saveSession(
          currentUser.id,
          sessionType,
          counselorNotes,
          phase1Questions,
          mcqAnswers,
          answers,
          analysis
        );
        setActiveSessionId(savedSession.id);
        loadSessions(currentUser.id);
      }
    } catch (e: any) {
      setErrorMsg(`Analysis Engine failed: ${e.message || 'Check browser console for details.'}`);
      setStep(AppStep.ERROR);
    }
  };

  const handleReset = () => {
    setResult(null);
    setErrorMsg(null);
    setPhase1Questions([]);
    setCounselorNotes(null);
    setSessionAnswers([]);
    setMcqAnswers([]);
    setActiveSessionId(null);
    setViewingSession(null);
    setStep(AppStep.WELCOME);
  };

  const handleNewSession = () => {
    handleReset();
    setSidebarCollapsed(true);
    setStep(AppStep.SESSION_SELECTION);
  };

  const handleSelectPastSession = (session: CounsellingSession) => {
    setViewingSession(session);
    setActiveSessionId(session.id);
    setSidebarCollapsed(true);
    setStep(AppStep.WELCOME);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (!currentUser) return;
    sessionService.deleteSession(currentUser.id, sessionId);
    loadSessions(currentUser.id);
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setViewingSession(null);
    }
  };

  const handleBackFromSessionView = () => {
    setViewingSession(null);
    setActiveSessionId(null);
    setStep(AppStep.WELCOME);
  };

  if (!isAuthenticated) {
    return <AdminComponents />;
  }

  // If viewing a past session, show the detail view
  if (viewingSession) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectPastSession}
          onDeleteSession={handleDeleteSession}
        />
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-4">
          <div className="flex items-center justify-between" style={{ marginLeft: sidebarCollapsed ? '0' : '288px', transition: 'margin-left 0.3s ease' }}>
            <div className="flex items-center space-x-3">
              {sidebarCollapsed && (
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Open sidebar"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              <div className="flex items-center space-x-2 cursor-pointer" onClick={handleReset}>
                <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">M</div>
                <span className="text-xl font-bold text-slate-800 tracking-tight">Counselling AI</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex flex-col items-end text-[10px] uppercase font-bold text-slate-400">
                <span>User: {currentUser?.name || 'Guest'}</span>
              </div>
              <button
                onClick={handleNewSession}
                className="px-4 py-2 bg-brand-600 text-white text-xs rounded-full font-bold hover:bg-brand-700 transition-colors"
              >
                + New Session
              </button>
              <button
                onClick={() => authService.logout()}
                className="px-3 py-1 bg-red-600 text-white text-xs rounded-full font-bold hover:bg-red-700 transition-colors whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>
        <main className="flex-grow" style={{ marginLeft: sidebarCollapsed ? '0' : '288px', transition: 'margin-left 0.3s ease' }}>
          <SessionDetailView session={viewingSession} onBack={handleBackFromSessionView} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectPastSession}
        onDeleteSession={handleDeleteSession}
      />
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-4">
        <div className="flex items-center justify-between" style={{ marginLeft: sidebarCollapsed ? '0' : '288px', transition: 'margin-left 0.3s ease' }}>
          <div className="flex items-center space-x-3">
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                title="Open sidebar"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <div className="flex items-center space-x-2 cursor-pointer" onClick={handleReset}>
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">M</div>
              <span className="text-xl font-bold text-slate-800 tracking-tight">Counselling AI</span>
            </div>
          </div>
          
              <div className="flex items-center space-x-4">
                <div className="hidden sm:flex flex-col items-end text-[10px] uppercase font-bold text-slate-400">
                  <span>User: {currentUser?.name || 'Guest'}</span>
                  <span>Role: {currentUser?.role || 'user'}</span>
                  <span>AI Experience: {aiStats.experienceLevel}</span>
                  <span className="text-brand-600">{aiStats.totalSessionsLearned} Sessions</span>
                </div>
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => window.location.href = '/components/AdminComponents.tsx'}
                    className="px-3 py-1 bg-[#D32F2F] text-white text-xs rounded-full font-bold hover:bg-red-700 transition-colors"
                  >
                    Admin Panel
                  </button>
                )}
                {step !== AppStep.WELCOME && (
                  <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs rounded-full font-bold uppercase tracking-wider">
                    {sessionType}
                  </span>
                )}
                <button
                  onClick={() => authService.logout()}
                  className="px-3 py-1 bg-red-600 text-white text-xs rounded-full font-bold hover:bg-red-700 transition-colors whitespace-nowrap"
                >
                  Sign Out
                </button>
              </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center w-full" style={{ marginLeft: sidebarCollapsed ? '0' : '288px', transition: 'margin-left 0.3s ease' }}>
        {step === AppStep.WELCOME && <WelcomeScreen onStart={handleStart} />}
        {step === AppStep.SESSION_SELECTION && <SessionSelectionScreen onSelect={handleSessionSelect} />}
        {step === AppStep.NOTES_PROMPT && <CounselorNotesLayer onNotesProvided={handleNotesProvided} onSkip={() => handleNotesProvided(null)} />}
        {step === AppStep.MCQ_PHASE && <MCQPhase questions={SESSION_MCQ_POOLS[sessionType]} onComplete={handleMCQComplete} />}
        
        {step === AppStep.GENERATING_PHASE1 && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-pulse">
             <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-6">
                <span className="text-3xl">🧩</span>
             </div>
             <h2 className="text-2xl font-bold text-slate-800 mb-2">Accessing Knowledge Base</h2>
             <p className="text-slate-500">Retrieving past clinical patterns for this session...</p>
          </div>
        )}

        {step === AppStep.ASSESSMENT && (
          <Assessment initialQuestions={phase1Questions} sessionType={sessionType} onComplete={handleAssessmentComplete} />
        )}

        {step === AppStep.ANALYZING && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Synthesizing Final Profile</h2>
            <p className="text-slate-500">The AI is learning from your narrative...</p>
          </div>
        )}

        {step === AppStep.RESULTS && result && (
          <ResultsView result={result} answers={sessionAnswers} onReset={handleReset} />
        )}

        {step === AppStep.ERROR && (
          <div className="text-center py-12 px-4 max-w-lg mx-auto">
             <div className="mb-6 inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full text-red-600">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             </div>
            <h3 className="text-xl font-bold text-red-600 mb-2">System Interrupted</h3>
            <p className="text-slate-600 mb-6 bg-white p-4 rounded-xl border border-slate-200 text-sm font-mono break-all">
              {errorMsg}
            </p>
            <button onClick={handleReset} className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-100">
              Restart Session
            </button>
          </div>
        )}
      </main>
    </div>
  );
};


export default App;
