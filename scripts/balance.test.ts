/**
 * Balance harness — `npm run balance`.
 *
 * Plays a few hundred all-bot games and reports how the rules are behaving:
 * Banner/Supply split, per-track success rates, Covenant health, and per-tribe
 * win rates. It lives outside `src/` so the normal `npm test` run stays fast.
 *
 * Read the numbers as *directional*. The bot is a simple heuristic, so tribe win
 * rates say as much about how well the bot plays a tribe as about the tribe.
 * Changing bot strategy moves these figures more than most rule changes do.
 */
import { it } from 'vitest';
import { chooseBotAction } from '../src/ai/bots';
import { createGame } from '../src/engine/createGame';
import { currentActor, isBannerToken } from '../src/engine/helpers';
import { dispatch } from '../src/engine/index';
import type { GameState, TrackId, TribeId } from '../src/engine/types';

const TRACKS: TrackId[] = ['military', 'moral', 'provision'];
const GAMES = Number(process.env.BALANCE_GAMES ?? 300);

type TribeRow = { games: number; wins: number; glory: number; champs: number };

type Stats = {
  games: number;
  banner: number;
  supply: number;
  trackSuccess: Record<TrackId, number>;
  trackAttempts: Record<TrackId, number>;
  noChampionSuccess: number;
  perTribe: Record<string, TribeRow>;
  finalCovenant: number[];
  brokenGames: number;
};

function blank(): Stats {
  return {
    games: 0,
    banner: 0,
    supply: 0,
    trackSuccess: { military: 0, moral: 0, provision: 0 },
    trackAttempts: { military: 0, moral: 0, provision: 0 },
    noChampionSuccess: 0,
    perTribe: {},
    finalCovenant: [],
    brokenGames: 0,
  };
}

function tribeRow(stats: Stats, tribe: TribeId): TribeRow {
  stats.perTribe[tribe] ??= { games: 0, wins: 0, glory: 0, champs: 0 };
  return stats.perTribe[tribe]!;
}

function playGame(seed: number, players: number, stats: Stats): void {
  let s: GameState = createGame({ humanTribe: 'Judah', totalPlayers: players, seed });
  // Every seat plays itself.
  s = { ...s, players: s.players.map((p) => ({ ...p, isHuman: false })) };

  for (let step = 0; step < 6000 && s.phase !== 'gameEnd'; step++) {
    if (s.phase === 'resolve') {
      // Sample the revealed board before the next round clears it.
      for (const tok of s.tokens) {
        if (isBannerToken(tok)) stats.banner += 1;
        else stats.supply += 1;
      }
      for (const r of s.trackResults ?? []) {
        stats.trackAttempts[r.track] += 1;
        if (!r.success) continue;
        stats.trackSuccess[r.track] += 1;
        if (!r.championId) stats.noChampionSuccess += 1;
      }
      s = dispatch(s, { type: 'advance' });
      continue;
    }
    if (s.phase === 'crisisReveal') {
      s = dispatch(s, { type: 'advance' });
      continue;
    }

    const action = chooseBotAction(s);
    const before = s;
    s = action ? dispatch(s, action) : s;
    if (s.phase === before.phase && currentActor(s)?.id === currentActor(before)?.id) {
      s =
        before.phase === 'placement'
          ? dispatch(before, { type: 'confirmPlacement', plan: {} })
          : dispatch(before, { type: 'standard', action: 'pass' });
    }
  }

  stats.games += 1;
  stats.finalCovenant.push(s.covenant);
  if (s.brokenClock) stats.brokenGames += 1;
  for (const p of s.players) {
    const row = tribeRow(stats, p.tribe);
    row.games += 1;
    row.glory += p.resources.glory;
    row.champs += p.championships;
    if (s.winners?.includes(p.id)) row.wins += 1;
  }
}

const pct = (n: number, d: number) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`);

it(`balance sample over ${GAMES} games`, () => {
  const stats = blank();
  for (let i = 0; i < GAMES; i++) {
    playGame(1000 + i, 3 + (i % 4), stats); // rotate 3–6 players
  }

  const tokens = stats.banner + stats.supply;
  const successes = TRACKS.reduce((n, t) => n + stats.trackSuccess[t], 0);
  const out: string[] = [];

  out.push(`games ${stats.games}   tokens ${tokens}`);
  out.push(`Banner ${pct(stats.banner, tokens)}   Supply ${pct(stats.supply, tokens)}`);
  out.push('');
  out.push('track success:');
  for (const t of TRACKS) {
    out.push(`  ${t.padEnd(10)} ${pct(stats.trackSuccess[t], stats.trackAttempts[t])}`);
  }
  out.push('');
  out.push(
    `successes with no Champion: ${stats.noChampionSuccess}/${successes} (${pct(stats.noChampionSuccess, successes)})`,
  );
  out.push(
    `avg final Covenant ${(stats.finalCovenant.reduce((a, b) => a + b, 0) / stats.games).toFixed(2)}   broken-clock games ${pct(stats.brokenGames, stats.games)}`,
  );
  out.push('');
  out.push('tribe          games    win%   avgGlory  avgChamps');
  for (const [tribe, r] of Object.entries(stats.perTribe).sort(
    (a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games,
  )) {
    out.push(
      `  ${tribe.padEnd(11)} ${String(r.games).padStart(5)}  ${pct(r.wins, r.games).padStart(6)}  ${(r.glory / r.games).toFixed(2).padStart(8)}  ${(r.champs / r.games).toFixed(2).padStart(9)}`,
    );
  }

  console.log('\n' + out.join('\n') + '\n');
});
