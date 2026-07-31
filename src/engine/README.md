# Rules engine

Pure TypeScript game logic. React holds one `GameState` and calls `dispatch` / reads helpers for display.

## Module map

| File | Responsibility |
|------|----------------|
| `index.ts` | Public API: `dispatch`, re-exports |
| `createGame.ts` | Setup: tribes, seed, initial state → `startRound` |
| `round.ts` | Start of round: flags, income (r2+), Crisis draw |
| `placement.ts` | Face-down Influence, turn order advancement |
| `actions.ts` | Standard + unique actions |
| `resolve.ts` | Reveal, track success/fail, Champions, end game |
| `helpers.ts` | Shared mutators, thresholds, Glory/unlocks, standings |
| `types.ts` | State and action types |

## Phase loop

`crisisReveal` → (`crisisChoice`) → `placement` → `action` → `reveal` → `resolve` → next `startRound` or `gameEnd`.

## Conventions

1. **Glory** that can unlock leaders must use `grantGlory` (never raw `mutateResources` for positive Glory).
2. **Income** is granted in `startRound` for rounds **2+** so printed starting resources stay accurate for round 1.
3. **Leader upgrades** unlock at Glory thresholds (`tuning.leaderUnlockGlory`, default 3/6/9). Which upgrades actually have effects is tracked in `src/data/leaderImpl.ts`.
4. Prefer importing from `src/engine` (barrel) in UI/AI code.

## Known stubs

- Many leader II/III abilities are design-complete in data/UI but not fully interactive in the engine — see `LEADER_UPGRADE_ACTIVE`.
- `tuning.freePlacementPhase` is not read (placement is always free then one action).
- `influencePool` / Gad `overcomerAvailable` / Naphtali `pendingTempInfluenceGift` are reserved fields.

## Suggested tests (none automated yet)

- `grantGlory` + `checkLeaderUnlocks` (including multi-level jumps)
- `applyRoundIncome` (loyalty cap; not applied on round 1)
- `awardChampion` / Ehud III free Recruit
- Raid/Skirmish Low via `isTrackLow` + `baseThreshold`
- `endGame` winners with full tie-break order
- Broken Covenant final-round clock
