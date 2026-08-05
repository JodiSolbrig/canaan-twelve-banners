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

## Rules deviations

Where the prototype knowingly differs from the design package. Everything not
listed here is implemented as written.

| Rule | Design source | Prototype behaviour | Why |
|------|---------------|---------------------|-----|
| **The Cycle of the Judges** | `02` §The Cycle of the Judges — new rule | Judgment summons an escalating Oppressor that replaces the Crisis; Crying Out with Faith breaks it, restores the Covenant to 8, and raises a Judge from the lowest-Glory player; a round of rest follows. | The Covenant only ever fell, making it a doom clock with no decision attached. Judges is a *cycle* — sin, oppression, crying out, deliverance, rest — and only the downswing was modelled. Off via `tuning.oppressionEnabled`. |
| **Track threshold** | `03` §Success threshold — player count, +1 at 2–3 players | Player count **+1 at every table size** (`tuning.thresholdBonus`), so +2 at 2–3 players | The printed threshold was set against a table that under-committed. Once the bot played Supply as well as Banners, tracks held 90/82/81 and the Cycle of the Judges fired 0.48 times a game — the Covenant never fell far enough to sell Israel into a hand. +1 restores 79/67/64 and 0.93. Set `thresholdBonus` to 0 for the printed number. |
| Low/High zones under Crisis 2 and 6 | `03` §Zones — "measured against the **unmodified** threshold" | Midianite Swarms and The Ammonite Claim shift the zone bands with the threshold they raise | Their +1 is folded into `baseThreshold`, which is also what the zones measure against. Day of Midian is handled as written (it doubles the bar without moving the bands). Affects Asher I, Jair, Gad's Enduring Defense, Raid and Skirmish in the rounds those two cards are out. |
| **Banners & Supply** | `03` §Banners & Supply — new rule, added after playtest review | The resource you pay with decides whether a token can claim Champion. Affinity = Banner (counts for Champion, exposed to the failure penalty); anything else = Supply (threshold only, no risk, shares the spoil). | The original rule made 1 Faith = 1 Warrior = 1 Goods, collapsing thirteen asymmetric tribes into "how many tokens can I afford". Now starting spreads and income define what each tribe can actually win. |
| Gifted Influence | `01` — Judah's Rally, Naphtali's Swift Response | Gifted tokens are always **Supply** | Otherwise Rally hands out Championships. |
| Simeon's free Military token | `01` — Furious Assault | **Banner**, placed automatically on top of the plan | It musters real warriors, and it is the payoff for having been beaten. |
| Leader flat Influence bonuses | `01` — Othniel II, Ehud II, Samson I, Enduring Defense | Add **Banner** strength | All four are Military bonuses belonging to Military tribes; the bonus inherits the nature of the tokens it modifies. |
| Round structure | `03` §Standard Actions — Place Influence is one of six actions, one action per round | Free placement phase **and** a full action each round (`tuning.freePlacementPhase`) | Keeps tracks contested at low player counts. Set the tuning flag to **No** to play the printed one-action round. |
| Raid / Skirmish "Low zone" | `01` — Benjamin, Simeon | The Warrior is spent on your turn; the Low-zone outcome settles after Reveal | Checking the zone mid-round would read opponents' face-down tokens and make the result depend on seat order. |
| Iron Chariots unpaid token | `02` card 3 — "count as –1 Influence" | The token contributes **0** | Read as "reduce this token's Influence by 1". A true −1 would make an unpaid token worse than not placing at all. |
| Ephraim, Abdon I | `01` — "+1 Goods permanently to your starting total" | +1 Goods to **per-round income**, permanently | The only reading of "permanently" that does anything, given round income exists. |
| **Leader trades** — Zebulun I, Simeon III, Ephraim III | `01` — three "once per round, convert…" upgrades | All three are **free of your action**: you trade on your turn and still take a full action | Ephraim's rate — 2 Goods for 1 Faith or Warrior — *is* the printed Convert rate, so being free of the action is the only thing that upgrade can be granting. Reading the other two the same way keeps one rule instead of three. Same reading as Benjamin's "free Recruit action". |
| Benjamin, Ehud III | `01` — "a free Recruit action" | The *action* is free; its cost is still paid (1 Goods → 2 Warriors, else the Faith mode) | Granting 2 Warriors outright was strictly better than the action it names. |
| Reuben, Firstborn Advance | `01` — "place 1 token after seeing one other player's placement" | Reuben places **last** in the placement phase | Placement is face down, so "seeing" one placement could only mean seeing the *weight* of it. Placing last delivers exactly that against the whole table, without exposing anyone's composition. |
| Naphtali, Swift Response | `01` — "give 1 temporary Influence to another player next round" | Naphtali names the recipient **and the track** at its next placement | The card leaves both unstated, and a gift that lands on a track of nobody's choosing is a gift to no one. |
| Naphtali, Northern Alliance | `01` — "two of your tokens on different tracks both count as +1" | Name two tracks after the reveal; your Influence on each counts 1 more, Banner included where you already hold one | Tokens are interchangeable, so naming tracks is the same rule stated in terms the engine can apply. It cannot conjure Influence onto a track you never turned out for. |
| Reuben, Bold Claim | `01` — "invested the second-most" | Measured in **Banner** strength, and it fires automatically the first generation it can | Championship is decided on Banners, so second place is too. The bonus is free and carries no decision, so prompting for it would be noise. |
| Judah, Rally the Tribes | `01` — no track named | The giver picks the track; defaults to the recipient's affinity | The rules leave the track unspecified. |
| Levi, Intercede (protect) | `01` — "protect it from the next drop" | Cancels the drop entirely, including a Judgment drop of 2 | "Protect from" reads as prevention, not reduction. |
| Judgment discard | `02` — "the player with the lowest Loyalty" | **Every** player tied for lowest discards | Otherwise who pays depends on internal player order. |
| Day of Midian zones | `02` card 13 | Doubles the Military **success** threshold only; Low/High zones still measure against the base | Stops a one-round success modifier from silently retuning Raid, Skirmish, Gad's Enduring Defense, Jair, and Asher. |
| Cry of the Oppressed | `02` card 4 — "the first player to become Champion" | Tracks resolve Military → Moral → Provision, so this is the Military Champion | Simultaneous resolution has no natural "first". |
| Angel of the Lord | `02` card 12 | The human player chooses for the table | Single-seat prototype. |

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
