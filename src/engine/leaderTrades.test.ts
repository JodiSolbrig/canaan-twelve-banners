/**
 * Leader trades — Zebulun I, Simeon III, Ephraim III.
 *
 * The rule that binds all three is that they are free of the action, so the
 * dispatch-level tests here matter as much as the arithmetic: a trade that
 * quietly ate the player's turn would look correct in every resource assertion
 * and still be the wrong rule.
 */
import { describe, expect, it } from 'vitest';
import { applyLeaderTrade, availableLeaderTrade } from './actions';
import { dispatch } from './index';
import { idAt, patchPlayer, playerOf, scenario, setResources } from './testSupport';
import type { GameState } from './types';

/** A scenario sitting in the action phase with the named tribe to act. */
function acting(tribe: 'Zebulun' | 'Simeon' | 'Ephraim', level: number): GameState {
  const s = scenario({
    tribes: [tribe, 'Levi'],
    phase: 'action',
    crisisId: null,
    round: 3,
  });
  return patchPlayer(s, idAt(s, 0), { leaderLevel: level });
}

describe('availableLeaderTrade', () => {
  it('is locked until the upgrade level is reached', () => {
    const s = acting('Simeon', 2);
    expect(availableLeaderTrade(s, idAt(s, 0))).toBeNull();
    expect(availableLeaderTrade(acting('Simeon', 3), idAt(s, 0))).not.toBeNull();
  });

  it('is offered from level I for Zebulun, whose trade is its first upgrade', () => {
    const s = acting('Zebulun', 1);
    expect(availableLeaderTrade(s, idAt(s, 0))?.name).toBe('Sea Trader');
  });

  it('is null for a tribe with no standing trade', () => {
    const s = scenario({ tribes: ['Judah', 'Levi'], phase: 'action' });
    const judah = patchPlayer(s, idAt(s, 0), { leaderLevel: 3 });
    expect(availableLeaderTrade(judah, idAt(s, 0))).toBeNull();
  });
});

describe('rates', () => {
  it('Sea Trader moves Faith and Goods one for one, both ways', () => {
    let s = acting('Zebulun', 1);
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 3, goods: 3 });

    const out = applyLeaderTrade(s, me, { type: 'leaderTrade', from: 'faith', to: 'goods' });
    expect(out.ok).toBe(true);
    expect(playerOf(out.state, me).resources).toMatchObject({ faith: 2, goods: 4 });

    const back = applyLeaderTrade(s, me, { type: 'leaderTrade', from: 'goods', to: 'faith' });
    expect(back.ok).toBe(true);
    expect(playerOf(back.state, me).resources).toMatchObject({ faith: 4, goods: 2 });
  });

  it('Raid Leader moves Goods and Warriors one for one, at no loss', () => {
    let s = acting('Simeon', 3);
    const me = idAt(s, 0);
    s = setResources(s, me, { goods: 2, warriors: 2 });

    const r = applyLeaderTrade(s, me, { type: 'leaderTrade', from: 'goods', to: 'warriors' });
    expect(r.ok).toBe(true);
    expect(playerOf(r.state, me).resources).toMatchObject({ goods: 1, warriors: 3 });
  });

  it('Landed Authority spends 2 Goods for 1 of either, the printed Convert rate', () => {
    let s = acting('Ephraim', 3);
    const me = idAt(s, 0);
    s = setResources(s, me, { goods: 4, faith: 0, warriors: 0 });

    const r = applyLeaderTrade(s, me, { type: 'leaderTrade', from: 'goods', to: 'faith' });
    expect(r.ok).toBe(true);
    expect(playerOf(r.state, me).resources).toMatchObject({ goods: 2, faith: 1 });
  });

  it('refuses a direction the leader does not trade in', () => {
    let s = acting('Ephraim', 3);
    const me = idAt(s, 0);
    s = setResources(s, me, { goods: 4, faith: 4 });
    // Landed Authority buys with Goods only; it never sells them.
    const r = applyLeaderTrade(s, me, { type: 'leaderTrade', from: 'faith', to: 'goods' });
    expect(r.ok).toBe(false);
    expect(playerOf(r.state, me).resources).toMatchObject({ goods: 4, faith: 4 });
  });

  it('refuses a trade it cannot pay the rate for', () => {
    let s = acting('Ephraim', 3);
    const me = idAt(s, 0);
    s = setResources(s, me, { goods: 1 });
    const r = applyLeaderTrade(s, me, { type: 'leaderTrade', from: 'goods', to: 'warriors' });
    expect(r.ok).toBe(false);
    expect(playerOf(r.state, me).resources.goods).toBe(1);
  });
});

describe('once per round', () => {
  it('bars a second trade in the same round', () => {
    let s = acting('Simeon', 3);
    const me = idAt(s, 0);
    s = setResources(s, me, { goods: 5, warriors: 0 });

    const first = applyLeaderTrade(s, me, { type: 'leaderTrade', from: 'goods', to: 'warriors' });
    expect(first.ok).toBe(true);
    expect(availableLeaderTrade(first.state, me)).toBeNull();

    const second = applyLeaderTrade(first.state, me, {
      type: 'leaderTrade',
      from: 'goods',
      to: 'warriors',
    });
    expect(second.ok).toBe(false);
    expect(playerOf(second.state, me).resources.warriors).toBe(1);
  });
});

describe('free of the action', () => {
  it('does not consume the turn or advance the phase', () => {
    let s = acting('Zebulun', 1);
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 3, goods: 3 });
    const actorBefore = s.currentActorIndex;

    const after = dispatch(s, { type: 'leaderTrade', from: 'faith', to: 'goods' });

    expect(after.phase).toBe('action');
    expect(after.currentActorIndex).toBe(actorBefore);
    expect(playerOf(after, me).resources).toMatchObject({ faith: 2, goods: 4 });
  });

  it('leaves the player a full action to take afterwards', () => {
    let s = acting('Zebulun', 1);
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 3, goods: 3 });

    let after = dispatch(s, { type: 'leaderTrade', from: 'faith', to: 'goods' });
    after = dispatch(after, { type: 'standard', action: 'pray', prayMode: 'rest' });

    // Prayed for 2 Faith on top of the 2 left after trading one away.
    expect(playerOf(after, me).resources.faith).toBe(4);
    expect(after.currentActorIndex).not.toBe(s.currentActorIndex);
  });

  it('is refused outside the action phase', () => {
    let s = acting('Zebulun', 1);
    const me = idAt(s, 0);
    s = setResources(s, me, { faith: 3, goods: 3 });

    const placing = dispatch({ ...s, phase: 'placement' }, {
      type: 'leaderTrade',
      from: 'faith',
      to: 'goods',
    });

    expect(playerOf(placing, me).resources).toMatchObject({ faith: 3, goods: 3 });
  });
});

describe('Micah’s Idol', () => {
  it('blocks trading Faith away, but not trading for it', () => {
    let s = scenario({
      tribes: ['Zebulun', 'Levi'],
      phase: 'action',
      crisisId: 7,
      round: 3,
    });
    const me = idAt(s, 0);
    s = patchPlayer(s, me, { leaderLevel: 1 });
    s = setResources(s, me, { faith: 3, goods: 3 });

    const away = applyLeaderTrade(s, me, { type: 'leaderTrade', from: 'faith', to: 'goods' });
    expect(away.ok).toBe(false);

    const toward = applyLeaderTrade(s, me, { type: 'leaderTrade', from: 'goods', to: 'faith' });
    expect(toward.ok).toBe(true);
  });
});
