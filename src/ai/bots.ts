import { TRIBE_BY_ID } from '../data/gameData';
import {
  baseThreshold,
  cryThreshold,
  currentActor,
  getPlayer,
  getTrackTotals,
  isBannerToken,
  oppressionSeverity,
  plannedTokenCount,
  planTotal,
  TRACK_AFFINITY_RESOURCE,
} from '../engine/helpers';
import { JUDGE_POWER_WINDOW } from '../engine/judges';
import { canDeclareAlliance, canRescue, canShiftToken } from '../engine/resolve';
import type {
  GameState,
  OppressorId,
  PlacementExtras,
  PlacementPlan,
  PlayerAction,
  PlayerState,
  SpendableResource,
  TrackId,
} from '../engine/types';

const TRACKS: TrackId[] = ['military', 'moral', 'provision'];
const SPENDABLE: SpendableResource[] = ['warriors', 'faith', 'goods'];

export function chooseBotAction(state: GameState): PlayerAction | null {
  // The Angel of the Lord is resolved for the table, not by a seated actor, so
  // it has to be handled before the `currentActor` guard (which only answers
  // during placement and action).
  if (state.phase === 'crisisChoice') {
    const opts = state.pendingCrisisChoice?.options ?? [];
    if (opts.length >= 2) {
      return {
        type: 'crisisChoice',
        angel: {
          topId: opts[0]!.id,
          bottomId: opts[1]!.id,
          covenantDelta: state.covenant < 6 ? 1 : -1,
        },
      };
    }
    return null;
  }

  // Once the board is face up, spend what is worth spending.
  if (state.phase === 'preResolve') return choosePreResolve(state);

  const actor = currentActor(state);
  if (!actor || actor.isHuman) return null;

  // A Judge power that lands on your own turn.
  if (state.phase === 'action' && actor.judgePower) {
    const power = actor.judgePower;
    if (JUDGE_POWER_WINDOW[power] === 'action') {
      const declared = declareJudgePower(state, actor, power);
      if (declared) return declared;
    }
  }

  if (state.phase === 'placement') {
    const plan = planPlacement(state, actor.id);
    return {
      type: 'confirmPlacement',
      plan,
      extras: planExtras(state, actor.id, plan),
    };
  }

  if (state.phase === 'action') {
    return chooseAction(state, actor.id);
  }

  return null;
}

/**
 * The track a bot most wants to name for a Judge power: wherever its own Banners
 * already stand thickest, falling back to its affinity track.
 */
function strongestTrack(state: GameState, playerId: string): TrackId {
  const def = TRIBE_BY_ID[getPlayer(state, playerId).tribe];
  let best: TrackId = def.bias;
  let bestCount = -1;
  for (const track of TRACKS) {
    const n = state.tokens.filter(
      (t) => t.playerId === playerId && t.track === track && isBannerToken(t),
    ).length;
    if (n > bestCount) {
      bestCount = n;
      best = track;
    }
  }
  return best;
}

/** How a bot spends each Judge one-shot. Deliberately simple. */
function declareJudgePower(
  state: GameState,
  actor: PlayerState,
  power: OppressorId,
): PlayerAction | null {
  switch (power) {
    case 'moab': {
      // Ehud's dagger: take from whoever leads on Glory.
      const victim = state.players
        .filter((p) => p.id !== actor.id && state.tokens.some((t) => t.playerId === p.id))
        .sort((a, b) => b.resources.glory - a.resources.glory)[0];
      return victim
        ? { type: 'judgePower', targetPlayerId: victim.id }
        : null;
    }
    case 'hazor':
      // Deborah's summons: rally the whole table to the bot's own field.
      return { type: 'judgePower', track: strongestTrack(state, actor.id) };
    case 'ammon':
      // Jephthah's vow: take the Glory; the reckoning is someone else's problem.
      return { type: 'judgePower' };
    default:
      return null;
  }
}

/**
 * Pre-resolve decisions, in the order a bot should care about them: claim a
 * track outright, then multiply what it already holds, then shift a token, then
 * stand in the breach.
 */
