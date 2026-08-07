/**
 * Pure helpers shared across the rules engine.
 *
 * Conventions:
 * - All Glory gains that can unlock leaders must go through `grantGlory`.
 * - Mutators return a new `GameState` (shallow immutable updates).
 */
import type { TuningConfig } from '../config/tuning';
import { formatTribeIncome, TRIBE_BY_ID } from '../data/gameData';
import { OPPRESSOR_BY_ID } from '../data/oppressors';
import type {
  GameState,
  InfluenceToken,
  LogEntry,
  PlacementPlan,
  PlayerState,
  Resources,
  ResourceSpend,
  SpendableResource,
  TrackId,
  TribeId,
} from './types';

let logCounter = 0;
let tokenCounter = 0;

/** Shared track id list — prefer this over redeclaring in each module. */
export const TRACKS: TrackId[] = ['military', 'moral', 'provision'];

/**
 * Extra Moral Influence Othniel's Zeal is worth.
 * Lives here rather than in `judges.ts` so the tally can read it without the
 * two modules importing each other.
 */
export const OTHNIEL_ZEAL_BONUS = 2;

/**
 * The resource that plants a Banner on each track. Paying with anything else
 * places Supply instead.
 */
export const TRACK_AFFINITY_RESOURCE: Record<TrackId, SpendableResource> = {
  military: 'warriors',
  moral: 'faith',
  provision: 'goods',
};

/**
 * Banner or Supply, judged against the track the token is on *now* — not the
 * track it was placed on. Reposition moving a Warrior-paid token off Military
 * demotes it to Supply, which is the intended cost of that ability.
 */
export function isBannerToken(token: InfluenceToken): boolean {
  return token.paidWith === TRACK_AFFINITY_RESOURCE[token.track];
}

/** Total tokens a plan places on one track, across every resource. */
export function plannedTokenCount(spend: ResourceSpend | undefined): number {
  if (!spend) return 0;
  return (spend.faith ?? 0) + (spend.warriors ?? 0) + (spend.goods ?? 0);
}

/** Total tokens a plan places across all tracks. */
export function planTotal(plan: PlacementPlan): number {
  return TRACKS.reduce((n, t) => n + plannedTokenCount(plan[t]), 0);
}

export function nextTokenId(): string {
  tokenCounter += 1;
  return `tok-${tokenCounter}`;
}

export function resetIdCounters(): void {
  logCounter = 0;
  tokenCounter = 0;
}

export function addLog(
  state: GameState,
  text: string,
  tone: LogEntry['tone'] = 'info',
): GameState {
  logCounter += 1;
  return {
    ...state,
    log: [
      { id: `log-${logCounter}`, round: state.round, text, tone },
      ...state.log,
    ].slice(0, 80),
  };
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function getPlayer(state: GameState, id: string): PlayerState {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`Player ${id} not found`);
  return p;
}

export function updatePlayer(
  state: GameState,
  id: string,
  fn: (p: PlayerState) => PlayerState,
): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === id ? fn(p) : p)),
  };
}

export function mutateResources(
  r: Resources,
  delta: Partial<Resources>,
): Resources {
  return {
    faith: Math.max(0, r.faith + (delta.faith ?? 0)),
    warriors: Math.max(0, r.warriors + (delta.warriors ?? 0)),
    goods: Math.max(0, r.goods + (delta.goods ?? 0)),
    loyalty: Math.max(0, r.loyalty + (delta.loyalty ?? 0)),
    glory: Math.max(0, r.glory + (delta.glory ?? 0)),
  };
}

/**
 * How hard the current oppression presses. The round an Oppressor arrives it is
 * at 1, and it climbs by 1 for every full round Israel endures it. Zero when
 * there is no oppression.
 */
export function oppressionSeverity(state: GameState): number {
  return state.oppression ? state.oppression.roundsEndured + 1 : 0;
}

/**
 * Faith the Cry needs to break the current oppression:
 *
 *   one per player, plus one, plus one for each round already endured.
 *
 * Every term is a whole token so the number can be counted out at a table.
 * `Math.ceil` only guards against someone dialling in a fractional value.
 */
export function cryThreshold(state: GameState): number {
  if (!state.oppression) return 0;
  const t = state.tuningSnapshot;
  return Math.ceil(
    t.cryThresholdBase +
      t.cryThresholdPerPlayer * state.players.length +
      t.cryThresholdPerRound * state.oppression.roundsEndured,
  );
}

/**
 * The player a Judge is raised from: the least among them. Lowest Glory, then
 * lowest Loyalty, then earliest in turn order.
 *
 * "My clan is the weakest in Manasseh, and I am the least in my father's house."
 */
