export const GAME_SETTINGS_KEY = 'speak-jump-settings-v1';
export type GameSettings = { version: 1; soundEnabled: boolean; volume: number };
export const defaultGameSettings = (): GameSettings => ({ version: 1, soundEnabled: true, volume: 0.5 });
export function readGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(GAME_SETTINGS_KEY);
    if (!raw) return defaultGameSettings();
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return defaultGameSettings();
    const data = value as Partial<GameSettings>;
    if (data.version !== 1) return defaultGameSettings();
    return { version: 1, soundEnabled: data.soundEnabled !== false, volume: typeof data.volume === 'number' && Number.isFinite(data.volume) ? Math.max(0, Math.min(1, data.volume)) : 0.5 };
  } catch { return defaultGameSettings(); }
}
export function writeGameSettings(settings: GameSettings): boolean {
  try { localStorage.setItem(GAME_SETTINGS_KEY, JSON.stringify(settings)); return true; }
  catch { return false; }
}
