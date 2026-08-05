import { useEffect, useState } from 'react';
import { formatTribeIncome, TRACK_LABELS, TRIBE_BY_ID } from '../data/gameData';
import { OPPRESSOR_BY_ID } from '../data/oppressors';
import {
  availableLeaderTrade,
  canArmGoodsDoubler,
  canStudyTrack,
  currentActor,
  getPlayer,
  goodsDoublerOf,
} from '../engine';
import { JUDGE_POWER_NEEDS_TRACK, JUDGE_POWER_WINDOW } from '../engine/judges';
import type { GameState, PlacementPlan, PlayerAction, TrackId } from '../engine/types';
import { HELP, RESOURCE_HELP } from './helpText';
import { LeaderProgress } from './LeaderProgress';
import { PlacementGrid } from './PlacementGrid';
import { PLAN_TRACKS, planIsAffordable, planTokens, tokensOn } from './placementPlan';
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
  const [cryFaith, setCryFaith] = useState(1);
  const [pathfinder, setPathfinder] = useState('');
  const [giftTo, setGiftTo] = useState('');
  const [giftTrack, setGiftTrack] = useState<TrackId>('military');
  const [judgeTrack, setJudgeTrack] = useState<TrackId>('military');
  const [judgeTarget, setJudgeTarget] = useState('');
  const [placingMore, setPlacingMore] = useState(false);
  const freePlacement = state.tuningSnapshot.freePlacementPhase;
  // Only offered on our own turn in the action phase, which is the window the
  // engine accepts it in.
  const leaderTrade =
    isOurTurn && state.phase === 'action'
      ? availableLeaderTrade(state, human.id)
      : null;
  const doubler =
    isOurTurn && state.phase === 'action' && canArmGoodsDoubler(state, human.id)
      ? goodsDoublerOf(human.tribe)
      : null;
  const canStudy =
    isOurTurn && state.phase === 'placement' && canStudyTrack(state, human.id);

  useEffect(() => {
    if (state.phase !== 'action') setPlacingMore(false);
  }, [state.phase, state.round]);

  const ironChariots = state.activeCrisis?.id === 3;
  const plannedTotal = planTokens(plan);
  const planAffordable = planIsAffordable(plan, human.resources, ironChariots);

  // Reuben II opens a second track only once one track is genuinely committed to,
  // and only onto ground it has not already taken.
  const emptyTracks = PLAN_TRACKS.filter((t) => tokensOn(plan, t) === 0);
  const pathfinderOpen =
    human.tribe === 'Reuben' &&
    human.leaderLevel >= 2 &&
    PLAN_TRACKS.some((t) => tokensOn(plan, t) >= 2) &&
    emptyTracks.length > 0;

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

      {human.peekedTrack && (
        <div className="peek-box">
          Understanding of Times: {TRACK_LABELS[human.peekedTrack.track]} stood at{' '}
          <strong>
            {human.peekedTrack.total} of {human.peekedTrack.threshold}
          </strong>{' '}
          when you looked
          {human.peekedTrack.total >= human.peekedTrack.threshold
            ? ' — holding.'
            : ` — ${human.peekedTrack.threshold - human.peekedTrack.total} short.`}
        </div>
      )}

      {isOurTurn && state.phase === 'placement' && (
        <div className="placement-controls">
          <div className="help-callout">{HELP.placementHint}</div>

          {canStudy && (
            <div className="field-row" style={{ marginBottom: '0.5rem' }}>
              <Tip
                wide
                className="tip-below"
                text="Understanding of Times — once a generation, look at how one track actually stands before you commit. What you see is a snapshot: tribes placing after you will change it."
              >
                <label style={{ cursor: 'help' }}>Study a track</label>
              </Tip>
              {TRACKS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="btn"
                  onClick={() => onAction({ type: 'studyTrack', track: t })}
                >
                  {TRACK_LABELS[t]}
                </button>
              ))}
            </div>
          )}
          <PlacementGrid
            plan={plan}
            onChange={setPlan}
            resources={human.resources}
            ironChariots={ironChariots}
          />
          {pathfinderOpen && (
            <div className="field-row">
              <Tip
                wide
                className="tip-below"
                text="Gilead Tie I — Pathfinder: you have 2+ Influence on one track, so you may open a second. Name a track you left empty for 1 temporary Supply Influence."
              >
                <label style={{ cursor: 'help' }}>Pathfinder →</label>
              </Tip>
              <select
                value={pathfinder}
                onChange={(e) => setPathfinder(e.target.value)}
              >
                <option value="">Decline</option>
                {emptyTracks.map((t) => (
                  <option key={t} value={t}>
                    {TRACK_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {human.pendingTempInfluenceGift > 0 && (
            <div className="field-row">
              <Tip
                wide
                className="tip-below"
                text="Barak II — Swift Response: your Championship owes another tribe Influence. Name them and where it lands. It arrives as Supply, so it cannot win them a Championship."
              >
                <label style={{ cursor: 'help' }}>Swift Response →</label>
              </Tip>
              <select value={giftTo} onChange={(e) => setGiftTo(e.target.value)}>
                <option value="">Hold it</option>
                {state.players
                  .filter((p) => p.id !== human.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.tribe}
                    </option>
                  ))}
              </select>
              <select
                value={giftTrack}
                onChange={(e) => setGiftTrack(e.target.value as TrackId)}
              >
                {PLAN_TRACKS.map((t) => (
                  <option key={t} value={t}>
                    {TRACK_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Tip text={HELP.confirmPlacement} wide className="tip-below">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!planAffordable}
              onClick={() =>
                onAction({
                  type: 'confirmPlacement',
                  plan,
                  extras: {
                    ...(pathfinderOpen && pathfinder
                      ? { pathfinder: pathfinder as TrackId }
                      : {}),
                    ...(giftTo ? { giftTo: { playerId: giftTo, track: giftTrack } } : {}),
                  },
                })
              }
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
            {state.oppression && (
              <Tip text={HELP.cryOut} wide className="tip-below">
                <button
                  type="button"
                  className="btn btn-cry"
                  disabled={human.resources.faith < 1}
                  onClick={() =>
                    onAction({ type: 'standard', action: 'cryOut', cryFaith })
                  }
                >
                  Cry Out ({cryFaith} Faith)
                </button>
              </Tip>
            )}
            {state.oppression && (
              <select
                value={Math.min(cryFaith, Math.max(1, human.resources.faith))}
                onChange={(e) => setCryFaith(Number(e.target.value))}
                aria-label="Faith to cry out with"
                disabled={human.resources.faith < 1}
              >
                {Array.from({ length: Math.max(1, human.resources.faith) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} Faith
                  </option>
                ))}
              </select>
            )}
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

          {human.judgePower &&
            JUDGE_POWER_WINDOW[human.judgePower] === 'action' && (
              <div className="judge-box" style={{ marginTop: '0.5rem' }}>
                <div className="judge-title">
                  {OPPRESSOR_BY_ID[human.judgePower].deliverer} — your Judge power
                </div>
                <p className="judge-text">
                  {OPPRESSOR_BY_ID[human.judgePower].judgePower}
                </p>
                <div className="field-row">
                  {JUDGE_POWER_NEEDS_TRACK[human.judgePower] && (
                    <select
                      value={judgeTrack}
                      onChange={(e) => setJudgeTrack(e.target.value as TrackId)}
                      aria-label="Track for the Judge power"
                    >
                      {TRACKS.map((t) => (
                        <option key={t} value={t}>
                          {TRACK_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  )}
                  {human.judgePower === 'moab' && (
                    <select
                      value={judgeTarget}
                      onChange={(e) => setJudgeTarget(e.target.value)}
                      aria-label="Target of the dagger"
                    >
                      <option value="">Target…</option>
                      {state.players
                        .filter(
                          (p) =>
                            !p.isHuman &&
                            state.tokens.some((t) => t.playerId === p.id),
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.tribe}
                          </option>
                        ))}
                    </select>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={human.judgePower === 'moab' && !judgeTarget}
                    onClick={() =>
                      onAction({
                        type: 'judgePower',
                        ...(JUDGE_POWER_NEEDS_TRACK[human.judgePower!]
                          ? { track: judgeTrack }
                          : {}),
                        ...(human.judgePower === 'moab'
                          ? { targetPlayerId: judgeTarget }
                          : {}),
                      })
                    }
                  >
                    Call on {OPPRESSOR_BY_ID[human.judgePower].deliverer}
                  </button>
                </div>
              </div>
            )}

          {leaderTrade && (
            <div className="judge-box" style={{ marginTop: '0.5rem' }}>
              <div className="judge-title">
                {leaderTrade.name} — free of your action
              </div>
              <p className="judge-text">
                Once each round, and it does not cost you your turn.
              </p>
              <div className="field-row">
                {leaderTrade.trades.map((t) => {
                  const affordable = human.resources[t.from] >= leaderTrade.rate;
                  return (
                    <button
                      key={`${t.from}-${t.to}`}
                      type="button"
                      className="btn btn-primary"
                      disabled={!affordable}
                      onClick={() =>
                        onAction({ type: 'leaderTrade', from: t.from, to: t.to })
                      }
                    >
                      {leaderTrade.rate} {t.from} → 1 {t.to}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {doubler && (
            <div className="judge-box" style={{ marginTop: '0.5rem' }}>
              <div className="judge-title">{doubler.name} — once per game</div>
              <p className="judge-text">
                Arm it and your next gain of Goods is doubled. It waits rather
                than expiring, so it cannot be wasted — the only question is
                whether a bigger harvest is coming.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onAction({ type: 'armGoodsDoubler' })}
              >
                Make ready
              </button>
            </div>
          )}

          {human.goodsDoublerArmed && (
            <div className="peek-box">
              {goodsDoublerOf(human.tribe)?.name} is armed — your next gain of
              Goods is doubled.
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
