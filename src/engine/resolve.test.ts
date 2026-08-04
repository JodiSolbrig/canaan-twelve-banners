import { describe, expect, it } from 'vitest';
import { endGame, resolveRound } from './resolve';
import {
  idAt,
  patchPlayer,
  playerOf,
  scenario,
  setResources,
  withTokens,
} from './testSupport';
import type { GameState, TrackId } from './types';

function trackResult(s: GameState, track: TrackId) {
  const r = s.trackResults?.find((x) => x.track === track);
  if (!r) throw new Error(`No result for ${track}`);
  return r;
}

describe('Champion determination', () => {
  it('awards the track to the highest Influence', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const [a, b] = s.players.map((p) => p.id) as [string, string];
    s = withTokens(s, [
      { playerId: a, track: 'military', count: 3 },
      { playerId: b, track: 'military', count: 1 },
    ]);

    s = resolveRound(s);
    expect(trackResult(s, 'military').championId).toBe(a);
  });

  it('breaks a tie on current Loyalty', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const [a, b] = s.players.map((p) => p.id) as [string, string];
    s = setResources(s, a, { loyalty: 1 });
    s = setResources(s, b, { loyalty: 5 });
    s = withTokens(s, [
      { playerId: a, track: 'moral', count: 2 },
      { playerId: b, track: 'moral', count: 2 },
    ]);

    s = resolveRound(s);
    expect(trackResult(s, 'moral').championId).toBe(b);
  });

  it('falls back to turn order when Loyalty is also tied', () => {
    let s = scenario({ tribes: ['Judah', 'Naphtali'], crisisId: null });
    const [a, b] = s.players.map((p) => p.id) as [string, string];
    s = setResources(s, a, { loyalty: 3 });
    s = setResources(s, b, { loyalty: 3 });
    s = withTokens(s, [
      { playerId: a, track: 'moral', count: 2 },
      { playerId: b, track: 'moral', count: 2 },
    ]);

    s = resolveRound(s);
    // `a` is seated first in turnOrder.
    expect(trackResult(s, 'moral').championId).toBe(a);
  });

  it('leaves a track with no Influence unchampioned', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    s = resolveRound(s);
    expect(trackResult(s, 'provision').championId).toBeNull();
  });

  it('pays the Champion reward and counts the Championship', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    const before = playerOf(s, me).resources.warriors;
    s = withTokens(s, [{ playerId: me, track: 'military', count: 3 }]);

    s = resolveRound(s);

    const p = playerOf(s, me);
    expect(p.resources.glory).toBe(1);
    expect(p.resources.warriors).toBe(before + 1);
    expect(p.championships).toBe(1);
  });
});

describe('track success and failure', () => {
  it('succeeds at the threshold and fails below it', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    // 2 players → threshold 3 (2 + small-group bonus).
    s = withTokens(s, [{ playerId: me, track: 'military', count: 3 }]);

    s = resolveRound(s);
    expect(trackResult(s, 'military')).toMatchObject({ threshold: 3, success: true });
    expect(trackResult(s, 'moral').success).toBe(false);
  });

  it('drops the Covenant by 1 per failed track', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 8, crisisId: null });
    s = resolveRound(s);
    // All three tracks fail with no Influence on the board.
    expect(s.covenant).toBe(5);
  });

  it('drops by 2 per failure once the meter is in Judgment', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 4, crisisId: null });
    s = resolveRound(s);
    expect(s.covenant).toBe(0);
  });

  it('costs Loyalty to investors in a failed track but not to bystanders', () => {
    let s = scenario({ tribes: ['Judah', 'Naphtali'], covenant: 10, crisisId: null });
    const [a, b] = s.players.map((p) => p.id) as [string, string];
    // `a` invests in a doomed Moral track; a successful Military keeps the
    // Warning-zone penalty (which would hit everyone) from firing.
    s = withTokens(s, [
      { playerId: a, track: 'moral', count: 1 },
      { playerId: b, track: 'military', count: 3 },
    ]);
    const loyaltyA = playerOf(s, a).resources.loyalty;
    const loyaltyB = playerOf(s, b).resources.loyalty;

    s = resolveRound(s);

    expect(playerOf(s, a).resources.loyalty).toBe(loyaltyA - 1);
    expect(playerOf(s, b).resources.loyalty).toBe(loyaltyB);
  });

  it("softens an investor's loss with Manasseh's Outcast Resolve", () => {
    let s = scenario({ tribes: ['Manasseh', 'Naphtali'], covenant: 10, crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 3 });
    s = withTokens(s, [
      { playerId: me, track: 'moral', count: 1 },
      { playerId: me, track: 'military', count: 3 },
    ]);
    const before = playerOf(s, me).resources.loyalty;

    s = resolveRound(s);
    expect(playerOf(s, me).resources.loyalty).toBe(before);
  });
});

