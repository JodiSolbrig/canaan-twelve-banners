/**
 * Public engine API.
 *
 * Flow: `createGame` → (UI) crisis advance → placement → action →
 * `revealTokens` / resolve → `startRound` or `endGame`.
 *
 * Prefer importing from this barrel rather than deep paths when adding UI/AI code.
 */
import {
  applyPlaceInfluenceAction,
  applyStandardAction,
  applyUniqueAction,
} from './actions';
import { advanceActorOrPhase, applyPlacement } from './placement';
import { advanceToNextRound, applyAngelChoice, revealTokens } from './resolve';
import { addLog, currentActor, openingPhase, planTotal } from './helpers';
import type { GameState, PlayerAction } from './types';

/** Apply one legal player/system action; returns next immutable state. */
export function dispatch(state: GameState, action: PlayerAction): GameState {
  if (state.phase === 'gameEnd') return state;

  if (action.type === 'crisisChoice') {
    if (state.phase !== 'crisisChoice') return state;
    return applyAngelChoice(
      state,
      action.angel.topId,
      action.angel.bottomId,
      action.angel.covenantDelta,
    );
  }

  if (action.type === 'confirmPlacement') {
    if (state.phase !== 'placement') return state;
    const actor = currentActor(state);
    if (!actor) return state;
    const wanted = planTotal(action.plan);
    const before = state.tokens.length;
    let s = applyPlacement(state, actor.id, action.plan);
    // An unaffordable plan places nothing; hold the turn so it can be redone
    // rather than silently spending the player's placement on empty air.
    if (wanted > 0 && s.tokens.length <= before) return s;
    s = advanceActorOrPhase(s, 'action');
    return s;
  }

  if (action.type === 'standard') {
    if (state.phase !== 'action') return state;
    const actor = currentActor(state);
    if (!actor) return state;
    const result = applyStandardAction(state, actor.id, action);
    if (!result.ok) return result.state;
    let s = advanceActorOrPhase(result.state, 'reveal');
    if (s.phase === 'reveal') s = revealTokens(s);
    return s;
  }

  if (action.type === 'placeInfluence') {
    if (state.phase !== 'action') return state;
    const actor = currentActor(state);
    if (!actor) return state;
    if (planTotal(action.plan) < 1) {
      return addLog(
        state,
        'Place Influence needs at least 1 token on a track.',
        'bad',
      );
    }
    const before = state.tokens.length;
    let s = applyPlaceInfluenceAction(state, actor.id, action.plan);
    // If nothing was placed (could not afford), do not consume the action
    if (s.tokens.length <= before) {
      return addLog(s, `${actor.tribe} could not afford that Influence.`, 'bad');
    }
    s = advanceActorOrPhase(s, 'reveal');
    if (s.phase === 'reveal') s = revealTokens(s);
    return s;
  }

  if (action.type === 'unique') {
    if (state.phase !== 'action') return state;
    const actor = currentActor(state);
    if (!actor) return state;
    const result = applyUniqueAction(state, actor.id, action);
    if (!result.ok) return result.state;
    let s = advanceActorOrPhase(result.state, 'reveal');
    if (s.phase === 'reveal') s = revealTokens(s);
    return s;
  }

  if (action.type === 'advance') {
    if (state.phase === 'crisisReveal') {
      return { ...state, phase: openingPhase(state), currentActorIndex: 0 };
    }
    if (state.phase === 'resolve') {
      return advanceToNextRound(state);
    }
    return state;
  }

  return addLog(state, 'Unknown action.', 'bad');
}

export { createGame } from './createGame';
export { startRound } from './round';
export {
  compareStandings,
  currentActor,
  getPlayer,
  isBannerToken,
  planTotal,
  rankPlayers,
  TRACK_AFFINITY_RESOURCE,
} from './helpers';
export type * from './types';
