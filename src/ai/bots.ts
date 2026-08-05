import { TRIBE_BY_ID } from '../data/gameData';
import {
  baseThreshold,
  cryThreshold,
  currentActor,
  getPlayer,
  oppressionSeverity,
  planTotal,
  TRACK_AFFINITY_RESOURCE,
} from '../engine/helpers';
import type {
  GameState,
  PlacementPlan,
  PlayerAction,
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

  const actor = currentActor(state);
  if (!actor || actor.isHuman) return null;

  if (state.phase === 'placement') {
    return { type: 'confirmPlacement', plan: planPlacement(state, actor.id) };
  }

  if (state.phase === 'action') {
    return chooseAction(state, actor.id);
  }

  return null;
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
  add(primary, primaryRes, Math.max(1, Math.ceil(budget * 0.7)));

  for (const track of TRACKS) {
    if (track === primary) continue;
    const res = TRACK_AFFINITY_RESOURCE[track];
    if (pool[res] >= 3) add(track, res, agr > 0.5 ? 2 : 1);
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
