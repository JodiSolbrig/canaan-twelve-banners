/**
 * The cycle of Judges: Oppression → Cry → Deliverance → Rest.
 */
import { describe, expect, it } from 'vitest';
import { OPPRESSOR_BY_ID } from '../data/oppressors';
import { applyStandardAction } from './actions';
import { baseThreshold, cryThreshold, oppressionSeverity } from './helpers';
import { advanceToNextRound, resolveRound } from './resolve';
import {
  carryAllTracks,
  idAt,
  playerOf,
  scenario,
  setResources,
  withOppression,
} from './testSupport';
import type { GameState, TribeId } from './types';

/** Resolve a round in which nothing fails, so the Covenant stays put. */
function quietRound(state: GameState, carrier: string): GameState {
  return resolveRound(carryAllTracks(state, carrier));
}

describe('falling under an Oppressor', () => {
  it('sells Israel into a hand when the Covenant reaches Judgment', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 4, crisisId: null });
    expect(s.oppression).toBeNull();

    s = quietRound(s, idAt(s, 0));

    expect(s.covenant).toBe(4);
    expect(s.oppression).not.toBeNull();
    expect(s.oppression?.roundsEndured).toBe(0);
    expect(s.oppression?.cryPool).toBe(0);
    expect(oppressionSeverity(s)).toBe(1);
  });

  it('leaves Israel free while the Covenant holds above Judgment', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 8, crisisId: null });
    s = quietRound(s, idAt(s, 0));
    expect(s.oppression).toBeNull();
  });

  it('draws each Oppressor once before repeating', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 4, crisisId: null });
    const before = s.oppressorDeck.length;
    s = quietRound(s, idAt(s, 0));
    expect(s.oppressorDeck).toHaveLength(before - 1);
    expect(s.oppressorDeck).not.toContain(s.oppression?.oppressorId);
  });

  it('can be switched off entirely by tuning', () => {
    let s = scenario({
      tribes: ['Judah', 'Levi'],
      covenant: 4,
      crisisId: null,
      tuning: { oppressionEnabled: false },
    });
    s = quietRound(s, idAt(s, 0));
    expect(s.oppression).toBeNull();
  });
});

describe('enduring an Oppressor', () => {
  it('presses on the track its account names', () => {
    const s = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], crisisId: null }),
      'midian', // attacks Provision
    );
    const base = 3; // 2 players + small-group bonus
    expect(baseThreshold(s, 'provision')).toBe(base + 1);
    expect(baseThreshold(s, 'military')).toBe(base);
    expect(baseThreshold(s, 'moral')).toBe(base);
  });

  it('presses harder for every round endured', () => {
    const s = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], crisisId: null }),
      'midian',
      { roundsEndured: 3 },
    );
    expect(oppressionSeverity(s)).toBe(4);
    expect(baseThreshold(s, 'provision')).toBe(3 + 4);
  });

  it('tightens its grip at the end of a round it survives', () => {
    let s = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], covenant: 8, crisisId: null }),
      'midian',
    );
    expect(s.oppression?.roundsEndured).toBe(0);

    s = quietRound(s, idAt(s, 0));
    expect(s.oppression?.roundsEndured).toBe(1);

    s = quietRound(s, idAt(s, 0));
    expect(s.oppression?.roundsEndured).toBe(2);
  });

  it('makes the Cry dearer as it endures', () => {
    const fresh = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], crisisId: null }),
      'midian',
    );
    const worn = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], crisisId: null }),
      'midian',
      { roundsEndured: 3 },
    );
    const t = fresh.tuningSnapshot;
    // One per player, plus one, plus one per round endured.
    expect(cryThreshold(fresh)).toBe(t.cryThresholdBase + t.cryThresholdPerPlayer * 2);
    expect(cryThreshold(worn)).toBe(
      t.cryThresholdBase + t.cryThresholdPerPlayer * 2 + t.cryThresholdPerRound * 3,
    );
    expect(cryThreshold(worn)).toBeGreaterThan(cryThreshold(fresh));
  });

  it('always asks for whole Faith, at every table size', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const tribes = [
        'Judah', 'Levi', 'Asher', 'Benjamin', 'Naphtali', 'Gad',
      ].slice(0, n) as TribeId[];
      const s = withOppression(scenario({ tribes, crisisId: null }), 'midian');
      const need = cryThreshold(s);
      expect(Number.isInteger(need)).toBe(true);
      expect(need).toBe(n + 1);
    }
  });

  it('holds the Crisis slot instead of a card being drawn', () => {
    let s = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], covenant: 8, crisisId: null }),
      'midian',
    );
    s = quietRound(s, idAt(s, 0));
    s = advanceToNextRound(s);

    expect(s.activeCrisis).toBeNull();
    expect(s.oppression).not.toBeNull();
    expect(s.phase).toBe('crisisReveal');
  });
});

