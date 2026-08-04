import { describe, expect, it } from 'vitest';
import { getTrackTotals } from './helpers';
import { applyPlacement } from './placement';
import { applyUniqueAction } from './actions';
import { resolveRound } from './resolve';
import {
  bannerTotal,
  idAt,
  patchPlayer,
  playerOf,
  scenario,
  setResources,
  tokenTotal,
  withTokens,
} from './testSupport';

describe('paying for a placement', () => {
  it('spends exactly the resources the plan names', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 3, warriors: 3, goods: 3 });

    s = applyPlacement(s, me, {
      military: { warriors: 2 },
      moral: { faith: 1 },
      provision: { goods: 1 },
    });

    const p = playerOf(s, me);
    expect(p.resources.warriors).toBe(1);
    expect(p.resources.faith).toBe(2);
    expect(p.resources.goods).toBe(2);
    expect(s.tokens.filter((t) => t.playerId === me)).toHaveLength(4);
  });

  it('places nothing and spends nothing when any resource falls short', () => {
    let s = scenario({ tribes: ['Asher', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 1, warriors: 0, goods: 5 });

    // The Goods half is affordable; the Warriors half is not. Neither happens.
    const next = applyPlacement(s, me, {
      provision: { goods: 2 },
      military: { warriors: 3 },
    });

    expect(next.tokens).toHaveLength(0);
    expect(playerOf(next, me).resources.goods).toBe(5);
  });

  it('lets a player spend one resource across several tracks', () => {
    let s = scenario({ tribes: ['Asher', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 0, goods: 4 });

    s = applyPlacement(s, me, {
      provision: { goods: 2 },
      military: { goods: 1 },
      moral: { goods: 1 },
    });

    expect(playerOf(s, me).resources.goods).toBe(0);
    expect(tokenTotal(s, me, 'provision')).toBe(2);
    expect(tokenTotal(s, me, 'military')).toBe(1);
    expect(tokenTotal(s, me, 'moral')).toBe(1);
  });
});

describe('Banner and Supply', () => {
  it('marks affinity-paid tokens as Banner', () => {
    let s = scenario({ tribes: ['Benjamin', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 3, goods: 0 });

    s = applyPlacement(s, me, { military: { warriors: 3 } });

    expect(tokenTotal(s, me, 'military')).toBe(3);
    expect(bannerTotal(s, me, 'military')).toBe(3);
    expect(getTrackTotals(s).banner.military[me]).toBe(3);
  });

  it('marks off-affinity tokens as Supply — threshold only, never Champion', () => {
    let s = scenario({ tribes: ['Asher', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 0, goods: 3 });

    s = applyPlacement(s, me, { military: { goods: 3 } });

    const tallies = getTrackTotals(s);
    expect(tallies.total.military[me]).toBe(3);
    expect(tallies.banner.military[me]).toBeUndefined();
    expect(bannerTotal(s, me, 'military')).toBe(0);
  });

  it('splits a mixed payment on one track', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 1, warriors: 2, goods: 1 });

    s = applyPlacement(s, me, { military: { warriors: 2, goods: 1, faith: 1 } });

    expect(tokenTotal(s, me, 'military')).toBe(4);
    expect(bannerTotal(s, me, 'military')).toBe(2);
  });

  it('re-judges a token against the track it is moved to', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 2, goods: 0 });
    s = applyPlacement(s, me, { military: { warriors: 2 } });
    expect(bannerTotal(s, me, 'military')).toBe(2);

    // Reposition a Warrior-paid token onto Moral: it becomes Supply there.
    const tokenId = s.tokens.find((t) => t.playerId === me)!.id;
    const moved = applyUniqueAction(s, me, {
      type: 'unique',
      tribe: 'Naphtali',
      tokenId,
      toTrack: 'moral',
    });

    expect(moved.ok).toBe(true);
    expect(tokenTotal(moved.state, me, 'moral')).toBe(1);
    expect(bannerTotal(moved.state, me, 'moral')).toBe(0);
    expect(bannerTotal(moved.state, me, 'military')).toBe(1);
  });
});

