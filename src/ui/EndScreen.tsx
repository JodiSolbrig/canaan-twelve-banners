import { TRIBE_BY_ID } from '../data/gameData';
import type { GameState } from '../engine/types';

type Props = {
  state: GameState;
  onRematch: () => void;
  onSetup: () => void;
};

export function EndScreen({ state, onRematch, onSetup }: Props) {
  const ranked = [...state.players].sort(
    (a, b) => b.resources.glory - a.resources.glory,
  );
  const winnerNames =
    state.winners?.map((id) => {
      const p = state.players.find((x) => x.id === id)!;
      return p.tribe;
    }) ?? [];

  return (
    <div className="panel end-screen">
      <h2>{winnerNames.join(' & ')} Prevails</h2>
      <p style={{ color: 'var(--ink-dim)' }}>
        Covenant ended at {state.covenant}. Highest Glory wins.
      </p>
      <div style={{ margin: '1.25rem auto', maxWidth: 420, textAlign: 'left' }}>
        {ranked.map((p, i) => {
          const def = TRIBE_BY_ID[p.tribe];
          return (
            <div
              key={p.id}
              className="player-chip"
              style={{
                ['--tribe-color' as string]: def.color,
                marginBottom: '0.4rem',
              }}
            >
              <div>
                <div className="tribe-name">
                  #{i + 1} {def.id}
                  {p.isHuman ? ' (You)' : ''}
                </div>
              </div>
              <div className="stats" style={{ textAlign: 'right' }}>
                Glory {p.resources.glory} · Loyalty {p.resources.loyalty} · Champs{' '}
                {p.championships}
              </div>
            </div>
          );
        })}
      </div>
      <div className="brand-actions" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={onRematch}>
          Rematch
        </button>
        <button type="button" className="btn" onClick={onSetup}>
          New Setup
        </button>
      </div>
    </div>
  );
}
