/**
 * Reuben and Naphtali — the two tribes whose six upgrades all turn on
 * *position* rather than on force: who commits last, who moves after everyone
 * else has, who came second, and who owes whom.
 */
import { describe, expect, it } from 'vitest';
import { actingOrder, currentActor, getTrackTotals } from './helpers';
import { dispatch } from './index';
import {
  canDeclareAlliance,
  canShiftToken,
  declareAlliance,
  hasPreResolveChoice,
  resolveRound,
} from './resolve';
import {
  carryAllTracks,
  idAt,
  patchPlayer,
  playerOf,
  scenario,
  setResources,
  withTokens,
} from './testSupport';
import type { GameState, TrackId } from './types';

/** Everything a placement needs to actually happen. */
function readyToPlace(tribes: string[], level: number) {
  let s = scenario({ tribes: tribes as never, crisisId: null, phase: 'placement' });
  for (const p of s.players) {
    s = setResources(s, p.id, { faith: 6, warriors: 6, goods: 6 });
  }
  s = patchPlayer(s, idAt(s, 0), { leaderLevel: level });
  return s;
}

/**
 * Placement is seat-ordered, and Reuben's Firstborn Advance deliberately moves
 * it. Clear everyone ahead of the player under test so the dispatch under test
 * is genuinely theirs.
 */
function turnOf(state: GameState, tribe: string): GameState {
  let s = state;
  while (currentActor(s) && currentActor(s)!.tribe !== tribe) {
    s = dispatch(s, { type: 'confirmPlacement', plan: {} });
  }
  return s;
}

describe('Reuben I — Firstborn Advance', () => {
  it('moves Reuben to the back of the placement queue', () => {
    let s = scenario({
      tribes: ['Reuben', 'Judah', 'Levi'],
      crisisId: null,
      phase: 'placement',
    });
    const reuben = idAt(s, 0);
    expect(currentActor(s)!.id).toBe(reuben);

    s = patchPlayer(s, reuben, { leaderLevel: 1 });

    expect(actingOrder(s).at(-1)).toBe(reuben);
    expect(currentActor(s)!.tribe).toBe('Judah');
  });

  it('leaves the action phase in seated order', () => {
    let s = scenario({
      tribes: ['Reuben', 'Judah', 'Levi'],
      crisisId: null,
      phase: 'action',
    });
    s = patchPlayer(s, idAt(s, 0), { leaderLevel: 1 });
    expect(actingOrder(s)).toEqual(s.turnOrder);
    expect(currentActor(s)!.tribe).toBe('Reuben');
  });

  it('does nothing before the upgrade is unlocked', () => {
    const s = scenario({
      tribes: ['Reuben', 'Judah'],
      crisisId: null,
      phase: 'placement',
    });
    expect(actingOrder(s)).toEqual(s.turnOrder);
  });

  it('still gets exactly one placement turn', () => {
    let s = readyToPlace(['Reuben', 'Judah'], 1);
    const placed: string[] = [];
    for (let i = 0; i < 2; i++) {
      placed.push(currentActor(s)!.tribe);
      s = dispatch(s, { type: 'confirmPlacement', plan: { military: { warriors: 1 } } });
    }
    expect(placed).toEqual(['Judah', 'Reuben']);
    expect(s.phase).toBe('action');
  });
});

describe('Reuben II — Pathfinder', () => {
  it('opens an empty track when one track is committed to', () => {
    let s = turnOf(readyToPlace(['Reuben', 'Judah'], 2), 'Reuben');
    s = dispatch(s, {
      type: 'confirmPlacement',
      plan: { military: { warriors: 2 } },
      extras: { pathfinder: 'provision' },
    });

    const reuben = idAt(s, 0);
    const found = s.tokens.filter((t) => t.playerId === reuben && t.track === 'provision');
    expect(found).toHaveLength(1);
    // Supply, not a Banner — it is a scouted path, not a mustered force.
    expect(found[0]!.paidWith).toBeNull();
    expect(found[0]!.temporary).toBe(true);
  });

  it('does nothing on a track Reuben already holds', () => {
    let s = turnOf(readyToPlace(['Reuben', 'Judah'], 2), 'Reuben');
    s = dispatch(s, {
      type: 'confirmPlacement',
      plan: { military: { warriors: 2 }, provision: { goods: 1 } },
      extras: { pathfinder: 'provision' },
    });
    expect(
      s.tokens.filter((t) => t.playerId === idAt(s, 0) && t.track === 'provision'),
    ).toHaveLength(1);
  });

  it('needs a real commitment, not a single token', () => {
    let s = turnOf(readyToPlace(['Reuben', 'Judah'], 2), 'Reuben');
    s = dispatch(s, {
      type: 'confirmPlacement',
      plan: { military: { warriors: 1 } },
      extras: { pathfinder: 'provision' },
    });
    expect(
      s.tokens.filter((t) => t.playerId === idAt(s, 0) && t.track === 'provision'),
    ).toHaveLength(0);
  });
});

