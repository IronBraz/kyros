import { ApiResponse } from '@/types/shared';
import { StartConversationResponse, SendMessageResponse } from '@/types/chat';
import { API_BASE } from './shared';

export async function startConversation(
  sessionId: string,
  signal?: AbortSignal
): Promise<ApiResponse<StartConversationResponse>> {
  const res = await fetch(`${API_BASE}/api/v1/client/chat/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
    signal,
  });
  return res.json();
}

export async function sendChatMessage(
  conversationId: string,
  message: string,
  signal?: AbortSignal
): Promise<ApiResponse<SendMessageResponse>> {
  const res = await fetch(`${API_BASE}/api/v1/client/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId, message }),
    signal,
  });
  return res.json();
}
