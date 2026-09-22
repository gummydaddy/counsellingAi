
import { Answer, AnalysisResult, Question, MCQAnswer, SessionType } from "../types.ts";
import { KnowledgeBaseService } from "./knowledgeBaseService.ts";

// --- Types & Interfaces ---

export type AIProvider = 'gemini' | 'openrouter' | 'openai' | 'anthropic' | 'groq' | 'kira';

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

const COMPACT_SCHEMAS = {
  questions: `[{ text: string, category: string }]`,
  rapport: `{ text: string, category: string }`,
  metaInsight: `{ pattern: string, recommendation: string }`,
  analysis: `{
    archetype: string,
    archetypeDescription: string,
    riskAssessment: { level: "low|medium|high", flags: string[], isConcern: boolean, detailedAnalysis: string },
    traits: { empathy: 0-100, logic: 0-100, integrity: 0-100, ambition: 0-100, resilience: 0-100, social_calibration: 0-100 },
    careerPathSuggestions: [{ title: string, description: string, strategicFit: string }],
    counselingAdvice: string,
    professionalDiagnosis: string,
    suggestedActionPlan: string[],
    primaryPrecautions: string[],
    suggestedMedicines: string[],
    rootCauses: string[],
    interpersonalStrategy: string
  }`
};

// Legacy schemas for Gemini native responseSchema (kept for compatibility)
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
  private systemPromptCache = new Map<string, string>();
  private readonly MAX_CONTEXT_TOKENS = 1500;

  private getKeys() {
    const env = (import.meta as any).env || {};
    const processEnv = (window as any).process?.env || {};

    return {
      gemini: env.VITE_GEMINI_API_KEY || processEnv.GEMINI_API_KEY || '',
      openai: env.VITE_OPENAI_API_KEY || processEnv.OPENAI_API_KEY || '',
      openrouter: env.VITE_OPENROUTER_API_KEY || processEnv.OPENROUTER_API_KEY || '',
      anthropic: env.VITE_ANTHROPIC_API_KEY || processEnv.ANTHROPIC_API_KEY || '',
      groq: env.VITE_GROQ_API_KEY || processEnv.GROQ_API_KEY || '',
      kira: env.VITE_KIRA_API_KEY || processEnv.KIRA_API_KEY || 'kira-2.0',
      kiraModel: env.VITE_KIRA_MODEL || processEnv.KIRA_MODEL || 'kira-mini-1.0',
      generic: env.VITE_API_KEY || processEnv.API_KEY || ''
    };
  }

  private detectProviderFromKey(key: string): AIProvider {
    if (key.startsWith('sk-or-')) return 'openrouter';
    if (key.startsWith('sk-ant-')) return 'anthropic';
    if (key.startsWith('gsk_')) return 'groq';
    if (key.startsWith('sk-')) return 'openai';
    if (key.startsWith('kira_')) return 'kira';
    return 'gemini';
  }

  getActiveConfig(): AIConfig {
    const keys = this.getKeys();

    if (keys.gemini) return { apiKey: keys.gemini, provider: 'gemini' };
    if (keys.openrouter) return { apiKey: keys.openrouter, provider: 'openrouter' };
    if (keys.openai) return { apiKey: keys.openai, provider: 'openai' };
    if (keys.anthropic) return { apiKey: keys.anthropic, provider: 'anthropic' };
    if (keys.groq) return { apiKey: keys.groq, provider: 'groq' };
    if (keys.kira) return { apiKey: keys.kira, provider: 'kira' };

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
    retryCount = 0,
    schemaKey?: keyof typeof COMPACT_SCHEMAS
  ): Promise<T> {
    const { apiKey, provider } = this.getActiveConfig();
    
    // Use compact schema for non-Gemini providers (Gemini uses native responseSchema)
    const useCompactSchema = provider !== 'gemini';
    const compactSchema = schemaKey && COMPACT_SCHEMAS[schemaKey];
    const jsonStructure = useCompactSchema && compactSchema 
      ? compactSchema 
      : JSON.stringify(schema, null, 2);

    // Max tokens per task type to limit output
    const maxTokensMap: Record<string, number> = {
      'questions': 800,
      'rapport': 300,
      'metaInsight': 500,
      'analysis': 3000
    };
    const maxTokens = schemaKey ? maxTokensMap[schemaKey] : 2000;

    // Cache system prompt per session type + schema
    const cacheKey = `${systemInstruction.slice(0, 50)}:${schemaKey || 'unknown'}`;
    let systemPrompt = this.systemPromptCache.get(cacheKey);
    if (!systemPrompt) {
      systemPrompt = `${systemInstruction}\n\nIMPORTANT: You must output ONLY valid JSON.\nTarget JSON Schema:\n${jsonStructure}`;
      this.systemPromptCache.set(cacheKey, systemPrompt);
    }

    try {
      let result: T;
      switch (provider) {
        case 'gemini':
          result = await this.generateGemini(apiKey, prompt, schema, systemInstruction);
          break;
        case 'openrouter':
          result = await this.generateOpenCompatible(apiKey, 'https://openrouter.ai/api/v1', 'google/gemini-flash-1.5', prompt, systemPrompt, true, maxTokens);
          break;
        case 'openai':
          result = await this.generateOpenCompatible(apiKey, 'https://api.openai.com/v1', 'gpt-4o', prompt, systemPrompt, true, maxTokens);
          break;
        case 'groq':
          result = await this.generateOpenCompatible(apiKey, 'https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile', prompt, systemPrompt, true, maxTokens);
          break;
        case 'anthropic':
          result = await this.generateAnthropic(apiKey, prompt, systemPrompt, maxTokens);
          break;
        case 'kira':
          result = await this.generateKira(apiKey, prompt, schema, systemPrompt, maxTokens);
          break;
        default:
          throw new Error(`Provider ${provider} not supported`);
      }
      return result;
    } catch (e: any) {
      console.warn(`${provider} Generation Error (Attempt ${retryCount}):`, e);
      if (retryCount < 2) {
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return this.generateContent(prompt, schema, systemInstruction, retryCount + 1, schemaKey);
      }
      throw new Error(`AI Service Failed after retries: ${e.message}`);
    }
  }

  // Summarize QA history to fit within token budget
  // Summarize QA history to fit within token budget
  public summarizeQA(answers: Answer[]): string {
    const full = answers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");
    const estTokens = Math.ceil(full.length / 4); // rough estimate
    
    if (estTokens <= this.MAX_CONTEXT_TOKENS) return full;
    
    // Keep first 2 and last 3, summarize middle
    const keepFirst = 2;
    const keepLast = 3;
    const middle = answers.slice(keepFirst, -keepLast);
    
    let result = answers.slice(0, keepFirst).map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");
    
    if (middle.length > 0) {
      const themes = this.extractThemes(middle);
      result += `\n[${middle.length} responses summarized: ${themes}]\n\n`;
    }
    
    result += answers.slice(-keepLast).map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");
    return result;
  }

  private extractThemes(answers: Answer[]): string {
    // Simple theme extraction from question text keywords
    const texts = answers.map(a => a.questionText.toLowerCase()).join(" ");
    const themes: string[] = [];
    if (texts.includes("feel") || texts.includes("emotion")) themes.push("emotional");
    if (texts.includes("goal") || texts.includes("want") || texts.includes("hope")) themes.push("goals");
    if (texts.includes("challenge") || texts.includes("problem") || texts.includes("difficult")) themes.push("challenges");
    if (texts.includes("relationship") || texts.includes("partner") || texts.includes("friend")) themes.push("relationships");
    if (texts.includes("career") || texts.includes("job") || texts.includes("work")) themes.push("career");
    if (texts.includes("health") || texts.includes("medical") || texts.includes("symptom")) themes.push("health");
    return themes.length > 0 ? themes.join(", ") : "various topics";
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

  private async generateOpenCompatible<T>(apiKey: string, baseUrl: string, model: string, prompt: string, systemPrompt: string, supportsJsonMode = false, maxTokens = 2000): Promise<T> {
    const body: any = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: maxTokens
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

  private async generateAnthropic<T>(apiKey: string, prompt: string, systemPrompt: string, maxTokens = 4000): Promise<T> {
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
        max_tokens: maxTokens,
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

  private async generateKira<T>(apiKey: string, prompt: string, schema: any, systemPrompt: string, maxTokens = 2000): Promise<T> {
    // Kira AI API - keys start with kira_
    // Uses OpenAI-compatible API at https://kiraai.vn/api/v1
    // Available models (set via VITE_KIRA_MODEL):
    // - glm-5.3-flash (default)
    // - glm-5.3
    // - qwen3.8-flash
    // - deepseek-v4-flash-vision-exp
    // - deepseek-v4-flash-free
    // - kira-mini-1.0 (Context 1M)
    // - kira-2.0 (Context 1M)
    // - hy3128K (Context 128K)
    // - mimo-v2.5 (Context 128K)
    // - minimax-3m-free (Context 1M)
    let model = this.getKeys().kiraModel;
    // Safeguard: if model looks like an API key (starts with kira_), use default
    if (model.startsWith('kira_')) {
      console.warn('Kira model env var not set correctly, using default: kira-mini-1.0');
      model = 'kira-mini-1.0';
    }
    const baseUrl = 'https://kiraai.vn/api/v1';

    const body = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: maxTokens,
      response_format: { type: "json_object" }
    };

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `Kira Error: ${res.statusText}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    try {
      return JSON.parse(cleanJson(text));
    } catch (e) {
      throw new Error("Invalid JSON response from Kira");
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
    const raw = await aiService.generateContent<any>(prompt, SCHEMAS.questions, role, 0, 'questions');
    const data = ensureArray<{ text: string, category: string }>(raw);
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
  const formattedQA = aiService.summarizeQA(previousAnswers);
  const prompt = `Generate ONE rapport-building question. Previous Context: ${formattedQA}`;

  try {
    const raw = await aiService.generateContent<{ text: string, category: string }>(prompt, SCHEMAS.rapport, role, 0, 'rapport');
    return { id: 75, text: raw?.text || "How are you feeling?", category: "rapport", isDynamic: true };
  } catch (e) {
    return { id: 75, text: "How does this make you feel overall?", category: "rapport", isDynamic: true };
  }
};

export const generateDeepDiveQuestions = async (previousAnswers: Answer[], sessionType: SessionType): Promise<Question[]> => {
  const role = getSpecializedRoleInstructions(sessionType);
  const formattedQA = aiService.summarizeQA(previousAnswers);
  const prompt = `Generate 5 "Deep Dive" questions based on these answers. Context: ${formattedQA}`;

  try {
    const raw = await aiService.generateContent<any>(prompt, SCHEMAS.questions, role, 0, 'questions');
    const data = ensureArray<{ text: string, category: string }>(raw);
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
  const formattedQA = aiService.summarizeQA(answers);
  const prompt = `Perform a complete professional analysis. User Answers: ${formattedQA}`;
  const res = await aiService.generateContent<AnalysisResult>(prompt, SCHEMAS.analysis, role, 0, 'analysis');
  if (res) res.sessionType = sessionType;
  return res || {} as AnalysisResult;
};

export const generateMetaInsight = async (result: AnalysisResult, answers: Answer[]): Promise<{ pattern: string, recommendation: string }> => {
  const formattedQA = aiService.summarizeQA(answers);
  const prompt = `Identify the core behavioral pattern from this ${result.sessionType} session and create a clinical rule. Answers: ${formattedQA}`;
  const res = await aiService.generateContent<{ pattern: string, recommendation: string }>(prompt, SCHEMAS.metaInsight, "You are a Clinical Supervisor analyzing session patterns.", 0, 'metaInsight');
  return res || { pattern: "Undetermined", recommendation: "Standard protocol" };
};
