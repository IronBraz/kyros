import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SessionStatus, SessionData, MarketingCard } from '@/types/client';

interface SessionState {
  // Session Data
  sessionId: string | null;
  ticketCode: string | null;
  storeName: string | null;
  storeId: string | null;
  assignedDesk: string | null;

  // Queue State
  status: SessionStatus;
  position: number | null;
  estimatedWaitMinutes: number | null;

  // Content
  marketingCards: MarketingCard[];

  // Actions
  createSession: (data: SessionData) => void;
  updateQueuePosition: (position: number, estimate: number) => void;
  setAssignedDesk: (desk: string) => void;
  setStatus: (status: SessionStatus) => void;
  setMarketingCards: (cards: MarketingCard[]) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessionId: null,
      ticketCode: null,
      storeName: null,
      storeId: null,
      assignedDesk: null,
      status: 'idle',
      position: null,
      estimatedWaitMinutes: null,
      marketingCards: [],

      createSession: (data) => set({
        sessionId: data.sessionId,
        ticketCode: data.ticketCode,
        storeName: data.storeName,
        storeId: data.storeId,
        position: data.position,
        estimatedWaitMinutes: data.estimatedWaitMinutes,
        status: 'waiting',
        assignedDesk: null
      }),

      updateQueuePosition: (position, estimate) => set({
        position,
        estimatedWaitMinutes: estimate
      }),

      setAssignedDesk: (desk) => set({ assignedDesk: desk }),

      setStatus: (status) => set({ status }),

      setMarketingCards: (cards) => set({ marketingCards: cards }),

      clearSession: () => set({
        sessionId: null,
        ticketCode: null,
        storeName: null,
        storeId: null,
        status: 'idle',
        position: null,
        estimatedWaitMinutes: null,
        marketingCards: [],
        assignedDesk: null
      })
    }),
    {
      name: 'kyros_session',
      partialize: (state) => ({
        sessionId: state.sessionId,
        ticketCode: state.ticketCode,
        storeName: state.storeName,
        storeId: state.storeId,
        status: state.status,
        assignedDesk: state.assignedDesk
      })
    }
  )
);
