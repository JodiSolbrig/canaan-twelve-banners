# Canaan: Tribes of the Covenant — Twelve Banners

Local playable browser prototype for beta-testing core mechanics.

## Launch

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Checks

```bash
npm test        # rules-engine + design-data test suite
npm run lint    # oxlint
npm run build   # tsc -b && vite build
npm run balance # 300 all-bot games; prints how the rules are behaving
```

`npm run balance` is the tuning instrument, and it is only as good as the bot:
anything the bot never plays, it cannot measure. Read `scripts/balance.test.ts`
for the `BALANCE_*` environment overrides that sweep a dial without editing the
shipped defaults.

## What you can do

- Solo play vs **1–5 bots** (2–6 total players)
- Pick any of the **13 tribes** from the design package
- Full round loop: Crisis → Place Influence → Action → Reveal → Champions → Covenant
- **The Cycle of the Judges** — Judgment on the Covenant summons an Oppressor that
  worsens each round; players Cry Out with Faith to break it, which restores the
  Covenant and raises a Judge from the *least* among the tribes, followed by a
  round of rest
- Per-tribe **round income** from round 2 onward
- **Leader upgrades** at Glory thresholds (default 3 / 6 / 9), with UI feedback
- **Tuning** drawer for thresholds, rewards, rounds, bot aggression, and more
- **Player Aid** modal with the core sequence

## Architecture

| Path | Role |
|------|------|
| `src/engine/` | Pure rules engine (`dispatch`, create/resolve/round). See [`src/engine/README.md`](src/engine/README.md). |
| `src/data/` | Tribe/Crisis definitions + leader implementation matrix |
| `src/ui/` | React presentation; holds no rules authority |
| `src/ai/` | Simple bot action chooser |
| `src/config/tuning.ts` | Tunable provisional rules |
| `markdown/`, `csv/` | Design package (source of truth for intended rules) |

## Prototype scope

The design package targets **2–11 players plus Epic 12 Mode**. This prototype
covers **2–6 players** and does not implement Epic 12 (12 boards, special seating).

A game is **10 generations** at every player count. A round is a generation, not
a season — see *Game Length* in `markdown/04-setup-scoring-and-scaling.md`.

There is one seat at the table, so table-wide choices fall to you: **The Angel of
the Lord** (Crisis 12) is resolved by the human player on everyone's behalf.
Seven of the 39 leader upgrades have no engine effect yet and are labelled
*Planned* in the Leader panel — `src/engine/README.md` groups what they need.

## Rules deviations

**There are none.** `markdown/` and `csv/` describe the game this engine plays.

That is a deliberate policy, not a happy accident. The engine is the authority on
what the game *is*: when the two disagree, the design package gets corrected and
the reasoning goes with it, rather than a deviation being logged and the docs
left wrong. Everything that was once listed here — gifted Influence counting as
Supply, Iron Chariots contributing 0, Levi's Intercede cancelling a drop outright,
the reading of Abdon's "permanently", and a dozen more — now lives in the design
files as the rule, with the argument attached.

The one thing that could put a row back is a *new* rule invented at the keyboard
and not yet written down. Two of the biggest already went the other way: **The
Cycle of the Judges** (`02`) and **Banners & Supply** (`03`) were both born in the
prototype and folded into the design package as full sections.

Where to look for the reasoning behind a rule that reads oddly:

| Question | Answer lives in |
|---|---|
| Why is the threshold player count +1? | `03` §Success threshold |
| What counts as a Banner when nobody paid a resource? | `03` §Tokens nobody paid a resource for |
| Why do Raid and Skirmish wait for the Reveal? | `01`, after the tribe table |
| What applies itself, and what must I spend? | `01`, after the leader progressions |
| Why do the leader trades cost no action? | `01` §Leader trades |
| Why is the Cry priced where it is? | `02` §Crying Out, and `src/config/tuning.ts` |

## Prototype notes

- All six **Judge one-shots** are wired. Powers that read the revealed board
  (Othniel, Gideon, Samson) are spent in the `preResolve` window; the rest on
  your turn. See *The six Judge powers* in `markdown/02-crisis-cards-and-covenant.md`.
- **Discretionary abilities are player-chosen**, not auto-fired: Samson's shift,
  the Level III covenant rescue, and every Judge power. Only genuinely passive
  bonuses with no decision attached still apply themselves — Othniel II, Ehud II,
  Nazirite Strength, and Gad's Enduring Defense.
- **32 of the 39 leader upgrades** are wired. The rest are shown in the UI as
  *Planned* for teaching and planning; active ones are labeled in the Leader
  panel. `src/data/leaderImpl.ts` is the authority, and
  `src/engine/README.md` groups what the remaining seven still need.
- **Leader trades** (Zebulun's Sea Trader, Simeon's Raid Leader, Ephraim's
  Landed Authority) cost no action — take the trade *and* your turn.
- Defaults for Champion rewards, track thresholds, and Low/High zones live in
  `src/config/tuning.ts`; the design package documents the same numbers in
  `markdown/03-standard-actions-and-player-aid.md`.
- `src/data/gameData.test.ts` asserts the shipped tribe stats, income, unique
  actions, and Crisis deck still match the CSVs — the CSVs stay authoritative.
