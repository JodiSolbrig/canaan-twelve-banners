import type { TuningConfig } from '../config/tuning';
import { startRound } from './createGame';
import {
  addLog,
  applyCovenantDrop,
  applyLoyaltyLoss,
  baseThreshold,
  checkLeaderUnlocks,
  covenantZone,
  getPlayer,
  getTrackTotals,
  grantGlory,
  mutateResources,
  raiseCovenant,
  trackZone,
  updatePlayer,
} from './helpers';
import type { GameState, TrackId, TrackResolution } from './types';

const TRACKS: TrackId[] = ['military', 'moral', 'provision'];

export function revealTokens(state: GameState): GameState {
  let s: GameState = {
    ...state,
    tokens: state.tokens.map((t) => ({ ...t, faceDown: false })),
    phase: 'resolve',
  };
  s = addLog(s, 'Influence revealed.', 'info');
  return resolveRound(s);
}

function pickChampion(
  state: GameState,
  byPlayer: Record<string, number>,
): string | null {
  const entries = Object.entries(byPlayer).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const la = getPlayer(state, a[0]).resources.loyalty;
    const lb = getPlayer(state, b[0]).resources.loyalty;
    if (lb !== la) return lb - la;
    return (
      state.turnOrder.indexOf(a[0]) - state.turnOrder.indexOf(b[0])
    );
  });
  return entries[0]![0];
}

