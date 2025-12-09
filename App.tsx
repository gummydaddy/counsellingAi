import React, { useState, useEffect } from 'react';
import { AppStep, Answer, AnalysisResult, Question } from './types';
import { QUESTION_POOL } from './constants';
import { analyzeStudentAnswers } from './services/geminiService';
import WelcomeScreen from './components/WelcomeScreen';
import Assessment from './components/Assessment';
import ResultsView from './components/ResultsView';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.WELCOME);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [phase1Questions, setPhase1Questions] = useState<Question[]>([]);

  // Function to randomize questions ensuring category coverage (Stratified Sampling)
  const initializeQuestions = () => {
    // Group questions by category
    const categories: Record<string, Question[]> = {};
    QUESTION_POOL.forEach(q => {
      if (!categories[q.category]) categories[q.category] = [];
      categories[q.category].push(q);
    });

    const selectedQuestions: Question[] = [];
    const usedIds = new Set<number>();

    // Try to pick one from each key category to ensure the Hexagon Graph has data
    const priorityCategories = ['ethics', 'logic', 'empathy', 'ambition', 'social_calibration'];
    
    priorityCategories.forEach(cat => {
      if (categories[cat] && categories[cat].length > 0) {
        // Pick random question from this category
        const randomQ = categories[cat][Math.floor(Math.random() * categories[cat].length)];
        selectedQuestions.push(randomQ);
        usedIds.add(randomQ.id);
      }
    });

    // If we have fewer than 5 (e.g. missing categories), fill with random remaining
    while (selectedQuestions.length < 5) {
      const available = QUESTION_POOL.filter(q => !usedIds.has(q.id));
      if (available.length === 0) break;
      const randomQ = available[Math.floor(Math.random() * available.length)];
      selectedQuestions.push(randomQ);
      usedIds.add(randomQ.id);
    }

    // Shuffle the final selection so categories aren't always in same order
    setPhase1Questions(selectedQuestions.sort(() => 0.5 - Math.random()));
  };

  const handleStart = () => {
    initializeQuestions();
    setStep(AppStep.ASSESSMENT);
  };

  const handleAssessmentComplete = async (answers: Answer[]) => {
    setStep(AppStep.ANALYZING);
    try {
      const analysis = await analyzeStudentAnswers(answers);
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
    setStep(AppStep.WELCOME);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={handleReset}>
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              M
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">MindPath</span>
          </div>
          {step !== AppStep.WELCOME && (
             <div className="text-xs font-medium text-slate-400 uppercase tracking-widest">
               Student Assessment
             </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center w-full">
        {step === AppStep.WELCOME && (
          <WelcomeScreen onStart={handleStart} />
        )}

        {step === AppStep.ASSESSMENT && phase1Questions.length > 0 && (
          <Assessment initialQuestions={phase1Questions} onComplete={handleAssessmentComplete} />
        )}

        {step === AppStep.ANALYZING && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="relative w-24 h-24 mb-8">
               <div className="absolute top-0 left-0 w-full h-full border-4 border-brand-100 rounded-full"></div>
               <div className="absolute top-0 left-0 w-full h-full border-4 border-brand-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Finalizing Profile</h2>
            <p className="text-slate-500">Mapping 6-Axis Behavioral Graph...</p>
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

      <footer className="py-6 text-center text-slate-400 text-sm">
        <p>&copy; {new Date().getFullYear()} MindPath AI. Educational Purpose Only.</p>
      </footer>
    </div>
  );
};

export default App;