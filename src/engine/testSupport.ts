/**
 * Fixtures for the engine tests.
 *
 * Scenarios are built through `createGame` so every state carries the real shape
 * (adding a field to `PlayerState` cannot leave a test running against a stale
 * literal), then patched into whatever position the test needs.
 */
import { DEFAULT_TUNING, type TuningConfig } from '../config/tuning';
import { CRISIS_CARDS } from '../data/gameData';
import { createGame } from './createGame';
import { nextTokenId } from './helpers';
import type {
  GameState,
  PlayerState,
  Resources,
  TrackId,
  TribeId,
} from './types';

export type ScenarioOptions = {
  /** Player 0 is the human; the rest are bots, seated in this order. */
  tribes: TribeId[];
  tuning?: Partial<TuningConfig>;
  round?: number;
  covenant?: number;
  /** Crisis card id to force, or null for none. Omit to keep the drawn card. */
  crisisId?: number | null;
  phase?: GameState['phase'];
};

export function scenario(opts: ScenarioOptions): GameState {
  const [humanTribe, ...botTribes] = opts.tribes;
  if (!humanTribe) throw new Error('scenario needs at least one tribe');

  const tuning: TuningConfig = {
    ...structuredClone(DEFAULT_TUNING),
    ...opts.tuning,
  };

  const game = createGame({
    humanTribe,
    botTribes,
    totalPlayers: opts.tribes.length,
    seed: 4242,
    tuning,
  });

  // Forcing a Crisis has to keep the 14-card deck honest: pull the forced card
  // out of the draw pile and return whichever card was dealt in its place.
  let crisis = game.activeCrisis;
  let crisisDeck = game.crisisDeck;
  if (opts.crisisId !== undefined) {
    crisis =
      opts.crisisId === null
        ? null
        : (CRISIS_CARDS.find((c) => c.id === opts.crisisId) ?? null);
    crisisDeck = game.crisisDeck.filter((c) => c.id !== crisis?.id);
    if (game.activeCrisis && game.activeCrisis.id !== crisis?.id) {
      crisisDeck = [...crisisDeck, game.activeCrisis];
    }
  }

  return {
    ...game,
    // Seat players in the order given rather than the shuffled order, so
    // turn-order tie-breaks are predictable.
    turnOrder: game.players.map((p) => p.id),
    currentActorIndex: 0,
    round: opts.round ?? game.round,
    covenant: opts.covenant ?? game.covenant,
    activeCrisis: crisis,
    crisisDeck,
    phase: opts.phase ?? 'placement',
  };
}

/** Id of the nth seated player (0 = human). */
export function idAt(state: GameState, index: number): string {
  const id = state.players[index]?.id;
  if (!id) throw new Error(`No player at seat ${index}`);
  return id;
}

export function playerOf(state: GameState, id: string): PlayerState {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`No player ${id}`);
  return p;
}

/** Overwrite a player's resources outright (absolute values, not deltas). */
export function setResources(
  state: GameState,
  id: string,
  resources: Partial<Resources>,
): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === id ? { ...p, resources: { ...p.resources, ...resources } } : p,
    ),
  };
}

export function patchPlayer(
  state: GameState,
  id: string,
  patch: Partial<PlayerState>,
): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

/** Drop tokens straight onto a track, bypassing cost and Crisis effects. */
export function withTokens(
  state: GameState,
  specs: Array<{ playerId: string; track: TrackId; count: number; value?: number }>,
): GameState {
  const tokens = [...state.tokens];
  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      tokens.push({
        id: nextTokenId(),
        playerId: spec.playerId,
        track: spec.track,
        value: spec.value ?? 1,
        temporary: false,
        faceDown: true,
      });
    }
  }
  return { ...state, tokens };
}

/** Total Influence a player has on a track, as the board would read it. */
export function tokenTotal(
  state: GameState,
  playerId: string,
  track: TrackId,
): number {
  return state.tokens
    .filter((t) => t.playerId === playerId && t.track === track)
    .reduce((sum, t) => sum + t.value, 0);
}
