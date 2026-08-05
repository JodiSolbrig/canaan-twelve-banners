/**
 * The three powers written to replace upgrades that duplicated something already
 * in the game: Judah III (Claim the Field), Manasseh I (Spend Your Resilience)
 * and Levi II (The Tithe).
 *
 * Each reaches for a lever nothing else touches — rewriting what a token counts
 * as, spending Loyalty by choice, and being paid off another tribe's success —
 * so the tests below are mostly about the edges of those three new ideas.
 */
import { describe, expect, it } from 'vitest';
import { canSpendResilience, spendResilience } from './actions';
import { isBannerToken, TRACK_AFFINITY_RESOURCE } from './helpers';
import { dispatch } from './index';
import {
  applyClaimField,
  barredFromProvision,
  canClaimField,
  hasPreResolveChoice,
  resolveRound,
  supplyOnTrack,
} from './resolve';
import { startRound } from './round';
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
import type { GameState } from './types';

function at(tribe: string, level: number, phase: GameState['phase']) {
  const s = scenario({
    tribes: [tribe as never, 'Naphtali', 'Gad'],
    phase,
    crisisId: null,
    round: 3,
  });
  return patchPlayer(s, idAt(s, 0), { leaderLevel: level });
}

describe('Judah III — Claim the Field', () => {
  it('is locked until level III', () => {
    for (const level of [1, 2]) {
      let s = at('Judah', level, 'preResolve');
      s = withTokens(s, [
        { playerId: idAt(s, 0), track: 'moral', count: 2, paidWith: 'goods' },
      ]);
      expect(canClaimField(s, idAt(s, 0))).toBe(false);
    }
  });

  it('needs Supply of its own somewhere', () => {
    let s = at('Judah', 3, 'preResolve');
    const me = idAt(s, 0);
    expect(canClaimField(s, me)).toBe(false);
    // Banners are not Supply.
    s = withTokens(s, [{ playerId: me, track: 'military', count: 3 }]);
    expect(canClaimField(s, me)).toBe(false);
  });

  it('stands Supply up as Banners on the named track only', () => {
    let s = at('Judah', 3, 'preResolve');
    const me = idAt(s, 0);
    s = withTokens(s, [
      { playerId: me, track: 'moral', count: 2, paidWith: 'goods' },
      { playerId: me, track: 'provision', count: 2, paidWith: 'warriors' },
    ]);
    expect(supplyOnTrack(s, me, 'moral')).toBe(2);

    const out = applyClaimField(s, me, 'moral');

    expect(out.ok).toBe(true);
    expect(bannerTotal(out.state, me, 'moral')).toBe(2);
    // Provision was not named, so its Supply is untouched.
    expect(bannerTotal(out.state, me, 'provision')).toBe(0);
    expect(tokenTotal(out.state, me, 'provision')).toBe(2);
  });

  it('leaves gifted and temporary tokens as Supply', () => {
    let s = at('Judah', 3, 'preResolve');
    const me = idAt(s, 0);
    s = withTokens(s, [
      { playerId: me, track: 'moral', count: 1, paidWith: 'goods' },
    ]);
    // A gift from another tribe, standing on the same track.
    s = {
      ...s,
      tokens: [
        ...s.tokens,
        {
          id: 'gift-1',
          playerId: me,
          track: 'moral',
          value: 1,
          temporary: true,
          faceDown: false,
          paidWith: null,
        },
      ],
    };

    const out = applyClaimField(s, me, 'moral');

    expect(out.ok).toBe(true);
    // Only the one Judah paid for was promoted.
    expect(bannerTotal(out.state, me, 'moral')).toBe(1);
    expect(out.state.tokens.find((t) => t.id === 'gift-1')!.paidWith).toBeNull();
  });

  it('buys the failure penalty along with the Banners', () => {
    // Promoted Supply now has Judah's name on it, so a track that gives way
    // costs Loyalty it would not have cost before.
    let s = at('Judah', 3, 'preResolve');
    const me = idAt(s, 0);
    s = setResources(s, me, { loyalty: 4 });
    s = withTokens(s, [
      { playerId: me, track: 'moral', count: 1, paidWith: 'goods' },
    ]);

    const claimed = applyClaimField(s, me, 'moral').state;
    const resolved = resolveRound({ ...claimed, phase: 'resolve' });

    // Moral cannot have held on one token, so the Banner takes the penalty.
    expect(resolved.trackResults!.find((r) => r.track === 'moral')!.success).toBe(false);
    expect(playerOf(resolved, me).resources.loyalty).toBeLessThan(4);
  });

  it('is once per game', () => {
    let s = at('Judah', 3, 'preResolve');
    const me = idAt(s, 0);
    s = withTokens(s, [
      { playerId: me, track: 'moral', count: 1, paidWith: 'goods' },
      { playerId: me, track: 'provision', count: 1, paidWith: 'warriors' },
    ]);
    s = applyClaimField(s, me, 'moral').state;
    expect(canClaimField(s, me)).toBe(false);
    expect(applyClaimField(s, me, 'provision').ok).toBe(false);
  });
});

