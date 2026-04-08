import { CounsellingSession, SessionType, Answer, AnalysisResult, Question, MCQAnswer } from '../types.ts';

class SessionService {
  private readonly SESSIONS_PREFIX = 'counsellingAi_sessions_';

  private getSessionKey(userId: string): string {
    return `${this.SESSIONS_PREFIX}${userId}`;
  }

  getSessions(userId: string): CounsellingSession[] {
    const key = this.getSessionKey(userId);
    const data = localStorage.getItem(key);
    if (!data) return [];
    try {
      const sessions = JSON.parse(data) as CounsellingSession[];
      return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  getSession(userId: string, sessionId: string): CounsellingSession | null {
    const sessions = this.getSessions(userId);
    return sessions.find(s => s.id === sessionId) || null;
  }

  saveSession(
    userId: string,
    sessionType: SessionType,
    counselorNotes: string | null,
    phase1Questions: Question[],
    mcqAnswers: MCQAnswer[],
    assessmentAnswers: Answer[],
    result: AnalysisResult | null
  ): CounsellingSession {
    const sessions = this.getSessions(userId);

    const title = this.generateTitle(sessionType, assessmentAnswers, result);
    const newSession: CounsellingSession = {
      id: 'session-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
      userId,
      sessionType,
      title,
      createdAt: new Date().toISOString(),
      counselorNotes,
      phase1Questions,
      mcqAnswers,
      assessmentAnswers,
      result,
    };

    sessions.unshift(newSession);
    localStorage.setItem(this.getSessionKey(userId), JSON.stringify(sessions));
    return newSession;
  }

  updateSession(userId: string, sessionId: string, updates: Partial<CounsellingSession>): CounsellingSession | null {
    const sessions = this.getSessions(userId);
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index === -1) return null;

    sessions[index] = { ...sessions[index], ...updates };
    localStorage.setItem(this.getSessionKey(userId), JSON.stringify(sessions));
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

  private generateTitle(sessionType: SessionType, answers: Answer[], result: AnalysisResult | null): string {
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
    return `${label} Session${archetype} (${date})`;
  }
}

export const sessionService = new SessionService();
