# Canaan: Tribes of the Covenant — Twelve Banners
## Playable Prototype Package (July 2026)

This folder contains everything needed to build and playtest the **Twelve Banners** redesign of *Canaan: Tribes of the Covenant*.

### Design Goals
- 13 asymmetric tribe boards grounded in the Book of Judges (see note below)
- Shared Crisis + Covenant Meter pressure
- Clear Champion competition on three tracks (Military, Moral, Provision)
- Scalable from 2–11 players + Epic 12 Mode
- Ready for paper prototype or Tabletop Simulator / Grok Build

### Note on "Twelve Banners" and thirteen boards
The tribe list counts **thirteen** boards, not twelve. This follows the biblical
pattern rather than contradicting it: Joseph is represented by his two sons,
**Ephraim** and **Manasseh**, each receiving a territorial inheritance, while
**Levi** receives no land but is retained here as a playable board because the
Covenant Meter is the heart of the game and Levi is its guardian.

"Twelve Banners" therefore names the **twelve encamped standards** of Israel;
Levi camps around the tabernacle rather than under a banner of its own. In a full
12-player Epic game, leave Levi out to match the encampment exactly, or leave one
of Ephraim/Manasseh out and play Levi. All thirteen boards are balanced to be
interchangeable.

### File Index

#### CSV (for Card Designer / data import)
- `csv/tribes_overview.csv` — Full tribe stats, playstyle, unique action
- `csv/leader_progressions.csv` — Three upgrades per tribe
- `csv/crisis_cards.csv` — 14 narrative Crisis Modifier cards
- `csv/unique_actions.csv` — Clean unique action list for card generation
- `csv/starting_resources.csv` — Quick reference starting values
- `csv/tribe_income.csv` — Per-round income per tribe (rounds 2+)

#### Markdown Rules
- `markdown/01-tribes-and-leaders.md` — All 13 tribes + leader progressions
- `markdown/02-crisis-cards-and-covenant.md` — Crisis deck + Covenant Meter thresholds
- `markdown/03-standard-actions-and-player-aid.md` — Core actions + printable aid
- `markdown/04-setup-scoring-and-scaling.md` — First-round setup, end-game scoring, player count notes
- `markdown/05-full-rules-reference.md` — Compiled single-document rules reference

### Current Prototype Status
**Ready**
- Complete core loop
- Crisis Track structure + measurement
- Champion reward table (see `03-standard-actions-and-player-aid.md`)
- Resource definitions
- All 13 asymmetric Tribe Boards with biblical grounding
- Per-round tribe income (see `04-setup-scoring-and-scaling.md`)
- Scaling rules for 2–11 + Epic 12 Mode
- Full Crisis Modifier deck (14 cards)
- Exact Covenant Meter thresholds and effects
- Standard Tribe Actions + Player Aid
- First-round setup + end-game scoring

**Still useful for later**
- Physical component list & layout recommendations
- Printable Tribe Board layouts
- Teaching script / first playtest order

### How to use with Grok Build
1. Import the CSVs into your card designer for Crisis cards, Unique Action cards, and Tribe boards.
2. Use the Markdown files as the rules source of truth.
3. Start with a 4–6 player paper prototype using the player aid and Crisis cards.

Source: Book of Judges as primary authority. All named leaders are biblically attested.  
Created for Canaan: Tribes of the Covenant – Twelve Banners redesign.  
Date: July 2026
