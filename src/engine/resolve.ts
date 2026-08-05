/**
 * Reveal → resolve tracks → champion rewards → advance round or end game.
 */
import { TRACK_LABELS } from '../data/gameData';
import { OPPRESSOR_BY_ID, OPPRESSORS } from '../data/oppressors';
import {
  addLog,
  applyCovenantDrop,
  applyLoyaltyLoss,
  baseThreshold,
  checkLeaderUnlocks,
  clamp,
  covenantZone,
  cryThreshold,
  getPlayer,
  getTrackTotals,
  grantGlory,
  leastAmongThem,
  mulberry32,
  mutateResources,
  openingPhase,
  oppressionSeverity,
  raiseCovenant,
  rankPlayers,
  sameStanding,
  shuffle,
  TRACK_AFFINITY_RESOURCE,
  TRACKS,
  trackZone,
  updatePlayer,
} from './helpers';
import { startRound } from './round';
import type { GameState, TrackId, TrackResolution } from './types';

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

  // Simeon's Furious Assault token is good for the round after the failure only.
  // Expire anything unspent before this round's failures grant new ones.
  s = {
    ...s,
    players: s.players.map((p) =>
      p.freeMilitaryNextRound > 0 ? { ...p, freeMilitaryNextRound: 0 } : p,
    ),
  };

  // Gad Enduring Defense: when Military is Low, Gad's tokens count +1. Gad is a
  // Military tribe, so the bonus is Banner strength.
  for (const p of s.players) {
    if (p.tribe === 'Gad' && p.leaderLevel >= 2) {
      const thr = baseThreshold(s, 'military');
      const grand = Object.values(totals.total.military).reduce((a, b) => a + b, 0);
      if (grand < thr && (totals.total.military[p.id] ?? 0) > 0) {
        totals.total.military[p.id] = (totals.total.military[p.id] ?? 0) + 1;
        totals.banner.military[p.id] = (totals.banner.military[p.id] ?? 0) + 1;
      }
    }
  }

  const results: TrackResolution[] = [];

  for (const track of TRACKS) {
    const base = baseThreshold(s, track);
    const byPlayer = totals.total[track];
    const grand = Object.values(byPlayer).reduce((a, b) => a + b, 0);
    const bannerByPlayer = totals.banner[track];
    const bannerGrand = Object.values(bannerByPlayer).reduce((a, b) => a + b, 0);

    // Day of Midian raises what Military must beat, but not where the Low/High
    // zones sit — abilities that read zones keep measuring against the base.
    const thr =
      track === 'military' && s.activeCrisis?.id === 13 ? base * 2 : base;

    results.push({
      track,
      total: grand,
      bannerTotal: bannerGrand,
      threshold: thr,
      baseThreshold: base,
      success: grand >= thr,
      // Supply helps a track succeed but never claims it. A track carried
      // entirely by Supply succeeds with no Champion at all.
      championId: pickChampion(s, bannerByPlayer),
      zone: trackZone(grand, base, tuning.lowHighOffset),
    });
  }

  s = { ...s, trackResults: results };
  s = settleZoneUniques(s, results);

  // Champions + rewards
  for (const res of results) {
    if (!res.championId) {
      s = addLog(
        s,
        res.total > 0
          ? `${label(res.track)}: no Champion — ${res.total}/${res.threshold} Influence, all Supply.`
          : `${label(res.track)}: no Champion (total ${res.total}/${res.threshold}).`,
        'info',
      );
      continue;
    }
    const champ = getPlayer(s, res.championId);
    s = updatePlayer(s, res.championId, (p) => ({
      ...p,
      championships: p.championships + 1,
    }));
    // Report the Champion's own Banner strength — the number they actually won
    // on. The track total includes Supply and everyone else's tokens, so using
    // it here reads as though the Champion placed far more than they did.
    s = addLog(
      s,
      `${champ.tribe} is ${label(res.track)} Champion (${totals.banner[res.track][res.championId] ?? 0} Banner of ${res.total} Infl.).`,
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
    const mil = Object.entries(totals.total.military).sort((a, b) => b[1] - a[1]);
    for (const [pid] of mil.slice(0, 2)) {
      if ((totals.total.military[pid] ?? 0) > 0) {
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
        for (const [pid, v] of Object.entries(totals.total.military)) {
          if (v > 0) s = grantGlory(s, pid, 1, false);
        }
      }
      // Jephthah vow success
      if (res.track === 'moral' && s.activeCrisis?.id === 9 && res.championId) {
        s = grantGlory(s, res.championId, 1, false);
      }
      s = paySpoil(s, res, totals.total[res.track]);
      continue;
    }

    // Failure
    let drop = covenantZone(s.covenant, tuning) === 'judgment' ? 2 : 1;
    if (res.track === 'moral' && s.activeCrisis?.id === 9) drop += 1;

    s = applyCovenantDrop(s, drop, `${label(res.track)} failed`);

    // Only Banner contributors staked their name on the track, so only they take
    // the Loyalty penalty. Supply is help sent at no personal risk.
    for (const [pid, v] of Object.entries(totals.banner[res.track])) {
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

  // Judgment: lowest Loyalty discards. Everyone tied for lowest pays — otherwise
  // who pays would depend on player array order.
  if (zone === 'judgment') {
    const minLoyalty = Math.min(...s.players.map((p) => p.resources.loyalty));
    for (const lowest of s.players.filter(
      (p) => p.resources.loyalty === minLoyalty,
    )) {
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

  // The cycle: deliverance is checked before a fresh oppression can be summoned,
  // so a Cry completed this round restores the Covenant and no new Oppressor
  // arrives on the same breath.
  s = resolveOppression(s);

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

  // End after scheduled rounds, or after the final round of a Broken Covenant clock.
  // If Broken was first triggered this round, play one more full round.
  const wasAlreadyBroken = state.brokenClock;
  if (wasAlreadyBroken || s.round >= s.maxRounds) {
    return endGame(s);
  }

  // Hold in `resolve` so the revealed board, track results, and Champions stay
  // readable. `advanceToNextRound` (dispatch 'advance') clears them and deals on.
  return { ...s, phase: 'resolve' };
}

/** Rotate the first player and begin the next round. */
export function advanceToNextRound(state: GameState): GameState {
  return startRound({
    ...state,
    round: state.round + 1,
    firstPlayerIndex: (state.firstPlayerIndex + 1) % state.turnOrder.length,
    turnOrder: rotate(state.turnOrder, 1),
  });
}

/**
 * The cycle of Judges, run at the end of every round:
 *
 *   deliverance (if the Cry was met) → escalation (if it was not)
 *   → a new oppression (if the Covenant has fallen into Judgment)
 *
 * Order matters. Checking deliverance first means a Cry completed this round
 * restores the Covenant *before* the Judgment test, so Israel is not delivered
 * and immediately sold again in the same breath.
 */
function resolveOppression(state: GameState): GameState {
  let s = state;
  const tuning = s.tuningSnapshot;
  if (!tuning.oppressionEnabled) return s;

  if (s.oppression) {
    const def = OPPRESSOR_BY_ID[s.oppression.oppressorId];

    if (s.oppression.cryPool >= cryThreshold(s)) {
      // Deliverance. The Lord raises up a judge from the least among them.
      const judge = leastAmongThem(s);
      s = { ...s, oppression: null, restRound: tuning.restAfterDeliverance };
      s = addLog(s, `${def.title} is broken — Israel is delivered.`, 'good');

      const restored = clamp(
        Math.max(s.covenant, tuning.covenantStart),
        0,
        tuning.covenantMax,
      );
      if (restored !== s.covenant) {
        s = { ...s, covenant: restored };
        s = addLog(s, `Covenant Meter restored to ${restored} (deliverance).`, 'good');
      }

      if (judge) {
        s = updatePlayer(s, judge.id, (p) => ({
          ...p,
          judgeships: p.judgeships + 1,
          judgePower: def.id,
        }));
        s = addLog(
          s,
          `${judge.tribe} — least among the tribes — is raised up as ${def.deliverer}.`,
          'good',
        );
        s = grantGlory(s, judge.id, tuning.judgeGlory, false);
      }
      return s;
    }

    // Not delivered. The oppression endures, and worsens.
    s = {
      ...s,
      oppression: { ...s.oppression, roundsEndured: s.oppression.roundsEndured + 1 },
    };
    s = addLog(
      s,
      `${def.title} tightens its grip (severity ${oppressionSeverity(s)}).`,
      'bad',
    );
    return s;
  }

  // No oppression standing. Judgment on the meter sells Israel into a hand.
  if (covenantZone(s.covenant, tuning) !== 'judgment') return s;

  let deck = [...s.oppressorDeck];
  if (deck.length === 0) {
    // Every oppression has been endured once; the cycle begins again.
    deck = shuffle(
      OPPRESSORS.map((o) => o.id),
      mulberry32(s.seed + s.round * 71),
    );
  }
  const next = deck.shift();
  if (!next) return s;

  const def = OPPRESSOR_BY_ID[next];
  s = {
    ...s,
    oppressorDeck: deck,
    oppression: { oppressorId: next, roundsEndured: 0, cryPool: 0, contributors: {} },
  };
  s = addLog(
    s,
    `The Covenant is in Judgment — Israel is sold into the hand of ${def.name}. ` +
      `${TRACK_LABELS[def.attacks]} is pressed until the tribes cry out (${cryThreshold(s)} Faith).`,
    'crisis',
  );
  return s;
}

/**
 * Divide the spoil of a successful track.
 *
 * Everyone who contributed — Banner or Supply — shares in it, except the
 * Champion, who is already paid the richer Champion reward. This is what makes
 * Supply worth sending: it converts an off-affinity resource into the one the
 * track wants, at a better rate than the Convert action, in exchange for the
 * risk that the track fails and pays nothing.
 */
function paySpoil(
  state: GameState,
  res: TrackResolution,
  contributors: Record<string, number>,
): GameState {
  let s = state;
  const amount = s.tuningSnapshot.spoilOnSuccess;
  if (amount <= 0) return s;
  const resource = TRACK_AFFINITY_RESOURCE[res.track];

  for (const [pid, influence] of Object.entries(contributors)) {
    if (influence <= 0 || pid === res.championId) continue;
    s = updatePlayer(s, pid, (p) => ({
      ...p,
      resources: mutateResources(p.resources, { [resource]: amount }),
    }));
    s = addLog(
      s,
      `${getPlayer(s, pid).tribe} shares the spoil of ${label(res.track)} (+${amount} ${resource}).`,
      'good',
    );
  }
  return s;
}

/**
 * Settle Benjamin's Raid and Simeon's Skirmish now that Influence is face-up.
 * Both were paid for during the action phase; only the Low-zone branch waited.
 */
function settleZoneUniques(
  state: GameState,
  results: TrackResolution[],
): GameState {
  let s = state;
  const militaryLow =
    results.find((r) => r.track === 'military')?.zone === 'low';

  for (const player of s.players) {
    const pending = player.pendingZoneUnique;
    if (!pending) continue;
    const id = player.id;

    s = updatePlayer(s, id, (p) => ({ ...p, pendingZoneUnique: null }));

    if (pending === 'raid') {
      s = updatePlayer(s, id, (p) => ({
        ...p,
        resources: mutateResources(p.resources, { goods: 1 }),
      }));
      if (militaryLow) {
        s = addLog(s, `${player.tribe} Raid hits a Low Military Track — +1 Goods, no Glory.`, 'bad');
        s = applyLoyaltyLoss(s, id, 1, 'Raid in Low zone');
      } else {
        s = addLog(s, `${player.tribe} Raid succeeds — +1 Goods, +1 Glory.`, 'good');
        s = grantGlory(s, id, 1, false);
      }
      continue;
    }

    // Skirmish always pays Glory; Low Military adds Goods.
    if (militaryLow) {
      s = updatePlayer(s, id, (p) => ({
        ...p,
        resources: mutateResources(p.resources, { goods: 1 }),
      }));
      s = addLog(s, `${player.tribe} Skirmishes a Low Military Track — +1 Glory, +1 Goods.`, 'good');
    } else {
      s = addLog(s, `${player.tribe} Skirmishes — +1 Glory.`, 'good');
    }
    s = grantGlory(s, id, 1, false);
  }

  return s;
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
  // Benjamin Ehud III — a free *Recruit action*: the action is free, its cost is
  // not. Takes the 1 Goods → 2 Warriors mode, else the Faith mode, else nothing.
  if (champ.tribe === 'Benjamin' && champ.leaderLevel >= 3 && res.track === 'military') {
    const now = getPlayer(s, res.championId);
    if (now.resources.goods >= 1) {
      s = updatePlayer(s, res.championId, (p) => ({
        ...p,
        resources: mutateResources(p.resources, { goods: -1, warriors: 2 }),
      }));
      s = addLog(s, `${champ.tribe} free Recruit (Ehud III): 1 Goods → 2 Warriors.`, 'good');
    } else if (now.resources.faith >= 1) {
      s = updatePlayer(s, res.championId, (p) => ({
        ...p,
        resources: mutateResources(p.resources, { warriors: 1 }),
      }));
      s = addLog(s, `${champ.tribe} free Recruit (Ehud III): +1 Warrior via Faith.`, 'good');
    } else {
      s = addLog(s, `${champ.tribe} cannot pay for the free Recruit (Ehud III).`, 'info');
    }
  }

  // Idempotent safety net (grantGlory already checks unlocks).
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
    } else if (z === 'judgment') {
      for (const p of s.players) {
        s = updatePlayer(s, p.id, (pl) => ({
          ...pl,
          resources: mutateResources(pl.resources, { glory: -1 }),
        }));
      }
      s = addLog(s, 'Weak Covenant — all lose 1 Glory.', 'bad');
    }
    // Broken Covenant (0–1) carries no Glory penalty: its Loyalty losses were
    // already applied during resolution and the rules say to "score as normal".
  }

  const ranked = rankPlayers(s.players);
  const top = ranked[0]!;
  const winners = ranked.filter((p) => sameStanding(p, top)).map((p) => p.id);

  s = {
    ...s,
    phase: 'gameEnd',
    winners,
  };
  const names = winners.map((id) => getPlayer(s, id).tribe).join(' & ');
  const why = state.brokenClock
    ? 'Broken Covenant ended the contest'
    : `All ${state.maxRounds} rounds completed`;
  s = addLog(s, `Game over — ${why}. ${names} triumph with Glory!`, 'good');
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
    phase: openingPhase(s),
    currentActorIndex: 0,
  };
  if (covenantDelta > 0) s = raiseCovenant(s, 1, 'Angel of the Lord');
  else s = applyCovenantDrop(s, 1, 'Angel of the Lord');
  return s;
}
