// Kyros Admin API Client
import { ApiResponse } from '@/types/shared';
import { API_BASE, handleApiError } from './shared';

// The server requires X-Admin-Session on every admin route except auth/verify and
// auth/stores. specs/05_Infra_Architecture.md asked for this header from the start, but the
// frontend never sent it and the backend never checked it -- so the Control Room was open
// to anyone who knew the URL.
function adminHeaders(extra?: HeadersInit): Record<string, string> {
  const raw = localStorage.getItem('kyros_admin_session');
  let token = '';
  try {
    token = raw ? (JSON.parse(raw).token ?? JSON.parse(raw).session_token ?? '') : '';
  } catch {
    token = '';
  }
  return {
    'Content-Type': 'application/json',
    'X-Admin-Session': token,
    ...(extra as Record<string, string> | undefined),
  };
}

/**
 * Every authenticated admin call goes through here, which is what makes the header
 * impossible to forget on a new endpoint.
 *
 * A 401 clears the stored session and bounces to the login screen. That also fixes a
 * pre-existing bug: AdminProtectedLayout only checks the expiry on mount, so a session that
 * expired while the tab sat open was never noticed until a manual reload.
 */
async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: adminHeaders(init?.headers),
  });
  if (res.status === 401) {
    localStorage.removeItem('kyros_admin_session');
    if (!window.location.pathname.startsWith('/control-room/login')) {
      window.location.href = '/control-room/login';
    }
  }
  return res;
}

// Auth
export async function verifyPin(storeId: string, accessCode: string): Promise<ApiResponse<{
  session_token: string;
  store_id: string;
  store_name: string;
  label: string;
  expires_at: string;
}>> {
  const res = await fetch(`${API_BASE}/api/v1/admin/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_id: storeId, access_code: accessCode })
  });
  return res.json();
}

export async function getStores(): Promise<ApiResponse<{
  stores: { id: string; name: string }[] | { id: string; name: string };
}>> {
  const res = await fetch(`${API_BASE}/api/v1/admin/auth/stores`);
  return res.json();
}

// Entry Points
export async function getEntryPoints(storeId: string): Promise<ApiResponse<{
  entry_points: Array<{ id: string; name: string; slug: string; url: string; created_at: string }>;
}>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/entry-points?store_id=${storeId}`);
  return res.json();
}

export async function createEntryPoint(storeId: string, name: string, slug: string): Promise<ApiResponse<{
  id: string;
  name: string;
  slug: string;
  url: string;
}>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/entry-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_id: storeId, name, slug })
  });
  return res.json();
}

export async function deleteEntryPoint(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/entry-points/delete?id=${id}`, {
    method: 'DELETE'
  });
  return res.json();
}

// Queue
export async function getQueueStatus(storeId: string): Promise<ApiResponse<any>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/queue/status?store_id=${storeId}`);
  return res.json();
}

export async function callNextCustomer(storeId: string): Promise<ApiResponse<any>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/queue/call-next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_id: storeId })
  });
  return res.json();
}

// Settings
export async function getStoreSettings(storeId: string): Promise<ApiResponse<{
  store_id: string;
  store_name: string;
  settings: any;
}>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/stores/settings?store_id=${storeId}`);
  return res.json();
}

export async function updateStoreSettings(storeId: string, settings: any): Promise<ApiResponse<any>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/stores/settings?store_id=${storeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  return res.json();
}

// Marketing Cards
export interface MarketingCardData {
  id: string;
  type: string;
  title: string;
  content: string;
  icon: string;
  theme: string;
  priority: number;
  isActive: boolean;
}

export async function getMarketingCards(storeId: string): Promise<ApiResponse<{ cards: MarketingCardData[] }>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/marketing-cards?store_id=${storeId}`);
  return res.json();
}

export async function createMarketingCard(storeId: string, card: Omit<MarketingCardData, 'id' | 'isActive'>): Promise<ApiResponse<MarketingCardData>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/marketing-cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_id: storeId, ...card })
  });
  return await handleApiError(res);
}

export async function updateMarketingCard(id: string, card: Partial<MarketingCardData>): Promise<ApiResponse<MarketingCardData>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/marketing-cards?id=${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card)
  });
  return await handleApiError(res);
}

export async function deleteMarketingCard(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/marketing-cards?id=${id}`, {
    method: 'DELETE'
  });
  return res.json();
}

// AI Pilot features
export async function reloadWiki(storeId: string): Promise<ApiResponse<{ status: string; wiki_version?: string }>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/wiki/reload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_id: storeId })
  });
  return res.json();
}

export async function getAIUsage(storeId: string): Promise<ApiResponse<{
  year_month: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_eur: number;
}>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/usage?store_id=${storeId}`);
  return res.json();
}

// Session Status
export async function updateSessionStatus(sessionId: string, status: 'called' | 'serving' | 'finished' | 'missed'): Promise<ApiResponse<{
  session_id: string;
  ticket_code: string;
  status: string;
}>> {
  const res = await adminFetch(`${API_BASE}/api/v1/admin/sessions/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, status })
  });
  return res.json();
}
