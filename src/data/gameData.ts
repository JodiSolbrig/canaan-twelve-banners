import type {
  CrisisCardDef,
  TribeDef,
  TribeId,
  TribeIncome,
  TrackId,
} from '../engine/types';

/** Human-readable income line, e.g. "1 Faith + 1 Warrior". */
export function formatTribeIncome(income: TribeIncome): string {
  return income.label;
}

export const TRIBE_COLORS: Record<TribeId, string> = {
  Judah: '#c9a227',
  Benjamin: '#8b2e2e',
  Levi: '#4a6fa5',
  Ephraim: '#2d6a4f',
  Manasseh: '#5c4d7a',
  Reuben: '#b5651d',
  Simeon: '#9c2f4a',
  Dan: '#1d4e6e',
  Naphtali: '#3d7c47',
  Gad: '#6b5b3a',
  Asher: '#a67c2d',
  Issachar: '#4f6f8f',
  Zebulun: '#2a6f7a',
};

export const TRACK_LABELS: Record<TrackId, string> = {
  military: 'Military',
  moral: 'Moral',
  provision: 'Provision',
};

/**
 * The track each tribe leans toward.
 *
 * This is a *lean*, not a restriction — nothing stops a player sending Benjamin
 * into Provision. It drives the bot's planning, the resource it converts toward,
 * and two defaults (the track Judah's Rally gifts to, and where a gifted
 * temporary token lands).
 *
 * Kept at 5 Military / 4 Moral / 4 Provision. It was 7/3/3, which sent most of
 * the table at Military and left Provision failing most generations — invisible
 * before Banner/Supply, when any resource served on any track, but decisive once
 * the paying resource began deciding Champions.
 */
const BIAS: Record<TribeId, TrackId> = {
  Judah: 'military',
  Benjamin: 'military',
  Levi: 'moral',
  Ephraim: 'provision',
  // Jair's Thirty Towns already rewards Manasseh for Provision reaching High,
  // and its 3/3/3 spread argues no track over another.
  Manasseh: 'provision',
  // "Among the divisions of Reuben there were great searchings of heart"
  // (Judges 5:15–16). Reuben's one memorable moment is a matter of conscience,
  // and none of its three upgrades key off a track.
  Reuben: 'moral',
  Simeon: 'military',
  Dan: 'military',
  Naphtali: 'moral',
  Gad: 'military',
  Asher: 'provision',
  Issachar: 'moral',
  Zebulun: 'provision',
};

