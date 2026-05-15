// Kyros Client API
import { ApiResponse } from '@/types/shared';
import { API_BASE } from './shared';

export interface SessionData {
  session_id: string;
  ticket_code: string;
  status: string;
  position: number;
  store_id: string;
  store_name: string;
  created_at: string;
  service_point_name?: string;
  called_at?: string;
  estimated_wait_minutes?: number;
}

// Create a new queue session
export async function createSession(entryPointId: string, language: string = 'it'): Promise<ApiResponse<SessionData>> {
  const res = await fetch(`${API_BASE}/api/v1/client/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry_point_id: entryPointId, language })
  });
  return res.json();
}

// Get session status (for recovery)
export async function getSession(sessionId: string): Promise<ApiResponse<SessionData>> {
  const res = await fetch(`${API_BASE}/api/v1/client/sessions?session_id=${sessionId}`);
  return res.json();
}

// Send heartbeat
export async function sendHeartbeat(sessionId: string): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await fetch(`${API_BASE}/api/v1/client/sessions/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId })
  });
  return res.json();
}

// Abandon session
export async function abandonSession(sessionId: string): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await fetch(`${API_BASE}/api/v1/client/sessions/abandon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId })
  });
  return res.json();
}

// Get marketing cards
export async function getMarketingCards(storeId: string): Promise<ApiResponse<{ cards: any[] }>> {
  const res = await fetch(`${API_BASE}/api/v1/client/marketing-cards?store_id=${storeId}`);
  return res.json();
}