describe('Crisis 1 — The High Places of Baal', () => {
  it('halves Faith spent on Moral, rounding down', () => {
    let s = scenario({ tribes: ['Levi', 'Judah'], crisisId: 1 });
    const levi = idAt(s, 0);
    s = setResources(s, levi, { faith: 5, warriors: 0, goods: 0 });

    s = applyPlacement(s, levi, { moral: { faith: 3 } });

    expect(tokenTotal(s, levi, 'moral')).toBe(1);
    expect(s.tokens.filter((t) => t.playerId === levi)).toHaveLength(3);
  });

  it('bites Banner strength, since Faith is what Banners the Moral track', () => {
    let s = scenario({ tribes: ['Levi', 'Judah'], crisisId: 1 });
    const levi = idAt(s, 0);
    s = setResources(s, levi, { faith: 4, warriors: 0, goods: 0 });

    s = applyPlacement(s, levi, { moral: { faith: 4 } });

    expect(bannerTotal(s, levi, 'moral')).toBe(2);
  });

  it('leaves Supply on Moral at full value', () => {
    let s = scenario({ tribes: ['Levi', 'Judah'], crisisId: 1 });
    const levi = idAt(s, 0);
    s = setResources(s, levi, { faith: 1, warriors: 0, goods: 2 });

    s = applyPlacement(s, levi, { moral: { faith: 1, goods: 2 } });

    // 1 Faith halves to 0; 2 Goods stay at 2.
    expect(tokenTotal(s, levi, 'moral')).toBe(2);
    expect(bannerTotal(s, levi, 'moral')).toBe(0);
  });

  it('does not touch Faith spent on other tracks', () => {
    let s = scenario({ tribes: ['Levi', 'Judah'], crisisId: 1 });
    const levi = idAt(s, 0);
    s = setResources(s, levi, { faith: 4, warriors: 0, goods: 0 });

    s = applyPlacement(s, levi, { military: { faith: 2 } });

    expect(tokenTotal(s, levi, 'military')).toBe(2);
  });

  it('never rewrites tokens belonging to an earlier state', () => {
    let s = scenario({ tribes: ['Levi', 'Judah'], crisisId: 1 });
    const levi = idAt(s, 0);
    s = setResources(s, levi, { faith: 6, warriors: 0, goods: 0 });

    const first = applyPlacement(s, levi, { moral: { faith: 2 } });
    const snapshot = first.tokens.map((t) => ({ id: t.id, value: t.value }));
    const second = applyPlacement(first, levi, { moral: { faith: 4 } });

    for (const { id, value } of snapshot) {
      expect(first.tokens.find((t) => t.id === id)?.value).toBe(value);
      expect(second.tokens.find((t) => t.id === id)?.value).toBe(value);
    }
    expect(tokenTotal(second, levi, 'moral')).toBe(3);
  });
});

describe('Crisis 3 — Iron Chariots of the North', () => {
  it('charges 1 extra Warrior per Military token', () => {
    let s = scenario({ tribes: ['Benjamin', 'Levi'], crisisId: 3 });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 5, goods: 0 });

    s = applyPlacement(s, me, { military: { warriors: 2 } });

    expect(playerOf(s, me).resources.warriors).toBe(1);
    expect(tokenTotal(s, me, 'military')).toBe(2);
  });

  it('surcharges Supply tokens on Military too', () => {
    let s = scenario({ tribes: ['Asher', 'Levi'], crisisId: 3 });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 2, goods: 2 });

    s = applyPlacement(s, me, { military: { goods: 2 } });

    expect(playerOf(s, me).resources.goods).toBe(0);
    expect(playerOf(s, me).resources.warriors).toBe(0);
    expect(tokenTotal(s, me, 'military')).toBe(2);
  });

  it('reduces an unpayable token to zero rather than negative', () => {
    let s = scenario({ tribes: ['Benjamin', 'Levi'], crisisId: 3 });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 1, goods: 0 });

    s = applyPlacement(s, me, { military: { warriors: 1 } });

    expect(tokenTotal(s, me, 'military')).toBe(0);
    expect(s.tokens.every((t) => t.value >= 0)).toBe(true);
  });

  it('degrades Supply before Banner when the surcharge runs short', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: 3 });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 3, goods: 1 });

    // 2 Banner + 1 Supply = 3 tokens, needing 3 surcharge Warriors but only 1 left.
    s = applyPlacement(s, me, { military: { warriors: 2, goods: 1 } });

    expect(bannerTotal(s, me, 'military')).toBe(1);
    expect(tokenTotal(s, me, 'military')).toBe(1);
  });

  it('leaves other tracks unsurcharged', () => {
    let s = scenario({ tribes: ['Benjamin', 'Levi'], crisisId: 3 });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 0, goods: 2 });

    s = applyPlacement(s, me, { provision: { goods: 2 } });

    expect(tokenTotal(s, me, 'provision')).toBe(2);
    expect(playerOf(s, me).resources.goods).toBe(0);
  });
});

