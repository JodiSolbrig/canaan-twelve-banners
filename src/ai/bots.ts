import { TRIBE_BY_ID } from '../data/gameData';
import {
  availableLeaderTrade,
  canArmGoodsDoubler,
  canSpendResilience,
  canStudyTrack,
} from '../engine/actions';
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
import {
  barredFromProvision,
  canClaimField,
  canDeclareAlliance,
  canRescue,
  canShiftToken,
  canWiseCounsel,
  supplyOnTrack,
} from '../engine/resolve';
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
    // Understanding of Times is free and strictly informative, so it is always
    // worth taking before committing. The track nearest to falling is the one
    // worth knowing about.
    if (canStudyTrack(state, actor.id)) {
      const track = [...TRACKS].sort(
        (a, b) => trackShortfall(state, b) - trackShortfall(state, a),
      )[0]!;
      return { type: 'studyTrack', track };
    }
    // Manasseh trades Loyalty for Influence, but only while it can spare the
    // Loyalty — it is the first tie-break at the end, and dropping to the
    // bottom of the table invites the Judgment discard.
    if (canSpendResilience(state, actor.id) && actor.resources.loyalty >= 3) {
      const short = [...TRACKS].sort(
        (a, b) => trackShortfall(state, b) - trackShortfall(state, a),
      )[0]!;
      if (trackShortfall(state, short) > 0) {
        return { type: 'spendResilience', track: short };
      }
    }

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

  // Claim the Field, spent only where standing the Supply up actually takes
  // the track — the promotion also buys the Loyalty penalty if it then fails.
  for (const p of state.players) {
    if (p.isHuman || !canClaimField(state, p.id)) continue;
    const claim = bestClaim(state, p.id);
    if (claim) return claim;
  }

  // Wise Counsel, spent to strip a Championship rather than to save a track:
  // a Banner dragged onto another track becomes Supply and claims nothing.
  for (const p of state.players) {
    if (p.isHuman || !canWiseCounsel(state, p.id)) continue;
    const move = bestCounsel(state, p.id);
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
 * Claim the Field is worth spending only where the promoted Supply would win
 * the track outright. It is once per game and it buys exposure as well as
 * Banners, so a claim that merely narrows a gap is a claim wasted.
 */
function bestClaim(state: GameState, playerId: string): PlayerAction | null {
  const totals = getTrackTotals(state);
  for (const track of TRACKS) {
    const gain = supplyOnTrack(state, playerId, track);
    if (gain === 0) continue;
    const banners = totals.banner[track];
    const mine = (banners[playerId] ?? 0) + gain;
    const best = Object.entries(banners)
      .filter(([pid]) => pid !== playerId)
      .reduce((m, [, v]) => Math.max(m, v), 0);
    if (mine > best && (banners[playerId] ?? 0) <= best) {
      return { type: 'claimField', track };
    }
  }
  return null;
}

/**
 * Wise Counsel, weighed the way Issachar would: it is worth spending only if it
 * takes a Championship off the current leader, or saves a track that would
 * otherwise fail. Moving a token for its own sake wastes a once-per-game.
 */
function bestCounsel(state: GameState, playerId: string): PlayerAction | null {
  const score = (s: GameState) => {
    const totals = getTrackTotals(s);
    let mine = 0;
    let holding = 0;
    for (const track of TRACKS) {
      const grand = Object.values(totals.total[track]).reduce((a, b) => a + b, 0);
      if (grand >= baseThreshold(s, track)) holding += 1;
      const entries = Object.entries(totals.banner[track]).filter(([, v]) => v > 0);
      entries.sort((a, b) => b[1] - a[1]);
      if (entries[0]?.[0] === playerId) mine += 1;
    }
    return mine * 10 + holding;
  };

  const theirs = state.tokens.filter(
    (t) => t.playerId !== playerId && !t.temporary,
  );
  let best: PlayerAction | null = null;
  let bestScore = score(state);
  for (const token of theirs) {
    for (const to of TRACKS) {
      if (to === token.track) continue;
      const moved: GameState = {
        ...state,
        tokens: state.tokens.map((t) => (t.id === token.id ? { ...t, track: to } : t)),
      };
      const value = score(moved);
      if (value > bestScore) {
        bestScore = value;
        best = { type: 'wiseCounsel', tokenId: token.id, toTrack: to };
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

  const add = (track: TrackId, res: SpendableResource, n: number): number => {
    const take = Math.max(0, Math.min(n, pool[res]));
    if (take <= 0) return 0;
    plan[track] = {
      ...(plan[track] ?? {}),
      [res]: (plan[track]?.[res] ?? 0) + take,
    };
    pool[res] -= take;
    return take;
  };

  // --- Banners -------------------------------------------------------------
  // Only an affinity token can win a Championship, so the Banner budget is the
  // tribe's entire appetite for contesting. A thin Banner on a track it cannot
  // win is wasted, so it commits to its own track and contests elsewhere only
  // when it genuinely has the strength.
  let banners = Math.floor(
    (pool.faith + pool.warriors + pool.goods) * (0.25 + agr * 0.45),
  );

  const primary = def.bias;
  const primaryRes = TRACK_AFFINITY_RESOURCE[primary];
  // Dan's Nazirite Strength doubles its Banners only while they all stand on a
  // single track, so Dan commits everything and never contests a second.
  const concentrates = p.tribe === 'Dan' && p.leaderLevel >= 1;

  if (banners > 0) {
    banners -= add(
      primary,
      primaryRes,
      concentrates ? banners : Math.max(1, Math.ceil(banners * 0.7)),
    );

    if (!concentrates) {
      for (const track of TRACKS) {
        if (track === primary || banners <= 0) continue;
        // A Banner on a track you can never Champion buys nothing but risk.
        if (track === 'provision' && barredFromProvision(state, playerId)) continue;
        const res = TRACK_AFFINITY_RESOURCE[track];
        if (pool[res] >= 3) {
          banners -= add(track, res, Math.min(banners, agr > 0.5 ? 2 : 1));
        }
      }
    }
  }

  // --- Supply --------------------------------------------------------------
  // The spoil is a flat payment to each Supply contributor rather than a
  // per-token one, so a single off-affinity token on a track that holds comes
  // back in full at no risk — and a second one on the same track does not. One
  // token per track it did not Banner is therefore the whole of the play.
  //
  // It is bought from its own allowance rather than the Banner budget's
  // leftovers. While the two competed the Banners always won, and the balance
  // harness ran 94% Banner to 6% Supply: the asymmetry the rule exists to
  // create was not being played at all.
  const reserve: Record<SpendableResource, number> = {
    // Faith is the Cry. While Israel is under a hand, no track is worth more
    // than deliverance, so none of it is lent out.
    faith: state.oppression ? pool.faith : 1,
    warriors: 1,
    goods: 1,
  };
  // Its own Banner resource is worth more to it than to any track it chose not
  // to contest, so it keeps a generation's worth back before lending any.
  reserve[primaryRes] = Math.max(reserve[primaryRes], 2);

  // A barred Levi still wants Influence on Provision: the tithe is owed for
  // service, so being absent from the harvest forfeits it.
  const tithed = barredFromProvision(state, playerId);

  for (const track of TRACKS) {
    // Paying a track's own affinity plants a Banner, which is the decision this
    // pass has already declined to make.
    if (plan[track]?.[TRACK_AFFINITY_RESOURCE[track]]) continue;
    for (const res of SPENDABLE) {
      if (res === TRACK_AFFINITY_RESOURCE[track]) continue;
      // The tithe is worth digging a little deeper for than an ordinary spoil.
      const floor = tithed && track === 'provision' ? 0 : reserve[res];
      if (pool[res] <= floor) continue;
      if (add(track, res, 1) > 0) break;
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

  // Arm the once-per-game doubler immediately before the biggest Goods gain the
  // bot can actually reach — its own Harvest or Gather. Arming costs nothing and
  // the doubler waits rather than expiring, but arming early spends it on
  // whatever trickle arrives first, which is usually income.
  if (canArmGoodsDoubler(state, playerId)) {
    const aboutToHarvest =
      (p.tribe === 'Asher' && p.resources.faith >= 1) ||
      p.resources.warriors >= 1 ||
      p.resources.faith >= 1;
    if (aboutToHarvest) return { type: 'armGoodsDoubler' };
  }

  // A leader's standing trade costs no action, so it is taken before deciding
  // what to do with the turn itself — and the turn is still there afterwards.
  const trade = availableLeaderTrade(state, playerId);
  if (trade) {
    const want: SpendableResource = state.oppression
      ? 'faith'
      : TRACK_AFFINITY_RESOURCE[def.bias];
    // Never trade down to nothing: a rate's worth plus one stays in hand.
    const affordable = trade.trades.filter(
      (t) => p.resources[t.from] >= trade.rate + 1,
    );
    const pick =
      affordable.find((t) => t.to === want) ??
      // Ephraim can only ever trade its own Banner resource away, so a genuine
      // surplus is the one time it should — turned into whatever it has least of.
      affordable
        .filter((t) => p.resources[t.from] - trade.rate > p.resources[t.to] + 1)
        .sort((a, b) => p.resources[a.to] - p.resources[b.to])[0];
    if (pick) return { type: 'leaderTrade', from: pick.from, to: pick.to };
  }

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
