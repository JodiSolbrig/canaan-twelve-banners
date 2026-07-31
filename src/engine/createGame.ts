import { cloneTuning, type TuningConfig } from '../config/tuning';
import { CRISIS_CARDS, TRIBE_BY_ID } from '../data/gameData';
import {
  addLog,
  applyRoundIncome,
  mulberry32,
  resetIdCounters,
  shuffle,
} from './helpers';
import type { GameState, PlayerState, TribeId } from './types';

export type SetupOptions = {
  humanTribe: TribeId;
  totalPlayers: number; // 2–6
  botTribes?: TribeId[];
  seed?: number;
  tuning?: TuningConfig;
};

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

  const players: PlayerState[] = [];
  const humanDef = TRIBE_BY_ID[opts.humanTribe];
  players.push({
    id: 'human',
    tribe: opts.humanTribe,
    isHuman: true,
    resources: {
      faith: humanDef.faith,
      warriors: humanDef.warriors,
      goods: humanDef.goods,
      loyalty: humanDef.loyalty,
      glory: 0,
    },
    startingLoyalty: humanDef.loyalty,
    influencePool: 10,
    championships: 0,
    leaderLevel: 0,
    oncePerGameUsed: {},
    oncePerRoundUsed: {},
    standFirm: false,
    covenantProtect: false,
    holdTheLine: false,
    overcomerAvailable: true,
    freeMilitaryNextRound: 0,
    pendingTempInfluenceGift: 0,
    peekedCrisis: null,
  });

  botTribes.forEach((tribe, i) => {
    const def = TRIBE_BY_ID[tribe];
    players.push({
      id: `bot-${i + 1}`,
      tribe,
      isHuman: false,
      resources: {
        faith: def.faith,
        warriors: def.warriors,
        goods: def.goods,
        loyalty: def.loyalty,
        glory: 0,
      },
      startingLoyalty: def.loyalty,
      influencePool: 10,
      championships: 0,
      leaderLevel: 0,
      oncePerGameUsed: {},
      oncePerRoundUsed: {},
      standFirm: false,
      covenantProtect: false,
      holdTheLine: false,
      overcomerAvailable: true,
      freeMilitaryNextRound: 0,
      pendingTempInfluenceGift: 0,
      peekedCrisis: null,
    });
  });

  const order = shuffle(
    players.map((p) => p.id),
    rng,
  );
  const maxRounds = total <= 4 ? tuning.roundsShort : tuning.roundsStandard;

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

export function startRound(state: GameState): GameState {
  let s: GameState = {
    ...state,
    tokens: [],
    trackResults: null,
    firstChampionId: null,
    gloryFromChampionsThisRound: {},
    pendingCrisisChoice: null,
    players: state.players.map((p) => ({
      ...p,
      oncePerRoundUsed: {},
      standFirm: false,
      covenantProtect: false,
      holdTheLine: false,
      peekedCrisis: null,
    })),
  };

  // Tribe income before Crisis reveal
  s = applyRoundIncome(s);

  // Draw crisis
  if (s.crisisDeck.length === 0) {
    s = {
      ...s,
      crisisDeck: shuffle([...s.crisisDiscard], mulberry32(s.seed + s.round * 17)),
      crisisDiscard: [],
    };
  }
  const [card, ...rest] = s.crisisDeck;
  if (!card) {
    s = { ...s, phase: 'placement', currentActorIndex: 0 };
    return addLog(s, 'No Crisis cards left — proceeding.', 'info');
  }

  s = {
    ...s,
    activeCrisis: card,
    crisisDeck: rest,
    phase: 'crisisReveal',
    currentActorIndex: 0,
  };
  s = addLog(s, `Round ${s.round}: Crisis — ${card.name}.`, 'crisis');

  if (card.id === 12) {
    const options = s.crisisDeck.slice(0, 2);
    if (options.length >= 2) {
      s = {
        ...s,
        phase: 'crisisChoice',
        pendingCrisisChoice: { type: 'angel', options },
      };
      s = addLog(s, 'Angel of the Lord: choose deck order and Covenant shift.', 'crisis');
      return s;
    }
  }

  // Stay on crisisReveal so the UI can show the card before placement
  return s;
}
