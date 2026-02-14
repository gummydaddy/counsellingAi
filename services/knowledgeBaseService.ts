
/**
 * PRODUCTION ARCHITECTURE NOTE:
 * This service acts as the "Data Access Layer" (DAL).
 * 
 * CURRENT STATE: Uses 'LocalStorageAdapter' for client-side persistence (Demo/MVP).
 * FUTURE STATE: To go production, replace the methods in 'CurrentProvider' 
 * with fetch calls to your backend (e.g., Node.js/Express + PostgreSQL).
 */

const STORAGE_KEY = 'mindpath_global_knowledge';

export interface ClinicalInsight {
  sessionType: string;
  pattern: string;
  recommendation: string;
  timestamp: number;
}

// --- 1. THE ADAPTER INTERFACE (The Contract) ---
// Any database you use in the future must satisfy this contract.
interface DataProvider {
  getInsights(): Promise<ClinicalInsight[]>;
  addInsight(insight: ClinicalInsight): Promise<void>;
  getStats(): Promise<{ totalSessionsLearned: number; experienceLevel: string }>;
}

// --- 2. LOCAL STORAGE IMPLEMENTATION (Current) ---
const LocalStorageProvider: DataProvider = {
  getInsights: async () => {
    // Simulate network delay for realism
    // await new Promise(resolve => setTimeout(resolve, 100)); 
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
  }
};

/* 
// --- 3. EXAMPLE PRODUCTION IMPLEMENTATION (Future) ---
const SupabaseProvider: DataProvider = {
  getInsights: async () => {
    const { data } = await supabase.from('insights').select('*');
    return data;
  },
  addInsight: async (insight) => {
    await supabase.from('insights').insert(insight);
  },
  getStats: async () => {
    // call a backend endpoint
    const response = await fetch('/api/stats'); 
    return response.json();
  }
};
*/

// --- 4. EXPORTED SERVICE (Uses the chosen Provider) ---
const CurrentProvider = LocalStorageProvider; 

export const KnowledgeBaseService = {
  getInsights: () => CurrentProvider.getInsights(),
  
  addInsight: (insight: ClinicalInsight) => CurrentProvider.addInsight(insight),
  
  getStats: () => CurrentProvider.getStats(),

  // This helper combines data logic with business logic
  getLearningContext: async (sessionType: string): Promise<string> => {
    const insights = await CurrentProvider.getInsights();
    const relevant = insights.filter(i => i.sessionType === sessionType);
    
    if (relevant.length === 0) return "";

    return `
      PREVIOUS LEARNINGS FROM SUCCESSFUL SESSIONS (Session Type: ${sessionType}):
      ${relevant.map((i, idx) => `${idx + 1}. Observed Pattern: ${i.pattern}. Clinical Rule: ${i.recommendation}`).join('\n')}
      
      INSTRUCTION: Use these past patterns to make your current analysis more precise.
    `;
  }
};
