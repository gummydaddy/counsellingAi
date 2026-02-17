
import { Answer, AnalysisResult, Question, MCQAnswer, SessionType } from "../types.ts";
import { KnowledgeBaseService } from "./knowledgeBaseService.ts";

// --- Types & Interfaces ---

export type AIProvider = 'gemini' | 'openrouter' | 'openai' | 'anthropic' | 'groq';

interface AIConfig {
  apiKey: string;
  provider: AIProvider;
}

// --- Constants ---

const FALLBACK_QUESTIONS = [
  { text: "What is the main challenge you are facing right now?", category: "general" },
  { text: "How does this situation make you feel?", category: "emotional" },
  { text: "What specific outcome are you hoping for?", category: "goal" },
  { text: "Have you tried any solutions so far? If so, what?", category: "action" },
  { text: "What support do you feel you need most?", category: "needs" }
];

// --- Helper Functions ---

const cleanJson = (text: string): string => {
  if (!text) return "";
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

const ensureArray = <T>(data: any): T[] => {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  if (typeof data === 'object') {
    for (const key in data) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  return [data];
};

// --- Schema Definitions ---

const SCHEMAS = {
  questions: {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: { text: { type: "STRING" }, category: { type: "STRING" } },
      required: ["text", "category"]
    }
  },
  rapport: {
    type: "OBJECT",
    properties: { text: { type: "STRING" }, category: { type: "STRING" } },
    required: ["text", "category"]
  },
  metaInsight: {
    type: "OBJECT",
    properties: {
      pattern: { type: "STRING" },
      recommendation: { type: "STRING" }
    },
    required: ["pattern", "recommendation"]
  },
  analysis: {
    type: "OBJECT",
    properties: {
      archetype: { type: "STRING" },
      archetypeDescription: { type: "STRING" },
      riskAssessment: {
        type: "OBJECT",
        properties: {
          level: { type: "STRING" },
          flags: { type: "ARRAY", items: { type: "STRING" } },
          isConcern: { type: "BOOLEAN" },
          detailedAnalysis: { type: "STRING" }
        },
        required: ["level", "flags", "isConcern", "detailedAnalysis"]
      },
      traits: {
        type: "OBJECT",
        properties: {
          empathy: { type: "NUMBER" }, logic: { type: "NUMBER" }, integrity: { type: "NUMBER" },
          ambition: { type: "NUMBER" }, resilience: { type: "NUMBER" }, social_calibration: { type: "NUMBER" },
        },
        required: ["empathy", "logic", "integrity", "ambition", "resilience", "social_calibration"]
      },
      careerPathSuggestions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { title: { type: "STRING" }, description: { type: "STRING" }, strategicFit: { type: "STRING" } },
          required: ["title", "description", "strategicFit"]
        }
      },
      counselingAdvice: { type: "STRING" },
      professionalDiagnosis: { type: "STRING" },
      suggestedActionPlan: { type: "ARRAY", items: { type: "STRING" } },
      primaryPrecautions: { type: "ARRAY", items: { type: "STRING" } },
      suggestedMedicines: { type: "ARRAY", items: { type: "STRING" } },
      rootCauses: { type: "ARRAY", items: { type: "STRING" } },
      interpersonalStrategy: { type: "STRING" }
    },
    required: ["archetype", "archetypeDescription", "riskAssessment", "traits", "careerPathSuggestions", "counselingAdvice"]
  }
};

// --- Service Implementation ---

class AIService {
  private getKeys() {
    const env = import.meta as any;
    
    return {
      gemini: env.env?.VITE_GEMINI_API_KEY || '',
      openai: env.env?.VITE_OPENAI_API_KEY || '',
      openrouter: env.env?.VITE_OPENROUTER_API_KEY || '',
      anthropic: env.env?.VITE_ANTHROPIC_API_KEY || '',
      groq: env.env?.VITE_GROQ_API_KEY || '',
      generic: env.env?.VITE_API_KEY || ''
    };
  }

  private detectProviderFromKey(key: string): AIProvider {
    if (key.startsWith('sk-or-')) return 'openrouter';
    if (key.startsWith('sk-ant-')) return 'anthropic';
    if (key.startsWith('gsk_')) return 'groq';
    if (key.startsWith('sk-')) return 'openai';
    return 'gemini'; 
  }

