# iOS Safari & G.6 Inbox Hotfix (Preview)

## Changes
- G.5 cloud sync no longer forces `window.location.reload()` after applying merged cloud data. It shows a **user-initiated** “Tải lại để cập nhật dữ liệu” action. Sync is paused until reload to prevent stale React state overwriting freshly merged local storage.
- Background sync polls at most once every 60 seconds when idle, instead of sending a request every 12 seconds. Pending local changes still trigger sync on the 12-second tick or online/focus/visibility events.
- G.6 displays friend invitation success directly below the Player ID input.
- Dashboard multiplayer menu shows a notification badge counting **incoming pending friend requests + incoming pending 1v1 invitations**. The badge refreshes on opening the dashboard, focus/visibility, and every 30 seconds. It disappears at zero.
- Accept/decline/block invitation operations refresh the inbox state. The badge is calculated server-side and excludes blocked senders and expired match invitations.

## Database (additive)
Apply `supabase/migrations/202611150001_g6_notification_count.sql` on **Preview Supabase** before testing. The RPC `g6_notification_count` returns only the authenticated user's pending count. Direct table writes remain forbidden by G.6 RLS.

## iPhone Safari UAT
- [ ] Vercel Preview builds successfully (`tsc -b && vite build`).
- [ ] Open Preview on iPhone Safari; verify no continuous reload and no repeated “Đang đồng bộ” loop.
- [ ] Open Online Leaderboard from welcome; remain on leaderboard for at least 2 minutes.
- [ ] Navigate to leaderboard from Profile; return navigation works.
- [ ] Trigger cross-device cloud merge: the UI requests **manual** reload and does not reload automatically.
- [ ] Tap manual reload once: merged XP/checkpoints/rewards are visible; no reload loop.
- [ ] Offline → online: pending sync resumes, with no navigation interruption.
- [ ] Sender enters recipient Player UUID; inline success appears immediately below the field.
- [ ] Recipient opens Dashboard: badge shows 1 for one pending friend invitation.
- [ ] A pending match invitation adds +1; badge shows 2 if both invitations are pending.
- [ ] Accept friend request; badge decrements by 1.
- [ ] Decline/remove another friend request; badge decrements.
- [ ] Block sender with a pending invitation; badge decrements.
- [ ] Accept or decline incoming match invitation; badge decrements.
- [ ] Badge disappears at zero; verify refresh after switching tabs or reopening Dashboard.
- [ ] Regression: G.1–G.6 screens, game, cloud save and verified score remain functional.

## Production release
Keep this PR as **Draft** until Preview build and iPhone Safari UAT pass. After explicit approval, merge into main and apply the additive SQL migration to Production Supabase **before** testing the Production badge. The sync fix itself needs no DB changes. Rollback to previous Vercel deployment if needed; do not delete existing player data.
