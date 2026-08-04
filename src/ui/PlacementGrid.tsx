import { TRACK_LABELS } from '../data/gameData';
import { TRACK_AFFINITY_RESOURCE } from '../engine';
import type {
  PlacementPlan,
  Resources,
  SpendableResource,
  TrackId,
} from '../engine/types';
import {
  bannerOn,
  ironChariotSurcharge,
  PLAN_RESOURCES,
  PLAN_TRACKS,
  planIsAffordable,
  RESOURCE_LABEL,
  spentOf,
  tokensOn,
} from './placementPlan';

type Props = {
  plan: PlacementPlan;
  onChange: (plan: PlacementPlan) => void;
  resources: Resources;
  /** Crisis 3 is active — each Military token costs 1 extra Warrior. */
  ironChariots?: boolean;
};

/**
 * The placement decision, laid out so the Banner/Supply split is impossible to
 * miss: one row per track, one column per resource, with the affinity cell
 * marked as the only one that can win the track.
 */
export function PlacementGrid({
  plan,
  onChange,
  resources,
  ironChariots = false,
}: Props) {
  const set = (track: TrackId, res: SpendableResource, value: number) => {
    onChange({
      ...plan,
      [track]: { ...(plan[track] ?? {}), [res]: Math.max(0, value || 0) },
    });
  };

  const surcharge = ironChariotSurcharge(plan, ironChariots);
  const committed = (res: SpendableResource) =>
    spentOf(plan, res) + (res === 'warriors' ? surcharge : 0);

  return (
    <div className="placement-grid">
      <div className="placement-legend">
        <strong>Banner</strong> (the track’s own resource) counts for the threshold{' '}
        <em>and</em> for Champion, and takes the Loyalty hit if the track fails.{' '}
        <strong>Supply</strong> (anything else) only helps the track succeed — no
        Champion claim, no risk, and a share of the spoil.
      </div>

      <table>
        <thead>
          <tr>
            <th scope="col">Track</th>
            {PLAN_RESOURCES.map((res) => (
              <th
                key={res}
                scope="col"
                className={committed(res) > resources[res] ? 'over' : undefined}
              >
                {RESOURCE_LABEL[res]}
                <span className="pool">
                  {committed(res)}/{resources[res]}
                </span>
              </th>
            ))}
            <th scope="col">On track</th>
          </tr>
        </thead>
        <tbody>
          {PLAN_TRACKS.map((track) => {
            const affinity = TRACK_AFFINITY_RESOURCE[track];
            return (
              <tr key={track}>
                <th scope="row">{TRACK_LABELS[track]}</th>
                {PLAN_RESOURCES.map((res) => {
                  const isBanner = res === affinity;
                  return (
                    <td key={res} className={isBanner ? 'banner-cell' : undefined}>
                      <input
                        type="number"
                        min={0}
                        max={resources[res]}
                        value={plan[track]?.[res] ?? 0}
                        onChange={(e) => set(track, res, Number(e.target.value))}
                        aria-label={`${TRACK_LABELS[track]}: ${RESOURCE_LABEL[res]} (${
                          isBanner ? 'Banner' : 'Supply'
                        })`}
                      />
                      <span className="cell-kind">{isBanner ? 'Banner' : 'Supply'}</span>
                    </td>
                  );
                })}
                <td className="track-tally">
                  {tokensOn(plan, track)}
                  {bannerOn(plan, track) > 0 && (
                    <span className="pool">{bannerOn(plan, track)} Banner</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {surcharge > 0 && (
        <div className="placement-warning">
          Iron Chariots: {surcharge} extra Warrior{surcharge === 1 ? '' : 's'} for your
          Military tokens. Any you cannot pay for count as 0 Influence.
        </div>
      )}
      {!planIsAffordable(plan, resources, ironChariots) && (
        <div className="placement-warning danger">
          You cannot afford this placement.
        </div>
      )}
    </div>
  );
}
