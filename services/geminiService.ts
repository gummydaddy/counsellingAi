
import { Answer, AnalysisResult, Question, MCQAnswer, SessionType } from "../types.ts";
import { KnowledgeBaseService } from "./knowledgeBaseService.ts";

// --- Types & Interfaces ---

export type AIProvider = 'gemini' | 'openrouter' | 'openai' | 'anthropic' | 'groq';

interface AIConfig {
  apiKey: string;
  provider: AIProvider;
}

// --- Service Implementation ---

class AIService {
  private getKeys() {
    // Priority: Specific Env Vars -> Generic VITE_API_KEY with auto-detection
    const env = (import.meta as any).env || {};
    const processEnv = (window as any).process?.env || {};
    
    return {
      gemini: env.VITE_GEMINI_API_KEY || processEnv.GEMINI_API_KEY || '',
      openai: env.VITE_OPENAI_API_KEY || processEnv.OPENAI_API_KEY || '',
      openrouter: env.VITE_OPENROUTER_API_KEY || processEnv.OPENROUTER_API_KEY || '',
      anthropic: env.VITE_ANTHROPIC_API_KEY || processEnv.ANTHROPIC_API_KEY || '',
      groq: env.VITE_GROQ_API_KEY || processEnv.GROQ_API_KEY || '',
      generic: env.VITE_API_KEY || processEnv.API_KEY || ''
    };
  }

  private detectProviderFromKey(key: string): AIProvider {
    if (key.startsWith('sk-or-')) return 'openrouter';
    if (key.startsWith('sk-ant-')) return 'anthropic';
    if (key.startsWith('gsk_')) return 'groq';
    if (key.startsWith('sk-')) return 'openai';
    return 'gemini'; // Default fallback for AIza...
  }

  getActiveConfig(): AIConfig {
    const keys = this.getKeys();
    
    // 1. Check specific keys first
    if (keys.gemini) return { apiKey: keys.gemini, provider: 'gemini' };
    if (keys.openrouter) return { apiKey: keys.openrouter, provider: 'openrouter' };
    if (keys.openai) return { apiKey: keys.openai, provider: 'openai' };
    if (keys.anthropic) return { apiKey: keys.anthropic, provider: 'anthropic' };
    if (keys.groq) return { apiKey: keys.groq, provider: 'groq' };

    // 2. Fallback to generic key
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
    const systemPrompt = `${systemInstruction}\n\nCRITICAL: Output MUST be valid JSON strictly following this schema:\n${JSON.stringify(schema, null, 2)}`;

    try {
      switch (provider) {
        case 'gemini':
          return await this.generateGemini(apiKey, prompt, schema, systemInstruction);
        case 'openrouter':
          return await this.generateOpenCompatible(apiKey, 'https://openrouter.ai/api/v1', 'google/gemini-flash-1.5', prompt, systemPrompt);
        case 'openai':
          return await this.generateOpenCompatible(apiKey, 'https://api.openai.com/v1', 'gpt-4o', prompt, systemPrompt, true);
        case 'groq':
          return await this.generateOpenCompatible(apiKey, 'https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile', prompt, systemPrompt, true);
        case 'anthropic':
          return await this.generateAnthropic(apiKey, prompt, systemPrompt);
        default:
          throw new Error(`Provider ${provider} not supported`);
      }
    } catch (e: any) {
      console.error(`${provider} Generation Error (Attempt ${retryCount}):`, e);
      
      // Retry Logic
      if (retryCount < 2) {
        // Simple exponential backoff
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return this.generateContent(prompt, schema, systemInstruction, retryCount + 1);
      }

      // Fallback Logic if primary provider fails (and generic key was used)
      // Note: If using specific keys, we don't automatically switch providers to avoid billing surprises, 
      // but in a unified key scenario, we could.
      
      throw new Error(`AI Service Failed: ${e.message}`);
    }
  }

