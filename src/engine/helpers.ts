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
} from './types';

let logCounter = 0;
let tokenCounter = 0;

/** Shared track id list — prefer this over redeclaring in each module. */
export const TRACKS: TrackId[] = ['military', 'moral', 'provision'];

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
    // Dan Samson I: three Military tokens count as four.
    if (p.leaderLevel >= 1 && p.tribe === 'Dan') {
      const milCount = state.tokens.filter(
        (t) => t.playerId === p.id && t.track === 'military' && !t.temporary,
      ).length;
      if (milCount >= 3) addMilitary(p.id, 1);
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
        goods: (inc.goods ?? 0) + pl.incomeBonus.goods,
      });
      if (inc.loyalty && r.loyalty < pl.startingLoyalty) {
        const gain = Math.min(inc.loyalty, pl.startingLoyalty - r.loyalty);
        r = mutateResources(r, { loyalty: gain });
      }
      return { ...pl, resources: r };
    });
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

export function currentActor(state: GameState): PlayerState | null {
  if (state.phase !== 'placement' && state.phase !== 'action') return null;
  const id = state.turnOrder[state.currentActorIndex];
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
