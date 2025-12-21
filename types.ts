
export type SessionType = 'school' | 'medical' | 'psychological' | 'career' | 'relationship';

export interface Question {
  id: number;
  text: string;
  category: string;
  isDynamic?: boolean;
}

export interface Answer {
  questionId: number;
  questionText: string;
  userResponse: string;
}

export interface MCQOption {
  value: string;
  label: string;
}

export interface MCQQuestion {
  id: number;
  text: string;
  options: MCQOption[];
  category: string;
}

export interface MCQAnswer {
  questionId: number;
  questionText: string;
  selectedOption: string;
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
    detailedAnalysis: string;
  };
  traits: {
    empathy: number;
    logic: number;
    integrity: number;
    ambition: number;
    resilience: number;
    social_calibration: number;
  };
  careerPathSuggestions: Array<{
    title: string;
    description: string;
    strategicFit: string;
  }>;
  counselingAdvice: string;
}

export enum AppStep {
  WELCOME,
  SESSION_SELECTION,
  MCQ_PHASE,
  GENERATING_PHASE1,
  ASSESSMENT,
  ANALYZING,
  RESULTS,
  ERROR
}

export enum AssessmentPhase {
  INITIAL,
  GENERATING_DEEP_DIVE,
  DEEP_DIVE
}
