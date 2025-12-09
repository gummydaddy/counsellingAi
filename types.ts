export interface Question {
  id: number;
  text: string;
  category: 'ethics' | 'logic' | 'empathy' | 'resilience' | 'ambition' | 'leadership';
}

export interface Answer {
  questionId: number;
  questionText: string;
  userResponse: string;
}

export interface TraitScore {
  trait: string;
  score: number; // 0-100
  fullMark: number;
}

export interface AnalysisResult {
  archetype: string;
  archetypeDescription: string;
  riskAssessment: {
    level: 'Low' | 'Moderate' | 'High' | 'Critical';
    flags: string[];
    isConcern: boolean;
  };
  traits: {
    empathy: number;
    logic: number;
    leadership: number;
    aggression: number;
    integrity: number;
  };
  careerPathSuggestions: Array<{
    title: string;
    description: string;
  }>;
  counselingAdvice: string;
}

export enum AppStep {
  WELCOME,
  ASSESSMENT,
  ANALYZING,
  RESULTS,
  ERROR
}