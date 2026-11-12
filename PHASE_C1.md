# Phase C.1 — Save & Resume (localStorage)

## Features
- Versioned `speak-jump-progress-v1` storage with input validation and graceful recovery from corrupted/unavailable storage.
- Persist name, 160px PNG avatar, XP, difficulty, last selected world, completed worlds, per-world checkpoint count and collected coin totals.
- Restore profile and progress after refresh on the same browser/device.
- **Chơi tiếp** on the welcome screen opens the last selected world. **Vào Jump Mode ngay** resumes from the saved checkpoint; completed worlds restart from checkpoint 0.
- Phaser spawns at the saved checkpoint rather than replaying earlier obstacles. Existing physics and B.2 feedback are unchanged.
- Profile displays per-world challenge progress and coin totals.
- **Đặt lại tiến trình** uses a native confirmation dialog and resets all local saved data.

## QA checklist
1. Run `npm ci && npm run build` and inspect Vercel Preview.
2. Set name and photo; complete 1–2 challenges; collect coins. Refresh and confirm name, photo, XP, checkpoint and coin count remain.
3. Use **Chơi tiếp**, enter Jump Mode, verify the character starts at the saved checkpoint and next correct command increments XP only once.
4. Finish a world, refresh, confirm completed world remains marked and replay begins at the first checkpoint.
5. Change world and difficulty; refresh and confirm persistence.
6. Test no-avatar fallback, speech success/failure, pause/resume, camera and mobile.
7. Click **Đặt lại tiến trình**, cancel once (data unchanged), then confirm (profile and XP reset).
8. Test private browsing / disabled storage: gameplay should remain usable and display a save warning.

## Storage and privacy
- No server-side sync, login or backend.
- Photo remains in localStorage on this browser only, subject to browser storage limits.
- Browser storage may be erased by clearing site data; data will not synchronize between devices.
- Coins represent cumulative pickups, not unique coin IDs. Replaying a world can earn additional coins.
- The saved checkpoint is the last **completed** challenge; partial jump/duck animations are not persisted.