export function leastAmongThem(state: GameState): PlayerState | null {
  const ranked = [...state.players].sort((a, b) => {
    if (a.resources.glory !== b.resources.glory) {
      return a.resources.glory - b.resources.glory;
    }
    if (a.resources.loyalty !== b.resources.loyalty) {
      return a.resources.loyalty - b.resources.loyalty;
    }
    return state.turnOrder.indexOf(a.id) - state.turnOrder.indexOf(b.id);
  });
  return ranked[0] ?? null;
}

export function baseThreshold(state: GameState, track: TrackId): number {
  const t = state.tuningSnapshot;
  const n = state.players.length;
  let thr =
    t.thresholdBase === 'fixed' ? t.thresholdFixed : n;
  if (n <= 3) thr += t.smallGroupThresholdBonus;
  thr += t.thresholdBonus;

  const c = state.activeCrisis?.id;
  if (track === 'provision' && c === 2) thr += 1;
  if ((track === 'military' || track === 'moral') && c === 6) thr += 1;

  // An oppression presses hardest on the track its account names, and presses
  // harder the longer it is endured.
  if (state.oppression) {
    const def = OPPRESSOR_BY_ID[state.oppression.oppressorId];
    if (def.attacks === track) thr += oppressionSeverity(state);
  }
  return thr;
}

export type TrackTallies = {
  /** Banner + Supply per player — measured against the success threshold. */
  total: Record<TrackId, Record<string, number>>;
  /** Banner only per player — Champion is decided on this. */
  banner: Record<TrackId, Record<string, number>>;
};

function emptyTally(): Record<TrackId, Record<string, number>> {
  return Object.fromEntries(
    TRACKS.map((tr) => [tr, {} as Record<string, number>]),
  ) as Record<TrackId, Record<string, number>>;
}

export function getTrackTotals(state: GameState): TrackTallies {
  const total = emptyTally();
  const banner = emptyTally();

  for (const tok of state.tokens) {
    total[tok.track][tok.playerId] =
      (total[tok.track][tok.playerId] ?? 0) + tok.value;
    if (isBannerToken(tok)) {
      banner[tok.track][tok.playerId] =
        (banner[tok.track][tok.playerId] ?? 0) + tok.value;
    }
  }

  // Passive modifiers counted at reveal time. All four below are Military
  // bonuses belonging to Military tribes, so they add Banner strength — the
  // bonus inherits the nature of the tokens it modifies.
  const addMilitary = (playerId: string, amount: number) => {
    total.military[playerId] = (total.military[playerId] ?? 0) + amount;
    banner.military[playerId] = (banner.military[playerId] ?? 0) + amount;
  };

  for (const p of state.players) {
    // Dan Samson I — Nazirite Strength: if Dan sent no Supply this generation,
    // every Banner it planted counts double.
    //
    // Samson is the least communal judge in the book. He never fought at the
    // head of an army, never called out the tribes, and never took help; his
    // whole strength went into one blow. So Dan's doubling is bought by
    // refusing to Supply — the one thing in this game that means helping
    // somebody else hold a track.
    //
    // The condition used to be "every Banner on a single track", which was a
    // trap: measured over 2400 games the doubling itself was worth 3-4 points of
    // win rate, but steering placement to guarantee it cost 4, so the card paid
    // best to a player who ignored its own instruction. This version asks for a
    // real trade instead — Supply is safe profit and a share of the spoil, and
    // Dan gives it up to strike harder — and it can be played toward from any
    // number of tracks. It took Dan from 14.7% to 23.5% and closed the table's
    // spread from 16.4 points to 14.6, the tightest measured.
    if (p.leaderLevel >= 1 && p.tribe === 'Dan') {
      const sentSupply = state.tokens.some(
        (t) =>
          t.playerId === p.id &&
          !t.temporary &&
          t.paidWith !== null &&
          !isBannerToken(t),
      );
      if (!sentSupply) {
        for (const track of TRACKS) {
          const mine = banner[track][p.id] ?? 0;
          if (mine <= 0) continue;
          total[track][p.id] = (total[track][p.id] ?? 0) + mine;
          banner[track][p.id] = mine * 2;
        }
      }
    }
    // Judah Othniel II — armed during placement.
    if (
      p.tribe === 'Judah' &&
      p.leaderLevel >= 2 &&
      p.oncePerRoundUsed['othnielII']
    ) {
      addMilitary(p.id, 1);
    }
    // Benjamin Ehud II — armed during placement.
    if (
      p.tribe === 'Benjamin' &&
      p.leaderLevel >= 2 &&
      p.oncePerRoundUsed['ehudII']
    ) {
      addMilitary(p.id, 1);
    }
    // Gad Enduring Defense needs the zone, so it is applied in resolve.

    // Naphtali III — Northern Alliance: two tracks, each counting 1 more.
    if (p.alliance) {
      for (const t of p.alliance) {
        if ((total[t][p.id] ?? 0) <= 0) continue;
        total[t][p.id] = (total[t][p.id] ?? 0) + 1;
        // Only strengthens a claim the tribe already has a Banner behind.
        if ((banner[t][p.id] ?? 0) > 0) banner[t][p.id] = (banner[t][p.id] ?? 0) + 1;
      }
    }

    // Judge powers armed this round that change what Influence counts for.
    const armed = p.judgeArmed;
    if (armed) {
      const t = armed.track;
      const mine = banner[t][p.id] ?? 0;
      if (armed.power === 'aram' && mine > 0) {
        // Othniel's Zeal
        total[t][p.id] = (total[t][p.id] ?? 0) + OTHNIEL_ZEAL_BONUS;
        banner[t][p.id] = mine + OTHNIEL_ZEAL_BONUS;
      }
      if (armed.power === 'philistia' && mine > 0) {
        // Samson's Strength
        total[t][p.id] = (total[t][p.id] ?? 0) + mine;
        banner[t][p.id] = mine * 2;
      }
    }
  }

  return { total, banner };
}

