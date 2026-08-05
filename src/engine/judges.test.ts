/**
 * The six Judge one-shots, and the pre-resolve window they are spent in.
 */
import { describe, expect, it } from 'vitest';
import { getTrackTotals, OTHNIEL_ZEAL_BONUS } from './helpers';
import { dispatch } from './index';
import { applyJudgePower, JUDGE_POWER_WINDOW, settleJephthahVows } from './judges';
import {
  canRescue,
  canSamsonMove,
  endGame,
  hasPreResolveChoice,
  resolveRound,
  revealTokens,
} from './resolve';
import {
  carryTrack,
  idAt,
  patchPlayer,
  playerOf,
  scenario,
  setResources,
  withTokens,
} from './testSupport';
import type { GameState, OppressorId } from './types';

/** Hand a player a Judge power and put the game in the right phase for it. */
function holding(
  power: OppressorId,
  opts: { tribes?: [string, string]; phase?: GameState['phase'] } = {},
) {
  const tribes = (opts.tribes ?? ['Judah', 'Levi']) as never;
  let s = scenario({ tribes, crisisId: null });
  const me = idAt(s, 0);
  s = patchPlayer(s, me, { judgePower: power, judgePowerExpires: 99 });
  s = { ...s, phase: opts.phase ?? JUDGE_POWER_WINDOW[power] === 'action' ? 'action' : 'preResolve' };
  return { s, me };
}

describe('spending a Judge power', () => {
  it('is refused in the wrong window', () => {
    // Samson's Strength belongs to pre-resolve, not to your turn.
    const { s, me } = holding('philistia', { phase: 'action' });
    const r = applyJudgePower(s, me, { type: 'judgePower', track: 'military' });
    expect(r.ok).toBe(false);
    expect(playerOf(r.state, me).judgePower).toBe('philistia');
  });

  it('is refused without a track when the power needs one', () => {
    const { s, me } = holding('midian');
    expect(applyJudgePower(s, me, { type: 'judgePower' }).ok).toBe(false);
  });

  it('is refused when the player holds nothing', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], crisisId: null });
    s = { ...s, phase: 'preResolve' };
    expect(
      applyJudgePower(s, idAt(s, 0), { type: 'judgePower', track: 'moral' }).ok,
    ).toBe(false);
  });

  it('can only ever be spent once', () => {
    let { s, me } = holding('ammon');
    const first = applyJudgePower(s, me, { type: 'judgePower' });
    expect(first.ok).toBe(true);
    expect(playerOf(first.state, me).judgePower).toBeNull();
    expect(applyJudgePower(first.state, me, { type: 'judgePower' }).ok).toBe(false);
  });
});

describe("Othniel's Zeal", () => {
  it('adds to Moral Banner strength at resolution', () => {
    let { s, me } = holding('aram', { tribes: ['Levi', 'Judah'] });
    s = withTokens(s, [{ playerId: me, track: 'moral', count: 2 }]);

    s = applyJudgePower(s, me, { type: 'judgePower' }).state;

    const tallies = getTrackTotals(s);
    expect(tallies.banner.moral[me]).toBe(2 + OTHNIEL_ZEAL_BONUS);
    expect(tallies.total.moral[me]).toBe(2 + OTHNIEL_ZEAL_BONUS);
  });

  it('does nothing without a Moral Banner to strengthen', () => {
    let { s, me } = holding('aram', { tribes: ['Levi', 'Judah'] });
    s = applyJudgePower(s, me, { type: 'judgePower' }).state;
    expect(getTrackTotals(s).banner.moral[me]).toBeUndefined();
  });
});

describe("Ehud's Hidden Dagger", () => {
  it('takes one Influence off the named player', () => {
    let { s, me } = holding('moab', { phase: 'action' });
    const victim = idAt(s, 1);
    s = withTokens(s, [{ playerId: victim, track: 'moral', count: 2 }]);

    const r = applyJudgePower(s, me, { type: 'judgePower', targetPlayerId: victim });

    expect(r.ok).toBe(true);
    expect(r.state.tokens.filter((t) => t.playerId === victim)).toHaveLength(1);
  });

  it('cannot be turned on yourself', () => {
    let { s, me } = holding('moab', { phase: 'action' });
    s = withTokens(s, [{ playerId: me, track: 'moral', count: 2 }]);
    expect(
      applyJudgePower(s, me, { type: 'judgePower', targetPlayerId: me }).ok,
    ).toBe(false);
  });

  it('is refused when the target has nothing on the board', () => {
    const { s, me } = holding('moab', { phase: 'action' });
    expect(
      applyJudgePower(s, me, { type: 'judgePower', targetPlayerId: idAt(s, 1) }).ok,
    ).toBe(false);
  });
});

describe("Deborah's Summons", () => {
  it('gives every tribe Influence on the named track', () => {
    const { s, me } = holding('hazor', { phase: 'action' });
    const r = applyJudgePower(s, me, { type: 'judgePower', track: 'provision' });

    expect(r.ok).toBe(true);
    for (const p of r.state.players) {
      expect(
        r.state.tokens.filter((t) => t.playerId === p.id && t.track === 'provision'),
      ).toHaveLength(1);
    }
  });

  it('summons Supply, so it cannot hand anyone a Championship', () => {
    const { s, me } = holding('hazor', { phase: 'action' });
    const r = applyJudgePower(s, me, { type: 'judgePower', track: 'provision' });
    const tallies = getTrackTotals(r.state);
    expect(tallies.total.provision[me]).toBe(1);
    expect(tallies.banner.provision[me]).toBeUndefined();
  });
});

