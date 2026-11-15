# Phase G.7 — Realtime Notifications & Multiplayer Experience

## Delivered
- Private durable notifications (`g7_notifications`) with RLS and idempotent event keys; triggers emit events **in the same database transaction** as G.6 friend/match mutations.
- Authenticated notification summary/list/mark-read/dismiss and participant-only match detail RPCs.
- Browser-native Supabase Realtime Postgres Changes listener, recipient-filtered and authenticated. Refreshes authoritative snapshots after events; 30-second fallback polling, focus/visibility/online resync, connection cleanup, no automatic page reload.
- Global bell with unread count and notification center; G.6 menu badge now reflects server-computed pending invitations.
- Match detail with server-derived status/score and deadline countdown, linked from notifications and G.6 matches.
- Server-only `g7_finalize_due_matches` with row locking and idempotent status transition, scheduled each minute via pg_cron when installed.

## Install on Preview only
1. Use an isolated Supabase Preview/test project with G.4, G.6 and G.6 notification-count migrations applied.
2. Apply `supabase/migrations/202611150002_g7_realtime_notifications.sql` in SQL Editor as an administrator.
3. Verify `g7_notifications` is in the `supabase_realtime` publication and SELECT RLS works for recipients only.
4. Enable Supabase Realtime Postgres Changes for the project. Browser connects to `wss://<project>/realtime/v1/websocket` using the anon key and the authenticated user's JWT; **never** expose service-role credentials.
5. Enable Supabase `pg_cron` extension before running migration if possible. Verify job `g7-finalize-due-matches` exists in `cron.job` and that `cron.job_run_details` shows successful runs. If pg_cron was disabled when migration ran, enable it and rerun the final DO scheduling block from the migration. **Do not claim automatic finalization is active without this verification.**
6. Verify Vercel Preview env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `npm run build`.
7. Use two distinct test accounts. G.6 is retained; G.7 does not change G.1–G.5 save formats.

## Notification semantics
- Bell: **unread** notification records; persists after reading until dismissed.
- G.6 menu: **pending friend + match invitations**, regardless of read status. Reading does not accept an invitation; declining/accepting/blocking changes pending count.
- Inbox loads latest 30, ordered by timestamp; older pages can be fetched via `p_before` RPC (pagination UI deferred).
- Notification records are deduplicated by (recipient_id,type,entity_id). Multiple notifications from different match transitions use distinct types.
- No web push when Safari is fully closed; Realtime works only while app is open and connected. Polling fallback reconciles missed events.
- G.6 events created **before** migration are not backfilled into G.7 inbox; current pending count remains accurate from G.6.

## Security and limits
- Table direct INSERT/UPDATE/DELETE revoked from authenticated/anon. Recipient-only SELECT RLS.
- Server-only batch finalizer, `FOR UPDATE SKIP LOCKED`, status guard; the same match cannot be finalized twice. G.6 manual finalize still works.
- G.4 accepted score events are **not independent proof of actual speech**; no valuable prize payouts.
- Native Realtime WebSocket implementation relies on Supabase Realtime Phoenix wire protocol. Verify subscription handshake, JWT expiration, and reconnect in Preview; consider official SDK in future if protocol compatibility changes.
- Notification payloads are intentionally generic; avoid exposing emails or private profile information.
- When switching accounts, storage event / foreground reconnect and snapshot ownership checks clear old user data. Auth changes within the same tab should dispatch a refresh event (G.6 action and session UI integration).
- No realtime score streaming or real-time PvP; matches remain asynchronous.

## 20-point UAT
1. [ ] Preview Vercel build succeeds (`tsc -b && vite build`).
2. [ ] Migration applies cleanly on test Supabase; publication and RLS verified.
3. [ ] Two distinct authenticated accounts cannot read each other's notification records.
4. [ ] Direct client insert/update/delete into notifications is denied.
5. [ ] Friend invite creates one notification and recipient sees it in near real time.
6. [ ] Duplicate/retried friend invitation does not duplicate notification.
7. [ ] Accept friend request updates pending badge; sender receives acceptance notification.
8. [ ] Match invitation creates a notification and increments pending count.
9. [ ] Accept/decline match updates badge and sends correct status event.
10. [ ] Mark one read and mark all read update bell but not pending badge.
11. [ ] Dismiss notification removes it from inbox; does not delete invitation.
12. [ ] Notification tap navigates to correct friend inbox or match detail.
13. [ ] Match detail displays participants, world, countdown, status and result.
14. [ ] Before deadline match cannot be finalized; scores are server-derived G.4 events only.
15. [ ] pg_cron job exists and successfully finalizes a due test match; results notify both participants once.
16. [ ] Repeated finalization or overlapping cron workers do not double-count.
17. [ ] iPhone Safari background → foreground resyncs without reload loop.
18. [ ] Offline → online and broken WebSocket recover with fallback polling.
19. [ ] Sign out/switch account does not leak previous user's notifications.
20. [ ] G.1–G.6 regression: leaderboard, game, verified scoring, cloud sync, friends and matches.

## Release gates
- Preview build + all 20 UAT cases pass.
- Test iPhone Safari and desktop Chrome, with two users and simulated network interruptions.
- Verify pg_cron and realtime permissions in production **before** enabling UI deployment.
- Keep PR **Draft** until explicitly approved. Do not merge or modify Production without user approval.
- Rollback: redeploy stable G.6 Vercel build; additive G.7 DB objects can remain. If necessary, disable `g7-finalize-due-matches` cron job separately; do not drop player data.

## Known gaps / follow-ups
- Notifications are fetched in batches of 30; pagination UI and retention policy are future enhancements.
- Realtime may degrade to 30s polling on some browsers/networks.
- If `pg_cron` is unavailable, automated finalization requires a separately configured trusted scheduler; manual G.6 finalize remains available.
