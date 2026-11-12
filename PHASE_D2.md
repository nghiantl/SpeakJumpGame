# Phase D.2 — Personalized Learning & Smart Review

## Features
- Tracks recognized speech attempts per word/sentence during Jump Mode and Smart Review.
- Uses the best alternative transcript from browser SpeechRecognition to compute a **text similarity score** (0–100) using normalized Levenshtein distance.
- A success requires a normalized **exact transcript match**, preserving existing Jump Mode success criteria. Incorrect transcripts add to review history and show encouragement.
- Smart Review page accessible from Welcome, Map and Profile. Shows accuracy rate, review queue, items due, sample audio, and voice-only review practice.
- Repeated correct recognition can graduate a difficult word out of the queue. Review intervals use simple 0/1/3/7-day scheduling.
- Suggests beginner/elementary/intermediate based on recognition success rate; applies a suggested level only on explicit button press. Does not lock or alter worlds automatically.
- Versioned, validated `speak-jump-review-v1` localStorage; existing C.1/C.2/D.1 formats are untouched. Existing Reset Progress also clears D.2.

## Important limitations
- This is **speech-to-text transcript matching**, NOT a phoneme-level pronunciation assessment. SpeechRecognition may misrecognize correct pronunciation and may accept inaccurate pronunciation. UI labels avoid claiming acoustic accuracy.
- Demo success does not count as a spoken attempt. Only actual browser recognition results count.
- If the browser lacks SpeechRecognition or mic permission, Smart Review cannot record spoken attempts.
- Review practice does not award XP, coins, world completion or D.1 challenge events.
- Existing C.1/C.2/D.1 data is preserved. D.2 cannot reconstruct past recognition mistakes.
- The selected difficulty remains a user choice; world content is not automatically reordered.
- Browser/device localStorage only, no sync.

## QA checklist
1. Verify `npm run build` succeeds on Vercel Preview.
2. Open Smart Review from Welcome, Map, Profile on desktop and mobile.
3. Start Jump Mode with a supported microphone. Speak an incorrect word; check the item appears in Smart Review with last text-match score and miss count.
4. Speak a correct word; verify Jump Mode progresses and success count increments.
5. Open Smart Review, play sample audio, then use 🎙️ Luyện lại; check success/failure updates without awarding XP.
6. Practice correctly multiple times and verify the item can leave the queue.
7. Verify scheduling of due items and recommended difficulty after 5+ recognized attempts.
8. Select recommended difficulty, verify selected level changes without altering saved XP or world unlocks.
9. Refresh and verify data persistence; existing C.1/C.2/D.1 data unaffected.
10. Reset Progress; confirm D.2 data clears. Cancel reset; confirm it remains.
11. Try unsupported browser / denied mic and verify a helpful message instead of crash.
12. Verify Demo đúng does not count as voice recognition or increase review statistics.
