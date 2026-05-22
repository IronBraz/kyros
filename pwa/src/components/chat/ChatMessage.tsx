import React from 'react';
import { ChatMessage as ChatMessageType } from '@/types/chat';

interface Props {
  message: ChatMessageType;
}

export const ChatMessage: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';
  const isHandover = message.isHandover;

  if (isHandover) {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl px-4 py-3 max-w-[90%] text-sm text-teal-300 text-center leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`
          max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed animate-fade-in
          ${isUser
            ? 'bg-teal-500 text-slate-900 rounded-br-sm'
            : 'bg-slate-700/80 text-slate-100 rounded-bl-sm border border-slate-600/40'
          }
        `}
      >
        {message.content}
      </div>
    </div>
  );
};
