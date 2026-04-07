import React, { useState } from 'react';
import { CounsellingSession, SessionType } from '../types.ts';

interface Props {
  sessions: CounsellingSession[];
  activeSessionId: string | null;
  isCollapsed: boolean;
  onToggle: () => void;
  onNewSession: () => void;
  onSelectSession: (session: CounsellingSession) => void;
  onDeleteSession: (sessionId: string) => void;
}

const SESSION_ICONS: Record<SessionType, string> = {
  school: '🎓',
  medical: '🩺',
  psychological: '🧠',
  career: '💼',
  relationship: '❤️',
};

const SessionSidebar: React.FC<Props> = ({
  sessions,
  activeSessionId,
  isCollapsed,
  onToggle,
  onNewSession,
  onSelectSession,
  onDeleteSession,
}) => {
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const groupSessionsByDate = (sessions: CounsellingSession[]) => {
    const groups: { label: string; sessions: CounsellingSession[] }[] = [];
    const groupMap = new Map<string, CounsellingSession[]>();

    for (const session of sessions) {
      const label = formatDate(session.createdAt);
      if (!groupMap.has(label)) {
        groupMap.set(label, []);
      }
      groupMap.get(label)!.push(session);
    }

    const order = ['Today', 'Yesterday'];
    const sortedKeys = Array.from(groupMap.keys()).sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    });

    for (const key of sortedKeys) {
      groups.push({ label: key, sessions: groupMap.get(key)! });
    }
    return groups;
  };

  const grouped = groupSessionsByDate(sessions);

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-slate-900 text-slate-200 z-40 flex flex-col transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-0 -translate-x-full' : 'w-72 translate-x-0'
        }`}
        style={{ minWidth: isCollapsed ? 0 : '288px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <span className="font-bold text-sm tracking-wide text-slate-300 uppercase">Sessions</span>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
            title="Close sidebar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* New Session Button */}
        <div className="p-3">
          <button
            onClick={onNewSession}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-700/50 hover:bg-slate-800 transition-all text-sm font-medium text-slate-300 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Session
          </button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {sessions.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="text-3xl mb-3 opacity-40">💬</div>
              <p className="text-xs text-slate-500">No sessions yet</p>
              <p className="text-xs text-slate-600 mt-1">Start a new session to begin</p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.label} className="mb-4">
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {group.label}
                </div>
                {group.sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all mb-0.5 ${
                      activeSessionId === session.id
                        ? 'bg-slate-700/70 text-white'
                        : 'hover:bg-slate-800/70 text-slate-400 hover:text-slate-200'
                    }`}
                    onClick={() => onSelectSession(session)}
                    onMouseEnter={() => setHoveredSession(session.id)}
                    onMouseLeave={() => setHoveredSession(null)}
                  >
                    <span className="text-base flex-shrink-0">
                      {SESSION_ICONS[session.sessionType] || '💬'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-tight">
                        {session.title}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 capitalize">
                        {session.sessionType}
                        {session.result?.riskAssessment?.level && (
                          <span className={`ml-2 ${
                            session.result.riskAssessment.level === 'Critical' ? 'text-red-400' :
                            session.result.riskAssessment.level === 'High' ? 'text-orange-400' :
                            session.result.riskAssessment.level === 'Moderate' ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            ● {session.result.riskAssessment.level}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Delete button */}
                    {hoveredSession === session.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="absolute right-2 p-1.5 rounded-md bg-slate-800 hover:bg-red-600/80 text-slate-400 hover:text-white transition-all"
                        title="Delete session"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Toggle button (when collapsed) */}
      {isCollapsed && (
        <button
          onClick={onToggle}
          className="fixed left-3 top-[72px] z-40 p-2 bg-slate-900 text-slate-300 rounded-lg hover:bg-slate-800 transition-all shadow-lg border border-slate-700/50"
          title="Open sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Backdrop for mobile */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
};

export default SessionSidebar;
