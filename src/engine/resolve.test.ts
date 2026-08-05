import { describe, expect, it } from 'vitest';
import { baseThreshold, covenantZone } from './helpers';
import { advanceToNextRound, endGame, resolveRound } from './resolve';
import {
  carryAllTracks,
  carryTrack,
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
      { playerId: a, track: 'military', count: 4 },
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
    s = withTokens(s, [{ playerId: me, track: 'military', count: 4 }]);

    s = resolveRound(s);

    const p = playerOf(s, me);
    expect(p.resources.glory).toBe(1);
    expect(p.resources.warriors).toBe(before + 1);
    expect(p.championships).toBe(1);
  });
});

describe('Banner and Supply at resolution', () => {
  it('lets Supply clear the threshold but never claim the track', () => {
    let s = scenario({ tribes: ['Benjamin', 'Asher'], crisisId: null });
    const [benjamin, asher] = s.players.map((p) => p.id) as [string, string];
    s = withTokens(s, [
      { playerId: benjamin, track: 'military', count: 2 }, // Banner
      { playerId: asher, track: 'military', count: 4, paidWith: 'goods' }, // Supply
    ]);

    s = resolveRound(s);

    const r = trackResult(s, 'military');
    expect(r.total).toBe(6);
    expect(r.bannerTotal).toBe(2);
    expect(r.success).toBe(true);
    // Asher out-placed Benjamin 4 to 2 and still cannot be Champion.
    expect(r.championId).toBe(benjamin);
  });

  it('succeeds with no Champion when only Supply carried the track', () => {
    let s = scenario({ tribes: ['Benjamin', 'Levi'], crisisId: null });
    const [benjamin, levi] = s.players.map((p) => p.id) as [string, string];
    s = withTokens(s, [
      { playerId: benjamin, track: 'provision', count: 2, paidWith: 'warriors' },
      { playerId: levi, track: 'provision', count: 2, paidWith: 'faith' },
    ]);

    s = resolveRound(s);

    const r = trackResult(s, 'provision');
    expect(r.success).toBe(true);
    expect(r.bannerTotal).toBe(0);
    expect(r.championId).toBeNull();
    // Nobody claimed it, so no Glory was awarded for it.
    expect(playerOf(s, benjamin).resources.glory).toBe(0);
    expect(playerOf(s, levi).resources.glory).toBe(0);
  });

  it('charges the failure penalty to Banner contributors only', () => {
    let s = scenario({ tribes: ['Benjamin', 'Asher'], covenant: 10, crisisId: null });
    const [benjamin, asher] = s.players.map((p) => p.id) as [string, string];
    s = withTokens(s, [
      { playerId: benjamin, track: 'military', count: 1 }, // Banner — staked
      { playerId: asher, track: 'military', count: 1, paidWith: 'goods' }, // Supply — safe
      // A successful Provision keeps the Warning-zone penalty, which would hit
      // everyone, from muddying the result.
      { playerId: asher, track: 'provision', count: 4 },
    ]);
    const benLoyalty = playerOf(s, benjamin).resources.loyalty;
    const asherLoyalty = playerOf(s, asher).resources.loyalty;

    s = resolveRound(s);

    expect(trackResult(s, 'military').success).toBe(false);
    expect(trackResult(s, 'provision').success).toBe(true);
    expect(playerOf(s, benjamin).resources.loyalty).toBe(benLoyalty - 1);
    expect(playerOf(s, asher).resources.loyalty).toBe(asherLoyalty);
  });
});

