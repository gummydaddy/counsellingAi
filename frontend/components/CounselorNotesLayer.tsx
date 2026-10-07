
import React, { useState, useRef } from 'react';

interface Props {
  onNotesProvided: (notes: string | null) => void;
  onSkip: () => void;
}

export const CounselorNotesLayer: React.FC<Props> = ({ onNotesProvided, onSkip }) => {
  const [showInput, setShowInput] = useState(false);
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setNotes((prev) => (prev ? prev + "\n\n--- Attached Document ---\n" + text : text));
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert("Failed to read file.");
      setIsUploading(false);
    };
    reader.readAsText(file);
  };

  if (!showInput) {
    return (
      <div className="max-w-2xl mx-auto p-8 animate-fade-in-up">
        <div className="bg-white rounded-2xl shadow-xl p-10 border border-slate-100 text-center">
          <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Expert Context Injection</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Do you have pre-existing observations, behavioral logs, or session summaries? 
            Injecting these allows our AI to align with clinical findings immediately.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => setShowInput(true)}
              className="px-8 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg hover:shadow-brand-200"
            >
              Feed Existing Notes
            </button>
            <button 
              onClick={onSkip}
              className="px-8 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
            >
              Start New Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-brand-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Expert Clinical Documentation</h2>
          <button onClick={() => setShowInput(false)} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="mb-6 flex items-center justify-between p-4 bg-brand-50 rounded-xl border border-brand-100">
          <div>
            <p className="font-semibold text-brand-900 text-sm">Upload Document</p>
            <p className="text-xs text-brand-600">Supports .txt files with clinical notes</p>
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-white text-brand-600 border border-brand-200 rounded-lg text-sm font-bold hover:bg-brand-100 transition-colors shadow-sm"
          >
            {isUploading ? 'Reading...' : 'Select File'}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".txt" 
            className="hidden" 
          />
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Paste or write analysis here. For example: 'Patient displays high levels of avoidance...'"
          className="w-full h-64 p-5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-brand-500 focus:ring-0 transition-all font-mono text-sm leading-relaxed"
        />

        <div className="mt-8 flex justify-end gap-4">
          <button 
            onClick={onSkip}
            className="px-6 py-3 text-slate-500 font-semibold"
          >
            Cancel
          </button>
          <button 
            disabled={notes.trim().length < 5 || isUploading}
            onClick={() => onNotesProvided(notes)}
            className="px-10 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-brand-100"
          >
            Inject Expert Context
          </button>
        </div>
      </div>
    </div>
  );
};