describe('crying out', () => {
  it('pays Faith into the shared pool and records who gave', () => {
    let s = withOppression(
      scenario({ tribes: ['Levi', 'Judah'], crisisId: null }),
      'midian',
    );
    const levi = idAt(s, 0);

    const r = applyStandardAction(s, levi, {
      type: 'standard',
      action: 'cryOut',
      cryFaith: 3,
    });

    expect(r.ok).toBe(true);
    expect(playerOf(r.state, levi).resources.faith).toBe(2); // Levi starts on 5
    expect(r.state.oppression?.cryPool).toBe(3);
    expect(r.state.oppression?.contributors[levi]).toBe(3);
  });

  it('accumulates across players and rounds', () => {
    let s = withOppression(
      scenario({ tribes: ['Levi', 'Issachar'], crisisId: null }),
      'midian',
    );
    const [levi, issachar] = s.players.map((p) => p.id) as [string, string];

    s = applyStandardAction(s, levi, { type: 'standard', action: 'cryOut', cryFaith: 2 }).state;
    s = applyStandardAction(s, issachar, { type: 'standard', action: 'cryOut', cryFaith: 1 }).state;

    expect(s.oppression?.cryPool).toBe(3);
  });

  it('is refused when there is nothing to cry out against', () => {
    const s = scenario({ tribes: ['Levi', 'Judah'], crisisId: null });
    const r = applyStandardAction(s, idAt(s, 0), {
      type: 'standard',
      action: 'cryOut',
      cryFaith: 1,
    });
    expect(r.ok).toBe(false);
  });

  it('is refused for more Faith than the player holds, and for none', () => {
    let s = withOppression(
      scenario({ tribes: ['Levi', 'Judah'], crisisId: null }),
      'midian',
    );
    const levi = idAt(s, 0);
    s = setResources(s, levi, { faith: 1 });

    expect(
      applyStandardAction(s, levi, { type: 'standard', action: 'cryOut', cryFaith: 2 }).ok,
    ).toBe(false);
    expect(
      applyStandardAction(s, levi, { type: 'standard', action: 'cryOut', cryFaith: 0 }).ok,
    ).toBe(false);
  });
});

describe('deliverance', () => {
  function delivered() {
    let s = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], covenant: 4, crisisId: null }),
      'midian',
      { cryPool: 4 }, // 2 players x 2 = threshold met
    );
    return quietRound(s, idAt(s, 0));
  }

  it('breaks the oppression and restores the Covenant', () => {
    const s = delivered();
    expect(s.oppression).toBeNull();
    expect(s.covenant).toBe(s.tuningSnapshot.covenantStart);
  });

  it('raises up the least among them, not the biggest giver', () => {
    let s = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], covenant: 4, crisisId: null }),
      'midian',
      { cryPool: 4 },
    );
    const [judah, levi] = s.players.map((p) => p.id) as [string, string];
    // Judah is ahead; Levi is the least.
    s = setResources(s, judah, { glory: 6 });
    s = setResources(s, levi, { glory: 1 });

    s = quietRound(s, judah);

    expect(playerOf(s, levi).judgeships).toBe(1);
    expect(playerOf(s, judah).judgeships).toBe(0);
    expect(playerOf(s, levi).resources.glory).toBe(1 + s.tuningSnapshot.judgeGlory);
  });

  it('breaks a tie on Glory by lower Loyalty', () => {
    let s = withOppression(
      scenario({ tribes: ['Judah', 'Naphtali'], covenant: 4, crisisId: null }),
      'midian',
      { cryPool: 4 },
    );
    const [judah, naphtali] = s.players.map((p) => p.id) as [string, string];
    s = setResources(s, judah, { glory: 2, loyalty: 1 });
    s = setResources(s, naphtali, { glory: 2, loyalty: 4 });

    s = quietRound(s, naphtali);

    expect(playerOf(s, judah).judgeships).toBe(1);
  });

  it('hands the Judge the one-shot of the oppression they broke', () => {
    const s = delivered();
    const judge = s.players.find((p) => p.judgeships > 0);
    expect(judge?.judgePower).toBe('midian');
    expect(OPPRESSOR_BY_ID.midian.deliverer).toBe('Gideon');
  });

  it('does not sell Israel again in the same breath', () => {
    // The Covenant was in Judgment when the round began; deliverance restores it
    // before the Judgment test, so no new Oppressor may arrive.
    const s = delivered();
    expect(s.oppression).toBeNull();
  });

  it('sets the round of rest', () => {
    const s = delivered();
    expect(s.restRound).toBe(true);
  });

  it('skips the rest round when tuning says so', () => {
    let s = withOppression(
      scenario({
        tribes: ['Judah', 'Levi'],
        covenant: 4,
        crisisId: null,
        tuning: { restAfterDeliverance: false },
      }),
      'midian',
      { cryPool: 4 },
    );
    s = quietRound(s, idAt(s, 0));
    expect(s.restRound).toBe(false);
  });
});

