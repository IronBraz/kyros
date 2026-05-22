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
3. Empty state: messaggio di benvenuto dell'AI hardcoded ("Hi! I'm your concierge. While you wait, ask me anything about the store, our coffee, machines or accessories.")
4. Cliente scrive → composer disabled, TypingIndicator visibile
5. Risposta arriva → TypingIndicator nascosto, ChatMessage appare con animazione fade-in
6. Se cap turn raggiunto (30 msg totali): canned response "We've chatted plenty! Your turn is coming up soon — see you at the desk." e composer disabled
7. Se budget cap raggiunto: canned response "Our concierge is taking a break right now. Please ask the assistant when it's your turn." e composer disabled

### Comportamento al TICKET_CALLED (handover all'assistant) — **flusso chiave del Pilot**

Quando il polling rileva `session.status === 'called'` mentre la chat è aperta:

1. **NON** navigare immediatamente a `/your-turn` (perderebbe il messaggio in composer e sorprenderebbe l'utente)
2. ChatPanel mostra un messaggio finale dall'"assistente" (rendering speciale, non viene salvato in DB):
   > *"Thanks for chatting! I've shared a summary of our conversation with the store assistant. **Please head to Desk {assigned_desk}** — they'll be ready for you."*
3. Composer disabilitato, TypingIndicator nascosto, eventuali fetch in volo abortiti (`AbortController`)
4. Dopo **3 secondi** di pausa visiva (l'utente legge), navigate automatico a `/your-turn`. In alternativa, lasciare la chat in lettura e affidare il navigate al normale handler della WaitingRoom (decisione finale in implementazione).
5. **Non c'è confirm dialog** — il messaggio è già la conferma visiva.

### Stati da gestire

- **Empty**: prima apertura, solo welcome message
- **Loading**: dopo `/chat/start`, prima del primo messaggio
- **Sending**: messaggio inviato, in attesa risposta (mostra TypingIndicator)
- **Error**: errore di rete → toast + retry button
- **Anthropic 5xx**: risposta canned "Our concierge is briefly unavailable — please try again in a moment." + retry button
- **Capped (turn)**: turn cap raggiunto, composer disabled con messaggio canned
- **Capped (budget)**: budget cap raggiunto, composer disabled con messaggio canned (lato server F3 ritorna `capped_reason='budget'`)
- **Wiki not loaded**: se `/chat/send` ritorna error per wiki vuota, fallback "Knowledge base loading, please try in a few seconds..."
- **Called (handover)**: schermata "thanks + desk N" come da sezione sopra

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

- Lingua UI chat: **English** (placeholder, button text, error messages, canned responses)
- Design system: Tailwind, Glass Card, Lucide icons, no immagini
- Touch targets ≥ 44x44px
- WCAG 2.1 AA: contrasti, focus ring
- Sessione recovery: `conversationId` **deve essere persistito** in `useSessionStore.partialize` (oggi non lo è). Se cliente refresha la pagina, ChatPanel ricarica i messaggi via `GET /chat/history?conversation_id=...` (endpoint da definire in F3 — opzionale ma raccomandato).
- **AbortController obbligatorio**: ogni fetch verso `/chat/send` usa un `AbortController` salvato nello store. Su unmount della ChatPanel (o su transition a `called`), il controller viene abortito per evitare React "Can't update state on unmounted component" warning e per liberare memoria.
- Niente Socket.io, niente ReadableStream, niente EventSource

## 4. Definition of Done

- [ ] ChatPanel apribile/chiudibile da WaitingRoom
- [ ] Welcome message visibile a apertura
- [ ] Invio messaggio → TypingIndicator → risposta AI (3-5s realistici)
- [ ] Storia conversazione persistente tra collassi/espansioni
- [ ] Refresh pagina → `conversationId` recuperato da localStorage e messaggi ricaricati (no doppia conversazione creata)
- [ ] **Handover al TICKET_CALLED funziona**: cliente in chat + admin Call Next → ChatPanel mostra schermata "thanks + desk N" entro un ciclo di polling, niente messaggio perso, niente errori console
- [ ] **AbortController** abortisce richieste pendenti su unmount / transition a `called`
- [ ] Stati empty/loading/sending/error/capped-turn/capped-budget/wiki-not-loaded/anthropic-5xx tutti gestiti graficamente
- [ ] Niente errori console in flusso happy path
- [ ] Build production senza errori: `cd pwa && npm run build`
- [ ] Test mobile: usabile da smartphone (touch, soft keyboard non copre composer)

## Note per la prossima sessione

- L'attesa 3-5s con TypingIndicator è "accettabile per demo interna" (decisione owner). Se l'animazione è curata, il cliente capisce che è normale.
- Se vuoi un effetto extra "wow", aggiungi un sottile "thinking…" sotto i puntini durante l'attesa.
