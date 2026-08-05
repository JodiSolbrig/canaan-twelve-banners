import { describe, expect, it } from 'vitest';
import { TRIBE_BY_ID } from '../data/gameData';
import {
  applyCovenantDrop,
  applyLoyaltyLoss,
  applyRoundIncome,
  baseThreshold,
  checkLeaderUnlocks,
  compareStandings,
  covenantZone,
  grantGlory,
  rankPlayers,
} from './helpers';
import { idAt, patchPlayer, playerOf, scenario, setResources } from './testSupport';

describe('baseThreshold', () => {
  /** What the threshold should be for `n` players, straight from the config. */
  function expected(s: ReturnType<typeof scenario>, players: number): number {
    const t = s.tuningSnapshot;
    const base = t.thresholdBase === 'fixed' ? t.thresholdFixed : players;
    return base + (players <= 3 ? t.smallGroupThresholdBonus : 0) + t.thresholdBonus;
  }

  it('defaults to the player count', () => {
    const s = scenario({ tribes: ['Judah', 'Levi', 'Gad', 'Asher'], crisisId: null });
    expect(baseThreshold(s, 'military')).toBe(expected(s, 4));
  });

  it('adds the small-group bonus at 2–3 players', () => {
    const two = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const four = scenario({ tribes: ['Judah', 'Levi', 'Gad', 'Asher'], crisisId: null });
    expect(baseThreshold(two, 'moral')).toBe(expected(two, 2));
    // The bonus is what keeps a 2-player table from having a trivially low bar.
    expect(baseThreshold(two, 'moral') - 2).toBeGreaterThan(
      baseThreshold(four, 'moral') - 4,
    );
  });

  it('honours the fixed-threshold mode', () => {
    const s = scenario({
      tribes: ['Judah', 'Levi', 'Gad', 'Asher'],
      tuning: { thresholdBase: 'fixed', thresholdFixed: 6 },
      crisisId: null,
    });
    expect(baseThreshold(s, 'provision')).toBe(6 + s.tuningSnapshot.thresholdBonus);
  });

  it('raises Provision by 1 under Midianite Swarms', () => {
    const s = scenario({ tribes: ['Judah', 'Levi', 'Gad', 'Asher'], crisisId: 2 });
    expect(baseThreshold(s, 'provision')).toBe(expected(s, 4) + 1);
    expect(baseThreshold(s, 'military')).toBe(expected(s, 4));
  });

  it('raises Military and Moral by 1 under the Ammonite Claim', () => {
    const s = scenario({ tribes: ['Judah', 'Levi', 'Gad', 'Asher'], crisisId: 6 });
    expect(baseThreshold(s, 'military')).toBe(expected(s, 4) + 1);
    expect(baseThreshold(s, 'moral')).toBe(expected(s, 4) + 1);
    expect(baseThreshold(s, 'provision')).toBe(expected(s, 4));
  });
});

describe('covenantZone', () => {
  const t = scenario({ tribes: ['Judah', 'Levi'] }).tuningSnapshot;

  it('matches the published thresholds', () => {
    for (const v of [8, 9, 10]) expect(covenantZone(v, t)).toBe('strength');
    for (const v of [4, 5, 6, 7]) expect(covenantZone(v, t)).toBe('warning');
    for (const v of [1, 2, 3]) expect(covenantZone(v, t)).toBe('judgment');
    expect(covenantZone(0, t)).toBe('broken');
  });

  it('leaves no gap or overlap between the bands', () => {
    const seen = new Set<string>();
    for (let v = 0; v <= t.covenantMax; v++) seen.add(covenantZone(v, t));
    expect(seen).toEqual(new Set(['broken', 'judgment', 'warning', 'strength']));
    // Every band boundary is ordered.
    expect(t.zoneJudgmentMin).toBeLessThan(t.zoneWarningMin);
    expect(t.zoneWarningMin).toBeLessThan(t.zoneStrengthMin);
  });
});

