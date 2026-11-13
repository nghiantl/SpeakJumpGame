# Phase G.1 — Supabase Online Leaderboard

## What is implemented
- Online Top 50, ordered by XP, completed worlds and best combo.
- Player profile level and rank labels: Rookie / Explorer / Champion / Legend.
- Opt-in **Publish my score** button (no automatic upload).
- Supabase Auth anonymous sign-in, persisted/refreshable browser session.
- PostgreSQL leaderboard table with RLS; read-only public access; owner-scoped authenticated RPC for score submission.
- No photo, voice recording, review history or personal analytics are sent to Supabase.
- All existing local progress/reward/engagement keys remain unchanged. Game works when Supabase is not configured.

## Setup required by project owner
1. Create a Supabase project at https://supabase.com/dashboard.
2. In **Authentication → Providers → Anonymous**, enable anonymous sign-ins.
3. In **SQL Editor**, execute `supabase/migrations/202611130001_g1_leaderboard.sql` (or apply with Supabase CLI).
4. In Vercel **Project → Settings → Environment Variables**, add:
   - `VITE_SUPABASE_URL`: your project URL
   - `VITE_SUPABASE_ANON_KEY`: your public **anon** or **publishable** key (never service_role or secret key).
5. Apply to Preview and Production as appropriate, then redeploy.
6. Open **🏆 Bảng xếp hạng Online**, click **Đăng thành tích của tôi** to publish; test with a second browser/device.

**Do not place Supabase service-role/secret keys in Vite environment variables or GitHub.** Vite `VITE_*` variables are bundled into client JavaScript.

## Security & integrity
- Public read access is intentional: names and scores are public.
- RLS prevents direct public writes. The authenticated RPC binds submissions to `auth.uid()`, not a user ID supplied by the client.
- Score fields are bounded, and XP/worlds/combo cannot decrease through normal submissions.
- **Not anti-cheat secure**: clients submit localStorage-derived stats and may tamper with them. Production competitive prizes require server-authoritative score/event validation, abuse controls, rate limiting and moderation.
- Anonymous identity is tied to browser storage. Clearing storage or switching devices creates a new player identity. No cross-device login/sync yet.
- The first anonymous sign-in requires Supabase Anonymous Auth enabled and may be subject to provider abuse/CAPTCHA settings.
- Display name is taken from the local player profile; do not enter sensitive personal data.

## QA checklist
- [ ] Vercel Preview build passes `tsc -b && vite build`.
- [ ] Without env variables, app runs and leaderboard displays configuration instructions.
- [ ] SQL migration succeeds and RLS is enabled.
- [ ] Anonymous sign-ins are enabled; first publish succeeds.
- [ ] Another browser/device sees the published score in Top 50.
- [ ] Same browser publishing twice updates one row, not duplicate players.
- [ ] XP and completed worlds ordering works.
- [ ] Reload retains anonymous identity; refresh token works after token expiration.
- [ ] Other users cannot update another user's row using direct REST requests.
- [ ] No avatar PNG, microphone audio or review records appear in Supabase.
- [ ] Responsive leaderboard on 320/375/768px screens.
- [ ] Game XP, rewards, analytics, review, F.1/F.2 controls remain functional.

## Deferred
Weekly challenges, account linking across devices and verified/anti-cheat scoring are separate follow-up work. The leaderboard is a beta competitive feature, not a tamper-proof ranking.

**Draft PR: do not merge until the user approves.**
