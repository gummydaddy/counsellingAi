
import React, { useState, useEffect } from 'react';
import { AppStep, Answer, AnalysisResult, Question, MCQAnswer, SessionType } from './types.ts';
import { SESSION_MCQ_POOLS } from './constants.ts';
import { analyzeStudentAnswers, generatePhase1Questions } from './services/geminiService.ts';
import { KnowledgeBaseService } from './services/knowledgeBaseService.ts';
import WelcomeScreen from './components/WelcomeScreen.tsx';
import Assessment from './components/Assessment.tsx';
import ResultsView from './components/ResultsView.tsx';
import MCQPhase from './components/MCQPhase.tsx';
import SessionSelectionScreen from './components/SessionSelectionScreen.tsx';
import { CounselorNotesLayer } from './components/CounselorNotesLayer.tsx';

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
      } catch (e: any) {
        setErrorMsg(`Context ingestion failed: ${e.message || 'Check your API Key settings.'}`);
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
    } catch (e: any) {
      setErrorMsg(`Generation failed: ${e.message || 'Ensure your API Key is correctly configured in Vercel.'}`);
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
    } catch (e: any) {
      setErrorMsg(`Analysis Engine failed: ${e.message || 'Check browser console for details.'}`);
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
          <div className="text-center py-12 px-4 max-w-lg mx-auto">
             <div className="mb-6 inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full text-red-600">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             </div>
            <h3 className="text-xl font-bold text-red-600 mb-2">System Interrupted</h3>
            <p className="text-slate-600 mb-6 bg-white p-4 rounded-xl border border-slate-200 text-sm font-mono break-all">
              {errorMsg}
            </p>
            <button onClick={handleReset} className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-100">
              Restart Session
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
