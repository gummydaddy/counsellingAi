import { CounsellingSession, SessionType, Answer, AnalysisResult, Question } from '../types.ts';
import { sessionService } from './session.service.ts';

export interface UserEmbedding {
  userId: string;
  sessionType: SessionType;
  traitVector: number[]; // [empathy, logic, integrity, ambition, resilience, social_calibration]
  archetypeHistory: string[];
  commonPatterns: string[];
  sessionCount: number;
  lastUpdated: string;
}

export interface CrossSessionInsight {
  type: 'pattern' | 'trend' | 'correlation' | 'risk';
  title: string;
  description: string;
  confidence: number; // 0-1
  sessionsInvolved: string[];
  actionable?: string;
}

export interface SessionRelation {
  sessionId: string;
  similarity: number; // 0-1
  sharedTraits: string[];
  sharedPatterns: string[];
}

class CrossSessionAnalysisService {
  private readonly EMBEDDING_KEY = 'mindpath_user_embeddings_';
  private readonly CROSS_SESSION_KEY = 'mindpath_cross_session_';

  private getEmbeddingKey(userId: string): string {
    return `${this.EMBEDDING_KEY}${userId}`;
  }

  private getCrossSessionKey(userId: string): string {
    return `${this.CROSS_SESSION_KEY}${userId}`;
  }

  // Generate trait vector from analysis result
  private generateTraitVector(result: AnalysisResult): number[] {
    return [
      result.traits.empathy / 100,
      result.traits.logic / 100,
      result.traits.integrity / 100,
      result.traits.ambition / 100,
      result.traits.resilience / 100,
      result.traits.social_calibration / 100,
    ];
  }