describe('Manasseh I — Spend Your Resilience', () => {
  it('is locked until level I and needs a Loyalty to spend', () => {
    expect(canSpendResilience(at('Manasseh', 0, 'placement'), idAt(at('Manasseh', 0, 'placement'), 0))).toBe(false);
    let broke = at('Manasseh', 1, 'placement');
    broke = setResources(broke, idAt(broke, 0), { loyalty: 0 });
    expect(canSpendResilience(broke, idAt(broke, 0))).toBe(false);
  });

  it('turns 1 Loyalty into 2 Supply', () => {
    let s = at('Manasseh', 1, 'placement');
    const me = idAt(s, 0);
    s = setResources(s, me, { loyalty: 4 });

    const out = spendResilience(s, me, 'military');

    expect(out.ok).toBe(true);
    expect(playerOf(out.state, me).resources.loyalty).toBe(3);
    expect(tokenTotal(out.state, me, 'military')).toBe(2);
    // Supply, not Banner — Loyalty musters nobody.
    expect(bannerTotal(out.state, me, 'military')).toBe(0);
    for (const t of out.state.tokens) expect(isBannerToken(t)).toBe(false);
  });

  it('stays Supply even on the track whose affinity it lands on', () => {
    let s = at('Manasseh', 1, 'placement');
    const me = idAt(s, 0);
    s = setResources(s, me, { loyalty: 4 });
    const out = spendResilience(s, me, 'provision');
    expect(bannerTotal(out.state, me, 'provision')).toBe(0);
    expect(TRACK_AFFINITY_RESOURCE.provision).toBe('goods');
  });

  it('is once per round and comes back next generation', () => {
    let s = at('Manasseh', 1, 'placement');
    const me = idAt(s, 0);
    s = setResources(s, me, { loyalty: 5 });
    s = spendResilience(s, me, 'military').state;
    expect(canSpendResilience(s, me)).toBe(false);

    const next = startRound({ ...s, round: s.round + 1 });
    expect(canSpendResilience(next, idAt(next, 0))).toBe(true);
  });

  it('does not spend the placement', () => {
    let s = at('Manasseh', 1, 'placement');
    const me = idAt(s, 0);
    s = setResources(s, me, { loyalty: 4 });
    const before = s.currentActorIndex;
    const after = dispatch(s, { type: 'spendResilience', track: 'moral' });
    expect(after.phase).toBe('placement');
    expect(after.currentActorIndex).toBe(before);
    expect(tokenTotal(after, me, 'moral')).toBe(2);
  });
});

