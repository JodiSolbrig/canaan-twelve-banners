import { TRIBE_BY_ID } from '../data/gameData';
import {
  baseThreshold,
  currentActor,
  getPlayer,
} from '../engine/helpers';
import type {
  GameState,
  PlacementPlan,
  PlayerAction,
  TrackId,
} from '../engine/types';

const TRACKS: TrackId[] = ['military', 'moral', 'provision'];

export function chooseBotAction(state: GameState): PlayerAction | null {
  const actor = currentActor(state);
  if (!actor || actor.isHuman) return null;

  if (state.phase === 'placement') {
    return { type: 'confirmPlacement', plan: planPlacement(state, actor.id) };
  }

  if (state.phase === 'action') {
    return chooseAction(state, actor.id);
  }

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
  }

  return null;
}

function planPlacement(state: GameState, playerId: string): PlacementPlan {
  const p = getPlayer(state, playerId);
  const def = TRIBE_BY_ID[p.tribe];
  const agr = state.tuningSnapshot.botAggression;
  const budget = Math.floor(
    (p.resources.faith + p.resources.warriors + p.resources.goods) * (0.25 + agr * 0.45),
  );
  const plan: PlacementPlan = { military: 0, moral: 0, provision: 0 };
  if (budget <= 0) return plan;

  // Prefer bias track, sprinkle rest
  const primary = def.bias;
  const primaryCount = Math.max(1, Math.ceil(budget * 0.6));
  const rest = budget - primaryCount;
  plan[primary] = primaryCount;
  const others = TRACKS.filter((t) => t !== primary);
  if (rest > 0 && others[0]) plan[others[0]] = Math.ceil(rest / 2);
  if (rest > 1 && others[1]) plan[others[1]] = Math.floor(rest / 2);

  // Cap by affordability roughly
  const totalRes = p.resources.faith + p.resources.warriors + p.resources.goods;
  let need = (plan.military ?? 0) + (plan.moral ?? 0) + (plan.provision ?? 0);
  while (need > totalRes) {
    for (const t of TRACKS) {
      if ((plan[t] ?? 0) > 0 && need > totalRes) {
        plan[t] = (plan[t] ?? 0) - 1;
        need -= 1;
      }
    }
    if (need <= 0) break;
  }
  return plan;
}

function chooseAction(state: GameState, playerId: string): PlayerAction {
  const p = getPlayer(state, playerId);
  const def = TRIBE_BY_ID[p.tribe];
  const agr = state.tuningSnapshot.botAggression;
  const zoneLowLoyalty = p.resources.loyalty <= 2;
  const covenantLow = state.covenant <= 4;

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
    const n = TRACKS.reduce((a, t) => a + (plan[t] ?? 0), 0);
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