function choosePreResolve(state: GameState): PlayerAction | null {
  for (const p of state.players) {
    if (p.isHuman) continue;
    const power = p.judgePower;
    if (power && JUDGE_POWER_WINDOW[power] === 'preResolve') {
      return { type: 'judgePower', track: strongestTrack(state, p.id) };
    }
  }

  // A post-reveal shift, taken only when it wins something.
  for (const p of state.players) {
    if (p.isHuman || !canShiftToken(state, p.id)) continue;
    const move = bestShift(state, p.id);
    if (move) return move;
  }

  // Naphtali's alliance, spent on the two tracks nearest to falling.
  for (const p of state.players) {
    if (p.isHuman || !canDeclareAlliance(state, p.id)) continue;
    const rescuable = TRACKS.filter((t) => trackShortfall(state, t) === 1);
    if (rescuable.length >= 2) {
      return { type: 'northernAlliance', tracks: [rescuable[0]!, rescuable[1]!] };
    }
  }

  // The rescue, spent only when exactly one track is short.
  for (const p of state.players) {
    if (p.isHuman || !canRescue(state, p.id)) continue;
    const short = TRACKS.filter((t) => trackShortfall(state, t) > 0);
    if (short.length === 1) return { type: 'covenantRescue' };
  }
  return null;
}

/** How far a track is from its threshold right now (0 when it is holding). */
function trackShortfall(state: GameState, track: TrackId): number {
  const totals = getTrackTotals(state).total[track];
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  return Math.max(0, baseThreshold(state, track) - grand);
}

/** A shift, chosen only when it gains a Championship or saves a track. */
function bestShift(state: GameState, playerId: string): PlayerAction | null {
  const score = (s: GameState) => {
    const totals = getTrackTotals(s);
    let champs = 0;
    let holding = 0;
    for (const track of TRACKS) {
      const grand = Object.values(totals.total[track]).reduce((a, b) => a + b, 0);
      if (grand >= baseThreshold(s, track)) holding += 1;
      const entries = Object.entries(totals.banner[track]).filter(([, v]) => v > 0);
      entries.sort((a, b) => b[1] - a[1]);
      if (entries[0]?.[0] === playerId) champs += 1;
    }
    return champs * 10 + holding;
  };

  const mine = state.tokens.filter((t) => t.playerId === playerId && !t.temporary);
  let best: PlayerAction | null = null;
  let bestScore = score(state);
  for (const token of mine) {
    for (const to of TRACKS) {
      if (to === token.track) continue;
      const moved: GameState = {
        ...state,
        tokens: state.tokens.map((t) => (t.id === token.id ? { ...t, track: to } : t)),
      };
      const value = score(moved);
      if (value > bestScore) {
        bestScore = value;
        best = { type: 'shiftToken', tokenId: token.id, toTrack: to };
      }
    }
  }
  return best;
}

/**
 * The choices that ride alongside a placement: Reuben's second track and the
 * tribe Naphtali owes Influence to. Both are free, so a bot takes them whenever
 * they are on offer.
 */
function planExtras(
  state: GameState,
  playerId: string,
  plan: PlacementPlan,
): PlacementExtras | undefined {
  const p = getPlayer(state, playerId);
  const extras: PlacementExtras = {};

  if (p.tribe === 'Reuben' && p.leaderLevel >= 2) {
    const heavy = TRACKS.some((t) => plannedTokenCount(plan[t]) >= 2);
    const empty = TRACKS.filter((t) => plannedTokenCount(plan[t]) === 0);
    if (heavy && empty.length > 0) {
      // The emptiest track that still needs help is worth the most.
      extras.pathfinder = [...empty].sort(
        (a, b) => trackShortfall(state, b) - trackShortfall(state, a),
      )[0];
    }
  }

  if (p.pendingTempInfluenceGift > 0) {
    // Repay the tribe least able to repay you — it is the cheapest goodwill and
    // it keeps a track from failing on everyone.
    const other = state.players
      .filter((x) => x.id !== playerId)
      .sort((a, b) => a.resources.glory - b.resources.glory)[0];
    if (other) {
      const track = [...TRACKS].sort(
        (a, b) => trackShortfall(state, b) - trackShortfall(state, a),
      )[0]!;
      extras.giftTo = { playerId: other.id, track };
    }
  }

  return Object.keys(extras).length > 0 ? extras : undefined;
}

