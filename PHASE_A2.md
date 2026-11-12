# Phase A.2 – Arcade Physics platformer

This is an **integration candidate** based on the previously packaged Phase A project. The GitHub repository could be inspected in the browser but not cloned in the execution environment; compare changes with your latest GitHub commit before replacing files.

## Changes
- Arcade Physics sprite and static ground collision.
- Real terrain gaps for jump challenges.
- Voice-triggered jump/duck with an auto-running hero.
- Camera follows hero across a scrolling level.
- Checkpoint waiting and safe restoration after falling.
- Pause/resume, no duplicate command execution, React XP still awarded on `onActionComplete`.

## Test
1. `npm install && npm run build && npm run dev`
2. Start World 1 and wait for the first checkpoint; character should stop.
3. Say the target word or press Demo. Character crosses the gap and moves to the next checkpoint.
4. Test a world with `duck` actions and Pause/Resume.
5. Verify each completed challenge awards XP only once.

## Known limitations
- Artwork is still primitive, no imported sprite atlas.
- The level is linear; no branching, enemies or collectible persistence.
- A successful voice transcript triggers the action; pronunciation scoring is not yet integrated.
- Browser compatibility and production build must be verified in your environment.
