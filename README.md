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

## Prototype notes

- Some leader upgrades are **Planned** (shown in UI, not fully wired). Active ones are labeled in the Leader panel — see `src/data/leaderImpl.ts`.
- No automated test suite yet; highest-value coverage targets are listed in `src/engine/README.md`.
- Defaults for Champion rewards, track thresholds, and Low/High zones live in `src/config/tuning.ts`.
