
import React, { useState } from 'react';
import { AppStep, Answer, AnalysisResult, Question, MCQAnswer, SessionType } from './types';
import { SESSION_MCQ_POOLS } from './constants';
import { analyzeStudentAnswers, generatePhase1Questions } from './services/geminiService';
import WelcomeScreen from './components/WelcomeScreen';
import Assessment from './components/Assessment';
import ResultsView from './components/ResultsView';
import MCQPhase from './components/MCQPhase';
import SessionSelectionScreen from './components/SessionSelectionScreen';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.WELCOME);
  const [sessionType, setSessionType] = useState<SessionType>('school'); // Default
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [phase1Questions, setPhase1Questions] = useState<Question[]>([]);
  
  const handleStart = () => {
    setStep(AppStep.SESSION_SELECTION);
  };

  const handleSessionSelect = (type: SessionType) => {
    setSessionType(type);
    setStep(AppStep.MCQ_PHASE);
  };

  const handleMCQComplete = async (answers: MCQAnswer[]) => {
    setStep(AppStep.GENERATING_PHASE1);
    try {
      // Use AI to generate specific text questions based on MCQ answers and session type
      const generatedQuestions = await generatePhase1Questions(answers, sessionType);
      setPhase1Questions(generatedQuestions);
      setStep(AppStep.ASSESSMENT);
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to generate personalized questions. Please try again.");
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
      console.error(e);
      setErrorMsg("We encountered an issue analyzing your responses. Please ensure your API key is valid and try again.");
      setStep(AppStep.ERROR);
    }
  };

  const handleReset = () => {
    setResult(null);
    setErrorMsg(null);
    setPhase1Questions([]);
    setStep(AppStep.WELCOME);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={handleReset}>
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              M
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">MindPath</span>
          </div>
          {step !== AppStep.WELCOME && (
             <div className="text-xs font-medium text-slate-400 uppercase tracking-widest flex items-center">
               {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Session
             </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center w-full">
        {step === AppStep.WELCOME && (
          <WelcomeScreen onStart={handleStart} />
        )}

        {step === AppStep.SESSION_SELECTION && (
          <SessionSelectionScreen onSelect={handleSessionSelect} />
        )}

        {step === AppStep.MCQ_PHASE && (
          <MCQPhase questions={SESSION_MCQ_POOLS[sessionType]} onComplete={handleMCQComplete} />
        )}

        {step === AppStep.GENERATING_PHASE1 && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in text-center px-4">
             <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
             <h2 className="text-2xl font-bold text-slate-800 mb-2">Analyzing Preliminary Profile</h2>
             <p className="text-slate-500 max-w-md">
               The {sessionType} specialist is reviewing your choices to create custom scenarios...
             </p>
          </div>
        )}

        {step === AppStep.ASSESSMENT && phase1Questions.length > 0 && (
          // key={phase1Questions[0].id} forces remount if questions change completely
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
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Finalizing Report</h2>
            <p className="text-slate-500">Generating 6-Axis Behavioral Graph & Strategic Advice...</p>
          </div>
        )}

        {step === AppStep.RESULTS && result && (
          <ResultsView result={result} onReset={handleReset} />
        )}

        {step === AppStep.ERROR && (
          <div className="text-center max-w-md px-4 py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Analysis Failed</h3>
            <p className="text-slate-600 mb-6">{errorMsg}</p>
            <button onClick={handleReset} className="text-brand-600 font-semibold hover:underline">
              Try Again
            </button>
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-slate-400 text-sm print:hidden">
        <p>&copy; {new Date().getFullYear()} MindPath AI. Educational Purpose Only.</p>
      </footer>
    </div>
  );
};

export default App;
