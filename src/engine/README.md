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
| `resolve.ts` | Reveal, pre-resolve choices, track success/fail, Champions, the cycle, end game |
| `judges.ts` | The six Judge one-shots and Jephthah's end-game reckoning |
| `helpers.ts` | Shared mutators, thresholds, Glory/unlocks, standings |
| `types.ts` | State and action types |
| `testSupport.ts` | Test-only fixtures (`scenario`, `withTokens`, …) |

## Phase loop

`crisisReveal` → (`crisisChoice`) → `placement` → `action` → `preResolve` → `resolve` → next round or `gameEnd`.

Two of these are **pauses**, not transitions:

- **`preResolve`** — every token is face up and nothing is scored. This is where
  abilities that need full information are spent: Samson's shift, the Level III
  covenant rescue, and the Judge powers that read the board. `advance` scores it.
- **`resolve`** — the generation is settled and `trackResults` is populated, so
  the outcome stays on screen. `advance` runs `advanceToNextRound`.

## Who decides what

Abilities split by whether there is a decision to take away:

| Applied automatically | Player-declared |
|---|---|
| Othniel II, Ehud II (arm on a Military Banner) | Samson II — which token, which track |
| Nazirite Strength, Gad's Enduring Defense | The Level III covenant rescue — whether to spend it |
| Champion rewards, spoil, income | All six Judge one-shots |

The rule of thumb: a free bonus with no cost and no target applies itself; anything
with a cost, a target, or a "once per game" applies only when asked.

`src/engine/judges.ts` owns the one-shots. Each declares its window in
`JUDGE_POWER_WINDOW` — `action` for powers that fire on your turn, `preResolve`
for those that modify scoring — and declaring one clears `judgePower`, so it can
never be spent twice.

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
