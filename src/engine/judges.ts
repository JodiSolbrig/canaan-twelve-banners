/**
 * The six Judge one-shots, granted by deliverance and lapsing with the judge.
 *
 * Each power is spent in one of two windows:
 *
 * - **action** — it takes effect the moment it is declared, during your turn.
 * - **preResolve** — the board is face up and nothing is scored yet; the power
 *   arms itself and lands during resolution.
 *
 * A power is spent, not merely held: declaring it clears `judgePower`, so it can
 * never be used twice, and an unspent one dies with its judge.
 */
import { OPPRESSOR_BY_ID } from '../data/oppressors';
import { TRACK_LABELS } from '../data/gameData';
import {
  addLog,
  getPlayer,
  grantGlory,
  mutateResources,
  nextTokenId,
  OTHNIEL_ZEAL_BONUS,
  updatePlayer,
} from './helpers';
import type {
  GameState,
  OppressorId,
  PlayerAction,
  Resources,
  TrackId,
} from './types';

/** When each power may be declared. */
export const JUDGE_POWER_WINDOW: Record<OppressorId, 'action' | 'preResolve'> = {
  aram: 'preResolve', // Othniel's Zeal
  moab: 'action', // Ehud's Hidden Dagger
  hazor: 'action', // Deborah's Summons
  midian: 'preResolve', // Gideon's Three Hundred
  ammon: 'action', // Jephthah's Vow
  philistia: 'preResolve', // Samson's Strength
};

/** Whether the power needs a track named when declared. */
export const JUDGE_POWER_NEEDS_TRACK: Record<OppressorId, boolean> = {
  aram: false, // always Moral
  moab: false,
  hazor: true,
  midian: true,
  ammon: false,
  philistia: true,
};

export function judgePowerWindow(
  state: GameState,
  playerId: string,
): 'action' | 'preResolve' | null {
  const power = getPlayer(state, playerId).judgePower;
  return power ? JUDGE_POWER_WINDOW[power] : null;
}

/**
 * Spend the Judge power a player holds. Returns `ok: false` with an explanatory
 * log when the declaration is not legal.
 */
