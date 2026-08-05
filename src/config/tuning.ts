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
  /**
   * On (prototype default): every player gets a free Influence placement and
   * then a full action each round.
   * Off: the printed rules — one action per player per round, with Place
   * Influence as one of the choices.
   */
  freePlacementPhase: boolean;
  failedTrackLoyaltyLoss: number;
  /**
   * Affinity resource paid to each non-Champion contributor when a track
   * succeeds. This is what makes Supply worth sending; 0 disables it.
   */
  spoilOnSuccess: number;
  championRewards: Record<TrackId, ChampionReward>;
  /**
   * The Oppression → Cry → Deliverance → Rest cycle. Off restores the 0.3.0
   * rules, where the Covenant only ever falls.
   */
  oppressionEnabled: boolean;
  /**
   * The Cry is `cryThresholdBase + players + cryThresholdPerRound x roundsEndured`
   * Faith — every term a whole token, so it can be counted at a table.
   *
   * Faith is the scarcest resource in the game (36 across all thirteen tribes,
   * ~0.5 income each per round) and it is also the Moral Banner resource, so the
   * Cry always competes with a track.
   *
   * Swept over 300-game samples: at two Faith per player only 9% of oppressions
   * were ever broken and half the games ended on the Broken Covenant clock; at a
   * flat one per player 68% broke and deliverance was a formality. One per player
   * plus one lands at roughly half. Sweep with `BALANCE_CRY=1.5 npm run balance`.
   */
  cryThresholdBase: number;
  /** Faith per player in the Cry. */
  cryThresholdPerPlayer: number;
  /** Added to the Cry threshold for each full round already endured. */
  cryThresholdPerRound: number;
  /** Glory to the Judge raised up at deliverance. */
  judgeGlory: number;
  /** Deliverance is followed by a round with no Crisis ("the land had rest"). */
  restAfterDeliverance: boolean;
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
  spoilOnSuccess: 1,
  championRewards: {
    military: { glory: 1, warriors: 1 },
    moral: { glory: 1, faith: 1 },
    provision: { glory: 1, goods: 1 },
  },
  oppressionEnabled: true,
  cryThresholdBase: 1,
  cryThresholdPerPlayer: 1,
  cryThresholdPerRound: 1,
  judgeGlory: 2,
  restAfterDeliverance: true,
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
