import type { Difficulty } from '../data/questions';

const STORAGE_KEY = 'wkt-leaderboard-v1';
export const LEADERBOARD_MAX = 5;

export type LeaderboardEntry = {
  name: string;
  score: number;
  total: number;
  difficulty: Difficulty;
  date: number;
};

const DIFF_RANK: Record<Difficulty, number> = { hard: 3, medium: 2, easy: 1 };

function isDifficulty(v: unknown): v is Difficulty {
  return v === 'easy' || v === 'medium' || v === 'hard';
}

function isEntry(v: unknown): v is LeaderboardEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.name === 'string' &&
    typeof e.score === 'number' &&
    typeof e.total === 'number' &&
    isDifficulty(e.difficulty) &&
    typeof e.date === 'number'
  );
}

export function loadLeaderboard(): LeaderboardEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, LEADERBOARD_MAX);
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries: LeaderboardEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* localStorage unavailable / full — ignore */
  }
}

export function addScore(entry: LeaderboardEntry): LeaderboardEntry[] {
  const next = [...loadLeaderboard(), entry];
  next.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (DIFF_RANK[b.difficulty] !== DIFF_RANK[a.difficulty]) {
      return DIFF_RANK[b.difficulty] - DIFF_RANK[a.difficulty];
    }
    return a.date - b.date;
  });
  const trimmed = next.slice(0, LEADERBOARD_MAX);
  saveLeaderboard(trimmed);
  return trimmed;
}

export function clearLeaderboard(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
