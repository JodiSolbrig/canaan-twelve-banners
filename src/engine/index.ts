/**
 * Public engine API.
 *
 * Flow: `createGame` → (UI) crisis advance → placement → action →
 * `revealTokens` / resolve → `startRound` or `endGame`.
 *
 * Prefer importing from this barrel rather than deep paths when adding UI/AI code.
 */
import {
  armGoodsDoubler,
  applyLeaderTrade,
  applyPlaceInfluenceAction,
  applyStandardAction,
  applyUniqueAction,
  studyTrack,
} from './actions';
import { advanceActorOrPhase, applyPlacement } from './placement';
import { applyJudgePower, JUDGE_POWER_WINDOW } from './judges';
import {
  advanceToNextRound,
  applyAngelChoice,
  applyShiftToken,
  applyWiseCounsel,
  canRescue,
  canWiseCounsel,
  canDeclareAlliance,
  canShiftToken,
  declareAlliance,
  declareCovenantRescue,
  resolveRound,
  revealTokens,
} from './resolve';
import { addLog, currentActor, openingPhase, planTotal } from './helpers';
import type { GameState, PlayerAction, PlayerState } from './types';

/**
 * Who is spending a Judge power. During the action phase it must be the player
 * whose turn it is; at pre-resolve the order does not matter, so the holder is
 * found directly.
 */
function judgeActor(state: GameState): PlayerState | null {
  if (state.phase === 'action') {
    const actor = currentActor(state);
    return actor?.judgePower && JUDGE_POWER_WINDOW[actor.judgePower] === 'action'
      ? actor
      : null;
  }
  if (state.phase !== 'preResolve') return null;
  const holders = state.players.filter(
    (p) => p.judgePower && JUDGE_POWER_WINDOW[p.judgePower] === 'preResolve',
  );
  return holders.find((p) => p.isHuman) ?? holders[0] ?? null;
}

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
    let s = applyPlacement(state, actor.id, action.plan, action.extras);
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

  if (action.type === 'leaderTrade') {
    if (state.phase !== 'action') return state;
    const actor = currentActor(state);
    if (!actor) return state;
    // A leader trade is free of the action, so the turn does not advance —
    // the player still has their full action to take afterwards.
    return applyLeaderTrade(state, actor.id, action).state;
  }

  if (action.type === 'armGoodsDoubler') {
    if (state.phase !== 'action') return state;
    const actor = currentActor(state);
    if (!actor) return state;
    // Free of the action, like a leader trade — the turn does not advance.
    return armGoodsDoubler(state, actor.id).state;
  }

  if (action.type === 'studyTrack') {
    if (state.phase !== 'placement') return state;
    const actor = currentActor(state);
    if (!actor) return state;
    // Studied before you commit, and it does not spend the placement.
    return studyTrack(state, actor.id, action.track).state;
  }

  if (action.type === 'wiseCounsel') {
    if (state.phase !== 'preResolve') return state;
    const issachar = state.players.find((p) => canWiseCounsel(state, p.id));
    if (!issachar) return state;
    return applyWiseCounsel(state, issachar.id, action.tokenId, action.toTrack)
      .state;
  }

  if (action.type === 'judgePower') {
    const actor = judgeActor(state);
    if (!actor) return state;
    return applyJudgePower(state, actor.id, action).state;
  }

  if (action.type === 'northernAlliance') {
    if (state.phase !== 'preResolve') return state;
    const naphtali = state.players.find((p) => canDeclareAlliance(state, p.id));
    if (!naphtali) return state;
    return declareAlliance(state, naphtali.id, action.tracks).state;
  }

  if (action.type === 'shiftToken') {
    if (state.phase !== 'preResolve') return state;
    const mover = state.players.find((p) => canShiftToken(state, p.id));
    if (!mover) return state;
    return applyShiftToken(state, mover.id, action.tokenId, action.toTrack).state;
  }

  if (action.type === 'covenantRescue') {
    if (state.phase !== 'preResolve') return state;
    const human = state.players.find((p) => p.isHuman && canRescue(state, p.id));
    const who = human ?? state.players.find((p) => canRescue(state, p.id));
    if (!who) return state;
    return declareCovenantRescue(state, who.id).state;
  }

  if (action.type === 'advance') {
    if (state.phase === 'crisisReveal') {
      return { ...state, phase: openingPhase(state), currentActorIndex: 0 };
    }
    // Everyone is done looking at the revealed board; score it.
    if (state.phase === 'preResolve') {
      return resolveRound({ ...state, phase: 'resolve' });
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
  availableLeaderTrade,
  canArmGoodsDoubler,
  canStudyTrack,
  LEADER_TRADES,
} from './actions';
export { canWiseCounsel } from './resolve';
export { goodsDoublerOf } from './helpers';
export type { LeaderTrade } from './actions';
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