  // Cosine similarity between two vectors
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Update user embedding after a session completes
  async updateUserEmbedding(userId: string, session: CounsellingSession): Promise<UserEmbedding | null> {
    if (!session.result) return null;

    const key = this.getEmbeddingKey(userId);
    let embedding: UserEmbedding | null = null;
    
    try {
      const stored = localStorage.getItem(key);
      if (stored) embedding = JSON.parse(stored);
    } catch {
      embedding = null;
    }

    const traitVector = this.generateTraitVector(session.result);
    const archetype = session.result.archetype;

    if (!embedding) {
      embedding = {
        userId,
        sessionType: session.sessionType,
        traitVector,
        archetypeHistory: [archetype],
        commonPatterns: [],
        sessionCount: 1,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      // Weighted average of trait vectors (more weight to recent sessions)
      const weight = 1 / (embedding.sessionCount + 1);
      embedding.traitVector = embedding.traitVector.map((val, i) => 
        val * (1 - weight) + traitVector[i] * weight
      );
      
      if (!embedding.archetypeHistory.includes(archetype)) {
        embedding.archetypeHistory.push(archetype);
      }
      embedding.sessionCount += 1;
      embedding.lastUpdated = new Date().toISOString();
    }

    localStorage.setItem(key, JSON.stringify(embedding));
    return embedding;
  }

  // Get user embedding
  getUserEmbedding(userId: string): UserEmbedding | null {
    const key = this.getEmbeddingKey(userId);
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  // Find related sessions for a given session
  findRelatedSessions(userId: string, currentSessionId: string, threshold = 0.7): SessionRelation[] {
    const sessions = sessionService.getSessions(userId);
    const currentSession = sessions.find(s => s.id === currentSessionId);
    
    if (!currentSession?.result) return [];

    const currentVector = this.generateTraitVector(currentSession.result);
    const relations: SessionRelation[] = [];

    for (const session of sessions) {
      if (session.id === currentSessionId || !session.result) continue;
      if (session.sessionType !== currentSession.sessionType) continue;

      const sessionVector = this.generateTraitVector(session.result);
      const similarity = this.cosineSimilarity(currentVector, sessionVector);

      if (similarity >= threshold) {
        const sharedTraits: string[] = [];
        const traitNames = ['empathy', 'logic', 'integrity', 'ambition', 'resilience', 'social_calibration'];
        traitNames.forEach((name, i) => {
          if (Math.abs(currentSession.result!.traits[name as keyof typeof currentSession.result.traits] - 
              session.result!.traits[name as keyof typeof session.result.traits]) < 15) {
            sharedTraits.push(name);
          }
        });

        relations.push({
          sessionId: session.id,
          similarity,
          sharedTraits,
          sharedPatterns: this.findSharedPatterns(currentSession, session),
        });
      }
    }

    return relations.sort((a, b) => b.similarity - a.similarity);
  }

  // Find shared patterns between two sessions
  private findSharedPatterns(s1: CounsellingSession, s2: CounsellingSession): string[] {
    const patterns: string[] = [];
    
    if (s1.result?.riskAssessment.level === s2.result?.riskAssessment.level) {
      patterns.push(`Similar risk level: ${s1.result.riskAssessment.level}`);
    }

    if (s1.result?.archetype === s2.result?.archetype) {
      patterns.push(`Same archetype: ${s1.result.archetype}`);
    }

    const flags1 = new Set(s1.result?.riskAssessment.flags || []);
    const flags2 = new Set(s2.result?.riskAssessment.flags || []);
    const sharedFlags = [...flags1].filter(f => flags2.has(f));
    if (sharedFlags.length > 0) {
      patterns.push(`Shared risk flags: ${sharedFlags.join(', ')}`);
    }

    return patterns;
  }

  // Generate cross-session insights for a user
  generateCrossSessionInsights(userId: string): CrossSessionInsight[] {
    const sessions = sessionService.getSessions(userId).filter(s => s.result);
    const insights: CrossSessionInsight[] = [];

    if (sessions.length < 2) return insights;

    // 1. Archetype consistency
    const archetypes = sessions.map(s => s.result!.archetype);
    const archetypeCounts = new Map<string, number>();
    archetypes.forEach(a => archetypeCounts.set(a, (archetypeCounts.get(a) || 0) + 1));
    const dominantArchetype = [...archetypeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    
    if (dominantArchetype[1] / sessions.length > 0.5) {
      insights.push({
        type: 'pattern',
        title: 'Consistent Archetype Pattern',
        description: `You consistently present as "${dominantArchetype[0]}" across ${dominantArchetype[1]} of ${sessions.length} sessions. This suggests a stable core personality pattern.`,
        confidence: 0.8,
        sessionsInvolved: sessions.map(s => s.id),
        actionable: 'Consider how this archetype influences your decision-making across contexts.'
      });
    }

    // 2. Risk trend analysis
    const riskLevels = { Low: 1, Moderate: 2, High: 3, Critical: 4 };
    const riskScores = sessions.map(s => riskLevels[s.result!.riskAssessment.level as keyof typeof riskLevels] || 1);
    const avgRisk = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;
    const recentRisk = riskScores.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, riskScores.length);

    if (recentRisk > avgRisk + 0.5) {
      insights.push({
        type: 'risk',
        title: 'Increasing Risk Trend',
        description: `Recent sessions show higher risk levels compared to your historical average. This may indicate escalating concerns.`,
        confidence: 0.7,
        sessionsInvolved: sessions.slice(0, 3).map(s => s.id),
        actionable: 'Consider scheduling a follow-up with a professional counselor.'
      });
    } else if (recentRisk < avgRisk - 0.5) {
      insights.push({
        type: 'trend',
        title: 'Improving Risk Profile',
        description: `Recent sessions show lower risk levels. Your coping strategies appear to be effective.`,
        confidence: 0.75,
        sessionsInvolved: sessions.slice(0, 3).map(s => s.id),
        actionable: 'Continue current self-care practices that are working well.'
      });
    }

    // 3. Trait evolution
    const traitNames = ['empathy', 'logic', 'integrity', 'ambition', 'resilience', 'social_calibration'] as const;
    traitNames.forEach(trait => {
      const values = sessions.map(s => s.result!.traits[trait]);
      const recent = values.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, values.length);
      const historical = values.slice(3).reduce((a, b) => a + b, 0) / Math.max(1, values.length - 3);
      
      if (recent > historical + 10) {
        insights.push({
          type: 'trend',
          title: `${trait.charAt(0).toUpperCase() + trait.slice(1)} Increasing`,
          description: `Your ${trait} has improved by ${Math.round(recent - historical)} points in recent sessions.`,
          confidence: 0.7,
          sessionsInvolved: sessions.slice(0, 3).map(s => s.id),
        });
      } else if (recent < historical - 10) {
        insights.push({
          type: 'trend',
          title: `${trait.charAt(0).toUpperCase() + trait.slice(1)} Declining`,
          description: `Your ${trait} has decreased by ${Math.round(historical - recent)} points. This area may need attention.`,
          confidence: 0.7,
          sessionsInvolved: sessions.slice(0, 3).map(s => s.id),
          actionable: `Consider activities that strengthen ${trait}.`
        });
      }
    });

    // 4. Session type cross-correlation
    const sessionTypes = [...new Set(sessions.map(s => s.sessionType))];
    if (sessionTypes.length > 1) {
      insights.push({
        type: 'correlation',
        title: 'Multi-Domain Insights',
        description: `You've explored ${sessionTypes.length} different counseling domains. Patterns across ${sessionTypes.join(', ')} may reveal core themes.`,
        confidence: 0.65,
        sessionsInvolved: sessions.map(s => s.id),
        actionable: 'Review sessions across domains for recurring themes.'
      });
    }

    // Store insights
    const key = this.getCrossSessionKey(userId);
    localStorage.setItem(key, JSON.stringify({
      insights,
      generatedAt: new Date().toISOString(),
      sessionCount: sessions.length,
    }));

    return insights;
  }

  // Get stored cross-session insights
  getCrossSessionInsights(userId: string): CrossSessionInsight[] {
    const key = this.getCrossSessionKey(userId);
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        return data.insights || [];
      }
    } catch {
      return [];
    }
    return [];
  }

  // Get enhanced context for AI generation using cross-session data
  getEnhancedContext(userId: string, sessionType: SessionType): string {
    const embedding = this.getUserEmbedding(userId);
    const insights = this.getCrossSessionInsights(userId);
    const sessions = sessionService.getSessions(userId).filter(s => s.sessionType === sessionType && s.result);

    let context = '';

    if (embedding) {
      context += `
USER PROFILE EMBEDDING (${embedding.sessionCount} sessions):
- Dominant Archetype(s): ${embedding.archetypeHistory.join(', ')}
- Average Trait Profile: ${embedding.traitVector.map((v, i) => 
  ['Empathy', 'Logic', 'Integrity', 'Ambition', 'Resilience', 'Social Calibration'][i] + ': ' + Math.round(v * 100)
).join(', ')}
`;
    }

    if (insights.length > 0) {
      context += `
CROSS-SESSION INSIGHTS:
${insights.slice(0, 3).map(i => `- ${i.title}: ${i.description}`).join('\n')}
`;
    }

    if (sessions.length > 1) {
      const recentResults = sessions.slice(0, 3).map(s => s.result!);
      const avgTraits = {
        empathy: recentResults.reduce((a, r) => a + r.traits.empathy, 0) / recentResults.length,
        logic: recentResults.reduce((a, r) => a + r.traits.logic, 0) / recentResults.length,
        integrity: recentResults.reduce((a, r) => a + r.traits.integrity, 0) / recentResults.length,
        ambition: recentResults.reduce((a, r) => a + r.traits.ambition, 0) / recentResults.length,
        resilience: recentResults.reduce((a, r) => a + r.traits.resilience, 0) / recentResults.length,
        social_calibration: recentResults.reduce((a, r) => a + r.traits.social_calibration, 0) / recentResults.length,
      };
      context += `
RECENT ${sessionType.toUpperCase()} SESSIONS BASELINE:
- Average traits: ${Object.entries(avgTraits).map(([k, v]) => `${k}: ${Math.round(v)}`).join(', ')}
- Common risk flags: ${[...new Set(recentResults.flatMap(r => r.riskAssessment.flags))].join(', ') || 'None'}
`;
    }

    return context;
  }
}

export const crossSessionAnalysis = new CrossSessionAnalysisService();