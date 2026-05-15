// Kyros Admin API Client
import { ApiResponse } from '@/types/shared';
import { API_BASE, handleApiError } from './shared';

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
  const res = await fetch(`${API_BASE}/api/v1/admin/entry-points?store_id=${storeId}`);
  return res.json();
}

export async function createEntryPoint(storeId: string, name: string, slug: string): Promise<ApiResponse<{
  id: string;
  name: string;
  slug: string;
  url: string;
}>> {
  const res = await fetch(`${API_BASE}/api/v1/admin/entry-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_id: storeId, name, slug })
  });
  return res.json();
}

export async function deleteEntryPoint(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`${API_BASE}/api/v1/admin/entry-points/delete?id=${id}`, {
    method: 'DELETE'
  });
  return res.json();
}

// Queue
export async function getQueueStatus(storeId: string): Promise<ApiResponse<any>> {
  const res = await fetch(`${API_BASE}/api/v1/admin/queue/status?store_id=${storeId}`);
  return res.json();
}

export async function callNextCustomer(storeId: string): Promise<ApiResponse<any>> {
  const res = await fetch(`${API_BASE}/api/v1/admin/queue/call-next`, {
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
  const res = await fetch(`${API_BASE}/api/v1/admin/stores/settings?store_id=${storeId}`);
  return res.json();
}

export async function updateStoreSettings(storeId: string, settings: any): Promise<ApiResponse<any>> {
  const res = await fetch(`${API_BASE}/api/v1/admin/stores/settings?store_id=${storeId}`, {
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
  const res = await fetch(`${API_BASE}/api/v1/admin/marketing-cards?store_id=${storeId}`);
  return res.json();
}

export async function createMarketingCard(storeId: string, card: Omit<MarketingCardData, 'id' | 'isActive'>): Promise<ApiResponse<MarketingCardData>> {
  const res = await fetch(`${API_BASE}/api/v1/admin/marketing-cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_id: storeId, ...card })
  });
  return await handleApiError(res);
}

export async function updateMarketingCard(id: string, card: Partial<MarketingCardData>): Promise<ApiResponse<MarketingCardData>> {
  const res = await fetch(`${API_BASE}/api/v1/admin/marketing-cards?id=${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card)
  });
  return await handleApiError(res);
}

export async function deleteMarketingCard(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`${API_BASE}/api/v1/admin/marketing-cards?id=${id}`, {
    method: 'DELETE'
  });
  return res.json();
}

// Session Status
export async function updateSessionStatus(sessionId: string, status: 'serving' | 'finished' | 'missed'): Promise<ApiResponse<{
  session_id: string;
  ticket_code: string;
  status: string;
}>> {
  const res = await fetch(`${API_BASE}/api/v1/admin/sessions/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, status })
  });
  return res.json();
}
