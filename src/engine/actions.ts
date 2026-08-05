/**
 * Standard actions, unique tribe actions, and action-phase Place Influence.
 */
import { TRACK_LABELS, TRIBE_BY_ID, uniqueCanCostFaith } from '../data/gameData';
import {
  addLog,
  cryThreshold,
  getPlayer,
  mulberry32,
  mutateResources,
  nextTokenId,
  raiseCovenant,
  shuffle,
  updatePlayer,
} from './helpers';
import { LEADER_TRADES } from './leaderTrades';
import { applyPlacement } from './placement';
import type { GameState, PlayerAction, TrackId, TribeId } from './types';

export { LEADER_TRADES } from './leaderTrades';
export type { LeaderTrade } from './leaderTrades';

/**
 * Tribes whose Unique Action is itself once-per-game. Round 1 bars these along
 * with leader upgrades, per the First Round Special Rule.
 */
const ONCE_PER_GAME_UNIQUES = new Set<TribeId>(['Dan']);

type Tradeable = 'faith' | 'warriors' | 'goods';

/**
 * The Convert / Bargain rate table (03-standard-actions-and-player-aid.md):
 * 2 Goods → Faith or Warrior; 2 Warriors → Goods; 2 Faith → Goods or Warrior.
 */
function isValidConversion(from: Tradeable, to: Tradeable): boolean {
  if (from === to) return false;
  if (from === 'warriors') return to === 'goods';
  return true;
}

/** The trade this player could make right now, or null. */
export function availableLeaderTrade(
  state: GameState,
  playerId: string,
): import('./leaderTrades').LeaderTrade | null {
  const p = getPlayer(state, playerId);
  const trade = LEADER_TRADES[p.tribe];
  if (!trade) return null;
  if (p.leaderLevel < trade.level) return null;
  if (p.oncePerRoundUsed[trade.key]) return null;
  return trade;
}

export function applyLeaderTrade(
  state: GameState,
  playerId: string,
  action: Extract<PlayerAction, { type: 'leaderTrade' }>,
): { state: GameState; ok: boolean } {
  const p = getPlayer(state, playerId);
  const trade = LEADER_TRADES[p.tribe];
  if (!trade) {
    return { state: addLog(state, `${p.tribe} has no leader trade.`, 'bad'), ok: false };
  }
  if (p.leaderLevel < trade.level) {
    return {
      state: addLog(state, `${trade.name} is not unlocked yet.`, 'bad'),
      ok: false,
    };
  }
  if (p.oncePerRoundUsed[trade.key]) {
    return {
      state: addLog(state, `${trade.name} is once per round.`, 'bad'),
      ok: false,
    };
  }
  const legal = trade.trades.some(
    (t) => t.from === action.from && t.to === action.to,
  );
  if (!legal) {
    return {
      state: addLog(state, `${trade.name} cannot trade that way.`, 'bad'),
      ok: false,
    };
  }
  // Micah's Idol (Crisis 7) forbids spending Faith on unique actions. A leader
  // trade is not a unique action, but paying Faith to an idolatrous market is
  // the same act the card is aimed at, so the Faith side is barred too.
  if (action.from === 'faith' && state.activeCrisis?.id === 7) {
    return {
      state: addLog(
        state,
        'Micah’s Idol blocks trading Faith away.',
        'bad',
      ),
      ok: false,
    };
  }
  if (p.resources[action.from] < trade.rate) {
    return {
      state: addLog(
        state,
        `${trade.name} needs ${trade.rate} ${action.from}.`,
        'bad',
      ),
      ok: false,
    };
  }
  let s = updatePlayer(state, playerId, (pl) => ({
    ...pl,
    resources: mutateResources(pl.resources, {
      [action.from]: -trade.rate,
      [action.to]: 1,
    }),
    oncePerRoundUsed: { ...pl.oncePerRoundUsed, [trade.key]: true },
  }));
  s = addLog(
    s,
    `${p.tribe} — ${trade.name}: ${trade.rate} ${action.from} → 1 ${action.to}.`,
    'good',
  );
  return { state: s, ok: true };
}

function capLoyalty(state: GameState, playerId: string): GameState {
  return updatePlayer(state, playerId, (p) => ({
    ...p,
    resources: {
      ...p.resources,
      loyalty: Math.min(p.resources.loyalty, p.startingLoyalty),
    },
  }));
}

