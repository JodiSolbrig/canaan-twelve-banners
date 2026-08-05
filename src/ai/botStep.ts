/**
 * One bot move, including the guard that stops a bot stalling the round.
 *
 * This lives in one place because it did not used to. The app and the balance
 * harness each carried their own copy, both testing "did the acting seat
 * advance?" to decide whether the bot was stuck — which was true right up until
 * abilities arrived that are *free of the turn*. A leader trade, arming a
 * doubler, studying a track and an on-your-turn Judge power all deliberately
 * leave the same seat acting. The old guard read those as a stall, threw the
 * move away, and spent the seat's real action on a pass. Issachar never placed
 * a token again once it could study.
 *
 * Every free action flips a once-per-round or once-per-game flag, so the
 * sequence always terminates on its own.
 */
import { currentActor, dispatch } from '../engine';
import type { GameState, PlayerAction } from '../engine/types';
import { chooseBotAction } from './bots';

/** Actions that intentionally leave the acting seat where it is. */
export function isFreeOfTheTurn(action: PlayerAction): boolean {
  return (
    action.type === 'leaderTrade' ||
    action.type === 'armGoodsDoubler' ||
    action.type === 'studyTrack' ||
    action.type === 'judgePower'
  );
}

/**
 * Apply one bot decision to `state` and return the result.
 *
 * Returns the state unchanged only when there is nothing for a bot to do.
 */
export function stepBot(state: GameState): GameState {
  const action = chooseBotAction(state);
  if (!action) return state;

  const beforePhase = state.phase;
  const beforeActor = currentActor(state)?.id;
  const next = dispatch(state, action);

  if (isFreeOfTheTurn(action)) return next;

  // A move that was meant to end the turn and did not is a rejected one, so
  // fall back to something that always progresses. Keep `next`, not `state`:
  // whatever the attempt did manage should not be silently rolled back.
  if (next.phase === beforePhase && currentActor(next)?.id === beforeActor) {
    return beforePhase === 'placement'
      ? dispatch(next, { type: 'confirmPlacement', plan: {} })
      : dispatch(next, { type: 'standard', action: 'pass' });
  }
  return next;
}
