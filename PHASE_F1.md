# Phase F.1 — Game UI/UX & Mobile Optimization

## Implemented
- Mobile-first game layout, responsive 2-column/1-column controls, readable challenge words and accessible focus indicators.
- New HUD: XP, coins in current world, combo and checkpoint progress.
- Phaser scene loading overlay; voice/demo buttons disabled until the scene is active.
- Lightweight original Web Audio oscillator sound cues for jump, coin, checkpoint success, wrong answer and world completion. No external sound files, paid APIs or audio downloads.
- Sound effects enabled/disabled and adjustable volume (0–100%) in a top-bar settings panel. Settings persist separately as `speak-jump-settings-v1`.
- Desktop shortcuts in Jump Mode: **M** starts recognition, **Space** toggles pause, **Esc** returns to map. Shortcuts are ignored while focused on form controls/buttons and with Ctrl/Alt/Meta.
- Respects `prefers-reduced-motion` for the new HUD progress animation.
- Preserves existing C.1/C.2/D.1/D.2/E.2 localStorage schemas and progress. Reset Progress intentionally does **not** clear sound preferences.

## Important behavior
- Browser audio policies may block sound until the player interacts with the page. The game works without audio.
- Sound settings affect synthesized game SFX, **not** text-to-speech voice playback or microphone input.
- No external sound assets are required.
- The Phaser loading overlay waits for the scene to become active; controls remain disabled until ready.

## QA checklist
- [ ] Vercel Preview `npm run build` succeeds (TypeScript + Vite).
- [ ] Desktop and mobile layouts (320px, 375px, 768px) do not overflow horizontally.
- [ ] XP, coin, combo and checkpoint HUD update while playing.
- [ ] Loading overlay disappears after Phaser scene initializes; mic/demo cannot be used before scene ready.
- [ ] Sound effects work after user interaction for jump, coin, correct/incorrect and level completion.
- [ ] Sound toggle, volume slider and preview button work; reload preserves preferences.
- [ ] Turning off SFX does not mute English sample voice or microphone recognition.
- [ ] Keyboard M, Space and Esc work on desktop, and do not hijack typing into inputs.
- [ ] Pause prevents game controls from triggering; resume works.
- [ ] Reduced-motion OS preference disables the new progress animation.
- [ ] Avatar, XP, saved progress, Smart Review, analytics, rewards and E.2 daily quests remain intact.
- [ ] Reset Progress clears gameplay records but preserves sound settings.

**Draft PR only. Do not merge before user approval.**
