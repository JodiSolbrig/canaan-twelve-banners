import type { TrackId } from '../engine/types';

export type ChampionReward = {
  glory: number;
  faith?: number;
  warriors?: number;
  goods?: number;
};

export type TuningConfig = {
  covenantStart: number;
  covenantMax: number;
  zoneStrengthMin: number;
  zoneWarningMin: number;
  zoneJudgmentMin: number;
  /** Influence >= threshold succeeds */
  thresholdBase: 'playerCount' | 'fixed';
  thresholdFixed: number;
  /** Extra threshold for 2–3 players */
  smallGroupThresholdBonus: number;
  lowHighOffset: number;
  /** Free placement phase then one action */
  freePlacementPhase: boolean;
  failedTrackLoyaltyLoss: number;
  championRewards: Record<TrackId, ChampionReward>;
  roundsShort: number; // 2–4 players
  roundsStandard: number; // 5–6 players
  leaderUnlockGlory: [number, number, number];
  botAggression: number; // 0–1
  botThinkMs: number;
  endCovenantBonus: boolean;
};

export const DEFAULT_TUNING: TuningConfig = {
  covenantStart: 8,
  covenantMax: 10,
  zoneStrengthMin: 8,
  zoneWarningMin: 5,
  zoneJudgmentMin: 2,
  thresholdBase: 'playerCount',
  thresholdFixed: 5,
  smallGroupThresholdBonus: 1,
  lowHighOffset: 2,
  freePlacementPhase: true,
  failedTrackLoyaltyLoss: 1,
  championRewards: {
    military: { glory: 1, warriors: 1 },
    moral: { glory: 1, faith: 1 },
    provision: { glory: 1, goods: 1 },
  },
  roundsShort: 5,
  roundsStandard: 6,
  leaderUnlockGlory: [3, 6, 9],
  botAggression: 0.55,
  botThinkMs: 450,
  endCovenantBonus: true,
};

export function cloneTuning(t: TuningConfig = DEFAULT_TUNING): TuningConfig {
  return structuredClone(t);
}
