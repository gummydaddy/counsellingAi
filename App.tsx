
import React, { useState, useEffect } from 'react';
import { AppStep, Answer, AnalysisResult, Question, MCQAnswer, SessionType } from './types';
import { SESSION_MCQ_POOLS } from './constants';
import { analyzeStudentAnswers, generatePhase1Questions } from './services/geminiService';
import { KnowledgeBaseService } from './services/knowledgeBaseService';
import WelcomeScreen from './components/WelcomeScreen';
import Assessment from './components/Assessment';
import ResultsView from './components/ResultsView';
import MCQPhase from './components/MCQPhase';
import SessionSelectionScreen from './components/SessionSelectionScreen';
import { CounselorNotesLayer } from './components/CounselorNotesLayer';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.WELCOME);
  const [sessionType, setSessionType] = useState<SessionType>('school');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [phase1Questions, setPhase1Questions] = useState<Question[]>([]);
  const [counselorNotes, setCounselorNotes] = useState<string | null>(null);
  const [sessionAnswers, setSessionAnswers] = useState<Answer[]>([]);
  const [aiStats, setAiStats] = useState(KnowledgeBaseService.getStats());

  useEffect(() => {
    setAiStats(KnowledgeBaseService.getStats());
  }, [step]);

  const handleStart = () => {
    setStep(AppStep.SESSION_SELECTION);
  };

  const handleSessionSelect = (type: SessionType) => {
    setSessionType(type);
    setStep(AppStep.NOTES_PROMPT);
  };

  const handleNotesProvided = async (notes: string | null) => {
    setCounselorNotes(notes);
    if (notes) {
      setStep(AppStep.GENERATING_PHASE1);
      try {
        const generatedQuestions = await generatePhase1Questions(null, sessionType, notes);
        setPhase1Questions(generatedQuestions);
        setStep(AppStep.ASSESSMENT);
      } catch (e) {
        setErrorMsg("Expert context ingestion failed.");
        setStep(AppStep.ERROR);
      }
    } else {
      setStep(AppStep.MCQ_PHASE);
    }
  };

  const handleMCQComplete = async (answers: MCQAnswer[]) => {
    setStep(AppStep.GENERATING_PHASE1);
    try {
      const generatedQuestions = await generatePhase1Questions(answers, sessionType, null);
      setPhase1Questions(generatedQuestions);
      setStep(AppStep.ASSESSMENT);
    } catch (e) {
      setErrorMsg("Failed to generate personalized questions.");
      setStep(AppStep.ERROR);
    }
  };

  const handleAssessmentComplete = async (answers: Answer[]) => {
    setSessionAnswers(answers);
    setStep(AppStep.ANALYZING);
    try {
      const analysis = await analyzeStudentAnswers(answers, sessionType);
      setResult(analysis);
      setStep(AppStep.RESULTS);
    } catch (e) {
      setErrorMsg("Analysis Engine failed. Ensure API key is valid.");
      setStep(AppStep.ERROR);
    }
  };

  const handleReset = () => {
    setResult(null);
    setErrorMsg(null);
    setPhase1Questions([]);
    setCounselorNotes(null);
    setSessionAnswers([]);
    setStep(AppStep.WELCOME);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={handleReset}>
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">M</div>
            <span className="text-xl font-bold text-slate-800 tracking-tight">MindPath AI</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col items-end text-[10px] uppercase font-bold text-slate-400">
              <span>Experience: {aiStats.experienceLevel}</span>
              <span className="text-brand-600">{aiStats.totalSessionsLearned} Sessions Validated</span>
            </div>
            {step !== AppStep.WELCOME && (
              <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs rounded-full font-bold uppercase tracking-wider">
                {sessionType}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center w-full">
        {step === AppStep.WELCOME && <WelcomeScreen onStart={handleStart} />}
        {step === AppStep.SESSION_SELECTION && <SessionSelectionScreen onSelect={handleSessionSelect} />}
        {step === AppStep.NOTES_PROMPT && <CounselorNotesLayer onNotesProvided={handleNotesProvided} onSkip={() => handleNotesProvided(null)} />}
        {step === AppStep.MCQ_PHASE && <MCQPhase questions={SESSION_MCQ_POOLS[sessionType]} onComplete={handleMCQComplete} />}
        
        {step === AppStep.GENERATING_PHASE1 && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-pulse">
             <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-6">
                <span className="text-3xl">🧩</span>
             </div>
             <h2 className="text-2xl font-bold text-slate-800 mb-2">Accessing Knowledge Base</h2>
             <p className="text-slate-500">Retrieving past clinical patterns for this session...</p>
          </div>
        )}

        {step === AppStep.ASSESSMENT && (
          <Assessment initialQuestions={phase1Questions} sessionType={sessionType} onComplete={handleAssessmentComplete} />
        )}

        {step === AppStep.ANALYZING && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Synthesizing Final Profile</h2>
            <p className="text-slate-500">The AI is learning from your narrative...</p>
          </div>
        )}

        {step === AppStep.RESULTS && result && (
          <ResultsView result={result} answers={sessionAnswers} onReset={handleReset} />
        )}

        {step === AppStep.ERROR && (
          <div className="text-center py-12 px-4">
            <h3 className="text-xl font-bold text-red-600 mb-4">Assessment Interrupted</h3>
            <p className="text-slate-600 mb-6">{errorMsg}</p>
            <button onClick={handleReset} className="px-6 py-2 bg-slate-200 rounded-lg font-bold">Restart System</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
