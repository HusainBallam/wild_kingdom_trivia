'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  QUESTIONS_PER_GAME,
  type Difficulty,
  type Question,
} from '../data/questions';
import { fetchQuestions } from '../lib/api';
import {
  loadLeaderboard,
  addScore,
  clearLeaderboard,
  type LeaderboardEntry,
} from '../lib/storage';
import JungleBackground from './JungleBackground';
import Leaderboard from './Leaderboard';

type Screen = 'start' | 'loading' | 'question' | 'results';
type Phase = 'idle' | 'leaving' | 'entering';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
const CONFETTI_COLORS = ['#f5c542', '#5cae5f', '#2f7a3d', '#e09b1a', '#fff7e3', '#c0392b'];
const TRANSITION_MS = 300;
const ADVANCE_DELAY_MS = 1700;
const HIGH_SCORE_THRESHOLD = 0.8;
const NAME_MAX = 20;

function resultCopy(score: number, total: number) {
  const pct = total > 0 ? score / total : 0;
  if (pct === 1)        return { title: 'Safari Legend!',    blurb: 'A perfect score — you know the wild kingdom inside out!',                trophy: '🏆' };
  if (pct >= 0.8)       return { title: 'Sharp Tracker!',    blurb: 'Outstanding work — only the best rangers spot that many.',              trophy: '🥇' };
  if (pct >= 0.6)       return { title: 'Field Naturalist',  blurb: "Solid performance — you've got real animal smarts.",                    trophy: '🥈' };
  if (pct >= 0.4)       return { title: 'Curious Cub',       blurb: 'A decent first expedition — try again to sharpen your skills.',         trophy: '🐾' };
  return                       { title: 'Back to Basecamp',  blurb: 'The wild is full of surprises! Give it another go.',                    trophy: '🌿' };
}

