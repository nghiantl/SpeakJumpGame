# Phase G.5 — Automatic Cloud Sync & Conflict Resolution

## Scope
- Automatic sync on app startup, approximately every 12 seconds, focus/visibility and reconnection; users can retry manually.
- Existing G.2 `player_cloud_saves` and `write_player_cloud_save` RPC provide revision-based compare-and-swap. **No new Supabase migration is required.** G.1–G.4 schemas/RPCs are unchanged.
- Per-account persistent offline pending marker (`speak-jump-g5-pending-<userId>`); local v1 storage remains the source for offline gameplay. The queue is a coalesced pending-snapshot marker, **not** a durable event-by-event log.
- Up to four attempts to reload/merge/retry on optimistic revision conflict.
- Auto-merge is written to localStorage and followed by a page reload **only outside gameplay and Smart Review** to avoid overwriting React/Phaser in-memory state.
- Login/account changes suspend auto-sync until the user explicitly confirms moving local data to a new account. Manual G.2 save/restore remains available.
- Sync status banner: syncing, synced, pending, offline, error, account switch; last sync and retry.
- No change to G.4 server-accepted score ledger or verified rankings.

## Merge rules
- Progress: max XP/checkpoint/coins, union completed worlds; local non-default profile name/photo takes precedence.
- Engagement: max best combo; union bonus/daily date keys.
- Rewards: union chest IDs; daily same-date counters use MAX (not SUM); claim flag OR; total challenges MAX. This avoids duplicate claims, but **independent offline activities on separate devices may be undercounted** because G.2 daily totals lack per-action IDs.
- Analytics: union events by ID, sort by timestamp and retain newest 500; world summary counts MAX, lastPlayed latest. New analytics IDs use random UUID where supported to avoid cross-device collisions.
- Smart Review: merge by (world,challenge); max attempts/successes/misses/bestScore; most recently practiced entry supplies dueAt/lastScore. **Independent attempts may be undercounted**, because historical review counters are aggregates rather than an event ledger.
- Cloud payload remains v1 and is constrained to <100 KB by G.2 SQL; large avatars/analytics may exceed that limit. Sync shows an error and retains local data. No silent truncation beyond existing analytics 500-event cap.
- Local reset is **not** a global cloud deletion; monotonic merge may restore previous progress. Use manual cloud management if a true account-wide reset is needed.
- Concurrent edits to profile name/photo or selected world are not fully conflict-free: local device takes precedence.

## Preview setup
1. Confirm G.2 migration `202611130002_g2_cloud_progress.sql` already applied. **Do not rerun a new migration**; G.5 requires none.
2. Confirm Preview env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; anonymous sign-in and Email OTP remain enabled.
3. Deploy branch `feat/phase-g5-auto-cloud-sync` on Vercel Preview.
4. Inspect Vercel build output, browser Console/Network, and Supabase RPC errors.

## UAT checklist
- [ ] Preview build and page render succeed.
- [ ] First visit syncs local snapshot to cloud without manual button.
- [ ] Checkpoint and rewards upload automatically after periodic sync; no gameplay interruption.
- [ ] Second device signed into the **same account** receives merged progress after sync and reload.
- [ ] Offline progress remains playable; reconnect eventually syncs.
- [ ] Concurrent device changes cause revision conflict and successful retry without losing completed worlds.
- [ ] Analytics event IDs merge without duplicate entries.
- [ ] Chest claims remain unique, daily reward claimed flag stays true.
- [ ] Smart Review entries merge with latest practice and max counters.
- [ ] Account switch pauses sync and requires explicit confirmation; sign out doesn't upload to wrong account.
- [ ] Manual G.2 Cloud Save/Restore still works.
- [ ] Status banner reflects offline/sync/error/last sync.
- [ ] Large payload errors are visible; local data is preserved.
- [ ] G.1/G.3 leaderboards and G.4 verified ledger remain unchanged.
- [ ] Responsive mobile view works.

## Rollout and rollback
- **Draft PR only; never merge without explicit user approval.**
- G.5 is a frontend-only, additive rollout using the existing G.2 schema. Rollback to prior G.4 Vercel deployment if necessary; no SQL rollback.
- Avoid signing in on another person's device before confirming local account ownership. Supabase anonymous accounts have separate IDs; linking an email to the original account is required for true multi-device sync.
- G.4 verified XP is not synchronized by localStorage; it remains authoritative in the server ledger.
