
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Answer, AnalysisResult, Question, MCQAnswer, SessionType } from "../types";

const getAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const parseResult = <T>(text: string): T | null => {
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    // Remove markdown code blocks if present
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleaned) as T;
    } catch (e2) {
        return null;
    }
  }
};

// Helper for exponential backoff retry
const callWithRetry = async <T>(
  fn: () => Promise<T>, 
  retries = 3, 
  delay = 1000
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    // Check if error is worth retrying (network issues, 500s)
    const shouldRetry = retries > 0;
    
    if (shouldRetry) {
      console.warn(`API call failed, retrying in ${delay}ms... (Retries left: ${retries})`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    } else {
      console.error("Max retries reached. Failing.");
      throw error;
    }
  }
};

const getRoleDescription = (type: SessionType): string => {
  switch (type) {
    case 'medical': return "an empathetic Medical Counselor and Patient Advocate. Your focus is on health anxiety, compliance, and somatic awareness.";
    case 'psychological': return "a Clinical Psychologist. Your focus is on emotional regulation, trauma responses, cognitive distortions, and mental resilience.";
    case 'career': return "a Strategic Career Coach and Corporate Psychologist. Your focus is on professional value, leadership potential, and workplace adaptability.";
    case 'relationship': return "a Couples Therapist and Interpersonal Relations Expert. Your focus is on attachment styles, conflict resolution, and communication patterns.";
    case 'school': default: return "a School Counselor and Developmental Psychologist. Your focus is on academic pressure, social dynamics, and adolescent development.";
  }
};