describe('grantGlory and leader unlocks', () => {
  it('unlocks level I at the first threshold', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'] });
    const judah = idAt(s, 0);
    s = grantGlory(s, judah, 3, false);
    expect(playerOf(s, judah).leaderLevel).toBe(1);
  });

  it('jumps multiple levels from a single grant', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'] });
    const judah = idAt(s, 0);
    s = grantGlory(s, judah, 9, false);
    expect(playerOf(s, judah).resources.glory).toBe(9);
    expect(playerOf(s, judah).leaderLevel).toBe(3);
  });

  it('does not unlock below the threshold', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'] });
    const judah = idAt(s, 0);
    s = grantGlory(s, judah, 2, false);
    expect(playerOf(s, judah).leaderLevel).toBe(0);
  });

  it('caps Champion Glory at 1 per round under "No King"', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: 14 });
    const judah = idAt(s, 0);
    s = grantGlory(s, judah, 1, true);
    s = grantGlory(s, judah, 1, true); // e.g. Othniel I on top of the base reward
    expect(playerOf(s, judah).resources.glory).toBe(1);
  });

  it('leaves non-Champion Glory uncapped under "No King"', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: 14 });
    const judah = idAt(s, 0);
    s = grantGlory(s, judah, 1, true);
    s = grantGlory(s, judah, 2, false); // Day of Midian / Raid style rewards
    expect(playerOf(s, judah).resources.glory).toBe(3);
  });

  it('grants Ephraim a permanent income bonus rather than a one-off Goods', () => {
    let s = scenario({ tribes: ['Ephraim', 'Levi'] });
    const ephraim = idAt(s, 0);
    const goodsBefore = playerOf(s, ephraim).resources.goods;
    s = grantGlory(s, ephraim, 6, false);
    expect(playerOf(s, ephraim).leaderLevel).toBe(2);
    expect(playerOf(s, ephraim).resources.goods).toBe(goodsBefore);
    expect(playerOf(s, ephraim).incomeBonus.goods).toBe(1);
  });

  it('is idempotent when re-checked at the same Glory', () => {
    let s = scenario({ tribes: ['Ephraim', 'Levi'] });
    const ephraim = idAt(s, 0);
    s = grantGlory(s, ephraim, 6, false);
    s = checkLeaderUnlocks(s, ephraim);
    s = checkLeaderUnlocks(s, ephraim);
    expect(playerOf(s, ephraim).incomeBonus.goods).toBe(1);
  });
});

describe('applyRoundIncome', () => {
  it('is not applied on round 1, so printed starting resources stand', () => {
    const s = scenario({ tribes: ['Levi', 'Asher'] });
    const levi = playerOf(s, idAt(s, 0));
    const def = TRIBE_BY_ID.Levi;
    expect(s.round).toBe(1);
    expect(levi.resources.faith).toBe(def.faith);
    expect(levi.resources.warriors).toBe(def.warriors);
    expect(levi.resources.goods).toBe(def.goods);
  });

  it('pays the tribe income line', () => {
    let s = scenario({ tribes: ['Levi', 'Asher'] });
    const levi = idAt(s, 0);
    const before = playerOf(s, levi).resources.faith;
    s = applyRoundIncome(s);
    // Levi's income is 2 Faith.
    expect(playerOf(s, levi).resources.faith).toBe(before + 2);
  });

  it('adds any permanent income bonus', () => {
    let s = scenario({ tribes: ['Ephraim', 'Asher'] });
    const ephraim = idAt(s, 0);
    s = patchPlayer(s, ephraim, {
      incomeBonus: { faith: 0, warriors: 0, goods: 1 },
    });
    const before = playerOf(s, ephraim).resources.goods;
    s = applyRoundIncome(s);
    // Ephraim's printed income is 1 Goods + 1 Faith, plus the Abdon bonus.
    expect(playerOf(s, ephraim).resources.goods).toBe(before + 2);
  });

  it('caps Loyalty income at the tribe starting value', () => {
    let s = scenario({ tribes: ['Manasseh', 'Asher'] });
    const manasseh = idAt(s, 0);
    // Manasseh starts at 5 Loyalty and earns 1 per round.
    expect(playerOf(s, manasseh).startingLoyalty).toBe(5);
    s = applyRoundIncome(s);
    expect(playerOf(s, manasseh).resources.loyalty).toBe(5);

    s = setResources(s, manasseh, { loyalty: 3 });
    s = applyRoundIncome(s);
    expect(playerOf(s, manasseh).resources.loyalty).toBe(4);
  });
});

describe('applyLoyaltyLoss', () => {
  it('subtracts the base amount', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const judah = idAt(s, 0);
    s = applyLoyaltyLoss(s, judah, 1, 'test');
    expect(playerOf(s, judah).resources.loyalty).toBe(2);
  });

  it('is blocked outright by Stand Firm, which is then spent', () => {
    let s = scenario({ tribes: ['Gad', 'Levi'], crisisId: null });
    const gad = idAt(s, 0);
    s = patchPlayer(s, gad, { standFirm: true });
    const before = playerOf(s, gad).resources.loyalty;
    s = applyLoyaltyLoss(s, gad, 2, 'test');
    expect(playerOf(s, gad).resources.loyalty).toBe(before);
    expect(playerOf(s, gad).standFirm).toBe(false);

    s = applyLoyaltyLoss(s, gad, 1, 'test');
    expect(playerOf(s, gad).resources.loyalty).toBe(before - 1);
  });

  it("reduces losses by 1 with Gad's Raider's Resolve", () => {
    let s = scenario({ tribes: ['Gad', 'Levi'], crisisId: null });
    const gad = idAt(s, 0);
    s = patchPlayer(s, gad, { leaderLevel: 1 });
    const before = playerOf(s, gad).resources.loyalty;
    s = applyLoyaltyLoss(s, gad, 1, 'test');
    expect(playerOf(s, gad).resources.loyalty).toBe(before);
  });

  it("adds 1 to every loss under the Levite's Concubine", () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: 10 });
    const judah = idAt(s, 0);
    s = applyLoyaltyLoss(s, judah, 1, 'test');
    expect(playerOf(s, judah).resources.loyalty).toBe(1);
  });

  it('still lets Stand Firm block an inflated loss', () => {
    let s = scenario({ tribes: ['Gad', 'Levi'], crisisId: 10 });
    const gad = idAt(s, 0);
    s = patchPlayer(s, gad, { standFirm: true });
    const before = playerOf(s, gad).resources.loyalty;
    s = applyLoyaltyLoss(s, gad, 1, 'test');
    expect(playerOf(s, gad).resources.loyalty).toBe(before);
  });

  it('floors Loyalty at zero', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const judah = idAt(s, 0);
    s = applyLoyaltyLoss(s, judah, 99, 'test');
    expect(playerOf(s, judah).resources.loyalty).toBe(0);
  });
});