export const TRIBES: TribeDef[] = [
  {
    id: 'Judah',
    faith: 3,
    warriors: 3,
    goods: 3,
    loyalty: 3,
    playstyle: 'Natural group leader. Excels at becoming Champion.',
    uniqueName: 'Rally the Tribes',
    uniqueCost: 'Spend 1 Faith',
    uniqueEffect: 'Give +1 temporary Influence (Supply) to one other player on a track you name.',
    color: TRIBE_COLORS.Judah,
    bias: BIAS.Judah,
    upgrades: [
      'Othniel I – Lion’s Rally: When Champion, +1 extra Glory.',
      'Othniel II – Wholehearted Charge: Military tokens +1 once/round.',
      'Othniel III – Claim the Field: Once/game your Supply on a track stands up as Banners.',
    ],
    income: {
      faith: 1,
      warriors: 1,
      label: '1 Faith + 1 Warrior',
      note: 'Leadership / lion',
    },
  },
  {
    id: 'Benjamin',
    faith: 2,
    warriors: 5,
    goods: 2,
    loyalty: 3,
    playstyle: 'Aggressive combat specialist.',
    uniqueName: 'Raid',
    uniqueCost: 'Spend 1 Warrior',
    uniqueEffect: 'Gain 1 Goods + 1 Glory. If Military is Low, lose 1 Loyalty instead of Glory — settled at Reveal.',
    color: TRIBE_COLORS.Benjamin,
    bias: BIAS.Benjamin,
    upgrades: [
      'Ehud I – Left-Handed Strike: Military Champion → +1 Warrior.',
      'Ehud II – Hidden Dagger: 1 Warrior as 2 Military Influence once/round.',
      'Ehud III – Deliverer’s Legacy: Free Recruit after Military Champion.',
    ],
    income: { warriors: 2, label: '2 Warriors', note: 'Aggressive combat' },
  },
  {
    id: 'Levi',
    faith: 5,
    warriors: 2,
    goods: 2,
    loyalty: 4,
    playstyle: 'Covenant guardian.',
    uniqueName: 'Intercede',
    uniqueCost: 'Spend 1 Faith',
    uniqueEffect: 'Raise Covenant Meter by 1, or cancel the next drop outright.',
    color: TRIBE_COLORS.Levi,
    bias: BIAS.Levi,
    upgrades: [
      'Phinehas I – Covenant Zeal: Moral Champion raises Covenant +1.',
      'Phinehas II – The Tithe: Never Provision Champion; if present there, the Champion pays you 1 Goods.',
      'Phinehas III – Turned Away Wrath: Once/game one track you held counts twice, cancelling a failure.',
    ],
    income: { faith: 2, label: '2 Faith', note: 'Priestly / Covenant' },
  },
  {
    id: 'Ephraim',
    faith: 3,
    warriors: 2,
    goods: 4,
    loyalty: 3,
    playstyle: 'Economic engine and political influencer.',
    uniqueName: 'Double Portion',
    uniqueCost: 'Spend 1 Goods',
    uniqueEffect: 'Gain 2 Goods or 1 Goods + 1 other resource.',
    color: TRIBE_COLORS.Ephraim,
    bias: BIAS.Ephraim,
    upgrades: [
      'Deborah – Prophetic Voice: Moral Champion → +1 Faith.',
      'Abdon I – Many Sons: +1 Goods permanently when unlocked.',
      'Abdon II – Landed Authority: Convert 2 Goods → 1 Faith/Warrior once/round. Costs no action.',
    ],
    income: {
      goods: 1,
      faith: 1,
      label: '1 Goods + 1 Faith',
      note: 'Economic + prophetic',
    },
  },
  {
    id: 'Manasseh',
    faith: 3,
    warriors: 3,
    goods: 3,
    loyalty: 5,
    playstyle: 'Tanky stabilizer.',
    uniqueName: 'Hold the Line',
    uniqueCost: 'Spend 1 Warrior or 1 Faith',
    uniqueEffect: 'Reduce the Covenant penalty of one failed track by 1 this round.',
    color: TRIBE_COLORS.Manasseh,
    bias: BIAS.Manasseh,
    upgrades: [
      'Gideon – Spend Your Resilience: 1 Loyalty buys 2 Supply, once/round. Costs no placement.',
      'Jair – Thirty Towns: +1 Goods when Provision is High.',
      'Jephthah – Outcast’s Resolve: −1 Loyalty loss on failed investment.',
    ],
    income: {
      goods: 1,
      loyalty: 1,
      label: '1 Goods + 1 Loyalty (if below max)',
      note: 'Stabilizer / thirty towns',
    },
  },
  {
    id: 'Reuben',
    faith: 2,
    warriors: 4,
    goods: 3,
    loyalty: 3,
    playstyle: 'Early momentum and scouting.',
    uniqueName: 'Scout Ahead',
    uniqueCost: 'Exhaust 1 Warrior',
    uniqueEffect: 'Look at the top card of the Crisis deck.',
    color: TRIBE_COLORS.Reuben,
    bias: BIAS.Reuben,
    upgrades: [
      'Firstborn Advance: You always place last.',
      'Pathfinder: Place 2+ on a track → 1 temp Supply on an empty track.',
      'Bold Claim: Once/game +1 Glory for standing second on a track.',
    ],
    income: {
      faith: 1,
      warriors: 1,
      label: '1 Faith + 1 Warrior',
      note: 'Searchings of heart / pastoral',
    },
  },
  {
    id: 'Simeon',
    faith: 2,
    warriors: 4,
    goods: 3,
    loyalty: 4,
    playstyle: 'High-risk skirmisher.',
    uniqueName: 'Skirmish',
    uniqueCost: 'Spend 1 Warrior',
    uniqueEffect: 'Gain 1 Glory. If Military is Low, also gain 1 Goods — settled at Reveal.',
    color: TRIBE_COLORS.Simeon,
    bias: BIAS.Simeon,
    upgrades: [
      'Vengeful Strike: Military Champion → +1 Warrior.',
      'Furious Assault: Free Military token next round after failure.',
      'Raid Leader: Convert Goods ↔ Warrior 1:1 once/round. Costs no action.',
    ],
    income: { warriors: 2, label: '2 Warriors', note: 'Skirmisher' },
  },
  {
    id: 'Dan',
    faith: 3,
    warriors: 4,
    // Dan alone opens with no Goods, trading its starting stock for the only
    // three-resource income in the game.
    goods: 0,
    loyalty: 3,
    playstyle: 'Trickster / strongman (Samson).',
    uniqueName: 'Serpent’s Wisdom',
    uniqueCost: 'Spend 1 Faith',
    uniqueEffect: 'Discard and redraw the active Crisis (once per game).',
    color: TRIBE_COLORS.Dan,
    bias: BIAS.Dan,
    upgrades: [
      'Samson I – Nazirite Strength: If all your Banners are on one track, they count double.',
      'Samson II – Riddle & Cunning: Move 1 token after reveal, once/round.',
      'Samson III – Final Stand: Once/game spend 2 Warriors so one track you held counts twice.',
    ],
    income: {
      warriors: 2,
      faith: 1,
      label: '2 Warriors + 1 Faith',
      note: 'Strongman — the only three-resource income, and no Goods at all',
    },
  },
  {
    id: 'Naphtali',
    faith: 3,
    warriors: 3,
    goods: 3,
    loyalty: 3,
    playstyle: 'Flexible support (Barak).',
    uniqueName: 'Reposition',
    uniqueCost: 'Action',
    uniqueEffect: 'Move 1 of your Influence tokens to a different track.',
    color: TRIBE_COLORS.Naphtali,
    bias: BIAS.Naphtali,
    upgrades: [
      'Doe’s Leap: Move 1 of your tokens after the reveal, once/round.',
      'Swift Response: Championing owes another tribe 1 temp Influence.',
      'Northern Alliance: Once/game, name two tracks; each counts +1.',
    ],
    income: {
      faith: 1,
      goods: 1,
      label: '1 Faith + 1 Goods',
      note: 'Flexible support',
    },
  },
  {
    id: 'Gad',
    faith: 2,
    warriors: 4,
    goods: 3,
    loyalty: 4,
    playstyle: 'Frontline tank.',
    uniqueName: 'Stand Firm',
    uniqueCost: 'Spend 1 Warrior',
    uniqueEffect: 'Protect yourself from the next Loyalty loss this round.',
    color: TRIBE_COLORS.Gad,
    bias: BIAS.Gad,
    upgrades: [
      'Raider’s Resolve: Reduce all Loyalty loss by 1.',
      'Enduring Defense: Military Low → your tokens +1.',
      'Overcomer: Once/game one track you held counts twice, cancelling a failure.',
    ],
    income: { warriors: 2, label: '2 Warriors', note: 'Frontline tank' },
  },
  {
    id: 'Asher',
    faith: 2,
    warriors: 2,
    goods: 5,
    loyalty: 3,
    playstyle: 'Economic powerhouse.',
    uniqueName: 'Harvest',
    uniqueCost: 'Spend 1 Faith or rest',
    uniqueEffect: 'Gain 2 Goods.',
    color: TRIBE_COLORS.Asher,
    bias: BIAS.Asher,
    upgrades: [
      'Blessed Abundance: Provision High → +1 Goods.',
      'Fertile Blessing: Gather/Harvest +1 Goods once/round.',
      'Rich Harvest: Once/game double Goods from one gain.',
    ],
    income: { goods: 2, label: '2 Goods', note: 'Coastal abundance' },
  },
  {
    id: 'Issachar',
    faith: 4,
    warriors: 2,
    goods: 3,
    loyalty: 3,
    playstyle: 'Strategic planner.',
    uniqueName: 'Study the Times',
    uniqueCost: 'Spend 1 Faith',
    uniqueEffect: 'Look at top two Crisis cards; put back in any order.',
    color: TRIBE_COLORS.Issachar,
    bias: BIAS.Issachar,
    upgrades: [
      'Understanding of Times: Peek one track threshold before placing.',
      'Strategic Insight: Champion → +1 Faith.',
      'Wise Counsel: Once/game force another to move 1 token.',
    ],
    income: {
      faith: 1,
      goods: 1,
      label: '1 Faith + 1 Goods',
      note: 'Strategic / understanding',
    },
  },
  {
    id: 'Zebulun',
    faith: 2,
    warriors: 3,
    goods: 4,
    loyalty: 2,
    playstyle: 'Merchant engine.',
    uniqueName: 'Bargain',
    uniqueCost: 'Spend 1 Goods',
    uniqueEffect: 'Perform two standard resource conversions.',
    color: TRIBE_COLORS.Zebulun,
    bias: BIAS.Zebulun,
    upgrades: [
      'Sea Trader: Convert Faith ↔ Goods 1:1 once/round. Costs no action.',
      'Commerce Route: Provision Champion → +1 Glory.',
      'Profitable Venture: Once/game double Goods gained.',
    ],
    income: {
      goods: 1,
      warriors: 1,
      label: '1 Goods + 1 Warrior',
      note: 'Merchant / trade',
    },
  },
];

