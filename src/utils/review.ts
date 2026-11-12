import { worlds } from '../data/levels';

export const REVIEW_KEY = 'speak-jump-review-v1';
export type ReviewEntry = {
  world: number;
  challenge: number;
  attempts: number;
  successes: number;
  misses: number;
  lastScore: number;
  bestScore: number;
  dueAt: string;
  lastPracticed: string;
};
export type ReviewState = { version: 1; entries: ReviewEntry[] };
export const initialReview = (): ReviewState => ({ version: 1, entries: [] });
const bounded = (n: unknown, max = 100000) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;
const validIndex = (world: number, challenge: number) =>
  Number.isInteger(world) && world >= 0 && world < worlds.length &&
  Number.isInteger(challenge) && challenge >= 0 && challenge < worlds[world].challenges.length;
const validDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
export function normalizeReview(input: unknown): ReviewState {
  if (!input || typeof input !== 'object') return initialReview();
  const raw = input as Partial<ReviewState>;
  if (raw.version !== 1 || !Array.isArray(raw.entries)) return initialReview();
  const entries: ReviewEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw.entries) {
    if (!item || !validIndex(item.world, item.challenge)) continue;
    const key = `${item.world}:${item.challenge}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      world: item.world, challenge: item.challenge,
      attempts: bounded(item.attempts), successes: bounded(item.successes),
      misses: bounded(item.misses), lastScore: bounded(item.lastScore, 100),
      bestScore: bounded(item.bestScore, 100),
      dueAt: validDate(item.dueAt) ? item.dueAt : '',
      lastPracticed: validDate(item.lastPracticed) ? item.lastPracticed : '',
    });
  }
  return { version: 1, entries };
}
export function readReview(): ReviewState {
  try { const value = localStorage.getItem(REVIEW_KEY); return value ? normalizeReview(JSON.parse(value)) : initialReview(); }
  catch { return initialReview(); }
}
export function writeReview(value: ReviewState): boolean {
  try { localStorage.setItem(REVIEW_KEY, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function clearReview(): boolean {
  try { localStorage.removeItem(REVIEW_KEY); return true; }
  catch { return false; }
}
export function normalizeSpeech(value: string): string {
  return value.toLowerCase().normalize('NFKC').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function transcriptScore(expected: string, actual: string): number {
  const a = normalizeSpeech(expected), b = normalizeSpeech(actual);
  if (!a || !b) return 0;
  if (a === b) return 100;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const next = [i];
    for (let j = 1; j <= n; j++) {
      next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = next;
  }
  return Math.max(0, Math.round(100 * (1 - prev[n] / Math.max(m, n))));
}
export function recordReview(
  previous: ReviewState, world: number, challenge: number, score: number,
  accepted: boolean, now = new Date(),
): ReviewState {
  const state = normalizeReview(previous);
  if (!validIndex(world, challenge)) return state;
  const current = state.entries.find(item => item.world === world && item.challenge === challenge);
  const successes = (current?.successes || 0) + Number(accepted);
  const misses = (current?.misses || 0) + Number(!accepted);
  const intervalDays = !accepted ? 0 : misses === 0 && successes >= 3 ? 7 : successes >= 2 ? 3 : 1;
  const due = new Date(now.getTime() + (intervalDays ? intervalDays * 86400000 : 0));
  const next: ReviewEntry = {
    world, challenge, attempts: (current?.attempts || 0) + 1,
    successes, misses, lastScore: bounded(score, 100),
    bestScore: Math.max(current?.bestScore || 0, bounded(score, 100)),
    dueAt: due.toISOString(), lastPracticed: now.toISOString(),
  };
  return { version: 1, entries: [...state.entries.filter(item => item.world !== world || item.challenge !== challenge), next] };
}
export function reviewPriority(entry: ReviewEntry, now = new Date()): number {
  const due = !entry.dueAt || Date.parse(entry.dueAt) <= now.getTime();
  return (due ? 100 : 0) + entry.misses * 4 - entry.successes * 2 + (100 - entry.lastScore) / 10;
}
export function reviewQueue(state: ReviewState, now = new Date()) {
  return normalizeReview(state).entries.filter(item => item.lastScore < 100 || item.successes <= item.misses)
    .sort((a, b) => reviewPriority(b, now) - reviewPriority(a, now));
}
export function suggestedDifficulty(state: ReviewState): { level: 'beginner' | 'elementary' | 'intermediate'; reason: string } {
  const entries = normalizeReview(state).entries;
  const attempts = entries.reduce((sum, entry) => sum + entry.attempts, 0);
  if (attempts < 5) return { level: 'beginner', reason: 'Cần ít nhất 5 lượt luyện nói để đề xuất trình độ phù hợp.' };
  const successRate = entries.reduce((sum, entry) => sum + entry.successes, 0) / attempts;
  if (successRate >= .9 && attempts >= 10) return { level: 'intermediate', reason: 'Tỉ lệ nhận diện đúng cao. Bạn có thể thử câu dài hơn.' };
  if (successRate >= .7) return { level: 'elementary', reason: 'Bạn đang tiến bộ tốt. Hãy luyện thêm cụm từ và câu ngắn.' };
  return { level: 'beginner', reason: 'Hãy củng cố từ đơn và luyện lại các mục chưa được nhận diện đúng.' };
}