describe('Covenant zone effects', () => {
  it('costs everyone 1 Loyalty in Warning with no successful track', () => {
    let s = scenario({ tribes: ['Judah', 'Naphtali'], covenant: 8, crisisId: null });
    const before = s.players.map((p) => p.resources.loyalty);

    s = resolveRound(s);

    // Three failures put the meter at 5 — inside Warning — and none succeeded,
    // so the penalty lands on the whole table, investors or not.
    expect(s.covenant).toBe(5);
    s.players.forEach((p, i) => {
      expect(p.resources.loyalty).toBe(before[i]! - 1);
    });
  });

  it('spares the table in Warning when a track succeeded', () => {
    let s = scenario({ tribes: ['Judah', 'Naphtali'], covenant: 8, crisisId: null });
    const me = idAt(s, 0);
    s = withTokens(s, [{ playerId: me, track: 'military', count: 3 }]);
    const other = idAt(s, 1);
    const before = playerOf(s, other).resources.loyalty;

    s = resolveRound(s);
    expect(s.covenant).toBe(6); // two failures
    expect(playerOf(s, other).resources.loyalty).toBe(before);
  });

  it('makes every player tied for lowest Loyalty discard under Judgment', () => {
    let s = scenario({ tribes: ['Judah', 'Naphtali', 'Gad'], covenant: 4, crisisId: null });
    const [a, b, c] = s.players.map((p) => p.id) as [string, string, string];
    s = setResources(s, a, { loyalty: 1, goods: 2, warriors: 2 });
    s = setResources(s, b, { loyalty: 1, goods: 2, warriors: 2 });
    s = setResources(s, c, { loyalty: 5, goods: 2, warriors: 2 });
    // Carry every track so no failure pushes the meter out of the Judgment band.
    s = withTokens(s, [
      { playerId: c, track: 'military', count: 4 },
      { playerId: c, track: 'moral', count: 4 },
      { playerId: c, track: 'provision', count: 4 },
    ]);

    s = resolveRound(s);

    expect(s.covenant).toBe(4);
    expect(playerOf(s, a).resources.goods).toBe(1);
    expect(playerOf(s, b).resources.goods).toBe(1);
    // `c` is not tied for lowest, so keeps its Goods (plus the Provision reward).
    expect(playerOf(s, c).resources.goods).toBeGreaterThanOrEqual(2);
  });
});

describe('Crisis 13 — The Day of Midian', () => {
  it('doubles what Military must beat to succeed', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: 13 });
    const me = idAt(s, 0);
    s = withTokens(s, [{ playerId: me, track: 'military', count: 3 }]);

    s = resolveRound(s);
    const r = trackResult(s, 'military');
    expect(r.threshold).toBe(6);
    expect(r.baseThreshold).toBe(3);
    expect(r.success).toBe(false);
  });

  it('measures the Low/High zone against the base threshold, not the doubled one', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: 13 });
    const me = idAt(s, 0);
    s = withTokens(s, [{ playerId: me, track: 'military', count: 5 }]);

    s = resolveRound(s);
    const r = trackResult(s, 'military');
    expect(r.success).toBe(false); // 5 < 6
    expect(r.zone).toBe('high'); // but 5 >= 3 + 2, so not a Low track
  });

  it('pays every investor +1 Glory when Military does clear the bar', () => {
    let s = scenario({ tribes: ['Judah', 'Naphtali'], crisisId: 13 });
    const [a, b] = s.players.map((p) => p.id) as [string, string];
    s = withTokens(s, [
      { playerId: a, track: 'military', count: 5 },
      { playerId: b, track: 'military', count: 1 },
    ]);

    s = resolveRound(s);
    expect(trackResult(s, 'military').success).toBe(true);
    // Champion: 1 (reward) + 1 (Day of Midian). Other investor: 1.
    expect(playerOf(s, a).resources.glory).toBe(2);
    expect(playerOf(s, b).resources.glory).toBe(1);
  });
});

