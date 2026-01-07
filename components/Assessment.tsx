
import React, { useState } from 'react';
import { Question, Answer, AssessmentPhase, SessionType } from '../types.ts';
import { generateDeepDiveQuestions, generateRapportQuestion } from '../services/geminiService.ts';

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
  const progress = ((currentIndex) / (initialQuestions.length * 2 + 1)) * 100;

  const handleNext = async () => {
    if (currentInput.trim().length < 5) {
      setError("Please provide a bit more detail for the specialist.");
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

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      if (phase === AssessmentPhase.INITIAL) {
        setPhase(AssessmentPhase.GENERATING_RAPPORT);
        try {
          const rapportQ = await generateRapportQuestion(updatedAnswers, sessionType);
          setQuestions([...questions, rapportQ]);
          setPhase(AssessmentPhase.RAPPORT);
          setCurrentIndex(prev => prev + 1);
        } catch (e) {
          onComplete(updatedAnswers);
        }
      } else if (phase === AssessmentPhase.RAPPORT) {
        setPhase(AssessmentPhase.GENERATING_DEEP_DIVE);
        try {
          const deepDiveQs = await generateDeepDiveQuestions(updatedAnswers, sessionType);
          setQuestions([...questions, ...deepDiveQs]);
          setPhase(AssessmentPhase.DEEP_DIVE);
          setCurrentIndex(prev => prev + 1);
        } catch (e) {
          onComplete(updatedAnswers);
        }
      } else {
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

  if (phase === AssessmentPhase.GENERATING_RAPPORT || phase === AssessmentPhase.GENERATING_DEEP_DIVE) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-fade-in text-center px-4">
        <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          {phase === AssessmentPhase.GENERATING_RAPPORT ? "Transitioning to Patient Voice..." : "Finalizing Deep-Dive Scenarios..."}
        </h2>
        <p className="text-slate-500 max-w-md">
          The specialist is carefully tailoring the next phase based on your narrative...
        </p>
      </div>
    );
  }

  const getPhaseStyles = () => {
    switch(phase) {
      case AssessmentPhase.RAPPORT: return 'border-emerald-100 focus:border-emerald-500 bg-emerald-50/30';
      case AssessmentPhase.DEEP_DIVE: return 'border-purple-100 focus:border-purple-500 bg-purple-50/30';
      default: return 'border-slate-200 focus:border-brand-500 bg-slate-50';
    }
  };

  const getPhaseLabel = () => {
    switch(phase) {
      case AssessmentPhase.RAPPORT: return { text: 'Patient Answering Phase', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      case AssessmentPhase.DEEP_DIVE: return { text: 'Deep Investigation', color: 'bg-purple-100 text-purple-700 border-purple-200' };
      default: return { text: 'Foundation Assessment', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
  };

  const label = getPhaseLabel();

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      <div className="w-full bg-slate-200 rounded-full h-2.5 mb-8">
        <div 
          className="bg-brand-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100 min-h-[450px] flex flex-col justify-between animate-fade-in-up relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
           <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full tracking-wider shadow-sm border ${label.color}`}>
             {label.text}
           </span>
        </div>

        <div>
          <span className="inline-block px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-semibold tracking-wide uppercase mb-4">
            Stage {currentIndex + 1}
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
              placeholder={phase === AssessmentPhase.RAPPORT ? "Take your time. This is a safe space for your story..." : "Describe your thoughts in detail..."}
              className={`w-full p-6 text-lg border-2 rounded-2xl focus:ring-0 transition-all min-h-[180px] resize-none ${getPhaseStyles()}`}
              autoFocus
            />
          </div>
          
          {error && (
            <p className="text-red-500 mt-2 text-sm flex items-center bg-red-50 p-2 rounded-lg border border-red-100">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </p>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleNext}
            disabled={!currentInput.trim()}
            className={`inline-flex items-center px-10 py-4 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg ${
              phase === AssessmentPhase.RAPPORT ? 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-200' :
              phase === AssessmentPhase.DEEP_DIVE ? 'bg-purple-600 hover:bg-purple-700 hover:shadow-purple-200' :
              'bg-brand-600 hover:bg-brand-700 hover:shadow-brand-200'
            }`}
          >
            {currentIndex === questions.length - 1 ? 'Complete Assessment' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Assessment;
