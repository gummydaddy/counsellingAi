import { CounsellingSession, SessionType, Answer, AnalysisResult, Question, MCQAnswer, SessionProgress, SessionStatus, AppStep, AssessmentPhase } from '../types.ts';
import { crossSessionAnalysis } from './crossSessionAnalysis.ts';

class SessionService {
  private readonly SESSIONS_PREFIX = 'counsellingAi_sessions_';

  private getSessionKey(userId: string): string {
    return `${this.SESSIONS_PREFIX}${userId}`;
  }

  private getDefaultProgress(): SessionProgress {
    return {
      currentStep: AppStep.WELCOME,
      phase1Generated: false,
      mcqCompleted: false,
      assessmentCompleted: false,
      analysisCompleted: false,
      lastError: null,
      errorStep: null,
      assessmentPhase: AssessmentPhase.INITIAL,
      currentQuestionIndex: 0,
      assessmentQuestions: [],
    };
  }

  getSessions(userId: string): CounsellingSession[] {
    const key = this.getSessionKey(userId);
    const data = localStorage.getItem(key);
    if (!data) return [];
    try {
      const sessions = JSON.parse(data) as CounsellingSession[];
      return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch {
      return [];
    }
  }

  getSession(userId: string, sessionId: string): CounsellingSession | null {
    const sessions = this.getSessions(userId);
    return sessions.find(s => s.id === sessionId) || null;
  }

  createSession(
    userId: string,
    sessionType: SessionType,
    counselorNotes: string | null = null
  ): CounsellingSession {
    const sessions = this.getSessions(userId);

    const title = this.generateTitle(sessionType, null, null);
    const now = new Date().toISOString();
    const newSession: CounsellingSession = {
      id: 'session-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
      userId,
      sessionType,
      title,
      createdAt: now,
      updatedAt: now,
      status: 'in_progress',
      progress: this.getDefaultProgress(),
      counselorNotes,
      phase1Questions: [],
      mcqAnswers: [],
      assessmentAnswers: [],
      result: null,
    };

    sessions.unshift(newSession);
    localStorage.setItem(this.getSessionKey(userId), JSON.stringify(sessions));
    return newSession;
  }

  updateSessionProgress(userId: string, sessionId: string, progressUpdates: Partial<SessionProgress>): CounsellingSession | null {
    const sessions = this.getSessions(userId);
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index === -1) return null;

    sessions[index] = {
      ...sessions[index],
      progress: { ...sessions[index].progress, ...progressUpdates },
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(this.getSessionKey(userId), JSON.stringify(sessions));
    return sessions[index];
  }

  updateSessionStep(userId: string, sessionId: string, step: AppStep): CounsellingSession | null {
    return this.updateSessionProgress(userId, sessionId, { currentStep: step });
  }

  updateSessionData(
    userId: string,
    sessionId: string,
    data: Partial<Pick<CounsellingSession, 'counselorNotes' | 'phase1Questions' | 'mcqAnswers' | 'assessmentAnswers' | 'result' | 'status' | 'title'>>
  ): CounsellingSession | null {
    const sessions = this.getSessions(userId);
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index === -1) return null;

    sessions[index] = {
      ...sessions[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(this.getSessionKey(userId), JSON.stringify(sessions));
    return sessions[index];
  }

  setSessionError(userId: string, sessionId: string, error: string, step: AppStep): CounsellingSession | null {
    const sessions = this.getSessions(userId);
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index === -1) return null;

    sessions[index] = {
      ...sessions[index],
      status: 'error',
      progress: {
        ...sessions[index].progress,
        lastError: error,
        errorStep: step,
      },
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(this.getSessionKey(userId), JSON.stringify(sessions));
    return sessions[index];
  }

  clearSessionError(userId: string, sessionId: string): CounsellingSession | null {
    return this.updateSessionProgress(userId, sessionId, { lastError: null, errorStep: null });
  }

  retryFromStep(userId: string, sessionId: string, step: AppStep): CounsellingSession | null {
    const sessions = this.getSessions(userId);
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index === -1) return null;

    // Reset progress from the failed step onwards
    const newProgress = this.getDefaultProgress();
    newProgress.currentStep = step;

    // Preserve completed phases before the retry step
    if (step > AppStep.MCQ_PHASE) {
      newProgress.mcqCompleted = sessions[index].progress.mcqCompleted;
    }
    if (step > AppStep.GENERATING_PHASE1) {
      newProgress.phase1Generated = sessions[index].progress.phase1Generated;
    }
    if (step > AppStep.ASSESSMENT) {
      newProgress.assessmentCompleted = sessions[index].progress.assessmentCompleted;
      // Preserve assessment progress if we're past assessment
      newProgress.assessmentPhase = sessions[index].progress.assessmentPhase;
      newProgress.currentQuestionIndex = sessions[index].progress.currentQuestionIndex;
      newProgress.assessmentQuestions = sessions[index].progress.assessmentQuestions;
    } else if (step === AppStep.ASSESSMENT) {
      // If retrying at assessment step, preserve the assessment progress
      newProgress.assessmentPhase = sessions[index].progress.assessmentPhase;
      newProgress.currentQuestionIndex = sessions[index].progress.currentQuestionIndex;
      newProgress.assessmentQuestions = sessions[index].progress.assessmentQuestions;
    }
    if (step > AppStep.ANALYZING) {
      newProgress.analysisCompleted = sessions[index].progress.analysisCompleted;
    }

    sessions[index] = {
      ...sessions[index],
      status: 'in_progress',
      progress: newProgress,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(this.getSessionKey(userId), JSON.stringify(sessions));
    return sessions[index];
  }

  completeSession(userId: string, sessionId: string, result: AnalysisResult): CounsellingSession | null {
    const sessions = this.getSessions(userId);
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index === -1) return null;

    const title = this.generateTitle(sessions[index].sessionType, sessions[index].assessmentAnswers, result);

    sessions[index] = {
      ...sessions[index],
      status: 'completed',
      progress: {
        ...sessions[index].progress,
        currentStep: AppStep.RESULTS,
        analysisCompleted: true,
        lastError: null,
        errorStep: null,
      },
      result,
      title,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(this.getSessionKey(userId), JSON.stringify(sessions));

    // Update cross-session analysis asynchronously
    crossSessionAnalysis.updateUserEmbedding(userId, sessions[index]);
    crossSessionAnalysis.generateCrossSessionInsights(userId);

    return sessions[index];
  }

  deleteSession(userId: string, sessionId: string): boolean {
    const sessions = this.getSessions(userId);
    const filtered = sessions.filter(s => s.id !== sessionId);
    if (filtered.length === sessions.length) return false;
    localStorage.setItem(this.getSessionKey(userId), JSON.stringify(filtered));
    return true;
  }

  clearAllSessions(userId: string): void {
    localStorage.removeItem(this.getSessionKey(userId));
  }

  private generateTitle(sessionType: SessionType, answers: Answer[] | null, result: AnalysisResult | null): string {
    const typeLabels: Record<SessionType, string> = {
      school: 'Academic',
      medical: 'Medical',
      psychological: 'Psychological',
      career: 'Career',
      relationship: 'Relationship',
    };

    const label = typeLabels[sessionType] || sessionType;
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const archetype = result?.archetype ? ` — ${result.archetype}` : '';
    const inProgress = !result ? ' (In Progress)' : '';
    return `${label} Session${archetype}${inProgress} (${date})`;
  }
}

export const sessionService = new SessionService();