export const TRIBE_BY_ID: Record<TribeId, TribeDef> = Object.fromEntries(
  TRIBES.map((t) => [t.id, t]),
) as Record<TribeId, TribeDef>;

/**
 * Whether a tribe's Unique Action can be paid for with Faith.
 * Derived from the printed cost so Micah's Idol (Crisis 7, "may not spend Faith
 * on tribe unique actions") stays correct if a cost is ever retuned.
 */
export function uniqueCanCostFaith(tribe: TribeId): boolean {
  return /faith/i.test(TRIBE_BY_ID[tribe].uniqueCost);
}

export const CRISIS_CARDS: CrisisCardDef[] = [
  {
    id: 1,
    name: 'The High Places of Baal',
    flavor: 'The people forsook the Lord and served the Baals.',
    severity: 'Mild',
    effect: 'Any Faith spent this round counts as only half Influence on the Moral Track (round down).',
  },
  {
    id: 2,
    name: 'Midianite Swarms',
    flavor: 'They came like locusts… and left no sustenance in Israel.',
    severity: 'Mild',
    effect: 'The Provision Track threshold is increased by 1 this round.',
  },
  {
    id: 3,
    name: 'Iron Chariots of the North',
    flavor: 'Sisera had nine hundred iron chariots…',
    severity: 'Mild',
    effect: 'Military Track tokens cost 1 extra Warrior this round. An unpaid token contributes 0.',
  },
  {
    id: 4,
    name: 'The Cry of the Oppressed',
    flavor: 'The people of Israel cried out to the Lord…',
    severity: 'Mild-Positive',
    effect: 'The Military Champion gains +1 Faith (tracks resolve Military → Moral → Provision).',
  },
  {
    id: 5,
    name: 'Abimelech’s Ambition',
    flavor: 'He hired worthless and reckless fellows…',
    severity: 'Moderate',
    effect: 'At end of round, the player(s) with most Glory lose 1 Loyalty.',
  },
  {
    id: 6,
    name: 'The Ammonite Claim',
    flavor: 'Israel took away my land…',
    severity: 'Moderate',
    effect: 'Military and Moral Tracks both require +1 Influence to succeed.',
  },
  {
    id: 7,
    name: 'Micah’s Idol',
    flavor: 'Every man did what was right in his own eyes.',
    severity: 'Moderate',
    effect: 'Players may not spend Faith on tribe unique actions this round.',
  },
  {
    id: 8,
    name: 'The Philistine Razor',
    flavor: 'The Philistines came up and encamped in Judah…',
    severity: 'Moderate',
    effect: 'Military Champion must lose 1 Warrior or 1 Goods.',
  },
  {
    id: 9,
    name: 'Jephthah’s Vow',
    flavor: 'Whatever comes out from the doors of my house…',
    severity: 'Escalating',
    effect: 'If Moral fails, Covenant −1 extra. If it succeeds, Champion +1 Glory.',
  },
  {
    id: 10,
    name: 'The Levite’s Concubine',
    flavor: 'Such a thing has never happened or been seen…',
    severity: 'Escalating',
    effect: 'All Loyalty losses this round are increased by 1.',
  },
  {
    id: 11,
    name: 'Civil Strife in Benjamin',
    flavor: 'There was a very great slaughter…',
    severity: 'Escalating',
    effect: 'After Champions, top two Military Influence players each lose 1 Loyalty.',
  },
  {
    id: 12,
    name: 'The Angel of the Lord',
    flavor: 'I brought you up from Egypt… but you have not obeyed my voice.',
    severity: 'Escalating-Positive/Warning',
    effect: 'Reorder top two Crisis cards; raise or lower Covenant by 1.',
  },
  {
    id: 13,
    name: 'The Day of Midian',
    flavor: 'The sword of the Lord and of Gideon!',
    severity: 'Heavy',
    effect: 'Military fails unless Influence ≥ 2× threshold. On success, investors +1 Glory.',
  },
  {
    id: 14,
    name: 'In Those Days There Was No King',
    flavor: '…everyone did what was right in his own eyes.',
    severity: 'Heavy',
    effect: 'Covenant −1 at end of round. Max 1 Glory from Champion rewards.',
  },
];

export const ALL_TRIBE_IDS = TRIBES.map((t) => t.id);
