// Unified MarketingCard type (API contract from BACK + actionUrl from FRONT)
export interface MarketingCard {
  id: string;
  type: 'PROMO' | 'TRIVIA' | 'BRAND' | 'INFO';
  title: string;
  content: string;
  icon: string;  // Lucide icon name (e.g., "Gift", "Star")
  theme: 'blue' | 'purple' | 'green' | 'orange';
  priority: number;
  isActive: boolean;
  actionUrl?: string;  // Optional CTA link (from FRONT)
}

// Session status for client queue management
export type SessionStatus =
  | 'idle'
  | 'waiting'
  | 'called'
  | 'serving'
  | 'finished'
  | 'abandoned';

// Standard API response format
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    data?: any
  };
  meta?: {
    timestamp: string;
    request_id?: string;
  };
}
