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
  blurb: string;        // short description for the button
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

export const QUESTIONS: Question[] = [
  {
    q: 'What is the largest land animal on Earth?',
    options: ['African Elephant', 'White Rhinoceros', 'Hippopotamus', 'Giraffe'],
    answer: 0,
  },
  {
    q: 'Which bird is famous for being unable to fly but is the fastest runner among birds?',
    options: ['Penguin', 'Ostrich', 'Kiwi', 'Emu'],
    answer: 1,
  },
  {
    q: 'How many hearts does an octopus have?',
    options: ['1', '2', '3', '8'],
    answer: 2,
  },
  {
    q: 'What do you call a group of lions?',
    options: ['A pack', 'A herd', 'A pride', 'A troop'],
    answer: 2,
  },
  {
    q: 'Which mammal is known to lay eggs?',
    options: ['Platypus', 'Kangaroo', 'Sloth', 'Armadillo'],
    answer: 0,
  },
  {
    q: 'What is the fastest land animal?',
    options: ['Lion', 'Pronghorn antelope', 'Cheetah', 'Greyhound'],
    answer: 2,
  },
  {
    q: "A 'joey' is the baby of which animal?",
    options: ['Otter', 'Kangaroo', 'Fox', 'Owl'],
    answer: 1,
  },
  {
    q: 'Which of these animals is a marsupial?',
    options: ['Koala', 'Capybara', 'Lemur', 'Meerkat'],
    answer: 0,
  },
  {
    q: "What color is a polar bear's skin underneath its fur?",
    options: ['White', 'Pink', 'Black', 'Grey'],
    answer: 2,
  },
  {
    q: 'Which animal has the longest migration of any mammal?',
    options: ['Caribou', 'Gray Whale', 'Wildebeest', 'Humpback Whale'],
    answer: 3,
  },
];