describe('spoil', () => {
  it('pays every non-Champion contributor the affinity resource', () => {
    let s = scenario({ tribes: ['Benjamin', 'Asher'], crisisId: null });
    const [benjamin, asher] = s.players.map((p) => p.id) as [string, string];
    s = setResources(s, asher, { warriors: 0 });
    s = withTokens(s, [
      { playerId: benjamin, track: 'military', count: 4 },
      { playerId: asher, track: 'military', count: 1, paidWith: 'goods' },
    ]);

    s = resolveRound(s);

    expect(trackResult(s, 'military').championId).toBe(benjamin);
    // Asher turned 1 Goods into 1 Warrior by supplying a track it could not win.
    expect(playerOf(s, asher).resources.warriors).toBe(1);
  });

  it('pays Supply contributors but not Banner ones', () => {
    let s = scenario({ tribes: ['Benjamin', 'Asher', 'Gad'], crisisId: null });
    const [benjamin, asher, gad] = s.players.map((p) => p.id) as [string, string, string];
    s = setResources(s, asher, { warriors: 0 });
    s = setResources(s, gad, { warriors: 0 });
    s = withTokens(s, [
      { playerId: benjamin, track: 'military', count: 4 }, // Banner, Champion
      { playerId: gad, track: 'military', count: 1 }, // Banner, not Champion
      { playerId: asher, track: 'military', count: 1, paidWith: 'goods' }, // Supply
    ]);

    s = resolveRound(s);

    expect(trackResult(s, 'military').championId).toBe(benjamin);
    // Asher supplied and is paid; Gad bannered and is not.
    expect(playerOf(s, asher).resources.warriors).toBe(1);
    expect(playerOf(s, gad).resources.warriors).toBe(0);
  });

  it('pays nothing when the track fails', () => {
    let s = scenario({ tribes: ['Benjamin', 'Asher'], crisisId: null });
    const asher = idAt(s, 1);
    s = setResources(s, asher, { warriors: 0 });
    s = withTokens(s, [
      { playerId: asher, track: 'military', count: 1, paidWith: 'goods' },
    ]);

    s = resolveRound(s);

    expect(trackResult(s, 'military').success).toBe(false);
    expect(playerOf(s, asher).resources.warriors).toBe(0);
  });

  it('does not double-pay the Champion on top of the Champion reward', () => {
    let s = scenario({ tribes: ['Benjamin', 'Levi'], crisisId: null });
    const benjamin = idAt(s, 0);
    s = setResources(s, benjamin, { warriors: 0 });
    s = withTokens(s, [{ playerId: benjamin, track: 'military', count: 4 }]);

    s = resolveRound(s);

    // Champion reward is +1 Warrior; the spoil must not stack on top of it.
    expect(playerOf(s, benjamin).resources.warriors).toBe(1);
  });

  it('can be switched off by tuning', () => {
    let s = scenario({
      tribes: ['Benjamin', 'Asher'],
      crisisId: null,
      tuning: { spoilOnSuccess: 0 },
    });
    const [benjamin, asher] = s.players.map((p) => p.id) as [string, string];
    s = setResources(s, asher, { warriors: 0 });
    s = withTokens(s, [
      { playerId: benjamin, track: 'military', count: 4 },
      { playerId: asher, track: 'military', count: 1, paidWith: 'goods' },
    ]);

    s = resolveRound(s);

    expect(playerOf(s, asher).resources.warriors).toBe(0);
  });
});

