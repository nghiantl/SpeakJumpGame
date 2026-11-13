# Phase G.2 — Player Accounts & Cloud Progress Sync (Preview)

## Implemented
- Manual cloud backup/restore via Supabase: XP, coins, completed worlds, checkpoints, name, avatar PNG, learning analytics, smart review, rewards and engagement.
- Supabase `player_cloud_saves` table with owner-only SELECT RLS and authenticated owner-only `write_player_cloud_save` RPC.
- Revision-based optimistic concurrency; concurrent writes return a conflict rather than silently overwrite.
- Existing G.1 anonymous Supabase identity reused, keeping leaderboard user ID when email linking succeeds.
- Email linking through Auth `PUT /user` and email OTP sign-in for a second device.
- Existing localStorage save keys and gameplay remain unchanged. Manual actions only; offline play still works.
- Mobile-friendly cloud controls.

## Setup (required before Vercel Preview QA)
1. In the **same Supabase project as G.1**, run `supabase/migrations/202611130002_g2_cloud_progress.sql` using SQL Editor.
2. Supabase Authentication → Providers → Email: enable email authentication. Keep Anonymous Sign-ins enabled.
3. Configure the Email OTP template to show `{{ .Token }}` (6-digit code) instead of link-only; configure Auth URL/site URL and redirect URLs for your Vercel Preview and Production sites if using email confirmation links.
4. Reuse G.1 Vercel Preview `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never expose service_role/secret keys.
5. Redeploy PR Preview. Open Profile → **☁️ Tài khoản & Cloud Save**.

## Recommended end-to-end test
1. On **device A**, open cloud panel; note user ID, press **Lưu lên cloud**.
2. Enter your email and **Gửi xác minh**. Confirm the email as required by Supabase. Check that Auth user ID remains the same (no new account).
3. On **device B**, open Cloud Save, enter the **already linked email**, click **Gửi mã đăng nhập**, then **Đăng nhập bằng mã**. Confirm the displayed user ID matches device A.
4. Press **Khôi phục cloud** on B, confirm local progress, XP, coins, rewards, review and analytics load after reload.
5. Update progress on B, save cloud; on A, refresh and explicitly restore. Verify new progress.
6. In parallel, save on A and B: the stale revision must fail, and never silently overwrite the newer cloud version.
7. Verify offline play still saves locally, leaderboard still works and no secrets are bundled.

## Important limitations and risks
- **This is manual sync, not background/automatic sync.** The user explicitly uploads and restores; no implicit overwrite of existing device data.
- Uploading when a cloud save already exists combines only **monotonic** XP, completed worlds, checkpoint counts, coin counts and combo/date sets. Analytics/review/rewards are **not automatically merged** (they lack stable event IDs); uploading keeps the current device's versions. Restoring explicitly replaces all local datasets. Always verify which device has the most complete progress before uploading/restoring.
- Avatar PNG is stored in the private cloud payload, unlike the public leaderboard. Cloud saves are owner-readable under RLS; privacy and data retention policies should be considered before wider release.
- Email verification is subject to the Supabase project's Auth settings, email provider and rate limits. Some projects may require an external SMTP provider for real-user delivery.
- Email linking and OTP login depend on Supabase settings. **Google OAuth account linking is not included.**
- Email OTP sign-in on a new device replaces that device's anonymous session; any previous anonymous leaderboard identity on that device is not automatically merged.
- Clearing localStorage before linking/signing in from another device can orphan an anonymous account.
- Client-side progress is not anti-cheat validated. Do not use for prize-backed rankings.
- Cloud save writes reject concurrent revision conflicts. The UI currently shows the conflict message and requires the user to reload/retry manually.
- The existing local **Reset Progress** clears only the device's data; it does **not** delete the cloud backup. This is deliberate to avoid accidental cloud data loss.

## QA checklist
- [ ] `npm run build` succeeds on Vercel Preview.
- [ ] SQL migration applies; RLS owner-only reads and RPC writes verified.
- [ ] Existing G.1 anonymous identity remains after first cloud save.
- [ ] Cloud save uploads and restores data after a reload.
- [ ] Email linking verifies same Auth user ID.
- [ ] Second-device OTP login accesses same cloud record.
- [ ] XP, coins, checkpoints, rewards, review and analytics restore correctly.
- [ ] Simultaneous writes produce a revision conflict rather than overwrite.
- [ ] Offline play remains functional; manual upload works after reconnection.
- [ ] Local reset does not erase cloud backup.
- [ ] Mobile 320/375/768px, G.1 leaderboard and F.1/F.2 gameplay regressions pass.

**Draft PR only. Do not merge without explicit user approval.**
