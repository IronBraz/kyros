import React, { useRef, useCallback } from 'react';
import { Send } from 'lucide-react';

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
}

export const ChatComposer: React.FC<Props> = ({ disabled, onSend }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const text = ref.current?.value.trim();
    if (!text || disabled) return;
    onSend(text);
    if (ref.current) ref.current.value = '';
  }, [disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2 p-3 border-t border-white/10 bg-slate-800/50">
      <textarea
        ref={ref}
        rows={1}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Chat unavailable' : 'Ask anything…'}
        className="flex-1 resize-none bg-slate-700/60 border border-slate-600/40 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/50 disabled:opacity-40 disabled:cursor-not-allowed max-h-24 overflow-auto"
        style={{ minHeight: '42px' }}
      />
      <button
        onClick={handleSend}
        disabled={disabled}
        className="min-w-[42px] min-h-[42px] rounded-xl bg-teal-500 text-slate-900 flex items-center justify-center hover:bg-teal-400 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Send"
      >
        <Send size={18} />
      </button>
    </div>
  );
};
