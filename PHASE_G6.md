# Phase G.6 — Friends & Asynchronous 1v1

## Installation
1. Apply **`supabase/migrations/202611130005_g6_multiplayer_friends.sql`** in Supabase SQL Editor on a non-production Preview/test project first.
2. Confirm previous G.4 migration exists (`g4_score_events`, `g4_player_names`). G.1–G.5 tables and functions remain unchanged.
3. Configure Vercel Preview `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; enable Supabase Auth anonymous sign-ins and Email OTP for existing accounts.
4. Use two **different** Supabase user IDs to test friend requests and matches. Use the new `🤝 Bạn bè & Thi đấu 1v1` menu.
5. The recipient needs the sender's full UUID Player ID; copying is available in the UI. Do not expose email addresses.

## Data model
- `g6_friend_requests`: directional invitations with unique pending unordered pair.
- `g6_blocks`: explicit block list; block cancels friendships and active/pending matches.
- `g6_matches`: 1v1 invitations, accepted matches, 24h deadlines and server-finalized results.
- RLS: only participants can SELECT friend requests and matches; block lists are owner-read. Direct client INSERT/UPDATE/DELETE are revoked. SECURITY DEFINER RPCs verify `auth.uid()`.
- Rate limits: 15 friend invitations/hour, 10 match invitations/hour per challenger; one open match per challenger/opponent direction.
- Match scoring: count **distinct challenge indexes** in G.4 `g4_score_events` for the chosen world, accepted within the match's 24h window; 100 XP per distinct challenge, capped at 6 = 600. **No client-submitted scores**.
- Finalization: a participant calls `g6_finalize_match` **after** the 24h deadline. Repeated calls return the same saved result; no scheduled job is required. Until finalized, rankings/history show the active match.
- Friend rankings count finished matches only. Results are friend-visible via authenticated `g6_dashboard`.

## Threat model and limitations
- G.4 events are server-accepted but **do not prove authentic speech**; users who manipulate clients can generate accepted attempts under G.4 timing/rate limits. Do not award real-money or valuable prizes based on these matches.
- Players can play other worlds while a match is active. Only accepted G.4 events for the selected world in the match window count.
- Two simultaneous active matches for different opponents/worlds can count the same G.4 event in each match. This is acceptable for social practice, not tournament-grade exclusivity.
- A match is scored only after acceptance, not invitation creation; no early completion. Match duration is 24 hours.
- An incoming match invitation older than 7 days expires on attempted acceptance, rather than by a background scheduler.
- Match results are not recalculated once finalized. They use G.4's immutable ledger.
- Player display names come from G.4 and default to Adventurer until the user earns a verified score.
- This phase implements in-app inbox (loaded on opening/refresh), **not** push notifications or Supabase Realtime.
- Players can unblock from the G.6 screen. Unblocking does not restore the previous friendship; a new request is required.
- No account-wide public player search: players exchange full UUIDs directly.

## UAT (15 checks)
- [ ] Migration applies cleanly on test Supabase project; RLS/direct writes denied.
- [ ] Preview build passes `npm run build` (TypeScript + Vite).
- [ ] Two accounts show different Player IDs and do not leak each other's private records.
- [ ] Send friend request using a valid UUID, see it in recipient inbox.
- [ ] Duplicate/reverse pending friend requests are rejected.
- [ ] Accept and decline requests; only accepted friends can challenge.
- [ ] Blocking cancels friendship and open matches; blocked user cannot reinvite.
- [ ] Match invitation for selected world appears for opponent.
- [ ] Decline invitation; accept a new invitation, deadline = 24h from acceptance.
- [ ] Play G.4 challenges during active match, no client score submission.
- [ ] Before deadline, finalize is rejected; after deadline, finalize uses server G.4 ledger.
- [ ] Repeated finalize returns identical result; distinct challenges cap score at 600.
- [ ] Friend rankings and match history display wins/draws/played.
- [ ] Mobile responsive layout, refresh/error handling and in-app inbox work.
- [ ] G.1–G.5: leaderboards, verified scores, cloud sync and gameplay regressions pass.

## Testing deadline
Do **not** manipulate production time or update match records manually. On a dedicated test Supabase project, an authorized SQL administrator can shorten `deadline_at` for a test match to validate finalization. Record that this is test-only and never expose such writes to authenticated clients.

## Production readiness
- Verify all G.6 RPC EXECUTE grants and table RLS policies, including attempts at direct INSERT/UPDATE.
- Verify `g6_dashboard` returns only current user's inbox, friends and matches.
- Check request rate limits and block restrictions.
- Verify no privileged Supabase service-role key is exposed in frontend.
- Confirm the production G.4 score ledger exists and is healthy.
- Confirm Vercel Preview build and UAT, then explicitly approve merge.

## Rollback
The migration is additive. Roll back Vercel to the stable G.5 deployment if needed; leave G.6 tables/RPCs in place until a separate reviewed DB cleanup. Rolling back Vercel does not revert GitHub `main`.

**Never merge the Draft PR without explicit user authorization.**
