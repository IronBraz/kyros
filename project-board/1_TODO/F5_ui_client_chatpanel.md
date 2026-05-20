---
ID: F5
TASK: UI cliente — ChatPanel con animazione "AI sta scrivendo"
OWNER: Claude (next session)
STATUS: TODO
PHASE: Pilot
DEPENDS_ON: F3 (chat backend deve rispondere)
ESTIMATE: 1-2 days
---

## 1. Contesto e Obiettivo

Aggiungere alla WaitingRoom del cliente un pannello di chat con l'AI. Versione semplificata rispetto al doc originale: niente streaming SSE, solo request-response con indicatore "sta scrivendo" (decisione owner 2026-05-20).

- **Riferimento Master:** `specs/Pilot_Handover.md` §7 F5 (con modifiche per opzione C — no streaming)
- **Memoria progetto:** `project-pilot-approach-decision`
- **Obiettivo:** Cliente in coda apre ChatPanel, scrive in inglese, vede "●●●" per 3-5s, poi appare la risposta dell'AI.

## 2. Specifiche Tecniche

### Nuovi componenti (in `pwa/src/`)

- `components/chat/ChatPanel.tsx` — bottom sheet collassabile stile WhatsApp, integrato in `WaitingRoom.tsx`
- `components/chat/ChatMessage.tsx` — bubble user/assistant con stile glass-card coerente
- `components/chat/ChatComposer.tsx` — textarea + send button, disabled durante sending
- `components/chat/TypingIndicator.tsx` — tre puntini animati pulsanti
- `store/useChatStore.ts` — Zustand store: `{ conversationId, messages, sending, error }` con methods `startConversation`, `sendMessage`, `reset`
- `lib/api/chat.ts` — fetch helpers per `/chat/start` e `/chat/send` (no ReadableStream, no SSE)
- `types/chat.ts` — interfaces

### Modifica a `WaitingRoom.tsx`

- Importare `<ChatPanel sessionId={sessionId} />`
- Reset chat su `clearSession`
- Layout: ChatPanel come bottom sheet che si apre/chiude, coda in alto

### UX flow

1. Cliente vede pulsante "Chat with us" o icona chat
2. Click → ChatPanel si espande, chiamata a `/chat/start` se `conversationId` non in store
3. Empty state: messaggio di benvenuto dell'AI hardcoded ("Hi! I'm your assistant. While you wait, ask me anything about the store.")
4. Cliente scrive → composer disabled, TypingIndicator visibile
5. Risposta arriva → TypingIndicator nascosto, ChatMessage appare con animazione fade-in
6. Se cap turn raggiunto: AI risponde "We've chatted enough — your turn is coming up soon!" e composer si disabilita

### Stati da gestire

- **Empty**: prima apertura, solo welcome message
- **Loading**: dopo `/chat/start`, prima del primo messaggio
- **Sending**: messaggio inviato, in attesa risposta (mostra TypingIndicator)
- **Error**: errore di rete → toast + retry button
- **Capped**: turn cap raggiunto, composer disabled con messaggio

### File Coinvolti

- `pwa/src/components/chat/ChatPanel.tsx` — Nuovo
- `pwa/src/components/chat/ChatMessage.tsx` — Nuovo
- `pwa/src/components/chat/ChatComposer.tsx` — Nuovo
- `pwa/src/components/chat/TypingIndicator.tsx` — Nuovo
- `pwa/src/store/useChatStore.ts` — Nuovo
- `pwa/src/lib/api/chat.ts` — Nuovo
- `pwa/src/types/chat.ts` — Nuovo
- `pwa/src/routes/client/WaitingRoom.tsx` — Modifica

## 3. Vincoli e Convenzioni

- Lingua UI chat: **English** (placeholder, button text, error messages)
- Design system: Tailwind, Glass Card, Lucide icons, no immagini
- Touch targets ≥ 44x44px
- WCAG 2.1 AA: contrasti, focus ring
- Sessione recovery: se cliente refresha la pagina, `conversationId` da localStorage (`kyros_session.chat_conversation_id`)
- Niente Socket.io, niente ReadableStream, niente EventSource

## 4. Definition of Done

- [ ] ChatPanel apribile/chiudibile da WaitingRoom
- [ ] Welcome message visibile a apertura
- [ ] Invio messaggio → TypingIndicator → risposta AI (3-5s realistici)
- [ ] Storia conversazione persistente tra collassi/espansioni
- [ ] Refresh pagina → conversazione recuperata via conversationId in localStorage
- [ ] Stati empty/loading/sending/error/capped tutti gestiti graficamente
- [ ] Niente errori console in flusso happy path
- [ ] Build production senza errori: `cd pwa && npm run build`
- [ ] Test mobile: usabile da smartphone (touch, soft keyboard non copre composer)

## Note per la prossima sessione

- L'attesa 3-5s con TypingIndicator è "accettabile per demo interna" (decisione owner). Se l'animazione è curata, il cliente capisce che è normale.
- Se vuoi un effetto extra "wow", aggiungi un sottile "thinking…" sotto i puntini durante l'attesa.
