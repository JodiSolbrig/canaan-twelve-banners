import { formatTribeIncome, TRACK_LABELS, TRIBE_BY_ID } from '../data/gameData';
import { OPPRESSOR_BY_ID } from '../data/oppressors';
import {
  baseThreshold,
  covenantZone,
  cryThreshold,
  oppressionSeverity,
  trackZone,
} from '../engine/helpers';
import type { GameState, TrackId } from '../engine/types';
import { HELP, TRACK_AFFINITY } from './helpText';
import { formatLeaderTip } from './leaderHelp';
import { Tip } from './Tip';

const TRACKS: TrackId[] = ['military', 'moral', 'provision'];

export function CovenantMeter({ state }: { state: GameState }) {
  const zone = covenantZone(state.covenant, state.tuningSnapshot);
  return (
    <div className="panel covenant-meter">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
        <Tip text={HELP.covenant} wide>
          <h3 style={{ cursor: 'help' }}>Covenant Meter</h3>
        </Tip>
        <span style={{ color: 'var(--sand)' }}>
          {state.covenant}/{state.tuningSnapshot.covenantMax} · {zone}
        </span>
      </div>
      <div className="covenant-arc" aria-label={`Covenant ${state.covenant}`}>
        {Array.from({ length: state.tuningSnapshot.covenantMax + 1 }, (_, i) => (
          <div
            key={i}
            className={`covenant-seg ${zone}${i <= state.covenant ? ' filled' : ''}`}
            style={{ height: `${12 + i * 3}px` }}
            title={String(i)}
          />
        ))}
      </div>
      {state.brokenClock && (
        <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
          Broken Covenant clock — this era ends soon.
        </div>
      )}
    </div>
  );
}

export function CrisisPanel({ state }: { state: GameState }) {
  // A standing oppression holds the Crisis slot until Israel is delivered.
  if (state.oppression) {
    const def = OPPRESSOR_BY_ID[state.oppression.oppressorId];
    const severity = oppressionSeverity(state);
    const need = cryThreshold(state);
    const pool = state.oppression.cryPool;
    return (
      <div className="panel crisis-card oppressor-card">
        <span className="severity oppressor">Oppression · severity {severity}</span>
        <h3>{def.title}</h3>
        <p className="flavor">“{def.flavor}” <span className="reference">{def.reference}</span></p>
        <p className="effect">
          {TRACK_LABELS[def.attacks]} threshold +{severity}. It tightens every round
          until the tribes cry out.
        </p>
        <div className="cry-meter" aria-label={`Cry ${pool} of ${need} Faith`}>
          <div
            className="cry-fill"
            style={{ width: `${Math.min(100, need === 0 ? 0 : (pool / need) * 100)}%` }}
          />
        </div>
        <p className="effect">
          The Cry: <strong>{pool}/{need}</strong> Faith. Deliverance raises up{' '}
          {def.deliverer} from the least among the tribes.
        </p>
      </div>
    );
  }

  if (state.restRound) {
    return (
      <div className="panel crisis-card">
        <h3>The land had rest</h3>
        <p className="flavor">No Crisis this round.</p>
      </div>
    );
  }

  const c = state.activeCrisis;
  if (!c) {
    return (
      <div className="panel crisis-card">
        <h3>No active Crisis</h3>
      </div>
    );
  }
  return (
    <div className="panel crisis-card">
      <Tip text={HELP.crisis} wide className="tip-below">
        <span className="severity" style={{ cursor: 'help' }}>
          {c.severity}
        </span>
      </Tip>
      <h3>{c.name}</h3>
      <p className="flavor">“{c.flavor}”</p>
      <p className="effect">{c.effect}</p>
    </div>
  );
}