export function trackZone(
  total: number,
  threshold: number,
  offset: number,
): 'low' | 'normal' | 'high' {
  if (total < threshold) return 'low';
  if (total >= threshold + offset) return 'high';
  return 'normal';
}

/** End-game / standings order: Glory → Loyalty → resource sum → Championships. */
export function compareStandings(a: PlayerState, b: PlayerState): number {
  if (b.resources.glory !== a.resources.glory) {
    return b.resources.glory - a.resources.glory;
  }
  if (b.resources.loyalty !== a.resources.loyalty) {
    return b.resources.loyalty - a.resources.loyalty;
  }
  const ra = a.resources.faith + a.resources.warriors + a.resources.goods;
  const rb = b.resources.faith + b.resources.warriors + b.resources.goods;
  if (rb !== ra) return rb - ra;
  return b.championships - a.championships;
}

export function rankPlayers(players: PlayerState[]): PlayerState[] {
  return [...players].sort(compareStandings);
}

export function sameStanding(a: PlayerState, b: PlayerState): boolean {
  return compareStandings(a, b) === 0;
}

export function covenantZone(
  covenant: number,
  tuning: TuningConfig,
): 'strength' | 'warning' | 'judgment' | 'broken' {
  if (covenant >= tuning.zoneStrengthMin) return 'strength';
  if (covenant >= tuning.zoneWarningMin) return 'warning';
  if (covenant >= tuning.zoneJudgmentMin) return 'judgment';
  return 'broken';
}

export function loyaltyLossAmount(state: GameState, base: number): number {
  let amt = base;
  if (state.activeCrisis?.id === 10) amt += 1;
  return amt;
}

export function applyLoyaltyLoss(
  state: GameState,
  playerId: string,
  baseAmount: number,
  reason: string,
): GameState {
  let amount = loyaltyLossAmount(state, baseAmount);
  let s = state;
  let p = getPlayer(s, playerId);

  if (p.standFirm) {
    s = updatePlayer(s, playerId, (pl) => ({ ...pl, standFirm: false }));
    s = addLog(s, `${p.tribe} Stand Firm blocks Loyalty loss (${reason}).`, 'good');
    return s;
  }

  if (p.tribe === 'Gad' && p.leaderLevel >= 1) {
    amount = Math.max(0, amount - 1);
  }

  if (amount <= 0) return s;

  s = updatePlayer(s, playerId, (pl) => ({
    ...pl,
    resources: mutateResources(pl.resources, { loyalty: -amount }),
  }));
  s = addLog(
    s,
    `${getPlayer(s, playerId).tribe} loses ${amount} Loyalty (${reason}).`,
    'bad',
  );
  return s;
}

