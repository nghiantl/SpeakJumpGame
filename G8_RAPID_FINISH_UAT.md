# G.8 rapid_finish hotfix — Preview validation

## Verified root cause
The original `g4_finish_attempt` function in `202611130004_g4_score_integrity.sql` rejects an attempt completed in less than **3 seconds**, returning `rapid_finish`. G.8 uses that same G.4 RPC for single-word challenges, producing false rejections for normal short speech.

## Implementation
Migration `202611150006_g8_short_speech_timing.sql` preserves the original 3-second minimum for **all ordinary G.4 attempts**. For a G.4 attempt whose ID is linked to a **server-owned** `g8_tournament_attempts` row, owned by the current user, with matching world/challenge and a tournament window covering the attempt start, it uses a **400ms** minimum. It does not sleep, delay submission or change the client-side speech recognition result. Rejections include `minimum_ms` for diagnosis.

**Important security limitation:** This does not prove a user actually spoke. Browser recognition is client-side and can be bypassed; a shorter minimum makes timing less strict for G.8. Keep awards cosmetic and review fraud telemetry. This is not a substitute for server-side speech verification.

## Safe rollout
1. Use an isolated Supabase Preview database containing G.4–G.8 migrations.
2. Apply `202611150005_g8_tournament_speech_record_hotfix.sql` first, then `202611150006_g8_short_speech_timing.sql`.
3. Verify `select pg_get_functiondef('public.g4_finish_attempt(uuid,text)'::regprocedure);` contains both `3 seconds` and `400 milliseconds`.
4. Run Preview build and UAT below; **do not apply to Production or merge without explicit owner approval**.

## UAT
- [ ] Short word Apple spoken correctly, after ~0.4–3 seconds: G.8 accepted, +100 once.
- [ ] Banana correctly recognized: +100 once, score refreshes.
- [ ] Wrong word: 0 points, immediate feedback, used attempt.
- [ ] No speech: no points; UI stops showing 'Đang nghe'.
- [ ] Very fast (under 400ms) G.8 finish: still `rapid_finish`.
- [ ] Ordinary G.4 attempt completed in under 3 seconds: still `rapid_finish`.
- [ ] Non-tournament G.4 attempts after 3 seconds: original behavior.
- [ ] Another user's attempt cannot be finished.
- [ ] Duplicate submission cannot grant points twice.
- [ ] Expired tournament cannot grant points.
- [ ] Microphone denied: no server ticket consumed.
- [ ] iPhone Safari and Android Chrome where SpeechRecognition supported.
- [ ] Review G.4 security flags and G.8 score ledger for abnormal patterns.

## Known limitation
Existing rejected attempts are still shown as **Đã thử** and are not automatically reopened by this migration. A new challenge/entry is needed for retesting. Do not mutate existing attempts or award backdated points without a separate audited remediation plan.
