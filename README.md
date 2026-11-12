# Speak & Jump — English Adventure

Interactive React + TypeScript + Phaser 3 prototype for a voice-controlled English learning platformer.

## Run locally

Requires Node.js 20.19+ or 22.12+ (recommended for current Vite versions).

```bash
npm install
npm run dev
```

Open the localhost URL printed by Vite. Use HTTPS or localhost to access microphone/camera. Build with `npm run build`.

## Prototype features

- Welcome, microphone permission, optional camera/photo avatar, microphone calibration, difficulty selection
- Four world-map destinations: single words, compound words/phrases, simple sentences, complex sentences
- Learning flashcards with English text-to-speech
- Phaser 3 landscape platformer with jump/duck animation
- SpeechRecognition (when browser supports it) and a clearly labeled **Demo đúng** button to simulate success
- Results, XP and profile (in-memory only)

## Architecture

- `src/main.tsx`: React flow, prototype state, speech recognition and navigation
- `src/data/levels.ts`: typed world/challenge content
- `src/components/PhaserGame.tsx`: Phaser lifecycle adapter
- `src/game/GameScene.ts`: rendering and jump/duck commands
- `src/styles/app.css`: responsive styles

## Limitations / production next steps

- Browser speech recognition checks *transcript matching*, not actual pronunciation quality; integrate a dedicated pronunciation assessment provider and evaluate accent fairness.
- XP and progress reset on reload; add backend persistence and authentication.
- Avatar photos are held locally in React state; no upload in this prototype.
- For production, split React screens and services into modules; replace emoji/primitive Phaser shapes with licensed sprites, atlases and animation.
- Camera preview may not work in embedded/sandboxed contexts; test on HTTPS or localhost.
- Prevent duplicate speech submissions and stale speech callbacks using attempt IDs and a challenge state machine.
- The prototype allows entering all four worlds for demonstration; production should enforce unlock rules.

## Deploy on Vercel

1. Push this project folder (the folder containing `package.json`) to GitHub.
2. In https://vercel.com/new import the GitHub repository.
3. Framework Preset: **Vite**; Root Directory: repository root (or this subfolder if nested).
4. Build Command: `npm run build`; Output Directory: `dist`; Install Command: `npm install`.
5. Deploy. Vercel will give you a URL such as `https://your-project.vercel.app` (example only).

### Testing notes
- HTTPS is required for camera/microphone access on mobile browsers.
- SpeechRecognition is browser-dependent; Chrome desktop/Android is recommended for the first voice test. iOS browser support may vary.
- `Demo đúng` is a gameplay simulation, not a pronunciation score.
- Avatar face photo currently appears in React UI, **not yet composited into the Phaser sprite**.
- XP and completion are in-memory only and reset after refresh.
- No backend or pronunciation assessment service is included.
- Build was not verified in the packaging environment because npm dependency installation timed out. Run `npm install && npm run build` locally before publishing.
