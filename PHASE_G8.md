# Phase G.8 — Multiplayer Seasons & Competitive Events

## Branch and release boundary
Branch `feat/phase-g8-competitive-events` from `main`. Draft PR only. **Never merge, run migration against Production, or change Production configuration without explicit owner approval.**

## Implemented
- Seasons and server-authoritative rating ledger (win +20, draw +5, loss -10; RP floor 0; per-match unique key).
- Daily/weekly tournament catalog, signup, challenge-specific G.4 ticket binding, server-accepted scoring and rankings.
- Cosmetic achievement ledger, first-match, five-wins, weekly-champion, seven-daily-events and Diamond season awards.
- Server-side matchmaking queue with block checks, atomic world/season matching, rating range 50/100/200 based on wait time, 24h G.6 match creation and G.7 notifications.
- Server-only settlement jobs for finished competitive matches, ended events, season snapshots, awards and review flags for repeated opponent pairs.
- Mobile competition dashboard, tournament participation via speech recognition, seasonal leaderboard, matchmaking, rewards and RP history.

## Important behavior and limitations
- **Competition is recreational**. G.4 accepts event tickets and enforces timing/rate limits but does NOT independently verify microphone speech or pronunciation. Client-side speech matching can be bypassed. No prizes with real-world value.
- The matchmaking action is **explicit opt-in**; when a compatible queued opponent is found the server immediately starts a 24-hour asynchronous match. No second acceptance confirmation is implemented. Both users have opted into the queue.
- Competitive match score currently reuses G.6 accepted world events within match window. Ordinary G.4 events in the same window may count. This is NOT a dedicated match-only ticket protocol. Keep competitive RP/awards in Preview until a match-scoped attempt binding and fraud review policy are validated.
- Tournament challenge_count is capped at four for compatibility with Grammar Castle; only challenges [0,challenge_count) of the chosen world are used.
- Browser SpeechRecognition availability differs by browser; Safari may lack full support. The UI reports unsupported environments rather than faking a score.
- G.8 does not change G.1–G.7 cloud save formats or existing RPC signatures.
- Tournament entries are server-owned; event attempts are bound to G.4 attempt IDs. Calling G.4 directly without G.8 ticket binding does not score a tournament.
- Server operators create seasons and tournaments; no authenticated RPC can do so.
- Match settlement and event settlement are **not automatically scheduled by migration**; a Supabase admin must enable pg_cron and schedule both jobs after testing.
- No production data migration or scheduler execution has been performed by this PR.

## Preview-only Supabase setup
1. Use an isolated Preview/test Supabase project with G.4, G.6, G.7 migrations applied. Do not run against Production.
2. Apply `supabase/migrations/202611150003_g8_competitive_events.sql` in the test SQL Editor.
3. Seed an active season, e.g.:
```sql
insert into public.g8_seasons(name,starts_at,ends_at)
values('G.8 Preview Season',now()-interval '1 day',now()+interval '27 days');
insert into public.g8_tournaments(season_id,name,kind,world_index,challenge_count,starts_at,ends_at)
select id,'Preview Daily Sprint','daily',0,4,now()-interval '1 hour',now()+interval '23 hours'
from public.g8_seasons where name='G.8 Preview Season' order by created_at desc limit 1;
insert into public.g8_tournaments(season_id,name,kind,world_index,challenge_count,starts_at,ends_at)
select id,'Preview Weekly Championship','weekly',1,4,now()-interval '1 hour',now()+interval '7 days'
from public.g8_seasons where name='G.8 Preview Season' order by created_at desc limit 1;
```
4. Enable `pg_cron` in the test project, then schedule the trusted jobs:
```sql
select cron.schedule('g8-settle-matches','* * * * *','select public.g8_settle_competitive_matches(100)');
select cron.schedule('g8-settle-events','*/5 * * * *','select public.g8_settle_events()');
```
5. Verify `cron.job`, `cron.job_run_details`, RPC grants and RLS. Check G.7 finalizer runs **before** G.8 settlement or that eventual retry settles matches on subsequent cycles.
6. Configure Vercel Preview to use the isolated test Supabase, and run `npm run build`.

## 25-point UAT
### Seasons
1. [ ] Active season returned and shown.
2. [ ] RP starts at 100 on registration.
3. [ ] Win/draw/loss gives +20/+5/-10 and RP never below 0.
4. [ ] Concurrent or retried settlement does not duplicate rating ledger entries.
5. [ ] Season snapshot is created and Diamond reward granted at close.
### Tournaments
6. [ ] Join only active tournament; repeated join is idempotent.
7. [ ] Fixed challenge count/world/version are visible.
8. [ ] Ordinary G.4 attempt cannot be credited as a tournament entry.
9. [ ] Duplicate attempt does not add score; score max 400.
10. [ ] Tournament closes, ranks accurately and grants weekly winner badge.
### Achievements
11. [ ] First match badge granted once.
12. [ ] Five wins badge granted at threshold.
13. [ ] Weekly champion and seven daily event badges granted correctly.
14. [ ] Cosmetic rewards do not change XP/RP.
15. [ ] Reward grant uniqueness and ownership enforced.
### Matchmaking
16. [ ] Matchmaking only with active season.
17. [ ] Similar rating matched with widening range.
18. [ ] Blocked players never matched.
19. [ ] Concurrent queue joins never duplicate match.
20. [ ] Queue cancellation works and match detail/notification opens.
### Security, mobile and regression
21. [ ] Authenticated client cannot write RP, rewards, flags or matches directly.
22. [ ] Other users' private queue/history/rewards inaccessible.
23. [ ] Review flags for repeated opponent pair, no automatic ban.
24. [ ] iPhone Safari: foreground/background, offline/online, speech availability gracefully handled.
25. [ ] G.1–G.7 regression: game, verified score, leaderboard, cloud sync, notifications, friend challenges, cron.

## Rollback
- Turn off G.8 UI feature and redeploy last G.7 stable build.
- Unschedule G.8 cron jobs if enabled in test.
- Keep additive G.8 tables and history; never destructively drop user data as a quick rollback.

## Release blockers
- Preview SQL compilation and `npm run build` have **not yet been independently verified**.
- Test G.8 ticket lifecycle against real G.4 RPCs and multiple users.
- Resolve match-only scoring integrity if competitive ranking needs stricter assurance.
- Verify RLS, Safari, cron, and all 25 UAT items before production approval.
