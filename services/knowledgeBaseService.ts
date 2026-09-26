
/**
 * PRODUCTION ARCHITECTURE NOTE:
 * This service acts as the "Data Access Layer" (DAL).
 * 
 * CURRENT STATE: Uses 'DjangoBackendProvider' for PostgreSQL persistence via Django REST API.
 * FALLBACK: LocalStorageProvider for offline/demo mode.
 */

const STORAGE_KEY = 'mindpath_global_knowledge';
const API_BASE = '/api/common';  // Django backend API prefix

export interface ClinicalInsight {
  id?: string;
  sessionType: string;
  pattern: string;
  recommendation: string;
  confidenceScore?: number;
  usageCount?: number;
  createdAt?: string;
  timestamp?: number;
}

// --- 1. THE ADAPTER INTERFACE (The Contract) ---
// Any database you use in the future must satisfy this contract.
interface DataProvider {
  getInsights(): Promise<ClinicalInsight[]>;
  addInsight(insight: ClinicalInsight): Promise<void>;
  getStats(): Promise<{ totalSessionsLearned: number; experienceLevel: string }>;
  getContext(sessionType: string): Promise<string>;
}

// --- 2. DJANGO BACKEND PROVIDER (Production) ---
const DjangoBackendProvider: DataProvider = {
  async getInsights(): Promise<ClinicalInsight[]> {
    try {
      const response = await fetch(`${API_BASE}/insights/`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      const data = await response.json();
      // Handle paginated response
      return (data.results || data).map((item: any) => ({
        id: item.id,
        sessionType: item.session_type,
        pattern: item.pattern,
        recommendation: item.recommendation,
        confidenceScore: item.confidence_score,
        usageCount: item.usage_count,
        createdAt: item.created_at,
        timestamp: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
      }));
    } catch (error) {
      console.warn('Django backend unavailable, falling back to localStorage:', error);
      return LocalStorageProvider.getInsights();
    }
  },

  async addInsight(insight: ClinicalInsight): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/insights/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_type: insight.sessionType,
          pattern: insight.pattern,
          recommendation: insight.recommendation,
          confidence_score: insight.confidenceScore || 0.8,
        }),
      });
      if (!response.ok) throw new Error('Failed to add insight');
    } catch (error) {
      console.warn('Django backend unavailable, falling back to localStorage:', error);
      return LocalStorageProvider.addInsight(insight);
    }
  },

  async getStats(): Promise<{ totalSessionsLearned: number; experienceLevel: string }> {
    try {
      const response = await fetch(`${API_BASE}/insights/stats/`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return await response.json();
    } catch (error) {
      console.warn('Django backend unavailable, falling back to localStorage:', error);
      return LocalStorageProvider.getStats();
    }
  },

  async getContext(sessionType: string): Promise<string> {
    try {
      const response = await fetch(`${API_BASE}/insights/context/${sessionType}/`);
      if (!response.ok) throw new Error('Failed to fetch context');
      const data = await response.json();
      return data.context || '';
    } catch (error) {
      console.warn('Django backend unavailable, falling back to localStorage:', error);
      return LocalStorageProvider.getContext?.(sessionType) || '';
    }
  }
};

// --- 3. LOCAL STORAGE IMPLEMENTATION (Fallback/Demo) ---
const LocalStorageProvider: DataProvider = {
  getInsights: async () => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  addInsight: async (insight: ClinicalInsight) => {
    const data = localStorage.getItem(STORAGE_KEY);
    const insights: ClinicalInsight[] = data ? JSON.parse(data) : [];
    
    // Keep only the most recent 20 high-quality insights
    const updated = [insight, ...insights].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  getStats: async () => {
    const data = localStorage.getItem(STORAGE_KEY);
    const insights = data ? JSON.parse(data) : [];
    return {
      totalSessionsLearned: insights.length,
      experienceLevel: insights.length < 5 ? 'Novice' : insights.length < 15 ? 'Practitioner' : 'Senior Specialist'
    };
  },

  getContext: async (sessionType: string): Promise<string> => {
    const data = localStorage.getItem(STORAGE_KEY);
    const insights: ClinicalInsight[] = data ? JSON.parse(data) : [];
    const relevant = insights.filter(i => i.sessionType === sessionType);
    
    if (relevant.length === 0) return "";

    return `
      PREVIOUS LEARNINGS FROM SUCCESSFUL SESSIONS (Session Type: ${sessionType}):
      ${relevant.map((i, idx) => `${idx + 1}. Observed Pattern: ${i.pattern}. Clinical Rule: ${i.recommendation}`).join('\n')}
      
      INSTRUCTION: Use these past patterns to make your current analysis more precise.
    `;
  }
};

// --- 4. EXPORTED SERVICE (Uses the chosen Provider) ---
// Use Django backend in production, localStorage as fallback
const CurrentProvider: DataProvider = DjangoBackendProvider;

export const KnowledgeBaseService = {
  getInsights: () => CurrentProvider.getInsights(),
  
  addInsight: (insight: ClinicalInsight) => CurrentProvider.addInsight(insight),
  
  getStats: () => CurrentProvider.getStats(),

  // This helper combines data logic with business logic
  getLearningContext: async (sessionType: string): Promise<string> => {
    return CurrentProvider.getContext(sessionType);
  }
};
