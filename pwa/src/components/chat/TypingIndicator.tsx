import React from 'react';

export const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-2 h-2 rounded-full bg-teal-400 opacity-70 animate-bounce"
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
    <span className="ml-2 text-xs text-slate-500 italic">thinking…</span>
  </div>
);