describe("Gideon's Three Hundred", () => {
  it('takes the named track outright against a larger force', () => {
    let { s, me } = holding('midian', { tribes: ['Dan', 'Benjamin'] });
    const rival = idAt(s, 1);
    s = withTokens(s, [
      { playerId: me, track: 'military', count: 1 },
      { playerId: rival, track: 'military', count: 6 },
    ]);

    s = applyJudgePower(s, me, { type: 'judgePower', track: 'military' }).state;
    s = resolveRound(s);

    const r = s.trackResults!.find((x) => x.track === 'military')!;
    expect(r.championId).toBe(me);
  });

  it('needs at least one Banner of its own to claim with', () => {
    let { s, me } = holding('midian', { tribes: ['Dan', 'Benjamin'] });
    const rival = idAt(s, 1);
    s = withTokens(s, [{ playerId: rival, track: 'military', count: 3 }]);

    s = applyJudgePower(s, me, { type: 'judgePower', track: 'military' }).state;
    s = resolveRound(s);

    expect(s.trackResults!.find((x) => x.track === 'military')!.championId).toBe(rival);
  });
});

describe("Jephthah's Vow", () => {
  it('pays 3 Glory at once', () => {
    const { s, me } = holding('ammon', { phase: 'action' });
    const r = applyJudgePower(s, me, { type: 'judgePower' });
    expect(playerOf(r.state, me).resources.glory).toBe(3);
    expect(playerOf(r.state, me).jephthahVow).toBe(true);
  });

  it('takes the largest single store at the end of the game', () => {
    let { s, me } = holding('ammon', { phase: 'action' });
    s = applyJudgePower(s, me, { type: 'judgePower' }).state;
    s = setResources(s, me, { faith: 2, warriors: 7, goods: 3 });

    s = settleJephthahVows(s);

    const p = playerOf(s, me);
    expect(p.resources.warriors).toBe(0);
    expect(p.resources.faith).toBe(2);
    expect(p.resources.goods).toBe(3);
  });

  it('comes due automatically when the game ends', () => {
    let { s, me } = holding('ammon', { phase: 'action' });
    s = applyJudgePower(s, me, { type: 'judgePower' }).state;
    s = setResources(s, me, { faith: 0, warriors: 5, goods: 0 });

    s = endGame(s);
    expect(playerOf(s, me).resources.warriors).toBe(0);
  });

  it('costs nothing from a player left with nothing', () => {
    let { s, me } = holding('ammon', { phase: 'action' });
    s = applyJudgePower(s, me, { type: 'judgePower' }).state;
    s = setResources(s, me, { faith: 0, warriors: 0, goods: 0 });
    expect(() => settleJephthahVows(s)).not.toThrow();
  });
});

describe("Samson's Strength", () => {
  it('doubles Banner Influence on the named track', () => {
    let { s, me } = holding('philistia', { tribes: ['Dan', 'Levi'] });
    s = withTokens(s, [{ playerId: me, track: 'military', count: 3 }]);

    s = applyJudgePower(s, me, { type: 'judgePower', track: 'military' }).state;

    expect(getTrackTotals(s).banner.military[me]).toBe(6);
  });
});

describe('the pre-resolve window', () => {
  it('holds after the reveal instead of scoring straight away', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], phase: 'action', crisisId: null });
    s = revealTokens(s);
    expect(s.phase).toBe('preResolve');
    expect(s.trackResults).toBeNull();
  });

  it('scores once the table advances', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], phase: 'action', crisisId: null });
    s = dispatch(revealTokens(s), { type: 'advance' });
    expect(s.phase).toBe('resolve');
    expect(s.trackResults).not.toBeNull();
  });

  it('reports who still has something to decide', () => {
    let s = scenario({ tribes: ['Dan', 'Levi'], phase: 'preResolve', crisisId: null });
    const dan = idAt(s, 0);
    expect(hasPreResolveChoice(s, dan)).toBe(false);

    s = patchPlayer(s, dan, { leaderLevel: 2 });
    s = carryTrack(s, dan, 'military');
    expect(canSamsonMove(s, dan)).toBe(true);
    expect(hasPreResolveChoice(s, dan)).toBe(true);
  });

  it('offers the rescue only to a Level III tribe that has one', () => {
    let s = scenario({ tribes: ['Gad', 'Levi'], phase: 'preResolve', crisisId: null });
    const gad = idAt(s, 0);
    expect(canRescue(s, gad)).toBe(false);

    s = patchPlayer(s, gad, { leaderLevel: 3 });
    expect(canRescue(s, gad)).toBe(true);

    s = patchPlayer(s, gad, { oncePerGameUsed: { rescue: true } });
    expect(canRescue(s, gad)).toBe(false);
  });
});
