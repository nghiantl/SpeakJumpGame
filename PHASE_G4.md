# Phase G.4 — Anti-Cheat & Leaderboard Integrity (additive rollout)

## Architecture
- `g4_attempts`: server-issued UUID ticket per gameplay challenge. No direct client table access.
- `g4_score_events`: immutable 100-XP server-accepted score ledger; unique `event_id` references the issued attempt.
- `g4_security_flags`: admin-only suspicious-activity audit (rapid starts/finishes, excessive volume, out-of-sequence). No automatic bans.
- `g4_player_names`: public display names only.
- `g4_start_attempt(world,challenge)`: authenticated RPC, validates 4-world challenge bounds and rate limits to 120 attempts/hour, flags rapid/out-of-sequence attempts. Server time only.
- `g4_finish_attempt(attempt,name)`: authenticated RPC, owner-locked, 3-second minimum, 30-minute ticket expiry, 60 accepted events/hour, duplicate returns `duplicate:true` and zero XP. Score always server-fixed at 100 XP. Rejections return `accepted:false` where auditing needs to persist.
- `g4_verified_rankings(period)`: public read-only aggregate RPC, top 50 all-time/current UTC week/current UTC month.
- `g4_my_integrity()`: authenticated owner-only total verified XP, accepted events and count of flags.
- React integration: start ticket on entering the Phaser game and for each next challenge; finish only after Browser SpeechRecognition accepted a phrase and Phaser completed the action. A failed verification never blocks offline gameplay or local XP.
- Profile and Welcome link to a separate verified leaderboard. Existing G.1/G.3 leaderboards, Cloud Save, and legacy score submission remain untouched.

## Supabase Preview setup
1. Run `supabase/migrations/202611130004_g4_score_integrity.sql` in the **same existing G.1–G.3 Supabase project** before testing Preview.
2. Check RLS on `g4_attempts`, `g4_score_events`, `g4_security_flags`, `g4_player_names`; direct writes are revoked.
3. Existing Vercel Preview `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are reused.
4. Redeploy Vercel Preview and check build logs.

## Preview UAT / Security checks
- [ ] Build succeeds and gameplay works offline / with Supabase unreachable.
- [ ] G.4 verified leaderboard loads with empty state before any events.
- [ ] Start ticket and finish after at least 3 seconds of a speech-accepted game action; score +100 server XP.
- [ ] Replay the same ticket: no additional score; `duplicate:true`.
- [ ] Try another user's ticket: rejected.
- [ ] Submit out-of-bounds world/challenge: rejected.
- [ ] Submit before 3 seconds: `accepted:false`; audit flag persists.
- [ ] Repeated rapid starts / excessive completions: flagged or limited.
- [ ] Direct INSERT/UPDATE/DELETE on G.4 tables denied for anon/authenticated.
- [ ] G.4 public aggregate RPC reveals no email, avatar, raw events or flags.
- [ ] UTC week/month leaderboards reset logically; all-time ledger stays.
- [ ] G.1 all-time and G.3 weekly/seasonal leaderboards unchanged.
- [ ] G.2 OTP and Cloud Save/Restore unchanged.
- [ ] Test 320px/375px mobile layouts and login on second device.
- [ ] Admin audit via Supabase SQL, no auto-ban; verify flag handling.

## Critical security limitations
- **Not cryptographically verified gameplay or speech.** A modified browser/client can still request tickets and claim completion after waiting 3 seconds. Browser SpeechRecognition and Phaser callbacks cannot be independently attested by PostgreSQL. These scores must be described as **server-accepted**, not proven speech performance.
- An authenticated malicious client can still fabricate up to allowed server rate limits. Future work: independent speech verification, stronger session integrity, adaptive risk controls and prize-grade anti-cheat.
- Existing G.1 and G.3 leaderboards continue to accept client-submitted totals. They are intentionally NOT relabeled verified or overwritten; migration is additive and non-destructive.
- No historical backfill into verified ledger. Only new server-accepted attempts count.
- Network errors / failed verification do not remove local XP; therefore local XP and server-accepted XP can differ.
- No auto-bans or monetary rewards. Flags require admin review.
- The verified ledger records only gameplay challenges, not bonus XP, chest XP, or reward claims.
- No guaranteed offline replay: offline gameplay continues but a missed ticket is not later counted as server-accepted.
- Vercel frontend rollback does not reverse Supabase schema; keep the additive tables in place.

**Draft PR only. Do not merge without explicit user approval.**
