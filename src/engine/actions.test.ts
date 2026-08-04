import { describe, expect, it } from 'vitest';
import { TRIBES, uniqueCanCostFaith } from '../data/gameData';
import { applyStandardAction, applyUniqueAction } from './actions';
import { getTrackTotals } from './helpers';
import { dispatch } from './index';
import {
  idAt,
  patchPlayer,
  playerOf,
  scenario,
  setResources,
  withTokens,
} from './testSupport';
import type { GameState, PlayerAction, TribeId } from './types';

function standard(
  s: GameState,
  id: string,
  action: Extract<PlayerAction, { type: 'standard' }>,
) {
  return applyStandardAction(s, id, action);
}

function unique(
  s: GameState,
  id: string,
  action: Extract<PlayerAction, { type: 'unique' }>,
) {
  return applyUniqueAction(s, id, action);
}

describe('standard actions', () => {
  it('Recruit trades 1 Goods for 2 Warriors', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { goods: 2, warriors: 0 });

    const r = standard(s, me, { type: 'standard', action: 'recruit', recruitMode: 'goods' });

    expect(r.ok).toBe(true);
    expect(playerOf(r.state, me).resources.goods).toBe(1);
    expect(playerOf(r.state, me).resources.warriors).toBe(2);
  });

  it('Recruit via Faith nets +1 Warrior and returns the Faith', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 1, warriors: 0 });

    const r = standard(s, me, { type: 'standard', action: 'recruit', recruitMode: 'faith' });

    expect(r.ok).toBe(true);
    expect(playerOf(r.state, me).resources.faith).toBe(1);
    expect(playerOf(r.state, me).resources.warriors).toBe(1);
  });

  it('rejects Recruit with nothing to spend', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { goods: 0 });

    expect(standard(s, me, { type: 'standard', action: 'recruit', recruitMode: 'goods' }).ok).toBe(
      false,
    );
  });

  it('Gather trades 1 Warrior or Faith for 2 Goods', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { warriors: 1, goods: 0 });

    const r = standard(s, me, { type: 'standard', action: 'gather', gatherSpend: 'warriors' });

    expect(playerOf(r.state, me).resources.warriors).toBe(0);
    expect(playerOf(r.state, me).resources.goods).toBe(2);
  });

  it("adds a Goods to Gather with Asher's Fertile Blessing, once per round", () => {
    let s = scenario({ tribes: ['Asher', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 2 });
    s = setResources(s, me, { warriors: 2, goods: 0 });

    let r = standard(s, me, { type: 'standard', action: 'gather', gatherSpend: 'warriors' });
    expect(playerOf(r.state, me).resources.goods).toBe(3);

    r = standard(r.state, me, { type: 'standard', action: 'gather', gatherSpend: 'warriors' });
    expect(playerOf(r.state, me).resources.goods).toBe(5); // only +2 the second time
  });

  it('Pray by resting gains 2 Faith', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0 });

    const r = standard(s, me, { type: 'standard', action: 'pray', prayMode: 'rest' });
    expect(playerOf(r.state, me).resources.faith).toBe(2);
  });

  it('Pray with Goods gains Faith and Loyalty, capped at the starting value', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { goods: 2, faith: 0, loyalty: 1 });

    let r = standard(s, me, { type: 'standard', action: 'pray', prayMode: 'goods' });
    expect(playerOf(r.state, me).resources.loyalty).toBe(2);

    // Naphtali starts at 3 Loyalty, so a second Pray reaches but does not pass it.
    r = standard(r.state, me, { type: 'standard', action: 'pray', prayMode: 'goods' });
    expect(playerOf(r.state, me).resources.loyalty).toBe(3);
  });

  it('Rest gains 1 Loyalty and peeks the Crisis deck', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { loyalty: 1 });

    const r = standard(s, me, { type: 'standard', action: 'rest' });
    expect(playerOf(r.state, me).resources.loyalty).toBe(2);
    expect(playerOf(r.state, me).peekedCrisis).toHaveLength(1);
  });

  it('Rest cannot push Loyalty past the starting value', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { loyalty: 3 });

    const r = standard(s, me, { type: 'standard', action: 'rest' });
    expect(playerOf(r.state, me).resources.loyalty).toBe(3);
  });

  describe('Convert rates', () => {
    const allowed: Array<[string, string]> = [
      ['goods', 'faith'],
      ['goods', 'warriors'],
      ['warriors', 'goods'],
      ['faith', 'goods'],
      ['faith', 'warriors'],
    ];
    const rejected: Array<[string, string]> = [
      ['warriors', 'faith'],
      ['goods', 'goods'],
    ];

    it.each(allowed)('allows 2 %s → 1 %s', (from, to) => {
      let s = scenario({ tribes: ['Zebulun', 'Levi'], crisisId: null });
      const me = idAt(s, 0);
      s = setResources(s, me, { faith: 2, warriors: 2, goods: 2 });

      const r = standard(s, me, {
        type: 'standard',
        action: 'convert',
        convert: { from, to } as never,
      });

      expect(r.ok).toBe(true);
      expect(playerOf(r.state, me).resources[from as 'faith']).toBe(0);
      expect(playerOf(r.state, me).resources[to as 'faith']).toBe(3);
    });

    it.each(rejected)('rejects 2 %s → 1 %s', (from, to) => {
      let s = scenario({ tribes: ['Zebulun', 'Levi'], crisisId: null });
      const me = idAt(s, 0);
      s = setResources(s, me, { faith: 2, warriors: 2, goods: 2 });

      expect(
        standard(s, me, {
          type: 'standard',
          action: 'convert',
          convert: { from, to } as never,
        }).ok,
      ).toBe(false);
    });

    it('rejects a conversion the player cannot pay for', () => {
      let s = scenario({ tribes: ['Zebulun', 'Levi'], crisisId: null });
      const me = idAt(s, 0);
      s = setResources(s, me, { goods: 1 });

      expect(
        standard(s, me, {
          type: 'standard',
          action: 'convert',
          convert: { from: 'goods', to: 'faith' },
        }).ok,
      ).toBe(false);
    });
  });
});

