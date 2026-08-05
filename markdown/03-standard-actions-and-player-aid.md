# Standard Tribe Actions & Player Aid

## Standard Tribe Actions

Each generation you get a **free Influence placement** and then **one** standard
action **or** your Unique Action, unless a card or upgrade says otherwise. Place
Influence also appears in the list below, so a tribe that wants to commit twice
can spend its action on a second placement.

> **The printed one-action round.** The alternative is to drop the free placement
> and make Place Influence purely one of the six choices. It is a tighter, more
> agonising game, and at 2–4 players it leaves the tracks badly under-contested —
> which is why the free placement is the default here. `tuning.freePlacementPhase`
> switches between them.

1. **Place Influence**  
   Spend any combination of resources to place Influence tokens on the tracks.  
   - 1 Faith **or** 1 Warrior **or** 1 Goods → 1 Influence token  
   - You may place multiple tokens in one action (pay the full cost).  
   - Tokens are placed face-down until the Reveal step.  
   - **What you pay with matters** — see *Banners & Supply* below.

2. **Recruit**  
   Spend 1 Goods → Gain 2 Warriors  
   *or* Commit 1 Faith → Gain 1 Warrior (the Faith is returned; net +1 Warrior,
   but you must hold at least 1 Faith to take this option)

3. **Gather / Harvest**  
   Spend 1 Warrior **or** 1 Faith → Gain 2 Goods

4. **Pray / Seek the Lord**  
   Rest (take no other resource action this turn) → Gain 2 Faith  
   *or* Spend 1 Goods → Gain 1 Faith + 1 Loyalty (up to your starting Loyalty maximum)

5. **Convert / Bargain**  
   Convert resources at these rates (once per action):  
   - 2 Goods → 1 Faith **or** 1 Warrior  
   - 2 Warriors → 1 Goods  
   - 2 Faith → 1 Goods **or** 1 Warrior  

6. **Rest & Recover**  
   Do nothing else this round → Gain 1 Loyalty (cannot exceed starting Loyalty) **and** look at the top card of the Crisis deck (put it back on top or bottom).

7. **Cry Out** *(only while Israel is under an Oppressor)*  
   Pay any amount of **Faith** into the shared Cry. When the Cry is met the
   oppression breaks and a Judge is raised from the least among the tribes.  
   See *The Cycle of the Judges* in `02-crisis-cards-and-covenant.md`.

**Notes**
- Unique Actions (printed on your Tribe Board) replace the standard action for that round unless the card specifically says otherwise.
- Some Leader upgrades and Crisis cards modify these actions.
- Two things are **free of your action**: a Judge one-shot whose window is *on
  your turn*, and a leader trade (Sea Trader, Raid Leader, Landed Authority).
  Take either and you still have your full action.
- You may always pass (do nothing).

---

## Banners & Supply

Each track has an **affinity resource** — the thing that track is actually made of:

| Track | Affinity |
|-------|----------|
| Military  | **Warriors** |
| Moral     | **Faith** |
| Provision | **Goods** |

Any resource can place a token on any track, but **what paid for it decides what
the token is**:

### Banner — paid with the track's affinity resource
Your name is on this field.
- Counts toward the **success threshold**
- Counts toward **Champion**
- Takes the **Loyalty penalty** if the track fails

### Supply — paid with anything else
You sent help without marching.
- Counts toward the **success threshold**
- Does **not** count toward Champion
- Takes **no penalty** if the track fails

### Spoil
When a track succeeds, every player who sent **Supply** to it takes **1 of that
track's affinity resource**. Banner contributors take nothing extra — they are
already playing for the Champion reward.

This is what makes Supply worth sending: it turns a resource you have into one
you need at a better rate than the Convert action, in exchange for the risk that
the track fails and pays nothing.

> **A track carried entirely by Supply succeeds with no Champion at all.** The
> land was provisioned and no one's name is on it. This is a legal and often
> sensible outcome.

**The tension this creates.** Bannering is the only way to earn Glory, and Glory
wins the game — but Banners are exposed. Supply is safe, profitable, and helps
Israel, and it will never win you anything. Every placement is a choice between
the good of the tribes and the glory of your own house.

### Tokens nobody paid a resource for

A few abilities put a token on a track without a resource being spent on it, so
there is no affinity to read. What such a token counts as follows from **what it
is**, not from whose board it came off:

| Token | Counts as | Why |
|-------|-----------|-----|
| **Gifted** — Judah's Rally, Barak's Swift Response | **Supply** | You are sending help to another tribe, not planting their banner for them. Were it otherwise, Rally would hand out Championships. |
| **Summoned** — Deborah & Barak's judge power | **Supply** | She rallies the tribes; she does not plant their banners. |
| **Found** — Reuben's Pathfinder | **Supply** | A path opened is not a muster. |
| **Mustered** — Simeon's Furious Assault | **Banner** | It turns out actual warriors, and it is the payoff for having been beaten on that very track. It is placed for you, on top of whatever you planned. |

**Flat Influence bonuses from a leader upgrade add Banner strength** — Othniel II
(Wholehearted Charge), Ehud II (Hidden Dagger), Samson I (Nazirite Strength) and
Gad's Enduring Defense. All four are Military bonuses belonging to Military
tribes: a bonus inherits the nature of the tokens it modifies.

