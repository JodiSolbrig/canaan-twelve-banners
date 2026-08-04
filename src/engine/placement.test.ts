import { describe, expect, it } from 'vitest';
import { getTrackTotals } from './helpers';
import { applyPlacement } from './placement';
import { resolveRound } from './resolve';
import {
  idAt,
  patchPlayer,
  playerOf,
  scenario,
  setResources,
  tokenTotal,
  withTokens,
} from './testSupport';

describe('applyPlacement — cost', () => {
  it('spends one resource per token, preferring the track affinity', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 3, warriors: 3, goods: 3 });

    s = applyPlacement(s, me, { military: 2, moral: 1, provision: 1 });

    const p = playerOf(s, me);
    expect(p.resources.warriors).toBe(1); // 2 spent on Military
    expect(p.resources.faith).toBe(2); // 1 spent on Moral
    expect(p.resources.goods).toBe(2); // 1 spent on Provision
    expect(s.tokens.filter((t) => t.playerId === me)).toHaveLength(4);
  });

  it('places nothing and spends nothing when the plan is unaffordable', () => {
    let s = scenario({ tribes: ['Asher', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 1, warriors: 0, goods: 0 });

    const next = applyPlacement(s, me, { military: 3 });

    expect(next.tokens).toHaveLength(0);
    expect(playerOf(next, me).resources.faith).toBe(1);
  });

  it('falls back to other resources once the affinity resource runs out', () => {
    let s = scenario({ tribes: ['Asher', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 1, goods: 2 });

    s = applyPlacement(s, me, { military: 3 });

    const p = playerOf(s, me);
    expect(p.resources.warriors).toBe(0);
    expect(p.resources.goods).toBe(0);
    expect(tokenTotal(s, me, 'military')).toBe(3);
  });
});

describe('Crisis 1 — The High Places of Baal', () => {
  it('halves Faith spent on Moral, rounding down', () => {
    let s = scenario({ tribes: ['Levi', 'Judah'], crisisId: 1 });
    const levi = idAt(s, 0);
    s = setResources(s, levi, { faith: 5, warriors: 0, goods: 0 });

    s = applyPlacement(s, levi, { moral: 3 });

    // 3 Faith spent → floor(3/2) = 1 Influence.
    expect(tokenTotal(s, levi, 'moral')).toBe(1);
    // The token count still matches what was paid for.
    expect(s.tokens.filter((t) => t.playerId === levi)).toHaveLength(3);
  });

  it('leaves non-Faith Influence on Moral at full value', () => {
    let s = scenario({ tribes: ['Levi', 'Judah'], crisisId: 1 });
    const levi = idAt(s, 0);
    s = setResources(s, levi, { faith: 1, warriors: 0, goods: 2 });

    s = applyPlacement(s, levi, { moral: 3 });

    // 1 Faith (→ 0) + 2 Goods (→ 2).
    expect(tokenTotal(s, levi, 'moral')).toBe(2);
  });

  it('does not touch Faith spent on other tracks', () => {
    let s = scenario({ tribes: ['Levi', 'Judah'], crisisId: 1 });
    const levi = idAt(s, 0);
    s = setResources(s, levi, { faith: 4, warriors: 0, goods: 0 });

    s = applyPlacement(s, levi, { military: 2 });

    expect(tokenTotal(s, levi, 'military')).toBe(2);
  });

  it('never rewrites tokens belonging to an earlier state', () => {
    let s = scenario({ tribes: ['Levi', 'Judah'], crisisId: 1 });
    const levi = idAt(s, 0);
    s = setResources(s, levi, { faith: 6, warriors: 0, goods: 0 });

    const afterFirst = applyPlacement(s, levi, { moral: 2 });
    const snapshot = afterFirst.tokens.map((t) => ({ id: t.id, value: t.value }));

    const afterSecond = applyPlacement(afterFirst, levi, { moral: 4 });

    // The first placement's tokens must read the same as they did before.
    for (const { id, value } of snapshot) {
      expect(afterFirst.tokens.find((t) => t.id === id)?.value).toBe(value);
      expect(afterSecond.tokens.find((t) => t.id === id)?.value).toBe(value);
    }
    // 2 Faith → 1, then 4 Faith → 2.
    expect(tokenTotal(afterSecond, levi, 'moral')).toBe(3);
  });
});

