import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppStep, Answer, AnalysisResult, Question, MCQAnswer, SessionType, CounsellingSession, SessionStatus, AssessmentPhase } from './types.ts';
import type { User } from './services/auth.service.ts';
import { SESSION_MCQ_POOLS } from './constants.ts';
import { analyzeStudentAnswers, generatePhase1Questions, generateRapportQuestion, generateDeepDiveQuestions } from './services/geminiService.ts';
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
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [sessionType, setSessionType] = useState<SessionType>('school');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [phase1Questions, setPhase1Questions] = useState<Question[]>([]);
  const [counselorNotes, setCounselorNotes] = useState<string | null>(null);
  const [sessionAnswers, setSessionAnswers] = useState<Answer[]>([]);
  const [mcqAnswers, setMcqAnswers] = useState<MCQAnswer[]>([]);

  // Assessment progress state
  const [assessmentProgress, setAssessmentProgress] = useState<{
    answers: Answer[];
    currentIndex: number;
    phase: AssessmentPhase;
    questions: Question[];
  }>({
    answers: [],
    currentIndex: 0,
    phase: AssessmentPhase.INITIAL,
    questions: [],
  });

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sessions, setSessions] = useState<CounsellingSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [viewingSession, setViewingSession] = useState<CounsellingSession | null>(null);

  // Current session being worked on
  const [currentSession, setCurrentSession] = useState<CounsellingSession | null>(null);

  // Default state to prevent undefined errors before data loads
  const [aiStats, setAiStats] = useState({ totalSessionsLearned: 0, experienceLevel: 'Novice' });

  // Refs to prevent stale closures in async handlers
  const currentSessionRef = useRef<CounsellingSession | null>(null);
  const currentUserRef = useRef<User | null>(null);
  currentSessionRef.current = currentSession;
  currentUserRef.current = currentUser;

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

  const saveProgress = useCallback(async (updates: Partial<CounsellingSession>) => {
    if (!currentUser || !currentSession) return;
    const updated = sessionService.updateSessionData(currentUser.id, currentSession.id, updates);
    if (updated) {
      setCurrentSession(updated);
      loadSessions(currentUser.id);
    }
  }, [currentUser, currentSession, loadSessions]);

  const updateStep = useCallback(async (newStep: AppStep) => {
    if (!currentUser || !currentSession) return;
    const updated = sessionService.updateSessionStep(currentUser.id, currentSession.id, newStep);
    if (updated) {
      setCurrentSession(updated);
      setStep(newStep);
      loadSessions(currentUser.id);
    } else {
      setStep(newStep);
    }
  }, [currentUser, currentSession, loadSessions]);

  const handleAssessmentProgress = useCallback(async (
    answers: Answer[],
    currentIndex: number,
    phase: AssessmentPhase,
    questions: Question[]
  ) => {
    // Update local state
    setAssessmentProgress({ answers, currentIndex, phase, questions });
    setSessionAnswers(answers);
    
    // Save to session
    if (currentUser && currentSession) {
      await saveProgress({
        assessmentAnswers: answers,
        progress: {
          assessmentPhase: phase,
          currentQuestionIndex: currentIndex,
          assessmentQuestions: questions,
        },
      });
    }
  }, [currentUser, currentSession, saveProgress]);

  const handleStart = () => {
    setViewingSession(null);
    setActiveSessionId(null);
    setCurrentSession(null);
    setStep(AppStep.SESSION_SELECTION);
  };

  const handleSessionSelect = (type: SessionType) => {
    setSessionType(type);
    setStep(AppStep.NOTES_PROMPT);
  };

  const handleNotesProvided = async (notes: string | null) => {
    setCounselorNotes(notes);
    
    // Create or update session
    if (currentUser) {
      if (!currentSession) {
        // Create new session
        const newSession = sessionService.createSession(currentUser.id, sessionType, notes);
        setCurrentSession(newSession);
        setActiveSessionId(newSession.id);
        loadSessions(currentUser.id);
      } else {
        // Update existing session with notes
        await saveProgress({ counselorNotes: notes });
      }
    }

    if (notes) {
      await updateStep(AppStep.GENERATING_PHASE1);
      try {
        const generatedQuestions = await generatePhase1Questions(null, sessionType, notes);
        setPhase1Questions(generatedQuestions);
        await saveProgress({ phase1Questions: generatedQuestions, progress: { phase1Generated: true } });
        // Reset assessment progress for new assessment
        setAssessmentProgress({
          answers: [],
          currentIndex: 0,
          phase: AssessmentPhase.INITIAL,
          questions: generatedQuestions,
        });
        await updateStep(AppStep.ASSESSMENT);
      } catch (e: any) {
        const error = `Context ingestion failed: ${e.message || 'Check your API Key settings.'}`;
        setErrorMsg(error);
        if (currentUser && currentSession) {
          sessionService.setSessionError(currentUser.id, currentSession.id, error, AppStep.GENERATING_PHASE1);
          loadSessions(currentUser.id);
        }
        setStep(AppStep.ERROR);
      }
    } else {
      await updateStep(AppStep.MCQ_PHASE);
    }
  };

  const handleMCQComplete = async (answers: MCQAnswer[]) => {
    setMcqAnswers(answers);
    await saveProgress({ mcqAnswers: answers, progress: { mcqCompleted: true } });

    await updateStep(AppStep.GENERATING_PHASE1);
    try {
      const generatedQuestions = await generatePhase1Questions(answers, sessionType, null);
      setPhase1Questions(generatedQuestions);
      await saveProgress({ phase1Questions: generatedQuestions, progress: { phase1Generated: true } });
      // Reset assessment progress for new assessment
      setAssessmentProgress({
        answers: [],
        currentIndex: 0,
        phase: AssessmentPhase.INITIAL,
        questions: generatedQuestions,
      });
      await updateStep(AppStep.ASSESSMENT);
    } catch (e: any) {
      const error = `Generation failed: ${e.message || 'Ensure your API Key is correctly configured in Vercel.'}`;
      setErrorMsg(error);
      if (currentUser && currentSession) {
        sessionService.setSessionError(currentUser.id, currentSession.id, error, AppStep.GENERATING_PHASE1);
        loadSessions(currentUser.id);
      }
      setStep(AppStep.ERROR);
    }
  };

  const handleAssessmentComplete = async (answers: Answer[]) => {
    setSessionAnswers(answers);
    // Clear assessment progress since it's complete
    setAssessmentProgress({
      answers: [],
      currentIndex: 0,
      phase: AssessmentPhase.INITIAL,
      questions: [],
    });
    await saveProgress({ 
      assessmentAnswers: answers, 
      progress: { 
        assessmentCompleted: true,
        assessmentPhase: AssessmentPhase.DEEP_DIVE,
        currentQuestionIndex: 0,
        assessmentQuestions: [],
      } 
    });

    await updateStep(AppStep.ANALYZING);
    try {
      const analysis = await analyzeStudentAnswers(answers, sessionType);
      setResult(analysis);

      // Complete the session
      if (currentUser && currentSession) {
        const completedSession = sessionService.completeSession(currentUser.id, currentSession.id, analysis);
        if (completedSession) {
          setCurrentSession(completedSession);
          setActiveSessionId(completedSession.id);
        }
        loadSessions(currentUser.id);
      }
      await updateStep(AppStep.RESULTS);
    } catch (e: any) {
      const error = `Analysis Engine failed: ${e.message || 'Check browser console for details.'}`;
      setErrorMsg(error);
      if (currentUser && currentSession) {
        sessionService.setSessionError(currentUser.id, currentSession.id, error, AppStep.ANALYZING);
        loadSessions(currentUser.id);
      }
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
    setAssessmentProgress({
      answers: [],
      currentIndex: 0,
      phase: AssessmentPhase.INITIAL,
      questions: [],
    });
    setActiveSessionId(null);
    setViewingSession(null);
    setCurrentSession(null);
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

  const handleContinueSession = (session: CounsellingSession) => {
    // Resume an incomplete session
    setViewingSession(null);
    setActiveSessionId(session.id);
    setCurrentSession(session);
    setSessionType(session.sessionType);
    setCounselorNotes(session.counselorNotes);
    setPhase1Questions(session.phase1Questions);
    setMcqAnswers(session.mcqAnswers);
    setSessionAnswers(session.assessmentAnswers);
    setResult(session.result);
    setErrorMsg(session.progress.lastError);

    // Restore assessment progress if available
    if (session.progress.assessmentQuestions.length > 0) {
      setAssessmentProgress({
        answers: session.assessmentAnswers,
        currentIndex: session.progress.currentQuestionIndex,
        phase: session.progress.assessmentPhase,
        questions: session.progress.assessmentQuestions,
      });
    }

    // Determine where to resume based on progress
    const progress = session.progress;
    if (progress.errorStep) {
      // Resume from error step
      setStep(progress.errorStep);
    } else if (progress.analysisCompleted) {
      setStep(AppStep.RESULTS);
    } else if (progress.assessmentCompleted) {
      setStep(AppStep.ANALYZING);
    } else if (progress.phase1Generated) {
      setStep(AppStep.ASSESSMENT);
    } else if (progress.mcqCompleted) {
      setStep(AppStep.GENERATING_PHASE1);
    } else if (session.counselorNotes !== null) {
      setStep(AppStep.GENERATING_PHASE1);
    } else {
      setStep(AppStep.MCQ_PHASE);
    }
    setSidebarCollapsed(true);
  };

  const handleRetrySession = (session: CounsellingSession) => {
    if (!currentUser) return;
    
    // Reset error and retry from the failed step
    const retriedSession = sessionService.retryFromStep(currentUser.id, session.id, session.progress.errorStep || AppStep.WELCOME);
    if (retriedSession) {
      loadSessions(currentUser.id);
      handleContinueSession(retriedSession);
    }
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

  // Handle Assessment component's internal phase changes
  const handleAssessmentPhaseChange = useCallback((newPhase: any) => {
    // The Assessment component manages its own phases internally
    // We just need to ensure the session is updated when phases complete
  }, []);

    if (!isAuthenticated) {
      return <AdminComponents />;
    }

    // Admin panel takes precedence when explicitly requested
    if (showAdminPanel) {
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
          onContinueSession={handleContinueSession}
        />
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-4">
          <div className="flex items-center justify-between" style={{ marginLeft: sidebarCollapsed ? '0' : '288px', transition: 'margin-left 0.3s ease' }}>
            <div className="flex items-center space-x-3">
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
          <SessionDetailView session={viewingSession} onBack={handleBackFromSessionView} onRetry={handleRetrySession} />
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
        onContinueSession={handleContinueSession}
      />
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-4">
        <div className="flex items-center justify-between" style={{ marginLeft: sidebarCollapsed ? '0' : '288px', transition: 'margin-left 0.3s ease' }}>
          <div className="flex items-center space-x-3">
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
                      onClick={() => setShowAdminPanel(true)}
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
                {currentSession && currentSession.status === 'error' && (
                  <span className="px-3 py-1 bg-red-100 text-red-600 text-xs rounded-full font-bold uppercase tracking-wider">
                    Error - Click to Retry
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
          <Assessment
            initialQuestions={phase1Questions}
            sessionType={sessionType}
            onComplete={handleAssessmentComplete}
            onProgress={handleAssessmentProgress}
            initialAnswers={assessmentProgress.answers}
            initialIndex={assessmentProgress.currentIndex}
            initialPhase={assessmentProgress.phase}
          />
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
            <div className="flex gap-4 justify-center">
              {currentSession && (
                <button 
                  onClick={() => handleRetrySession(currentSession)}
                  className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-100 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retry from Failed Step
                </button>
              )}
              <button onClick={handleReset} className="px-8 py-3 bg-slate-600 text-white rounded-xl font-bold shadow-lg">
                Start New Session
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};


export default App;