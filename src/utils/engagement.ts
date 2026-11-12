import { localDateKey } from './rewards';
import { worlds } from '../data/levels';

export const ENGAGEMENT_KEY = 'speak-jump-engagement-v1';
export type EngagementState = {
  version: 1;
  bestCombo: number;
  bonusDates: string[];
  dailyDates: string[];
};
export const initialEngagement = (): EngagementState => ({ version: 1, bestCombo: 0, bonusDates: [], dailyDates: [] });
const validDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function normalizeEngagement(value: unknown): EngagementState {
  if (!value || typeof value !== 'object') return initialEngagement();
  const raw = value as Partial<EngagementState>;
  if (raw.version !== 1) return initialEngagement();
  const dates = (value: unknown) => Array.isArray(value)
    ? [...new Set(value.filter(validDate))].slice(-180) : [];
  return {
    version: 1,
    bestCombo: typeof raw.bestCombo === 'number' && Number.isSafeInteger(raw.bestCombo)
      ? Math.min(100000, Math.max(0, raw.bestCombo)) : 0,
    bonusDates: dates(raw.bonusDates),
    dailyDates: dates(raw.dailyDates),
  };
}
export function readEngagement(): EngagementState {
  try { const raw = localStorage.getItem(ENGAGEMENT_KEY); return raw ? normalizeEngagement(JSON.parse(raw)) : initialEngagement(); }
  catch { return initialEngagement(); }
}
export function writeEngagement(value: EngagementState): boolean {
  try { localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function clearEngagement(): boolean {
  try { localStorage.removeItem(ENGAGEMENT_KEY); return true; }
  catch { return false; }
}
export function dailyWorld(date = localDateKey()): number {
  const [year, month, day] = date.split('-').map(Number);
  const epoch = Date.UTC(year, month - 1, day) / 86400000;
  return ((epoch % worlds.length) + worlds.length) % worlds.length;
}
export function recordCombo(previous: EngagementState, combo: number): EngagementState {
  return { ...previous, bestCombo: Math.max(previous.bestCombo, combo) };
}
export function claimDailyWorld(previous: EngagementState, world: number, date = localDateKey()): EngagementState | null {
  if (world !== dailyWorld(date) || previous.dailyDates.includes(date)) return null;
  return { ...previous, dailyDates: [...previous.dailyDates, date].slice(-180) };
}
export function claimComboBonus(previous: EngagementState, key: string): EngagementState | null {
  if (previous.bonusDates.includes(key)) return null;
  return { ...previous, bonusDates: [...previous.bonusDates, key].slice(-180) };
}