describe("Simeon's Furious Assault free Military tokens", () => {
  it('places them free, on top of the plan, as Banners', () => {
    let s = scenario({ tribes: ['Simeon', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 0, goods: 0 });
    s = patchPlayer(s, me, { freeMilitaryNextRound: 1 });

    s = applyPlacement(s, me, {});

    expect(tokenTotal(s, me, 'military')).toBe(1);
    expect(bannerTotal(s, me, 'military')).toBe(1);
    expect(playerOf(s, me).resources.warriors).toBe(0);
    expect(playerOf(s, me).freeMilitaryNextRound).toBe(0);
  });

  it('adds to a paid placement rather than replacing part of it', () => {
    let s = scenario({ tribes: ['Simeon', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 2, goods: 0 });
    s = patchPlayer(s, me, { freeMilitaryNextRound: 2 });

    s = applyPlacement(s, me, { military: { warriors: 2 } });

    expect(tokenTotal(s, me, 'military')).toBe(4);
    expect(playerOf(s, me).resources.warriors).toBe(0);
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
  it('arms Judah Othniel II on a Military Banner', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 2 });
    s = setResources(s, me, { faith: 0, warriors: 2, goods: 0 });

    s = applyPlacement(s, me, { military: { warriors: 2 } });

    expect(playerOf(s, me).oncePerRoundUsed['othnielII']).toBe(true);
    const tallies = getTrackTotals(s);
    expect(tallies.total.military[me]).toBe(3);
    expect(tallies.banner.military[me]).toBe(3);
  });

  it('does not arm it on Supply alone — the bonus rewards committing', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 2 });
    s = setResources(s, me, { faith: 0, warriors: 0, goods: 2 });

    s = applyPlacement(s, me, { military: { goods: 2 } });

    expect(playerOf(s, me).oncePerRoundUsed['othnielII']).toBeUndefined();
    expect(getTrackTotals(s).total.military[me]).toBe(2);
  });

  it('counts the bonus only once across two placements in a round', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 2 });
    s = setResources(s, me, { faith: 0, warriors: 3, goods: 0 });

    s = applyPlacement(s, me, { military: { warriors: 1 } });
    s = applyPlacement(s, me, { military: { warriors: 2 } });

    expect(getTrackTotals(s).total.military[me]).toBe(4);
  });

  it('arms Benjamin Ehud II on a Military Banner', () => {
    let s = scenario({ tribes: ['Benjamin', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 2 });
    s = setResources(s, me, { faith: 0, warriors: 2, goods: 0 });

    s = applyPlacement(s, me, { military: { warriors: 1 } });

    expect(getTrackTotals(s).banner.military[me]).toBe(2);
  });

  it('counts Dan Nazirite Strength as Banner strength', () => {
    let s = scenario({ tribes: ['Dan', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 1 });

    const two = withTokens(s, [{ playerId: me, track: 'military', count: 2 }]);
    expect(getTrackTotals(two).banner.military[me]).toBe(2);

    const three = withTokens(s, [{ playerId: me, track: 'military', count: 3 }]);
    expect(getTrackTotals(three).total.military[me]).toBe(4);
    expect(getTrackTotals(three).banner.military[me]).toBe(4);
  });
});
