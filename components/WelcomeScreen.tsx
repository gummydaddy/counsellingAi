import React from 'react';

interface Props {
  onStart: () => void;
}

const WelcomeScreen: React.FC<Props> = ({ onStart }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 max-w-4xl mx-auto animate-fade-in">
      <div className="bg-brand-50 p-4 rounded-full mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      
      <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6 tracking-tight">
        Discover Your <span className="text-brand-600">Mindset Path</span>
      </h1>
      
      <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl leading-relaxed">
        Are you thinking like an Engineer, a Leader, a Healer, or something else? 
        Take our AI-powered psychological assessment to reveal your hidden potential 
        and get personalized career guidance for your future.
      </p>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 text-sm text-yellow-800 max-w-xl">
        <strong>Privacy Notice:</strong> Your answers are analyzed anonymously by AI to provide educational insights. 
        Please answer truthfully for the most accurate results.
      </div>

      <button 
        onClick={onStart}
        className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white transition-all duration-200 bg-brand-600 rounded-full hover:bg-brand-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-600"
      >
        Start Assessment
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </div>
  );
};

export default WelcomeScreen;