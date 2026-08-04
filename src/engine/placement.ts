/**
 * Face-down Influence placement and actor-turn advancement.
 */
import { TRIBE_BY_ID } from '../data/gameData';
import {
  addLog,
  getPlayer,
  nextTokenId,
  spendForInfluence,
  TRACKS,
  updatePlayer,
} from './helpers';
import type { GameState, PlacementPlan, TrackId } from './types';

/**
 * Influence value of each token in one placement, after the Crisis cards that
 * change what a placed token is worth. Token *count* always equals what the
 * player paid for, so abilities that count tokens (Dan's Nazirite Strength) are
 * unaffected; only the values move.
 *
 * - Crisis 1 (High Places of Baal): Faith spent on Moral is worth half, rounded
 *   down, spread as `floor(faith/2)` tokens of 1 and the remainder at 0.
 * - Crisis 3 (Iron Chariots): a Military token whose extra Warrior went unpaid
 *   has its Influence reduced by 1, i.e. it contributes nothing.
 */
function tokenValues(
  track: TrackId,
  count: number,
  crisisId: number | null,
  spent: { spentFaith: number; ironChariotUnpaid: number },
): number[] {
  const values: number[] = [];

  if (track === 'moral' && crisisId === 1 && spent.spentFaith > 0) {
    const nonFaith = count - spent.spentFaith;
    const halved = Math.floor(spent.spentFaith / 2);
    for (let i = 0; i < nonFaith; i++) values.push(1);
    for (let i = 0; i < spent.spentFaith; i++) values.push(i < halved ? 1 : 0);
  } else {
    for (let i = 0; i < count; i++) values.push(1);
  }

  if (track === 'military' && crisisId === 3) {
    for (let i = 0; i < spent.ironChariotUnpaid && i < values.length; i++) {
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
  let p = getPlayer(s, playerId);
  let resources = { ...p.resources };
  const newTokens = [...s.tokens];
  let freeMil = p.freeMilitaryNextRound;

  for (const track of TRACKS) {
    let count = plan[track] ?? 0;
    if (count <= 0) continue;

    // Simeon free military tokens
    if (track === 'military' && freeMil > 0) {
      const useFree = Math.min(freeMil, count);
      for (let i = 0; i < useFree; i++) {
        newTokens.push({
          id: nextTokenId(),
          playerId,
          track,
          value: 1,
          temporary: false,
          faceDown: true,
        });
      }
      freeMil -= useFree;
      count -= useFree;
    }

    if (count <= 0) continue;

    const crisisId = s.activeCrisis?.id ?? null;
    const spent = spendForInfluence(resources, count, track, crisisId);
    if (!spent.ok) {
      return addLog(s, `${p.tribe} cannot afford that Influence placement.`, 'bad');
    }
    resources = spent.resources;

    for (const value of tokenValues(track, count, crisisId, spent)) {
      newTokens.push({
        id: nextTokenId(),
        playerId,
        track,
        value,
        temporary: false,
        faceDown: true,
      });
    }
  }

  // Pending temp gift (Naphtali II / support gifts) — consumed here when set.
  if (p.pendingTempInfluenceGift > 0) {
    const bias = TRIBE_BY_ID[p.tribe].bias;
    newTokens.push({
      id: nextTokenId(),
      playerId,
      track: bias,
      value: p.pendingTempInfluenceGift,
      temporary: true,
      faceDown: true,
    });
  }

  const placed = TRACKS.reduce((n, t) => n + (plan[t] ?? 0), 0);
  s = {
    ...s,
    tokens: newTokens,
  };
  s = updatePlayer(s, playerId, (pl) => {
    // Both bonuses are pure upside on a placement the player already paid for,
    // so they arm themselves rather than needing an activation prompt.
    const once = { ...pl.oncePerRoundUsed };
    if ((plan.military ?? 0) > 0 && pl.leaderLevel >= 2) {
      // Judah Othniel II — Wholehearted Charge
      if (pl.tribe === 'Judah') once['othnielII'] = true;
      // Benjamin Ehud II — Hidden Dagger
      if (pl.tribe === 'Benjamin') once['ehudII'] = true;
    }
    return {
      ...pl,
      resources,
      // Keep any free Military tokens that went unused this placement.
      freeMilitaryNextRound: freeMil,
      pendingTempInfluenceGift: 0,
      oncePerRoundUsed: once,
    };
  });
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
