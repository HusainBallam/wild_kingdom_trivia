export type Question = {
  q: string;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
};

export type Difficulty = 'easy' | 'medium' | 'hard';

export type DifficultyConfig = {
  id: Difficulty;
  label: string;        // "Easy"
  trail: string;        // "Cub Trail"
  seconds: number;
  badge: string;        // emoji
  blurb: string;
};

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    trail: 'Cub Trail',
    seconds: 25,
    badge: '🐾',
    blurb: 'A gentle stroll · 25s per question',
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    trail: 'Ranger Trail',
    seconds: 15,
    badge: '🦒',
    blurb: 'Standard expedition · 15s per question',
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    trail: 'Predator Path',
    seconds: 8,
    badge: '🦁',
    blurb: 'For seasoned trackers · 8s per question',
  },
};

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];

export const QUESTIONS_PER_GAME = 10;
