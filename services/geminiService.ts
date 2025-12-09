import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Answer, AnalysisResult, Question } from "../types";

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
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '');
    try {
        return JSON.parse(cleaned) as T;
    } catch (e2) {
        return null;
    }
  }
};

export const generateDeepDiveQuestions = async (previousAnswers: Answer[]): Promise<Question[]> => {
  const ai = getAI();

  const formattedQA = previousAnswers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    You are a forensic psychologist and career profiler. 
    Analyze the following student answers. Your goal is to generate 5 NEW, personalized, and deeper psychological questions.
    
    Objective:
    - If the user shows signs of aggression or manipulation, ask questions that test their boundaries, remorse, or patience.
    - If the user shows signs of high intelligence or empathy, ask questions that test their resilience, ability to make hard choices, or leadership under pressure.
    - Do not ask repetitive questions. Dig deeper. Challenge their stated views.
    - The questions should be hypothetical scenarios or "what if" situations.

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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7, // Higher temperature for creativity in questions
      },
    });

    const rawQuestions = parseResult<Array<{text: string, category: string}>>(response.text);
    
    if (!rawQuestions) throw new Error("Failed to generate questions");

    return rawQuestions.map((q, idx) => ({
      id: 100 + idx, // Dynamic IDs start at 100
      text: q.text,
      category: q.category as any,
      isDynamic: true
    }));

  } catch (error) {
    console.error("Gemini Deep Dive Error:", error);
    // Fallback questions if API fails
    return [
      { id: 999, text: "Describe a time you had to deal with a major failure. Who did you blame?", category: 'resilience' },
      { id: 998, text: "If you could control one person's actions for a day, who would it be and what would you make them do?", category: 'social_calibration' }
    ];
  }
};

export const analyzeStudentAnswers = async (answers: Answer[]): Promise<AnalysisResult> => {
  const ai = getAI();

  // Define the strict response schema to ensure structured data
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      archetype: {
        type: Type.STRING,
        description: "A 2-3 word title for the student's mindset (e.g., 'The Empathetic Healer', 'The Machiavellian Tactician', 'The Visionary Builder').",
      },
      archetypeDescription: {
        type: Type.STRING,
        description: "A detailed paragraph explaining why this archetype fits based on the answers.",
      },
      riskAssessment: {
        type: Type.OBJECT,
        properties: {
          level: {
             type: Type.STRING,
             enum: ["Low", "Moderate", "High", "Critical"],
             description: "Risk level for anti-social, violent, or predatory behavior."
          },
          flags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of specific behavioral red flags found in answers.",
          },
          isConcern: {
            type: Type.BOOLEAN,
            description: "True if immediate counseling is recommended."
          }
        },
        required: ["level", "flags", "isConcern"]
      },
      traits: {
        type: Type.OBJECT,
        description: "Score from 0 to 100 for the 6 core dimensions.",
        properties: {
          empathy: { type: Type.NUMBER, description: "Ability to feel for others" },
          logic: { type: Type.NUMBER, description: "Analytical and systemizing ability" },
          integrity: { type: Type.NUMBER, description: "Adherence to ethical principles" },
          ambition: { type: Type.NUMBER, description: "Drive for status and success" },
          resilience: { type: Type.NUMBER, description: "Emotional stability and grit" },
          social_calibration: { type: Type.NUMBER, description: "Charm, social intelligence, and adaptability" },
        },
        required: ["empathy", "logic", "integrity", "ambition", "resilience", "social_calibration"]
      },
      careerPathSuggestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING }
          }
        },
        description: "3 highly compatible career paths."
      },
      counselingAdvice: {
        type: Type.STRING,
        description: "Unbiased, constructive advice for personal growth."
      }
    },
    required: ["archetype", "archetypeDescription", "riskAssessment", "traits", "careerPathSuggestions", "counselingAdvice"]
  };

  const formattedQA = answers.map(a => `Q: ${a.questionText}\nA: ${a.userResponse}`).join("\n\n");

  const prompt = `
    You are an unbiased, expert Psychological Profiler AI. 
    Analyze the full conversation history to create a comprehensive profile.

    CHAIN OF THOUGHT:
    1. **Identify the Core Drive**: What motivates this student? (Power, Helping others, Knowledge, Stability?)
    2. **Analyze for Potential Gems (Positive Outliers)**:
       - High Logic + Creativity = Potential Inventor/Engineer.
       - High Empathy + Resilience = Potential Doctor/Leader.
       - High Ambition + Charm = Potential CEO/Politician.
    3. **Analyze for Potential Threats (Risk Factors)**:
       - **Dark Triad traits**: Machiavellianism (manipulation), Narcissism (grandiosity), Psychopathy (callousness).
       - **The Dark Empath**: Look for students who understand emotions (high cognitive empathy) but use that understanding to hurt or manipulate (low affective empathy/integrity). This is a High Risk profile.
       - If they admit to enjoying violence, manipulation, or lack of remorse, mark 'riskAssessment.level' as High or Critical.
       - Differentiate between "Ruthless Business" (Moderate Risk) and "Predatory Behavior" (High Risk).
    4. **Generate Unbiased Scores**: Fill the 6 traits (Empathy, Logic, Integrity, Ambition, Resilience, Social Calibration).
    
    BEHAVIORAL MAPPING:
    - **Politician**: High Social Calibration, High Ambition, Variable Integrity.
    - **Engineer**: High Logic, High Integrity, Moderate Social.
    - **Doctor**: High Empathy, High Logic, High Resilience.
    - **Criminal/Predator**: High Ambition, High Social Calibration (charm), LOW Integrity, LOW Empathy.

    Student Answers:
    ${formattedQA}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.4,
      },
    });

    const result = parseResult<AnalysisResult>(response.text);
    if (!result) throw new Error("Parsed result is null");
    return result;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Unable to analyze profile at this time.");
  }
};