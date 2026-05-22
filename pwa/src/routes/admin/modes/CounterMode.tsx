import React from 'react';
import { Customer } from '@/types/admin';
import { Clock, User, Bell, MapPin, Brain, Loader2 } from 'lucide-react';
import { ContextSummaryCard } from '@/components/admin/ContextSummaryCard';

interface CounterModeProps {
  waiting: Customer[];
  called: Customer[];
  missed: Customer[];
  onCallNext: () => void;
  onRecall: (id: string) => void;
  onMarkServed: (id: string) => void;
  onMarkMissed: (id: string) => void;
  isCallingNext?: boolean;
}

export const CounterMode: React.FC<CounterModeProps> = ({
  waiting,
  called,
  missed,
  onCallNext,
  onRecall,
  onMarkServed,
  onMarkMissed,
  isCallingNext = false,
}) => {
  const currentCalled = called.find(c => c.status === 'called');

  // Unified history: missed + served, sorted most-recent first
  const history = [
    ...missed.map(c => ({ ...c, _t: new Date(c.missedAt || c.calledAt || '').getTime() || 0 })),
    ...called.filter(c => c.status === 'served').map(c => ({ ...c, _t: new Date(c.calledAt || '').getTime() || 0 })),
  ].sort((a, b) => b._t - a._t).slice(0, 8);

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    return `${diff} min ago`;
  };

  return (
    <div className="h-full flex flex-col gap-4">

      {/* TOP STRIP: Call Next + Currently Serving + AI Summary */}
      <div className="flex gap-4 shrink-0 items-stretch" style={{ minHeight: '9rem' }}>

        {/* Call Next */}
        <button
          onClick={onCallNext}
          disabled={waiting.length === 0 || isCallingNext}
          className={`
            w-32 rounded-2xl text-2xl font-serif font-bold tracking-wide uppercase shadow-lg transition-all
            flex flex-col items-center justify-center gap-2 border-2 shrink-0
            ${waiting.length > 0 && !isCallingNext
              ? 'bg-teal-400 border-teal-400 text-slate-900 hover:bg-teal-300 hover:border-teal-300 hover:scale-[1.01] active:scale-[0.99] shadow-teal-400/20'
              : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}
          `}
        >
          {isCallingNext
            ? <Loader2 size={24} className="animate-spin" />
            : <Bell size={24} className={waiting.length > 0 ? 'animate-bounce' : ''} />
          }
          <span>{isCallingNext ? '…' : 'NEXT'}</span>
        </button>

        {/* Currently Serving */}
        <div className="w-64 bg-slate-800 border border-teal-400/30 shadow-lg shadow-teal-400/5 rounded-2xl p-4 relative overflow-hidden shrink-0 flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-2 opacity-5">
            <User size={80} className="text-teal-400" />
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-teal-400 uppercase tracking-widest">Currently Serving</h3>
            <span className="text-xs font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-700">Cassa A</span>
          </div>

          {currentCalled ? (
            <div className="relative z-10">
              <div className="text-4xl font-serif font-bold text-slate-50 my-1">{currentCalled.ticketCode}</div>
              <div className="text-slate-400 mb-3 flex items-center gap-1 font-serif italic text-xs">
                <Clock size={12} /> Called {formatTime(currentCalled.calledAt || '')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onMarkServed(currentCalled.id)}
                  className="bg-teal-400 hover:bg-teal-300 text-slate-900 py-2 rounded-xl font-bold transition-colors shadow-md shadow-teal-400/20 text-xs"
                >
                  Served
                </button>
                <button
                  onClick={() => onMarkMissed(currentCalled.id)}
                  className="bg-transparent border border-red-500/50 text-red-500 hover:bg-red-500/10 py-2 rounded-xl font-bold transition-colors text-xs"
                >
                  Missed
                </button>
              </div>
            </div>
          ) : (
            <div className="text-slate-400 font-serif italic text-base">No active session.</div>
          )}
        </div>

        {/* AI Context Summary */}
        <div className="flex-1 min-w-0">
          {currentCalled ? (
            <ContextSummaryCard
              summary={currentCalled.ai_summary}
              ticketCode={currentCalled.ticketCode}
            />
          ) : (
            <div className="h-full bg-slate-800/30 border border-slate-700/40 rounded-2xl flex items-center justify-center gap-3">
              <Brain size={16} className="text-slate-600" />
              <span className="text-slate-600 text-sm font-serif italic">AI context will appear when a guest is called</span>
            </div>
          )}
        </div>

      </div>

      {/* BOTTOM AREA: Queue table + Missed/Recent */}
      <div className="flex-1 flex gap-4 min-h-0">

        {/* Guest Queue */}
        <div className="flex-1 flex flex-col bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center h-14 shrink-0">
            <h3 className="font-serif font-bold text-slate-50 flex items-center gap-3 text-base">
              <User size={18} className="text-teal-400" /> GUEST QUEUE ({waiting.length})
            </h3>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <table className="w-full text-left border-collapse">
              <thead className="text-xs text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-800 z-10">
                <tr>
                  <th className="p-4 font-normal bg-slate-800">Ticket</th>
                  <th className="p-4 font-normal bg-slate-800">Entry</th>
                  <th className="p-4 font-normal bg-slate-800">Position</th>
                  <th className="p-4 font-normal bg-slate-800">Waited</th>
                </tr>
              </thead>
              <tbody className="text-slate-50">
                {waiting.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-slate-400 font-serif italic text-base">
                      The queue is currently empty.
                    </td>
                  </tr>
                ) : (
                  waiting.map((c) => (
                    <tr key={c.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-900/50 transition-colors">
                      <td className="p-4 font-serif text-xl font-bold text-teal-400">{c.ticketCode}</td>
                      <td className="p-4 text-slate-500 text-sm">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} className="text-slate-600" />
                          {c.entryPointName || '—'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 font-medium text-base">#{c.position + 1}</td>
                      <td className="p-4 text-slate-400 italic text-base">{formatTime(c.joinTime)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Missed / Recent */}
        <div className="w-52 bg-slate-800 border border-slate-700 rounded-2xl flex flex-col overflow-hidden shadow-sm shrink-0">
          <div className="p-3 border-b border-slate-700 text-center text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-900/50 shrink-0">
            Missed / Recent
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {history.length === 0 ? (
              <div className="text-center text-slate-500 py-6 font-serif italic text-sm">History empty</div>
            ) : (
              history.map((c) =>
                c.status === 'missed' ? (
                  <div key={c.id} className="bg-slate-900/50 border border-red-500/20 p-3 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="font-serif font-bold text-slate-300 text-base">{c.ticketCode}</div>
                      <div className="text-xs text-red-400 italic">Missed</div>
                    </div>
                    <button
                      onClick={() => onRecall(c.id)}
                      className="bg-slate-800 text-teal-400 border border-slate-700 hover:bg-teal-400 hover:text-slate-900 px-2 py-1 rounded-lg text-xs font-bold transition-all uppercase"
                    >
                      Recall
                    </button>
                  </div>
                ) : (
                  <div key={c.id} className="bg-slate-900/50 border border-teal-500/20 p-3 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="font-serif font-bold text-slate-300 text-base">{c.ticketCode}</div>
                      <div className="text-xs text-teal-400 italic">Served</div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-teal-400/70 shrink-0" />
                  </div>
                )
              )
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
