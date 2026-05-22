import React, { useEffect, useRef, useCallback, useState } from 'react';
import { MessageCircle, X, ChevronDown } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useSessionStore } from '@/store/useSessionStore';
import { startConversation, sendChatMessage } from '@/lib/api/chat';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { ChatMessage } from './ChatMessage';
import { ChatComposer } from './ChatComposer';
import { TypingIndicator } from './TypingIndicator';

interface Props {
  sessionId: string;
  isCalled: boolean;
  assignedDesk?: string | null;
}

const WELCOME = "Hi! I'm your concierge. While you wait, ask me anything about the store, our coffee, machines or accessories.";

export const ChatPanel: React.FC<Props> = ({ sessionId, isCalled, assignedDesk }) => {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    conversationId, messages, sending, capped, error,
    setConversationId, addMessage, setSending, setCapped,
    setError, setAbortController, abortPending, reset
  } = useChatStore();

  const setAiConversationId = useSessionStore(s => s.setAiConversationId);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  // Handle ticket called — show handover message then navigate
  useEffect(() => {
    if (!isCalled || !open) return;
    abortPending();
    const desk = assignedDesk || 'the desk';
    addMessage({
      id: `handover-${Date.now()}`,
      role: 'assistant',
      content: `Thanks for chatting! I've shared a summary of our conversation with the store assistant. **Please head to ${desk}** — they'll be ready for you.`,
      timestamp: Date.now(),
      isHandover: true,
    });
  }, [isCalled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset on unmount
  useEffect(() => () => { abortPending(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openPanel = async () => {
    setOpen(true);
    if (conversationId || starting) return;

    setStarting(true);
    try {
      const res = await startConversation(sessionId);
      if (res.success && res.data?.conversation_id) {
        setConversationId(res.data.conversation_id);
        setAiConversationId(res.data.conversation_id);
      } else {
        setError('Could not start chat. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const closePanel = () => setOpen(false);

  const handleSend = useCallback(async (text: string) => {
    if (!conversationId || capped || isCalled) return;

    const userMsg: ChatMessageType = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addMessage(userMsg);
    setSending(true);
    setError(null);

    const ac = new AbortController();
    setAbortController(ac);

    try {
      const res = await sendChatMessage(conversationId, text, ac.signal);
      if (res.success && res.data) {
        addMessage({
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.data.reply,
          timestamp: Date.now(),
        });
        if (res.data.capped) {
          setCapped(res.data.capped_reason);
        }
      } else {
        const code = (res.error as any)?.code;
        if (code === 'WIKI_NOT_LOADED') {
          setError('Knowledge base loading, please try in a few seconds…');
        } else {
          setError('Our concierge is briefly unavailable — please try again in a moment.');
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError('Our concierge is briefly unavailable — please try again in a moment.');
      }
    } finally {
      setSending(false);
      setAbortController(null);
    }
  }, [conversationId, capped, isCalled, addMessage, setSending, setError, setCapped, setAbortController]);

  const composerDisabled = sending || capped || isCalled || !conversationId || starting;

  const cappedMessage =
    useChatStore.getState().cappedReason === 'budget'
      ? "Our concierge is taking a break right now. Please ask the assistant when it's your turn."
      : "We've chatted plenty! Your turn is coming up soon — see you at the desk.";

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={openPanel}
          className="fixed bottom-24 right-6 z-40 min-w-[56px] min-h-[56px] rounded-full bg-teal-500 text-slate-900 shadow-lg shadow-teal-500/30 flex items-center justify-center hover:bg-teal-400 active:scale-95 transition-all"
          aria-label="Open chat"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-slate-900 border-t border-white/10 shadow-2xl"
          style={{ maxHeight: '70vh', minHeight: '40vh' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-800/80 flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-teal-400" />
              <span className="text-sm font-semibold text-slate-100">Store Concierge</span>
              {(capped || isCalled) && (
                <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">Session ended</span>
              )}
            </div>
            <button onClick={closePanel} className="text-slate-400 hover:text-slate-200 p-1" aria-label="Close">
              <ChevronDown size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1 min-h-0">
            {/* Welcome */}
            {messages.length === 0 && !starting && (
              <ChatMessage
                message={{ id: 'welcome', role: 'assistant', content: WELCOME, timestamp: 0 }}
              />
            )}

            {starting && (
              <div className="text-center text-slate-500 text-sm py-4 italic">Starting chat…</div>
            )}

            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}

            {sending && <TypingIndicator />}

            {error && (
              <div className="flex justify-center">
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-2 mt-2 max-w-[90%] text-center">
                  {error}
                  <button
                    onClick={() => setError(null)}
                    className="ml-2 underline text-red-300 text-xs"
                  >Dismiss</button>
                </div>
              </div>
            )}

            {capped && (
              <div className="flex justify-center mt-2">
                <div className="bg-slate-700/60 border border-slate-600/40 text-slate-400 text-sm rounded-xl px-4 py-2 max-w-[90%] text-center italic">
                  {cappedMessage}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="flex-shrink-0">
            <ChatComposer disabled={composerDisabled} onSend={handleSend} />
          </div>
        </div>
      )}
    </>
  );
};
