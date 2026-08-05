/**
 * Game setup: choose tribes, seed RNG, build initial `GameState`, enter round 1.
 */
import { cloneTuning, type TuningConfig } from '../config/tuning';
import { CRISIS_CARDS, TRIBE_BY_ID } from '../data/gameData';
import { OPPRESSORS } from '../data/oppressors';
import { addLog, mulberry32, resetIdCounters, shuffle } from './helpers';
import { startRound } from './round';
import type { GameState, PlayerState, TribeId } from './types';

export type SetupOptions = {
  humanTribe: TribeId;
  totalPlayers: number; // 2–6
  botTribes?: TribeId[];
  seed?: number;
  tuning?: TuningConfig;
};

function makePlayer(
  id: string,
  tribe: TribeId,
  isHuman: boolean,
): PlayerState {
  const def = TRIBE_BY_ID[tribe];
  return {
    id,
    tribe,
    isHuman,
    resources: {
      faith: def.faith,
      warriors: def.warriors,
      goods: def.goods,
      loyalty: def.loyalty,
      glory: 0,
    },
    startingLoyalty: def.loyalty,
    /** Soft cap for future placement limits; not enforced yet. */
    influencePool: 10,
    championships: 0,
    leaderLevel: 0,
    oncePerGameUsed: {},
    oncePerRoundUsed: {},
    standFirm: false,
    covenantProtect: false,
    holdTheLine: false,
    /** Gad III — flag reserved; effect not wired. */
    overcomerAvailable: true,
    freeMilitaryNextRound: 0,
    /** Naphtali II — consumed in placement if set; never set yet. */
    pendingTempInfluenceGift: 0,
    incomeBonus: { faith: 0, warriors: 0, goods: 0 },
    pendingZoneUnique: null,
    judgeships: 0,
    judgePower: null,
    judgePowerExpires: 0,
    peekedCrisis: null,
  };
}

export function createGame(opts: SetupOptions): GameState {
  resetIdCounters();
  const tuning = cloneTuning(opts.tuning);
  const seed = opts.seed ?? Date.now();
  const rng = mulberry32(seed);

  const total = Math.max(2, Math.min(6, opts.totalPlayers));
  const used = new Set<TribeId>([opts.humanTribe]);
  const botTribes: TribeId[] = [];

  if (opts.botTribes) {
    for (const t of opts.botTribes) {
      if (!used.has(t) && botTribes.length < total - 1) {
        botTribes.push(t);
        used.add(t);
      }
    }
  }

  const pool = shuffle(
    (Object.keys(TRIBE_BY_ID) as TribeId[]).filter((t) => !used.has(t)),
    rng,
  );
  while (botTribes.length < total - 1 && pool.length > 0) {
    botTribes.push(pool.shift()!);
  }

  const players: PlayerState[] = [
    makePlayer('human', opts.humanTribe, true),
    ...botTribes.map((tribe, i) => makePlayer(`bot-${i + 1}`, tribe, false)),
  ];

  const order = shuffle(
    players.map((p) => p.id),
    rng,
  );
  const maxRounds = tuning.generations;

  let state: GameState = {
    players,
    turnOrder: order,
    firstPlayerIndex: 0,
    currentActorIndex: 0,
    round: 1,
    maxRounds,
    phase: 'crisisReveal',
    covenant: tuning.covenantStart,
    brokenClock: false,
    crisisDeck: shuffle([...CRISIS_CARDS], rng),
    crisisDiscard: [],
    activeCrisis: null,
    oppression: null,
    oppressorDeck: shuffle(
      OPPRESSORS.map((o) => o.id),
      rng,
    ),
    restRound: false,
    tokens: [],
    log: [],
    trackResults: null,
    winners: null,
    firstChampionId: null,
    gloryFromChampionsThisRound: {},
    pendingCrisisChoice: null,
    seed,
    tuningSnapshot: tuning,
  };

  state = addLog(
    state,
    `Game begins — ${total} tribes. You are ${opts.humanTribe}.`,
    'info',
  );
  return startRound(state);
}
