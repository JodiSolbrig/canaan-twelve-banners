import { useState } from 'react';
import {
  DEFAULT_TUNING,
  cloneTuning,
  type TuningConfig,
} from '../config/tuning';

type Props = {
  open: boolean;
  tuning: TuningConfig;
  onClose: () => void;
  onApply: (t: TuningConfig) => void;
};

export function TuningDrawer({ open, tuning, onClose, onApply }: Props) {
  const [draft, setDraft] = useState(() => cloneTuning(tuning));

  if (!open) return null;

  const set = <K extends keyof TuningConfig>(key: K, value: TuningConfig[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  return (
    <div className="drawer-overlay" onClick={onClose} role="presentation">
      <div
        className="drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Tuning"
      >
        <h2>Mechanics Tuning</h2>
        <p style={{ color: 'var(--ink-dim)', fontSize: '0.85rem' }}>
          Adjust prototype defaults, then Apply & New Game.
        </p>

        <label>
          Covenant start
          <input
            type="number"
            min={0}
            max={10}
            value={draft.covenantStart}
            onChange={(e) => set('covenantStart', Number(e.target.value))}
          />
        </label>
        <label>
          Threshold mode
          <select
            value={draft.thresholdBase}
            onChange={(e) =>
              set('thresholdBase', e.target.value as 'playerCount' | 'fixed')
            }
          >
            <option value="playerCount">= player count</option>
            <option value="fixed">Fixed value</option>
          </select>
        </label>
        <label>
          Fixed threshold
          <input
            type="number"
            value={draft.thresholdFixed}
            onChange={(e) => set('thresholdFixed', Number(e.target.value))}
          />
        </label>
        <label>
          Small-group threshold bonus (≤3 players)
          <input
            type="number"
            value={draft.smallGroupThresholdBonus}
            onChange={(e) =>
              set('smallGroupThresholdBonus', Number(e.target.value))
            }
          />
        </label>
        <label>
          High zone offset (threshold + N)
          <input
            type="number"
            value={draft.lowHighOffset}
            onChange={(e) => set('lowHighOffset', Number(e.target.value))}
          />
        </label>
        <label>
          Failed-track Loyalty loss
          <input
            type="number"
            min={0}
            value={draft.failedTrackLoyaltyLoss}
            onChange={(e) =>
              set('failedTrackLoyaltyLoss', Number(e.target.value))
            }
          />
        </label>
        <label>
          Generations (rounds)
          <input
            type="number"
            min={1}
            value={draft.generations}
            onChange={(e) => set('generations', Number(e.target.value))}
          />
        </label>
        <label>
          Judge power lasts (generations)
          <input
            type="number"
            min={1}
            value={draft.judgeGenerations}
            onChange={(e) => set('judgeGenerations', Number(e.target.value))}
          />
        </label>
        <label>
          Leader unlock Glory (comma: 3,6,9)
          <input
            type="text"
            value={draft.leaderUnlockGlory.join(',')}
            onChange={(e) => {
              const parts = e.target.value.split(',').map((x) => Number(x.trim()));
              if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
                set('leaderUnlockGlory', parts as [number, number, number]);
              }
            }}
          />
        </label>
        <label>
          Free placement phase
          <select
            value={draft.freePlacementPhase ? 'yes' : 'no'}
            onChange={(e) => set('freePlacementPhase', e.target.value === 'yes')}
          >
            <option value="yes">Yes — free placement, then an action</option>
            <option value="no">No — one action per round (printed rules)</option>
          </select>
        </label>
        <label>
          Bot aggression (0–1)
          <input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={draft.botAggression}
            onChange={(e) => set('botAggression', Number(e.target.value))}
          />
        </label>
        <label>
          Bot think delay (ms)
          <input
            type="number"
            value={draft.botThinkMs}
            onChange={(e) => set('botThinkMs', Number(e.target.value))}
          />
        </label>
        <label>
          Military Champion Glory
          <input
            type="number"
            value={draft.championRewards.military.glory}
            onChange={(e) =>
              set('championRewards', {
                ...draft.championRewards,
                military: {
                  ...draft.championRewards.military,
                  glory: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <label>
          End-of-game Covenant Glory bonus
          <select
            value={draft.endCovenantBonus ? 'yes' : 'no'}
            onChange={(e) => set('endCovenantBonus', e.target.value === 'yes')}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onApply(cloneTuning(draft))}
          >
            Apply & New Game
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setDraft(cloneTuning(DEFAULT_TUNING))}
          >
            Reset defaults
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
