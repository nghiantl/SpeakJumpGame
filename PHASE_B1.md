# Phase B.1 — Custom Face Avatar

## Features
- Upload a JPG, PNG or WebP (maximum 8 MB), or capture a photo from the camera.
- Crop the central square and render a circular 160 × 160 transparent PNG **locally in the browser**.
- Attach the avatar as the animated chibi's face inside Phaser, under the centered conical hat.
- Preserve the original cartoon face when no photo is selected.
- Do not upload, persist, or send the selected photo to any backend.

## Test checklist
1. Create a player, upload a photo, and verify the face preview.
2. Start a game and check that the photo stays centered while running, jumping and ducking.
3. Return to character setup, choose a different image, and check that the new face appears in the next game.
4. Use camera capture (HTTPS or localhost and browser permission required).
5. Select the default avatar and verify the cartoon eyes return.
6. Test unsupported/oversized files, microphone, XP, pause/resume and world transitions.
7. Run `npm ci && npm run build`.

## Notes
- The browser camera is optional and is stopped after capture.
- Face crop is center-based; manual repositioning and face detection are out of scope.
- Avatar is in-memory only; refreshing the page resets it.
- The existing game and voice mechanics are unchanged.