export function applyCovenantDrop(
  state: GameState,
  amount: number,
  reason: string,
): GameState {
  let drop = amount;
  let s = state;

  // Levi Intercede: "protect it from the next drop" — cancels the drop outright,
  // not merely softens it, so it still holds under Judgment (drop of 2).
  const protector = s.players.find((p) => p.covenantProtect);
  if (protector && drop > 0) {
    drop = 0;
    s = updatePlayer(s, protector.id, (p) => ({ ...p, covenantProtect: false }));
    s = addLog(s, `${protector.tribe} Intercede protects the Covenant.`, 'good');
  }

  // Manasseh Hold the Line reduces one failed-track penalty
  const holder = s.players.find((p) => p.holdTheLine);
  if (holder && drop > 0 && reason.includes('failed')) {
    drop -= 1;
    s = updatePlayer(s, holder.id, (p) => ({ ...p, holdTheLine: false }));
    s = addLog(s, `${holder.tribe} Hold the Line softens the drop.`, 'good');
  }

  if (drop <= 0) return s;

  const before = s.covenant;
  const next = clamp(before - drop, 0, s.tuningSnapshot.covenantMax);
  s = { ...s, covenant: next };
  s = addLog(s, `Covenant Meter ${before} → ${next} (${reason}).`, 'bad');
  return s;
}

export function raiseCovenant(state: GameState, amount: number, reason: string): GameState {
  const next = clamp(state.covenant + amount, 0, state.tuningSnapshot.covenantMax);
  let s: GameState = { ...state, covenant: next };
  s = addLog(s, `Covenant Meter → ${next} (${reason}).`, 'good');
  return s;
}

/**
 * Where a gain of Goods came from. Asher's Rich Harvest doubles only what an
 * action or a Championship paid; Zebulun's Profitable Venture doubles anything.
 */
export type GoodsSource =
  | 'action'
  | 'champion'
  | 'spoil'
  | 'income'
  | 'zone'
  /** Levi's due from a Provision Champion. */
  | 'tithe';

/** Which sources each tribe's once-per-game doubler will fire on. */
const DOUBLER: Partial<Record<TribeId, { name: string; sources: GoodsSource[] }>> =
  {
    // "double the Goods you gain from any single action or Champion reward"
    Asher: {
      name: 'Rich Harvest',
      sources: ['action', 'champion'],
    },
    // "after gaining Goods from any source, gain that many again"
    Zebulun: {
      name: 'Profitable Venture',
      sources: ['action', 'champion', 'spoil', 'income', 'zone', 'tithe'],
    },
  };

export function goodsDoublerOf(tribe: TribeId) {
  return DOUBLER[tribe] ?? null;
}

/**
 * The one way Goods are ever added to a player.
 *
 * Every gain has to pass through here, the way every positive Glory passes
 * through `grantGlory`: a doubler that quietly missed one source would be a bug
 * nobody could see. Spending Goods still goes through `mutateResources` — only
 * gains can be doubled.
 */
export function grantGoods(
  state: GameState,
  playerId: string,
  amount: number,
  source: GoodsSource,
): GameState {
  if (amount <= 0) return state;
  const p = getPlayer(state, playerId);
  const doubler = goodsDoublerOf(p.tribe);
  let gain = amount;
  let s = state;

  if (p.goodsDoublerArmed && doubler?.sources.includes(source)) {
    gain = amount * 2;
    s = updatePlayer(s, playerId, (pl) => ({ ...pl, goodsDoublerArmed: false }));
    s = addLog(
      s,
      `${p.tribe} — ${doubler.name}: ${amount} Goods becomes ${gain}.`,
      'good',
    );
  }

  return updatePlayer(s, playerId, (pl) => ({
    ...pl,
    resources: mutateResources(pl.resources, { goods: gain }),
  }));
}

export function grantGlory(
  state: GameState,
  playerId: string,
  amount: number,
  fromChampion: boolean,
): GameState {
  let gain = amount;
  if (fromChampion && state.activeCrisis?.id === 14) {
    const already = state.gloryFromChampionsThisRound[playerId] ?? 0;
    gain = Math.min(gain, Math.max(0, 1 - already));
  }
  if (gain <= 0) return state;

  let s = updatePlayer(state, playerId, (p) => ({
    ...p,
    resources: mutateResources(p.resources, { glory: gain }),
  }));
  if (fromChampion) {
    s = {
      ...s,
      gloryFromChampionsThisRound: {
        ...s.gloryFromChampionsThisRound,
        [playerId]: (s.gloryFromChampionsThisRound[playerId] ?? 0) + gain,
      },
    };
  }
  // Leader unlocks
  s = checkLeaderUnlocks(s, playerId);
  return s;
}

