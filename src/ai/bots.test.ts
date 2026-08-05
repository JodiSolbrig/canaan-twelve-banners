/**
 * Bot placement, and specifically the Banner/Supply split.
 *
 * The bot is the only opponent the balance harness has, so anything it never
 * plays is a rule the harness cannot measure. Supply spent a release in that
 * position — the numbers said the rule was inert when in fact nobody was
 * playing it — hence the coverage here.
 */
import { describe, expect, it } from 'vitest';
import { TRACK_AFFINITY_RESOURCE } from '../engine/helpers';
import {
  idAt,
  scenario,
  setResources,
  withOppression,
} from '../engine/testSupport';
import type {
  GameState,
  PlacementPlan,
  SpendableResource,
  TrackId,
} from '../engine/types';
import { chooseBotAction } from './bots';

const TRACKS: TrackId[] = ['military', 'moral', 'provision'];

/** The plan the seated bot would confirm right now. */
function planFor(state: GameState): PlacementPlan {
  const action = chooseBotAction(state);
  expect(action?.type).toBe('confirmPlacement');
  return action?.type === 'confirmPlacement' ? action.plan : {};
}

/** Tokens in a plan that are Supply — paid with something off-affinity. */
function supplyOn(plan: PlacementPlan, track: TrackId): number {
  const spend = plan[track] ?? {};
  const affinity = TRACK_AFFINITY_RESOURCE[track];
  let n = 0;
  for (const [res, count] of Object.entries(spend)) {
    if (res !== affinity) n += count ?? 0;
  }
  return n;
}

function bannerOn(plan: PlacementPlan, track: TrackId): number {
  return plan[track]?.[TRACK_AFFINITY_RESOURCE[track]] ?? 0;
}

/**
 * A rich Judah bot in seat 1, ready to place. Judah is Military, so Warriors are
 * its Banner resource and Faith and Goods are the only things it can Supply with.
 */
function richBot(resources: Partial<Record<SpendableResource, number>> = {}) {
  const base = scenario({ tribes: ['Levi', 'Judah'], round: 3 });
  const bot = idAt(base, 1);
  return {
    state: setResources(base, bot, {
      warriors: 6,
      faith: 6,
      goods: 6,
      ...resources,
    }),
    bot,
  };
}

describe('bot placement — Banners', () => {
  it('commits its affinity resource to its own track', () => {
    const { state } = richBot();
    const plan = planFor({ ...state, currentActorIndex: 1 });
    expect(bannerOn(plan, 'military')).toBeGreaterThan(0);
  });

  it('places nothing at all when it has nothing to spend', () => {
    const { state } = richBot({ warriors: 0, faith: 0, goods: 0 });
    const plan = planFor({ ...state, currentActorIndex: 1 });
    for (const track of TRACKS) {
      expect(bannerOn(plan, track) + supplyOn(plan, track)).toBe(0);
    }
  });
});

describe('bot placement — Supply', () => {
  it('sends Supply to tracks it did not Banner', () => {
    const { state } = richBot();
    const plan = planFor({ ...state, currentActorIndex: 1 });
    const unbannered = TRACKS.filter((t) => bannerOn(plan, t) === 0);
    expect(unbannered.length).toBeGreaterThan(0);
    for (const track of unbannered) {
      expect(supplyOn(plan, track)).toBe(1);
    }
  });

  it('never sends more than one Supply to a track, because the spoil is flat', () => {
    const { state } = richBot({ warriors: 12, faith: 12, goods: 12 });
    const plan = planFor({ ...state, currentActorIndex: 1 });
    for (const track of TRACKS) {
      expect(supplyOn(plan, track)).toBeLessThanOrEqual(1);
    }
  });

  it('leaves a track it declined to contest without a Banner on it', () => {
    // The Supply pass must not quietly re-open the Championship decision the
    // Banner pass already declined: an unbannered track stays unbannered.
    const { state } = richBot();
    const plan = planFor({ ...state, currentActorIndex: 1 });
    const supplied = TRACKS.filter((t) => supplyOn(plan, t) > 0);
    expect(supplied.length).toBeGreaterThan(0);
    for (const track of supplied) {
      expect(bannerOn(plan, track)).toBe(0);
    }
  });

  it('holds its Faith back for the Cry while Israel is oppressed', () => {
    const { state } = richBot();
    const oppressed = withOppression(
      { ...state, currentActorIndex: 1 },
      'aram',
    );
    const plan = planFor(oppressed);
    // Faith may still fly as a Banner on Moral, which is what it is for. What
    // it may not do is go out as Supply on a track it cannot even win.
    expect(plan.military?.faith ?? 0).toBe(0);
    expect(plan.provision?.faith ?? 0).toBe(0);
  });

  it('keeps a reserve rather than lending its last spare resource', () => {
    // One Faith and one Goods is the reserve exactly, so neither is lendable.
    const { state } = richBot({ warriors: 4, faith: 1, goods: 1 });
    const plan = planFor({ ...state, currentActorIndex: 1 });
    for (const track of TRACKS) {
      expect(supplyOn(plan, track)).toBe(0);
    }
  });

  it('keeps a deeper reserve of its own Banner resource', () => {
    // Judah's Warriors are its Banners. With Faith and Goods gone, the only
    // thing it could Supply with is Warriors, and it holds two back for the
    // next generation rather than lending them to a track it is not contesting.
    const { state } = richBot({ warriors: 2, faith: 0, goods: 0 });
    const plan = planFor({ ...state, currentActorIndex: 1 });
    expect(supplyOn(plan, 'moral')).toBe(0);
    expect(supplyOn(plan, 'provision')).toBe(0);
  });
});
