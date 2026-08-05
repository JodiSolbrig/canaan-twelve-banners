# Canaan: Tribes of the Covenant — Twelve Banners
## Full Rules Reference (Prototype)

**Version:** July 2026  
**Source Authority:** Book of Judges

---

### Core Concept
Players represent the tribes of Israel during the period of the Judges. Each tribe competes to become Champion of the Military, Moral, and Provision tracks while managing a shared Covenant Meter that reflects the people’s fidelity to the Lord. Crisis cards introduce narrative pressure drawn from the biblical text. Highest Glory at the end of the game wins.

Thirteen boards are provided for twelve banners — Joseph is played as Ephraim and
Manasseh, and landless Levi is included as the Covenant guardian. See
`00-README.md`.

### Components (Prototype)
- 13 Tribe Boards (one per tribe)
- Influence tokens (8–10 per player, distinct colors)
- Resource tokens: Faith, Warriors, Goods, Loyalty, Glory
- 3 Track boards: Military, Moral, Provision
- Covenant Meter track (0–10) + marker
- 14 Crisis Modifier cards
- This rules reference / player aid

### Resources
- **Faith** — spiritual power, special abilities, Moral Track, Covenant interaction
- **Warriors** — military strength, defense, Military Track
- **Goods** — economic power, growth, Provision Track
- **Loyalty** — resilience; primary tie-breaker; can be lost to Crises and failures
- **Glory** — victory points
- **Influence Tokens** — placed on tracks to compete for Champion status

### Round Sequence
1. Draw & reveal 1 Crisis card (active for the entire round)
2. Players simultaneously or in turn order: Place Influence tokens (face-down) **and** take one Standard Action **or** Unique Action
3. Reveal all Influence → determine Champions of each track
4. Resolve tracks (success or failure) → apply Covenant Meter changes and any Crisis effects
5. Award Champion rewards + resolve end-of-round effects
6. Discard the Crisis card, clean up tokens, proceed to next round

### Round Income
From round 2 onward each tribe collects a small per-round income before the
Crisis is drawn. Round 1 uses printed starting resources only.  
Full table in `04-setup-scoring-and-scaling.md`.

### Tracks
Three tracks exist: **Military** (Warriors), **Moral** (Faith), **Provision** (Goods).  
A track succeeds when total Influence on it reaches the threshold: the **number of players**, **+1** at 2–3 players.

**Banners & Supply.** Any resource places a token on any track, but the resource
you pay with decides what it is. Paying with the track's **affinity** resource
plants a **Banner** — it counts toward the threshold *and* toward Champion, and
it costs you Loyalty if the track fails. Paying with anything else sends
**Supply** — it counts toward the threshold only, claims nothing, and risks
nothing. A track carried entirely by Supply succeeds with **no Champion**.

Champion (most Banner Influence, ties by Loyalty then turn order) takes **+1 Glory**
plus **+1** of the matching resource. Every other contributor takes **+1** of the
matching resource as spoil.  
Failure: Covenant **−1** (−2 in Judgment) and **−1 Loyalty** to every Banner.  
Full details in `03-standard-actions-and-player-aid.md`.

### Standard Actions
(See detailed list in `03-standard-actions-and-player-aid.md`)

Players choose **one** of the following (or their Unique Action):
- Place Influence
- Recruit
- Gather / Harvest
- Pray / Seek the Lord
- Convert / Bargain
- Rest & Recover

### Unique Actions & Leader Upgrades
Each tribe has one Unique Action printed on its board and a three-step Leader Progression.  
Upgrades unlock at **3 / 6 / 9 Glory** and stay active once earned.  
No Leader upgrade or once-per-game ability may be used on Round 1.  
Full details in `01-tribes-and-leaders.md`.

### Covenant Meter
Starts at 8.  
Drops on track failures (and some Crisis effects).  
Thresholds create escalating pressure (Warning → Judgment → Broken Covenant).  
Full details in `02-crisis-cards-and-covenant.md`.

### The Cycle of the Judges
The Covenant does not only fall. Reaching **Judgment (2–4)** sells Israel into the
hand of an **Oppressor**, which replaces the Crisis card and worsens every round
it is endured. Players may spend an action to **Cry Out**, paying Faith into a
shared pool; when the Cry is met the oppression breaks, the Covenant is restored
to 8, and a **Judge is raised from the least among the tribes** — the player with
the lowest Glory. The following round is one of **rest**, with no Crisis.  
Full details in `02-crisis-cards-and-covenant.md`.

### Crisis Modifier Deck
14 narrative cards. One is revealed each round and modifies the round’s conditions.  
Full card list and effects in `02-crisis-cards-and-covenant.md` and `csv/crisis_cards.csv`.

### Setup
See `04-setup-scoring-and-scaling.md` for complete first-round setup, starting resources table, and first-round restrictions.

### End Game & Scoring
Standard length: **10 generations** — a round is a generation, not a season.  
Primary score = Glory.  
Tie-breakers: Loyalty → total remaining resources → most Championships.  
Optional end-of-game Covenant bonus/penalty applies.  
Full details in `04-setup-scoring-and-scaling.md`.

### Scaling
Designed for 2–11 players + Epic 12 Mode.  
Core experience is strongest at 4–7 players.  
Adjust track thresholds upward for very small groups.

---

**Design Notes**  
- All named leaders are biblically attested in the Book of Judges.  
- Resources and Loyalty values reflect tribal themes (e.g., Levi high Faith, Asher high Goods, Manasseh high Loyalty).  
- The design prioritizes narrative flavor while remaining mechanically clean for a first prototype.

This document, together with the CSV files and the other Markdown files in this package, constitutes a complete foundation for building a playable prototype in Grok Build, Tabletop Simulator, or physical paper.
