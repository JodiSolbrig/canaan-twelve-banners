import { isLeaderUpgradeActive } from '../data/leaderImpl';
import type { TribeDef } from '../engine/types';

const ROMAN = ['I', 'II', 'III'] as const;

export function leaderEarnSummary(thresholds: [number, number, number]): string {
  return `Leader upgrades unlock at ${thresholds[0]}, ${thresholds[1]}, and ${thresholds[2]} Glory (levels I–III). Each tribe has three unique upgrades. Every upgrade in the game is wired; those needing a decision wait for you to spend them.`;
}

export function formatLeaderTip(
  def: TribeDef,
  leaderLevel: number,
  thresholds: [number, number, number],
): string {
  const lines = [
    `${def.id} — Leader ${leaderLevel}/3`,
    leaderEarnSummary(thresholds),
    '',
    ...def.upgrades.map((text, i) => {
      const unlocked = leaderLevel >= i + 1;
      const active = isLeaderUpgradeActive(def.id, i + 1);
      const mark = unlocked ? '✓' : `at ${thresholds[i]} Glory`;
      const impl = active ? 'active' : 'planned';
      return `${ROMAN[i]} [${mark}, ${impl}] ${text}`;
    }),
  ];
  return lines.join('\n');
}

export function upgradeStatusLabel(
  tribeId: TribeDef['id'],
  level: number,
  unlocked: boolean,
  threshold: number,
): string {
  const active = isLeaderUpgradeActive(tribeId, level);
  if (unlocked) {
    return active ? 'Unlocked · Active' : 'Unlocked · Planned';
  }
  return active
    ? `Earn at ${threshold} Glory · Active`
    : `Earn at ${threshold} Glory · Planned`;
}

export { ROMAN };