describe('Levi II — The Tithe', () => {
  it('bars Levi from Provision only from level II', () => {
    expect(barredFromProvision(at('Levi', 1, 'resolve'), idAt(at('Levi', 1, 'resolve'), 0))).toBe(false);
    expect(barredFromProvision(at('Levi', 2, 'resolve'), idAt(at('Levi', 2, 'resolve'), 0))).toBe(true);
  });

  it('gives Provision to the next tribe even when Levi has the most Banners', () => {
    let s = at('Levi', 2, 'preResolve');
    const levi = idAt(s, 0);
    const rival = idAt(s, 1);
    s = withTokens(s, [
      { playerId: levi, track: 'provision', count: 5 },
      { playerId: rival, track: 'provision', count: 1 },
    ]);

    const out = resolveRound({ ...s, phase: 'resolve' });
    const provision = out.trackResults!.find((r) => r.track === 'provision')!;

    expect(provision.success).toBe(true);
    expect(provision.championId).toBe(rival);
  });

  it('leaves Provision without a Champion when only Levi banners it', () => {
    let s = at('Levi', 2, 'preResolve');
    const levi = idAt(s, 0);
    s = withTokens(s, [{ playerId: levi, track: 'provision', count: 6 }]);

    const out = resolveRound({ ...s, phase: 'resolve' });
    const provision = out.trackResults!.find((r) => r.track === 'provision')!;

    expect(provision.success).toBe(true);
    expect(provision.championId).toBeNull();
  });

  it('is paid 1 Goods out of the Champion’s own store, if Levi served there', () => {
    let s = at('Levi', 2, 'preResolve');
    const levi = idAt(s, 0);
    const rival = idAt(s, 1);
    s = setResources(s, levi, { goods: 0 });
    s = setResources(s, rival, { goods: 2 });
    s = withTokens(s, [
      { playerId: rival, track: 'provision', count: 6 },
      // Levi's own Supply on the track — the service the tithe is owed for.
      { playerId: levi, track: 'provision', count: 1, paidWith: 'faith' },
    ]);

    const out = resolveRound({ ...s, phase: 'resolve' });

    // Rival: 2 + 1 Champion reward − 1 tithe = 2. Levi: 0 + 1 tithe = 1
    // (plus spoil, since Levi supplied a track that held).
    expect(playerOf(out, rival).resources.goods).toBe(2);
    expect(playerOf(out, levi).resources.goods).toBeGreaterThanOrEqual(1);
  });

  it('is owed for service — a Levi absent from Provision collects nothing', () => {
    let s = at('Levi', 2, 'preResolve');
    const levi = idAt(s, 0);
    const rival = idAt(s, 1);
    s = setResources(s, levi, { goods: 0 });
    s = setResources(s, rival, { goods: 2 });
    // Levi placed nothing on Provision at all.
    s = withTokens(s, [{ playerId: rival, track: 'provision', count: 6 }]);

    const out = resolveRound({ ...s, phase: 'resolve' });

    expect(playerOf(out, levi).resources.goods).toBe(0);
    // The Champion keeps the whole reward.
    expect(playerOf(out, rival).resources.goods).toBe(3);
  });

  it('still lets Levi count toward the Provision threshold', () => {
    let s = at('Levi', 2, 'preResolve');
    const levi = idAt(s, 0);
    // Levi alone carries the track; it holds, it just has no Champion.
    s = withTokens(s, [
      { playerId: levi, track: 'provision', count: 6, paidWith: 'faith' },
    ]);
    const out = resolveRound({ ...s, phase: 'resolve' });
    expect(out.trackResults!.find((r) => r.track === 'provision')!.success).toBe(true);
  });
});

describe('the post-reveal window is offered at all', () => {
  /**
   * The app advances straight past `preResolve` when the human has nothing to
   * decide, so an ability missing from `hasPreResolveChoice` is unreachable in
   * play however well its panel renders. Both of these shipped that way.
   */
  it('offers the window for Claim the Field', () => {
    let s = at('Judah', 3, 'preResolve');
    const me = idAt(s, 0);
    expect(hasPreResolveChoice(s, me)).toBe(false);
    s = withTokens(s, [
      { playerId: me, track: 'moral', count: 1, paidWith: 'goods' },
    ]);
    expect(canClaimField(s, me)).toBe(true);
    expect(hasPreResolveChoice(s, me)).toBe(true);
  });

  it('offers the window for Wise Counsel', () => {
    let s = at('Issachar', 3, 'preResolve');
    const me = idAt(s, 0);
    expect(hasPreResolveChoice(s, me)).toBe(false);
    s = withTokens(s, [{ playerId: idAt(s, 1), track: 'military', count: 1 }]);
    expect(hasPreResolveChoice(s, me)).toBe(true);
  });
});

describe('opening leader level', () => {
  it('is settled at setup, so a zero threshold is honoured from round 1', () => {
    // checkLeaderUnlocks used to run only when Glory was granted, so thresholds
    // of 0 left every tribe at level 0 until someone first scored.
    const s = scenario({
      tribes: ['Judah', 'Levi'],
      tuning: { leaderUnlockGlory: [0, 0, 0] },
    });
    for (const p of s.players) expect(p.leaderLevel).toBe(3);
  });

  it('leaves everyone at level 0 under the shipped thresholds', () => {
    const s = scenario({ tribes: ['Judah', 'Levi'] });
    for (const p of s.players) expect(p.leaderLevel).toBe(0);
  });
});
