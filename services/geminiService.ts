
import { Answer, AnalysisResult, Question, MCQAnswer, SessionType } from "../types.ts";
import { KnowledgeBaseService } from "./knowledgeBaseService.ts";

// --- Universal Client Configuration ---

const getAPIKey = () => {
  let key = '';
  try {
    // Priority: VITE_API_KEY (Vercel/Vite standard) -> process.env.API_KEY (Define plugin) -> window override
    key = (import.meta as any).env?.VITE_API_KEY || 
          process.env.API_KEY || 
          (window as any).process?.env?.API_KEY || 
          '';
  } catch (e) { console.error(e); }
  
  // Strict trimming is crucial for copy-pasted keys
  key = key.trim();

  if (!key) throw new Error("API Key is missing. Please add VITE_API_KEY to your environment variables.");
  return key;
};

type Provider = 'google' | 'openrouter' | 'openai';

const detectProvider = (key: string): Provider => {
  if (key.startsWith('sk-or-')) return 'openrouter';
  if (key.startsWith('sk-') && !key.startsWith('sk-or-')) return 'openai';
  if (key.startsWith('AIza')) return 'google';
  return 'google'; // Default fallback
};

// Robust Model Configuration with Emergency Fallbacks
const MODELS = {
  google: {
    // Using latest stable preview models as requested, but falling back to stable 1.5 if needed
    primary: 'gemini-3-flash-preview',
    fallback: 'gemini-1.5-pro' 
  },
  openrouter: {
    // OpenRouter specific mappings
    primary: 'google/gemini-flash-1.5',
    fallback: 'google/gemini-pro-1.5',
    // Emergency model that is highly available on OpenRouter if Google upstream fails
    emergency: 'meta-llama/llama-3.1-70b-instruct'
  },
  openai: {
    primary: 'gpt-4o-mini',
    fallback: 'gpt-4o'
  }
};

const getModel = (provider: Provider, attempt: number) => {
  const models = MODELS[provider];
  if (attempt === 0) return models.primary;
  if (attempt === 1) return models.fallback;
  // OpenRouter specific emergency fallback
  if (provider === 'openrouter' && attempt >= 2 && (models as any).emergency) {
    return (models as any).emergency;
  }
  return models.fallback;
};

// --- Schema Definitions (Plain Objects) ---

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

// --- Universal Fetcher ---

const callAI = async <T>(
  prompt: string, 
  schema: any, 
  systemInstruction: string,
  attempt = 0
): Promise<T> => {
  const apiKey = getAPIKey();
  const provider = detectProvider(apiKey);
  const model = getModel(provider, attempt);

  console.log(`AI Request: Provider=${provider}, Model=${model}, Attempt=${attempt}`);

  let responseText = '';

  try {
    if (provider === 'google') {
      // Google REST API
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
        if (res.status === 404) throw new Error("MODEL_NOT_FOUND");
        const err = await res.json();
        throw new Error(err.error?.message || `Google API Error: ${res.statusText}`);
      }

      const data = await res.json();
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    } else {
      // OpenRouter / OpenAI API
      const baseUrl = provider === 'openrouter' 
        ? 'https://openrouter.ai/api/v1' 
        : 'https://api.openai.com/v1';
      
      const fullSystemPrompt = `${systemInstruction}\n\nIMPORTANT: You must respond with valid JSON that strictly follows this schema:\n${JSON.stringify(schema, null, 2)}`;

      const body: any = {
        model: model,
        messages: [
          { role: 'system', content: fullSystemPrompt },
          { role: 'user', content: prompt }
        ]
      };

      // Only add response_format for OpenAI models.
      // Explicitly excluded for OpenRouter to avoid provider conflicts unless using OpenAI models via OR.
      if (model.includes('gpt') || provider === 'openai') {
        body.response_format = { type: "json_object" };
      }

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(provider === 'openrouter' ? { 
            'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://mindpath-ai.vercel.app',
            'X-Title': 'MindPath AI'
          } : {})
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json();
        const errorMessage = err.error?.message || JSON.stringify(err);
        
        // Detect specific OpenRouter errors
        if (errorMessage.includes("No endpoints found") || res.status === 404 || res.status === 502) {
             throw new Error("MODEL_NOT_FOUND");
        }
        
        throw new Error(errorMessage || `${provider} API Error: ${res.statusText}`);
      }

      const data = await res.json();
      responseText = data.choices?.[0]?.message?.content || '';
    }

    // Parse Response
    if (!responseText) throw new Error("Empty response from AI");
    
    // Clean markdown code blocks if present (common in generic LLMs)
    const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as T;

  } catch (e: any) {
    // Universal Fallback Logic
    const isModelError = e.message === "MODEL_NOT_FOUND" || e.message.includes("Requested entity was not found");
    const canRetry = attempt < 2; // Allow up to 3 attempts (0, 1, 2)

    if (isModelError && canRetry) {
      console.warn(`Attempt ${attempt} failed with ${model}. Retrying with fallback...`);
      return callAI<T>(prompt, schema, systemInstruction, attempt + 1);
    }

    console.error(`AI Service Error (${provider} - ${model}):`, e);
    
    // User-friendly error
    if (isModelError) {
      throw new Error(`AI Provider Error: The model '${model}' is currently unavailable. Please check your API key or try again later.`);
    }
    throw new Error(`AI Request Failed: ${e.message.slice(0, 100)}...`);
  }
};

