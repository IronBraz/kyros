import React from 'react';
import { Customer } from '@/types/admin';
import { Clock, User, RotateCcw, CheckCircle, Bell, MapPin } from 'lucide-react';

interface CounterModeProps {
  waiting: Customer[];
  called: Customer[];
  missed: Customer[];
  onCallNext: () => void;
  onRecall: (id: string) => void;
  onMarkServed: (id: string) => void;
  onMarkMissed: (id: string) => void;
}

export const CounterMode: React.FC<CounterModeProps> = ({
  waiting,
  called,
  missed,
  onCallNext,
  onRecall,
  onMarkServed,
  onMarkMissed,
}) => {
  const currentCalled = called.find(c => c.status === 'called');

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    return `${diff} min ago`;
  };

  return (
    <div className="h-full grid grid-cols-12 gap-4">
        {/* LEFT PANEL: Guest Queue (Full Height) */}
        <div className="col-span-8 flex flex-col h-full bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center h-16 flex-shrink-0">
              <h3 className="font-serif font-bold text-slate-50 flex items-center gap-3 text-base">
                <User size={20} className="text-teal-400" /> GUEST QUEUE ({waiting.length})
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

        {/* RIGHT PANEL: Controls & Status */}
        <div className="col-span-4 flex flex-col gap-4 h-full">
          
          {/* 1. CALL NEXT BUTTON (Top Right) */}
          <button
            onClick={onCallNext}
            disabled={waiting.length === 0}
            className={`
              w-full h-28 rounded-2xl text-3xl font-serif font-bold tracking-wide uppercase shadow-lg transition-all
              flex flex-col items-center justify-center gap-2 border-2 shrink-0
              ${waiting.length > 0 
                ? 'bg-teal-400 border-teal-400 text-slate-900 hover:bg-teal-300 hover:border-teal-300 hover:scale-[1.01] active:scale-[0.99] shadow-teal-400/20' 
                : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}
            `}
          >
            <Bell size={28} className={waiting.length > 0 ? "animate-bounce" : ""} />
            <span>NEXT</span>
          </button>

          {/* 2. CURRENTLY SERVING */}
          <div className="bg-slate-800 border border-teal-400/30 shadow-lg shadow-teal-400/5 rounded-2xl p-6 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-4 opacity-5">
               <User size={120} className="text-teal-400" />
            </div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-teal-400 uppercase tracking-widest">Currently Serving</h3>
              <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">Cassa A</span>
            </div>
            
            {currentCalled ? (
              <div className="relative z-10">
                <div className="text-6xl font-serif font-bold text-slate-50 mb-4">{currentCalled.ticketCode}</div>
                <div className="text-slate-400 mb-6 flex items-center gap-2 font-serif italic text-sm">
                   <Clock size={16} /> Called {formatTime(currentCalled.calledAt || '')}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                     onClick={() => onMarkServed(currentCalled.id)}
                     className="bg-teal-400 hover:bg-teal-300 text-slate-900 p-3 rounded-xl font-bold transition-colors shadow-md shadow-teal-400/20 text-sm"
                  >
                    Mark Served
                  </button>
                  <button 
                     onClick={() => onMarkMissed(currentCalled.id)}
                     className="bg-transparent border border-red-500/50 text-red-500 hover:bg-red-500/10 p-3 rounded-xl font-bold transition-colors text-sm"
                  >
                    Mark Missed
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 py-6 font-serif italic text-lg">
                No active session.
              </div>
            )}
          </div>

          {/* 3. MISSED & CALLED LIST (Fill remaining space) */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm min-h-0">
            <div className="flex border-b border-slate-700">
                <div className="flex-1 p-4 text-center text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-900/50">Missed / Recent</div>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {missed.length === 0 && called.filter(c => c.status !== 'called').length === 0 ? (
                 <div className="text-center text-slate-500 py-6 font-serif italic text-sm">History empty</div>
              ) : (
                 <>
                   {missed.map((c) => (
                    <div key={c.id} className="bg-slate-900/50 border border-red-500/20 p-3 rounded-xl flex justify-between items-center group">
                      <div>
                        <div className="font-serif font-bold text-slate-300 text-base">{c.ticketCode}</div>
                        <div className="text-xs text-red-400 italic">Missed</div>
                      </div>
                      <button 
                        onClick={() => onRecall(c.id)}
                        className="bg-slate-800 text-teal-400 border border-slate-700 hover:bg-teal-400 hover:text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase"
                      >
                        Recall
                      </button>
                    </div>
                  ))}
                  {called.filter(c => c.status === 'served').slice(0, 3).map((c) => (
                    <div key={c.id} className="p-3 rounded-xl flex justify-between items-center opacity-60">
                       <div className="font-serif font-medium text-slate-400 text-base line-through decoration-slate-600">{c.ticketCode}</div>
                       <div className="text-xs text-slate-500 uppercase">Served</div>
                    </div>
                  ))}
                 </>
              )}
            </div>
          </div>

        </div>
    </div>
  );
};