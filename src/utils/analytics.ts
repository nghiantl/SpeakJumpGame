import { localDateKey } from './rewards';
import { worlds } from '../data/levels';

export const ANALYTICS_KEY = 'speak-jump-analytics-v1';
export type LearningEvent = {
  id: string;
  timestamp: string;
  date: string;
  kind: 'challenge' | 'world';
  world: number;
  challenge?: number;
  xp: number;
};
export type WorldStats = { challenges: number; completions: number; lastPlayed: string };
export type AnalyticsState = {
  version: 1;
  events: LearningEvent[];
  worlds: WorldStats[];
};
const emptyWorld = (): WorldStats => ({ challenges: 0, completions: 0, lastPlayed: '' });
export const initialAnalytics = (): AnalyticsState => ({
  version: 1, events: [], worlds: worlds.map(emptyWorld),
});
const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 100000000) : 0;
const dateValid = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function normalizeAnalytics(input: unknown): AnalyticsState {
  const fallback = initialAnalytics();
  if (!input || typeof input !== 'object') return fallback;
  const raw = input as Partial<AnalyticsState>;
  if (raw.version !== 1) return fallback;
  const entries: LearningEvent[] = [];
  if (Array.isArray(raw.events)) for (const event of raw.events.slice(-500)) {
    if (!event || typeof event !== 'object' || !dateValid(event.date)
      || !Number.isInteger(event.world) || event.world < 0 || event.world >= worlds.length
      || (event.kind !== 'challenge' && event.kind !== 'world')
      || typeof event.timestamp !== 'string' || !Number.isFinite(Date.parse(event.timestamp))) continue;
    entries.push({
      id: typeof event.id === 'string' ? event.id.slice(0, 100) : String(entries.length),
      timestamp: event.timestamp,
      date: event.date,
      kind: event.kind,
      world: event.world,
      ...(event.kind === 'challenge' && Number.isInteger(event.challenge) && event.challenge! >= 0
        ? { challenge: event.challenge } : {}),
      xp: count(event.xp),
    });
  }
  return {
    version: 1,
    events: entries,
    worlds: worlds.map((_, i) => {
      const item = Array.isArray(raw.worlds) ? raw.worlds[i] : undefined;
      return {
        challenges: count(item?.challenges),
        completions: count(item?.completions),
        lastPlayed: dateValid(item?.lastPlayed) ? item.lastPlayed : '',
      };
    }),
  };
}
export function readAnalytics(): AnalyticsState {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    return raw ? normalizeAnalytics(JSON.parse(raw)) : initialAnalytics();
  } catch { return initialAnalytics(); }
}
export function writeAnalytics(value: AnalyticsState): boolean {
  try { localStorage.setItem(ANALYTICS_KEY, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function clearAnalytics(): boolean {
  try { localStorage.removeItem(ANALYTICS_KEY); return true; }
  catch { return false; }
}
export function recordLearning(
  previous: AnalyticsState, kind: LearningEvent['kind'], world: number,
  challenge?: number, now = new Date(),
): AnalyticsState {
  const current = normalizeAnalytics(previous);
  if (!Number.isInteger(world) || world < 0 || world >= worlds.length) return current;
  const date = localDateKey(now);
  const event: LearningEvent = {
    id: `${now.getTime()}-${current.events.length}-${kind}-${world}`,
    timestamp: now.toISOString(), date, kind, world,
    ...(kind === 'challenge' && challenge !== undefined ? { challenge } : {}),
    xp: kind === 'challenge' ? 100 : 0,
  };
  return {
    version: 1,
    events: [...current.events, event].slice(-500),
    worlds: current.worlds.map((item, i) => i !== world ? item : {
      challenges: item.challenges + (kind === 'challenge' ? 1 : 0),
      completions: item.completions + (kind === 'world' ? 1 : 0),
      lastPlayed: date,
    }),
  };
}
export function dateOffset(days: number, now = new Date()): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12);
  return localDateKey(date);
}
export function sevenDaySeries(value: AnalyticsState, now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = dateOffset(i - 6, now);
    const entries = value.events.filter(event => event.date === date && event.kind === 'challenge');
    return { date, label: date.slice(5), challenges: entries.length, xp: entries.reduce((sum, event) => sum + event.xp, 0) };
  });
}
export function learningStreak(value: AnalyticsState, now = new Date()): number {
  const active = new Set(value.events.filter(event => event.kind === 'challenge').map(event => event.date));
  const start = active.has(dateOffset(0, now)) ? 0 : -1;
  if (start === -1 && !active.has(dateOffset(-1, now))) return 0;
  let streak = 0;
  for (let offset = start === 0 ? 0 : -1; active.has(dateOffset(offset, now)); offset--) streak++;
  return streak;
}
