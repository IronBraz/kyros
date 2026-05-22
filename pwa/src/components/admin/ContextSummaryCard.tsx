import React from 'react';
import { Brain, ThumbsUp, Minus, AlertTriangle, Loader2, MessageSquare } from 'lucide-react';
import { AISummary } from '@/types/admin';

interface Props {
  summary: AISummary | undefined;
  ticketCode: string;
}

const SENTIMENT_CONFIG: Record<string, { icon: React.ElementType; label: string; cls: string }> = {
  '1':  { icon: ThumbsUp,       label: 'Positive',  cls: 'text-teal-400 bg-teal-400/10 border-teal-400/30' },
  '0':  { icon: Minus,          label: 'Neutral',   cls: 'text-slate-400 bg-slate-700/60 border-slate-600/40' },
  '-1': { icon: AlertTriangle,  label: 'Uncertain', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
};

export const ContextSummaryCard: React.FC<Props> = ({ summary, ticketCode }) => {
  if (!summary) return null;

  const { status } = summary;

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <Brain size={14} className="text-teal-400" />
        <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">AI Context</span>
        <span className="text-xs text-slate-600 ml-auto font-mono">{ticketCode}</span>
      </div>

      {status === 'pending' && (
        <div className="flex items-center gap-2 text-slate-500 text-sm italic">
          <MessageSquare size={14} />
          <span>No conversation — walk-in customer</span>
        </div>
      )}

      {(status === 'generating') && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 size={14} className="animate-spin text-teal-400" />
          <span>Generating summary…</span>
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden ml-1">
            <div className="h-full w-1/3 bg-teal-500/50 rounded-full animate-pulse" />
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="text-sm text-slate-500 italic">Summary unavailable.</div>
      )}

      {status === 'ready' && (
        <div className="space-y-2.5">
          {summary.summary && (
            <p className="text-sm text-slate-200 leading-relaxed">{summary.summary}</p>
          )}

          <div className="flex items-center flex-wrap gap-2">
            {/* Sentiment badge */}
            {(() => {
              const cfg = SENTIMENT_CONFIG[String(summary.sentiment)] ?? SENTIMENT_CONFIG['0'];
              const Icon = cfg.icon;
              return (
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}>
                  <Icon size={11} />
                  {cfg.label}
                </span>
              );
            })()}

            {/* Flag chips */}
            {summary.flags.map(flag => (
              <span
                key={flag}
                className="text-xs px-2 py-0.5 rounded-full bg-slate-700/80 border border-slate-600/40 text-slate-300"
              >
                {flag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
