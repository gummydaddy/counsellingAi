import React, { useState } from 'react';
import { MCQQuestion, MCQAnswer } from '../types';

interface Props {
  questions: MCQQuestion[];
  onComplete: (answers: MCQAnswer[]) => void;
}

const MCQPhase: React.FC<Props> = ({ questions, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<MCQAnswer[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const handleSelect = (value: string) => {
    setSelectedOption(value);
  };

  const handleNext = () => {
    if (!selectedOption) return;

    const newAnswer: MCQAnswer = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.text,
      selectedOption: currentQuestion.options.find(o => o.value === selectedOption)?.label || selectedOption
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);
    setSelectedOption(null);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onComplete(updatedAnswers);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
       <div className="w-full bg-slate-200 rounded-full h-2.5 mb-8">
        <div 
          className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100 min-h-[400px] flex flex-col animate-fade-in-up">
        <div className="mb-6">
           <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold tracking-wide uppercase mb-4">
            Preliminary Profile: Question {currentIndex + 1} / {questions.length}
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mb-6 leading-tight">
            {currentQuestion.text}
          </h2>
        </div>

        <div className="space-y-3 flex-grow">
          {currentQuestion.options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center group ${
                selectedOption === option.value 
                  ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                  : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
              }`}
            >
              <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition-colors ${
                selectedOption === option.value ? 'border-indigo-600' : 'border-slate-300 group-hover:border-indigo-300'
              }`}>
                {selectedOption === option.value && (
                  <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                )}
              </div>
              <span className={`text-lg font-medium ${selectedOption === option.value ? 'text-indigo-900' : 'text-slate-700'}`}>
                {option.label}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleNext}
            disabled={!selectedOption}
            className="inline-flex items-center px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {currentIndex === questions.length - 1 ? 'Start Deep Assessment' : 'Next'}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MCQPhase;