# Phase D.1 — Learning Analytics & Progress Dashboard

## Implemented
- Learning Dashboard from Welcome, Adventure Map, and Profile.
- Summary: existing C.1 total XP (including rewards), recorded challenge completions, completed worlds, learning streak.
- Seven-day chart of completed challenges and earned **challenge XP only** (100 XP per successful challenge). Dates use device-local calendar time.
- Per-world statistics: current C.1 checkpoint progress, recorded challenge attempts completed, world completion counts, last played date and C.1 coin totals.
- Recent learning activity with timestamps (latest 30 shown; up to 500 events stored).
- New versioned `speak-jump-analytics-v1` localStorage entry; leaves existing C.1 progress and C.2 rewards formats unchanged.
- Existing reset action also clears analytics history.

## Semantics and migration
- Analytics start tracking **when D.1 is deployed**. Earlier XP, coins, checkpoint completion, and worlds remain visible through C.1 but **historical per-day analytics cannot be reconstructed**. This is intentional: no fake history.
- XP awarded by daily quests/chests is not attributed to a day in the chart; the chart measures learning challenges.
- Challenge completion records an event once through the existing `actionComplete` guard. Completing a world records a separate event worth 0 XP.
- Streak counts consecutive device-local calendar days with at least one challenge. If no challenge today, a streak through yesterday is still displayed.
- No backend, no cross-device sync, and no pronunciation accuracy scoring.

## QA checklist
1. Run `npm ci && npm run build` (or inspect Vercel Preview build logs).
2. Open dashboard from Welcome, Map and Profile. Test desktop and narrow mobile.
3. With existing C.1 save, verify XP/checkpoints/worlds/coins remain; old analytics should be empty, not invented.
4. Complete one challenge. Dashboard count and today's chart bar increase by 1; today's chart XP increases by 100.
5. Complete a world. Per-world completion count increases by 1 and history shows the event.
6. Reload page. Check analytics persists and existing C.2 quests/badges still work.
7. Check daily streak behavior on consecutive calendar days and after a missed day.
8. Test chart labels, zero-activity days, latest-first event history and world details.
9. Confirm bonus XP from C.2 doesn't inflate the challenge XP chart.
10. Reset progress, confirm both analytics and C.1/C.2 state clear; cancel reset and verify unchanged.
11. Regression: microphone/demo, avatar, Phaser scene, checkpoint resume, coins and achievements.

## Privacy
All data is stored locally in the browser. Clearing site data or changing device/browser will remove the analytics history.
