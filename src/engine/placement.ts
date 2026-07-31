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
import type { GameState, PlacementPlan } from './types';

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

    const spent = spendForInfluence(
      resources,
      count,
      track,
      s.activeCrisis?.id ?? null,
    );
    if (!spent.ok) {
      return addLog(s, `${p.tribe} cannot afford that Influence placement.`, 'bad');
    }
    resources = spent.resources;

    for (let i = 0; i < count; i++) {
      let value = 1;
      // High Places of Baal: faith half on moral — approximate: if spent faith, half value
      if (track === 'moral' && s.activeCrisis?.id === 1 && spent.spentFaith > 0) {
        // Faith tokens contribute 0; floor(spentFaith/2) applied below
        if (i < spent.spentFaith) value = 0;
      }
      if (track === 'military' && s.activeCrisis?.id === 3 && i < spent.ironChariotUnpaid) {
        value = -1;
      }
      newTokens.push({
        id: nextTokenId(),
        playerId,
        track,
        value: value === 0 && track === 'moral' && s.activeCrisis?.id === 1 ? 0 : value < 0 ? -1 : 1,
        temporary: false,
        faceDown: true,
      });
    }

    // High Places fix: replace faith tokens with floor(spentFaith/2) total influence
    if (track === 'moral' && s.activeCrisis?.id === 1 && spent.spentFaith > 0) {
      // Remove zero-value tokens we just added for faith portion and add floor/2
      // Simpler approach already set faith tokens to 0; add floor(spentFaith/2) value to first token
      const moralMine = newTokens.filter(
        (t) => t.playerId === playerId && t.track === 'moral' && t.value === 0,
      );
      const bonus = Math.floor(spent.spentFaith / 2);
      if (moralMine[0] && bonus > 0) {
        moralMine[0].value = bonus;
      }
      // Non-faith tokens already value 1
      const nonFaith = count - spent.spentFaith;
      // Rebuild: for clarity leave zeros and set one token to bonus + ensure non-faith count
      void nonFaith;
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
  s = updatePlayer(s, playerId, (pl) => ({
    ...pl,
    resources,
    freeMilitaryNextRound: 0,
    pendingTempInfluenceGift: 0,
  }));
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
