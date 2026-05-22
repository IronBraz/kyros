import { create } from 'zustand';
import { ChatMessage, ChatCappedReason } from '@/types/chat';

interface ChatState {
  conversationId: string | null;
  messages: ChatMessage[];
  sending: boolean;
  capped: boolean;
  cappedReason: ChatCappedReason;
  error: string | null;
  abortController: AbortController | null;

  setConversationId: (id: string) => void;
  addMessage: (msg: ChatMessage) => void;
  setSending: (v: boolean) => void;
  setCapped: (reason: ChatCappedReason) => void;
  setError: (err: string | null) => void;
  setAbortController: (ac: AbortController | null) => void;
  abortPending: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversationId: null,
  messages: [],
  sending: false,
  capped: false,
  cappedReason: null,
  error: null,
  abortController: null,

  setConversationId: (id) => set({ conversationId: id }),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  setSending: (v) => set({ sending: v }),

  setCapped: (reason) => set({ capped: true, cappedReason: reason }),

  setError: (err) => set({ error: err }),

  setAbortController: (ac) => set({ abortController: ac }),

  abortPending: () => {
    const ac = get().abortController;
    if (ac) {
      ac.abort();
      set({ abortController: null, sending: false });
    }
  },

  reset: () => {
    get().abortPending();
    set({
      conversationId: null,
      messages: [],
      sending: false,
      capped: false,
      cappedReason: null,
      error: null,
      abortController: null,
    });
  },
}));
