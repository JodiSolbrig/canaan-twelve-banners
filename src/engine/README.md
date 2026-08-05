# Rules engine

Pure TypeScript game logic. React holds one `GameState` and calls `dispatch` / reads helpers for display.

## Module map

| File | Responsibility |
|------|----------------|
| `index.ts` | Public API: `dispatch`, re-exports |
| `createGame.ts` | Setup: tribes, seed, initial state → `startRound` |
| `round.ts` | Start of round: flags, income (r2+), Crisis draw |
| `placement.ts` | Face-down Influence, token values, turn advancement |
| `actions.ts` | Standard + unique actions, and the leader trades (`LEADER_TRADES`) |
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
| | Leader trades — whether, and which way |

The rule of thumb: a free bonus with no cost and no target applies itself; anything
with a cost, a target, or a "once per game" applies only when asked.

Two action-phase spends are **free of the action** and so do not advance the
turn: a Judge one-shot whose window is `action`, and a leader trade. Both are
dispatched, take effect, and leave the player their full action.

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

Seven of the thirty-nine leader upgrades are design-complete in data and UI but
have no engine effect — see `LEADER_UPGRADE_ACTIVE`, which is the authority.
They fall into three groups:

| Group | Upgrades | What they need |
|---|---|---|
| Peeks | Manasseh I (Fleece Test), Issachar I (Understanding of Times) | A pre-placement information window; the state they would read is public already, so the value is in the *timing* |
| Doublers | Asher III (Rich Harvest), Zebulun III (Profitable Venture) | A once-per-game hook on a Goods gain, which has no single choke point yet |
| Token manipulation | Judah III (First in Line), Issachar III (Wise Counsel) | A `preResolve` prompt; Issachar III moves *another player's* token, which nothing else in the engine does |

Levi II (Intercession) is deliberately unwired: Levi's unique action already
does what the upgrade text describes, so wiring it would give Levi the same
ability twice.

## Tests

`npm test` runs everything. Coverage lives beside the code:

| File | Covers |
|------|--------|
| `helpers.test.ts` | thresholds, Covenant zones, Glory/unlocks, income, Loyalty and Covenant mutators, standings |
| `placement.test.ts` | costs, Crisis 1/3 token values, Simeon carryover, placement-triggered leader bonuses, immutability |
| `actions.test.ts` | every standard action, each unique, Micah's Idol, round-1 gate, `dispatch` phase flow |
| `leaderTrades.test.ts` | Zebulun I / Simeon III / Ephraim III rates, once-per-round, and that a trade never eats the turn |
| `../ai/bots.test.ts` | bot placement, and that Banner *and* Supply both get played |
| `resolve.test.ts` | Champions and tie-breaks, failures, Covenant zone effects, Crisis 13/14, deferred uniques, Broken clock, `endGame` |
| `game.test.ts` | full bot-vs-bot games across seeds and player counts, asserting invariants |
| `../data/gameData.test.ts` | shipped data still matches the CSV design package |