describe('track success and failure', () => {
  it('succeeds at the threshold and fails below it', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    // 2 players → threshold 3 (2 + small-group bonus).
    s = withTokens(s, [{ playerId: me, track: 'military', count: 4 }]);

    s = resolveRound(s);
    expect(trackResult(s, 'military')).toMatchObject({
      threshold: baseThreshold(s, 'military'),
      success: true,
    });
    expect(trackResult(s, 'moral').success).toBe(false);
  });

  it('drops 1 for each track that gives way', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 8, crisisId: null });
    // One holds, two give way — and one success is not enough to mend anything.
    s = carryTrack(s, idAt(s, 0), 'military');
    s = resolveRound(s);
    expect(s.covenant).toBe(6);
  });

  it('falls furthest when every track gives way', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 10, crisisId: null });
    s = resolveRound(s);
    expect(s.covenant).toBe(7);
  });

  it('mends by 1 only when every track holds', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 5, crisisId: null });
    s = carryAllTracks(s, idAt(s, 0));
    s = resolveRound(s);
    expect(s.covenant).toBe(6);
  });

  it('gives nothing for two tracks out of three', () => {
    // Held above Judgment so the deeper in-Judgment drop does not confuse this.
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 8, crisisId: null });
    const me = idAt(s, 0);
    s = carryTrack(s, me, 'military');
    s = carryTrack(s, me, 'moral');
    s = resolveRound(s);
    // Recovery is all-or-nothing: two of three still costs 1 for the failure.
    expect(s.covenant).toBe(7);
  });

  it('wastes any mending past the maximum', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], covenant: 10, crisisId: null });
    s = carryAllTracks(s, idAt(s, 0));
    s = resolveRound(s);
    expect(s.covenant).toBe(10);
  });

  describe('Level III covenant rescue — one held track counts twice', () => {
    /** Two tracks held, one gave way: normally −1. */
    function oneShort(tribe: 'Levi' | 'Dan' | 'Gad') {
      let s = scenario({ tribes: [tribe, 'Naphtali'], covenant: 6, crisisId: null });
      const me = idAt(s, 0);
      s = patchPlayer(s, me, { leaderLevel: 3 });
      s = carryTrack(s, me, 'military');
      s = carryTrack(s, me, 'moral');
      return { s, me };
    }

    // Gad has no other Covenant-moving ability, so it isolates the rescue.
    // Levi's Phinehas I raises the meter again on a Moral Championship, which is
    // correct but would muddy the arithmetic here.
    it('turns a −1 generation into a +1', () => {
      let { s, me } = oneShort('Gad');
      s = resolveRound(s);
      expect(s.covenant).toBe(7);
      expect(playerOf(s, me).oncePerGameUsed['rescue']).toBe(true);
    });

    it('stacks with Levi’s own Covenant Zeal', () => {
      let { s } = oneShort('Levi');
      s = resolveRound(s);
      // +1 rescue, +1 Phinehas I for the Moral Championship.
      expect(s.covenant).toBe(8);
    });

    it('charges Dan 2 Warriors for Final Stand', () => {
      let { s, me } = oneShort('Dan');
      const warriors = playerOf(s, me).resources.warriors;
      s = resolveRound(s);
      expect(s.covenant).toBe(7);
      // Champion of Military pays +1 Warrior before the rescue takes its 2.
      expect(playerOf(s, me).resources.warriors).toBe(warriors + 1 - 2);
    });

    it('does not fire for Dan without the Warriors to pay', () => {
      let { s, me } = oneShort('Dan');
      s = setResources(s, me, { warriors: 0 });
      s = resolveRound(s);
      expect(s.covenant).toBe(5);
      expect(playerOf(s, me).oncePerGameUsed['rescue']).toBeUndefined();
    });

    it('is spent only once per game', () => {
      let { s, me } = oneShort('Gad');
      s = resolveRound(s);
      expect(s.covenant).toBe(7);

      s = advanceToNextRound(s);
      s = carryTrack(s, me, 'military');
      s = carryTrack(s, me, 'moral');
      s = resolveRound(s);
      // No rescue left: the single failure costs 1 again.
      expect(s.covenant).toBe(6);
    });

    it('is held back when it could not make the generation faithful', () => {
      let s = scenario({ tribes: ['Gad', 'Naphtali'], covenant: 10, crisisId: null });
      const me = idAt(s, 0);
      s = patchPlayer(s, me, { leaderLevel: 3 });
      // Only one track held, so cancelling one failure still leaves one.
      s = carryTrack(s, me, 'military');
      s = resolveRound(s);
      expect(s.covenant).toBe(8);
      expect(playerOf(s, me).oncePerGameUsed['rescue']).toBeUndefined();
    });

    it('needs a held track to double in the first place', () => {
      let s = scenario({ tribes: ['Gad', 'Naphtali'], covenant: 6, crisisId: null });
      const me = idAt(s, 0);
      s = patchPlayer(s, me, { leaderLevel: 3 });
      s = resolveRound(s);
      expect(playerOf(s, me).oncePerGameUsed['rescue']).toBeUndefined();
    });

    it('does nothing below Level III', () => {
      let s = scenario({ tribes: ['Gad', 'Naphtali'], covenant: 6, crisisId: null });
      const me = idAt(s, 0);
      s = patchPlayer(s, me, { leaderLevel: 2 });
      s = carryTrack(s, me, 'military');
      s = carryTrack(s, me, 'moral');
      s = resolveRound(s);
      expect(s.covenant).toBe(5);
    });
  });

  it('costs Loyalty to investors in a failed track but not to bystanders', () => {
    let s = scenario({ tribes: ['Judah', 'Naphtali'], covenant: 10, crisisId: null });
    const [a, b] = s.players.map((p) => p.id) as [string, string];
    // `a` invests in a doomed Moral track; a successful Military keeps the
    // Warning-zone penalty (which would hit everyone) from firing.
    s = withTokens(s, [
      { playerId: a, track: 'moral', count: 1 },
      { playerId: b, track: 'military', count: 4 },
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
      { playerId: me, track: 'military', count: 4 },
    ]);
    const before = playerOf(s, me).resources.loyalty;

    s = resolveRound(s);
    expect(playerOf(s, me).resources.loyalty).toBe(before);
  });
});