export function applyStandardAction(
  state: GameState,
  playerId: string,
  action: Extract<PlayerAction, { type: 'standard' }>,
): { state: GameState; ok: boolean } {
  let s = state;
  const p = getPlayer(s, playerId);

  switch (action.action) {
    case 'recruit': {
      if (action.recruitMode === 'faith') {
        if (p.resources.faith < 1)
          return { state: addLog(s, 'Need 1 Faith to Recruit.', 'bad'), ok: false };
        s = updatePlayer(s, playerId, (pl) => ({
          ...pl,
          resources: mutateResources(pl.resources, { warriors: 1 }),
        }));
        s = addLog(s, `${p.tribe} Recruits (+1 Warrior via Faith).`, 'info');
      } else {
        if (p.resources.goods < 1)
          return { state: addLog(s, 'Need 1 Goods to Recruit.', 'bad'), ok: false };
        s = updatePlayer(s, playerId, (pl) => ({
          ...pl,
          resources: mutateResources(pl.resources, { goods: -1, warriors: 2 }),
        }));
        s = addLog(s, `${p.tribe} Recruits (1 Goods → 2 Warriors).`, 'info');
      }
      break;
    }
    case 'gather': {
      const spend = action.gatherSpend ?? 'warriors';
      if (p.resources[spend] < 1)
        return { state: addLog(s, `Need 1 ${spend} to Gather.`, 'bad'), ok: false };
      let goodsGain = 2;
      if (
        p.tribe === 'Asher' &&
        p.leaderLevel >= 2 &&
        !p.oncePerRoundUsed['fertile']
      ) {
        goodsGain += 1;
        s = updatePlayer(s, playerId, (pl) => ({
          ...pl,
          oncePerRoundUsed: { ...pl.oncePerRoundUsed, fertile: true },
        }));
      }
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, {
          [spend]: -1,
          goods: goodsGain,
        }),
      }));
      s = addLog(s, `${p.tribe} Gathers (+${goodsGain} Goods).`, 'info');
      break;
    }
    case 'pray': {
      if (action.prayMode === 'goods') {
        if (p.resources.goods < 1)
          return { state: addLog(s, 'Need 1 Goods to Pray.', 'bad'), ok: false };
        s = updatePlayer(s, playerId, (pl) => ({
          ...pl,
          resources: mutateResources(pl.resources, {
            goods: -1,
            faith: 1,
            loyalty: 1,
          }),
        }));
        s = capLoyalty(s, playerId);
        s = addLog(s, `${p.tribe} Prays (+1 Faith, +1 Loyalty).`, 'good');
      } else {
        s = updatePlayer(s, playerId, (pl) => ({
          ...pl,
          resources: mutateResources(pl.resources, { faith: 2 }),
        }));
        s = addLog(s, `${p.tribe} Seeks the Lord (+2 Faith).`, 'good');
      }
      break;
    }
    case 'convert': {
      const c = action.convert;
      if (!c) return { state: addLog(s, 'Invalid convert.', 'bad'), ok: false };
      if (c.from === c.to)
        return { state: addLog(s, 'Cannot convert to same resource.', 'bad'), ok: false };
      if (p.resources[c.from] < 2)
        return { state: addLog(s, `Need 2 ${c.from}.`, 'bad'), ok: false };
      if (!isValidConversion(c.from, c.to))
        return { state: addLog(s, 'Invalid conversion rate.', 'bad'), ok: false };
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, {
          [c.from]: -2,
          [c.to]: 1,
        }),
      }));
      s = addLog(s, `${p.tribe} Converts 2 ${c.from} → 1 ${c.to}.`, 'info');
      break;
    }
    case 'rest': {
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { loyalty: 1 }),
        peekedCrisis: s.crisisDeck[0] ? [s.crisisDeck[0]] : null,
      }));
      s = capLoyalty(s, playerId);
      s = addLog(s, `${p.tribe} Rests (+1 Loyalty) and peeks the Crisis deck.`, 'info');
      break;
    }
    case 'cryOut': {
      const oppression = s.oppression;
      if (!oppression) {
        return {
          state: addLog(s, 'There is no oppression to cry out against.', 'bad'),
          ok: false,
        };
      }
      const faith = Math.max(0, Math.floor(action.cryFaith ?? 0));
      if (faith < 1) {
        return { state: addLog(s, 'Crying out costs at least 1 Faith.', 'bad'), ok: false };
      }
      if (p.resources.faith < faith) {
        return {
          state: addLog(s, `${p.tribe} does not have ${faith} Faith.`, 'bad'),
          ok: false,
        };
      }
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { faith: -faith }),
      }));
      const pool = oppression.cryPool + faith;
      s = {
        ...s,
        oppression: {
          ...oppression,
          cryPool: pool,
          contributors: {
            ...oppression.contributors,
            [playerId]: (oppression.contributors[playerId] ?? 0) + faith,
          },
        },
      };
      s = addLog(
        s,
        `${p.tribe} cries out to the Lord (+${faith} Faith — ${pool}/${cryThreshold(s)}).`,
        'good',
      );
      break;
    }
    case 'pass': {
      s = addLog(s, `${p.tribe} passes.`, 'info');
      break;
    }
    default:
      break;
  }
  return { state: s, ok: true };
}

