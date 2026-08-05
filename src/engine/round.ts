/**
 * Round lifecycle: reset per-round flags, grant income (rounds 2+), draw Crisis.
 *
 * Called from `createGame` (round 1) and `resolve` (subsequent rounds).
 * Kept separate from createGame so resolve does not import setup code.
 */
import { CRISIS_CARDS, TRACK_LABELS } from '../data/gameData';
import { OPPRESSOR_BY_ID } from '../data/oppressors';
import {
  addLog,
  applyRoundIncome,
  cryThreshold,
  mulberry32,
  openingPhase,
  oppressionSeverity,
  shuffle,
} from './helpers';
import type { GameState } from './types';

/** Prepare state for the current `state.round` and enter crisisReveal (or crisisChoice). */
export function startRound(state: GameState): GameState {
  let s: GameState = {
    ...state,
    tokens: [],
    trackResults: null,
    firstChampionId: null,
    gloryFromChampionsThisRound: {},
    pendingCrisisChoice: null,
    activeCrisis: null,
    players: state.players.map((p) => ({
      ...p,
      oncePerRoundUsed: {},
      standFirm: false,
      covenantProtect: false,
      holdTheLine: false,
      pendingZoneUnique: null,
      judgeArmed: null,
      rescueArmed: false,
      alliance: null,
      peekedCrisis: null,
    })),
  };

  // Starting resources cover round 1; income begins on round 2.
  if (s.round > 1) {
    s = applyRoundIncome(s);
  }

  // "And the land had rest." The round after a deliverance draws no Crisis; the
  // tribes simply collect and rebuild.
  if (s.restRound) {
    s = { ...s, restRound: false, activeCrisis: null };
    s = addLog(
      s,
      `Round ${s.round}: the land had rest — no Crisis this round.`,
      'good',
    );
    return { ...s, phase: openingPhase(s), currentActorIndex: 0 };
  }

  // A standing oppression holds the Crisis slot instead of a card being drawn,
  // and presses harder for every round it has been endured.
  const oppression = s.oppression;
  if (oppression) {
    const def = OPPRESSOR_BY_ID[oppression.oppressorId];
    const severity = oppressionSeverity(s);
    s = { ...s, activeCrisis: null };
    s = addLog(
      s,
      `Round ${s.round}: still under ${def.title} (severity ${severity}) — ` +
        `${TRACK_LABELS[def.attacks]} threshold +${severity}. ` +
        `The Cry needs ${cryThreshold(s)} Faith; ${oppression.cryPool} given.`,
      'crisis',
    );
    return { ...s, phase: 'crisisReveal', currentActorIndex: 0 };
  }

  if (s.crisisDeck.length === 0) {
    s = {
      ...s,
      crisisDeck: shuffle(
        [...s.crisisDiscard],
        mulberry32(s.seed + s.round * 17),
      ),
      crisisDiscard: [],
    };
  }

  // Fallback if the design deck is empty (should not happen with CRISIS_CARDS).
  if (s.crisisDeck.length === 0 && CRISIS_CARDS.length > 0) {
    s = {
      ...s,
      crisisDeck: shuffle([...CRISIS_CARDS], mulberry32(s.seed + s.round * 31)),
    };
  }

  const [card, ...rest] = s.crisisDeck;
  if (!card) {
    s = { ...s, phase: openingPhase(s), currentActorIndex: 0 };
    return addLog(s, 'No Crisis cards left — proceeding.', 'info');
  }

  s = {
    ...s,
    activeCrisis: card,
    crisisDeck: rest,
    phase: 'crisisReveal',
    currentActorIndex: 0,
  };
  s = addLog(s, `Round ${s.round}: Crisis — ${card.name}.`, 'crisis');

  // Angel of the Lord: human chooses top/bottom order + Covenant shift.
  if (card.id === 12) {
    const options = s.crisisDeck.slice(0, 2);
    if (options.length >= 2) {
      s = {
        ...s,
        phase: 'crisisChoice',
        pendingCrisisChoice: { type: 'angel', options },
      };
      s = addLog(
        s,
        'Angel of the Lord: choose deck order and Covenant shift.',
        'crisis',
      );
      return s;
    }
  }

  return s;
}
