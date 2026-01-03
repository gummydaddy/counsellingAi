
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Answer, AnalysisResult, Question, MCQAnswer, SessionType } from "../types";
import { KnowledgeBaseService } from "./knowledgeBaseService";

const getAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const parseResult = <T>(text: string | undefined): T | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleaned) as T;
    } catch (e2) {
        return null;
    }
  }
};

const callWithRetry = async <T>(
  fn: () => Promise<T>, 
  retries = 3, 
  delay = 1000
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    } else {
      throw error;
    }
  }
};

const getRoleDescription = (type: SessionType): string => {
  switch (type) {
    case 'medical': return "an empathetic Medical Counselor and Patient Advocate.";
    case 'psychological': return "a Clinical Psychologist expert in diagnostic patterns.";
    case 'career': return "a Strategic Career Coach and Corporate Psychologist.";
    case 'relationship': return "a Couples Therapist and Interpersonal Relations Expert.";
    case 'school': default: return "a School Counselor and Developmental Psychologist.";
  }
};

export const generatePhase1Questions = async (
  mcqAnswers: MCQAnswer[] | null, 
  sessionType: SessionType,
  counselorNotes: string | null = null
): Promise<Question[]> => {
  const ai = getAI();
  const role = getRoleDescription(sessionType);
  const learnedContext = KnowledgeBaseService.getLearningContext(sessionType);
  
  let contextString = counselorNotes 
    ? `EXPERT NOTES:\n${counselorNotes}` 
    : `MCQ DATA:\n${mcqAnswers?.map(a => a.selectedOption).join(", ")}`;

  const prompt = `
    ${learnedContext}
    You are ${role}. Generate 5 professional Foundation Questions for a ${sessionType} session. 
    Base them on: ${contextString}
  `;

  try {
    const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { 
        responseMimeType: "application/json", 
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { text: { type: Type.STRING }, category: { type: Type.STRING } },
            required: ["text", "category"]
          }
        }, 
        temperature: 0.7 
      }
    }));
    const raw = parseResult<Array<{text: string, category: string}>>(response.text);
    return raw?.map((q, idx) => ({ id: 50 + idx, text: q.text, category: q.category, isDynamic: true })) || [];
  } catch (e) {
    return [{ id: 1, text: "Can you share what specifically led you to seek a session today?", category: "intro" }];
  }
};

export const generateRapportQuestion = async (previousAnswers: Answer[], sessionType: SessionType): Promise<Question> => {
  const ai = getAI();
  const role = getRoleDescription(sessionType);
  const formattedQA = previousAnswers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    You are ${role}. 
    This is the PATIENT ANSWERING PHASE. Generate ONE strategic rapport builder question.
    Use past clinical experience if available to address common defenses.
    Previous Context: ${formattedQA}
  `;

  try {
    const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { 
        responseMimeType: "application/json", 
        responseSchema: {
          type: Type.OBJECT,
          properties: { text: { type: Type.STRING }, category: { type: Type.STRING } },
          required: ["text", "category"]
        }, 
        temperature: 0.9 
      }
    }));
    const raw = parseResult<{text: string, category: string}>(response.text);
    return { id: 75, text: raw?.text || "What else would you like to share about your experience?", category: "rapport", isDynamic: true };
  } catch (e) {
    return { id: 75, text: "In your own words, how would you describe your ideal outcome for this situation?", category: "rapport", isDynamic: true };
  }
};

export const generateDeepDiveQuestions = async (previousAnswers: Answer[], sessionType: SessionType): Promise<Question[]> => {
  const ai = getAI();
  const role = getRoleDescription(sessionType);
  const learnedContext = KnowledgeBaseService.getLearningContext(sessionType);
  const formattedQA = previousAnswers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    ${learnedContext}
    You are ${role}. Generate 5 Deep Dive Questions investigating behavioral markers for ${sessionType}.
    Context: ${formattedQA}
  `;

  try {
    const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { 
        responseMimeType: "application/json", 
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { text: { type: Type.STRING }, category: { type: Type.STRING } },
            required: ["text", "category"]
          }
        }, 
        temperature: 0.7 
      }
    }));
    const raw = parseResult<Array<{text: string, category: string}>>(response.text);
    return raw?.map((q, idx) => ({ id: 100 + idx, text: q.text, category: q.category, isDynamic: true })) || [];
  } catch (e) {
    return [{ id: 99, text: "Could you expand on your last point with a specific example?", category: "deep_dive" }];
  }
};

export const analyzeStudentAnswers = async (answers: Answer[], sessionType: SessionType): Promise<AnalysisResult> => {
  const ai = getAI();
  const role = getRoleDescription(sessionType);
  const learnedContext = KnowledgeBaseService.getLearningContext(sessionType);
  const formattedQA = answers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    ${learnedContext}
    You are ${role}. Perform a multidimensional clinical analysis for a ${sessionType} session.
    Context:
    ${formattedQA}
  `;

  try {
    const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: { 
        responseMimeType: "application/json", 
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            archetype: { type: Type.STRING },
            archetypeDescription: { type: Type.STRING },
            riskAssessment: {
              type: Type.OBJECT,
              properties: {
                level: { type: Type.STRING },
                flags: { type: Type.ARRAY, items: { type: Type.STRING } },
                isConcern: { type: Type.BOOLEAN },
                detailedAnalysis: { type: Type.STRING }
              },
              required: ["level", "flags", "isConcern", "detailedAnalysis"]
            },
            traits: {
              type: Type.OBJECT,
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
                properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, strategicFit: { type: Type.STRING } },
                required: ["title", "description", "strategicFit"]
              }
            },
            counselingAdvice: { type: Type.STRING }
          },
          required: ["archetype", "archetypeDescription", "riskAssessment", "traits", "careerPathSuggestions", "counselingAdvice"]
        }, 
        temperature: 0.4 
      }
    }));
    const res = parseResult<AnalysisResult>(response.text);
    if (res) res.sessionType = sessionType;
    return res || {} as AnalysisResult;
  } catch (e) {
    throw new Error("Analysis failed.");
  }
};

/**
 * LEARNING LOOP: Generates a meta-insight from the session to grow the AI's intelligence.
 */
export const generateMetaInsight = async (result: AnalysisResult, answers: Answer[]): Promise<{pattern: string, recommendation: string}> => {
  const ai = getAI();
  const formattedQA = answers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");
  
  const prompt = `
    Analyze this counseling session. 
    Session Type: ${result.sessionType}
    Summary: ${result.archetype} - ${result.archetypeDescription}
    Answers: ${formattedQA}
    
    TASK: Generate a single "Global Clinical Rule" for future AI training. 
    Identify the core behavioral pattern seen here and provide a recommendation for how an AI should handle similar profiles in the future.
  `;

  try {
    const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pattern: { type: Type.STRING, description: "A high-level summary of the behavioral markers observed." },
            recommendation: { type: Type.STRING, description: "A clinical rule for future AI analysis." }
          },
          required: ["pattern", "recommendation"]
        }
      }
    }));
    return parseResult<{pattern: string, recommendation: string}>(response.text) || { pattern: "Undetermined", recommendation: "Standard protocol" };
  } catch (e) {
    return { pattern: "Undetermined", recommendation: "Standard protocol" };
  }
};
