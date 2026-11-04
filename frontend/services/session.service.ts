import { CounsellingSession, SessionType, Answer, AnalysisResult, Question, MCQAnswer, SessionProgress, SessionStatus, AppStep, AssessmentPhase } from '../types.ts';
import { authService } from './auth.service.ts';
import { crossSessionAnalysis } from './crossSessionAnalysis.ts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const SESSIONS_API_BASE = `${API_BASE_URL}/common/sessions/`;

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = authService.getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  // Handle 401 - try to refresh token once
  if (response.status === 401) {
    const refreshed = await authService.refreshAccessToken();
    if (refreshed) {
      // Retry with new token
      const newToken = authService.getAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await fetch(url, { ...options, headers });
      if (!retryResponse.ok) {
        throw new Error(`API error: ${retryResponse.status}`);
      }
      return retryResponse.json();
    } else {
      // Token refresh failed - clear auth and redirect to login
      authService.logout();
      window.location.href = '/';
      throw new Error('Authentication expired');
    }
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

interface SessionListResponse {
  id: string;
  session_type: SessionType;
  title: string;
  status: SessionStatus;
  current_step: AppStep;
  created_at: string;
  updated_at: string;
}

interface SessionDetailResponse {
  id: string;
  session_type: SessionType;
  title: string;
  status: SessionStatus;
  current_step: AppStep;
  phase1_generated: boolean;
  mcq_completed: boolean;
  assessment_completed: boolean;
  analysis_completed: boolean;
  last_error: string | null;
  error_step: AppStep | null;
  assessment_phase: AssessmentPhase;
  current_question_index: number;
  counselor_notes: string | null;
  phase1_questions: Question[];
  mcq_answers: MCQAnswer[];
  assessment_questions: Question[];
  assessment_answers: Answer[];
  result: AnalysisResult | null;
  created_at: string;
  updated_at: string;
}

class SessionService {

  private mapSessionDetail(data: SessionDetailResponse): CounsellingSession {
    return {
      id: data.id,
      userId: '', // Not needed for frontend
      sessionType: data.session_type,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      status: data.status,
      progress: {
        currentStep: data.current_step,
        phase1Generated: data.phase1_generated,
        mcqCompleted: data.mcq_completed,
        assessmentCompleted: data.assessment_completed,
        analysisCompleted: data.analysis_completed,
        lastError: data.last_error,
        errorStep: data.error_step,
        assessmentPhase: data.assessment_phase,
        currentQuestionIndex: data.current_question_index,
        assessmentQuestions: data.assessment_questions,
      },
      counselorNotes: data.counselor_notes,
      phase1Questions: data.phase1_questions,
      mcqAnswers: data.mcq_answers,
      assessmentAnswers: data.assessment_answers,
      result: data.result,
    };
  }

  private mapSessionList(data: SessionListResponse): CounsellingSession {
    return {
      id: data.id,
      userId: '',
      sessionType: data.session_type,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      status: data.status,
      progress: {
        currentStep: data.current_step,
        phase1Generated: false,
        mcqCompleted: false,
        assessmentCompleted: false,
        analysisCompleted: false,
        lastError: null,
        errorStep: null,
        assessmentPhase: AssessmentPhase.INITIAL,
        currentQuestionIndex: 0,
        assessmentQuestions: [],
      },
      counselorNotes: null,
      phase1Questions: [],
      mcqAnswers: [],
      assessmentAnswers: [],
      result: null,
    };
  }

  async getSessions(userId: string): Promise<CounsellingSession[]> {
    try {
      const data = await apiRequest<{ results: SessionListResponse[] }>(SESSIONS_API_BASE);
      const sessions = (data.results || []).map((item: SessionListResponse) => this.mapSessionList(item));
      return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (error) {
      console.warn('Failed to fetch sessions from API, falling back to localStorage:', error);
      return this.getSessionsFromLocalStorage(userId);
    }
  }

  async getSession(userId: string, sessionId: string): Promise<CounsellingSession | null> {
    try {
      const data = await apiRequest<SessionDetailResponse>(`${SESSIONS_API_BASE}/${sessionId}/`);
      return this.mapSessionDetail(data);
    } catch (error) {
      console.warn('Failed to fetch session from API, falling back to localStorage:', error);
      return this.getSessionFromLocalStorage(userId, sessionId);
    }
  }

  async createSession(
    userId: string,
    sessionType: SessionType,
    counselorNotes: string | null = null
  ): Promise<CounsellingSession> {
    try {
      const title = this.generateTitle(sessionType, null, null);
      const data = await apiRequest<SessionDetailResponse>(SESSIONS_API_BASE, {
        method: 'POST',
        body: JSON.stringify({
          session_type: sessionType,
          title,
          counselor_notes: counselorNotes,
        }),
      });
      return this.mapSessionDetail(data);
    } catch (error) {
      console.warn('Failed to create session via API, using localStorage:', error);
      return this.createSessionLocal(userId, sessionType, counselorNotes);
    }
  }

  async updateSessionProgress(userId: string, sessionId: string, progressUpdates: Partial<SessionProgress>): Promise<CounsellingSession | null> {
    try {
      const data = await apiRequest<SessionDetailResponse>(`${SESSIONS_API_BASE}/${sessionId}/`, {
        method: 'PATCH',
        body: JSON.stringify(this.mapProgressToBackend(progressUpdates)),
      });
      return this.mapSessionDetail(data);
    } catch (error) {
      console.warn('Failed to update session progress via API, using localStorage:', error);
      return this.updateSessionProgressLocal(userId, sessionId, progressUpdates);
    }
  }

  async updateSessionStep(userId: string, sessionId: string, step: AppStep): Promise<CounsellingSession | null> {
    return this.updateSessionProgress(userId, sessionId, { currentStep: step });
  }

  async updateSessionData(
    userId: string,
    sessionId: string,
    data: Partial<Pick<CounsellingSession, 'counselorNotes' | 'phase1Questions' | 'mcqAnswers' | 'assessmentAnswers' | 'result' | 'status' | 'title'>>
  ): Promise<CounsellingSession | null> {
    try {
      const responseData = await apiRequest<SessionDetailResponse>(`${SESSIONS_API_BASE}/${sessionId}/`, {
        method: 'PATCH',
        body: JSON.stringify(this.mapDataToBackend(data)),
      });
      return this.mapSessionDetail(responseData);
    } catch (error) {
      console.warn('Failed to update session data via API, using localStorage:', error);
      return this.updateSessionDataLocal(userId, sessionId, data);
    }
  }

  async setSessionError(userId: string, sessionId: string, error: string, step: AppStep): Promise<CounsellingSession | null> {
    return this.updateSessionProgress(userId, sessionId, { lastError: error, errorStep: step });
  }

  async clearSessionError(userId: string, sessionId: string): Promise<CounsellingSession | null> {
    return this.updateSessionProgress(userId, sessionId, { lastError: null, errorStep: null });
  }

  async retryFromStep(userId: string, sessionId: string, step: AppStep): Promise<CounsellingSession | null> {
    try {
      const data = await apiRequest<SessionDetailResponse>(`${SESSIONS_API_BASE}/${sessionId}/retry/`, {
        method: 'POST',
        body: JSON.stringify({ step }),
      });
      return this.mapSessionDetail(data);
    } catch (error) {
      console.warn('Failed to retry session via API, using localStorage:', error);
      return this.retryFromStepLocal(userId, sessionId, step);
    }
  }

  async completeSession(userId: string, sessionId: string, result: AnalysisResult): Promise<CounsellingSession | null> {
    try {
      const data = await apiRequest<SessionDetailResponse>(`${SESSIONS_API_BASE}/${sessionId}/complete/`, {
        method: 'POST',
        body: JSON.stringify({ result }),
      });
      const session = this.mapSessionDetail(data);

      // Update cross-session analysis asynchronously
      crossSessionAnalysis.updateUserEmbedding(userId, session);
      crossSessionAnalysis.generateCrossSessionInsights(userId).catch(console.error);

      return session;
    } catch (error) {
      console.warn('Failed to complete session via API, using localStorage:', error);
      return this.completeSessionLocal(userId, sessionId, result);
    }
  }

  async deleteSession(userId: string, sessionId: string): Promise<boolean> {
    try {
      await apiRequest(`${SESSIONS_API_BASE}/${sessionId}/`, {
        method: 'DELETE',
      });
      return true;
    } catch (error) {
      console.warn('Failed to delete session via API, using localStorage:', error);
      return this.deleteSessionLocal(userId, sessionId);
    }
  }

  async clearAllSessions(userId: string): Promise<void> {
    // Not implemented for API - would need a bulk delete endpoint
    this.clearAllSessionsLocal(userId);
  }

  // --- LocalStorage fallback methods ---
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

  private getSessionsFromLocalStorage(userId: string): CounsellingSession[] {
    const key = this.getSessionKey(userId);
    const data = localStorage.getItem(key);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      // Handle corrupted data - ensure it's an array
      if (!Array.isArray(parsed)) {
        console.warn('Corrupted session data in localStorage, clearing:', parsed);
        localStorage.removeItem(key);
        return [];
      }
      return parsed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch {
      localStorage.removeItem(key);
      return [];
    }
  }

  private getSessionFromLocalStorage(userId: string, sessionId: string): CounsellingSession | null {
    const sessions = this.getSessionsFromLocalStorage(userId);
    return sessions.find(s => s.id === sessionId) || null;
  }

  private createSessionLocal(
    userId: string,
    sessionType: SessionType,
    counselorNotes: string | null = null
  ): CounsellingSession {
    const sessions = this.getSessionsFromLocalStorage(userId);
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

  private updateSessionProgressLocal(userId: string, sessionId: string, progressUpdates: Partial<SessionProgress>): CounsellingSession | null {
    const sessions = this.getSessionsFromLocalStorage(userId);
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

  private updateSessionDataLocal(
    userId: string,
    sessionId: string,
    data: Partial<Pick<CounsellingSession, 'counselorNotes' | 'phase1Questions' | 'mcqAnswers' | 'assessmentAnswers' | 'result' | 'status' | 'title'>>
  ): CounsellingSession | null {
    const sessions = this.getSessionsFromLocalStorage(userId);
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

  private retryFromStepLocal(userId: string, sessionId: string, step: AppStep): CounsellingSession | null {
    const sessions = this.getSessionsFromLocalStorage(userId);
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index === -1) return null;

    const newProgress = this.getDefaultProgress();
    newProgress.currentStep = step;

    if (step > AppStep.MCQ_PHASE) {
      newProgress.mcqCompleted = sessions[index].progress.mcqCompleted;
    }
    if (step > AppStep.GENERATING_PHASE1) {
      newProgress.phase1Generated = sessions[index].progress.phase1Generated;
    }
    if (step > AppStep.ASSESSMENT) {
      newProgress.assessmentCompleted = sessions[index].progress.assessmentCompleted;
      newProgress.assessmentPhase = sessions[index].progress.assessmentPhase;
      newProgress.currentQuestionIndex = sessions[index].progress.currentQuestionIndex;
      newProgress.assessmentQuestions = sessions[index].progress.assessmentQuestions;
    } else if (step === AppStep.ASSESSMENT) {
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

  private completeSessionLocal(userId: string, sessionId: string, result: AnalysisResult): CounsellingSession | null {
    const sessions = this.getSessionsFromLocalStorage(userId);
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

    crossSessionAnalysis.updateUserEmbedding(userId, sessions[index]);
    crossSessionAnalysis.generateCrossSessionInsights(userId).catch(console.error);

    return sessions[index];
  }

  private deleteSessionLocal(userId: string, sessionId: string): boolean {
    const sessions = this.getSessionsFromLocalStorage(userId);
    const filtered = sessions.filter(s => s.id !== sessionId);
    if (filtered.length === sessions.length) return false;
    localStorage.setItem(this.getSessionKey(userId), JSON.stringify(filtered));
    return true;
  }

  private clearAllSessionsLocal(userId: string): void {
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

  private mapProgressToBackend(progress: Partial<SessionProgress>): Record<string, unknown> {
    const backendData: Record<string, unknown> = {};
    if (progress.currentStep !== undefined) backendData.current_step = progress.currentStep;
    if (progress.phase1Generated !== undefined) backendData.phase1_generated = progress.phase1Generated;
    if (progress.mcqCompleted !== undefined) backendData.mcq_completed = progress.mcqCompleted;
    if (progress.assessmentCompleted !== undefined) backendData.assessment_completed = progress.assessmentCompleted;
    if (progress.analysisCompleted !== undefined) backendData.analysis_completed = progress.analysisCompleted;
    if (progress.lastError !== undefined) backendData.last_error = progress.lastError;
    if (progress.errorStep !== undefined) backendData.error_step = progress.errorStep;
    if (progress.assessmentPhase !== undefined) backendData.assessment_phase = progress.assessmentPhase;
    if (progress.currentQuestionIndex !== undefined) backendData.current_question_index = progress.currentQuestionIndex;
    if (progress.assessmentQuestions !== undefined) backendData.assessment_questions = progress.assessmentQuestions;
    return backendData;
  }

  private mapDataToBackend(data: Partial<Pick<CounsellingSession, 'counselorNotes' | 'phase1Questions' | 'mcqAnswers' | 'assessmentAnswers' | 'result' | 'status' | 'title'>>): Record<string, unknown> {
    const backendData: Record<string, unknown> = {};
    if (data.counselorNotes !== undefined) backendData.counselor_notes = data.counselorNotes;
    if (data.phase1Questions !== undefined) backendData.phase1_questions = data.phase1Questions;
    if (data.mcqAnswers !== undefined) backendData.mcq_answers = data.mcqAnswers;
    if (data.assessmentAnswers !== undefined) backendData.assessment_answers = data.assessmentAnswers;
    if (data.result !== undefined) backendData.result = data.result;
    if (data.status !== undefined) backendData.status = data.status;
    if (data.title !== undefined) backendData.title = data.title;
    return backendData;
  }
}

export const sessionService = new SessionService();