function planPlacement(state: GameState, playerId: string): PlacementPlan {
  const p = getPlayer(state, playerId);
  const def = TRIBE_BY_ID[p.tribe];
  const agr = state.tuningSnapshot.botAggression;
  const plan: PlacementPlan = {};

  const pool: Record<SpendableResource, number> = {
    faith: p.resources.faith,
    warriors: p.resources.warriors,
    goods: p.resources.goods,
  };
  let budget = Math.floor(
    (pool.faith + pool.warriors + pool.goods) * (0.25 + agr * 0.45),
  );
  if (budget <= 0) return plan;

  const add = (track: TrackId, res: SpendableResource, n: number) => {
    const take = Math.max(0, Math.min(n, pool[res], budget));
    if (take <= 0) return;
    plan[track] = {
      ...(plan[track] ?? {}),
      [res]: (plan[track]?.[res] ?? 0) + take,
    };
    pool[res] -= take;
    budget -= take;
  };

  // Concentrate: a thin Banner on a track it cannot win is wasted, so it commits
  // its affinity resource to its own track and only contests elsewhere when it
  // genuinely has the strength.
  const primary = def.bias;
  const primaryRes = TRACK_AFFINITY_RESOURCE[primary];
  // Dan's Nazirite Strength doubles its Banners only while they all stand on a
  // single track, so Dan commits everything and never contests a second.
  const concentrates = p.tribe === 'Dan' && p.leaderLevel >= 1;

  add(
    primary,
    primaryRes,
    concentrates ? pool[primaryRes] : Math.max(1, Math.ceil(budget * 0.7)),
  );

  if (!concentrates) {
    for (const track of TRACKS) {
      if (track === primary) continue;
      const res = TRACK_AFFINITY_RESOURCE[track];
      if (pool[res] >= 3) add(track, res, agr > 0.5 ? 2 : 1);
    }
  }

  // Whatever is left goes as Supply to tracks it has not claimed. A failed track
  // drops the Covenant on everyone, so shoring up the ones it cannot win beats
  // piling onto one it already leads — and the spoil pays it back in the very
  // resource it is short of.
  const unclaimed = TRACKS.filter((t) => !plan[t]?.[TRACK_AFFINITY_RESOURCE[t]]);
  for (const track of unclaimed) {
    for (const res of SPENDABLE) {
      if (budget <= 0) break;
      // Never spend what Banners its own track, and never buy Supply with the
      // resource that would have been a Banner here.
      if (res === primaryRes || res === TRACK_AFFINITY_RESOURCE[track]) continue;
      add(track, res, 1);
    }
  }

  return plan;
}