export function resolveRound(state: GameState): GameState {
  let s = state;
  const tuning = s.tuningSnapshot;
  const totals = getTrackTotals(s);

  // Gad Enduring Defense: when Military is Low, Gad tokens count +1
  for (const p of s.players) {
    if (p.tribe === 'Gad' && p.leaderLevel >= 2) {
      const thr = baseThreshold(s, 'military');
      const grand = Object.values(totals.military).reduce((a, b) => a + b, 0);
      if (grand < thr && (totals.military[p.id] ?? 0) > 0) {
        totals.military[p.id] = (totals.military[p.id] ?? 0) + 1;
      }
    }
  }

  const results: TrackResolution[] = [];

  for (const track of TRACKS) {
    let thr = baseThreshold(s, track);
    const byPlayer = totals[track];
    let grand = Object.values(byPlayer).reduce((a, b) => a + b, 0);

    // Day of Midian
    if (track === 'military' && s.activeCrisis?.id === 13) {
      thr = thr * 2;
    }

    const zone = trackZone(grand, thr, tuning.lowHighOffset);
    let success = grand >= thr;
    const championId = pickChampion(s, byPlayer);

    results.push({
      track,
      total: grand,
      threshold: thr,
      success,
      championId,
      zone,
    });
  }

  s = { ...s, trackResults: results };

  // Champions + rewards
  for (const res of results) {
    if (!res.championId) {
      s = addLog(s, `${label(res.track)}: no Champion (total ${res.total}/${res.threshold}).`, 'info');
      continue;
    }
    const champ = getPlayer(s, res.championId);
    s = updatePlayer(s, res.championId, (p) => ({
      ...p,
      championships: p.championships + 1,
    }));
    s = addLog(
      s,
      `${champ.tribe} is ${label(res.track)} Champion (${res.total} Infl.).`,
      'good',
    );

    // Cry of the Oppressed
    if (s.activeCrisis?.id === 4 && !s.firstChampionId) {
      s = { ...s, firstChampionId: res.championId };
      s = updatePlayer(s, res.championId, (p) => ({
        ...p,
        resources: mutateResources(p.resources, { faith: 1 }),
      }));
      s = addLog(s, `${champ.tribe} gains +1 Faith (Cry of the Oppressed).`, 'good');
    }

    s = awardChampion(s, res);
  }

  // Civil Strife
  if (s.activeCrisis?.id === 11) {
    const mil = Object.entries(totals.military).sort((a, b) => b[1] - a[1]);
    for (const [pid] of mil.slice(0, 2)) {
      if ((totals.military[pid] ?? 0) > 0) {
        s = applyLoyaltyLoss(s, pid, 1, 'Civil Strife');
      }
    }
  }

  // Track failures → covenant + loyalty
  let anySuccess = false;
  for (const res of results) {
    if (res.success) {
      anySuccess = true;
      // High zone bonuses
      if (res.track === 'provision' && res.zone === 'high') {
        for (const p of s.players) {
          if (p.tribe === 'Manasseh' && p.leaderLevel >= 2) {
            s = updatePlayer(s, p.id, (pl) => ({
              ...pl,
              resources: mutateResources(pl.resources, { goods: 1 }),
            }));
          }
          if (p.tribe === 'Asher' && p.leaderLevel >= 1) {
            s = updatePlayer(s, p.id, (pl) => ({
              ...pl,
              resources: mutateResources(pl.resources, { goods: 1 }),
            }));
          }
        }
      }
      // Day of Midian success glory
      if (res.track === 'military' && s.activeCrisis?.id === 13) {
        for (const [pid, v] of Object.entries(totals.military)) {
          if (v > 0) s = grantGlory(s, pid, 1, false);
        }
      }
      // Jephthah vow success
      if (res.track === 'moral' && s.activeCrisis?.id === 9 && res.championId) {
        s = grantGlory(s, res.championId, 1, false);
      }
      continue;
    }

    // Failure
    let drop = covenantZone(s.covenant, tuning) === 'judgment' ? 2 : 1;
    if (res.track === 'moral' && s.activeCrisis?.id === 9) drop += 1;

    s = applyCovenantDrop(s, drop, `${label(res.track)} failed`);

    // Investors lose loyalty
    for (const [pid, v] of Object.entries(totals[res.track])) {
      if (v <= 0) continue;
      let loss = tuning.failedTrackLoyaltyLoss;
      const pl = getPlayer(s, pid);
      if (pl.tribe === 'Manasseh' && pl.leaderLevel >= 3) {
        loss = Math.max(0, loss - 1);
      }
      if (loss > 0) {
        s = applyLoyaltyLoss(s, pid, loss, `${label(res.track)} failure`);
      }
      // Simeon Furious Assault
      if (pl.tribe === 'Simeon' && pl.leaderLevel >= 2 && res.track === 'military') {
        s = updatePlayer(s, pid, (x) => ({
          ...x,
          freeMilitaryNextRound: x.freeMilitaryNextRound + 1,
        }));
      }
    }
  }

  // Warning zone
  const zone = covenantZone(s.covenant, tuning);
  if (zone === 'warning' && !anySuccess) {
    for (const p of s.players) {
      s = applyLoyaltyLoss(s, p.id, 1, 'Warning zone');
    }
  }

  // Judgment: lowest loyalty discards
  if (zone === 'judgment') {
    const sorted = [...s.players].sort(
      (a, b) => a.resources.loyalty - b.resources.loyalty,
    );
    const lowest = sorted[0];
    if (lowest) {
      const discard = lowest.resources.goods > 0 ? 'goods' : 'warriors';
      if (lowest.resources[discard] > 0) {
        s = updatePlayer(s, lowest.id, (p) => ({
          ...p,
          resources: mutateResources(p.resources, { [discard]: -1 }),
        }));
        s = addLog(
          s,
          `${lowest.tribe} (lowest Loyalty) discards 1 ${discard} (Judgment).`,
          'bad',
        );
      }
    }
  }

  // Abimelech
  if (s.activeCrisis?.id === 5) {
    const maxG = Math.max(...s.players.map((p) => p.resources.glory));
    for (const p of s.players) {
      if (p.resources.glory === maxG) {
        s = applyLoyaltyLoss(s, p.id, 1, 'Abimelech’s Ambition');
      }
    }
  }

  // No King end drop
  if (s.activeCrisis?.id === 14) {
    s = applyCovenantDrop(s, 1, 'No King in Israel');
  }

  // Philistine Razor already handled in awardChampion

  // Broken covenant check
  if (covenantZone(s.covenant, tuning) === 'broken') {
    for (const p of s.players) {
      s = applyLoyaltyLoss(s, p.id, 2, 'Broken Covenant');
    }
    s = { ...s, brokenClock: true };
    s = addLog(s, 'Broken Covenant — the next round will be the last.', 'bad');
  }

  // Discard crisis & cleanup
  if (s.activeCrisis) {
    s = {
      ...s,
      crisisDiscard: [...s.crisisDiscard, s.activeCrisis],
      activeCrisis: null,
    };
  }

  // Advance round or end
  const lastRound =
    s.round >= s.maxRounds || (s.brokenClock && s.round >= s.maxRounds);
  // If brokenClock just set this round, play one more full round
  const shouldEnd =
    s.round >= s.maxRounds ||
    (state.brokenClock && true); // if already on broken clock from previous round, end after this

  // Clarify: if brokenClock was already true at start of round, this was final. If just set, continue one more.
  const wasAlreadyBroken = state.brokenClock;
  if (wasAlreadyBroken || s.round >= s.maxRounds) {
    return endGame(s);
  }

  s = {
    ...s,
    round: s.round + 1,
    firstPlayerIndex: (s.firstPlayerIndex + 1) % s.turnOrder.length,
    turnOrder: rotate(s.turnOrder, 1),
  };
  void lastRound;
  void shouldEnd;
  return startRound(s);
}

