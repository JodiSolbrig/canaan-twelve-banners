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
```

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
| **Banners & Supply** | `03` §Banners & Supply — new rule, added after playtest review | The resource you pay with decides whether a token can claim Champion. Affinity = Banner (counts for Champion, exposed to the failure penalty); anything else = Supply (threshold only, no risk, shares the spoil). | The original rule made 1 Faith = 1 Warrior = 1 Goods, collapsing thirteen asymmetric tribes into "how many tokens can I afford". Now starting spreads and income define what each tribe can actually win. |
| Gifted Influence | `01` — Judah's Rally, Naphtali's Swift Response | Gifted tokens are always **Supply** | Otherwise Rally hands out Championships. |
| Simeon's free Military token | `01` — Furious Assault | **Banner**, placed automatically on top of the plan | It musters real warriors, and it is the payoff for having been beaten. |
| Leader flat Influence bonuses | `01` — Othniel II, Ehud II, Samson I, Enduring Defense | Add **Banner** strength | All four are Military bonuses belonging to Military tribes; the bonus inherits the nature of the tokens it modifies. |
| Round structure | `03` §Standard Actions — Place Influence is one of six actions, one action per round | Free placement phase **and** a full action each round (`tuning.freePlacementPhase`) | Keeps tracks contested at low player counts. Set the tuning flag to **No** to play the printed one-action round. |
| Raid / Skirmish "Low zone" | `01` — Benjamin, Simeon | The Warrior is spent on your turn; the Low-zone outcome settles after Reveal | Checking the zone mid-round would read opponents' face-down tokens and make the result depend on seat order. |
| Iron Chariots unpaid token | `02` card 3 — "count as –1 Influence" | The token contributes **0** | Read as "reduce this token's Influence by 1". A true −1 would make an unpaid token worse than not placing at all. |
| Ephraim, Abdon I | `01` — "+1 Goods permanently to your starting total" | +1 Goods to **per-round income**, permanently | The only reading of "permanently" that does anything, given round income exists. |
| Benjamin, Ehud III | `01` — "a free Recruit action" | The *action* is free; its cost is still paid (1 Goods → 2 Warriors, else the Faith mode) | Granting 2 Warriors outright was strictly better than the action it names. |
| Judah, Rally the Tribes | `01` — no track named | The giver picks the track; defaults to the recipient's affinity | The rules leave the track unspecified. |
| Levi, Intercede (protect) | `01` — "protect it from the next drop" | Cancels the drop entirely, including a Judgment drop of 2 | "Protect from" reads as prevention, not reduction. |
| Judgment discard | `02` — "the player with the lowest Loyalty" | **Every** player tied for lowest discards | Otherwise who pays depends on internal player order. |
| Day of Midian zones | `02` card 13 | Doubles the Military **success** threshold only; Low/High zones still measure against the base | Stops a one-round success modifier from silently retuning Raid, Skirmish, Gad's Enduring Defense, Jair, and Asher. |
| Cry of the Oppressed | `02` card 4 — "the first player to become Champion" | Tracks resolve Military → Moral → Provision, so this is the Military Champion | Simultaneous resolution has no natural "first". |
| Angel of the Lord | `02` card 12 | The human player chooses for the table | Single-seat prototype. |

## Prototype notes

- Some leader upgrades are **Planned** (shown in UI, not fully wired). Active ones
  are labeled in the Leader panel — see `src/data/leaderImpl.ts`.
- Defaults for Champion rewards, track thresholds, and Low/High zones live in
  `src/config/tuning.ts`; the design package documents the same numbers in
  `markdown/03-standard-actions-and-player-aid.md`.
- `src/data/gameData.test.ts` asserts the shipped tribe stats, income, unique
  actions, and Crisis deck still match the CSVs — the CSVs stay authoritative.
