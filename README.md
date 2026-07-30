# Canaan: Tribes of the Covenant — Twelve Banners

Local playable browser prototype for beta-testing core mechanics.

## Launch

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## What you can do

- Solo play vs **1–5 bots** (2–6 total players)
- Pick any of the **13 tribes** from the design package
- Full round loop: Crisis → Place Influence → Action → Reveal → Champions → Covenant
- **Tuning** drawer to adjust thresholds, rewards, rounds, bot aggression, and more
- **Player Aid** modal with the core sequence

## Design docs

Original rules and CSVs remain in `markdown/` and `csv/`.

## Prototype defaults

See `src/config/tuning.ts` for Champion rewards, track thresholds, Low/High zones, and other provisional rules called out in the design package.
