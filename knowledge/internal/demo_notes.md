---
id: demo_notes
title: Kyros Pilot — Demo Notes
audience: internal
topics: [demo, pilot, kyros, ai, configuration, testing, budget]
updated_at: 2026-05-21
---

# Kyros Pilot Demo Notes (INTERNAL)

## What Is This?

Riserva Espresso is the demo store for the **Kyros AI Concierge Pilot** — a queue management system with an integrated AI chat assistant powered by Anthropic Claude (Haiku 4.5).

## AI Persona

- **Name**: None (assistant does not introduce itself by name unless directly asked)
- **Role**: "Riserva Espresso digital concierge"
- **Language**: **English** (all chat in EN — owner decision 2026-05-20)
- **Tone**: warm, professional, concise (max 2–3 sentences per reply)

## Budget Cap

- Hard monthly cap: **€3.00** on Anthropic API usage
- Approx. 150 full conversations per month at typical usage
- Counter visible in Admin Settings panel (F8 task)
- If cap is reached: AI returns canned message — queue system continues normally

## Conversation Limits

- Max **30 messages per conversation** (15 user + 15 assistant turns)
- Beyond limit: canned message — *"We've chatted plenty! Your turn is coming up soon — see you at the desk."*

## Handover Flow (Mid-Chat Called)

When a customer's ticket is called while in chat:
1. Chat panel shows: *"Thanks! I've shared a summary with the assistant. Please head to Desk [N]."*
2. An async summary + sentiment score is generated and shown in the Control Room
3. Staff reads the summary to prepare for the customer interaction

## Content Disclaimer

All product information, prices, and policies in this wiki are **demo placeholders**. Content is plausible but entirely invented. The owner will replace with real content before any real customer deployment.

## Known Pilot Limitations

- No real capsule compatibility matrix (simplified for demo)
- Prices are illustrative only
- Workshop calendar is fictitious
- Loyalty point balance is not tracked in this pilot (stub only)
- No image assets — all branding is CSS + text

[[staff_notes]] | [[pricing_internal]]
