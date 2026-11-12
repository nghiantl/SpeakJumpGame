import { worlds } from '../data/levels';

export const REWARDS_KEY = 'speak-jump-rewards-v1';

export type DailyActivity = 'challenge' | 'coin' | 'world';
export type DailyProgress = {
  date: string;
  challenges: number;
  coins: number;
  worlds: number;
  claimed: boolean;
};
export type RewardsState = {
  version: 1;
  daily: DailyProgress;
  chests: string[];
  totalChallenges: number;
};
export type Badge = {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
};

export const localDateKey = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const emptyDaily = (date: string): DailyProgress => ({
  date, challenges: 0, coins: 0, worlds: 0, claimed: false,
});
export const initialRewards = (date = localDateKey()): RewardsState => ({
  version: 1, daily: emptyDaily(date), chests: [], totalChallenges: 0,
});

const safeCount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100000000, Math.floor(value))) : 0;

export function normalizeRewards(input: unknown, date = localDateKey()): RewardsState {
  const fallback = initialRewards(date);
  if (!input || typeof input !== 'object') return fallback;
  const value = input as Partial<RewardsState>;
  if (value.version !== 1) return fallback;
  const rawDaily = value.daily && typeof value.daily === 'object' ? value.daily : fallback.daily;
  const validChests = new Set(CHESTS.map(chest => chest.id));
  return {
    version: 1,
    daily: rawDaily.date === date ? {
      date,
      challenges: safeCount(rawDaily.challenges),
      coins: safeCount(rawDaily.coins),
      worlds: safeCount(rawDaily.worlds),
      claimed: rawDaily.claimed === true,
    } : emptyDaily(date),
    chests: Array.isArray(value.chests)
      ? [...new Set(value.chests.filter((id): id is string => typeof id === 'string' && validChests.has(id)))]
      : [],
    totalChallenges: safeCount(value.totalChallenges),
  };
}

export function readRewards(date = localDateKey()): RewardsState {
  try {
    const raw = localStorage.getItem(REWARDS_KEY);
    return raw ? normalizeRewards(JSON.parse(raw), date) : initialRewards(date);
  } catch {
    return initialRewards(date);
  }
}

export function writeRewards(rewards: RewardsState): boolean {
  try {
    localStorage.setItem(REWARDS_KEY, JSON.stringify(rewards));
    return true;
  } catch {
    return false;
  }
}

export function clearRewards(): boolean {
  try {
    localStorage.removeItem(REWARDS_KEY);
    return true;
  } catch {
    return false;
  }
}

export const DAILY_GOALS = [
  { id: 'challenge', icon: '🎤', title: 'Vượt 3 thử thách', target: 3, field: 'challenges' as const },
  { id: 'coin', icon: '🪙', title: 'Nhặt 5 xu', target: 5, field: 'coins' as const },
  { id: 'world', icon: '🏁', title: 'Hoàn thành 1 thế giới', target: 1, field: 'worlds' as const },
];

export const CHESTS = [
  { id: 'bronze', icon: '🎁', title: 'Rương Đồng', xpRequired: 500, xpReward: 100, coinReward: 10 },
  { id: 'silver', icon: '🧰', title: 'Rương Bạc', xpRequired: 1500, xpReward: 150, coinReward: 20 },
  { id: 'gold', icon: '🏆', title: 'Rương Vàng', xpRequired: 3000, xpReward: 250, coinReward: 30 },
] as const;

export function dailyGoalsComplete(rewards: RewardsState) {
  return DAILY_GOALS.every(goal => rewards.daily[goal.field] >= goal.target);
}

export function recordActivity(
  previous: RewardsState, activity: DailyActivity, date = localDateKey(),
): RewardsState {
  const current = normalizeRewards(previous, date);
  const field = activity === 'challenge' ? 'challenges' : activity === 'coin' ? 'coins' : 'worlds';
  return {
    ...current,
    daily: { ...current.daily, [field]: current.daily[field] + 1 },
    totalChallenges: current.totalChallenges + (activity === 'challenge' ? 1 : 0),
  };
}

export function claimDaily(previous: RewardsState, date = localDateKey()): RewardsState | null {
  const current = normalizeRewards(previous, date);
  if (current.daily.claimed || !dailyGoalsComplete(current)) return null;
  return { ...current, daily: { ...current.daily, claimed: true } };
}

export function claimChest(previous: RewardsState, chestId: string, xp: number, date = localDateKey()): RewardsState | null {
  const current = normalizeRewards(previous, date);
  const chest = CHESTS.find(item => item.id === chestId);
  if (!chest || xp < chest.xpRequired || current.chests.includes(chest.id)) return null;
  return { ...current, chests: [...current.chests, chest.id] };
}

export function getBadges(xp: number, completed: number[], rewards: RewardsState): Badge[] {
  return [
    { id: 'first-step', icon: '🌱', title: 'Bước đầu tiên', description: 'Vượt 1 thử thách', unlocked: rewards.totalChallenges >= 1 || xp >= 100 },
    { id: 'speaker', icon: '🎤', title: 'Người luyện nói', description: 'Vượt 10 thử thách', unlocked: rewards.totalChallenges >= 10 },
    { id: 'explorer', icon: '🗺️', title: 'Nhà thám hiểm', description: 'Hoàn thành 1 thế giới', unlocked: completed.length >= 1 },
    { id: 'champion', icon: '🏆', title: 'Chinh phục bản đồ', description: `Hoàn thành ${worlds.length} thế giới`, unlocked: completed.length >= worlds.length },
    { id: 'star', icon: '⭐', title: 'Ngôi sao 500 XP', description: 'Đạt 500 XP', unlocked: xp >= 500 },
    { id: 'legend', icon: '💎', title: 'Huyền thoại 2000 XP', description: 'Đạt 2000 XP', unlocked: xp >= 2000 },
  ];
}
