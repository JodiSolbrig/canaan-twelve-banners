/** Read-only queries over a draft PlacementPlan, shared by the grid and controls. */
import { TRACK_AFFINITY_RESOURCE } from '../engine';
import type {
  PlacementPlan,
  Resources,
  SpendableResource,
  TrackId,
} from '../engine/types';

export const PLAN_TRACKS: TrackId[] = ['military', 'moral', 'provision'];
export const PLAN_RESOURCES: SpendableResource[] = ['warriors', 'faith', 'goods'];

export const RESOURCE_LABEL: Record<SpendableResource, string> = {
  warriors: 'Warriors',
  faith: 'Faith',
  goods: 'Goods',
};

/** How much of one resource the whole plan spends. */
export function spentOf(plan: PlacementPlan, res: SpendableResource): number {
  return PLAN_TRACKS.reduce((n, t) => n + (plan[t]?.[res] ?? 0), 0);
}

/** Tokens the plan places on one track, Banner and Supply together. */
export function tokensOn(plan: PlacementPlan, track: TrackId): number {
  return PLAN_RESOURCES.reduce((n, r) => n + (plan[track]?.[r] ?? 0), 0);
}

/** Tokens the plan places on one track that can actually claim Champion. */
export function bannerOn(plan: PlacementPlan, track: TrackId): number {
  return plan[track]?.[TRACK_AFFINITY_RESOURCE[track]] ?? 0;
}

/** Every token the plan places, across all tracks. */
export function planTokens(plan: PlacementPlan): number {
  return PLAN_TRACKS.reduce((n, t) => n + tokensOn(plan, t), 0);
}

/** Warriors Iron Chariots (Crisis 3) adds on top of the plan's own cost. */
export function ironChariotSurcharge(
  plan: PlacementPlan,
  ironChariots: boolean,
): number {
  return ironChariots ? tokensOn(plan, 'military') : 0;
}

/** Whether the plan spends more of any resource than the player holds. */
export function planIsAffordable(
  plan: PlacementPlan,
  resources: Resources,
  ironChariots: boolean,
): boolean {
  return (
    spentOf(plan, 'faith') <= resources.faith &&
    spentOf(plan, 'goods') <= resources.goods &&
    spentOf(plan, 'warriors') + ironChariotSurcharge(plan, ironChariots) <=
      resources.warriors
  );
}