const callWithRetry = async <T>(
  fn: () => Promise<T>, 
  retries = 2, 
  delay = 1000
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    // If it's a specific API configuration error, don't blindly retry
    if (error.message.includes("API Key") || error.message.includes("Provider Error")) {
        throw error;
    }
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    } else {
      throw error;
    }
  }
};

// --- Role Logic ---

const getSpecializedRoleInstructions = (type: SessionType): string => {
  switch (type) {
    case 'medical': 
      return `You are a Senior MBBS, MD Physician. Act as a diagnostic specialist. 
      Analyze the patient's symptoms and history. 
      Provide a "Professional Diagnosis", list "Primary Precautions", and suggest "Primary Medicines" (OTC only, with clear educational disclaimers). 
      Format your tone as professional, clinical, and reassuring.`;
    case 'psychological': 
      return `You are a Senior Clinical Psychologist. 
      Analyze mental patterns, emotional regulation, and defense mechanisms. 
      Identify "Root Causes" of current distress and suggest "Therapeutic Remedies". 
      Think deeply about the subconscious drivers of the user's answers.`;
    case 'career': 
      return `You are an Executive Career Coach and Corporate Strategy Consultant. 
      Analyze the user's professional ambition, leadership style, and logic. 
      Create a "Professional Executive Plan" and a 5-step "Strategic Action Plan" for career advancement. 
      Think like a CEO evaluating a high-potential candidate.`;
    case 'relationship': 
      return `You are a Senior Relationship Consultant and Interpersonal Mediator. 
      Analyze attachment styles, conflict resolution patterns, and vulnerability. 
      Provide an "Interpersonal Health Strategy" and list modifications to their communication style. 
      Think like a mediator looking for win-win dynamics.`;
    case 'school': 
    default: 
      return `You are a School Counselor and Academic Career Advisor. 
      Think like both a mentor and a recruiter. 
      Analyze the student's learning mindset, academic potential, and social calibration. 
      Create a "Future Career Roadmap" that links their current traits to specific academic success paths.`;
  }
};

// --- Exported Methods ---

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

  const raw = await callWithRetry(() => callAI<Array<{text: string, category: string}>>(
    prompt, 
    SCHEMAS.questions, 
    role
  ));
  
  return raw.map((q, idx) => ({ id: 50 + idx, text: q.text, category: q.category, isDynamic: true }));
};

export const generateRapportQuestion = async (previousAnswers: Answer[], sessionType: SessionType): Promise<Question> => {
  const role = getSpecializedRoleInstructions(sessionType);
  const formattedQA = previousAnswers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    Generate ONE rapport-building question that encourages the patient/user to open up about their core struggle.
    Previous Context: ${formattedQA}
  `;

  const raw = await callWithRetry(() => callAI<{text: string, category: string}>(
    prompt, 
    SCHEMAS.rapport, 
    role
  ));

  return { id: 75, text: raw?.text || "How are you feeling about the process so far?", category: "rapport", isDynamic: true };
};

export const generateDeepDiveQuestions = async (previousAnswers: Answer[], sessionType: SessionType): Promise<Question[]> => {
  const role = getSpecializedRoleInstructions(sessionType);
  const formattedQA = previousAnswers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    Generate 5 "Deep Dive" questions to uncover hidden patterns or clarify potential diagnoses.
    Context: ${formattedQA}
  `;

  const raw = await callWithRetry(() => callAI<Array<{text: string, category: string}>>(
    prompt, 
    SCHEMAS.questions, 
    role
  ));

  return raw.map((q, idx) => ({ id: 100 + idx, text: q.text, category: q.category, isDynamic: true }));
};

export const analyzeStudentAnswers = async (answers: Answer[], sessionType: SessionType): Promise<AnalysisResult> => {
  const roleInstruction = getSpecializedRoleInstructions(sessionType);
  const formattedQA = answers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    Perform a complete professional analysis based on these answers:
    ${formattedQA}
  `;

  const res = await callWithRetry(() => callAI<AnalysisResult>(
    prompt, 
    SCHEMAS.analysis, 
    roleInstruction
  ));

  if (res) res.sessionType = sessionType;
  return res || {} as AnalysisResult;
};

export const generateMetaInsight = async (result: AnalysisResult, answers: Answer[]): Promise<{pattern: string, recommendation: string}> => {
  const formattedQA = answers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");
  
  const prompt = `
    Identify the core behavioral pattern from this ${result.sessionType} session and create a clinical rule.
    Answers: ${formattedQA}
  `;

  const res = await callWithRetry(() => callAI<{pattern: string, recommendation: string}>(
    prompt, 
    SCHEMAS.metaInsight, 
    "You are a Clinical Supervisor analyzing session patterns."
  ));

  return res || { pattern: "Undetermined", recommendation: "Standard protocol" };
};