describe('the land had rest', () => {
  it('draws no Crisis and still pays income', () => {
    let s = withOppression(
      scenario({ tribes: ['Levi', 'Judah'], covenant: 4, crisisId: null }),
      'midian',
      { cryPool: 4 },
    );
    const levi = idAt(s, 0);
    s = quietRound(s, levi);
    expect(s.restRound).toBe(true);

    const faithBefore = playerOf(s, levi).resources.faith;
    s = advanceToNextRound(s);

    expect(s.activeCrisis).toBeNull();
    expect(s.restRound).toBe(false);
    // Levi's income is 2 Faith.
    expect(playerOf(s, levi).resources.faith).toBe(faithBefore + 2);
  });

  it('counts toward the round total rather than extending the game', () => {
    let s = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], covenant: 4, crisisId: null }),
      'midian',
      { cryPool: 4 },
    );
    const roundBefore = s.round;
    s = quietRound(s, idAt(s, 0));
    s = advanceToNextRound(s);
    expect(s.round).toBe(roundBefore + 1);
  });

  it('returns to normal Crisis draws the round after', () => {
    let s = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], covenant: 4, crisisId: null }),
      'midian',
      { cryPool: 4 },
    );
    s = quietRound(s, idAt(s, 0));
    s = advanceToNextRound(s); // rest
    expect(s.activeCrisis).toBeNull();

    s = quietRound(s, idAt(s, 0));
    s = advanceToNextRound(s);
    expect(s.activeCrisis).not.toBeNull();
  });
});

describe('a second cycle', () => {
  it('summons a different Oppressor after the Covenant falls again', () => {
    let s = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], covenant: 4, crisisId: null }),
      'midian',
      { cryPool: 4 },
    );
    s = quietRound(s, idAt(s, 0));
    const first = 'midian';
    expect(s.oppression).toBeNull();

    // Drive the meter back into Judgment.
    s = { ...s, covenant: 4, restRound: false };
    s = quietRound(s, idAt(s, 0));

    expect(s.oppression).not.toBeNull();
    expect(s.oppression?.oppressorId).not.toBe(first);
  });

  it('carries no Cry over from the oppression before it', () => {
    let s = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], covenant: 4, crisisId: null }),
      'midian',
      { cryPool: 9 },
    );
    s = quietRound(s, idAt(s, 0));
    s = { ...s, covenant: 4, restRound: false };
    s = quietRound(s, idAt(s, 0));

    expect(s.oppression?.cryPool).toBe(0);
  });
});

describe('interaction with the Broken Covenant clock', () => {
  it('still ends the game if the meter collapses while oppressed', () => {
    let s = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], covenant: 1, round: 2, crisisId: null }),
      'midian',
    );
    s = quietRound(s, idAt(s, 0));
    expect(s.brokenClock).toBe(true);
  });

  it('leaves the oppression standing through the final round', () => {
    let s = withOppression(
      scenario({ tribes: ['Judah', 'Levi'], covenant: 1, round: 2, crisisId: null }),
      'midian',
    );
    s = quietRound(s, idAt(s, 0));
    expect(s.oppression).not.toBeNull();
  });
});

describe('every Oppressor is well formed', () => {
  it('names a track, a deliverer, and a one-shot', () => {
    for (const id of Object.keys(OPPRESSOR_BY_ID) as Array<keyof typeof OPPRESSOR_BY_ID>) {
      const def = OPPRESSOR_BY_ID[id];
      expect(['military', 'moral', 'provision']).toContain(def.attacks);
      expect(def.deliverer.length).toBeGreaterThan(0);
      expect(def.judgePower.length).toBeGreaterThan(0);
      expect(def.reference).toMatch(/^Judges \d+:\d+$/);
    }
  });
});