function rotate<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = 0; i < n; i++) {
    a.push(a.shift()!);
  }
  return a;
}

function label(t: TrackId): string {
  return t[0]!.toUpperCase() + t.slice(1);
}

function awardChampion(state: GameState, res: TrackResolution): GameState {
  if (!res.championId) return state;
  let s = state;
  const tuning = s.tuningSnapshot;
  const reward = tuning.championRewards[res.track];
  const champ = getPlayer(s, res.championId);

  s = grantGlory(s, res.championId, reward.glory, true);
  const delta: Record<string, number> = {};
  if (reward.faith) delta.faith = reward.faith;
  if (reward.warriors) delta.warriors = reward.warriors;
  if (reward.goods) delta.goods = reward.goods;

  s = updatePlayer(s, res.championId, (p) => ({
    ...p,
    resources: mutateResources(p.resources, delta),
  }));

  // Judah Othniel I
  if (champ.tribe === 'Judah' && champ.leaderLevel >= 1) {
    s = grantGlory(s, res.championId, 1, true);
  }
  // Benjamin Ehud I
  if (champ.tribe === 'Benjamin' && champ.leaderLevel >= 1 && res.track === 'military') {
    s = updatePlayer(s, res.championId, (p) => ({
      ...p,
      resources: mutateResources(p.resources, { warriors: 1 }),
    }));
  }
  // Simeon vengeful
  if (champ.tribe === 'Simeon' && champ.leaderLevel >= 1 && res.track === 'military') {
    s = updatePlayer(s, res.championId, (p) => ({
      ...p,
      resources: mutateResources(p.resources, { warriors: 1 }),
    }));
  }
  // Levi Phinehas I
  if (champ.tribe === 'Levi' && champ.leaderLevel >= 1 && res.track === 'moral') {
    s = raiseCovenant(s, 1, 'Phinehas Covenant Zeal');
  }
  // Ephraim Deborah
  if (champ.tribe === 'Ephraim' && champ.leaderLevel >= 1 && res.track === 'moral') {
    s = updatePlayer(s, res.championId, (p) => ({
      ...p,
      resources: mutateResources(p.resources, { faith: 1 }),
    }));
  }
  // Issachar strategic insight
  if (champ.tribe === 'Issachar' && champ.leaderLevel >= 2) {
    s = updatePlayer(s, res.championId, (p) => ({
      ...p,
      resources: mutateResources(p.resources, { faith: 1 }),
    }));
  }
  // Zebulun commerce
  if (champ.tribe === 'Zebulun' && champ.leaderLevel >= 2 && res.track === 'provision') {
    s = grantGlory(s, res.championId, 1, true);
  }
  // Jephthah vow extra already elsewhere
  // Philistine Razor
  if (s.activeCrisis?.id === 8 && res.track === 'military') {
    const pl = getPlayer(s, res.championId);
    const discard = pl.resources.warriors > 0 ? 'warriors' : 'goods';
    if (pl.resources[discard] > 0) {
      s = updatePlayer(s, res.championId, (p) => ({
        ...p,
        resources: mutateResources(p.resources, { [discard]: -1 }),
      }));
      s = addLog(s, `${pl.tribe} pays Philistine Razor (lose 1 ${discard}).`, 'bad');
    }
  }
  // Benjamin free recruit (Ehud III)
  if (champ.tribe === 'Benjamin' && champ.leaderLevel >= 3 && res.track === 'military') {
    s = updatePlayer(s, res.championId, (p) => ({
      ...p,
      resources: mutateResources(p.resources, { warriors: 2, goods: -0 }),
    }));
    // free recruit as +2 warriors without cost for simplicity if no goods
    const pl = getPlayer(s, res.championId);
    if (pl.resources.goods >= 1) {
      s = updatePlayer(s, res.championId, (p) => ({
        ...p,
        resources: mutateResources(p.resources, { goods: -1, warriors: 2 }),
      }));
    } else {
      s = updatePlayer(s, res.championId, (p) => ({
        ...p,
        resources: mutateResources(p.resources, { warriors: 1 }),
      }));
    }
    s = addLog(s, `${champ.tribe} free Recruit (Ehud III).`, 'good');
  }

  s = checkLeaderUnlocks(s, res.championId);
  return s;
}

