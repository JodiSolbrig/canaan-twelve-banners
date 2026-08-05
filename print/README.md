# Print files

Everything needed to build the physical game in [Component Studio](https://www.thegamecrafter.com/publish/component-studio).

**These files are generated. Do not edit them by hand** — run `npm run export:print`
and they are rebuilt from the same data the app plays from. If a number is wrong
here it is wrong in the game, and `src/config/tuning.ts` or `csv/` is the place
to fix it.

```
npm run export:print
```

## Where each column comes from

Prose comes from `csv/`, which carries the full-length rule as it should read on
a printed card. Numbers, colours and track affinities come from
`src/config/tuning.ts` and `src/data/`, so the cards can never disagree with the
tuned game about what something costs. The two sources say the same things at
different lengths — the engine's strings are abbreviated to fit a UI panel.

## How Component Studio reads these

Component Studio builds a deck from **one CSV whose column headers match the
layer names in your design template**, one row per card. Two columns are special:

| Column | Meaning |
|--------|---------|
| `name` | What the card is called in your library. Not printed unless you map it to a layer. |
| `quantity` | How many copies get printed. |

Every other column is yours to name. If you call a text layer `effect` in the
template, the `effect` column fills it. An image layer called `art` takes the
**filename** of an image already uploaded to the same folder — so upload the art
first, then import the CSV.

**The column names here are a proposal.** Rename them to match your layers, or
rename your layers to match these. Either works; they just have to agree.

Files are UTF-8 with no BOM and LF line endings. Text that should wrap across
several lines in a layer contains real newlines inside a quoted field — set those
layers to multi-line.

## What's in the box

| File | Rows | Component | Suggested stock |
|------|------|-----------|-----------------|
| `crisis-cards.csv` | 14 | Crisis deck | Poker 2.5×3.5 |
| `oppressor-cards.csv` | 6 | Oppressor deck | Tarot 2.75×4.75 |
| `judge-cards.csv` | 6 | Judge one-shots | Poker 2.5×3.5 |
| `tribe-boards.csv` | 13 | Tribe boards | Mat 6×9, or Jumbo card |
| `leader-cards.csv` | 39 | Leader upgrades | Mini 1.75×2.5 |
| `player-aid.csv` | 2 | Player aid, double sided | Tarot 2.75×4.75 |
| `reference-cards.csv` | 3 | Shared reference | Poker 2.5×3.5 |
| `bill-of-materials.csv` | 17 | Everything in the box, including punchouts and cubes | — |
| `art-manifest.csv` | 42 | One row per art asset, with a prompt | — |

`leader-cards.csv` is optional — the same three upgrades are already printed on
the tribe board. Cards are nicer if you want players to physically take an
upgrade when they unlock it; the board alone keeps the table smaller. Both are
generated so you can try both.

## Two things the digital version gets for free

**Banner and Supply have to be visible on the table.** In the app a token
remembers what paid for it. Cardboard does not, so Influence tokens are
**double-sided discs in the tribe colour — BANNER on one face, SUPPLY on the
other**. You pay the resource to the bank and place the disc showing what it
counts for. No declaring, no remembering, and an opponent can read the board at a
glance the way they can read the screen.

**Placement is simultaneous and secret**, which is why the BOM includes player
screens. Build your placement behind the screen, then everyone reveals at once.
Face-down tokens on the board would work too, but they hide the Banner/Supply
face — which is exactly the information the reveal is supposed to deliver.

## Board

The main board is not generated (it is layout, not data). It needs:

- Three track rows — Military, Moral, Provision — with the success threshold
  marked per player count, and the Low/High zone bands either side.
- The **Covenant meter, 0–10**, with the four zones banded and the Oppressor
  trigger marked at 5.
- A **generation track, 1–10**.
- A slot for the Crisis card, and a larger slot for an Oppressor with room for
  its severity marker.
- A space for the Cry pool.
