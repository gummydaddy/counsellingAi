
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
    const shouldRetry = retries > 0;
    if (shouldRetry) {
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
  
  let contextString = "";
  if (counselorNotes) {
    contextString = `EXISTING PROFESSIONAL NOTES:\n${counselorNotes}\n\nINSTRUCTION: Analyze these expert notes and generate 5 follow-up questions to validate or expand on these findings.`;
  } else if (mcqAnswers) {
    const formattedMCQ = mcqAnswers.map(a => `Context: ${a.questionText} -> Choice: ${a.selectedOption}`).join("\n");
    contextString = `PRELIMINARY USER CHOICES:\n${formattedMCQ}\n\nINSTRUCTION: Based on these high-level choices, generate 5 open-ended hypothetical questions.`;
  }

  const prompt = `
    You are ${role}.
    ${contextString}

    DOMAIN: ${sessionType} counseling.
    
    GUIDELINES:
    - Questions must be professional and probing.
    - If professional notes are provided, be highly specific to the case details mentioned.
    - If notes mention a specific risk, ask a question that tests that risk safely.
    - If no notes are provided, use the user's preliminary choices to gauge their baseline.
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        category: { type: Type.STRING }
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
      category: q.category,
      isDynamic: true
    }));

  } catch (error) {
    console.error("GenAI Phase 1 Error:", error);
    return [
       { id: 1, text: "Can you describe what brought you to this session today in more detail?", category: 'general' },
       { id: 2, text: "What is your biggest worry regarding this topic right now?", category: 'anxiety' },
       { id: 3, text: "How do you usually handle stress related to this?", category: 'coping' },
       { id: 4, text: "What outcome are you hoping for?", category: 'goals' },
       { id: 5, text: "Is there anything specific you think I should know?", category: 'open' }
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
    DRILL DOWN into specific contradictions or emotional spikes found in these responses.
    
    Previous Q&A:
    ${formattedQA}
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        category: { type: Type.STRING }
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
      id: 100 + idx,
      text: q.text,
      category: q.category,
      isDynamic: true
    }));

  } catch (error) {
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
      archetype: { type: Type.STRING },
      archetypeDescription: { type: Type.STRING },
      riskAssessment: {
        type: Type.OBJECT,
        properties: {
          level: { type: Type.STRING, enum: ["Low", "Moderate", "High", "Critical"] },
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
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            strategicFit: { type: Type.STRING }
          },
          required: ["title", "description", "strategicFit"]
        }
      },
      counselingAdvice: { type: Type.STRING }
    },
    required: ["archetype", "archetypeDescription", "riskAssessment", "traits", "careerPathSuggestions", "counselingAdvice"]
  };

  const formattedQA = answers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    You are ${role}.
    Analyze the full session history to create a profile.
    
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
    if (!result) throw new Error("Parsed result is invalid");
    return result;
  } catch (error) {
    throw new Error("Unable to analyze profile at this time.");
  }
};