describe('Reuben III — Bold Claim', () => {
  /** Reuben second in Banner strength on Military, behind exactly one tribe. */
  function secondPlace(level: number): GameState {
    let s = scenario({
      tribes: ['Reuben', 'Judah', 'Levi'],
      crisisId: null,
      phase: 'preResolve',
    });
    s = patchPlayer(s, idAt(s, 0), { leaderLevel: level });
    s = withTokens(s, [
      { playerId: idAt(s, 1), track: 'military', count: 4 },
      { playerId: idAt(s, 0), track: 'military', count: 2 },
      { playerId: idAt(s, 2), track: 'military', count: 1 },
    ]);
    return s;
  }

  it('pays a Glory for coming second', () => {
    const s = resolveRound(secondPlace(3));
    const reuben = playerOf(s, idAt(s, 0));
    expect(reuben.resources.glory).toBe(1);
    expect(reuben.oncePerGameUsed['boldClaim']).toBe(true);
  });

  it('pays only once in a game', () => {
    let s = resolveRound(secondPlace(3));
    const after = playerOf(s, idAt(s, 0)).resources.glory;

    s = { ...s, phase: 'preResolve', trackResults: null };
    s = resolveRound(s);
    expect(playerOf(s, idAt(s, 0)).resources.glory).toBe(after);
  });

  it('pays nothing to the Champion', () => {
    let s = scenario({
      tribes: ['Reuben', 'Judah'],
      crisisId: null,
      phase: 'preResolve',
    });
    s = patchPlayer(s, idAt(s, 0), { leaderLevel: 3 });
    s = withTokens(s, [
      { playerId: idAt(s, 0), track: 'military', count: 4 },
      { playerId: idAt(s, 1), track: 'military', count: 1 },
    ]);
    s = resolveRound(s);
    expect(playerOf(s, idAt(s, 0)).oncePerGameUsed['boldClaim']).toBeUndefined();
  });

  it('pays nothing for coming third', () => {
    let s = scenario({
      tribes: ['Reuben', 'Judah', 'Levi'],
      crisisId: null,
      phase: 'preResolve',
    });
    s = patchPlayer(s, idAt(s, 0), { leaderLevel: 3 });
    s = withTokens(s, [
      { playerId: idAt(s, 1), track: 'military', count: 4 },
      { playerId: idAt(s, 2), track: 'military', count: 3 },
      { playerId: idAt(s, 0), track: 'military', count: 1 },
    ]);
    s = resolveRound(s);
    expect(playerOf(s, idAt(s, 0)).oncePerGameUsed['boldClaim']).toBeUndefined();
  });

  it('is locked behind Level III', () => {
    const s = resolveRound(secondPlace(2));
    expect(playerOf(s, idAt(s, 0)).oncePerGameUsed['boldClaim']).toBeUndefined();
  });
});

describe("Naphtali I — Doe's Leap", () => {
  it('shifts a token after the reveal', () => {
    let s = scenario({
      tribes: ['Naphtali', 'Levi'],
      crisisId: null,
      phase: 'preResolve',
    });
    const naphtali = idAt(s, 0);
    expect(canShiftToken(s, naphtali)).toBe(false);

    s = patchPlayer(s, naphtali, { leaderLevel: 1 });
    s = withTokens(s, [{ playerId: naphtali, track: 'military', count: 1 }]);
    expect(canShiftToken(s, naphtali)).toBe(true);
    expect(hasPreResolveChoice(s, naphtali)).toBe(true);

    const token = s.tokens.find((t) => t.playerId === naphtali)!;
    s = dispatch(s, { type: 'shiftToken', tokenId: token.id, toTrack: 'moral' });

    expect(s.tokens.find((t) => t.id === token.id)!.track).toBe('moral');
    expect(canShiftToken(s, naphtali)).toBe(false);
  });

  it('leaps once a generation, not once a game', () => {
    let s = scenario({
      tribes: ['Naphtali', 'Levi'],
      crisisId: null,
      phase: 'preResolve',
    });
    const naphtali = idAt(s, 0);
    s = patchPlayer(s, naphtali, {
      leaderLevel: 1,
      oncePerRoundUsed: { doesLeap: true },
    });
    s = withTokens(s, [{ playerId: naphtali, track: 'military', count: 1 }]);
    expect(canShiftToken(s, naphtali)).toBe(false);

    s = patchPlayer(s, naphtali, { oncePerRoundUsed: {} });
    expect(canShiftToken(s, naphtali)).toBe(true);
  });
});

