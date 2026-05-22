import React, { useState } from 'react';
import { BookOpen, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { reloadWiki } from '@/lib/api/admin';
import { WikiStatus } from '@/types/admin';

interface Props {
  storeId: string;
}

export const WikiReloadCard: React.FC<Props> = ({ storeId }) => {
  const [status, setStatus] = useState<WikiStatus>('idle');
  const [version, setVersion] = useState<string | null>(null);

  const handleReload = async () => {
    if (status === 'loading') return;
    setStatus('loading');
    try {
      const res = await reloadWiki(storeId);
      if (res.success) {
        setStatus('loaded');
        setVersion(res.data?.wiki_version || null);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
        <BookOpen size={18} className="text-teal-400" />
        <h3 className="text-base font-serif font-bold text-slate-50">Knowledge Base</h3>
        {status === 'loaded' && (
          <span className="ml-auto text-xs text-teal-400 bg-teal-400/10 border border-teal-400/20 px-2 py-0.5 rounded-full">Reloaded</span>
        )}
        {status === 'error' && (
          <span className="ml-auto text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">Failed</span>
        )}
      </div>

      <p className="text-sm text-slate-400 leading-relaxed">
        Reload the AI concierge knowledge base from store documentation. Use this after updating product info or store policies.
      </p>

      {status === 'loaded' && version && (
        <div className="flex items-center gap-2 text-xs text-teal-300">
          <CheckCircle size={13} />
          <span>Wiki updated · version {version}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertTriangle size={13} />
          <span>Reload failed — check n8n logs.</span>
        </div>
      )}

      <button
        onClick={handleReload}
        disabled={status === 'loading'}
        className="mt-auto flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-teal-500/30 text-teal-400 text-sm font-medium hover:bg-teal-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw size={15} className={status === 'loading' ? 'animate-spin' : ''} />
        {status === 'loading' ? 'Reloading…' : 'Reload Wiki'}
      </button>
    </div>
  );
};
