import type { TribeId } from '../engine/types';

/**
 * Which leader upgrades currently have engine effects when unlocked.
 *
 * Index 0/1/2 = levels I/II/III. `false` means the upgrade text is shown in the
 * UI for planning/teaching, but the mechanical effect is not wired yet (or only
 * half-wired with no activation path). Keep in sync when implementing upgrades.
 */
export const LEADER_UPGRADE_ACTIVE: Record<TribeId, [boolean, boolean, boolean]> =
  {
    Judah: [true, true, false], // I Glory; II auto on Military placement; III needs UI
    Benjamin: [true, true, true], // I Warrior; II auto on Military placement; III free Recruit
    Levi: [true, false, true], // I Covenant on Moral Champ; III covenant rescue
    Ephraim: [true, true, false], // I Faith; II +1 Goods on unlock; III convert UI
    Manasseh: [false, true, true], // I peek; II Provision High; III loyalty soften
    Reuben: [true, true, true],
    Simeon: [true, true, false], // I Warrior; II free Mil next round; III convert
    Dan: [true, true, true], // I Nazirite; II Riddle & Cunning; III Final Stand
    Naphtali: [true, true, true],
    Gad: [true, true, true], // I loyalty; II Mil Low; III Overcomer
    Asher: [true, true, false], // I Provision High; II Gather/Harvest; III once
    Issachar: [false, true, false], // II +1 Faith on Champ
    Zebulun: [false, true, false], // II Provision Champ Glory
  };

export function isLeaderUpgradeActive(tribe: TribeId, level: number): boolean {
  if (level < 1 || level > 3) return false;
  return LEADER_UPGRADE_ACTIVE[tribe][level - 1] ?? false;
}
