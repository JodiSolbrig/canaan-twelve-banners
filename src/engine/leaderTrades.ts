/**
 * The standing trades granted by a leader upgrade: Zebulun I (Sea Trader),
 * Simeon III (Raid Leader), Ephraim III (Landed Authority).
 *
 * All three are **free of your action**: you make the trade on your turn and
 * still take a full action. Two of them beat the standard Convert rate as well,
 * but Ephraim's does not — "convert 2 Goods into 1 Faith or 1 Warrior" is
 * exactly the printed Convert rate, so being free of the action is the only
 * thing that upgrade can be granting. That is the same reading the prototype
 * already takes of Benjamin's "a free Recruit action".
 *
 * Once per round each, so a leader trade cannot be milled into an engine.
 *
 * This is a leaf module — types only, no runtime imports — so the print
 * exporter can read it under `node --experimental-strip-types` without pulling
 * in the rest of the engine. The behaviour lives in `actions.ts`.
 */
import type { SpendableResource, TribeId } from './types';

export type LeaderTrade = {
  /** Leader level that unlocks it. */
  level: number;
  /** `oncePerRoundUsed` key. */
  key: string;
  name: string;
  /** Units of `from` that buy one unit of `to`. */
  rate: number;
  /** Legal trades, in the direction they may be made. */
  trades: Array<{ from: SpendableResource; to: SpendableResource }>;
};

export const LEADER_TRADES: Partial<Record<TribeId, LeaderTrade>> = {
  // Sea Trader — "convert 1 Faith ↔ 1 Goods at 1:1".
  Zebulun: {
    level: 1,
    key: 'seaTrader',
    name: 'Sea Trader',
    rate: 1,
    trades: [
      { from: 'faith', to: 'goods' },
      { from: 'goods', to: 'faith' },
    ],
  },
  // Raid Leader — "convert 1 Goods into 1 Warrior or vice versa at no loss".
  Simeon: {
    level: 3,
    key: 'raidLeader',
    name: 'Raid Leader',
    rate: 1,
    trades: [
      { from: 'goods', to: 'warriors' },
      { from: 'warriors', to: 'goods' },
    ],
  },
  // Abdon II, Landed Authority — "convert 2 Goods into 1 Faith or 1 Warrior".
  Ephraim: {
    level: 3,
    key: 'landedAuthority',
    name: 'Landed Authority',
    rate: 2,
    trades: [
      { from: 'goods', to: 'faith' },
      { from: 'goods', to: 'warriors' },
    ],
  },
};
