import type { SessionStatus, MarketingCard } from './shared';

// Client session data stored in Zustand
export interface SessionData {
  sessionId: string;
  ticketCode: string;
  storeId: string;
  storeName: string;
  position: number;
  estimatedWaitMinutes: number;
  createdAt: number;
}

// Re-export shared types for convenience
export type { SessionStatus, MarketingCard };