  getActiveConfig(): AIConfig {
    const keys = this.getKeys();
    
    if (keys.gemini) return { apiKey: keys.gemini, provider: 'gemini' };
    if (keys.openrouter) return { apiKey: keys.openrouter, provider: 'openrouter' };
    if (keys.openai) return { apiKey: keys.openai, provider: 'openai' };
    if (keys.anthropic) return { apiKey: keys.anthropic, provider: 'anthropic' };
    if (keys.groq) return { apiKey: keys.groq, provider: 'groq' };

    const genericKey = keys.generic.trim();
    if (genericKey) {
      return { apiKey: genericKey, provider: this.detectProviderFromKey(genericKey) };
    }

    throw new Error("No API Key configured. Please set VITE_API_KEY or specific provider keys.");
  }

  async generateContent<T>(
    prompt: string, 
    schema: any, 
    systemInstruction: string,
    retryCount = 0
  ): Promise<T> {
    const { apiKey, provider } = this.getActiveConfig();
    const jsonStructure = JSON.stringify(schema, null, 2);
    const systemPrompt = `${systemInstruction}\n\nIMPORTANT: You must output ONLY valid JSON.\nTarget JSON Schema:\n${jsonStructure}`;

    try {
      let result: T;
      switch (provider) {
        case 'gemini':
          result = await this.generateGemini(apiKey, prompt, schema, systemInstruction);
          break;
        case 'openrouter':
          result = await this.generateOpenCompatible(apiKey, 'https://openrouter.ai/api/v1', 'google/gemini-flash-1.5', prompt, systemPrompt);
          break;
        case 'openai':
          result = await this.generateOpenCompatible(apiKey, 'https://api.openai.com/v1', 'gpt-4o', prompt, systemPrompt, true);
          break;
        case 'groq':
          result = await this.generateOpenCompatible(apiKey, 'https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile', prompt, systemPrompt, true);
          break;
        case 'anthropic':
          result = await this.generateAnthropic(apiKey, prompt, systemPrompt);
          break;
        default:
          throw new Error(`Provider ${provider} not supported`);
      }
      return result;
    } catch (e: any) {
      console.warn(`${provider} Generation Error (Attempt ${retryCount}):`, e);
      if (retryCount < 2) {
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1))); 
        return this.generateContent(prompt, schema, systemInstruction, retryCount + 1);
      }
      throw new Error(`AI Service Failed after retries: ${e.message}`);
    }
  }

  private async generateGemini<T>(apiKey: string, prompt: string, schema: any, systemInstruction: string): Promise<T> {
    const model = 'gemini-3-flash-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `Gemini Error: ${res.statusText}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    try {
      return JSON.parse(cleanJson(text));
    } catch (e) {
      throw new Error("Invalid JSON response from Gemini");
    }
  }

  private async generateOpenCompatible<T>(apiKey: string, baseUrl: string, model: string, prompt: string, systemPrompt: string, supportsJsonMode = false): Promise<T> {
    const body: any = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    };
    if (supportsJsonMode) body.response_format = { type: "json_object" };

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
    if (baseUrl.includes('openrouter')) {
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://mindpath.app';
      headers['X-Title'] = 'MindPath AI';
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      if (err.error?.message?.includes("No endpoints") || res.status === 404 || res.status === 502) {
          throw new Error("MODEL_NOT_FOUND");
      }
      throw new Error(err.error?.message || `${model} API Error: ${res.statusText}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    try {
      return JSON.parse(cleanJson(text));
    } catch (e) {
      throw new Error(`Invalid JSON response from ${model}`);
    }
  }

  private async generateAnthropic<T>(apiKey: string, prompt: string, systemPrompt: string): Promise<T> {
    const url = 'https://api.anthropic.com/v1/messages';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `Anthropic Error: ${res.statusText}`);
    }
    const data = await res.json();
    const text = data.content[0]?.text;
    try {
      return JSON.parse(cleanJson(text));
    } catch (e) {
      throw new Error("Invalid JSON response from Anthropic");
    }
  }
}

export const aiService = new AIService();

const getSpecializedRoleInstructions = (type: SessionType): string => {
  const roles: Record<string, string> = {
    medical: `You are a Senior MBBS, MD Physician. Act as a diagnostic specialist. Analyze symptoms/history. Provide "Professional Diagnosis", "Primary Precautions", "Primary Medicines" (OTC only). Professional, clinical tone.`,
    psychological: `You are a Senior Clinical Psychologist. Analyze mental patterns, emotional regulation, defense mechanisms. Identify "Root Causes", suggest "Therapeutic Remedies". Deep subconscious analysis.`,
    career: `You are an Executive Career Coach & Strategy Consultant. Analyze ambition, leadership, logic. Create "Professional Executive Plan", 5-step "Strategic Action Plan". Think like a CEO.`,
    relationship: `You are a Senior Relationship Consultant. Analyze attachment styles, conflict resolution, vulnerability. Provide "Interpersonal Health Strategy". Mediator mindset.`,
    school: `You are a School Counselor and Academic Career Advisor. Mentor and recruiter mindset. Analyze learning mindset, potential, social calibration. Create "Future Career Roadmap".`
  };
  return roles[type] || roles['school'];
};

export const generatePhase1Questions = async (
  mcqAnswers: MCQAnswer[] | null, 
  sessionType: SessionType,
  counselorNotes: string | null = null
): Promise<Question[]> => {
  const role = getSpecializedRoleInstructions(sessionType);
  
  // NOTE: Awaiting database call here (Production Readiness)
  const learnedContext = await KnowledgeBaseService.getLearningContext(sessionType);
  
  let contextString = counselorNotes 
    ? `EXPERT NOTES:\n${counselorNotes}` 
    : `MCQ DATA:\n${mcqAnswers?.map(a => `${a.questionText}: ${a.selectedOption}`).join("\n")}`;

  const prompt = `
    ${learnedContext}
    Generate 5 deep foundation questions for this ${sessionType} session based on the user's initial inputs.
    Current Context: ${contextString}
    Return ONLY a JSON Array of objects.
  `;

  try {
    const raw = await aiService.generateContent<any>(prompt, SCHEMAS.questions, role);
    const data = ensureArray<{text: string, category: string}>(raw);
    return data.map((q, idx) => ({ 
      id: 50 + idx, 
      text: q.text || "Follow up question...", 
      category: q.category || "general", 
      isDynamic: true 
    }));
  } catch (error) {
    console.error("Phase 1 Generation failed, using fallback:", error);
    return FALLBACK_QUESTIONS.map((q, idx) => ({
      id: 50 + idx,
      text: q.text,
      category: q.category,
      isDynamic: true
    }));
  }
};

export const generateRapportQuestion = async (previousAnswers: Answer[], sessionType: SessionType): Promise<Question> => {
  const role = getSpecializedRoleInstructions(sessionType);
  const formattedQA = previousAnswers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");
  const prompt = `Generate ONE rapport-building question. Previous Context: ${formattedQA}`;

  try {
    const raw = await aiService.generateContent<{text: string, category: string}>(prompt, SCHEMAS.rapport, role);
    return { id: 75, text: raw?.text || "How are you feeling?", category: "rapport", isDynamic: true };
  } catch (e) {
    return { id: 75, text: "How does this make you feel overall?", category: "rapport", isDynamic: true };
  }
};

export const generateDeepDiveQuestions = async (previousAnswers: Answer[], sessionType: SessionType): Promise<Question[]> => {
  const role = getSpecializedRoleInstructions(sessionType);
  const formattedQA = previousAnswers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");
  const prompt = `Generate 5 "Deep Dive" questions based on these answers. Context: ${formattedQA}`;

  try {
    const raw = await aiService.generateContent<any>(prompt, SCHEMAS.questions, role);
    const data = ensureArray<{text: string, category: string}>(raw);
    return data.map((q, idx) => ({ 
      id: 100 + idx, 
      text: q.text || "Elaborate further...", 
      category: q.category || "deep_dive", 
      isDynamic: true 
    }));
  } catch (error) {
    return FALLBACK_QUESTIONS.map((q, idx) => ({
      id: 100 + idx,
      text: "Could you tell me more about that?",
      category: "deep_dive",
      isDynamic: true
    }));
  }
};

export const analyzeStudentAnswers = async (answers: Answer[], sessionType: SessionType): Promise<AnalysisResult> => {
  const role = getSpecializedRoleInstructions(sessionType);
  const formattedQA = answers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");
  const prompt = `Perform a complete professional analysis. User Answers: ${formattedQA}`;
  const res = await aiService.generateContent<AnalysisResult>(prompt, SCHEMAS.analysis, role);
  if (res) res.sessionType = sessionType;
  return res || {} as AnalysisResult;
};

export const generateMetaInsight = async (result: AnalysisResult, answers: Answer[]): Promise<{pattern: string, recommendation: string}> => {
  const formattedQA = answers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");
  const prompt = `Identify the core behavioral pattern from this ${result.sessionType} session and create a clinical rule. Answers: ${formattedQA}`;
  const res = await aiService.generateContent<{pattern: string, recommendation: string}>(prompt, SCHEMAS.metaInsight, "You are a Clinical Supervisor analyzing session patterns.");
  return res || { pattern: "Undetermined", recommendation: "Standard protocol" };
};