describe('unique actions', () => {
  it('Judah Rally gifts temporary Influence on the chosen track', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const [me, other] = s.players.map((p) => p.id) as [string, string];

    const r = unique(s, me, {
      type: 'unique',
      tribe: 'Judah',
      targetPlayerId: other,
      track: 'moral',
    });

    expect(r.ok).toBe(true);
    const gift = r.state.tokens.find((t) => t.playerId === other);
    expect(gift).toMatchObject({ track: 'moral', temporary: true, value: 1 });
    expect(playerOf(r.state, me).resources.faith).toBe(2);
  });

  it('gifts Rally Influence as Supply, so it cannot hand out a Championship', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const [me, other] = s.players.map((p) => p.id) as [string, string];

    const r = unique(s, me, {
      type: 'unique',
      tribe: 'Judah',
      targetPlayerId: other,
      track: 'moral',
    });

    const gift = r.state.tokens.find((t) => t.playerId === other);
    expect(gift?.paidWith).toBeNull();
    expect(getTrackTotals(r.state).banner.moral[other]).toBeUndefined();
    expect(getTrackTotals(r.state).total.moral[other]).toBe(1);
  });

  it("defaults the Rally gift to the recipient's affinity track", () => {
    let s = scenario({ tribes: ['Judah', 'Asher'], crisisId: null });
    const [me, other] = s.players.map((p) => p.id) as [string, string];

    const r = unique(s, me, { type: 'unique', tribe: 'Judah', targetPlayerId: other });
    // Asher's bias is Provision.
    expect(r.state.tokens.find((t) => t.playerId === other)?.track).toBe('provision');
  });

  it('refuses a Rally aimed at yourself', () => {
    const s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    const me = idAt(s, 0);

    const r = unique(s, me, { type: 'unique', tribe: 'Judah', targetPlayerId: me });
    expect(r.ok).toBe(false);
    expect(r.state.tokens).toHaveLength(0);
  });

  it('Levi Intercede can raise the Covenant', () => {
    const s = scenario({ tribes: ['Levi', 'Judah'], covenant: 6, crisisId: null });
    const me = idAt(s, 0);

    const r = unique(s, me, { type: 'unique', tribe: 'Levi', leviMode: 'raise' });
    expect(r.state.covenant).toBe(7);
  });

  it('Levi Intercede can arm Covenant protection instead', () => {
    const s = scenario({ tribes: ['Levi', 'Judah'], crisisId: null });
    const me = idAt(s, 0);

    const r = unique(s, me, { type: 'unique', tribe: 'Levi', leviMode: 'protect' });
    expect(playerOf(r.state, me).covenantProtect).toBe(true);
    expect(r.state.covenant).toBe(8);
  });

  it('Gad Stand Firm arms Loyalty protection', () => {
    const s = scenario({ tribes: ['Gad', 'Levi'], crisisId: null });
    const me = idAt(s, 0);

    const r = unique(s, me, { type: 'unique', tribe: 'Gad' });
    expect(playerOf(r.state, me).standFirm).toBe(true);
    expect(playerOf(r.state, me).resources.warriors).toBe(3);
  });

  it('Manasseh Hold the Line arms the penalty reduction', () => {
    const s = scenario({ tribes: ['Manasseh', 'Levi'], crisisId: null });
    const me = idAt(s, 0);

    const r = unique(s, me, { type: 'unique', tribe: 'Manasseh', manassehSpend: 'warriors' });
    expect(playerOf(r.state, me).holdTheLine).toBe(true);
  });

  it('Ephraim Double Portion pays out in the chosen mix', () => {
    let s = scenario({ tribes: ['Ephraim', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { goods: 1, faith: 0 });

    const r = unique(s, me, {
      type: 'unique',
      tribe: 'Ephraim',
      ephraimMode: 'goodsPlusFaith',
    });
    expect(playerOf(r.state, me).resources.goods).toBe(1);
    expect(playerOf(r.state, me).resources.faith).toBe(1);
  });

  it('Reuben Scout Ahead peeks the top Crisis card', () => {
    const s = scenario({ tribes: ['Reuben', 'Levi'], crisisId: null });
    const me = idAt(s, 0);

    const r = unique(s, me, { type: 'unique', tribe: 'Reuben' });
    expect(playerOf(r.state, me).peekedCrisis).toHaveLength(1);
    expect(playerOf(r.state, me).resources.warriors).toBe(3);
  });

  it('Naphtali Reposition moves an existing token', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = withTokens(s, [{ playerId: me, track: 'military', count: 1 }]);
    const tokenId = s.tokens[0]!.id;

    const r = unique(s, me, {
      type: 'unique',
      tribe: 'Naphtali',
      tokenId,
      toTrack: 'provision',
    });

    expect(r.state.tokens[0]?.track).toBe('provision');
  });

  it('Naphtali Reposition rejects a no-op move', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = withTokens(s, [{ playerId: me, track: 'military', count: 1 }]);

    const r = unique(s, me, {
      type: 'unique',
      tribe: 'Naphtali',
      tokenId: s.tokens[0]!.id,
      toTrack: 'military',
    });
    expect(r.ok).toBe(false);
  });

  it('Zebulun Bargain performs two conversions for 1 Goods', () => {
    let s = scenario({ tribes: ['Zebulun', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { goods: 5, faith: 2, warriors: 0 });

    const r = unique(s, me, {
      type: 'unique',
      tribe: 'Zebulun',
      zebulunConverts: [
        { from: 'goods', to: 'warriors' },
        { from: 'faith', to: 'warriors' },
      ],
    });

    // 1 Goods for the action, 2 Goods and 2 Faith converted.
    expect(playerOf(r.state, me).resources.goods).toBe(2);
    expect(playerOf(r.state, me).resources.faith).toBe(0);
    expect(playerOf(r.state, me).resources.warriors).toBe(2);
  });

  it('Zebulun Bargain reports conversions it could not make', () => {
    let s = scenario({ tribes: ['Zebulun', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { goods: 3, faith: 0 });

    const r = unique(s, me, {
      type: 'unique',
      tribe: 'Zebulun',
      zebulunConverts: [
        { from: 'goods', to: 'warriors' },
        { from: 'faith', to: 'warriors' },
      ],
    });

    expect(r.state.log[0]?.text).toContain('1 skipped');
  });

  it('Issachar Study the Times peeks and reorders the top two', () => {
    const s = scenario({ tribes: ['Issachar', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    const [first, second] = s.crisisDeck;

    const r = unique(s, me, {
      type: 'unique',
      tribe: 'Issachar',
      issacharOrder: [1, 0],
    });

    expect(playerOf(r.state, me).peekedCrisis).toHaveLength(2);
    expect(r.state.crisisDeck[0]?.id).toBe(second?.id);
    expect(r.state.crisisDeck[1]?.id).toBe(first?.id);
  });

  it('Issachar rejects a non-permutation and leaves the deck intact', () => {
    const s = scenario({ tribes: ['Issachar', 'Levi'], crisisId: null });
    const me = idAt(s, 0);
    const before = s.crisisDeck.map((c) => c.id);

    const r = unique(s, me, {
      type: 'unique',
      tribe: 'Issachar',
      issacharOrder: [0, 0],
    });

    expect(r.state.crisisDeck.map((c) => c.id)).toEqual(before);
    expect(new Set(before).size).toBe(before.length);
  });

  it("Dan's Serpent's Wisdom swaps the Crisis without duplicating a card", () => {
    let s = scenario({ tribes: ['Dan', 'Levi'], round: 2, crisisId: 13 });
    const me = idAt(s, 0);
    const oldCrisis = s.activeCrisis;

    const r = unique(s, me, { type: 'unique', tribe: 'Dan' });

    expect(r.ok).toBe(true);
    expect(r.state.activeCrisis?.id).not.toBe(oldCrisis?.id);
    expect(playerOf(r.state, me).oncePerGameUsed['serpent']).toBe(true);

    const all = [
      ...r.state.crisisDeck,
      ...r.state.crisisDiscard,
      ...(r.state.activeCrisis ? [r.state.activeCrisis] : []),
    ].map((c) => c.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("refuses Dan's once-per-game ability a second time", () => {
    let s = scenario({ tribes: ['Dan', 'Levi'], round: 2, crisisId: 13 });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { oncePerGameUsed: { serpent: true } });

    expect(unique(s, me, { type: 'unique', tribe: 'Dan' }).ok).toBe(false);
  });

  it('bars once-per-game abilities on round 1', () => {
    const s = scenario({ tribes: ['Dan', 'Levi'], round: 1, crisisId: 13 });
    const me = idAt(s, 0);

    const r = unique(s, me, { type: 'unique', tribe: 'Dan' });
    expect(r.ok).toBe(false);
    expect(r.state.log[0]?.text).toContain('Round 1');
  });

  it('queues Raid and Skirmish rather than paying out immediately', () => {
    for (const [tribe, kind] of [
      ['Benjamin', 'raid'],
      ['Simeon', 'skirmish'],
    ] as Array<[TribeId, 'raid' | 'skirmish']>) {
      const s = scenario({ tribes: [tribe, 'Levi'], crisisId: null });
      const me = idAt(s, 0);

      const r = unique(s, me, { type: 'unique', tribe });

      expect(r.ok).toBe(true);
      expect(playerOf(r.state, me).pendingZoneUnique).toBe(kind);
      expect(playerOf(r.state, me).resources.glory).toBe(0);
    }
  });
});

describe("Crisis 7 — Micah's Idol", () => {
  it('matches the tribes whose printed cost can be Faith', () => {
    const blocked = TRIBES.filter((t) => uniqueCanCostFaith(t.id)).map((t) => t.id);
    expect(blocked.sort()).toEqual(
      ['Asher', 'Dan', 'Issachar', 'Judah', 'Levi', 'Manasseh'].sort(),
    );
  });

  it('blocks a Faith-only unique', () => {
    const s = scenario({ tribes: ['Levi', 'Judah'], crisisId: 7 });
    const me = idAt(s, 0);

    const r = unique(s, me, { type: 'unique', tribe: 'Levi', leviMode: 'raise' });
    expect(r.ok).toBe(false);
    expect(r.state.log[0]?.text).toContain('Micah');
  });

  it('leaves a Warrior-cost unique alone', () => {
    const s = scenario({ tribes: ['Gad', 'Judah'], crisisId: 7 });
    const me = idAt(s, 0);

    expect(unique(s, me, { type: 'unique', tribe: 'Gad' }).ok).toBe(true);
  });

  it('lets Manasseh pay with a Warrior but not with Faith', () => {
    const s = scenario({ tribes: ['Manasseh', 'Judah'], crisisId: 7 });
    const me = idAt(s, 0);

    expect(
      unique(s, me, { type: 'unique', tribe: 'Manasseh', manassehSpend: 'faith' }).ok,
    ).toBe(false);
    expect(
      unique(s, me, { type: 'unique', tribe: 'Manasseh', manassehSpend: 'warriors' }).ok,
    ).toBe(true);
  });

  it('lets Asher harvest by resting but not by spending Faith', () => {
    const s = scenario({ tribes: ['Asher', 'Judah'], crisisId: 7 });
    const me = idAt(s, 0);

    expect(unique(s, me, { type: 'unique', tribe: 'Asher', asherMode: 'faith' }).ok).toBe(
      false,
    );
    expect(unique(s, me, { type: 'unique', tribe: 'Asher', asherMode: 'rest' }).ok).toBe(
      true,
    );
  });
});

describe('dispatch round flow', () => {
  it('runs Crisis → placement → action → resolve for every player', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], phase: 'crisisReveal', crisisId: null });

    s = dispatch(s, { type: 'advance' });
    expect(s.phase).toBe('placement');

    s = dispatch(s, { type: 'confirmPlacement', plan: { military: { warriors: 1 } } });
    expect(s.phase).toBe('placement'); // second player still to place
    s = dispatch(s, { type: 'confirmPlacement', plan: { moral: { faith: 1 } } });
    expect(s.phase).toBe('action');

    s = dispatch(s, { type: 'standard', action: 'pass' });
    expect(s.phase).toBe('action');
    s = dispatch(s, { type: 'standard', action: 'pass' });

    // Resolution pauses so the results stay on screen.
    expect(s.phase).toBe('resolve');
    expect(s.trackResults).not.toBeNull();
    expect(s.tokens.every((t) => !t.faceDown)).toBe(true);

    s = dispatch(s, { type: 'advance' });
    expect(s.round).toBe(2);
    expect(s.tokens).toHaveLength(0);
  });

  it('skips the placement phase when free placement is off', () => {
    let s = scenario({
      tribes: ['Judah', 'Levi'],
      phase: 'crisisReveal',
      crisisId: null,
      tuning: { freePlacementPhase: false },
    });

    s = dispatch(s, { type: 'advance' });
    expect(s.phase).toBe('action');

    s = dispatch(s, { type: 'placeInfluence', plan: { military: { warriors: 1 } } });
    s = dispatch(s, { type: 'standard', action: 'pass' });
    expect(s.phase).toBe('resolve');
  });

  it('holds the turn when a placement cannot be afforded', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], phase: 'placement', crisisId: null });
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 0, warriors: 0, goods: 0 });

    const next = dispatch(s, { type: 'confirmPlacement', plan: { military: { warriors: 2 } } });

    expect(next.phase).toBe('placement');
    expect(next.currentActorIndex).toBe(0);
    expect(next.tokens).toHaveLength(0);
  });

  it('lets a player pass on placing anything', () => {
    const s = scenario({ tribes: ['Judah', 'Levi'], phase: 'placement', crisisId: null });
    const next = dispatch(s, { type: 'confirmPlacement', plan: {} });
    expect(next.currentActorIndex).toBe(1);
  });

  it('ignores actions sent in the wrong phase', () => {
    const s = scenario({ tribes: ['Judah', 'Levi'], phase: 'placement', crisisId: null });
    expect(dispatch(s, { type: 'standard', action: 'pass' })).toBe(s);
  });
});
