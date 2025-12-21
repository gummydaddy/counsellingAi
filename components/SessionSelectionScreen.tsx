
import React from 'react';
import { SessionType } from '../types';

interface Props {
  onSelect: (type: SessionType) => void;
}

const sessions: Array<{ id: SessionType; title: string; desc: string; icon: React.ReactNode; color: string }> = [
  {
    id: 'school',
    title: 'School Counseling',
    desc: 'For students dealing with academic pressure, bullying, social anxiety, or future planning.',
    color: 'bg-blue-100 text-blue-600',
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
  },
  {
    id: 'career',
    title: 'Career Coaching',
    desc: 'For professionals seeking growth, leadership skills, or a career pivot.',
    color: 'bg-emerald-100 text-emerald-600',
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
  },
  {
    id: 'medical',
    title: 'Medical Health Support',
    desc: 'Support for health anxiety, chronic illness coping, and doctor-patient trust issues.',
    color: 'bg-red-100 text-red-600',
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
  },
  {
    id: 'psychological',
    title: 'Psychological Insight',
    desc: 'Deep dive into emotional regulation, trauma, self-worth, and mental patterns.',
    color: 'bg-purple-100 text-purple-600',
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
  },
  {
    id: 'relationship',
    title: 'Relationship & Couples',
    desc: 'Understanding attachment styles, conflict resolution, and communication.',
    color: 'bg-pink-100 text-pink-600',
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
  }
];

const SessionSelectionScreen: React.FC<Props> = ({ onSelect }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Choose Your Counseling Path</h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Our AI Specialists are trained in different fields. Select the type of session you need today.
        </p>
        <div className="mt-4 inline-block bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-2 rounded-lg">
           Disclaimer: This AI tool is for educational purposes only and is not a substitute for professional medical or psychiatric advice.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            className="flex flex-col text-left p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all duration-300 group h-full"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${session.color} group-hover:scale-110 transition-transform`}>
              {session.icon}
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-indigo-600">{session.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed">{session.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SessionSelectionScreen;
