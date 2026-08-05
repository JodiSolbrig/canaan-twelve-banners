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
  /**
   * Added to every track's threshold at every table size.
   *
   * This is the dial that decides how often a track holds, and therefore how
   * often the Covenant falls far enough to sell Israel into a hand. It has to be
   * read against how much Influence the table actually turns out — a threshold
   * is only hard relative to what players are willing to spend.
   *
   * Matters most under `perTrackNet`, where the Covenant is a random walk driven
   * by track outcomes: if tracks succeed more often than they fail the meter
   * drifts to the ceiling and the cycle never fires, so that mode wants tracks
   * near a coin flip.
   */
  thresholdBonus: number;
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
   * How the Covenant moves at the end of a generation.
   *
   * `perTrack` — every failure drops it, nothing raises it (the 0.4.0 rule,
   *   tuned for a 5-round game). Over ten generations this erodes up to 3 a
   *   round, which no amount of deliverance can outrun.
   * `perGeneration` — the meter moves once: +1 if every track held, −1 if one or
   *   two gave way, −2 if all three did.
   * `perTrackNet` — each track that held lifts the meter by
   *   `covenantPerTrackHeld` and each that gave way lowers it by
   *   `covenantPerTrackFailed`. Anything above the maximum is wasted.
   */
  covenantDropMode: 'perTrack' | 'perGeneration' | 'perTrackNet';
  /** `perTrackNet`: Covenant gained for each track that held. */
  covenantPerTrackHeld: number;
  /**
   * `perTrackNet`: Covenant lost for each track that gave way.
   *
   * The ratio between this and `covenantPerTrackHeld` sets the meter's drift,
   * and the drift has to be read against the track success rate. Weighting
   * failure twice as heavily makes the meter fall unless tracks succeed roughly
   * two times in three, so it wants a *lower* threshold than an even weighting
   * does — the two settings cannot be tuned apart.
   */
  covenantPerTrackFailed: number;
  /** Extra drop when every track fails, under `perGeneration`. */
  covenantTotalCollapseDrop: number;
  /**
   * Covenant regained when every track succeeds in a generation.
   *
   * Without this the meter only ever falls, so over ten generations erosion
   * outruns deliverance and half of all games end early on the Broken clock. A
   * faithful generation should mend the covenant, not merely fail to break it.
   */
  covenantRiseOnFaithfulRound: number;
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
   * Israel is sold into a hand when the Covenant sits at or below this.
   *
   * Deliberately separate from the Judgment band. Judgment also deepens the drop
   * for a failed track, so widening the band to fire the cycle earlier deepens
   * erosion at the same time — measured over 300 games, that traded 1.22
   * oppressions per game for a jump from 44% to 51% of games ending on the
   * Broken clock. Keeping the trigger on its own dial fires the cycle sooner
   * without making failure hurt sooner.
   */
  oppressionTriggerAt: number;
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
  /**
   * Generations a Judge's one-shot survives before it lapses, spent or not.
   * "And whenever the judge died, they turned back" (Judges 2:19).
   */
  judgeGenerations: number;
  /** Deliverance is followed by a round with no Crisis ("the land had rest"). */
  restAfterDeliverance: boolean;
  /**
   * Rounds in a game. A round is a **generation**, not a season — Judges spans
   * roughly 300–410 years and measures itself in generations ("there arose
   * another generation after them who did not know the Lord", 2:10), with six
   * major oppression cycles and twelve judges. Ten generations gives room for
   * the cycle to turn more than once and for leaders to actually rise.
   *
   * The same for every player count: a generation is a generation.
   */
  generations: number;
  leaderUnlockGlory: [number, number, number];
  botAggression: number; // 0–1
  botThinkMs: number;
  endCovenantBonus: boolean;
};

export const DEFAULT_TUNING: TuningConfig = {
  covenantStart: 8,
  covenantMax: 10,
  zoneStrengthMin: 8,
  // Judgment 1–3 rather than 2–4: the deeper drops and the lowest-Loyalty
  // discard start a step later than the oppression trigger at 5, leaving a 4–5
  // band where Israel is under a hand but not yet doubly punished — room to cry
  // out before it gets bad. Broken is consequently 0 alone.
  zoneWarningMin: 4,
  zoneJudgmentMin: 1,
  thresholdBase: 'playerCount',
  thresholdFixed: 5,
  smallGroupThresholdBonus: 1,
  /*
   * Paired with the Covenant weights. Sampled over 300 games at 10 generations:
   *
   *   held/failed   threshold   Covenant   broken-clock   generations played
   *   +1 / −1       +1          7.56        9.7%          9.6
   *   +1 / −2       +0          6.16       34.7%          8.6
   *   +1 / −2       +1          3.48       75.7%          6.7
   *   +1 / −2       −1          8.26       11.3%          9.5
   *
   * A heavier failure weight needs an *easier* threshold, not a harder one.
   *
   * Raised from +0 to +1 in 0.10.0, when the bot learned to send Supply. Every
   * figure above was sampled against an opponent that spent 94% of its Influence
   * on Banners and left the rest in hand, so the thresholds were tuned against a
   * table that under-committed. Once Supply was actually being played the same
   * +0 threshold gave 90/82/81 track success, a final Covenant of 8.8, and 0.48
   * oppressions a game — the Cycle of the Judges barely turning. +1 puts it back
   * at 79/68/64 and 0.91 oppressions. The dial did not change; what the table
   * turns out did.
   */
  thresholdBonus: 1,
  lowHighOffset: 2,
  freePlacementPhase: true,
  failedTrackLoyaltyLoss: 1,
  // −1 for each track that gave way (−2 each while in Judgment, per the original
  // design), and +1 only when every track held. Failure is granular; recovery is
  // all-or-nothing, so mending the covenant takes a genuinely faithful generation.
  covenantDropMode: 'perTrack',
  covenantPerTrackHeld: 1,
  covenantPerTrackFailed: 1,
  covenantTotalCollapseDrop: 2,
  covenantRiseOnFaithfulRound: 1,
  spoilOnSuccess: 1,
  championRewards: {
    military: { glory: 1, warriors: 1 },
    moral: { glory: 1, faith: 1 },
    provision: { glory: 1, goods: 1 },
  },
  oppressionEnabled: true,
  oppressionTriggerAt: 5,
  cryThresholdBase: 1,
  cryThresholdPerPlayer: 1,
  cryThresholdPerRound: 1,
  judgeGlory: 2,
  judgeGenerations: 2,
  restAfterDeliverance: true,
  generations: 10,
  leaderUnlockGlory: [3, 6, 9],
  botAggression: 0.55,
  botThinkMs: 450,
  endCovenantBonus: true,
};

export function cloneTuning(t: TuningConfig = DEFAULT_TUNING): TuningConfig {
  return structuredClone(t);
}