export default function TriviaGame() {
  const [screen, setScreen] = useState<Screen>('start');
  const [screenPhase, setScreenPhase] = useState<Phase>('idle');
  const [questionPhase, setQuestionPhase] = useState<Phase>('idle');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'good' | 'bad'; text: string } | null>(null);

  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty>('medium');
  const [timeLeft, setTimeLeft] = useState<number>(DIFFICULTIES.medium.seconds);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [savedEntryDate, setSavedEntryDate] = useState<number | null>(null);

  const confettiLayerRef = useRef<HTMLDivElement>(null);
  const wrongFlashRef = useRef<HTMLDivElement>(null);

  const advanceTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenSwapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionSwapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enteringResetRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highScoreTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAbortRef      = useRef<AbortController | null>(null);

  // Audio
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sfxBusRef = useRef<{ master: GainNode; oscs: OscillatorNode[] } | null>(null);
  const lastTickSecRef = useRef<number | null>(null);

  const activeDiff = DIFFICULTIES[activeDifficulty];
  const questionTime = activeDiff.seconds;

  const currentQ: Question | null = useMemo(() => {
    if (screen !== 'question') return null;
    return questions[currentIndex] ?? null;
  }, [screen, questions, currentIndex]);

  // ---- Hydrate leaderboard from localStorage ----
  useEffect(() => {
    setLeaderboard(loadLeaderboard());
  }, []);

  // ---- Cleanup ----
  const clearTimers = useCallback(() => {
    [
      advanceTimerRef,
      screenSwapTimerRef,
      questionSwapTimerRef,
      enteringResetRef,
      highScoreTimerRef,
    ].forEach((r) => {
      if (r.current) clearTimeout(r.current);
      r.current = null;
    });
    if (fetchAbortRef.current) {
      try { fetchAbortRef.current.abort(); } catch { /* ignore */ }
      fetchAbortRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearTimers();
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, [clearTimers]);

  // ---- Audio core ----
  const ensureAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!audioCtxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      try { audioCtxRef.current = new Ctx(); } catch { audioCtxRef.current = null; }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  const killSfxBus = useCallback(() => {
    const ctx = audioCtxRef.current;
    const bus = sfxBusRef.current;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    try {
      bus.master.gain.cancelScheduledValues(t);
      const cur = Math.max(bus.master.gain.value, 0.0001);
      bus.master.gain.setValueAtTime(cur, t);
      bus.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    } catch { /* node might be in a weird state */ }
    bus.oscs.forEach((o) => {
      try { o.stop(t + 0.025); } catch { /* already stopped */ }
    });
    sfxBusRef.current = null;
  }, []);

  const newSfxBus = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return null;
    killSfxBus();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    const bus = { master, oscs: [] as OscillatorNode[] };
    sfxBusRef.current = bus;
    return bus;
  }, [killSfxBus]);

  const playTick = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const bus = newSfxBus();
    if (!bus) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.05);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.28, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(env).connect(bus.master);
    osc.start(t);
    osc.stop(t + 0.08);
    bus.oscs.push(osc);
  }, [newSfxBus]);

  const playCorrect = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const bus = newSfxBus();
    if (!bus) return;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const start = t + i * 0.085;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(0.22, start + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.connect(env).connect(bus.master);
      osc.start(start);
      osc.stop(start + 0.34);
      bus.oscs.push(osc);
    });
  }, [newSfxBus]);

  const playWrong = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const bus = newSfxBus();
    if (!bus) return;
    const t = ctx.currentTime;
    const segs = [
      { f: 230, dur: 0.20 },
      { f: 165, dur: 0.32 },
    ];
    let cursor = t;
    segs.forEach(({ f, dur }) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, cursor);
      osc.frequency.exponentialRampToValueAtTime(f * 0.82, cursor + dur);
      env.gain.setValueAtTime(0.0001, cursor);
      env.gain.exponentialRampToValueAtTime(0.18, cursor + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, cursor + dur);
      osc.connect(env).connect(bus.master);
      osc.start(cursor);
      osc.stop(cursor + dur + 0.02);
      bus.oscs.push(osc);
      cursor += dur * 0.78;
    });
  }, [newSfxBus]);

  const playHighScore = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const bus = newSfxBus();
    if (!bus) return;
    const t = ctx.currentTime;
    const notes = [
      { f: 523.25, start: 0,    dur: 0.18 },
      { f: 659.25, start: 0.18, dur: 0.18 },
      { f: 783.99, start: 0.36, dur: 0.18 },
      { f: 1046.5, start: 0.56, dur: 0.75 },
    ];
    notes.forEach(({ f, start, dur }) => {
      const at = t + start;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const env = ctx.createGain();
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.value = f;
      osc2.frequency.value = f * 2;
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(0.22, at + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc1.connect(env);
      osc2.connect(env);
      env.connect(bus.master);
      osc1.start(at);
      osc2.start(at);
      osc1.stop(at + dur + 0.02);
      osc2.stop(at + dur + 0.02);
      bus.oscs.push(osc1, osc2);
    });
  }, [newSfxBus]);

  // ---- Confetti & wrong flash ----
  const celebrate = useCallback(() => {
    const layer = confettiLayerRef.current;
    if (!layer) return;
    for (let i = 0; i < 28; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      piece.style.animationDuration = 0.9 + Math.random() * 0.7 + 's';
      piece.style.animationDelay = Math.random() * 0.15 + 's';
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 1800);
    }
  }, []);

  const flashWrong = useCallback(() => {
    const el = wrongFlashRef.current;
    if (!el) return;
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 500);
  }, []);

  // ---- Timer ticking ----
  useEffect(() => {
    if (screen !== 'question' || answered) return;
    const startedAt = Date.now();
    setTimeLeft(questionTime);
    const id = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, questionTime - elapsed);
      setTimeLeft(left);
      if (left <= 0) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [screen, currentIndex, answered, questionTime]);

  useEffect(() => {
    if (screen !== 'question' || answered) {
      lastTickSecRef.current = null;
      return;
    }
    const sec = Math.ceil(timeLeft);
    if (sec <= 5 && sec >= 1 && sec !== lastTickSecRef.current) {
      lastTickSecRef.current = sec;
      playTick();
    }
  }, [timeLeft, screen, answered, playTick]);

  // ---- Game flow ----
  const goToResults = useCallback(() => {
    setScreenPhase('leaving');
    screenSwapTimerRef.current = setTimeout(() => {
      setScreen('results');
      setScreenPhase('entering');
      enteringResetRef.current = setTimeout(() => setScreenPhase('idle'), 20);
    }, TRANSITION_MS);
  }, []);

  const advanceToNext = useCallback(() => {
    if (currentIndex + 1 >= questions.length) {
      goToResults();
      return;
    }
    setQuestionPhase('leaving');
    questionSwapTimerRef.current = setTimeout(() => {
      setCurrentIndex((i) => i + 1);
      setAnswered(false);
      setSelected(null);
      setFeedback(null);
      setQuestionPhase('entering');
      enteringResetRef.current = setTimeout(() => setQuestionPhase('idle'), 20);
    }, TRANSITION_MS);
  }, [currentIndex, questions.length, goToResults]);

  // Detect time-out
  useEffect(() => {
    if (screen !== 'question' || answered) return;
    if (timeLeft > 0) return;
    const q = currentQ;
    setAnswered(true);
    setSelected(null);
    if (q) {
      setFeedback({
        type: 'bad',
        text: `⏰ Time's up! The answer was ${q.options[q.answer]}.`,
      });
      flashWrong();
      playWrong();
    }
    advanceTimerRef.current = setTimeout(advanceToNext, ADVANCE_DELAY_MS);
  }, [timeLeft, screen, answered, currentQ, flashWrong, playWrong, advanceToNext]);

  // High-score fanfare on results entry
  useEffect(() => {
    if (screen !== 'results') return;
    if (questions.length === 0) return;
    if (score / questions.length < HIGH_SCORE_THRESHOLD) return;
    highScoreTimerRef.current = setTimeout(() => playHighScore(), 350);
    return () => {
      if (highScoreTimerRef.current) clearTimeout(highScoreTimerRef.current);
      highScoreTimerRef.current = null;
    };
  }, [screen, score, questions.length, playHighScore]);

  // After fetch resolves on the loading screen, transition forward (or back to start on error).
  useEffect(() => {
    if (screen !== 'loading') return;
    if (screenPhase !== 'idle') return;
    if (questions.length > 0) {
      setScreenPhase('leaving');
      screenSwapTimerRef.current = setTimeout(() => {
        setScreen('question');
        setScreenPhase('entering');
        enteringResetRef.current = setTimeout(() => setScreenPhase('idle'), 20);
      }, TRANSITION_MS);
    } else if (loadError) {
      setScreenPhase('leaving');
      screenSwapTimerRef.current = setTimeout(() => {
        setScreen('start');
        setScreenPhase('entering');
        enteringResetRef.current = setTimeout(() => setScreenPhase('idle'), 20);
      }, TRANSITION_MS);
    }
  }, [screen, screenPhase, questions.length, loadError]);

  const startGame = useCallback(() => {
    clearTimers();
    ensureAudio();

    setScore(0);
    setCurrentIndex(0);
    setAnswered(false);
    setSelected(null);
    setFeedback(null);
    setActiveDifficulty(difficulty);
    setTimeLeft(DIFFICULTIES[difficulty].seconds);
    setPlayerName('');
    setSavedEntryDate(null);
    setQuestions([]);
    setLoadError(null);
    lastTickSecRef.current = null;

    // Transition the visible screen → loading
    setScreenPhase('leaving');
    screenSwapTimerRef.current = setTimeout(() => {
      setScreen('loading');
      setScreenPhase('entering');
      enteringResetRef.current = setTimeout(() => setScreenPhase('idle'), 20);
    }, TRANSITION_MS);

    // Kick off the fetch in parallel; the loading→question transition is driven
    // by the effect above once `questions` populates (or `loadError` is set).
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    fetchQuestions(difficulty, QUESTIONS_PER_GAME, controller.signal)
      .then((qs) => {
        if (controller.signal.aborted) return;
        setQuestions(qs);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const msg =
          err instanceof Error ? err.message : 'Could not load field notes.';
        setLoadError(msg);
      });
  }, [clearTimers, ensureAudio, difficulty]);

  const goHome = useCallback(() => {
    clearTimers();
    setAnswered(false);
    setSelected(null);
    setFeedback(null);
    setQuestionPhase('idle');
    setLoadError(null);
    setScreenPhase('leaving');
    screenSwapTimerRef.current = setTimeout(() => {
      setScreen('start');
      setScreenPhase('entering');
      enteringResetRef.current = setTimeout(() => setScreenPhase('idle'), 20);
    }, TRANSITION_MS);
  }, [clearTimers]);

  function handleAnswer(idx: number) {
    if (answered || !currentQ) return;
    setAnswered(true);
    setSelected(idx);

    const correct = idx === currentQ.answer;
    if (correct) {
      setScore((s) => s + 1);
      setFeedback({ type: 'good', text: 'Correct! 🎉 Well spotted, ranger!' });
      celebrate();
      playCorrect();
    } else {
      setFeedback({
        type: 'bad',
        text: `Not quite — the answer was ${currentQ.options[currentQ.answer]}.`,
      });
      flashWrong();
      playWrong();
    }

    advanceTimerRef.current = setTimeout(advanceToNext, ADVANCE_DELAY_MS);
  }

  function handleSaveScore(e: React.FormEvent) {
    e.preventDefault();
    const name = playerName.trim();
    if (!name || questions.length === 0) return;
    const date = Date.now();
    const updated = addScore({
      name: name.slice(0, NAME_MAX),
      score,
      total: questions.length,
      difficulty: activeDifficulty,
      date,
    });
    setLeaderboard(updated);
    setSavedEntryDate(date);
  }

  function handleClearLeaderboard() {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        'Clear the field journal? This will remove all leaderboard entries.'
      );
      if (!ok) return;
    }
    clearLeaderboard();
    setLeaderboard([]);
    setSavedEntryDate(null);
  }

  // ---- Derived UI ----
  const showStatusBar = screen === 'question';
  const urgent = timeLeft <= 5;
  const timerPct = Math.max(0, (timeLeft / questionTime) * 100);
  const totalQuestions = questions.length;

  const screenClass = (s: Screen) =>
    'screen' + (screen === s && screenPhase !== 'idle' ? ' ' + screenPhase : '');
  const questionScreenClass =
    'screen' +
    (questionPhase !== 'idle' ? ' ' + questionPhase : '') +
    (screen === 'question' && screenPhase !== 'idle' ? ' ' + screenPhase : '');

  return (
    <>
      <JungleBackground />
      <div className="app" role="application" aria-label="Animal trivia game">
        <header className="banner">
          <h1>Wild Kingdom Trivia</h1>
          <div className="subtitle">Field Guide · Animal Edition</div>
        </header>

        {showStatusBar && (
          <>
            <div className="trail-strip" aria-label={`Difficulty ${activeDiff.label}`}>
              <span className="badge" aria-hidden>{activeDiff.badge}</span>
              <span>Trail: {activeDiff.trail}</span>
            </div>
            <div className="status">
              <div className="pill">
                <span className="label">Field Note</span>
                <span className="value">
                  {currentIndex + 1} / {totalQuestions}
                </span>
              </div>
              <div className="pill">
                <span className="label">Score</span>
                <span className="value">{score}</span>
              </div>
              <div className={'pill timer' + (urgent ? ' urgent' : '')}>
                <span className="label">Time</span>
                <span className="value">{Math.max(0, Math.ceil(timeLeft))}s</span>
              </div>
            </div>
            <div className="timer-bar-wrap">
              <div
                className={'timer-bar' + (urgent ? ' urgent' : '')}
                style={{ width: timerPct + '%' }}
              />
            </div>
          </>
        )}

        <main>
          <div className="confetti-layer" ref={confettiLayerRef} aria-hidden />
          <div className="wrong-flash" ref={wrongFlashRef} aria-hidden />

          {/* ---------- Start screen ---------- */}
          {screen === 'start' && (
            <section className={screenClass('start') + ' start'}>
              <div className="hero">🐾</div>
              <h2>Ready to roam the animal kingdom?</h2>
              <p className="lead">
                10 fresh field notes pulled from the wildlife archive. 4 choices each. Beat the
                clock, log your score, and climb the journal of legendary rangers.
              </p>

              {loadError && (
                <div className="error-banner" role="alert">{loadError}</div>
              )}

              <div className="difficulty-section">
                <div className="difficulty-heading">Choose your trail</div>
                <div className="difficulty-grid" role="radiogroup" aria-label="Difficulty">
                  {DIFFICULTY_ORDER.map((d) => {
                    const cfg = DIFFICULTIES[d];
                    const selected = difficulty === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={'diff-btn' + (selected ? ' is-selected' : '')}
                        onClick={() => setDifficulty(d)}
                      >
                        <span className="diff-badge" aria-hidden>{cfg.badge}</span>
                        <span className="diff-label">{cfg.label}</span>
                        <span className="diff-time">{cfg.trail} · {cfg.seconds}s</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button className="btn" onClick={startGame} type="button">
                Begin Safari
              </button>

              <Leaderboard entries={leaderboard} onClear={handleClearLeaderboard} />
            </section>
          )}

          {/* ---------- Loading screen ---------- */}
          {screen === 'loading' && (
            <section className={screenClass('loading') + ' loading-screen'}>
              <div className="hero">🔭</div>
              <h2>Tracking down field notes…</h2>
              <div className="spinner" role="status" aria-label="Loading questions" />
              <p className="lead">Reaching out to the wildlife archive.</p>
            </section>
          )}

          {/* ---------- Question screen ---------- */}
          {screen === 'question' && currentQ && (
            <section className={questionScreenClass}>
              <div className="q-meta">
                <span>Field Note {currentIndex + 1} of {totalQuestions}</span>
              </div>
              <div className="q-text">{currentQ.q}</div>
              <div className="options">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = answered && i === currentQ.answer;
                  const isWrongPick = answered && selected === i && i !== currentQ.answer;
                  const cls =
                    'option' +
                    (isCorrect ? ' correct' : '') +
                    (isWrongPick ? ' wrong' : '');
                  return (
                    <button
                      key={i}
                      type="button"
                      className={cls}
                      disabled={answered}
                      onClick={() => handleAnswer(i)}
                    >
                      <span className="letter">{LETTERS[i]}</span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
              <div
                className={
                  'feedback' +
                  (feedback ? ' show ' + (feedback.type === 'good' ? 'good' : 'bad') : '')
                }
                role="status"
                aria-live="polite"
              >
                {feedback?.text ?? ''}
              </div>
              <div className="quit-row">
                <button type="button" className="quit-btn" onClick={goHome}>
                  🏠 Return to Camp
                </button>
              </div>
            </section>
          )}

          {/* ---------- Results screen ---------- */}
          {screen === 'results' && (() => {
            const copy = resultCopy(score, totalQuestions);
            const trailRun = DIFFICULTIES[activeDifficulty];
            return (
              <section className={screenClass('results') + ' results'}>
                <div className="trophy">{copy.trophy}</div>
                <h2>{copy.title}</h2>
                <div className="score-line">
                  Trail: {trailRun.trail} {trailRun.badge}
                </div>
                <div className="big-score">
                  {score} / {totalQuestions}
                </div>
                <p className="blurb">{copy.blurb}</p>

                {savedEntryDate == null ? (
                  <form className="save-score" onSubmit={handleSaveScore}>
                    <label htmlFor="player-name">Log your name in the field journal</label>
                    <div className="save-row">
                      <input
                        id="player-name"
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        maxLength={NAME_MAX}
                        placeholder="Ranger name"
                        autoComplete="off"
                        required
                      />
                      <button type="submit" className="btn btn-small">Save</button>
                    </div>
                  </form>
                ) : (
                  <div className="saved-msg">📓 Logged in the journal</div>
                )}

                <Leaderboard
                  entries={leaderboard}
                  onClear={handleClearLeaderboard}
                  highlightDate={savedEntryDate ?? undefined}
                />

                <button className="btn" onClick={startGame} type="button">
                  New Expedition
                </button>
              </section>
            );
          })()}
        </main>
      </div>
    </>
  );
}
