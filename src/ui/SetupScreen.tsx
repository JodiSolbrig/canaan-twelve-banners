import { useMemo, useState } from 'react';
import {
  ALL_TRIBE_IDS,
  formatTribeIncome,
  TRIBES,
  TRIBE_BY_ID,
} from '../data/gameData';
import type { TribeId } from '../engine/types';
import type { TuningConfig } from '../config/tuning';
import { LeaderProgress, leaderEarnSummary } from './LeaderProgress';
import { HELP } from './helpText';
import { Tip } from './Tip';

type Props = {
  tuning: TuningConfig;
  onStart: (opts: { humanTribe: TribeId; totalPlayers: number }) => void;
};

export function SetupScreen({ tuning, onStart }: Props) {
  const [totalPlayers, setTotalPlayers] = useState(4);
  const [humanTribe, setHumanTribe] = useState<TribeId>('Judah');

  const selected = useMemo(() => TRIBE_BY_ID[humanTribe], [humanTribe]);
  const thresholds = tuning.leaderUnlockGlory;

  return (
    <div className="setup-screen panel">
      <h2>Twelve Banners</h2>
      <p style={{ color: 'var(--ink-dim)', margin: 0 }}>
        Solo vs bots — choose your tribe and table size (2–6).
      </p>

      <div className="field-row">
        <label htmlFor="players">Total players (you + bots)</label>
        <input
          id="players"
          type="number"
          min={2}
          max={6}
          value={totalPlayers}
          onChange={(e) =>
            setTotalPlayers(Math.max(2, Math.min(6, Number(e.target.value) || 2)))
          }
        />
        <span style={{ color: 'var(--ink-dim)', fontSize: '0.85rem' }}>
          {totalPlayers - 1} bot{totalPlayers - 1 === 1 ? '' : 's'}
        </span>
      </div>

      <div>
        <div style={{ color: 'var(--ink-dim)', marginBottom: '0.5rem' }}>Your tribe</div>
        <div className="tribe-grid">
          {TRIBES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tribe-card${humanTribe === t.id ? ' selected' : ''}`}
              style={{ ['--tribe-color' as string]: t.color }}
              onClick={() => setHumanTribe(t.id)}
            >
              <div className="name">{t.id}</div>
              <div className="meta">
                F{t.faith} W{t.warriors} G{t.goods} L{t.loyalty}
              </div>
              <div className="meta income-meta">+{formatTribeIncome(t.income)}/rd</div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel" style={{ background: 'rgba(0,0,0,0.25)' }}>
        <strong style={{ color: selected.color }}>{selected.id}</strong>
        <div style={{ fontSize: '0.85rem', color: 'var(--ink-dim)', marginTop: '0.35rem' }}>
          {selected.playstyle}
        </div>
        <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
          <em>{selected.uniqueName}</em> — {selected.uniqueCost}: {selected.uniqueEffect}
        </div>
        <Tip text={`${HELP.income} ${selected.income.note}.`} wide className="tip-below tip-block">
          <div className="tribe-income-callout" style={{ cursor: 'help' }}>
            <div className="tribe-income-label">Each round</div>
            <div className="tribe-income-value">+{formatTribeIncome(selected.income)}</div>
            <div className="tribe-income-note">{selected.income.note}</div>
          </div>
        </Tip>
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--bronze)',
            margin: '0.75rem 0 0.35rem',
          }}
        >
          {leaderEarnSummary(thresholds)}
        </p>
        <LeaderProgress
          tribe={selected}
          leaderLevel={0}
          glory={0}
          thresholds={thresholds}
          compact
        />
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={() => onStart({ humanTribe, totalPlayers })}
      >
        Begin the Contest ({ALL_TRIBE_IDS.length} tribes available)
      </button>
    </div>
  );
}
