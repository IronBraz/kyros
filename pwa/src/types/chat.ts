export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  isHandover?: boolean;
}

export type ChatCappedReason = 'turn' | 'budget' | null;

export interface SendMessageResponse {
  reply: string;
  message_count: number;
  capped: boolean;
  capped_reason: ChatCappedReason;
}

export interface StartConversationResponse {
  conversation_id: string;
  wiki_version?: string;
}
