# Phase A.3 — Visual gameplay enhancement

Branch: `feat/phase-a3-visual-effects`

## Implemented
- Multi-layer parallax scenery (sun, distant mountains and rolling hills).
- Animated chibi arms and legs during auto-run, airborne tilt and duck pose.
- Footstep and landing dust particles.
- Animated checkpoint flags.
- Collectible coins, collected once per contact, with a camera-fixed coin HUD.
- Preserves existing A.2 Arcade Physics, checkpoint flow, React voice command bridge, and XP callback.

## Run locally
```bash
npm ci
npm run build
npm run dev
```

## Manual QA
1. Start World 1; wait for the first checkpoint.
2. Say Apple or click Demo; confirm jump animation, dust and camera follow.
3. Verify coins increase only when touched.
4. Open a world with Duck; confirm crouch animation and passage.
5. Pause/resume and finish all challenges; verify XP is awarded once per challenge.
6. Check desktop and mobile layouts.

## Limitations
- Procedural vector art; not an imported sprite atlas.
- Coin HUD is session-only; coins do not persist to player profile.
- The new build has not been run in the remote GitHub environment; CI/Vercel and browser QA are still required.