---

## Track Thresholds & Champion Rewards

### Success threshold
A track **succeeds** when the total Influence on it is at least the threshold:

| Players | Threshold |
|---------|-----------|
| 2–3     | player count **+2** |
| 4–11    | player count **+1** |

The **+1 at every table size** is what keeps the Covenant falling. Set against a
table that turns out its full strength — Banners on the tracks it wants and
Supply on the ones it cannot lose — a bare player-count threshold is held about
nine times in ten, the meter drifts to the ceiling, and the Cycle of the Judges
never fires. Measured over 300 games, +0 gave 90/82/81 track success and 0.48
oppressions a game; +1 gives 79/67/64 and 0.93. The dial is
`tuning.thresholdBonus` if you want to feel the difference.

Crisis cards may raise it further for a single round (Midianite Swarms, The
Ammonite Claim, The Day of Midian), and an Oppressor raises it on the track it
presses by its current severity.

### Zones

| Total Influence | Zone |
|-----------------|------|
| below threshold | **Low** |
| threshold to threshold+1 | **Normal** |
| threshold+2 or more | **High** |

Zones are measured against **the threshold the track actually faced this round**,
including any Crisis or Oppressor increase — a track that came up short against a
harder bar was genuinely Low.

The one exception is **The Day of Midian**, which doubles what Military must beat.
Doubling is a different order of change from +1, and letting it move the bands as
well would silently retune every ability that reads a zone — Raid, Skirmish,
Enduring Defense, Jair, Blessed Abundance — for that round. It raises the bar
without moving the bands.

### Champion rewards
The player with the most **Banner** Influence on a track is its Champion (ties
broken by current Loyalty, then turn order). Supply never claims a track. Each
Champion gains:

| Track | Reward |
|-------|--------|
| Military  | +1 Glory, +1 Warrior |
| Moral     | +1 Glory, +1 Faith |
| Provision | +1 Glory, +1 Goods |

A track with no Influence on it has no Champion. Leader upgrades and Crisis cards
add to these rewards; "In Those Days There Was No King" caps the total Glory any
one player takes from Champion rewards at 1 for that round.

### Failure penalties
When a track fails, every player who placed a **Banner** on it loses **1 Loyalty**.
Supply contributors lose nothing — they never staked their name on it.

The Covenant Meter itself moves **once for the generation**, not once per track —
see *How it moves* in `02-crisis-cards-and-covenant.md`.

---

## One-Page Player Aid  
*(Copy-paste friendly / print-ready summary)*

**CANAAN: TRIBES OF THE COVENANT — Player Aid**

**Resources**  
Faith • Warriors • Goods • Loyalty • Glory • Influence Tokens

**Generation Sequence**
1. Collect income (generations 2+), then draw & reveal 1 Crisis — or face the standing Oppressor  
2. Place Influence (face-down) + take 1 Standard, Unique or Judge Action  
3. **Reveal all Influence** — then, before anything is scored, spend any
   after-the-reveal abilities (Samson's shift, a covenant rescue, the Judge
   powers that read the board)  
4. Determine Champions and resolve each track  
5. Move the Covenant, settle the cycle, score Champion rewards and spoil  
6. Clean up → next generation

**Standard Actions (place Influence free, then choose one)**  
• **Place Influence** — 1 Faith/Warrior/Goods = 1 token  
• **Recruit** — 1 Goods → 2 Warriors  *or*  commit 1 Faith → +1 Warrior  
• **Gather** — 1 Warrior or 1 Faith → 2 Goods  
• **Pray** — Rest → 2 Faith  *or*  1 Goods → 1 Faith + 1 Loyalty  
• **Convert** — 2 of one resource → 1 of another (see rates above)  
• **Rest & Recover** — Gain 1 Loyalty + peek at top Crisis card  
• **Cry Out** *(under oppression only)* — pay Faith into the shared Cry

**Tracks & affinity**  
Military ← **Warriors** • Moral ← **Faith** • Provision ← **Goods**  
Threshold = player count **+1** (**+2** at 2–3 players)

**Banner** (affinity resource) — counts for threshold **and** Champion; loses 1 Loyalty on failure  
**Supply** (any other resource) — counts for threshold only; risks nothing  
Highest **Banner** total = Champion (ties broken by Loyalty, then turn order)  
No Banners on a successful track = **no Champion**

**On success** — Champion: +1 Glory and +1 matching resource.  
Every **Supply** contributor: +1 matching resource (spoil).  
**On failure** — −1 Loyalty to each Banner on that track

**Covenant, once per generation**  
**−1 for every track that gave way; +1 only if all three held**  
(1 deeper per failure while in Judgment)

**Covenant Meter** (starts at 8)  
8–10: Covenant Strength  
4–7: Warning (lose 1 Loyalty unless ≥1 track held)  
1–3: Judgment (failures drop meter by 2; everyone tied for lowest Loyalty discards 1 resource)  
0: Broken (lose 2 Loyalty each + final-generation clock)  
**At 5 or below**, Israel is sold into the hand of an Oppressor.

**Winning**  
Highest Glory at game end. Loyalty is the primary tie-breaker.