export function endGame(state: GameState): GameState {
  let s = state;
  const tuning = s.tuningSnapshot;

  if (tuning.endCovenantBonus) {
    const z = covenantZone(s.covenant, tuning);
    if (z === 'strength') {
      for (const p of s.players) {
        s = grantGlory(s, p.id, 1, false);
      }
      s = addLog(s, 'Covenant Strength — all gain +1 Glory.', 'good');
    } else if (z === 'judgment' || z === 'broken') {
      for (const p of s.players) {
        s = updatePlayer(s, p.id, (pl) => ({
          ...pl,
          resources: mutateResources(pl.resources, { glory: -1 }),
        }));
      }
      s = addLog(s, 'Weak Covenant — all lose 1 Glory.', 'bad');
    }
  }

  const ranked = [...s.players].sort((a, b) => {
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
  });

  const top = ranked[0]!;
  const winners = ranked
    .filter(
      (p) =>
        p.resources.glory === top.resources.glory &&
        p.resources.loyalty === top.resources.loyalty,
    )
    .map((p) => p.id);

  s = {
    ...s,
    phase: 'gameEnd',
    winners,
  };
  const names = winners.map((id) => getPlayer(s, id).tribe).join(' & ');
  s = addLog(s, `Game over — ${names} triumph with Glory!`, 'good');
  return s;
}

export function applyAngelChoice(
  state: GameState,
  topId: number,
  bottomId: number,
  covenantDelta: 1 | -1,
): GameState {
  let s = state;
  const opts = s.pendingCrisisChoice?.options ?? [];
  const top = opts.find((c) => c.id === topId);
  const bottom = opts.find((c) => c.id === bottomId);
  if (!top || !bottom || topId === bottomId) {
    return addLog(s, 'Invalid Angel choice.', 'bad');
  }
  const rest = s.crisisDeck.slice(2);
  s = {
    ...s,
    crisisDeck: [top, ...rest, bottom],
    pendingCrisisChoice: null,
    phase: 'placement',
    currentActorIndex: 0,
  };
  if (covenantDelta > 0) s = raiseCovenant(s, 1, 'Angel of the Lord');
  else s = applyCovenantDrop(s, 1, 'Angel of the Lord');
  return s;
}

void (null as unknown as TuningConfig);