  // --- Provider Implementations ---

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
      throw new Error(err.error?.message || res.statusText);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return this.parseJSON(text);
  }

  private async generateOpenCompatible<T>(
    apiKey: string, 
    baseUrl: string, 
    model: string, 
    prompt: string, 
    systemPrompt: string,
    supportsJsonMode = false
  ): Promise<T> {
    const body: any = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    };

    if (supportsJsonMode) {
      body.response_format = { type: "json_object" };
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    if (baseUrl.includes('openrouter')) {
      headers['HTTP-Referer'] = 'https://mindpath-ai.vercel.app';
      headers['X-Title'] = 'MindPath AI';
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || res.statusText);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    return this.parseJSON(text);
  }

  private async generateAnthropic<T>(apiKey: string, prompt: string, systemPrompt: string): Promise<T> {
    const url = 'https://api.anthropic.com/v1/messages';
    
    // Note: This often fails in client-side only apps due to CORS. 
    // It works if using a proxy or if Anthropic enables CORS for specific origins.
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'dangerously-allow-browser': 'true' // strictly for dev/demo
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
      throw new Error(err.error?.message || res.statusText);
    }

    const data = await res.json();
    const text = data.content[0]?.text;
    return this.parseJSON(text);
  }

  private parseJSON(text: string): any {
    if (!text) throw new Error("Empty response from AI");
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

// Instantiate Singleton
export const aiService = new AIService();

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

// --- Legacy Exported Functions (Delegators) ---
// These ensure the rest of the app doesn't break while using the new Class-based Service

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
  const learnedContext = KnowledgeBaseService.getLearningContext(sessionType);
  
  let contextString = counselorNotes 
    ? `EXPERT NOTES:\n${counselorNotes}` 
    : `MCQ DATA:\n${mcqAnswers?.map(a => `${a.questionText}: ${a.selectedOption}`).join("\n")}`;

  const prompt = `
    ${learnedContext}
    Generate 5 deep foundation questions for this ${sessionType} session.
    Current Context: ${contextString}
  `;

  const raw = await aiService.generateContent<Array<{text: string, category: string}>>(
    prompt, 
    SCHEMAS.questions, 
    role
  );
  
  return raw.map((q, idx) => ({ id: 50 + idx, text: q.text, category: q.category, isDynamic: true }));
};

export const generateRapportQuestion = async (previousAnswers: Answer[], sessionType: SessionType): Promise<Question> => {
  const role = getSpecializedRoleInstructions(sessionType);
  const formattedQA = previousAnswers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    Generate ONE rapport-building question that encourages the patient/user to open up about their core struggle.
    Previous Context: ${formattedQA}
  `;

  const raw = await aiService.generateContent<{text: string, category: string}>(
    prompt, 
    SCHEMAS.rapport, 
    role
  );

  return { id: 75, text: raw?.text || "How are you feeling?", category: "rapport", isDynamic: true };
};

export const generateDeepDiveQuestions = async (previousAnswers: Answer[], sessionType: SessionType): Promise<Question[]> => {
  const role = getSpecializedRoleInstructions(sessionType);
  const formattedQA = previousAnswers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    Generate 5 "Deep Dive" questions to uncover hidden patterns or clarify potential diagnoses.
    Context: ${formattedQA}
  `;

  const raw = await aiService.generateContent<Array<{text: string, category: string}>>(
    prompt, 
    SCHEMAS.questions, 
    role
  );

  return raw.map((q, idx) => ({ id: 100 + idx, text: q.text, category: q.category, isDynamic: true }));
};

export const analyzeStudentAnswers = async (answers: Answer[], sessionType: SessionType): Promise<AnalysisResult> => {
  const role = getSpecializedRoleInstructions(sessionType);
  const formattedQA = answers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    Perform a complete professional analysis based on these answers:
    ${formattedQA}
  `;

  const res = await aiService.generateContent<AnalysisResult>(
    prompt, 
    SCHEMAS.analysis, 
    role
  );

  if (res) res.sessionType = sessionType;
  return res || {} as AnalysisResult;
};

export const generateMetaInsight = async (result: AnalysisResult, answers: Answer[]): Promise<{pattern: string, recommendation: string}> => {
  const formattedQA = answers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");
  
  const prompt = `
    Identify the core behavioral pattern from this ${result.sessionType} session and create a clinical rule.
    Answers: ${formattedQA}
  `;

  const res = await aiService.generateContent<{pattern: string, recommendation: string}>(
    prompt, 
    SCHEMAS.metaInsight, 
    "You are a Clinical Supervisor analyzing session patterns."
  );

  return res || { pattern: "Undetermined", recommendation: "Standard protocol" };
};
