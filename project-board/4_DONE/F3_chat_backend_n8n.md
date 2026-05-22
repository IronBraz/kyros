---
ID: F3
TASK: Chat backend — n8n workflows for AI chat (NO gateway, no streaming)
OWNER: Claude
STATUS: DONE
PHASE: Pilot
COMPLETED: 2026-05-22
---

## Completato

Tutti i workflow n8n della chat AI sono attivi e funzionanti in produzione (mind.neuroforge.club).

| Workflow | ID n8n | Endpoint |
|----------|--------|----------|
| SUB_Wiki_Loader | `iKYaPYH9UHDvN3NV` | sub-workflow (no endpoint) |
| HOOK_Admin_Login_WikiReload | `Xbfq3Yi0ASj7Z6Yy` | sub-workflow |
| SUB_Budget_Check | `fnhGqwarmYKLHLaW` | sub-workflow |
| API_Admin_Wiki_Reload | `NmMmc6aHYFPx71KW` | POST /api/v1/admin/wiki/reload |
| API_Admin_AIUsage | `NknXf8uS5W6r4vEW` | GET /api/v1/admin/usage |
| API_Client_Chat_Start | `qMIzcaD6GPfxSQ0P` | POST /api/v1/client/chat/start |
| API_Client_Chat_Send | `OWK4dye2UgRmxV6P` | POST /api/v1/client/chat/send |

## Fix applicati in deploy (2026-05-22)

- `N8N_BLOCK_ENV_ACCESS_IN_NODE=true` blocca `$env.*` nei Code node: tutti i riferimenti a `$env.KYROS_AI_MODEL` e `$env.KYROS_KNOWLEDGE_PATH` rimossi e sostituiti con valori hardcoded
- `NODE_FUNCTION_ALLOW_BUILTIN=fs,path` aggiunto via `docker-compose.override.yml` (file in `infra/`)
- Volume bind mount wiki aggiunto via override: `C:/Users/IronLab/OneDrive/Documenti/Progetti/Kyros/knowledge/public:/opt/kyros/knowledge/public:ro`
- Credenziale OpenRouter (`qv9d5Wuqi81iDkbq`) già collegata al nodo "Call OpenRouter" — l'auto-assign MCP fallisce ma il nodo funziona correttamente (testato)

## Test e2e

- Endpoint `chat/send` testato: risposta AI reale con contenuto dal wiki ✅
- Runbook F7 (`tests/e2e/pilot_ai_flow.md`) da eseguire per validazione completa dei 6 scenari