export function applyUniqueAction(
  state: GameState,
  playerId: string,
  action: Extract<PlayerAction, { type: 'unique' }>,
): { state: GameState; ok: boolean } {
  let s = state;
  const p = getPlayer(s, playerId);
  const tribe = p.tribe;
  // Micah's Idol (Crisis 7): no Faith may be spent on unique actions.
  const crisisBlocksFaith =
    s.activeCrisis?.id === 7 && uniqueCanCostFaith(tribe);
  const blockedMsg = 'Micah’s Idol blocks spending Faith on unique actions.';

  const spendFaith = (n: number): boolean => {
    if (crisisBlocksFaith) return false;
    return getPlayer(s, playerId).resources.faith >= n;
  };

  /** Round 1 bars once-per-game abilities (04-setup-scoring-and-scaling.md). */
  if (s.round <= 1 && ONCE_PER_GAME_UNIQUES.has(tribe)) {
    return {
      state: addLog(
        s,
        `${TRIBE_BY_ID[tribe].uniqueName} is a once-per-game ability and cannot be used on Round 1.`,
        'bad',
      ),
      ok: false,
    };
  }

  switch (tribe) {
    case 'Judah': {
      if (crisisBlocksFaith) return { state: addLog(s, blockedMsg, 'bad'), ok: false };
      if (!action.targetPlayerId) {
        return { state: addLog(s, 'Rally needs a target player.', 'bad'), ok: false };
      }
      if (action.targetPlayerId === playerId) {
        return {
          state: addLog(s, 'Rally must target one *other* player.', 'bad'),
          ok: false,
        };
      }
      if (!spendFaith(1)) {
        return { state: addLog(s, 'Rally needs 1 Faith.', 'bad'), ok: false };
      }
      const target = getPlayer(s, action.targetPlayerId);
      // The rules name no track, so the gift lands on the chosen track and
      // otherwise follows the recipient's thematic affinity.
      const rallyTrack = action.track ?? TRIBE_BY_ID[target.tribe].bias;
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { faith: -1 }),
      }));
      s = {
        ...s,
        tokens: [
          ...s.tokens,
          {
            id: nextTokenId(),
            playerId: action.targetPlayerId,
            track: rallyTrack,
            value: 1,
            temporary: true,
            faceDown: true,
            // Gifted Influence is Supply: Judah is sending help, not planting
            // someone else's Banner. Otherwise Rally would hand out Championships.
            paidWith: null,
          },
        ],
      };
      s = addLog(
        s,
        `${p.tribe} Rallies ${target.tribe} (+1 temp Influence on ${TRACK_LABELS[rallyTrack]}).`,
        'good',
      );
      break;
    }
    case 'Benjamin': {
      if (p.resources.warriors < 1) return { state: addLog(s, 'Need 1 Warrior.', 'bad'), ok: false };
      // The Warrior is spent now; the Low-zone outcome is settled after Reveal so
      // it cannot be read off opponents' face-down tokens.
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { warriors: -1 }),
        pendingZoneUnique: 'raid',
      }));
      s = addLog(s, `${p.tribe} Raids — outcome settles at Reveal.`, 'info');
      break;
    }
    case 'Levi': {
      if (crisisBlocksFaith) return { state: addLog(s, blockedMsg, 'bad'), ok: false };
      if (!spendFaith(1)) return { state: addLog(s, 'Intercede needs 1 Faith.', 'bad'), ok: false };
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { faith: -1 }),
      }));
      if (action.leviMode === 'protect') {
        s = updatePlayer(s, playerId, (pl) => ({ ...pl, covenantProtect: true }));
        s = addLog(s, `${p.tribe} Intercedes — Covenant protected.`, 'good');
      } else {
        s = raiseCovenant(s, 1, 'Levi Intercede');
      }
      break;
    }
    case 'Ephraim': {
      if (p.resources.goods < 1) return { state: addLog(s, 'Need 1 Goods.', 'bad'), ok: false };
      const mode = action.ephraimMode ?? 'doubleGoods';
      s = updatePlayer(s, playerId, (pl) => {
        let r = mutateResources(pl.resources, { goods: -1 });
        if (mode === 'doubleGoods') r = mutateResources(r, { goods: 2 });
        else if (mode === 'goodsPlusFaith') r = mutateResources(r, { goods: 1, faith: 1 });
        else r = mutateResources(r, { goods: 1, warriors: 1 });
        return { ...pl, resources: r };
      });
      s = addLog(s, `${p.tribe} Double Portion.`, 'good');
      break;
    }
    case 'Manasseh': {
      const spend = action.manassehSpend ?? 'warriors';
      if (p.resources[spend] < 1) return { state: addLog(s, `Need 1 ${spend}.`, 'bad'), ok: false };
      if (spend === 'faith' && crisisBlocksFaith) {
        return {
          state: addLog(s, `${blockedMsg} Spend a Warrior instead.`, 'bad'),
          ok: false,
        };
      }
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { [spend]: -1 }),
        holdTheLine: true,
      }));
      s = addLog(s, `${p.tribe} Holds the Line.`, 'good');
      break;
    }
    case 'Reuben': {
      if (p.resources.warriors < 1) return { state: addLog(s, 'Need 1 Warrior.', 'bad'), ok: false };
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { warriors: -1 }),
        peekedCrisis: s.crisisDeck[0] ? [s.crisisDeck[0]] : [],
      }));
      s = addLog(s, `${p.tribe} Scouts Ahead.`, 'info');
      break;
    }
    case 'Simeon': {
      if (p.resources.warriors < 1) return { state: addLog(s, 'Need 1 Warrior.', 'bad'), ok: false };
      // Deferred for the same reason as Raid — see Benjamin above.
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { warriors: -1 }),
        pendingZoneUnique: 'skirmish',
      }));
      s = addLog(s, `${p.tribe} Skirmishes — outcome settles at Reveal.`, 'info');
      break;
    }
    case 'Dan': {
      if (p.oncePerGameUsed['serpent']) {
        return { state: addLog(s, 'Serpent’s Wisdom already used.', 'bad'), ok: false };
      }
      if (crisisBlocksFaith) return { state: addLog(s, blockedMsg, 'bad'), ok: false };
      if (!spendFaith(1)) return { state: addLog(s, 'Need 1 Faith.', 'bad'), ok: false };
      const discarded = s.activeCrisis;
      if (!discarded) return { state: addLog(s, 'No active Crisis.', 'bad'), ok: false };
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { faith: -1 }),
        oncePerGameUsed: { ...pl.oncePerGameUsed, serpent: true },
      }));
      let deck = [...s.crisisDeck];
      let discard = [...s.crisisDiscard];
      if (deck.length === 0 && discard.length > 0) {
        // Recycle the discard as a fresh shuffled deck rather than dealing it in
        // discard order — and empty it, so no card can be drawn twice.
        deck = shuffle(discard, mulberry32(s.seed + s.round * 53));
        discard = [];
      }
      const next = deck.shift() ?? null;
      s = {
        ...s,
        activeCrisis: next,
        crisisDeck: deck,
        crisisDiscard: [...discard, discarded],
      };
      s = addLog(
        s,
        `${p.tribe} Serpent’s Wisdom — new Crisis: ${next?.name ?? 'none'}.`,
        'crisis',
      );
      break;
    }
    case 'Naphtali': {
      if (!action.tokenId || !action.toTrack) {
        return { state: addLog(s, 'Pick a token and destination track.', 'bad'), ok: false };
      }
      const tok = s.tokens.find((t) => t.id === action.tokenId && t.playerId === playerId);
      if (!tok) return { state: addLog(s, 'Token not found.', 'bad'), ok: false };
      if (tok.track === action.toTrack) return { state: addLog(s, 'Pick a different track.', 'bad'), ok: false };
      s = {
        ...s,
        tokens: s.tokens.map((t) =>
          t.id === action.tokenId ? { ...t, track: action.toTrack as TrackId } : t,
        ),
      };
      s = addLog(
        s,
        `${p.tribe} Repositions Influence to ${TRACK_LABELS[action.toTrack]}.`,
        'info',
      );
      break;
    }
    case 'Gad': {
      if (p.resources.warriors < 1) return { state: addLog(s, 'Need 1 Warrior.', 'bad'), ok: false };
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { warriors: -1 }),
        standFirm: true,
      }));
      s = addLog(s, `${p.tribe} Stands Firm.`, 'good');
      break;
    }
    case 'Asher': {
      const mode = action.asherMode ?? 'rest';
      if (mode === 'faith') {
        if (crisisBlocksFaith) {
          return {
            state: addLog(s, `${blockedMsg} Harvest by resting instead.`, 'bad'),
            ok: false,
          };
        }
        if (!spendFaith(1)) return { state: addLog(s, 'Need 1 Faith.', 'bad'), ok: false };
        s = updatePlayer(s, playerId, (pl) => ({
          ...pl,
          resources: mutateResources(pl.resources, { faith: -1, goods: 2 }),
        }));
      } else {
        s = updatePlayer(s, playerId, (pl) => ({
          ...pl,
          resources: mutateResources(pl.resources, { goods: 2 }),
        }));
      }
      if (p.leaderLevel >= 2 && !getPlayer(s, playerId).oncePerRoundUsed['fertile']) {
        s = updatePlayer(s, playerId, (pl) => ({
          ...pl,
          resources: mutateResources(pl.resources, { goods: 1 }),
          oncePerRoundUsed: { ...pl.oncePerRoundUsed, fertile: true },
        }));
      }
      s = addLog(s, `${p.tribe} Harvests Goods.`, 'good');
      break;
    }
    case 'Issachar': {
      if (crisisBlocksFaith) return { state: addLog(s, blockedMsg, 'bad'), ok: false };
      if (!spendFaith(1)) return { state: addLog(s, 'Need 1 Faith.', 'bad'), ok: false };
      const top2 = s.crisisDeck.slice(0, 2);
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { faith: -1 }),
        peekedCrisis: top2,
      }));
      if (action.issacharOrder && top2.length === 2) {
        const [a, b] = action.issacharOrder;
        // The two cards go back in some order — they must be a permutation of the
        // pair, or the deck would gain a duplicate and silently lose the other card.
        const isPermutation =
          a !== b && [a, b].every((i) => i === 0 || i === 1);
        if (isPermutation) {
          s = {
            ...s,
            crisisDeck: [top2[a]!, top2[b]!, ...s.crisisDeck.slice(2)],
          };
        } else {
          s = addLog(s, 'Invalid Crisis order — deck left as it was.', 'bad');
        }
      }
      s = addLog(s, `${p.tribe} Studies the Times.`, 'info');
      break;
    }
    case 'Zebulun': {
      if (p.resources.goods < 1) return { state: addLog(s, 'Need 1 Goods.', 'bad'), ok: false };
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { goods: -1 }),
      }));
      const converts = action.zebulunConverts ?? [];
      let done = 0;
      for (const c of converts.slice(0, 2)) {
        const pl = getPlayer(s, playerId);
        if (pl.resources[c.from] < 2) continue;
        if (!isValidConversion(c.from, c.to)) continue;
        s = updatePlayer(s, playerId, (x) => ({
          ...x,
          resources: mutateResources(x.resources, { [c.from]: -2, [c.to]: 1 }),
        }));
        done += 1;
      }
      const skipped = Math.min(converts.length, 2) - done;
      s = addLog(
        s,
        `${p.tribe} Bargains — ${done} conversion${done === 1 ? '' : 's'}` +
          (skipped > 0 ? ` (${skipped} skipped: unaffordable or invalid rate).` : '.'),
        skipped > 0 ? 'bad' : 'info',
      );
      break;
    }
    default: {
      const name = TRIBE_BY_ID[tribe as keyof typeof TRIBE_BY_ID]?.uniqueName ?? 'Unique';
      return { state: addLog(s, `${name} not available.`, 'bad'), ok: false };
    }
  }
  return { state: s, ok: true };
}

export function applyPlaceInfluenceAction(
  state: GameState,
  playerId: string,
  plan: Parameters<typeof applyPlacement>[2],
): GameState {
  return applyPlacement(state, playerId, plan);
}
