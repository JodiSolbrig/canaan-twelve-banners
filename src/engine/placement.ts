/**
 * Face-down Influence placement and actor-turn advancement.
 *
 * A placement states exactly which resources go on which track. What pays is the
 * decision: the track's affinity resource plants a **Banner** (counts toward
 * Champion, exposed to the failure penalty), anything else sends **Supply**
 * (counts only toward the success threshold, and risks nothing).
 */
import { TRIBE_BY_ID } from '../data/gameData';
import {
  addLog,
  getPlayer,
  nextTokenId,
  plannedTokenCount,
  planTotal,
  TRACK_AFFINITY_RESOURCE,
  TRACKS,
  updatePlayer,
} from './helpers';
import type {
  GameState,
  PlacementPlan,
  Resources,
  SpendableResource,
  TrackId,
} from './types';

const SPEND_ORDER: SpendableResource[] = ['warriors', 'faith', 'goods'];

/** Flatten one track's spend into the per-token resource that bought it. */
function paymentsFor(plan: PlacementPlan, track: TrackId): SpendableResource[] {
  const spend = plan[track];
  const payments: SpendableResource[] = [];
  if (!spend) return payments;
  // Affinity first so Iron Chariots' unpaid surcharge lands on Supply tokens
  // before it degrades a player's Banners.
  const affinity = TRACK_AFFINITY_RESOURCE[track];
  const order = [affinity, ...SPEND_ORDER.filter((r) => r !== affinity)];
  for (const key of order) {
    for (let i = 0; i < (spend[key] ?? 0); i++) payments.push(key);
  }
  return payments;
}

/** Total of each resource a plan requires, before Crisis surcharges. */
function planCost(plan: PlacementPlan): Record<SpendableResource, number> {
  const cost: Record<SpendableResource, number> = { faith: 0, warriors: 0, goods: 0 };
  for (const track of TRACKS) {
    for (const key of SPEND_ORDER) {
      cost[key] += plan[track]?.[key] ?? 0;
    }
  }
  return cost;
}

/**
 * Influence each token is worth after the Crisis cards that change what a placed
 * token counts for. Token *count* always matches what was paid for, so
 * abilities that count tokens (Dan's Nazirite Strength) are unaffected.
 *
 * - Crisis 1 (High Places of Baal): Faith spent on Moral is worth half, rounded
 *   down. Faith is Moral's Banner resource, so this bites Banner strength.
 * - Crisis 3 (Iron Chariots): a Military token whose extra Warrior went unpaid
 *   has its Influence reduced by 1, i.e. it contributes nothing.
 */
function tokenValues(
  track: TrackId,
  payments: SpendableResource[],
  crisisId: number | null,
  ironChariotUnpaid: number,
): number[] {
  const values = payments.map(() => 1);

  if (track === 'moral' && crisisId === 1) {
    const faithSlots = payments
      .map((r, i) => (r === 'faith' ? i : -1))
      .filter((i) => i >= 0);
    const counted = Math.floor(faithSlots.length / 2);
    for (const i of faithSlots.slice(counted)) values[i] = 0;
  }

  if (track === 'military' && crisisId === 3) {
    for (let i = 0; i < ironChariotUnpaid && i < values.length; i++) {
      values[values.length - 1 - i] = 0;
    }
  }

  return values;
}

export function applyPlacement(
  state: GameState,
  playerId: string,
  plan: PlacementPlan,
): GameState {
  let s = state;
  const p = getPlayer(s, playerId);
  const crisisId = s.activeCrisis?.id ?? null;

  // Affordability is checked up front against the whole plan, so a placement
  // either happens in full or not at all.
  const cost = planCost(plan);
  const ironSurcharge = crisisId === 3 ? plannedTokenCount(plan.military) : 0;

  if (
    p.resources.faith < cost.faith ||
    p.resources.goods < cost.goods ||
    p.resources.warriors < cost.warriors
  ) {
    return addLog(s, `${p.tribe} cannot afford that Influence placement.`, 'bad');
  }

  const resources: Resources = {
    ...p.resources,
    faith: p.resources.faith - cost.faith,
    goods: p.resources.goods - cost.goods,
    warriors: p.resources.warriors - cost.warriors,
  };

  // Iron Chariots is paid from whatever Warriors survive the base cost. Tokens
  // it cannot cover still get placed, but contribute nothing.
  let unpaidSurcharge = 0;
  if (ironSurcharge > 0) {
    const paid = Math.min(ironSurcharge, resources.warriors);
    resources.warriors -= paid;
    unpaidSurcharge = ironSurcharge - paid;
  }

  const newTokens = [...s.tokens];

  for (const track of TRACKS) {
    const payments = paymentsFor(plan, track);
    if (payments.length === 0) continue;
    const values = tokenValues(track, payments, crisisId, unpaidSurcharge);
    payments.forEach((paidWith, i) => {
      newTokens.push({
        id: nextTokenId(),
        playerId,
        track,
        value: values[i] ?? 1,
        temporary: false,
        faceDown: true,
        paidWith,
      });
    });
  }

  // Simeon's Furious Assault token is a gift on top of the plan — no resource is
  // spent and no Iron Chariots surcharge applies, but it musters actual warriors,
  // so it counts as a Banner.
  const freeMilitary = p.freeMilitaryNextRound;
  for (let i = 0; i < freeMilitary; i++) {
    newTokens.push({
      id: nextTokenId(),
      playerId,
      track: 'military',
      value: 1,
      temporary: false,
      faceDown: true,
      paidWith: 'warriors',
    });
  }

  // Pending temp gift (Naphtali II) — consumed here when set. Gifted Influence is
  // Supply: you are sending help, not planting someone else's banner.
  if (p.pendingTempInfluenceGift > 0) {
    newTokens.push({
      id: nextTokenId(),
      playerId,
      track: TRIBE_BY_ID[p.tribe].bias,
      value: p.pendingTempInfluenceGift,
      temporary: true,
      faceDown: true,
      paidWith: null,
    });
  }

  s = { ...s, tokens: newTokens };
  s = updatePlayer(s, playerId, (pl) => {
    // Both bonuses below are pure upside on a Banner the player already paid
    // for, so they arm themselves rather than needing an activation prompt.
    const once = { ...pl.oncePerRoundUsed };
    const bannerMilitary = (plan.military?.warriors ?? 0) + freeMilitary;
    if (bannerMilitary > 0 && pl.leaderLevel >= 2) {
      if (pl.tribe === 'Judah') once['othnielII'] = true;
      if (pl.tribe === 'Benjamin') once['ehudII'] = true;
    }
    return {
      ...pl,
      resources,
      freeMilitaryNextRound: 0,
      pendingTempInfluenceGift: 0,
      oncePerRoundUsed: once,
    };
  });

  const placed = planTotal(plan) + freeMilitary;
  if (placed > 0) {
    s = addLog(s, `${p.tribe} places ${placed} Influence.`, 'info');
  } else {
    s = addLog(s, `${p.tribe} places no Influence.`, 'info');
  }
  return s;
}

export function advanceActorOrPhase(
  state: GameState,
  nextPhase: GameState['phase'],
): GameState {
  const nextIndex = state.currentActorIndex + 1;
  if (nextIndex >= state.turnOrder.length) {
    return { ...state, currentActorIndex: 0, phase: nextPhase };
  }
  return { ...state, currentActorIndex: nextIndex };
}
