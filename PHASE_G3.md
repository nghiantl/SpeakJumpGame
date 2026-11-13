# Phase G.3 — Weekly Challenges & Seasonal Leaderboard

## Included
- UTC Monday–Sunday weekly challenges: 20 pronunciation challenges, activity on 5 UTC days, and 2 completed worlds.
- Monthly UTC seasonal leaderboard and weekly leaderboard (Top 50), separate from G.1 all-time XP.
- Three weekly badge claims stored per Supabase user, idempotent via composite primary key.
- PostgreSQL determines current week and month via `g3_periods`; write and claim RPCs also determine periods on the server.
- Opt-in **Đồng bộ tiến độ tuần** button. No automatic background uploads and no alteration to local XP, rewards, cloud saves or G.1 leaderboard.
- RLS public read-only leaderboards, private owner-only badge read; authenticated RPCs handle score writes and claims.
- Mobile-responsive UI accessible from Profile → 📅 Thử thách tuần & Mùa giải.

## Required Supabase setup
1. In the existing G.1/G.2 Supabase project, execute `supabase/migrations/202611130003_g3_weekly_seasons.sql` in SQL Editor.
2. Verify tables `player_weekly_scores`, `player_season_scores`, `player_weekly_rewards`, functions `g3_periods`, `g3_submit_progress`, `g3_claim_weekly_reward`.
3. Reuse Vercel Preview `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; redeploy PR Preview.
4. Do **not** use Supabase service_role or secret keys in Vite.

## Preview QA
- [ ] Vercel build / TypeScript checks pass.
- [ ] Open Profile → Weekly Challenges and verify server UTC week/month dates.
- [ ] Complete challenges and sync; progress and weekly/monthly leaderboard update.
- [ ] Claim each completed badge; repeated claims do not create duplicates.
- [ ] Two devices see the same leaderboard and claimed badges for the same signed-in user.
- [ ] A new UTC week resets current-week rankings/challenges, but leaves prior records intact.
- [ ] A new UTC month resets seasonal leaderboard without touching all-time XP.
- [ ] Verify anon users cannot directly INSERT/UPDATE/DELETE leaderboard rows or badge records.
- [ ] Verify RLS prevents users from reading other users' badge claims.
- [ ] Mobile widths 320, 375 and 768 px.
- [ ] G.1 leaderboard, G.2 cloud save, offline gameplay and existing rewards still work.

## Important limitations
- **No anti-cheat**: event timestamps, XP and counts are derived from client-side analytics and submitted by the client. Server controls *which* week/month receives a submission, but cannot prove that submitted events occurred in that period or that scores are genuine. Do not use for monetary/prize-backed competition until Phase G.4.
- Analytics retains at most 500 recent events, so old or heavy-play event totals may be incomplete. Cloud restore/merging can also change local event history; scores only increase within a given period on the server.
- Weekly/monthly XP comes from recorded learning events, not all-time player XP. Existing XP does not retroactively count in current periods.
- Badge rewards are **cosmetic only**, recorded in Supabase; they do not grant extra XP, coins or inventory items.
- Claims use the server-stored weekly progress after a successful manual sync. A player must sync before claiming.
- No push notifications; the screen displays current status and deadlines when opened.
- No automated cleanup of historical season/week records yet.
- Production SQL migration must be applied before merging the frontend.

**Draft PR only. Do not merge without the user's explicit approval.**
