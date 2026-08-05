import { useState } from 'react';
import { TRACK_LABELS, TRIBE_BY_ID } from '../data/gameData';
import { OPPRESSOR_BY_ID } from '../data/oppressors';
import { baseThreshold, getTrackTotals } from '../engine/helpers';
import { JUDGE_POWER_NEEDS_TRACK, JUDGE_POWER_WINDOW } from '../engine/judges';
import { canRescue, canSamsonMove } from '../engine/resolve';
import type { GameState, PlayerAction, TrackId } from '../engine/types';
import { Tip } from './Tip';

const TRACKS: TrackId[] = ['military', 'moral', 'provision'];

type Props = {
  state: GameState;
  onAction: (a: PlayerAction) => void;
};

/**
 * The window between the reveal and the scoring.
 *
 * Everything is face up and nothing has been counted, so this is where the
 * abilities that only make sense with full information are spent. It always
 * shows the board's arithmetic — total, Banner, and the bar each track has to
 * clear — because every decision here depends on it.
 */
export function PreResolvePanel({ state, onAction }: Props) {
  const human = state.players.find((p) => p.isHuman);
  const [track, setTrack] = useState<TrackId>('military');
  const [moveToken, setMoveToken] = useState('');
  const [moveTrack, setMoveTrack] = useState<TrackId>('moral');

  if (!human) return null;

  const tallies = getTrackTotals(state);
  const power = human.judgePower;
  const canUsePower = power && JUDGE_POWER_WINDOW[power] === 'preResolve';
  const samson = canSamsonMove(state, human.id);
  const rescue = canRescue(state, human.id);
  const myTokens = state.tokens.filter(
    (t) => t.playerId === human.id && !t.temporary,
  );

  const nothingToDo = !canUsePower && !samson && !rescue;

  return (
    <div className="panel human-panel">
      <div className="phase-banner">Influence revealed — before scoring</div>

      <table className="reveal-table">
        <thead>
          <tr>
            <th scope="col">Track</th>
            <th scope="col">Needs</th>
            <th scope="col">On track</th>
            <th scope="col">Your Banners</th>
          </tr>
        </thead>
        <tbody>
          {TRACKS.map((t) => {
            const need = baseThreshold(state, t);
            const total = Object.values(tallies.total[t]).reduce((a, b) => a + b, 0);
            return (
              <tr key={t}>
                <th scope="row">{TRACK_LABELS[t]}</th>
                <td>{need}</td>
                <td className={total >= need ? 'holding' : 'short'}>
                  {total} {total >= need ? '· holding' : `· ${need - total} short`}
                </td>
                <td>{tallies.banner[t][human.id] ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {canUsePower && power && (
        <div className="judge-box">
          <div className="judge-title">
            {OPPRESSOR_BY_ID[power].deliverer} — your Judge power
          </div>
          <p className="judge-text">{OPPRESSOR_BY_ID[power].judgePower}</p>
          <div className="field-row">
            {JUDGE_POWER_NEEDS_TRACK[power] && (
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value as TrackId)}
                aria-label="Track for the Judge power"
              >
                {TRACKS.map((t) => (
                  <option key={t} value={t}>
                    {TRACK_LABELS[t]}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                onAction({
                  type: 'judgePower',
                  ...(JUDGE_POWER_NEEDS_TRACK[power] ? { track } : {}),
                })
              }
            >
              Call on {OPPRESSOR_BY_ID[power].deliverer}
            </button>
          </div>
        </div>
      )}

      {samson && (
        <div className="field-row" style={{ marginTop: '0.5rem' }}>
          <Tip
            wide
            className="tip-below"
            text="Samson II — Riddle & Cunning: shift one of your tokens now that every board is face up. Once a generation."
          >
            <label style={{ cursor: 'help' }}>Riddle &amp; Cunning</label>
          </Tip>
          <select value={moveToken} onChange={(e) => setMoveToken(e.target.value)}>
            <option value="">Token…</option>
            {myTokens.map((t) => (
              <option key={t.id} value={t.id}>
                {TRACK_LABELS[t.track]} ({t.id.slice(-4)})
              </option>
            ))}
          </select>
          <select
            value={moveTrack}
            onChange={(e) => setMoveTrack(e.target.value as TrackId)}
          >
            {TRACKS.map((t) => (
              <option key={t} value={t}>
                → {TRACK_LABELS[t]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={!moveToken}
            onClick={() =>
              onAction({ type: 'samsonMove', tokenId: moveToken, toTrack: moveTrack })
            }
          >
            Shift
          </button>
        </div>
      )}

      {rescue && (
        <div className="field-row" style={{ marginTop: '0.5rem' }}>
          <Tip
            wide
            className="tip-below"
            text="Once per game: one track you held counts twice, cancelling a single failed track for the Covenant. Turns a −1 generation into a +1."
          >
            <button type="button" className="btn btn-cry" onClick={() => onAction({ type: 'covenantRescue' })}>
              Stand in the breach
              {TRIBE_BY_ID[human.tribe].id === 'Dan' ? ' (2 Warriors)' : ''}
            </button>
          </Tip>
        </div>
      )}

      <div className="field-row" style={{ marginTop: '0.75rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onAction({ type: 'advance' })}
        >
          {nothingToDo ? 'Resolve the generation' : 'Done — resolve'}
        </button>
      </div>
    </div>
  );
}
