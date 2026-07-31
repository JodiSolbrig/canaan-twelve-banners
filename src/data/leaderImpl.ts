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
    Judah: [true, false, false], // I Glory; II/III need activation UI
    Benjamin: [true, false, true], // I Warrior; II need UI; III free Recruit
    Levi: [true, false, false], // I Covenant on Moral Champ
    Ephraim: [true, true, false], // I Faith; II +1 Goods on unlock; III convert UI
    Manasseh: [false, true, true], // I peek; II Provision High; III loyalty soften
    Reuben: [false, false, false],
    Simeon: [true, true, false], // I Warrior; II free Mil next round; III convert
    Dan: [true, false, false], // I Nazirite Strength
    Naphtali: [false, false, false], // II gift flag exists but never set
    Gad: [true, true, false], // I loyalty; II Mil Low; III Overcomer unused
    Asher: [true, true, false], // I Provision High; II Gather/Harvest; III once
    Issachar: [false, true, false], // II +1 Faith on Champ
    Zebulun: [false, true, false], // II Provision Champ Glory
  };

export function isLeaderUpgradeActive(tribe: TribeId, level: number): boolean {
  if (level < 1 || level > 3) return false;
  return LEADER_UPGRADE_ACTIVE[tribe][level - 1] ?? false;
}
