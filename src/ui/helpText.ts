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
    'Collected automatically at the start of rounds 2+. Round 1 uses your printed starting resources only. Amounts differ by tribe. Loyalty income only applies when you are below your starting Loyalty.',

  military:
    'Military track — combat and defense. Affinity: Warriors. Warriors placed here are Banners: they can win Champion (+1 Glory, +1 Warrior) but cost 1 Loyalty if the track fails. Faith or Goods placed here are Supply: they help it succeed and share the spoil, but never claim it and never risk anything.',
  moral:
    'Moral track — faithfulness and spiritual standing. Affinity: Faith. Faith placed here are Banners: they can win Champion (+1 Glory, +1 Faith) but cost 1 Loyalty if the track fails. Warriors or Goods placed here are Supply: they help it succeed and share the spoil, but never claim it and never risk anything.',
  provision:
    'Provision track — food, trade, and abundance. Affinity: Goods. Goods placed here are Banners: they can win Champion (+1 Glory, +1 Goods) but cost 1 Loyalty if the track fails. Faith or Warriors placed here are Supply: they help it succeed and share the spoil, but never claim it and never risk anything.',

  covenant:
    'Shared Covenant Meter (starts at 8). Drops when tracks fail. Zones: Strength 8–10, Warning 5–7, Judgment 2–4, Broken 0–1. Broken Covenant triggers a final-round clock and Loyalty losses.',
  crisis:
    'One Crisis card is revealed each round and modifies that round only. Peek/reorder abilities (Rest & Recover, Reuben, Issachar, Dan) help you prepare.',
  threshold:
    'Total Influence on the track — Banners and Supply together — must meet or exceed this number for the track to succeed. Failures drop the Covenant Meter and cost 1 Loyalty to everyone who planted a Banner there.',

  placeInfluence:
    'Spend 1 Faith, 1 Warrior, or 1 Goods per Influence token, on any track(s). Tokens stay face-down until Reveal. Paying with the track’s own resource plants a Banner (can win Champion, risks Loyalty); anything else is Supply (helps it succeed, shares the spoil, claims nothing).',
  placeMore:
    'Use your action to place more face-down Influence. Choose which resources go on which track — the affinity resource plants Banners, anything else sends Supply.',
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
  cryOut:
    'Spend your action to pay Faith into the shared Cry. When the Cry is met, the oppression breaks, the Covenant is restored, and the Lord raises up a Judge — from the *least* among the tribes, not from whoever paid. Every round you endure instead, the oppression tightens and the Cry gets dearer.',
  pass: 'Take no action this round. Influence already placed still counts at Reveal.',
  confirmPlacement:
    'Locks in your face-down Influence for this round. You will still choose one Standard or Unique Action afterward.',

  placementHint:
    'Any resource can place on any track — 1 spent = 1 token — but what you pay with decides what the token does. Paying with the track’s own resource (Warriors → Military, Faith → Moral, Goods → Provision) plants a Banner: it counts for Champion, and costs you 1 Loyalty if the track fails. Anything else is Supply: it helps the track succeed and shares the spoil, but never claims it and never risks anything.',
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
