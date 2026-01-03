
import React, { useState } from 'react';
import { AppStep, Answer, AnalysisResult, Question, MCQAnswer, SessionType } from './types';
import { SESSION_MCQ_POOLS } from './constants';
import { analyzeStudentAnswers, generatePhase1Questions } from './services/geminiService';
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
      // Branch: Expert Notes Provided -> Generate specialized questions immediately
      setStep(AppStep.GENERATING_PHASE1);
      try {
        const generatedQuestions = await generatePhase1Questions(null, sessionType, notes);
        setPhase1Questions(generatedQuestions);
        setStep(AppStep.ASSESSMENT);
      } catch (e) {
        setErrorMsg("Expert context ingestion failed. Please try again.");
        setStep(AppStep.ERROR);
      }
    } else {
      // User chose to skip notes
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
      console.error(e);
      setErrorMsg("Failed to generate personalized questions.");
      setStep(AppStep.ERROR);
    }
  };

  const handleAssessmentComplete = async (answers: Answer[]) => {
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
    setStep(AppStep.WELCOME);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={handleReset}>
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">M</div>
            <span className="text-xl font-bold tracking-tight text-slate-800">MindPath</span>
          </div>
          {step !== AppStep.WELCOME && (
             <div className="text-xs font-medium text-slate-400 uppercase tracking-widest flex items-center">
               {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Session
             </div>
          )}
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center w-full">
        {step === AppStep.WELCOME && <WelcomeScreen onStart={handleStart} />}
        {step === AppStep.SESSION_SELECTION && <SessionSelectionScreen onSelect={handleSessionSelect} />}
        
        {step === AppStep.NOTES_PROMPT && (
          <CounselorNotesLayer onNotesProvided={handleNotesProvided} onSkip={() => handleNotesProvided(null)} />
        )}

        {step === AppStep.MCQ_PHASE && (
          <MCQPhase questions={SESSION_MCQ_POOLS[sessionType]} onComplete={handleMCQComplete} />
        )}

        {step === AppStep.GENERATING_PHASE1 && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in text-center px-4">
             <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
             <h2 className="text-2xl font-bold text-slate-800 mb-2">Analyzing Inputs</h2>
             <p className="text-slate-500 max-w-md">
               {counselorNotes ? "The Specialist is ingestng professional notes..." : "The Specialist is reviewing your preliminary choices..."}
             </p>
          </div>
        )}

        {step === AppStep.ASSESSMENT && phase1Questions.length > 0 && (
          <Assessment 
            key={phase1Questions[0].id} 
            initialQuestions={phase1Questions} 
            sessionType={sessionType}
            onComplete={handleAssessmentComplete} 
          />
        )}

        {step === AppStep.ANALYZING && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="relative w-24 h-24 mb-8">
               <div className="absolute top-0 left-0 w-full h-full border-4 border-brand-100 rounded-full"></div>
               <div className="absolute top-0 left-0 w-full h-full border-4 border-brand-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Synthesizing Final Report</h2>
            <p className="text-slate-500">Processing multidimensional analysis...</p>
          </div>
        )}

        {step === AppStep.RESULTS && result && <ResultsView result={result} onReset={handleReset} />}

        {step === AppStep.ERROR && (
          <div className="text-center max-w-md px-4 py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 font-bold text-2xl">!</div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Operation Failed</h3>
            <p className="text-slate-600 mb-6">{errorMsg}</p>
            <button onClick={handleReset} className="text-brand-600 font-semibold hover:underline">Try Again</button>
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-slate-400 text-sm print:hidden">
        <p>&copy; {new Date().getFullYear()} MindPath AI. Developed for Professional Counseling.</p>
      </footer>
    </div>
  );
};

export default App;