export const generatePhase1Questions = async (mcqAnswers: MCQAnswer[], sessionType: SessionType): Promise<Question[]> => {
  const ai = getAI();
  const role = getRoleDescription(sessionType);
  
  const formattedMCQ = mcqAnswers.map(a => `Context: ${a.questionText} -> Choice: ${a.selectedOption}`).join("\n");

  const prompt = `
    You are ${role}.
    The user has answered a preliminary multiple choice set regarding their ${sessionType} profile.
    Based on their choices below, generate 5 unique open-ended hypothetical questions (Phase 1) to explore their situation further.
    
    User Profile Context:
    ${formattedMCQ}

    Instructions:
    - Questions must be highly relevant to the ${sessionType} domain.
    - If they showed anxiety or negative traits, probe gently but firmly.
    - If they showed strength, test the limits of that strength.
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: "The question text." },
        category: { type: Type.STRING, description: "The category being tested." }
      },
      required: ["text", "category"]
    }
  };

  try {
    const response = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.7,
        },
      });
    });

    const rawQuestions = parseResult<Array<{text: string, category: string}>>(response.text);
    if (!rawQuestions) throw new Error("Failed to parse Phase 1 questions");

    return rawQuestions.map((q, idx) => ({
      id: 50 + idx, 
      text: q.text,
      category: q.category as any,
      isDynamic: true
    }));

  } catch (error) {
    console.error("Gemini Phase 1 Gen Error:", error);
    // Fallback static questions (Generic fallback)
    return [
       { id: 1, text: "Can you describe what brought you to this session today in more detail?", category: 'general' },
       { id: 2, text: "What is your biggest worry regarding this topic right now?", category: 'anxiety' },
       { id: 3, text: "If you could change one thing about your situation immediately, what would it be?", category: 'resolution' },
       { id: 4, text: "How do you usually handle stress related to this?", category: 'coping' },
       { id: 5, text: "What outcome are you hoping for?", category: 'goals' }
    ];
  }
};

export const generateDeepDiveQuestions = async (previousAnswers: Answer[], sessionType: SessionType): Promise<Question[]> => {
  const ai = getAI();
  const role = getRoleDescription(sessionType);

  const formattedQA = previousAnswers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    You are ${role}.
    Analyze the following Phase 1 answers. Generate 5 Phase 2 (Deep Dive) questions.
    
    Objective:
    - Drill down into specific behaviors related to ${sessionType}.
    - Ask for concrete examples.
    - Test consistency.
    
    Previous Q&A:
    ${formattedQA}
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: "The question text." },
        category: { type: Type.STRING, description: "The psychological category being tested." }
      },
      required: ["text", "category"]
    }
  };

  try {
    const response = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.7,
        },
      });
    });

    const rawQuestions = parseResult<Array<{text: string, category: string}>>(response.text);
    
    if (!rawQuestions) throw new Error("Failed to parse Deep Dive questions");

    return rawQuestions.map((q, idx) => ({
      id: 100 + idx, // Dynamic IDs start at 100
      text: q.text,
      category: q.category as any,
      isDynamic: true
    }));

  } catch (error) {
    console.error("Gemini Deep Dive Error:", error);
    return [
      { id: 999, text: "Tell me more about how this makes you feel.", category: 'exploration' },
      { id: 998, text: "What steps have you already taken to solve this?", category: 'action' }
    ];
  }
};

export const analyzeStudentAnswers = async (answers: Answer[], sessionType: SessionType): Promise<AnalysisResult> => {
  const ai = getAI();
  const role = getRoleDescription(sessionType);

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      archetype: {
        type: Type.STRING,
        description: "A 2-3 word title for the user's profile.",
      },
      archetypeDescription: {
        type: Type.STRING,
        description: "A detailed paragraph explaining why this archetype fits.",
      },
      riskAssessment: {
        type: Type.OBJECT,
        properties: {
          level: {
             type: Type.STRING,
             enum: ["Low", "Moderate", "High", "Critical"],
             description: "Risk level."
          },
          flags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of specific behavioral red flags.",
          },
          isConcern: {
            type: Type.BOOLEAN,
            description: "True if immediate professional intervention is recommended."
          },
          detailedAnalysis: {
            type: Type.STRING,
            description: "A comprehensive 3-4 sentence analysis of their risk profile."
          }
        },
        required: ["level", "flags", "isConcern", "detailedAnalysis"]
      },
      traits: {
        type: Type.OBJECT,
        description: "Score from 0 to 100 on 6 axes relevant to the session type.",
        properties: {
          empathy: { type: Type.NUMBER },
          logic: { type: Type.NUMBER },
          integrity: { type: Type.NUMBER },
          ambition: { type: Type.NUMBER },
          resilience: { type: Type.NUMBER },
          social_calibration: { type: Type.NUMBER },
        },
        required: ["empathy", "logic", "integrity", "ambition", "resilience", "social_calibration"]
      },
      careerPathSuggestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            strategicFit: { type: Type.STRING, description: "Why this fits." }
          },
          required: ["title", "description", "strategicFit"]
        },
        description: "Generate exactly 5 highly compatible suggestions. If the session is 'relationship' or 'medical', suggest 'Next Steps' or 'Life Changes' instead of Career Paths."
      },
      counselingAdvice: {
        type: Type.STRING,
        description: "A very detailed, structured growth report tailored to the specific session type."
      }
    },
    required: ["archetype", "archetypeDescription", "riskAssessment", "traits", "careerPathSuggestions", "counselingAdvice"]
  };

  const formattedQA = answers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    You are ${role}.
    Analyze the full conversation history to create a comprehensive profile for a ${sessionType} counseling session.

    CHAIN OF THOUGHT:
    1. **Identify the Core Drive**: What motivates this user in the context of ${sessionType}?
    2. **Analyze for Risks**:
       - Medical: Hypochondria, Non-compliance, Self-harm.
       - School: Bullying, Cheating, Drop-out risk.
       - Psych: Depression, Narcissism, psychosis indicators.
       - Relationship: Abuse, Co-dependency, Manipulation.
    3. **Generate Unbiased Scores** for the 6 axes (Adapt the meaning of axes to fit the context).
    4. **Detailed Risk Analysis**: Explain your reasoning.
    5. **Suggestions**: 
       - If session is School/Career: Suggest Careers.
       - If session is Medical/Psych/Relationship: Suggest "Actionable Next Steps" or "Therapeutic Focus Areas" in the careerPathSuggestions fields (Title = Step Name).
    6. **Counseling**: Provide a "Growth Counsel Report".

    User Answers:
    ${formattedQA}
  `;

  try {
    const response = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.4,
        },
      });
    });

    const result = parseResult<AnalysisResult>(response.text);
    if (!result) throw new Error("Parsed result is null or invalid JSON");
    return result;

  } catch (error) {
    console.error("Gemini API Error (Analysis):", error);
    throw new Error("Unable to analyze profile at this time. Please check your internet connection and try again.");
  }
};