/** Renders a player's permanent income bonus as a log suffix, e.g. " +1 Goods". */
function formatIncomeBonus(bonus: PlayerState['incomeBonus']): string {
  const parts: string[] = [];
  if (bonus.faith) parts.push(`${bonus.faith} Faith`);
  if (bonus.warriors) parts.push(`${bonus.warriors} Warrior`);
  if (bonus.goods) parts.push(`${bonus.goods} Goods`);
  return parts.length ? ` +${parts.join(' + ')}` : '';
}

/**
 * Grant each tribe its per-round income (Loyalty capped at starting max), plus any
 * permanent `incomeBonus` earned from leader upgrades.
 * Invoked from `startRound` for rounds 2+ only so starting stocks match the tribe table.
 */
export function applyRoundIncome(state: GameState): GameState {
  let s = state;
  for (const p of state.players) {
    const def = TRIBE_BY_ID[p.tribe];
    const inc = def.income;
    s = updatePlayer(s, p.id, (pl) => {
      let r = mutateResources(pl.resources, {
        faith: (inc.faith ?? 0) + pl.incomeBonus.faith,
        warriors: (inc.warriors ?? 0) + pl.incomeBonus.warriors,
      });
      if (inc.loyalty && r.loyalty < pl.startingLoyalty) {
        const gain = Math.min(inc.loyalty, pl.startingLoyalty - r.loyalty);
        r = mutateResources(r, { loyalty: gain });
      }
      return { ...pl, resources: r };
    });
    s = grantGoods(s, p.id, (inc.goods ?? 0) + p.incomeBonus.goods, 'income');
    const bonusLine = formatIncomeBonus(p.incomeBonus);
    s = addLog(
      s,
      `${p.tribe} collects income (+${formatTribeIncome(inc)}${bonusLine}).`,
      'info',
    );
  }
  return s;
}

export function checkLeaderUnlocks(state: GameState, playerId: string): GameState {
  const thresholds = state.tuningSnapshot.leaderUnlockGlory;
  const p = getPlayer(state, playerId);
  const prevLevel = p.leaderLevel;
  let level = prevLevel;
  for (let i = 0; i < 3; i++) {
    if (p.resources.glory >= thresholds[i] && level < i + 1) {
      level = i + 1;
    }
  }
  if (level === prevLevel) return state;

  const def = TRIBE_BY_ID[p.tribe];
  let s = updatePlayer(state, playerId, (pl) => {
    let next = { ...pl, leaderLevel: level };
    // Ephraim Abdon I ("+1 Goods permanently to your starting total for the rest
    // of the game") raises per-round income rather than paying out once.
    if (pl.tribe === 'Ephraim' && level >= 2 && prevLevel < 2) {
      next = {
        ...next,
        incomeBonus: { ...next.incomeBonus, goods: next.incomeBonus.goods + 1 },
      };
    }
    return next;
  });

  const roman = ['I', 'II', 'III'] as const;
  for (let lvl = prevLevel + 1; lvl <= level; lvl++) {
    const upgrade = def.upgrades[lvl - 1] ?? `Leader ${roman[lvl - 1]}`;
    const bonus =
      p.tribe === 'Ephraim' && lvl === 2 ? ' (+1 Goods income, permanent)' : '';
    s = addLog(
      s,
      `${p.tribe} unlocks Leader ${roman[lvl - 1]}${bonus} — ${upgrade}`,
      'good',
    );
  }
  return s;
}

/**
 * The phase play enters once the Crisis is on the table.
 *
 * With `freePlacementPhase` on (prototype default) every player gets a free
 * Influence placement and then a full action. With it off the round matches the
 * printed rules: one action per player, where Place Influence is one of the
 * options.
 */
export function openingPhase(state: GameState): 'placement' | 'action' {
  return state.tuningSnapshot.freePlacementPhase ? 'placement' : 'action';
}

/**
 * Seat order for the phase in play.
 *
 * Reuben's Firstborn Advance moves it to the back of the **placement** queue, so
 * it commits knowing how heavily everyone else already has. It sees the weight of
 * the board, not its composition — placement stays face down, so the hidden
 * information stays hidden. Action order is untouched.
 */
export function actingOrder(state: GameState): string[] {
  if (state.phase !== 'placement') return state.turnOrder;
  const reuben = state.players.find(
    (p) => p.tribe === 'Reuben' && p.leaderLevel >= 1,
  );
  if (!reuben) return state.turnOrder;
  return [...state.turnOrder.filter((id) => id !== reuben.id), reuben.id];
}

export function currentActor(state: GameState): PlayerState | null {
  if (state.phase !== 'placement' && state.phase !== 'action') return null;
  const id = actingOrder(state)[state.currentActorIndex];
  return id ? getPlayer(state, id) : null;
}

export function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
