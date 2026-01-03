
const STORAGE_KEY = 'mindpath_global_knowledge';

export interface ClinicalInsight {
  sessionType: string;
  pattern: string;
  recommendation: string;
  timestamp: number;
}

export const KnowledgeBaseService = {
  getInsights: (): ClinicalInsight[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  addInsight: (insight: ClinicalInsight) => {
    const insights = KnowledgeBaseService.getInsights();
    // Keep only the most recent 20 high-quality insights to prevent prompt bloat
    const updated = [insight, ...insights].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  getLearningContext: (sessionType: string): string => {
    const insights = KnowledgeBaseService.getInsights()
      .filter(i => i.sessionType === sessionType);
    
    if (insights.length === 0) return "";

    return `
      PREVIOUS LEARNINGS FROM SUCCESSFUL SESSIONS (Session Type: ${sessionType}):
      ${insights.map((i, idx) => `${idx + 1}. Observed Pattern: ${i.pattern}. Clinical Rule: ${i.recommendation}`).join('\n')}
      
      INSTRUCTION: Use these past patterns to make your current analysis more precise. If you see similar behavioral markers, apply these established clinical rules.
    `;
  },

  getStats: () => {
    const insights = KnowledgeBaseService.getInsights();
    return {
      totalSessionsLearned: insights.length,
      experienceLevel: insights.length < 5 ? 'Novice' : insights.length < 15 ? 'Practitioner' : 'Senior Specialist'
    };
  }
};
