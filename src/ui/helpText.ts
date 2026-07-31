import type { TrackId } from '../engine/types';

/** Copy for hover tooltips — keeps rules teaching in one place. */
export const HELP = {
  faith:
    'Faith is spiritual power. Thematically tied to the Moral track and Covenant abilities. Any Faith, Warrior, or Goods can place Influence on any track (1 resource = 1 token).',
  warriors:
    'Warriors are military strength. Thematically tied to the Military track. Any Faith, Warrior, or Goods can place Influence on any track (1 resource = 1 token).',
  goods:
    'Goods are economic power. Thematically tied to the Provision track. Any Faith, Warrior, or Goods can place Influence on any track (1 resource = 1 token).',
  loyalty:
    'Loyalty is resilience. Primary tie-breaker for Champions and final score. Lost to Crises and failed tracks. Cannot normally exceed your starting Loyalty.',
  glory:
    'Glory is victory points. Highest Glory at game end wins. Earned mainly from becoming track Champion and some unique actions. Reaching Glory thresholds (usually 3 / 6 / 9) unlocks Leader upgrades I–III — see your Leader panel for your tribe’s effects.',

  leader:
    'Each tribe has three Leader upgrades. Reach 3 / 6 / 9 Glory to unlock levels I / II / III. Effects are unique per tribe and stay active once unlocked.',

  income:
    'Collected automatically at the start of every round. Amounts differ by tribe. Loyalty income only applies when you are below your starting Loyalty.',

  military:
    'Military track — combat and defense. Highest Influence becomes Champion (+1 Glory, +1 Warrior by default). Prefer spending Warriors here, but Faith or Goods also work.',
  moral:
    'Moral track — faithfulness and spiritual standing. Highest Influence becomes Champion (+1 Glory, +1 Faith by default). Prefer spending Faith here, but Warriors or Goods also work.',
  provision:
    'Provision track — food, trade, and abundance. Highest Influence becomes Champion (+1 Glory, +1 Goods by default). Prefer spending Goods here, but Faith or Warriors also work.',

  covenant:
    'Shared Covenant Meter (starts at 8). Drops when tracks fail. Zones: Strength 8–10, Warning 5–7, Judgment 2–4, Broken 0–1. Broken Covenant triggers a final-round clock and Loyalty losses.',
  crisis:
    'One Crisis card is revealed each round and modifies that round only. Peek/reorder abilities (Rest & Recover, Reuben, Issachar, Dan) help you prepare.',
  threshold:
    'Total Influence on the track must meet or exceed this number for the track to succeed. Failures drop the Covenant Meter and cost Loyalty to investors.',

  placeInfluence:
    'Spend 1 Faith, 1 Warrior, or 1 Goods per Influence token. Place on any track(s). Tokens stay face-down until Reveal. Highest Influence on a track is Champion.',
  placeMore:
    'Use your action to place additional Influence. Click this, choose how many tokens on each track, then Confirm. Costs 1 Faith, Warrior, or Goods per token (preferred affinity spent first).',
  recruit:
    'Build Warriors. Option A: spend 1 Goods → gain 2 Warriors. Option B: spend 1 Faith → net +1 Warrior (Faith is spent and returned with the Warrior gain).',
  gather:
    'Economy action. Spend 1 Warrior or 1 Faith → gain 2 Goods. Good when you need Provision Influence or Recruit fuel.',
  pray:
    'Seek the Lord. Rest (no resource spend) → gain 2 Faith. Or spend 1 Goods → gain 1 Faith + 1 Loyalty (Loyalty capped at your starting value).',
  convert:
    'Trade resources once at 2:1. Allowed: 2 Goods → 1 Faith or 1 Warrior; 2 Warriors → 1 Goods; 2 Faith → 1 Goods or 1 Warrior.',
  restRecover:
    'Do nothing else this round. Gain 1 Loyalty (cannot exceed starting Loyalty) and peek at the top Crisis card of the deck. Useful before a dangerous round.',
  pass: 'Take no action this round. Influence already placed still counts at Reveal.',
  confirmPlacement:
    'Locks in your face-down Influence for this round. You will still choose one Standard or Unique Action afterward.',

  placementHint:
    'Any resource (Faith, Warriors, or Goods) can place on any track — 1 spent = 1 token. Preferred affinity: Warriors → Military, Faith → Moral, Goods → Provision. The game spends preferred resources first when auto-paying.',
} as const;

export const TRACK_AFFINITY: Record<
  TrackId,
  { preferred: string; tip: string }
> = {
  military: { preferred: 'Warriors', tip: HELP.military },
  moral: { preferred: 'Faith', tip: HELP.moral },
  provision: { preferred: 'Goods', tip: HELP.provision },
};

export const RESOURCE_HELP: Record<string, string> = {
  faith: HELP.faith,
  warriors: HELP.warriors,
  goods: HELP.goods,
  loyalty: HELP.loyalty,
  glory: HELP.glory,
};
