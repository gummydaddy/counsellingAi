import React, { useState } from 'react';
import { Question, Answer } from '../types';

interface Props {
  questions: Question[];
  onComplete: (answers: Answer[]) => void;
}

const Assessment: React.FC<Props> = ({ questions, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [error, setError] = useState('');

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex) / questions.length) * 100;

  const handleNext = () => {
    if (currentInput.trim().length < 5) {
      setError("Please provide a more detailed answer.");
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
      onComplete(updatedAnswers);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Progress Bar */}
      <div className="w-full bg-slate-200 rounded-full h-2.5 mb-8">
        <div 
          className="bg-brand-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100 min-h-[400px] flex flex-col justify-between animate-fade-in-up">
        <div>
          <span className="inline-block px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-semibold tracking-wide uppercase mb-4">
            Question {currentIndex + 1} of {questions.length}
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
              placeholder="Type your honest answer here..."
              className="w-full p-4 text-lg border-2 border-slate-200 rounded-xl focus:border-brand-500 focus:ring-0 transition-colors bg-slate-50 min-h-[150px] resize-none"
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
            className="inline-flex items-center px-6 py-3 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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