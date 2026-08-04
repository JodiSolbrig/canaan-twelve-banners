# Rules engine

Pure TypeScript game logic. React holds one `GameState` and calls `dispatch` / reads helpers for display.

## Module map

| File | Responsibility |
|------|----------------|
| `index.ts` | Public API: `dispatch`, re-exports |
| `createGame.ts` | Setup: tribes, seed, initial state → `startRound` |
| `round.ts` | Start of round: flags, income (r2+), Crisis draw |
| `placement.ts` | Face-down Influence, token values, turn advancement |
| `actions.ts` | Standard + unique actions |
| `resolve.ts` | Reveal, track success/fail, Champions, next round, end game |
| `helpers.ts` | Shared mutators, thresholds, Glory/unlocks, standings |
| `types.ts` | State and action types |
| `testSupport.ts` | Test-only fixtures (`scenario`, `withTokens`, …) |

## Phase loop

`crisisReveal` → (`crisisChoice`) → `placement` → `action` → `reveal` → `resolve` → next `startRound` or `gameEnd`.

`resolve` is a **pause**, not a transition: `resolveRound` settles the round and
stops there so the revealed board, `trackResults`, and Champions stay on screen.
Dispatching `advance` from `resolve` runs `advanceToNextRound`, which rotates the
first player and deals the next Crisis.

With `tuning.freePlacementPhase` off, `placement` is skipped entirely and
`placeInfluence` becomes one of the action-phase choices — the printed rules.

## Conventions

1. **Glory** that can unlock leaders must use `grantGlory` (never raw `mutateResources` for positive Glory).
2. **Income** is granted in `startRound` for rounds **2+** so printed starting resources stay accurate for round 1. Permanent per-player bonuses live in `PlayerState.incomeBonus`.
3. **Leader upgrades** unlock at Glory thresholds (`tuning.leaderUnlockGlory`, default 3/6/9). Which upgrades actually have effects is tracked in `src/data/leaderImpl.ts`.
4. **Never mutate** a token, player, or state object in place — every mutator returns a fresh object. React holds prior states, and tests assert this.
5. **Zone-dependent effects** must read `TrackResolution.zone` after Reveal, not the live board. Reading face-down tokens leaks hidden information and makes outcomes depend on seat order.
6. Prefer importing from `src/engine` (barrel) in UI/AI code.

## Known stubs

- Several leader II/III abilities are design-complete in data/UI but not fully interactive in the engine — see `LEADER_UPGRADE_ACTIVE`. The ones needing a player prompt (Othniel III, Samson II/III, Barak I–III, Reuben's whole line, Issachar III, Gad III) are the remaining work.
- `influencePool` and Naphtali `pendingTempInfluenceGift` are reserved fields; the gift is consumed in placement but nothing sets it yet.
- Gad `overcomerAvailable` is reserved; Overcomer has no activation path.

## Tests

`npm test` runs everything. Coverage lives beside the code:

| File | Covers |
|------|--------|
| `helpers.test.ts` | thresholds, Covenant zones, Glory/unlocks, income, Loyalty and Covenant mutators, standings |
| `placement.test.ts` | costs, Crisis 1/3 token values, Simeon carryover, placement-triggered leader bonuses, immutability |
| `actions.test.ts` | every standard action, each unique, Micah's Idol, round-1 gate, `dispatch` phase flow |
| `resolve.test.ts` | Champions and tie-breaks, failures, Covenant zone effects, Crisis 13/14, deferred uniques, Broken clock, `endGame` |
| `game.test.ts` | full bot-vs-bot games across seeds and player counts, asserting invariants |
| `../data/gameData.test.ts` | shipped data still matches the CSV design package |
