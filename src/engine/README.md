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
| `helpers.ts` | Shared mutators, thresholds, Glory/Goods grants, unlocks, standings |
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
| Levi's Tithe, once Provision is Championed | Claim the Field, Wise Counsel, Spend Your Resilience |

The rule of thumb: a free bonus with no cost and no target applies itself; anything
with a cost, a target, or a "once per game" applies only when asked.

Several spends are **free of the turn** and so do not advance the actor: a Judge
one-shot whose window is `action`, a leader trade, arming a Goods doubler,
Issachar's study and Manasseh's Resilience during placement. They dispatch, take effect, and leave the
player their full placement or action.

Anything driving bots must therefore use `src/ai/botStep.ts` rather than calling
`dispatch` behind its own stall guard. The app and the balance harness each had
their own copy of that guard, both treating "the seat did not advance" as stuck —
which silently threw away every free action *and* spent the seat's real turn on a
pass. Issachar never placed a token again once it could study.

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

**None.** All thirty-nine leader upgrades have engine effects;
`src/data/leaderImpl.ts` is the authority and is now `true` throughout.

Three of them were rewritten rather than wired, because implementing the printed
text would have duplicated something the game already did or done nothing at all:

| Was | Is | Why |
|---|---|---|
| Judah III — First in Line: move 1 of your tokens after the reveal | **Claim the Field**: your Supply on a named track stands up as Banners | The original was `applyShiftToken` with a different cooldown — Dan and Naphtali already do it. The replacement is the only rule that rewrites what a token *is* rather than where it stands |
| Manasseh I — Fleece Test: look at one track's current special modifier | **Spend Your Resilience**: 1 Loyalty buys 2 Supply | Crisis and Oppressor modifiers are face up, so the original revealed nothing. Loyalty is spent by choice nowhere else, and Manasseh starts with the most of it |
| Levi II — Intercession: spend 1 Faith to prevent 1 Covenant loss | **The Tithe**: barred from Provision Championship, paid 1 Goods by whoever takes it | Word for word Levi's own unique action. Nothing else in the game pays you off another player's success |

## Goods, and the one way in

Every gain of Goods goes through `grantGoods`, the way every positive Glory goes
through `grantGlory`. Asher III and Zebulun III double a single gain once per
game, and a source that bypassed the choke point would silently never double —
a bug with no symptom. `grantGoods` takes a `GoodsSource` because the two cards
differ: Asher's names actions and Champion rewards, Zebulun's names any source
at all. Spending Goods still goes through `mutateResources`; only gains can be
doubled.

## Tests

`npm test` runs everything. Coverage lives beside the code:

| File | Covers |
|------|--------|
| `helpers.test.ts` | thresholds, Covenant zones, Glory/unlocks, income, Loyalty and Covenant mutators, standings |
| `placement.test.ts` | costs, Crisis 1/3 token values, Simeon carryover, placement-triggered leader bonuses, immutability |
| `actions.test.ts` | every standard action, each unique, Micah's Idol, round-1 gate, `dispatch` phase flow |
| `leaderTrades.test.ts` | Zebulun I / Simeon III / Ephraim III rates, once-per-round, and that a trade never eats the turn |
| `goodsDoubler.test.ts` | Asher III / Zebulun III, per source, and that the two cards' different scopes are honoured |
| `issachar.test.ts` | Understanding of Times reads face-down Influence; Wise Counsel's fences |
| `newLeaderPowers.test.ts` | Claim the Field, Spend Your Resilience, and the Tithe |
| `../ai/bots.test.ts` | bot placement, Banner *and* Supply both played, and that a free action never costs the turn |
| `resolve.test.ts` | Champions and tie-breaks, failures, Covenant zone effects, Crisis 13/14, deferred uniques, Broken clock, `endGame` |
| `game.test.ts` | full bot-vs-bot games across seeds and player counts, asserting invariants |
| `../data/gameData.test.ts` | shipped data still matches the CSV design package |
