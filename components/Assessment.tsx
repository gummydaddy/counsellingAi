
import React, { useState, useEffect } from 'react';
import { Question, Answer, AssessmentPhase, SessionType } from '../types';
import { generateDeepDiveQuestions } from '../services/geminiService';

interface Props {
  initialQuestions: Question[];
  sessionType: SessionType;
  onComplete: (answers: Answer[]) => void;
}

const Assessment: React.FC<Props> = ({ initialQuestions, sessionType, onComplete }) => {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<AssessmentPhase>(AssessmentPhase.INITIAL);

  const currentQuestion = questions[currentIndex];
  // Progress calculation depends on phase to avoid jumping
  const totalProjectedQuestions = phase === AssessmentPhase.INITIAL ? initialQuestions.length * 2 : questions.length;
  const progress = ((currentIndex) / totalProjectedQuestions) * 100;

  const handleNext = async () => {
    if (currentInput.trim().length < 5) {
      setError("Please provide a more detailed answer to help us understand you better.");
      return;
    }

    const newAnswer: Answer = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.text,
      userResponse: currentInput
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);
    setCurrentInput('');
    setError('');

    // Check if we finished the current list of questions
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // If we finished Initial Phase, generate Deep Dive
      if (phase === AssessmentPhase.INITIAL) {
        setPhase(AssessmentPhase.GENERATING_DEEP_DIVE);
        try {
          const newQuestions = await generateDeepDiveQuestions(updatedAnswers, sessionType);
          setQuestions([...questions, ...newQuestions]);
          setPhase(AssessmentPhase.DEEP_DIVE);
          setCurrentIndex(prev => prev + 1);
        } catch (e) {
          console.error("Failed to generate dynamic questions, skipping to results.");
          onComplete(updatedAnswers);
        }
      } else {
        // Finished Deep Dive Phase
        onComplete(updatedAnswers);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    }
  };

  if (phase === AssessmentPhase.GENERATING_DEEP_DIVE) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-fade-in text-center px-4">
        <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Analyzing Your Profile</h2>
        <p className="text-slate-500 max-w-md">
          The AI is processing your initial answers to generate 5 personalized deep-dive scenarios that challenge your thinking...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Progress Bar */}
      <div className="w-full bg-slate-200 rounded-full h-2.5 mb-8">
        <div 
          className="bg-brand-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100 min-h-[400px] flex flex-col justify-between animate-fade-in-up relative overflow-hidden">
        
        {/* Phase Indicator */}
        <div className="absolute top-0 right-0 p-4">
           {phase === AssessmentPhase.INITIAL ? (
             <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold uppercase rounded-full tracking-wider">
               Phase 1: Foundation
             </span>
           ) : (
             <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold uppercase rounded-full tracking-wider shadow-sm border border-purple-200">
               Phase 2: Deep Dive
             </span>
           )}
        </div>

        <div>
          <span className="inline-block px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-semibold tracking-wide uppercase mb-4">
            Question {currentIndex + 1}
          </span>
          <h2 className="text-2xl md:text-3xl font-medium text-slate-900 mb-6 leading-tight">
            {currentQuestion.text}
          </h2>

          <div className="relative">
            <textarea
              value={currentInput}
              onChange={(e) => {
                setCurrentInput(e.target.value);
                if(error) setError('');
              }}
              onKeyDown={handleKeyPress}
              placeholder={phase === AssessmentPhase.INITIAL ? "Type your honest answer here..." : "Think carefully and explain your reasoning..."}
              className={`w-full p-4 text-lg border-2 rounded-xl focus:ring-0 transition-colors bg-slate-50 min-h-[150px] resize-none ${
                phase === AssessmentPhase.DEEP_DIVE ? 'border-purple-100 focus:border-purple-500' : 'border-slate-200 focus:border-brand-500'
              }`}
              autoFocus
            />
            <div className="text-xs text-slate-400 mt-2 text-right">
              {currentInput.length} chars
            </div>
          </div>
          
          {error && (
            <p className="text-red-500 mt-2 text-sm flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </p>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleNext}
            disabled={!currentInput.trim()}
            className={`inline-flex items-center px-6 py-3 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white ${
              phase === AssessmentPhase.DEEP_DIVE 
                ? 'bg-purple-600 hover:bg-purple-700' 
                : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {currentIndex === questions.length - 1 ? 'Finish & Analyze' : 'Next Question'}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Assessment;
