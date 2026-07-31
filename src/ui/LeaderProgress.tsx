import type { TribeDef } from '../engine/types';
import { Tip } from './Tip';

const ROMAN = ['I', 'II', 'III'] as const;

type Props = {
  tribe: TribeDef;
  leaderLevel: number;
  glory: number;
  thresholds: [number, number, number];
  /** Compact list for setup / aid; full panel during play */
  compact?: boolean;
  /** Highlight a freshly unlocked level (1–3) */
  flashLevel?: number | null;
};

export function leaderEarnSummary(thresholds: [number, number, number]): string {
  return `Leader upgrades unlock at ${thresholds[0]}, ${thresholds[1]}, and ${thresholds[2]} Glory (levels I–III). Each tribe has three unique upgrades.`;
}

export function formatLeaderTip(
  def: TribeDef,
  leaderLevel: number,
  thresholds: [number, number, number],
): string {
  const lines = [
    `${def.id} — Leader ${leaderLevel}/3`,
    leaderEarnSummary(thresholds),
    '',
    ...def.upgrades.map((text, i) => {
      const unlocked = leaderLevel >= i + 1;
      const mark = unlocked ? '✓' : `at ${thresholds[i]} Glory`;
      return `${ROMAN[i]} [${mark}] ${text}`;
    }),
  ];
  return lines.join('\n');
}

export function LeaderProgress({
  tribe,
  leaderLevel,
  glory,
  thresholds,
  compact = false,
  flashLevel = null,
}: Props) {
  return (
    <div
      className={`leader-progress${compact ? ' compact' : ''}`}
      style={{ ['--tribe-color' as string]: tribe.color }}
    >
      <div className="leader-progress-head">
        <Tip text={leaderEarnSummary(thresholds)} wide className="tip-below">
          <span className="leader-progress-title" style={{ cursor: 'help' }}>
            Leader upgrades
          </span>
        </Tip>
        <span className="leader-progress-meta">
          {leaderLevel}/3 · next at{' '}
          {leaderLevel >= 3
            ? 'max'
            : `${thresholds[leaderLevel]} Glory (${glory} now)`}
        </span>
      </div>
      <ol className="leader-upgrade-list">
        {tribe.upgrades.map((text, i) => {
          const level = i + 1;
          const unlocked = leaderLevel >= level;
          const next = !unlocked && leaderLevel === i;
          return (
            <li
              key={level}
              className={[
                'leader-upgrade',
                unlocked ? 'unlocked' : 'locked',
                next ? 'next' : '',
                flashLevel === level ? 'flash' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="leader-upgrade-badge" aria-hidden>
                {ROMAN[i]}
              </span>
              <span className="leader-upgrade-body">
                <span className="leader-upgrade-text">{text}</span>
                <span className="leader-upgrade-status">
                  {unlocked
                    ? 'Unlocked'
                    : `Earn at ${thresholds[i]} Glory`}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export type LeaderUnlockNotice = {
  tribeId: string;
  color: string;
  levels: Array<{ level: number; text: string }>;
};

export function LeaderUnlockToast({
  notice,
  onDismiss,
}: {
  notice: LeaderUnlockNotice;
  onDismiss: () => void;
}) {
  return (
    <div
      className="leader-unlock-toast"
      style={{ ['--tribe-color' as string]: notice.color }}
      role="status"
    >
      <div className="leader-unlock-toast-label">Leader upgrade</div>
      <div className="leader-unlock-toast-tribe">{notice.tribeId}</div>
      <ul>
        {notice.levels.map(({ level, text }) => (
          <li key={level}>
            <strong>Level {ROMAN[level - 1]}</strong> — {text}
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-ghost" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
