/**
 * Standard actions, unique tribe actions, and action-phase Place Influence.
 */
import { TRIBE_BY_ID } from '../data/gameData';
import {
  addLog,
  applyLoyaltyLoss,
  getPlayer,
  grantGlory,
  isTrackLow,
  mutateResources,
  nextTokenId,
  raiseCovenant,
  updatePlayer,
} from './helpers';
import { applyPlacement } from './placement';
import type { GameState, PlayerAction, TrackId } from './types';

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
      const ok =
        (c.from === 'goods' && (c.to === 'faith' || c.to === 'warriors')) ||
        (c.from === 'warriors' && c.to === 'goods') ||
        (c.from === 'faith' && (c.to === 'goods' || c.to === 'warriors'));
      if (!ok) return { state: addLog(s, 'Invalid conversion rate.', 'bad'), ok: false };
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
  const crisisBlocksFaith =
    s.activeCrisis?.id === 7 &&
    ['Judah', 'Levi', 'Dan', 'Issachar', 'Asher', 'Manasseh'].includes(tribe);

  const spendFaith = (n: number): boolean => {
    if (crisisBlocksFaith) return false;
    return getPlayer(s, playerId).resources.faith >= n;
  };

  switch (tribe) {
    case 'Judah': {
      if (!spendFaith(1) || !action.targetPlayerId) {
        return { state: addLog(s, 'Rally needs 1 Faith and a target.', 'bad'), ok: false };
      }
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
            track: 'military',
            value: 1,
            temporary: true,
            faceDown: true,
          },
        ],
      };
      s = addLog(
        s,
        `${p.tribe} Rallies ${getPlayer(s, action.targetPlayerId).tribe} (+1 temp Influence).`,
        'good',
      );
      break;
    }
    case 'Benjamin': {
      if (p.resources.warriors < 1) return { state: addLog(s, 'Need 1 Warrior.', 'bad'), ok: false };
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { warriors: -1 }),
      }));
      // Zone check uses current board totals vs the same threshold as resolution.
      const low = isTrackLow(s, 'military');
      if (low) {
        s = applyLoyaltyLoss(s, playerId, 1, 'Raid in Low zone');
        s = updatePlayer(s, playerId, (pl) => ({
          ...pl,
          resources: mutateResources(pl.resources, { goods: 1 }),
        }));
        s = addLog(s, `${p.tribe} Raids (Low) — Goods but no Glory.`, 'bad');
      } else {
        s = updatePlayer(s, playerId, (pl) => ({
          ...pl,
          resources: mutateResources(pl.resources, { goods: 1 }),
        }));
        s = addLog(s, `${p.tribe} Raids — +1 Goods, +1 Glory.`, 'good');
        s = grantGlory(s, playerId, 1, false);
      }
      break;
    }
    case 'Levi': {
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
        return { state: addLog(s, 'Micah’s Idol blocks Faith on uniques.', 'bad'), ok: false };
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
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { warriors: -1 }),
      }));
      if (isTrackLow(s, 'military')) {
        s = updatePlayer(s, playerId, (pl) => ({
          ...pl,
          resources: mutateResources(pl.resources, { goods: 1 }),
        }));
        s = addLog(s, `${p.tribe} Skirmishes (Low) — +1 Glory, +1 Goods.`, 'good');
      } else {
        s = addLog(s, `${p.tribe} Skirmishes — +1 Glory.`, 'good');
      }
      s = grantGlory(s, playerId, 1, false);
      break;
    }
    case 'Dan': {
      if (p.oncePerGameUsed['serpent']) {
        return { state: addLog(s, 'Serpent’s Wisdom already used.', 'bad'), ok: false };
      }
      if (!spendFaith(1)) return { state: addLog(s, 'Need 1 Faith.', 'bad'), ok: false };
      if (!s.activeCrisis) return { state: addLog(s, 'No active Crisis.', 'bad'), ok: false };
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { faith: -1 }),
        oncePerGameUsed: { ...pl.oncePerGameUsed, serpent: true },
      }));
      const discarded = s.activeCrisis;
      let deck = [...s.crisisDeck];
      let next = deck.shift() ?? null;
      if (!next && s.crisisDiscard.length) {
        deck = [...s.crisisDiscard];
        next = deck.shift() ?? null;
      }
      s = {
        ...s,
        activeCrisis: next,
        crisisDeck: deck,
        crisisDiscard: [...s.crisisDiscard, discarded].filter(
          (c): c is NonNullable<typeof c> => c != null,
        ),
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
      s = addLog(s, `${p.tribe} Repositions Influence to ${action.toTrack}.`, 'info');
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
      if (!spendFaith(1)) return { state: addLog(s, 'Need 1 Faith.', 'bad'), ok: false };
      const top2 = s.crisisDeck.slice(0, 2);
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { faith: -1 }),
        peekedCrisis: top2,
      }));
      if (action.issacharOrder && top2.length === 2) {
        const [a, b] = action.issacharOrder;
        const reordered = [top2[a], top2[b]].filter(Boolean);
        if (reordered.length === 2) {
          s = {
            ...s,
            crisisDeck: [...reordered, ...s.crisisDeck.slice(2)],
          };
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
      for (const c of converts.slice(0, 2)) {
        const pl = getPlayer(s, playerId);
        if (pl.resources[c.from] < 2) continue;
        const ok =
          (c.from === 'goods' && (c.to === 'faith' || c.to === 'warriors')) ||
          (c.from === 'warriors' && c.to === 'goods') ||
          (c.from === 'faith' && (c.to === 'goods' || c.to === 'warriors'));
        if (!ok) continue;
        s = updatePlayer(s, playerId, (x) => ({
          ...x,
          resources: mutateResources(x.resources, { [c.from]: -2, [c.to]: 1 }),
        }));
      }
      s = addLog(s, `${p.tribe} Bargains (two conversions).`, 'info');
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