export function TracksBoard({ state }: { state: GameState }) {
  return (
    <div className="tracks-row">
      {TRACKS.map((track, ti) => {
        const thr = baseThreshold(state, track);
        const tokens = state.tokens.filter((t) => t.track === track);
        const total = tokens.reduce((a, t) => a + (t.faceDown ? 0 : t.value), 0);
        const faceDownTotal = tokens.length;
        const zone =
          state.phase === 'resolve' || state.trackResults
            ? trackZone(
                tokens.reduce((a, t) => a + t.value, 0),
                thr,
                state.tuningSnapshot.lowHighOffset,
              )
            : null;
        const result = state.trackResults?.find((r) => r.track === track);
        const affinity = TRACK_AFFINITY[track];
        return (
          <div key={track} className="panel track-col">
            <Tip text={affinity.tip} wide className="tip-below">
              <h3 style={{ cursor: 'help' }}>
                {TRACK_LABELS[track]}{' '}
                <span className="track-affinity">· {affinity.preferred}</span>
              </h3>
            </Tip>
            <div className="track-meta">
              <Tip text={HELP.threshold}>
                <span style={{ cursor: 'help', borderBottom: '1px dotted var(--sand-dim)' }}>
                  Threshold {thr}
                </span>
              </Tip>
              {zone ? ` · ${zone}` : ''}
              {result
                ? ` · ${result.success ? 'Success' : 'Failure'} · ${result.total} Infl (${result.bannerTotal} Banner)${
                    result.championId
                      ? ` · ${TRIBE_BY_ID[state.players.find((p) => p.id === result.championId)!.tribe].id}`
                      : ' · no Champion'
                  }`
                : state.phase === 'placement' || state.phase === 'action'
                  ? ` · ${faceDownTotal} tokens`
                  : ` · ${total} Influence`}
            </div>
            <div className="threshold-line" title="Success threshold" />
            <div className="token-stack">
              {tokens.map((t, i) => {
                const tribe = state.players.find((p) => p.id === t.playerId)?.tribe;
                const color = tribe ? TRIBE_BY_ID[tribe].color : '#888';
                return (
                  <div
                    key={t.id}
                    className={`token${t.faceDown ? ' face-down' : ' revealed'}${t.temporary ? ' temp' : ''}`}
                    style={{
                      background: t.faceDown ? undefined : color,
                      animationDelay: `${ti * 0.05 + i * 0.04}s`,
                    }}
                    title={
                      t.faceDown
                        ? 'Face-down Influence'
                        : `${tribe} (${t.value})${t.temporary ? ' temp' : ''}`
                    }
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PlayersStrip({
  state,
  flashPlayerIds = [],
}: {
  state: GameState;
  flashPlayerIds?: string[];
}) {
  const thresholds = state.tuningSnapshot.leaderUnlockGlory;
  return (
    <div className="panel">
      <h3 style={{ marginBottom: '0.5rem', color: 'var(--sand)' }}>
        Round {state.round}/{state.maxRounds}
      </h3>
      <div className="players-strip">
        {state.turnOrder.map((id) => {
          const p = state.players.find((x) => x.id === id)!;
          const def = TRIBE_BY_ID[p.tribe];
          const flashing = flashPlayerIds.includes(id);
          const tip = [
            `${def.id}: ${def.playstyle}`,
            `Unique — ${def.uniqueName} (${def.uniqueCost}): ${def.uniqueEffect}`,
            `Income (r2+): +${formatTribeIncome(def.income)} (${def.income.note})`,
            '',
            formatLeaderTip(def, p.leaderLevel, thresholds),
          ].join('\n');
          return (
            <Tip key={id} wide className="tip-below tip-block" text={tip}>
              <div
                className={`player-chip${p.isHuman ? ' human' : ''}${flashing ? ' leader-flash' : ''}`}
                style={{ ['--tribe-color' as string]: def.color, width: '100%', cursor: 'help' }}
              >
                <div>
                  <div className="tribe-name">
                    {def.id}
                    {p.isHuman ? ' (You)' : ''}
                  </div>
                  <div className={`stats${flashing ? ' leader-level-pulse' : ''}`}>
                    <span className="leader-pips" aria-label={`Leader ${p.leaderLevel} of 3`}>
                      {[1, 2, 3].map((n) => (
                        <span
                          key={n}
                          className={`leader-pip${p.leaderLevel >= n ? ' on' : ''}`}
                        />
                      ))}
                    </span>
                    Leader {p.leaderLevel}/3 · Champs {p.championships}
                  </div>
                </div>
                <div className="stats" style={{ textAlign: 'right' }}>
                  <div>Glory {p.resources.glory}</div>
                  <div>Loyalty {p.resources.loyalty}</div>
                </div>
              </div>
            </Tip>
          );
        })}
      </div>
    </div>
  );
}

export function EventLog({ state }: { state: GameState }) {
  return (
    <div className="panel">
      <h3 style={{ color: 'var(--sand)', marginBottom: '0.35rem' }}>Chronicle</h3>
      <div className="log-panel">
        {state.log.map((e) => (
          <div key={e.id} className={`log-entry ${e.tone ?? ''}`}>
            <strong>R{e.round}</strong> {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}
