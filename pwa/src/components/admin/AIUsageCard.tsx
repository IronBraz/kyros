import React, { useState, useEffect } from 'react';
import { Zap, TrendingUp } from 'lucide-react';
import { getAIUsage } from '@/lib/api/admin';
import { AIUsage } from '@/types/admin';

interface Props {
  storeId: string;
}

const BUDGET_EUR = 3.0;
const POLL_INTERVAL_MS = 30_000;

export const AIUsageCard: React.FC<Props> = ({ storeId }) => {
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = async () => {
    try {
      const res = await getAIUsage(storeId);
      if (res.success && res.data) {
        setUsage({
          year_month: res.data.year_month,
          total_input_tokens: res.data.total_input_tokens,
          total_output_tokens: res.data.total_output_tokens,
          total_cost_eur: res.data.total_cost_eur,
        });
      }
    } catch {
      // silently keep stale data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const costEur = usage?.total_cost_eur ?? 0;
  const pct = Math.min((costEur / BUDGET_EUR) * 100, 100);
  const totalTokens = (usage?.total_input_tokens ?? 0) + (usage?.total_output_tokens ?? 0);

  const barColor =
    pct >= 90 ? 'bg-red-500' :
    pct >= 70 ? 'bg-amber-400' :
    'bg-teal-400';

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
        <Zap size={18} className="text-teal-400" />
        <h3 className="text-base font-serif font-bold text-slate-50">AI Usage</h3>
        {usage && (
          <span className="ml-auto text-xs text-slate-500 font-mono">{usage.year_month}</span>
        )}
      </div>

      {loading && !usage ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-slate-700 rounded-full w-3/4" />
          <div className="h-2 bg-slate-700/60 rounded-full" />
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-2xl font-mono font-bold text-slate-50">
                €{costEur.toFixed(3)}
              </span>
              <span className="text-sm text-slate-500 ml-1">/ €{BUDGET_EUR.toFixed(0)}</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                <TrendingUp size={11} />
                {(totalTokens / 1000).toFixed(1)}k tokens
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>{pct.toFixed(1)}% of monthly budget</span>
              {pct >= 90 && (
                <span className="text-red-400 font-medium">Near limit</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div>
              <span className="block text-slate-400 font-medium">{(usage?.total_input_tokens ?? 0).toLocaleString()}</span>
              input tokens
            </div>
            <div>
              <span className="block text-slate-400 font-medium">{(usage?.total_output_tokens ?? 0).toLocaleString()}</span>
              output tokens
            </div>
          </div>
        </>
      )}
    </div>
  );
};
