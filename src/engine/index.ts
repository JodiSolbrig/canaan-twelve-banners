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
import { applyAngelChoice, revealTokens } from './resolve';
import { addLog, currentActor } from './helpers';
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
    let s = applyPlacement(state, actor.id, action.plan);
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
    const total =
      (action.plan.military ?? 0) +
      (action.plan.moral ?? 0) +
      (action.plan.provision ?? 0);
    if (total < 1) {
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
      return { ...state, phase: 'placement', currentActorIndex: 0 };
    }
    return state;
  }

  return addLog(state, 'Unknown action.', 'bad');
}

export { createGame } from './createGame';
export { startRound } from './round';
export { currentActor, getPlayer, rankPlayers, compareStandings } from './helpers';
export type * from './types';