describe('applyCovenantDrop', () => {
  it('drops by the given amount', () => {
    const s = applyCovenantDrop(
      scenario({ tribes: ['Judah', 'Levi'], covenant: 8, crisisId: null }),
      2,
      'test',
    );
    expect(s.covenant).toBe(6);
  });

  it("cancels the whole drop with Levi's Intercede, even a Judgment drop of 2", () => {
    let s = scenario({ tribes: ['Levi', 'Judah'], covenant: 4, crisisId: null });
    const levi = idAt(s, 0);
    s = patchPlayer(s, levi, { covenantProtect: true });
    s = applyCovenantDrop(s, 2, 'Moral failed');
    expect(s.covenant).toBe(4);
    expect(playerOf(s, levi).covenantProtect).toBe(false);
  });

  it('softens a failed-track drop by 1 with Hold the Line', () => {
    let s = scenario({ tribes: ['Manasseh', 'Judah'], covenant: 8, crisisId: null });
    const manasseh = idAt(s, 0);
    s = patchPlayer(s, manasseh, { holdTheLine: true });
    s = applyCovenantDrop(s, 2, 'Moral failed');
    expect(s.covenant).toBe(7);
  });

  it('does not apply Hold the Line to non-failure drops', () => {
    let s = scenario({ tribes: ['Manasseh', 'Judah'], covenant: 8, crisisId: null });
    const manasseh = idAt(s, 0);
    s = patchPlayer(s, manasseh, { holdTheLine: true });
    s = applyCovenantDrop(s, 1, 'No King in Israel');
    expect(s.covenant).toBe(7);
    expect(playerOf(s, manasseh).holdTheLine).toBe(true);
  });

  it('clamps at zero and logs the true starting value', () => {
    const s = applyCovenantDrop(
      scenario({ tribes: ['Judah', 'Levi'], covenant: 1, crisisId: null }),
      2,
      'test',
    );
    expect(s.covenant).toBe(0);
    expect(s.log[0]?.text).toContain('1 → 0');
  });
});

describe('standings order', () => {
  it('ranks by Glory, then Loyalty, then resources, then Championships', () => {
    let s = scenario({ tribes: ['Judah', 'Levi', 'Gad', 'Asher'], crisisId: null });
    const [a, b, c, d] = s.players.map((p) => p.id) as [string, string, string, string];

    s = setResources(s, a, { glory: 5, loyalty: 1, faith: 0, warriors: 0, goods: 0 });
    s = setResources(s, b, { glory: 9, loyalty: 0, faith: 0, warriors: 0, goods: 0 });
    s = setResources(s, c, { glory: 5, loyalty: 3, faith: 0, warriors: 0, goods: 0 });
    s = setResources(s, d, { glory: 1, loyalty: 9, faith: 0, warriors: 0, goods: 0 });

    expect(rankPlayers(s.players).map((p) => p.id)).toEqual([b, c, a, d]);
  });

  it('breaks a Glory+Loyalty tie on total remaining resources', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const [a, b] = s.players.map((p) => p.id) as [string, string];
    s = setResources(s, a, { glory: 4, loyalty: 2, faith: 1, warriors: 0, goods: 0 });
    s = setResources(s, b, { glory: 4, loyalty: 2, faith: 0, warriors: 3, goods: 0 });
    expect(rankPlayers(s.players)[0]?.id).toBe(b);
  });

  it('breaks a full tie on Championships', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const [a, b] = s.players.map((p) => p.id) as [string, string];
    s = setResources(s, a, { glory: 4, loyalty: 2, faith: 1, warriors: 1, goods: 1 });
    s = setResources(s, b, { glory: 4, loyalty: 2, faith: 1, warriors: 1, goods: 1 });
    s = patchPlayer(s, b, { championships: 2 });
    expect(rankPlayers(s.players)[0]?.id).toBe(b);
    expect(compareStandings(playerOf(s, a), playerOf(s, b))).toBeGreaterThan(0);
  });
});
