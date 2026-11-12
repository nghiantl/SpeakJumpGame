# Phase C.2 — Achievements & Rewards

## Implemented
- Achievements: six collectible badges (first challenge, ten challenges, first completed world, all worlds, 500 XP, 2000 XP).
- Daily quests (browser-local calendar date): complete three challenges, pick up five coins, and complete one world. Claim +50 XP and +10 coins after all three goals are met, once per day.
- One-time reward chests: Bronze (500 XP → +100 XP, +10 coins), Silver (1500 XP → +150 XP, +20 coins), Gold (3000 XP → +250 XP, +30 coins). Rewards cannot be claimed twice.
- Reward hub accessible from welcome, map and profile.
- Separate `speak-jump-rewards-v1` storage key, preserving the existing `speak-jump-progress-v1` save format and B.1/C.1 avatar and checkpoint data.
- Reset progress also resets achievements, daily quests and opened chests.
- Local calendar dates are based on device time; no backend sync.

## Test checklist
1. Verify Vercel Preview build (`npm ci && npm run build`).
2. Open the reward hub from welcome, map and profile. Verify responsive layout.
3. Finish one challenge: daily challenge counter increments once; first-step badge unlocks.
4. Collect coins and complete a **new** world: daily counters increment. Replaying a completed world can count toward the daily world quest, so the quest remains achievable after all worlds have been completed. The daily reward can still be claimed only once per day.
5. Complete 3 challenges, collect 5 coins, complete 1 new world. Claim daily reward and confirm exactly +50 XP and +10 coins.
6. Click daily reward again or refresh: cannot claim again on the same local date.
7. Earn 500 XP, open Bronze chest: exactly +100 XP and +10 coins. Refresh and confirm chest remains opened.
8. Confirm Silver/Gold chest eligibility and one-time claims when XP thresholds are reached.
9. Verify badges, daily counters and opened chests persist after refresh.
10. Verify reset confirmation clears C.1 and C.2 data; cancel leaves data unchanged.
11. Verify gameplay, B.2 effects, photo avatar, checkpoint resume, and mobile layout still work.

## Known constraints
- Daily quest resets on a new **device-local** date when the reward hub is reopened or an activity occurs. It does not reset continuously while the tab is idle.
- Replayed world completions count toward the daily world quest; the daily reward is still limited to one claim per day.
- Badges based on lifetime challenge count begin tracking when C.2 is installed. Historical C.1 XP still unlocks XP-based and first-step badges.
- Reward coins are added to the currently selected world coin total, as the game has no separate coin wallet yet.
- Clearing browser site data removes progress and rewards. No cloud sync or account system.
- Rewards are motivational game currency, not real-world redeemable items.