describe('Crisis 14 — In Those Days There Was No King', () => {
  it('drops the Covenant at end of round regardless of results', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 10, crisisId: 14 });
    const me = idAt(s, 0);
    s = withTokens(s, [
      { playerId: me, track: 'military', count: 3 },
      { playerId: me, track: 'moral', count: 3 },
      { playerId: me, track: 'provision', count: 3 },
    ]);

    s = resolveRound(s);
    expect(s.covenant).toBe(9);
  });

  it('caps Champion Glory at 1 even with a leader bonus stacked on top', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: 14 });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 1 }); // Othniel I: +1 extra Glory
    s = withTokens(s, [{ playerId: me, track: 'military', count: 3 }]);

    s = resolveRound(s);
    expect(playerOf(s, me).resources.glory).toBe(1);
  });
});

describe('deferred zone uniques', () => {
  it('pays Raid Glory when Military is not Low', () => {
    let s = scenario({ tribes: ['Benjamin', 'Naphtali'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { pendingZoneUnique: 'raid' });
    s = withTokens(s, [{ playerId: idAt(s, 1), track: 'military', count: 3 }]);
    const goods = playerOf(s, me).resources.goods;

    s = resolveRound(s);

    expect(playerOf(s, me).resources.glory).toBe(1);
    expect(playerOf(s, me).resources.goods).toBe(goods + 1);
  });

  it('costs Loyalty instead of Glory when Military is Low', () => {
    let s = scenario({ tribes: ['Benjamin', 'Naphtali'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { pendingZoneUnique: 'raid' });
    const goods = playerOf(s, me).resources.goods;
    const loyalty = playerOf(s, me).resources.loyalty;

    s = resolveRound(s);

    expect(playerOf(s, me).resources.glory).toBe(0);
    expect(playerOf(s, me).resources.goods).toBe(goods + 1);
    expect(playerOf(s, me).resources.loyalty).toBeLessThan(loyalty);
  });

  it('always pays Skirmish Glory, adding Goods only when Military is Low', () => {
    let low = scenario({ tribes: ['Simeon', 'Naphtali'], crisisId: null });
    const me = idAt(low, 0);
    const goods = playerOf(low, me).resources.goods;
    low = patchPlayer(low, me, { pendingZoneUnique: 'skirmish' });
    low = resolveRound(low);
    expect(playerOf(low, me).resources.glory).toBe(1);
    expect(playerOf(low, me).resources.goods).toBe(goods + 1);

    let high = scenario({ tribes: ['Simeon', 'Naphtali'], crisisId: null });
    high = patchPlayer(high, me, { pendingZoneUnique: 'skirmish' });
    high = withTokens(high, [{ playerId: idAt(high, 1), track: 'military', count: 3 }]);
    high = resolveRound(high);
    expect(playerOf(high, me).resources.glory).toBe(1);
    expect(playerOf(high, me).resources.goods).toBe(goods);
  });

  it('clears the pending flag so it cannot settle twice', () => {
    let s = scenario({ tribes: ['Benjamin', 'Naphtali'], round: 2, crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { pendingZoneUnique: 'raid' });
    s = resolveRound(s);
    expect(playerOf(s, me).pendingZoneUnique).toBeNull();
  });
});

describe('Ehud III — free Recruit', () => {
  it('pays the Recruit cost rather than granting Warriors outright', () => {
    let s = scenario({ tribes: ['Benjamin', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 3 });
    s = setResources(s, me, { goods: 2, warriors: 0, faith: 0 });
    s = withTokens(s, [{ playerId: me, track: 'military', count: 3 }]);

    s = resolveRound(s);

    const p = playerOf(s, me);
    // Champion reward +1 Warrior, Ehud I +1 Warrior, Ehud III 1 Goods → 2 Warriors.
    expect(p.resources.goods).toBe(1);
    expect(p.resources.warriors).toBe(4);
  });

  it('falls back to the Faith mode when Goods are gone', () => {
    let s = scenario({ tribes: ['Benjamin', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 3 });
    s = setResources(s, me, { goods: 0, warriors: 0, faith: 1 });
    s = withTokens(s, [{ playerId: me, track: 'military', count: 3 }]);

    s = resolveRound(s);
    expect(playerOf(s, me).resources.warriors).toBe(3);
  });
});

describe('Broken Covenant clock', () => {
  it('costs 2 Loyalty each and arms the final round', () => {
    let s = scenario({ tribes: ['Manasseh', 'Naphtali'], covenant: 2, round: 2, crisisId: null });
    const before = playerOf(s, idAt(s, 0)).resources.loyalty;

    s = resolveRound(s);

    expect(s.covenant).toBe(0);
    expect(s.brokenClock).toBe(true);
    expect(s.phase).not.toBe('gameEnd');
    expect(playerOf(s, idAt(s, 0)).resources.loyalty).toBeLessThanOrEqual(before - 2);
  });

  it('ends the game after the next full round', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 2, round: 2, crisisId: null });
    s = resolveRound(s);
    expect(s.brokenClock).toBe(true);

    s = resolveRound({ ...s, phase: 'resolve' });
    expect(s.phase).toBe('gameEnd');
  });

  it('ends the game when the scheduled rounds run out', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 10, crisisId: null });
    s = { ...s, round: s.maxRounds };
    s = resolveRound(s);
    expect(s.phase).toBe('gameEnd');
  });
});

describe('endGame', () => {
  it('pays every player +1 Glory at Covenant Strength', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 9, crisisId: null });
    s = endGame(s);
    for (const p of s.players) expect(p.resources.glory).toBe(1);
  });

  it('takes 1 Glory from everyone under Judgment', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 3, crisisId: null });
    s = setResources(s, idAt(s, 0), { glory: 4 });
    s = endGame(s);
    expect(playerOf(s, idAt(s, 0)).resources.glory).toBe(3);
  });

  it('applies no Glory penalty under Broken Covenant', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 1, crisisId: null });
    s = setResources(s, idAt(s, 0), { glory: 4 });
    s = endGame(s);
    expect(playerOf(s, idAt(s, 0)).resources.glory).toBe(4);
  });

  it('leaves the Warning band alone', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 6, crisisId: null });
    s = setResources(s, idAt(s, 0), { glory: 4 });
    s = endGame(s);
    expect(playerOf(s, idAt(s, 0)).resources.glory).toBe(4);
  });

  it('names a single winner on Glory', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 6, crisisId: null });
    const [a, b] = s.players.map((p) => p.id) as [string, string];
    s = setResources(s, a, { glory: 7 });
    s = setResources(s, b, { glory: 3 });
    s = endGame(s);
    expect(s.winners).toEqual([a]);
  });

  it('declares a shared victory when every tie-break is exhausted', () => {
    let s = scenario({ tribes: ['Judah', 'Naphtali'], covenant: 6, crisisId: null });
    const [a, b] = s.players.map((p) => p.id) as [string, string];
    const same = { glory: 5, loyalty: 3, faith: 1, warriors: 1, goods: 1 };
    s = setResources(s, a, same);
    s = setResources(s, b, same);
    s = endGame(s);
    expect(s.winners).toHaveLength(2);
  });
});
