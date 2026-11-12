# Phase E.2 — Game Experience & Engagement

No Azure Speech or paid pronunciation API is used. This phase keeps Web Speech API and Phaser Arcade physics.

## Changes
- Adds **11 challenges** across the four existing worlds (5→8, 3→6, 3→6, 2→4). Original challenge order and indices are preserved for C.1 checkpoints and D.2 review history.
- Adds visual variations to Phaser jump gaps and duck bridges without modifying collision geometry or movement controls.
- Adds an in-game consecutive checkpoint combo HUD, best combo record, and **+30 XP** bonus on a 3-checkpoint streak, limited to once per world per local calendar day.
- An incorrect recognized phrase breaks the combo. **Demo đúng** still counts as a gameplay completion and combo (not as speech recognition); this is intentional and should not be confused with a speaking achievement.
- Adds a rotating **daily featured world** based on the device's local date. Completing the featured world awards **+75 XP**, at most once per day, including replay of a previously completed world.
- Adds a separate versioned localStorage key `speak-jump-engagement-v1` with bounded history; Reset Progress clears it. C.1, C.2, D.1 and D.2 keys remain unchanged.
- Existing completed-world flags remain unchanged even if E.2 adds new challenges to that world. Replay a world to experience the additional content.

## QA checklist
- [ ] Vercel Preview: `npm run build` succeeds
- [ ] Four worlds show 8, 6, 6, 4 challenges in original order followed by new words
- [ ] Existing saved checkpoint and completed-world progress still loads
- [ ] Jump and duck physics work with new obstacle themes
- [ ] Three consecutive successful checkpoints give +30 XP once per world per day
- [ ] Incorrect recognized phrase resets combo
- [ ] Daily featured world rotates by local calendar day; completion awards +75 XP once per day
- [ ] Daily reward can be claimed on replay of an already completed world
- [ ] Reload preserves best combo and claimed daily rewards
- [ ] Reset Progress clears E.2 records while canceling reset preserves them
- [ ] Web Speech, Smart Review, analytics, daily quests, chests, mobile layout remain functional
- [ ] Demo success is not counted as speech recognition in D.2

## Notes
- Bonus XP is added to the existing XP balance, so the C.1 autosave and C.2 chest thresholds continue to work.
- Bonus XP is not included in the D.1 chart of challenge-only XP; that chart explicitly excludes bonuses.
- LocalStorage and local date can be changed by the user; this is a single-device casual game, not a server-authoritative competitive leaderboard.
