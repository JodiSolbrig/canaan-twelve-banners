import {
  applyPlaceInfluenceAction,
  applyStandardAction,
  applyUniqueAction,
} from './actions';
import { advanceActorOrPhase, applyPlacement } from './placement';
import { applyAngelChoice, revealTokens } from './resolve';
import { addLog, currentActor } from './helpers';
import type { GameState, PlayerAction } from './types';

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
    let s = applyPlaceInfluenceAction(state, actor.id, action.plan);
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
export { currentActor, getPlayer } from './helpers';
export type * from './types';
