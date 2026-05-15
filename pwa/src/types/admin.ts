import type { MarketingCard } from './shared';

// Store information
export interface Store {
  id: string;
  name: string;
}

// Customer in queue
export interface Customer {
  id: string;
  ticketCode: string;
  position: number;
  joinTime: string; // ISO string
  status: 'waiting' | 'called' | 'served' | 'missed' | 'abandoned';
  calledAt?: string;
  missedAt?: string;
  entryPointName?: string; // Name of entry point used
}

// Entry point (QR/NFC entry location)
export interface EntryPoint {
  id: string;
  name: string;
  slug: string;
  url: string;
}

// Queue statistics
export interface QueueStats {
  waitingCount: number;
  calledCount: number;
  avgWaitMinutes: number;
  totalCustomers: number;
  abandonmentRate: number;
  servedCount: number;
  missedCount: number;
}

// Store settings
export interface StoreSettings {
  acceptingTickets: boolean;
  closedMessage: string;
  avgServiceTime: number;
  ghostTimeout: number;
  calledTimeout: number;
  welcomeMessage: string;
  callSound: string;
  language: string;
}

// Admin view mode
export type ViewMode = 'counter' | 'analytics' | 'zones' | 'content' | 'settings';

// Re-export shared types for convenience
export type { MarketingCard };
