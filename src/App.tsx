import { useCallback, useEffect, useRef, useState } from 'react';
import { chooseBotAction } from './ai/bots';
import { cloneTuning, DEFAULT_TUNING, type TuningConfig } from './config/tuning';
import { TRIBE_BY_ID } from './data/gameData';
import { createGame, currentActor, dispatch, type GameState, type PlayerAction } from './engine';
import type { TribeId } from './engine/types';
import {
  CovenantMeter,
  CrisisPanel,
  EventLog,
  PlayersStrip,
  TracksBoard,
} from './ui/Board';
import { EndScreen } from './ui/EndScreen';
import { HumanControls } from './ui/HumanControls';
import {
  LeaderUnlockToast,
  type LeaderUnlockNotice,
} from './ui/LeaderProgress';
import { PlayerAidModal } from './ui/PlayerAidModal';
import { SetupScreen } from './ui/SetupScreen';
import { TuningDrawer } from './ui/TuningDrawer';

type Screen = 'setup' | 'play';

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [tuning, setTuning] = useState<TuningConfig>(() => cloneTuning(DEFAULT_TUNING));
  const [state, setState] = useState<GameState | null>(null);
  const [lastSetup, setLastSetup] = useState<{
    humanTribe: TribeId;
    totalPlayers: number;
  } | null>(null);
  const [tuningOpen, setTuningOpen] = useState(false);
  const [aidOpen, setAidOpen] = useState(false);
  const [unlockNotice, setUnlockNotice] = useState<LeaderUnlockNotice | null>(null);
  const [flashPlayerIds, setFlashPlayerIds] = useState<string[]>([]);
  const [flashLeaderLevel, setFlashLeaderLevel] = useState<number | null>(null);
  const botTimer = useRef<number | null>(null);
  const prevLeaderLevels = useRef<Record<string, number>>({});
  const flashClearTimer = useRef<number | null>(null);
  const toastClearTimer = useRef<number | null>(null);

  const startGame = useCallback(
    (opts: { humanTribe: TribeId; totalPlayers: number }, t = tuning) => {
      setLastSetup(opts);
      const g = createGame({ ...opts, tuning: t });
      prevLeaderLevels.current = Object.fromEntries(
        g.players.map((p) => [p.id, p.leaderLevel]),
      );
      setUnlockNotice(null);
      setFlashPlayerIds([]);
      setFlashLeaderLevel(null);
      setState(g);
      setScreen('play');
    },
    [tuning],
  );

  // Detect leader unlocks for toast + pulse feedback
  useEffect(() => {
    if (!state) {
      prevLeaderLevels.current = {};
      return;
    }

    const flashes: string[] = [];
    let humanLevels: Array<{ level: number; text: string }> = [];
    let humanTribe: TribeId | null = null;

    for (const p of state.players) {
      const hadPrev = Object.prototype.hasOwnProperty.call(prevLeaderLevels.current, p.id);
      const prev = prevLeaderLevels.current[p.id] ?? 0;
      if (hadPrev && p.leaderLevel > prev) {
        flashes.push(p.id);
        if (p.isHuman) {
          humanTribe = p.tribe;
          for (let lvl = prev + 1; lvl <= p.leaderLevel; lvl++) {
            humanLevels.push({
              level: lvl,
              text: TRIBE_BY_ID[p.tribe].upgrades[lvl - 1] ?? `Level ${lvl}`,
            });
          }
        }
      }
      prevLeaderLevels.current[p.id] = p.leaderLevel;
    }

    if (flashes.length === 0) return;

    setFlashPlayerIds(flashes);
    if (flashClearTimer.current) window.clearTimeout(flashClearTimer.current);
    flashClearTimer.current = window.setTimeout(() => {
      setFlashPlayerIds([]);
      setFlashLeaderLevel(null);
    }, 3200);

    if (humanTribe && humanLevels.length > 0) {
      const def = TRIBE_BY_ID[humanTribe];
      setFlashLeaderLevel(humanLevels[humanLevels.length - 1]!.level);
      setUnlockNotice({
        tribeId: def.id,
        color: def.color,
        levels: humanLevels,
      });
      if (toastClearTimer.current) window.clearTimeout(toastClearTimer.current);
      toastClearTimer.current = window.setTimeout(() => setUnlockNotice(null), 6500);
    }
  }, [state]);

  useEffect(() => {
    return () => {
      if (flashClearTimer.current) window.clearTimeout(flashClearTimer.current);
      if (toastClearTimer.current) window.clearTimeout(toastClearTimer.current);
    };
  }, []);

  const applyAction = useCallback((action: PlayerAction) => {
    setState((prev) => (prev ? dispatch(prev, action) : prev));
  }, []);

  // Bot loop
  useEffect(() => {
    if (!state || state.phase === 'gameEnd') return;

    if (state.phase === 'crisisReveal') {
      const t = window.setTimeout(() => {
        applyAction({ type: 'advance' });
      }, 900);
      return () => clearTimeout(t);
    }

    if (state.phase === 'crisisChoice') {
      return;
    }

    const actor = currentActor(state);
    if (!actor || actor.isHuman) return;
    if (state.phase !== 'placement' && state.phase !== 'action') return;

    if (botTimer.current) window.clearTimeout(botTimer.current);
    botTimer.current = window.setTimeout(() => {
      const action = chooseBotAction(state);
      if (action) {
        setState((prev) => {
          if (!prev) return prev;
          const beforeActor = currentActor(prev)?.id;
          const beforePhase = prev.phase;
          let next = dispatch(prev, action);
          // If action failed to progress, pass instead
          if (
            next.phase === beforePhase &&
            currentActor(next)?.id === beforeActor &&
            action.type !== 'confirmPlacement'
          ) {
            next = dispatch(prev, { type: 'standard', action: 'pass' });
          }
          return next;
        });
      }
    }, state.tuningSnapshot.botThinkMs);

    return () => {
      if (botTimer.current) window.clearTimeout(botTimer.current);
    };
  }, [state, applyAction]);

  return (
    <div className="app-shell">
      <header className="brand-bar">
        <div>
          <h1>Canaan</h1>
          <div className="subtitle">Tribes of the Covenant — Twelve Banners</div>
        </div>
        <div className="brand-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setAidOpen(true)}>
            Player Aid
          </button>
          <button type="button" className="btn" onClick={() => setTuningOpen(true)}>
            Tuning
          </button>
          {screen === 'play' && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setScreen('setup');
                setState(null);
              }}
            >
              Setup
            </button>
          )}
        </div>
      </header>

      {screen === 'setup' && (
        <SetupScreen tuning={tuning} onStart={(opts) => startGame(opts)} />
      )}

      {screen === 'play' && state && state.phase === 'gameEnd' && (
        <EndScreen
          state={state}
          onRematch={() => lastSetup && startGame(lastSetup)}
          onSetup={() => {
            setScreen('setup');
            setState(null);
          }}
        />
      )}

      {screen === 'play' && state && state.phase !== 'gameEnd' && (
        <div className="board-layout">
          <div>
            <div className="top-status">
              <CovenantMeter state={state} />
              <CrisisPanel state={state} />
            </div>
            <TracksBoard state={state} />
            <HumanControls
              state={state}
              onAction={applyAction}
              flashLeaderLevel={flashLeaderLevel}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <PlayersStrip state={state} flashPlayerIds={flashPlayerIds} />
            <EventLog state={state} />
          </div>
        </div>
      )}

      {unlockNotice && (
        <LeaderUnlockToast
          notice={unlockNotice}
          onDismiss={() => setUnlockNotice(null)}
        />
      )}

      <TuningDrawer
        open={tuningOpen}
        tuning={tuning}
        onClose={() => setTuningOpen(false)}
        onApply={(t) => {
          setTuning(t);
          setTuningOpen(false);
          if (lastSetup) startGame(lastSetup, t);
          else setScreen('setup');
        }}
      />
      <PlayerAidModal
        open={aidOpen}
        onClose={() => setAidOpen(false)}
        thresholds={
          state?.tuningSnapshot.leaderUnlockGlory ?? tuning.leaderUnlockGlory
        }
      />
    </div>
  );
}
