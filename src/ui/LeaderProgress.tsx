import { isLeaderUpgradeActive } from '../data/leaderImpl';
import type { TribeDef } from '../engine/types';
import {
  leaderEarnSummary,
  ROMAN,
  upgradeStatusLabel,
} from './leaderHelp';
import { Tip } from './Tip';

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
          const active = isLeaderUpgradeActive(tribe.id, level);
          return (
            <li
              key={level}
              className={[
                'leader-upgrade',
                unlocked ? 'unlocked' : 'locked',
                next ? 'next' : '',
                flashLevel === level ? 'flash' : '',
                !active ? 'planned' : '',
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
                  {upgradeStatusLabel(tribe.id, level, unlocked, thresholds[i]!)}
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
