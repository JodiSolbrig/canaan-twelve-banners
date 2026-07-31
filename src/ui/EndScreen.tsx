import { TRIBE_BY_ID } from '../data/gameData';
import { rankPlayers } from '../engine';
import type { GameState } from '../engine/types';

type Props = {
  state: GameState;
  onRematch: () => void;
  onSetup: () => void;
};

function endReason(state: GameState): { title: string; detail: string } {
  if (state.brokenClock) {
    return {
      title: 'Broken Covenant',
      detail:
        'The Covenant Meter fell to 0–1. After the final-round clock, the contest ended. Final Glory still decides the winner.',
    };
  }
  return {
    title: `Round ${state.round} of ${state.maxRounds} complete`,
    detail:
      'The scheduled number of rounds finished. Highest Glory wins (Loyalty, then resources, then Championships break ties).',
  };
}

export function EndScreen({ state, onRematch, onSetup }: Props) {
  const ranked = rankPlayers(state.players);
  const winnerNames =
    state.winners?.map((id) => {
      const p = state.players.find((x) => x.id === id)!;
      return p.tribe;
    }) ?? [];
  const reason = endReason(state);

  // Prefer recent history first (log is already newest-first)
  const chronicle = state.log;

  return (
    <div className="end-layout">
      <div className="panel end-screen">
        <h2>{winnerNames.join(' & ')} Prevails</h2>
        <div className={`end-reason${state.brokenClock ? ' broken' : ''}`}>
          <strong>{reason.title}</strong>
          <p>{reason.detail}</p>
          <p className="end-reason-meta">
            Covenant Meter finished at <strong>{state.covenant}</strong>
            {state.brokenClock ? ' (Broken)' : ''} · {state.round} rounds played
          </p>
        </div>

        <div style={{ margin: '1rem auto 0', maxWidth: 480, textAlign: 'left' }}>
          {ranked.map((p, i) => {
            const def = TRIBE_BY_ID[p.tribe];
            const resources =
              p.resources.faith + p.resources.warriors + p.resources.goods;
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
                  <div className="stats">
                    F{p.resources.faith} W{p.resources.warriors} G{p.resources.goods}{' '}
                    (Σ{resources}) · Leader {p.leaderLevel}/3
                  </div>
                </div>
                <div className="stats" style={{ textAlign: 'right' }}>
                  <div>Glory {p.resources.glory}</div>
                  <div>
                    Loyalty {p.resources.loyalty} · Champs {p.championships}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="brand-actions" style={{ justifyContent: 'center', marginTop: '1.25rem' }}>
          <button type="button" className="btn btn-primary" onClick={onRematch}>
            Rematch
          </button>
          <button type="button" className="btn" onClick={onSetup}>
            New Setup
          </button>
        </div>
      </div>

      <div className="panel end-chronicle">
        <h3 style={{ color: 'var(--sand)', marginBottom: '0.35rem' }}>
          Chronicle — how it ended
        </h3>
        <p style={{ color: 'var(--ink-dim)', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
          Newest events first. Scroll for the full contest history.
        </p>
        <div className="log-panel end-log-panel">
          {chronicle.map((e) => (
            <div key={e.id} className={`log-entry ${e.tone ?? ''}`}>
              <strong>R{e.round}</strong> {e.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
