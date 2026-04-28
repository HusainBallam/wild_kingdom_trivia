'use client';

import { DIFFICULTIES } from '../data/questions';
import type { LeaderboardEntry } from '../lib/storage';

export default function Leaderboard({
  entries,
  onClear,
  highlightDate,
}: {
  entries: LeaderboardEntry[];
  onClear: () => void;
  highlightDate?: number;
}) {
  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <span className="leaderboard-stamp">FIELD JOURNAL</span>
        <h3 className="leaderboard-title">🏅 Hall of Fame</h3>
        <span className="leaderboard-stamp">TOP {entries.length === 0 ? '5' : Math.min(entries.length, 5)}</span>
      </div>

      {entries.length === 0 ? (
        <p className="leaderboard-empty">
          No expeditions logged yet. Be the first ranger to make the journal!
        </p>
      ) : (
        <ol className="leaderboard-list">
          {entries.map((e, i) => {
            const diff = DIFFICULTIES[e.difficulty];
            const highlighted = highlightDate != null && e.date === highlightDate;
            return (
              <li
                key={`${e.date}-${i}`}
                className={'leaderboard-row' + (highlighted ? ' is-new' : '')}
              >
                <span className="rank">{i + 1}</span>
                <span className="lb-name" title={e.name}>{e.name}</span>
                <span className="lb-diff" title={diff.trail}>
                  <span aria-hidden>{diff.badge}</span> {diff.label}
                </span>
                <span className="lb-score">
                  <strong>{e.score}</strong>
                  <span className="lb-total">/{e.total}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {entries.length > 0 && (
        <button type="button" className="link-btn" onClick={onClear}>
          Clear journal
        </button>
      )}
    </div>
  );
}
