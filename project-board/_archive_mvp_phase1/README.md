# Archive — MVP Phase 1 stale tasks

These task files were left over from the MVP Phase 1 ("Store Flow Foundation") handoff. By **2026-05-20** the MVP was confirmed working by the owner (Gualtiero Brazzelli) and the codebase had moved beyond the state these files describe:

- **014_test_deploy_https** — Smoke test of HTTPS / SPA routing. App is live and serving over HTTPS; this test is implicitly passed.
- **017_admin_pwa_api_layer** — "Create API client for Admin PWA". File already exists at `pwa/src/lib/api/admin.ts` (and `client.ts` for the client side).
- **018_rebuild_redeploy** — Rebuild and redeploy PWA after API integration. Done as part of the deploy that made the app live.
- **019_test_end_to_end** — End-to-end MVP validation. Owner confirmed the app works; formal scripted E2E was never executed but the functional state is verified.

The files reference an older repo layout (`OUTPUT/pwa/FRONT/Kyros`, `OUTPUT/pwa/BACK/Kyros---Admin`) that was consolidated into the current unified `pwa/` directory during the 2026-05-15 refactoring (see `_local/Refactoring_del_2026_05_15.md`).

They are kept here as historical context — **do not work from these files**. The current focus is the **Pilot phase**: see `specs/Pilot_Handover.md` and the new `1_TODO/F1`-`F7` task files.
