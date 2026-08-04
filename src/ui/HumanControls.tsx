import { useEffect, useState } from 'react';
import { formatTribeIncome, TRACK_LABELS, TRIBE_BY_ID } from '../data/gameData';
import { currentActor, getPlayer } from '../engine';
import type { GameState, PlacementPlan, PlayerAction, TrackId } from '../engine/types';
import { HELP, RESOURCE_HELP } from './helpText';
import { LeaderProgress } from './LeaderProgress';
import { PlacementGrid } from './PlacementGrid';
import { planIsAffordable, planTokens } from './placementPlan';
import { Tip } from './Tip';

const TRACKS: TrackId[] = ['military', 'moral', 'provision'];

type Props = {
  state: GameState;
  onAction: (a: PlayerAction) => void;
  flashLeaderLevel?: number | null;
};

export function HumanControls({ state, onAction, flashLeaderLevel = null }: Props) {
  const actor = currentActor(state);
  const human = state.players.find((p) => p.isHuman)!;
  const def = TRIBE_BY_ID[human.tribe];
  const isOurTurn = actor?.isHuman === true;

  const [plan, setPlan] = useState<PlacementPlan>({});

  useEffect(() => {
    if (state.phase === 'placement') setPlan({});
  }, [state.phase, state.round]);

  const [recruitMode, setRecruitMode] = useState<'goods' | 'faith'>('goods');
  const [gatherSpend, setGatherSpend] = useState<'warriors' | 'faith'>('warriors');
  const [prayMode, setPrayMode] = useState<'rest' | 'goods'>('rest');
  const [convertFrom, setConvertFrom] = useState<'faith' | 'warriors' | 'goods'>('goods');
  const [convertTo, setConvertTo] = useState<'faith' | 'warriors' | 'goods'>('warriors');
  const [leviMode, setLeviMode] = useState<'raise' | 'protect'>('raise');
  const [ephraimMode, setEphraimMode] = useState<
    'doubleGoods' | 'goodsPlusFaith' | 'goodsPlusWarriors'
  >('doubleGoods');
  const [targetId, setTargetId] = useState(
    () => state.players.find((p) => !p.isHuman)?.id ?? '',
  );
  const [repoToken, setRepoToken] = useState('');
  const [repoTrack, setRepoTrack] = useState<TrackId>('moral');
  const [asherMode, setAsherMode] = useState<'faith' | 'rest'>('rest');
  const [rallyTrack, setRallyTrack] = useState<TrackId>('military');
  const [placingMore, setPlacingMore] = useState(false);
  const freePlacement = state.tuningSnapshot.freePlacementPhase;

  useEffect(() => {
    if (state.phase !== 'action') setPlacingMore(false);
  }, [state.phase, state.round]);

  const ironChariots = state.activeCrisis?.id === 3;
  const plannedTotal = planTokens(plan);
  const planAffordable = planIsAffordable(plan, human.resources, ironChariots);

  const phaseLabel: Record<string, string> = {
    crisisReveal: 'Crisis revealed',
    crisisChoice: 'Angel of the Lord — choose',
    placement: 'Place Influence',
    action: 'Take an Action',
    reveal: 'Revealing…',
    resolve: 'Resolving…',
    gameEnd: 'Game over',
  };

  if (state.phase === 'crisisChoice' && state.pendingCrisisChoice) {
    const [a, b] = state.pendingCrisisChoice.options;
    return (
      <div className="panel human-panel">
        <div className="phase-banner">Angel of the Lord</div>
        <p style={{ fontSize: '0.9rem', color: 'var(--ink-dim)' }}>
          Put one Crisis on top, one on bottom, and shift the Covenant.
        </p>
        {a && b && (
          <div className="action-grid">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                onAction({
                  type: 'crisisChoice',
                  angel: { topId: a.id, bottomId: b.id, covenantDelta: 1 },
                })
              }
            >
              Top: {a.name} / Bottom: {b.name} / Covenant +1
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                onAction({
                  type: 'crisisChoice',
                  angel: { topId: b.id, bottomId: a.id, covenantDelta: 1 },
                })
              }
            >
              Top: {b.name} / Bottom: {a.name} / Covenant +1
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                onAction({
                  type: 'crisisChoice',
                  angel: { topId: a.id, bottomId: b.id, covenantDelta: -1 },
                })
              }
            >
              Top: {a.name} · Covenant −1
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                onAction({
                  type: 'crisisChoice',
                  angel: { topId: b.id, bottomId: a.id, covenantDelta: -1 },
                })
              }
            >
              Top: {b.name} · Covenant −1
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="panel human-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div className="phase-banner">{phaseLabel[state.phase] ?? state.phase}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: def.color }}>
            {def.id}
          </div>
        </div>
        {!isOurTurn && state.phase !== 'gameEnd' && (
          <div className="waiting">
            {actor ? `${TRIBE_BY_ID[actor.tribe].id} is acting…` : 'Resolving…'}
          </div>
        )}
      </div>

      <div className="resources">
        {(
          [
            ['faith', human.resources.faith],
            ['warriors', human.resources.warriors],
            ['goods', human.resources.goods],
            ['loyalty', human.resources.loyalty],
            ['glory', human.resources.glory],
          ] as const
        ).map(([k, v]) => (
          <Tip key={k} text={RESOURCE_HELP[k]!} wide className="tip-below">
            <div className="res-pill" style={{ cursor: 'help' }}>
              <span className={`res-icon ${k}`} />
              <span>
                {k[0]!.toUpperCase() + k.slice(1)} <strong>{v}</strong>
              </span>
            </div>
          </Tip>
        ))}
      </div>

      <Tip
        text={`${HELP.income} ${def.income.note}.`}
        wide
        className="tip-below tip-block"
      >
        <div
          className="tribe-income-callout"
          style={{ ['--tribe-color' as string]: def.color, cursor: 'help' }}
        >
          <div className="tribe-income-label">Income (rounds 2+)</div>
          <div className="tribe-income-value">+{formatTribeIncome(def.income)}</div>
          <div className="tribe-income-note">{def.income.note}</div>
        </div>
      </Tip>

      <LeaderProgress
        tribe={def}
        leaderLevel={human.leaderLevel}
        glory={human.resources.glory}
        thresholds={state.tuningSnapshot.leaderUnlockGlory}
        flashLevel={flashLeaderLevel}
      />

      {human.peekedCrisis && human.peekedCrisis.length > 0 && (
        <div className="peek-box">
          Peeked Crisis:{' '}
          {human.peekedCrisis.map((c) => c.name).join(' → ')}
        </div>
      )}

      {isOurTurn && state.phase === 'placement' && (
        <div className="placement-controls">
          <div className="help-callout">{HELP.placementHint}</div>
          <PlacementGrid
            plan={plan}
            onChange={setPlan}
            resources={human.resources}
            ironChariots={ironChariots}
          />
          <Tip text={HELP.confirmPlacement} wide className="tip-below">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!planAffordable}
              onClick={() => onAction({ type: 'confirmPlacement', plan })}
            >
              Confirm Placement ({plannedTotal})
            </button>
          </Tip>
        </div>
      )}

      {isOurTurn && state.phase === 'action' && (
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--ink-dim)', marginBottom: '0.35rem' }}>
            Unique: <em>{def.uniqueName}</em> — {def.uniqueCost}
          </div>
          <div className="action-grid">
            <Tip
              wide
              className="tip-below"
              text={`${def.uniqueName} (${def.uniqueCost}): ${def.uniqueEffect}`}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const unique = buildUnique(human.tribe, {
                    targetId,
                    rallyTrack,
                    leviMode,
                    ephraimMode,
                    asherMode,
                    repoToken,
                    repoTrack,
                    state,
                  });
                  if (unique) onAction(unique);
                }}
              >
                {def.uniqueName}
              </button>
            </Tip>
            <Tip text={HELP.recruit} wide className="tip-below">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  onAction({ type: 'standard', action: 'recruit', recruitMode })
                }
              >
                Recruit
              </button>
            </Tip>
            <select
              value={recruitMode}
              onChange={(e) => setRecruitMode(e.target.value as 'goods' | 'faith')}
              aria-label="Recruit mode"
            >
              <option value="goods">1 Goods → 2 Warriors</option>
              <option value="faith">1 Faith → +1 Warrior</option>
            </select>
            <Tip text={HELP.gather} wide className="tip-below">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  onAction({ type: 'standard', action: 'gather', gatherSpend })
                }
              >
                Gather
              </button>
            </Tip>
            <select
              value={gatherSpend}
              onChange={(e) => setGatherSpend(e.target.value as 'warriors' | 'faith')}
              aria-label="Gather spend"
            >
              <option value="warriors">Spend Warrior</option>
              <option value="faith">Spend Faith</option>
            </select>
            <Tip text={HELP.pray} wide className="tip-below">
              <button
                type="button"
                className="btn"
                onClick={() => onAction({ type: 'standard', action: 'pray', prayMode })}
              >
                Pray
              </button>
            </Tip>
            <select
              value={prayMode}
              onChange={(e) => setPrayMode(e.target.value as 'rest' | 'goods')}
              aria-label="Pray mode"
            >
              <option value="rest">Rest → 2 Faith</option>
              <option value="goods">1 Goods → Faith+Loyalty</option>
            </select>
            <Tip text={HELP.convert} wide className="tip-below">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  onAction({
                    type: 'standard',
                    action: 'convert',
                    convert: { from: convertFrom, to: convertTo },
                  })
                }
              >
                Convert
              </button>
            </Tip>
            <select
              value={convertFrom}
              onChange={(e) =>
                setConvertFrom(e.target.value as 'faith' | 'warriors' | 'goods')
              }
              aria-label="Convert from"
            >
              <option value="goods">2 Goods</option>
              <option value="warriors">2 Warriors</option>
              <option value="faith">2 Faith</option>
            </select>
            <select
              value={convertTo}
              onChange={(e) =>
                setConvertTo(e.target.value as 'faith' | 'warriors' | 'goods')
              }
              aria-label="Convert to"
            >
              <option value="warriors">→ Warrior</option>
              <option value="faith">→ Faith</option>
              <option value="goods">→ Goods</option>
            </select>
            <Tip text={HELP.restRecover} wide className="tip-below">
              <button
                type="button"
                className="btn"
                onClick={() => onAction({ type: 'standard', action: 'rest' })}
              >
                Rest & Recover
              </button>
            </Tip>
            <Tip text={HELP.placeMore} wide className="tip-below">
              <button
                type="button"
                className={`btn${placingMore ? ' btn-primary' : ''}`}
                onClick={() => {
                  setPlan({});
                  setPlacingMore((v) => !v);
                }}
              >
                {freePlacement ? 'Place more Influence' : 'Place Influence'}
              </button>
            </Tip>
            <Tip text={HELP.pass} className="tip-below">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onAction({ type: 'standard', action: 'pass' })}
              >
                Pass
              </button>
            </Tip>
          </div>

          {placingMore && (
            <div className="placement-controls" style={{ marginTop: '0.75rem' }}>
              <div className="help-callout">
                {freePlacement
                  ? 'Spend your action to place more face-down Influence.'
                  : 'Place Influence is your action this round.'}
              </div>
              <PlacementGrid
                plan={plan}
                onChange={setPlan}
                resources={human.resources}
                ironChariots={ironChariots}
              />
              <div className="field-row" style={{ marginTop: '0.35rem' }}>
                <Tip text={HELP.placeInfluence} wide className="tip-below">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={plannedTotal < 1 || !planAffordable}
                    onClick={() => {
                      onAction({ type: 'placeInfluence', plan });
                      setPlacingMore(false);
                    }}
                  >
                    Confirm Influence ({plannedTotal})
                  </button>
                </Tip>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setPlacingMore(false);
                    setPlan({});
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {human.tribe === 'Judah' && (
            <div className="field-row" style={{ marginTop: '0.5rem' }}>
              <label>Rally target</label>
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                {state.players
                  .filter((p) => !p.isHuman)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.tribe}
                    </option>
                  ))}
              </select>
              <select
                value={rallyTrack}
                onChange={(e) => setRallyTrack(e.target.value as TrackId)}
                aria-label="Rally track"
              >
                {TRACKS.map((t) => (
                  <option key={t} value={t}>
                    on {TRACK_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {human.tribe === 'Levi' && (
            <div className="field-row" style={{ marginTop: '0.5rem' }}>
              <label>Intercede</label>
              <select
                value={leviMode}
                onChange={(e) => setLeviMode(e.target.value as 'raise' | 'protect')}
              >
                <option value="raise">Raise Covenant +1</option>
                <option value="protect">Protect next drop</option>
              </select>
            </div>
          )}
          {human.tribe === 'Ephraim' && (
            <div className="field-row" style={{ marginTop: '0.5rem' }}>
              <label>Double Portion</label>
              <select
                value={ephraimMode}
                onChange={(e) =>
                  setEphraimMode(
                    e.target.value as
                      | 'doubleGoods'
                      | 'goodsPlusFaith'
                      | 'goodsPlusWarriors',
                  )
                }
              >
                <option value="doubleGoods">+2 Goods</option>
                <option value="goodsPlusFaith">+1 Goods +1 Faith</option>
                <option value="goodsPlusWarriors">+1 Goods +1 Warrior</option>
              </select>
            </div>
          )}
          {human.tribe === 'Asher' && (
            <div className="field-row" style={{ marginTop: '0.5rem' }}>
              <label>Harvest</label>
              <select
                value={asherMode}
                onChange={(e) => setAsherMode(e.target.value as 'faith' | 'rest')}
              >
                <option value="rest">Rest → 2 Goods</option>
                <option value="faith">Spend Faith → 2 Goods</option>
              </select>
            </div>
          )}
          {human.tribe === 'Naphtali' && (
            <div className="field-row" style={{ marginTop: '0.5rem' }}>
              <label>Reposition</label>
              <select value={repoToken} onChange={(e) => setRepoToken(e.target.value)}>
                <option value="">Token…</option>
                {state.tokens
                  .filter((t) => t.playerId === human.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.track} ({t.id.slice(-4)})
                    </option>
                  ))}
              </select>
              <select
                value={repoTrack}
                onChange={(e) => setRepoTrack(e.target.value as TrackId)}
              >
                {TRACKS.map((t) => (
                  <option key={t} value={t}>
                    {TRACK_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function buildUnique(
  tribe: string,
  opts: {
    targetId: string;
    rallyTrack: TrackId;
    leviMode: 'raise' | 'protect';
    ephraimMode: 'doubleGoods' | 'goodsPlusFaith' | 'goodsPlusWarriors';
    asherMode: 'faith' | 'rest';
    repoToken: string;
    repoTrack: TrackId;
    state: GameState;
  },
): PlayerAction | null {
  switch (tribe) {
    case 'Judah':
      return {
        type: 'unique',
        tribe: 'Judah',
        targetPlayerId: opts.targetId,
        track: opts.rallyTrack,
      };
    case 'Benjamin':
      return { type: 'unique', tribe: 'Benjamin' };
    case 'Levi':
      return { type: 'unique', tribe: 'Levi', leviMode: opts.leviMode };
    case 'Ephraim':
      return { type: 'unique', tribe: 'Ephraim', ephraimMode: opts.ephraimMode };
    case 'Manasseh': {
      const p = getPlayer(opts.state, 'human');
      return {
        type: 'unique',
        tribe: 'Manasseh',
        manassehSpend: p.resources.warriors >= 1 ? 'warriors' : 'faith',
      };
    }
    case 'Reuben':
      return { type: 'unique', tribe: 'Reuben' };
    case 'Simeon':
      return { type: 'unique', tribe: 'Simeon' };
    case 'Dan':
      return { type: 'unique', tribe: 'Dan' };
    case 'Naphtali':
      return {
        type: 'unique',
        tribe: 'Naphtali',
        tokenId: opts.repoToken,
        toTrack: opts.repoTrack,
      };
    case 'Gad':
      return { type: 'unique', tribe: 'Gad' };
    case 'Asher':
      return { type: 'unique', tribe: 'Asher', asherMode: opts.asherMode };
    case 'Issachar':
      return { type: 'unique', tribe: 'Issachar', issacharOrder: [0, 1] };
    case 'Zebulun':
      return {
        type: 'unique',
        tribe: 'Zebulun',
        zebulunConverts: [
          { from: 'goods', to: 'warriors' },
          { from: 'faith', to: 'goods' },
        ],
      };
    default:
      return null;
  }
}