describe('Crisis 3 — Iron Chariots of the North', () => {
  it('charges 1 extra Warrior per Military token', () => {
    let s = scenario({ tribes: ['Benjamin', 'Levi'], crisisId: 3 });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 5, goods: 0 });

    s = applyPlacement(s, me, { military: 2 });

    expect(playerOf(s, me).resources.warriors).toBe(1); // 2 paid + 2 surcharge
    expect(tokenTotal(s, me, 'military')).toBe(2);
  });

  it('reduces an unpaid token to zero Influence rather than negative', () => {
    let s = scenario({ tribes: ['Benjamin', 'Levi'], crisisId: 3 });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 1, goods: 0 });

    s = applyPlacement(s, me, { military: 1 });

    expect(tokenTotal(s, me, 'military')).toBe(0);
    expect(s.tokens.every((t) => t.value >= 0)).toBe(true);
  });

  it('leaves other tracks unsurcharged', () => {
    let s = scenario({ tribes: ['Benjamin', 'Levi'], crisisId: 3 });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 0, goods: 2 });

    s = applyPlacement(s, me, { provision: 2 });

    expect(tokenTotal(s, me, 'provision')).toBe(2);
    expect(playerOf(s, me).resources.goods).toBe(0);
  });
});

describe("Simeon's Furious Assault free Military tokens", () => {
  it('places a free token without spending resources', () => {
    let s = scenario({ tribes: ['Simeon', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 0, goods: 0 });
    s = patchPlayer(s, me, { freeMilitaryNextRound: 1 });

    s = applyPlacement(s, me, { military: 1 });

    expect(tokenTotal(s, me, 'military')).toBe(1);
    expect(playerOf(s, me).freeMilitaryNextRound).toBe(0);
  });

  it('keeps unused free tokens available later in the same round', () => {
    let s = scenario({ tribes: ['Simeon', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 0, goods: 0 });
    s = patchPlayer(s, me, { freeMilitaryNextRound: 2 });

    s = applyPlacement(s, me, { military: 1 });
    expect(playerOf(s, me).freeMilitaryNextRound).toBe(1);

    s = applyPlacement(s, me, { military: 1 });
    expect(tokenTotal(s, me, 'military')).toBe(2);
    expect(playerOf(s, me).freeMilitaryNextRound).toBe(0);
  });

  it('does not lose them when the player places on another track', () => {
    let s = scenario({ tribes: ['Simeon', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 0, goods: 2 });
    s = patchPlayer(s, me, { freeMilitaryNextRound: 1 });

    s = applyPlacement(s, me, { provision: 2 });

    expect(playerOf(s, me).freeMilitaryNextRound).toBe(1);
  });

  it('expires them at the end of the round they were usable in', () => {
    let s = scenario({ tribes: ['Simeon', 'Levi'], round: 2, crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { freeMilitaryNextRound: 1 });

    s = resolveRound(s);

    expect(playerOf(s, me).freeMilitaryNextRound).toBe(0);
  });
});

describe('placement-triggered leader bonuses', () => {
  it('arms and counts Judah Othniel II on a Military placement', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 2 });
    s = setResources(s, me, { faith: 0, warriors: 2, goods: 0 });

    s = applyPlacement(s, me, { military: 2 });

    expect(playerOf(s, me).oncePerRoundUsed['othnielII']).toBe(true);
    expect(getTrackTotals(s).military[me]).toBe(3); // 2 tokens + 1
  });

  it('does not arm Othniel II without a Military placement', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 2 });

    s = applyPlacement(s, me, { moral: 1 });

    expect(playerOf(s, me).oncePerRoundUsed['othnielII']).toBeUndefined();
  });

  it('counts the bonus only once across two placements in a round', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 2 });
    s = setResources(s, me, { faith: 0, warriors: 3, goods: 0 });

    s = applyPlacement(s, me, { military: 1 });
    s = applyPlacement(s, me, { military: 2 });

    expect(getTrackTotals(s).military[me]).toBe(4); // 3 tokens + 1
  });

  it('arms and counts Benjamin Ehud II on a Military placement', () => {
    let s = scenario({ tribes: ['Benjamin', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 2 });
    s = setResources(s, me, { faith: 0, warriors: 2, goods: 0 });

    s = applyPlacement(s, me, { military: 1 });

    expect(getTrackTotals(s).military[me]).toBe(2); // 1 token + 1
  });

  it('counts Dan Nazirite Strength at three or more Military tokens', () => {
    let s = scenario({ tribes: ['Dan', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 1 });

    const two = withTokens(s, [{ playerId: me, track: 'military', count: 2 }]);
    expect(getTrackTotals(two).military[me]).toBe(2);

    const three = withTokens(s, [{ playerId: me, track: 'military', count: 3 }]);
    expect(getTrackTotals(three).military[me]).toBe(4);
  });
});
