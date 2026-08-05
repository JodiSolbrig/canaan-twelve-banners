/**
 * End-to-end smoke tests: drive complete games through `dispatch` with the bot
 * chooser in every seat and assert the invariants that must never break.
 */
import { describe, expect, it } from 'vitest';
import { chooseBotAction } from '../ai/bots';
import { CRISIS_CARDS } from '../data/gameData';
import { createGame } from './createGame';
import { currentActor } from './helpers';
import { dispatch } from './index';
import type { GameState, TribeId } from './types';

const ALL_TRIBES: TribeId[] = [
  'Judah',
  'Benjamin',
  'Levi',
  'Ephraim',
  'Manasseh',
  'Reuben',
  'Simeon',
  'Dan',
  'Naphtali',
  'Gad',
  'Asher',
  'Issachar',
  'Zebulun',
];

function playToEnd(state: GameState, maxSteps = 4000): GameState {
  let s = state;
  for (let step = 0; step < maxSteps; step++) {
    if (s.phase === 'gameEnd') return s;

    if (s.phase === 'crisisReveal' || s.phase === 'resolve') {
      s = dispatch(s, { type: 'advance' });
      continue;
    }

    // Pre-resolve: let the bots spend anything worth spending, then score.
    if (s.phase === 'preResolve') {
      const choice = chooseBotAction(s);
      s = choice ? dispatch(s, choice) : dispatch(s, { type: 'advance' });
      continue;
    }

    if (s.phase === 'crisisChoice') {
      const choice = chooseBotAction(s);
      if (!choice) throw new Error('No bot resolution for the Angel of the Lord');
      s = dispatch(s, choice);
      continue;
    }

    const action = chooseBotAction({
      ...s,
      // Treat every seat as a bot so the whole table plays itself.
      players: s.players.map((p) => ({ ...p, isHuman: false })),
    });

    const before = s;
    s = action ? dispatch(s, action) : s;

    if (s === before || (s.phase === before.phase && currentActor(s)?.id === currentActor(before)?.id)) {
      // Never let a rejected action stall the round — same fallback the UI uses.
      s =
        before.phase === 'placement'
          ? dispatch(before, { type: 'confirmPlacement', plan: {} })
          : dispatch(before, { type: 'standard', action: 'pass' });
    }
  }
  throw new Error(`Game did not finish within ${maxSteps} steps`);
}

function assertInvariants(s: GameState) {
  for (const p of s.players) {
    for (const [key, value] of Object.entries(p.resources)) {
      expect(Number.isInteger(value), `${p.tribe} ${key} is an integer`).toBe(true);
      expect(value, `${p.tribe} ${key} is not negative`).toBeGreaterThanOrEqual(0);
    }
    expect(p.resources.loyalty).toBeLessThanOrEqual(
      Math.max(p.startingLoyalty, p.resources.loyalty),
    );
    expect(p.leaderLevel).toBeGreaterThanOrEqual(0);
    expect(p.leaderLevel).toBeLessThanOrEqual(3);
  }
  expect(s.covenant).toBeGreaterThanOrEqual(0);
  expect(s.covenant).toBeLessThanOrEqual(s.tuningSnapshot.covenantMax);

  // No Crisis card is ever lost or duplicated.
  const all = [
    ...s.crisisDeck,
    ...s.crisisDiscard,
    ...(s.activeCrisis ? [s.activeCrisis] : []),
  ].map((c) => c.id);
  expect(new Set(all).size).toBe(all.length);
  expect(all).toHaveLength(CRISIS_CARDS.length);
}

describe('full game simulation', () => {
  for (const seed of [1, 7, 42, 1234, 99999]) {
    it(`completes a 4-player game and holds its invariants (seed ${seed})`, () => {
      const game = createGame({ humanTribe: 'Judah', totalPlayers: 4, seed });
      const end = playToEnd(game);

      expect(end.phase).toBe('gameEnd');
      expect(end.winners?.length).toBeGreaterThanOrEqual(1);
      assertInvariants(end);
    });
  }

  it('completes a 2-player game', () => {
    const end = playToEnd(createGame({ humanTribe: 'Levi', totalPlayers: 2, seed: 5 }));
    expect(end.phase).toBe('gameEnd');
    assertInvariants(end);
  });

  it('completes a 6-player game', () => {
    const end = playToEnd(createGame({ humanTribe: 'Asher', totalPlayers: 6, seed: 11 }));
    expect(end.phase).toBe('gameEnd');
    assertInvariants(end);
  });

  it('completes a game with the free placement phase turned off', () => {
    const game = createGame({
      humanTribe: 'Zebulun',
      totalPlayers: 4,
      seed: 3,
      tuning: {
        ...structuredClone(createGame({ humanTribe: 'Judah', totalPlayers: 2 }).tuningSnapshot),
        freePlacementPhase: false,
      },
    });
    expect(game.phase).toBe('crisisReveal');
    const end = playToEnd(game);
    expect(end.phase).toBe('gameEnd');
    assertInvariants(end);
  });

  it('never advances a round past the configured maximum', () => {
    const end = playToEnd(createGame({ humanTribe: 'Gad', totalPlayers: 5, seed: 21 }));
    expect(end.round).toBeLessThanOrEqual(end.maxRounds);
  });

  it('runs every tribe as the lead player without error', () => {
    for (const tribe of ALL_TRIBES) {
      const end = playToEnd(createGame({ humanTribe: tribe, totalPlayers: 3, seed: 8 }));
      expect(end.phase, `${tribe} finished`).toBe('gameEnd');
      assertInvariants(end);
    }
  });
});
