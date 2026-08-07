/**
 * Issachar I (Understanding of Times) and Issachar III (Wise Counsel) — "men who
 * had understanding of the times, to know what Israel ought to do" (1 Chr 12:32).
 *
 * Both deliberately break a rule the rest of the engine keeps. The study reads
 * face-down Influence, which no scoring rule may do; the counsel reaches across
 * the table and moves a token off someone else's board, which nothing else does.
 * The tests below are mostly about the fences around those two exceptions.
 */
import { describe, expect, it } from 'vitest';
import { canStudyTrack, studyTrack } from './actions';
import { applyWiseCounsel, canWiseCounsel } from './resolve';
import { baseThreshold } from './helpers';
import { dispatch } from './index';
import { startRound } from './round';
import {
  idAt,
  patchPlayer,
  playerOf,
  scenario,
  withTokens,
} from './testSupport';
import type { GameState } from './types';

function issachar(level: number, phase: GameState['phase'] = 'placement') {
  const s = scenario({
    tribes: ['Issachar', 'Levi', 'Judah'],
    phase,
    crisisId: null,
    round: 3,
  });
  return patchPlayer(s, idAt(s, 0), { leaderLevel: level });
}

describe('Understanding of Times', () => {
  it('is locked until level I', () => {
    expect(canStudyTrack(issachar(0), idAt(issachar(0), 0))).toBe(false);
    expect(canStudyTrack(issachar(1), idAt(issachar(1), 0))).toBe(true);
  });

  it('belongs to Issachar alone', () => {
    let s = scenario({ tribes: ['Judah', 'Levi'], phase: 'placement' });
    s = patchPlayer(s, idAt(s, 0), { leaderLevel: 3 });
    expect(canStudyTrack(s, idAt(s, 0))).toBe(false);
  });

  it('reports the track against its real threshold, face-down tokens included', () => {
    let s = issachar(1);
    const me = idAt(s, 0);
    const rival = idAt(s, 1);
    // Two of the rival's tokens are face down; the study sees them anyway.
    s = withTokens(s, [{ playerId: rival, track: 'moral', count: 2 }]);

    const out = studyTrack(s, me, 'moral');

    expect(out.ok).toBe(true);
    expect(playerOf(out.state, me).peekedTrack).toEqual({
      track: 'moral',
      total: 2,
      threshold: baseThreshold(s, 'moral'),
    });
  });

  it('is once a round, and comes back next generation', () => {
    let s = issachar(1);
    const me = idAt(s, 0);
    s = studyTrack(s, me, 'military').state;
    expect(canStudyTrack(s, me)).toBe(false);
    expect(studyTrack(s, me, 'moral').ok).toBe(false);

    const next = startRound({ ...s, round: s.round + 1 });
    expect(canStudyTrack(next, idAt(next, 0))).toBe(true);
    // The old reading does not linger into a generation it is not true of.
    expect(playerOf(next, me).peekedTrack).toBeNull();
  });

  it('does not spend the placement', () => {
    const s = issachar(1);
    const before = s.currentActorIndex;
    const after = dispatch(s, { type: 'studyTrack', track: 'provision' });
    expect(after.phase).toBe('placement');
    expect(after.currentActorIndex).toBe(before);
  });
});

describe('Wise Counsel', () => {
  it('is locked until level III', () => {
    for (const level of [1, 2]) {
      let s = issachar(level, 'preResolve');
      s = withTokens(s, [{ playerId: idAt(s, 1), track: 'moral', count: 1 }]);
      expect(canWiseCounsel(s, idAt(s, 0))).toBe(false);
    }
  });

  it('needs somebody else to have a token of their own', () => {
    const bare = issachar(3, 'preResolve');
    expect(canWiseCounsel(bare, idAt(bare, 0))).toBe(false);

    // Your own tokens do not count — the ability is about other people.
    const mine = withTokens(bare, [
      { playerId: idAt(bare, 0), track: 'moral', count: 3 },
    ]);
    expect(canWiseCounsel(mine, idAt(mine, 0))).toBe(false);
  });

  it('moves a rival token, turning their Banner into Supply', () => {
    let s = issachar(3, 'preResolve');
    const me = idAt(s, 0);
    const rival = idAt(s, 1);
    // A Warrior-paid token on Military is a Banner and can claim the track.
    s = withTokens(s, [{ playerId: rival, track: 'military', count: 1 }]);
    const token = s.tokens.find((t) => t.playerId === rival)!;

    const out = applyWiseCounsel(s, me, token.id, 'moral');

    expect(out.ok).toBe(true);
    const moved = out.state.tokens.find((t) => t.id === token.id)!;
    expect(moved.track).toBe('moral');
    // Still paid with Warriors, but Moral's affinity is Faith — so it is Supply
    // now, and claims nothing.
    expect(moved.paidWith).toBe('warriors');
  });

  it('refuses your own token', () => {
    let s = issachar(3, 'preResolve');
    const me = idAt(s, 0);
    s = withTokens(s, [
      { playerId: me, track: 'moral', count: 1 },
      { playerId: idAt(s, 1), track: 'military', count: 1 },
    ]);
    const mine = s.tokens.find((t) => t.playerId === me)!;
    expect(applyWiseCounsel(s, me, mine.id, 'military').ok).toBe(false);
  });

  it('refuses a gifted token — you advise a tribe, you do not confiscate a gift', () => {
    let s = issachar(3, 'preResolve');
    const me = idAt(s, 0);
    const rival = idAt(s, 1);
    s = withTokens(s, [
      { playerId: rival, track: 'moral', count: 1, paidWith: null },
    ]);
    const gift = s.tokens.find((t) => t.playerId === rival)!;
    s = { ...s, tokens: s.tokens.map((t) => ({ ...t, temporary: true })) };
    expect(canWiseCounsel(s, me)).toBe(false);
    expect(applyWiseCounsel(s, me, gift.id, 'military').ok).toBe(false);
  });

  it('refuses a move to the track the token is already on', () => {
    let s = issachar(3, 'preResolve');
    s = withTokens(s, [{ playerId: idAt(s, 1), track: 'moral', count: 1 }]);
    const token = s.tokens[0]!;
    expect(applyWiseCounsel(s, idAt(s, 0), token.id, 'moral').ok).toBe(false);
  });

  it('is once per game', () => {
    let s = issachar(3, 'preResolve');
    const me = idAt(s, 0);
    s = withTokens(s, [{ playerId: idAt(s, 1), track: 'military', count: 2 }]);
    const [a, b] = s.tokens;

    s = applyWiseCounsel(s, me, a!.id, 'moral').state;
    expect(canWiseCounsel(s, me)).toBe(false);
    expect(applyWiseCounsel(s, me, b!.id, 'moral').ok).toBe(false);
    // The second token stayed where it was.
    expect(s.tokens.find((t) => t.id === b!.id)!.track).toBe('military');
  });

  it('is refused outside the post-reveal window', () => {
    let s = issachar(3, 'placement');
    s = withTokens(s, [{ playerId: idAt(s, 1), track: 'military', count: 1 }]);
    const token = s.tokens[0]!;
    const after = dispatch(s, {
      type: 'wiseCounsel',
      tokenId: token.id,
      toTrack: 'moral',
    });
    expect(after.tokens.find((t) => t.id === token.id)!.track).toBe('military');
  });
});
