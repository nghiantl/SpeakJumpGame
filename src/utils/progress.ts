import { worlds } from '../data/levels';

export const SAVE_KEY = 'speak-jump-progress-v1';

export type SavedProgress = {
  version: 1;
  name: string;
  photo: string;
  xp: number;
  completed: number[];
  mode: string;
  world: number;
  checkpoints: number[];
  coins: number[];
};

export const initialProgress = (): SavedProgress => ({
  version: 1, name: 'Adventurer', photo: '', xp: 0, completed: [],
  mode: 'beginner', world: 0,
  checkpoints: worlds.map(() => 0), coins: worlds.map(() => 0),
});

const clampInt = (value: unknown, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(max, Math.floor(value))) : 0;

export function readProgress(): SavedProgress {
  const fallback = initialProgress();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return fallback;
    const saved = value as Partial<SavedProgress>;
    if (saved.version !== 1) return fallback;
    const completed = Array.isArray(saved.completed)
      ? [...new Set(saved.completed.filter((n): n is number =>
          Number.isInteger(n) && n >= 0 && n < worlds.length))] : [];
    const checkpoints = worlds.map((w, i) =>
      clampInt(Array.isArray(saved.checkpoints) ? saved.checkpoints[i] : 0, w.challenges.length));
    const coins = worlds.map((_, i) =>
      clampInt(Array.isArray(saved.coins) ? saved.coins[i] : 0, 999999));
    return {
      version: 1,
      name: typeof saved.name === 'string' ? saved.name.slice(0, 24) : fallback.name,
      photo: typeof saved.photo === 'string' && saved.photo.startsWith('data:image/png;base64,') && saved.photo.length < 500000
        ? saved.photo : '',
      xp: clampInt(saved.xp, 999999999),
      completed,
      mode: ['beginner', 'elementary', 'intermediate'].includes(saved.mode ?? '') ? saved.mode! : fallback.mode,
      world: clampInt(saved.world, worlds.length - 1),
      checkpoints: checkpoints.map((n, i) => completed.includes(i) ? worlds[i].challenges.length : n),
      coins,
    };
  } catch {
    return fallback; // Corrupt or unavailable storage must never block gameplay.
  }
}

export function writeProgress(progress: SavedProgress): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false; // Storage may be disabled or full, especially for photo avatars.
  }
}

export function clearProgress(): boolean {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