export function applyJudgePower(
  state: GameState,
  playerId: string,
  action: Extract<PlayerAction, { type: 'judgePower' }>,
): { state: GameState; ok: boolean } {
  let s = state;
  const p = getPlayer(s, playerId);
  const power = p.judgePower;

  if (!power) {
    return { state: addLog(s, `${p.tribe} holds no Judge power.`, 'bad'), ok: false };
  }
  const def = OPPRESSOR_BY_ID[power];
  const window = JUDGE_POWER_WINDOW[power];
  const expected = window === 'action' ? 'action' : 'preResolve';
  if (s.phase !== expected) {
    return {
      state: addLog(
        s,
        `${def.deliverer}'s power is spent ${
          window === 'action' ? 'on your turn' : 'once Influence is revealed'
        }.`,
        'bad',
      ),
      ok: false,
    };
  }
  if (JUDGE_POWER_NEEDS_TRACK[power] && !action.track) {
    return {
      state: addLog(s, `${def.deliverer}'s power must name a track.`, 'bad'),
      ok: false,
    };
  }

  const spend = (st: GameState) =>
    updatePlayer(st, playerId, (pl) => ({
      ...pl,
      judgePower: null,
      judgePowerExpires: 0,
    }));

  switch (power) {
    // Othniel's Zeal — Moral Banners count for more.
    case 'aram': {
      s = spend(s);
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        judgeArmed: { power, track: 'moral' },
      }));
      s = addLog(
        s,
        `${p.tribe} calls on Othniel's Zeal — Moral Banners count +${OTHNIEL_ZEAL_BONUS}.`,
        'good',
      );
      break;
    }

    // Ehud's Hidden Dagger — take one Influence off another player.
    case 'moab': {
      const targetId = action.targetPlayerId;
      if (!targetId || targetId === playerId) {
        return {
          state: addLog(s, 'The dagger must be turned on another player.', 'bad'),
          ok: false,
        };
      }
      const token = action.tokenId
        ? s.tokens.find((t) => t.id === action.tokenId && t.playerId === targetId)
        : s.tokens.find((t) => t.playerId === targetId && t.value > 0);
      if (!token) {
        return {
          state: addLog(s, 'That player has no Influence to take.', 'bad'),
          ok: false,
        };
      }
      s = spend(s);
      s = { ...s, tokens: s.tokens.filter((t) => t.id !== token.id) };
      s = addLog(
        s,
        `${p.tribe} strikes with Ehud's Hidden Dagger — ${
          getPlayer(s, targetId).tribe
        } loses 1 Influence on ${TRACK_LABELS[token.track]}.`,
        'bad',
      );
      break;
    }

    // Deborah's Summons — the whole nation is called to one field.
    case 'hazor': {
      const track = action.track as TrackId;
      s = spend(s);
      s = {
        ...s,
        tokens: [
          ...s.tokens,
          ...s.players.map((pl) => ({
            id: nextTokenId(),
            playerId: pl.id,
            track,
            value: 1,
            temporary: true,
            faceDown: false,
            // Summoned Influence is Supply: Deborah rallies the tribes, she does
            // not plant their banners for them.
            paidWith: null,
          })),
        ],
      };
      s = addLog(
        s,
        `${p.tribe} sounds Deborah's Summons — every tribe gains 1 Influence on ${TRACK_LABELS[track]}.`,
        'good',
      );
      break;
    }

    // Gideon's Three Hundred — the fewest carry the day.
    case 'midian': {
      const track = action.track as TrackId;
      s = spend(s);
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        judgeArmed: { power, track },
      }));
      s = addLog(
        s,
        `${p.tribe} musters Gideon's Three Hundred on ${TRACK_LABELS[track]} — the fewest will carry it.`,
        'good',
      );
      break;
    }

    // Jephthah's Vow — Glory, and the price paid on the spot.
    case 'ammon': {
      const [key, amount] = largestStore(p.resources);
      if (amount <= 0) {
        return {
          state: addLog(s, `${p.tribe} has nothing to vow.`, 'bad'),
          ok: false,
        };
      }
      s = spend(s);
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        resources: mutateResources(pl.resources, { [key]: -amount }),
      }));
      s = addLog(
        s,
        `${p.tribe} swears Jephthah's Vow — ${amount} ${key} forfeit, and 3 Glory.`,
        'crisis',
      );
      s = grantGlory(s, playerId, 3, false);
      break;
    }

    // Samson's Strength — everything in one blow.
    case 'philistia': {
      const track = action.track as TrackId;
      s = spend(s);
      s = updatePlayer(s, playerId, (pl) => ({
        ...pl,
        judgeArmed: { power, track },
      }));
      s = addLog(
        s,
        `${p.tribe} takes hold of Samson's Strength — Banners on ${TRACK_LABELS[track]} count double.`,
        'good',
      );
      break;
    }
  }

  return { state: s, ok: true };
}

/**
 * The largest single store of Faith, Warriors or Goods. Ties fall to the earlier
 * of the three, so Faith is taken before Warriors and Warriors before Goods.
 *
 * "I have opened my mouth to the Lord, and I cannot take it back." The vow is
 * paid the moment it is sworn, while the resources are still worth something —
 * deferring it to the end made the price fall on the third tie-breaker, which
 * almost never decides a game, and turned a terrible bargain into a free one.
 */
function largestStore(
  r: Resources,
): readonly ['faith' | 'warriors' | 'goods', number] {
  const stores = [
    ['faith', r.faith],
    ['warriors', r.warriors],
    ['goods', r.goods],
  ] as const;
  return stores.reduce((a, b) => (b[1] > a[1] ? b : a));
}
