# Phase F.2 — Game Polish & Player Experience

## Features
- **First-play onboarding**: 3-step tutorial about speech input, obstacle movement and progress. A visible "Hướng dẫn" control in Jump Mode lets players reopen it.
- **Pause menu**: resume, retry current checkpoint or return to the map. Voice recognition is aborted on pause.
- **Game-over / retry flow**: when Phaser detects a missed platform or failed obstacle, it notifies React, freezes the scene, displays a retry dialog and allows a fresh attempt at the current checkpoint. Existing earned XP and completed checkpoints are preserved. Combo is reset on failure.
- **Visual polish**: coin sparkle bursts, existing checkpoint celebration and camera feedback; reduced-motion preference suppresses new and existing shake/particles where supported.
- **Performance**: low-core devices avoid continuous coin/flag tweens and limit sparkle bursts; reduced-motion mode also skips these ambient tweens.
- **Local tutorial flag**: `speak-jump-tutorial-v1`; does not modify or migrate any earlier progress/rewards/review/analytics/engagement/settings schemas.

## QA checklist
- [ ] Vercel Preview: `npm run build` (TypeScript + Vite) succeeds.
- [ ] First Jump Mode launch shows 3-step tutorial; skip/complete works.
- [ ] Re-entering Jump Mode does not auto-show tutorial; Help button reopens it.
- [ ] Pausing stops the Phaser scene and microphone; resume works.
- [ ] Pause menu "retry checkpoint" restarts from current challenge and does not reset XP or earlier checkpoints.
- [ ] Pause menu "map" returns to the world map without losing saved progress.
- [ ] Falling into a gap shows retry dialog; game does not award XP for failed attempt.
- [ ] Retry after fall resets combo and restarts from current checkpoint.
- [ ] Speech and Demo actions work after retry, with no duplicated callbacks.
- [ ] Mobile 320/375/768px: dialogs fit and buttons remain tappable.
- [ ] Reduced-motion preference avoids camera shake and sparkles.
- [ ] F.1 audio settings, HUD, keyboard controls and E.2 daily rewards remain functional.
- [ ] Refresh preserves XP/checkpoints, and tutorial completion persists.

## Notes
- Failure means a **Phaser physical obstacle miss**, not an incorrect speech transcription; incorrect speech retains the existing "try again" flow.
- Checkpoint retry remounts the Phaser scene at the current challenge to avoid stale physics state. XP already earned is not rolled back.
- The first-play tutorial flag remains after Reset Progress; this is intentional, because it is a UI preference, not learning progress.
- No paid APIs or additional dependencies.