describe('Covenant zone effects', () => {
  it('costs everyone 1 Loyalty in Warning with no successful track', () => {
    // From 10, three failures land on 7 — the top of the Warning band.
    let s = scenario({ tribes: ['Judah', 'Naphtali'], covenant: 10, crisisId: null });
    const before = s.players.map((p) => p.resources.loyalty);

    s = resolveRound(s);

    // Three failures put the meter at 5 — inside Warning — and nothing
    // succeeded, so the penalty lands on the whole table, investors or not.
    expect(covenantZone(s.covenant, s.tuningSnapshot)).toBe('warning');
    s.players.forEach((p, i) => {
      expect(p.resources.loyalty).toBe(before[i]! - 1);
    });
  });

  it('spares the table in Warning when a track succeeded', () => {
    let s = scenario({ tribes: ['Judah', 'Naphtali'], covenant: 8, crisisId: null });
    const me = idAt(s, 0);
    s = withTokens(s, [{ playerId: me, track: 'military', count: 4 }]);
    const other = idAt(s, 1);
    const before = playerOf(s, other).resources.loyalty;

    s = resolveRound(s);
    // Two tracks gave way: −2, into the Warning band — but one held, so the
    // table is spared the Warning penalty.
    expect(s.covenant).toBe(6);
    expect(covenantZone(s.covenant, s.tuningSnapshot)).toBe('warning');
    expect(playerOf(s, other).resources.loyalty).toBe(before);
  });

  it('makes every player tied for lowest Loyalty discard under Judgment', () => {
    // Carrying every track mends the meter by 1, so start a step below Judgment.
    let s = scenario({ tribes: ['Judah', 'Naphtali', 'Gad'], covenant: 3, crisisId: null });
    const [a, b, c] = s.players.map((p) => p.id) as [string, string, string];
    s = setResources(s, a, { loyalty: 1, goods: 2, warriors: 2 });
    s = setResources(s, b, { loyalty: 1, goods: 2, warriors: 2 });
    s = setResources(s, c, { loyalty: 5, goods: 2, warriors: 2 });
    // Carry every track so no failure pushes the meter out of the Judgment band.
    s = carryAllTracks(s, c);

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
    s = withTokens(s, [{ playerId: me, track: 'military', count: 4 }]);

    s = resolveRound(s);
    const r = trackResult(s, 'military');
    expect(r.threshold).toBe(r.baseThreshold * 2);
    expect(r.success).toBe(false);
  });

  it('measures the Low/High zone against the base threshold, not the doubled one', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: 13 });
    const me = idAt(s, 0);
    const base = baseThreshold(s, 'military');
    // Enough to be High against the base, but short of the doubled bar.
    const count = base + s.tuningSnapshot.lowHighOffset;
    expect(count).toBeLessThan(base * 2);
    s = withTokens(s, [{ playerId: me, track: 'military', count }]);

    s = resolveRound(s);
    const r = trackResult(s, 'military');
    expect(r.success).toBe(false);
    expect(r.zone).toBe('high');
  });

  it('pays every investor +1 Glory when Military does clear the bar', () => {
    let s = scenario({ tribes: ['Judah', 'Naphtali'], crisisId: 13 });
    const [a, b] = s.players.map((p) => p.id) as [string, string];
    s = withTokens(s, [
      { playerId: a, track: 'military', count: baseThreshold(s, 'military') * 2 },
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
      { playerId: me, track: 'military', count: 4 },
      { playerId: me, track: 'moral', count: 4 },
      { playerId: me, track: 'provision', count: 4 },
    ]);

    s = resolveRound(s);
    expect(s.covenant).toBe(9);
  });

  it('caps Champion Glory at 1 even with a leader bonus stacked on top', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: 14 });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 1 }); // Othniel I: +1 extra Glory
    s = withTokens(s, [{ playerId: me, track: 'military', count: 4 }]);

    s = resolveRound(s);
    expect(playerOf(s, me).resources.glory).toBe(1);
  });
});

describe('deferred zone uniques', () => {
  it('pays Raid Glory when Military is not Low', () => {
    let s = scenario({ tribes: ['Benjamin', 'Naphtali'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { pendingZoneUnique: 'raid' });
    s = withTokens(s, [{ playerId: idAt(s, 1), track: 'military', count: 4 }]);
    const goods = playerOf(s, me).resources.goods;

    s = resolveRound(s);

    expect(playerOf(s, me).resources.glory).toBe(1);
    expect(playerOf(s, me).resources.goods).toBe(goods + 1);
  });

  it('costs Loyalty instead of Glory when Military is Low', () => {
    let s = scenario({ tribes: ['Benjamin', 'Naphtali'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { pendingZoneUnique: 'raid' });
    // Carry the other two tracks so the meter does not fall into Judgment and
    // confiscate the Goods this test is checking for.
    s = carryTrack(s, idAt(s, 1), 'moral');
    s = carryTrack(s, idAt(s, 1), 'provision');
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
    high = withTokens(high, [{ playerId: idAt(high, 1), track: 'military', count: 4 }]);
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
    s = withTokens(s, [{ playerId: me, track: 'military', count: 4 }]);

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
    s = withTokens(s, [{ playerId: me, track: 'military', count: 4 }]);

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