function chooseAction(state: GameState, playerId: string): PlayerAction {
  const p = getPlayer(state, playerId);
  const def = TRIBE_BY_ID[p.tribe];
  const agr = state.tuningSnapshot.botAggression;
  const zoneLowLoyalty = p.resources.loyalty <= 2;
  const covenantLow = state.covenant <= 4;

  // Without a free placement phase, the action *is* the only way onto a track,
  // so contesting Champions has to outrank economy and opportunistic uniques.
  if (!state.tuningSnapshot.freePlacementPhase) {
    const noTokensYet = !state.tokens.some((t) => t.playerId === playerId);
    if (noTokensYet || Math.random() < agr) {
      const plan = planPlacement(state, playerId);
      if (planTotal(plan) > 0) {
        return { type: 'placeInfluence', plan };
      }
    }
  }

  // Cry out under oppression. The bot weighs it by severity rather than by who
  // will be raised up — the escalating penalty is what forces the issue, and a
  // Judge going to the weakest player is not something it can plan around.
  if (state.oppression) {
    const need = cryThreshold(state) - state.oppression.cryPool;
    const severity = oppressionSeverity(state);
    // Hold one Faith back while the grip is light; give everything once it bites.
    const keepBack = severity >= 3 ? 0 : 1;
    const willing = Math.min(need, Math.max(0, p.resources.faith - keepBack));
    if (willing > 0) {
      return { type: 'standard', action: 'cryOut', cryFaith: willing };
    }
  }

  // Protective uniques
  if (p.tribe === 'Gad' && p.resources.warriors >= 1 && (zoneLowLoyalty || covenantLow)) {
    return { type: 'unique', tribe: 'Gad' };
  }
  if (p.tribe === 'Levi' && p.resources.faith >= 1 && covenantLow) {
    return { type: 'unique', tribe: 'Levi', leviMode: 'raise' };
  }
  if (p.tribe === 'Manasseh' && covenantLow && (p.resources.warriors >= 1 || p.resources.faith >= 1)) {
    return {
      type: 'unique',
      tribe: 'Manasseh',
      manassehSpend: p.resources.warriors >= 1 ? 'warriors' : 'faith',
    };
  }

  // Economy if poor on bias resource
  if (p.resources.warriors < 2 && p.resources.goods >= 1 && Math.random() > agr) {
    return { type: 'standard', action: 'recruit', recruitMode: 'goods' };
  }
  if (p.resources.goods < 2 && (p.resources.warriors >= 1 || p.resources.faith >= 1)) {
    return {
      type: 'standard',
      action: 'gather',
      gatherSpend: p.resources.warriors >= 1 ? 'warriors' : 'faith',
    };
  }
  if (p.resources.faith < 2) {
    return { type: 'standard', action: 'pray', prayMode: 'rest' };
  }

  // Tribe unique opportunistic
  if (p.tribe === 'Asher') {
    return { type: 'unique', tribe: 'Asher', asherMode: p.resources.faith >= 1 ? 'faith' : 'rest' };
  }
  if (p.tribe === 'Ephraim' && p.resources.goods >= 1) {
    return { type: 'unique', tribe: 'Ephraim', ephraimMode: 'doubleGoods' };
  }
  if (p.tribe === 'Benjamin' && p.resources.warriors >= 1 && agr > 0.4) {
    return { type: 'unique', tribe: 'Benjamin' };
  }
  if (p.tribe === 'Simeon' && p.resources.warriors >= 1 && agr > 0.4) {
    return { type: 'unique', tribe: 'Simeon' };
  }
  if (p.tribe === 'Judah' && p.resources.faith >= 1) {
    const other = state.players.find((x) => x.id !== playerId);
    if (other) {
      return { type: 'unique', tribe: 'Judah', targetPlayerId: other.id };
    }
  }
  if (p.tribe === 'Reuben' && p.resources.warriors >= 1) {
    return { type: 'unique', tribe: 'Reuben' };
  }
  if (p.tribe === 'Issachar' && p.resources.faith >= 1) {
    return { type: 'unique', tribe: 'Issachar', issacharOrder: [0, 1] };
  }
  if (p.tribe === 'Zebulun' && p.resources.goods >= 3) {
    return {
      type: 'unique',
      tribe: 'Zebulun',
      zebulunConverts: [
        { from: 'goods', to: 'warriors' },
        { from: 'goods', to: 'faith' },
      ],
    };
  }
  if (p.tribe === 'Dan' && p.resources.faith >= 1 && !p.oncePerGameUsed['serpent'] && state.round > 1) {
    const sev = state.activeCrisis?.severity ?? '';
    if (sev.includes('Heavy') || sev.includes('Escalating')) {
      return { type: 'unique', tribe: 'Dan' };
    }
  }
  if (p.tribe === 'Naphtali') {
    const mine = state.tokens.find((t) => t.playerId === playerId);
    if (mine) {
      const to = TRACKS.find((t) => t !== mine.track) ?? 'moral';
      return { type: 'unique', tribe: 'Naphtali', tokenId: mine.id, toTrack: to };
    }
  }

  // Extra placement if aggressive and rich
  if (agr > 0.5) {
    const plan = planPlacement(state, playerId);
    const n = planTotal(plan);
    if (n > 0) return { type: 'placeInfluence', plan };
  }

  // Default convert or rest
  if (p.resources.goods >= 2) {
    return {
      type: 'standard',
      action: 'convert',
      convert: { from: 'goods', to: def.bias === 'military' ? 'warriors' : 'faith' },
    };
  }
  if (zoneLowLoyalty) {
    return { type: 'standard', action: 'rest' };
  }
  return { type: 'standard', action: 'pray', prayMode: 'rest' };
}

export function describeThresholds(state: GameState): string {
  return TRACKS.map((t) => `${t}: ${baseThreshold(state, t)}`).join(', ');
}