describe('Naphtali II — Swift Response', () => {
  it('banks a debt when Naphtali Champions', () => {
    let s = scenario({
      tribes: ['Naphtali', 'Levi'],
      crisisId: null,
      phase: 'preResolve',
    });
    const naphtali = idAt(s, 0);
    s = patchPlayer(s, naphtali, { leaderLevel: 2 });
    s = withTokens(s, [{ playerId: naphtali, track: 'military', count: 3 }]);

    s = resolveRound(s);
    expect(playerOf(s, naphtali).pendingTempInfluenceGift).toBe(1);
  });

  it('hands the Influence to the tribe Naphtali names', () => {
    let s = readyToPlace(['Naphtali', 'Levi'], 2);
    const naphtali = idAt(s, 0);
    const levi = idAt(s, 1);
    s = patchPlayer(s, naphtali, { pendingTempInfluenceGift: 1 });

    s = dispatch(s, {
      type: 'confirmPlacement',
      plan: { military: { warriors: 1 } },
      extras: { giftTo: { playerId: levi, track: 'moral' } },
    });

    const gift = s.tokens.filter((t) => t.playerId === levi && t.track === 'moral');
    expect(gift).toHaveLength(1);
    // Supply: help sent, not a banner planted on someone else's behalf.
    expect(gift[0]!.paidWith).toBeNull();
    expect(getTrackTotals(s).banner.moral[levi]).toBeUndefined();
    expect(playerOf(s, naphtali).pendingTempInfluenceGift).toBe(0);
  });

  it('cannot be given to yourself, and is not lost trying', () => {
    let s = readyToPlace(['Naphtali', 'Levi'], 2);
    const naphtali = idAt(s, 0);
    s = patchPlayer(s, naphtali, { pendingTempInfluenceGift: 1 });

    s = dispatch(s, {
      type: 'confirmPlacement',
      plan: { military: { warriors: 1 } },
      extras: { giftTo: { playerId: naphtali, track: 'moral' } },
    });

    expect(s.tokens.filter((t) => t.playerId === naphtali && t.temporary)).toHaveLength(0);
    expect(playerOf(s, naphtali).pendingTempInfluenceGift).toBe(1);
  });
});

describe('Naphtali III — Northern Alliance', () => {
  function armed(): { s: GameState; naphtali: string } {
    let s = scenario({
      tribes: ['Naphtali', 'Levi'],
      crisisId: null,
      phase: 'preResolve',
    });
    const naphtali = idAt(s, 0);
    s = patchPlayer(s, naphtali, { leaderLevel: 3 });
    return { s, naphtali };
  }

  it('adds 1 to each of the two named tracks', () => {
    let { s, naphtali } = armed();
    s = withTokens(s, [
      { playerId: naphtali, track: 'military', count: 2 },
      { playerId: naphtali, track: 'provision', count: 1 },
      { playerId: naphtali, track: 'moral', count: 1 },
    ]);

    s = declareAlliance(s, naphtali, ['military', 'provision']).state;

    const t = getTrackTotals(s);
    expect(t.total.military[naphtali]).toBe(3);
    expect(t.total.provision[naphtali]).toBe(2);
    expect(t.total.moral[naphtali]).toBe(1);
  });

  it('strengthens a Banner it already stands behind', () => {
    let { s, naphtali } = armed();
    s = withTokens(s, [{ playerId: naphtali, track: 'military', count: 2 }]);
    s = declareAlliance(s, naphtali, ['military', 'moral']).state;
    expect(getTrackTotals(s).banner.military[naphtali]).toBe(3);
  });

  it('gives nothing on a track Naphtali never turned out for', () => {
    let { s, naphtali } = armed();
    s = withTokens(s, [{ playerId: naphtali, track: 'military', count: 1 }]);
    s = declareAlliance(s, naphtali, ['military', 'moral']).state;

    const t = getTrackTotals(s);
    expect(t.total.moral[naphtali]).toBeUndefined();
    expect(t.total.military[naphtali]).toBe(2);
  });

  it('refuses two of the same track', () => {
    const { s, naphtali } = armed();
    const tracks: [TrackId, TrackId] = ['military', 'military'];
    expect(declareAlliance(s, naphtali, tracks).ok).toBe(false);
  });

  it('is sworn once a game and lapses at the end of the generation', () => {
    let { s, naphtali } = armed();
    s = carryAllTracks(s, naphtali);
    s = declareAlliance(s, naphtali, ['military', 'moral']).state;
    expect(canDeclareAlliance(s, naphtali)).toBe(false);

    s = dispatch(s, { type: 'advance' });
    s = dispatch(s, { type: 'advance' });

    // The alliance itself is cleared with the generation, but it can never be
    // called again.
    expect(playerOf(s, naphtali).alliance).toBeNull();
    expect(canDeclareAlliance(s, naphtali)).toBe(false);
  });

  it('is locked behind Level III', () => {
    let s = scenario({ tribes: ['Naphtali', 'Levi'], crisisId: null, phase: 'preResolve' });
    s = patchPlayer(s, idAt(s, 0), { leaderLevel: 2 });
    expect(canDeclareAlliance(s, idAt(s, 0))).toBe(false);
  });
});
