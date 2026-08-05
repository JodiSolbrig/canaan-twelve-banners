/**
 * Asher III (Rich Harvest) and Zebulun III (Profitable Venture).
 *
 * Both double a single gain of Goods once per game, and the interesting tests
 * are about *which* gain: Asher's card names actions and Champion rewards,
 * Zebulun's names any source at all. Everything reaches the doubler through
 * `grantGoods`, so a source that skipped it would be a silent miss — hence a
 * test per source rather than one representative case.
 */
import { describe, expect, it } from 'vitest';
import { armGoodsDoubler, canArmGoodsDoubler } from './actions';
import { grantGoods } from './helpers';
import { dispatch } from './index';
import {
  idAt,
  patchPlayer,
  playerOf,
  scenario,
  setResources,
} from './testSupport';
import type { GoodsSource } from './helpers';
import type { GameState } from './types';

function armed(tribe: 'Asher' | 'Zebulun'): { state: GameState; me: string } {
  let s = scenario({ tribes: [tribe, 'Levi'], phase: 'action', crisisId: null, round: 3 });
  const me = idAt(s, 0);
  s = patchPlayer(s, me, { leaderLevel: 3 });
  s = setResources(s, me, { goods: 0, faith: 3, warriors: 3 });
  s = armGoodsDoubler(s, me).state;
  return { state: s, me };
}

describe('arming', () => {
  it('is locked below level III', () => {
    let s = scenario({ tribes: ['Asher', 'Levi'], phase: 'action' });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 2 });
    expect(canArmGoodsDoubler(s, me)).toBe(false);
  });

  it('is offered to Asher and Zebulun and nobody else', () => {
    for (const tribe of ['Asher', 'Zebulun'] as const) {
      let s = scenario({ tribes: [tribe, 'Levi'], phase: 'action' });
      const me = idAt(s, 0);
      s = patchPlayer(s, me, { leaderLevel: 3 });
      expect(canArmGoodsDoubler(s, me)).toBe(true);
    }
    let s = scenario({ tribes: ['Judah', 'Levi'], phase: 'action' });
    const judah = idAt(s, 0);
    s = patchPlayer(s, judah, { leaderLevel: 3 });
    expect(canArmGoodsDoubler(s, judah)).toBe(false);
  });

  it('cannot be armed twice, even across generations', () => {
    const { state, me } = armed('Asher');
    expect(canArmGoodsDoubler(state, me)).toBe(false);
    const next = armGoodsDoubler(state, me);
    expect(next.ok).toBe(false);
  });

  it('costs no action — the turn does not advance', () => {
    let s = scenario({ tribes: ['Asher', 'Levi'], phase: 'action', crisisId: null });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 3 });
    const after = dispatch(s, { type: 'armGoodsDoubler' });
    expect(after.phase).toBe('action');
    expect(after.currentActorIndex).toBe(s.currentActorIndex);
    expect(playerOf(after, me).goodsDoublerArmed).toBe(true);
  });
});

describe('what gets doubled', () => {
  it('doubles the next gain and then stops', () => {
    const { state, me } = armed('Zebulun');
    let s = grantGoods(state, me, 2, 'action');
    expect(playerOf(s, me).resources.goods).toBe(4);
    expect(playerOf(s, me).goodsDoublerArmed).toBe(false);

    s = grantGoods(s, me, 2, 'action');
    expect(playerOf(s, me).resources.goods).toBe(6);
  });

  it('waits rather than expiring, so it cannot be wasted', () => {
    const { state, me } = armed('Asher');
    // Nothing gained for two whole generations.
    const later = { ...state, round: state.round + 2 };
    expect(playerOf(later, me).goodsDoublerArmed).toBe(true);
    const s = grantGoods(later, me, 3, 'action');
    expect(playerOf(s, me).resources.goods).toBe(6);
  });

  it('never fires on a gain of nothing', () => {
    const { state, me } = armed('Asher');
    const s = grantGoods(state, me, 0, 'action');
    expect(playerOf(s, me).goodsDoublerArmed).toBe(true);
  });

  it("respects Asher's narrower card — actions and Championships only", () => {
    const fires: GoodsSource[] = ['action', 'champion'];
    const holds: GoodsSource[] = ['spoil', 'income', 'zone'];
    for (const source of fires) {
      const { state, me } = armed('Asher');
      const s = grantGoods(state, me, 2, source);
      expect(playerOf(s, me).resources.goods, source).toBe(4);
    }
    for (const source of holds) {
      const { state, me } = armed('Asher');
      const s = grantGoods(state, me, 2, source);
      expect(playerOf(s, me).resources.goods, source).toBe(2);
      // Still armed — it was not spent on a source the card does not name.
      expect(playerOf(s, me).goodsDoublerArmed, source).toBe(true);
    }
  });

  it("honours Zebulun's 'any source'", () => {
    const every: GoodsSource[] = ['action', 'champion', 'spoil', 'income', 'zone'];
    for (const source of every) {
      const { state, me } = armed('Zebulun');
      const s = grantGoods(state, me, 2, source);
      expect(playerOf(s, me).resources.goods, source).toBe(4);
    }
  });
});

describe('through the real actions', () => {
  it('doubles a Gather', () => {
    const { state, me } = armed('Zebulun');
    const before = playerOf(state, me).resources.goods;
    const after = dispatch(state, {
      type: 'standard',
      action: 'gather',
      gatherSpend: 'warriors',
    });
    // Gather pays 2 Goods, so the doubler makes it 4.
    expect(playerOf(after, me).resources.goods).toBe(before + 4);
  });

  it("doubles Asher's Harvest including Fertile Blessing, as one gain", () => {
    let s = scenario({ tribes: ['Asher', 'Levi'], phase: 'action', crisisId: null, round: 3 });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 3 });
    s = setResources(s, me, { goods: 0, faith: 0 });
    s = armGoodsDoubler(s, me).state;

    const after = dispatch(s, { type: 'unique', tribe: 'Asher', asherMode: 'rest' });
    // 2 base + 1 Fertile Blessing = 3, doubled to 6 — the bonus is part of the
    // harvest, not a separate gain that would waste half the doubler.
    expect(playerOf(after, me).resources.goods).toBe(6);
  });
});
