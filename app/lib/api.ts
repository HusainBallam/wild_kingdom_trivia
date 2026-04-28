import type { Difficulty, Question } from '../data/questions';

const API_URL = 'https://opentdb.com/api.php';
const ANIMALS_CATEGORY = 27;

type ApiResultRaw = {
  type: string;
  difficulty: Difficulty;
  category: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
};

type ApiResponse = {
  response_code: number;
  results: ApiResultRaw[];
};

const RESPONSE_MESSAGES: Record<number, string> = {
  1: 'Not enough field notes for that trail — try another difficulty.',
  2: 'The wildlife archive rejected our request.',
  3: 'Session expired — please try again.',
  4: "You've seen every available field note. Try another trail.",
  5: 'Too many requests — wait a few seconds and try again.',
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function toQuestion(raw: ApiResultRaw): Question {
  const correct = decode(raw.correct_answer);
  const incorrect = raw.incorrect_answers.map(decode);
  const shuffled = shuffle([correct, ...incorrect]);
  const options: [string, string, string, string] = [
    shuffled[0] ?? '',
    shuffled[1] ?? '',
    shuffled[2] ?? '',
    shuffled[3] ?? '',
  ];
  const idx = options.indexOf(correct);
  const answer = (idx >= 0 && idx <= 3 ? idx : 0) as 0 | 1 | 2 | 3;
  return {
    q: decode(raw.question),
    options,
    answer,
  };
}

export async function fetchQuestions(
  difficulty: Difficulty,
  amount = 10,
  signal?: AbortSignal,
): Promise<Question[]> {
  const params = new URLSearchParams({
    amount: String(amount),
    category: String(ANIMALS_CATEGORY),
    difficulty,
    type: 'multiple',
    encode: 'url3986',
  });

  let res: Response;
  try {
    res = await fetch(`${API_URL}?${params.toString()}`, { signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error('Could not reach the wildlife archive. Check your connection.');
  }

  if (!res.ok) {
    throw new Error(`Wildlife archive returned HTTP ${res.status}.`);
  }

  let data: ApiResponse;
  try {
    data = (await res.json()) as ApiResponse;
  } catch {
    throw new Error('Wildlife archive returned an unreadable response.');
  }

  if (data.response_code !== 0) {
    throw new Error(
      RESPONSE_MESSAGES[data.response_code] ??
        `Wildlife archive error (code ${data.response_code}).`,
    );
  }

  if (!Array.isArray(data.results) || data.results.length === 0) {
    throw new Error('No field notes returned. Try another trail.');
  }

  const valid = data.results.filter(
    (r) =>
      r.type === 'multiple' &&
      Array.isArray(r.incorrect_answers) &&
      r.incorrect_answers.length === 3 &&
      typeof r.correct_answer === 'string' &&
      typeof r.question === 'string',
  );

  if (valid.length === 0) {
    throw new Error('No usable field notes returned. Try again.');
  }

  return valid.map(toQuestion);
}
