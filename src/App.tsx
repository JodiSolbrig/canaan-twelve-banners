import { useCallback, useEffect, useRef, useState } from 'react';
import { chooseBotAction } from './ai/bots';
import { cloneTuning, DEFAULT_TUNING, type TuningConfig } from './config/tuning';
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
  const botTimer = useRef<number | null>(null);

  const startGame = useCallback(
    (opts: { humanTribe: TribeId; totalPlayers: number }, t = tuning) => {
      setLastSetup(opts);
      const g = createGame({ ...opts, tuning: t });
      setState(g);
      setScreen('play');
    },
    [tuning],
  );

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
            <HumanControls state={state} onAction={applyAction} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <PlayersStrip state={state} />
            <EventLog state={state} />
          </div>
        </div>
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
      <PlayerAidModal open={aidOpen} onClose={() => setAidOpen(false)} />
    </div>
  );
}
