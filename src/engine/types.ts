export type TrackId = 'military' | 'moral' | 'provision';
export type ResourceKey = 'faith' | 'warriors' | 'goods' | 'loyalty' | 'glory';

/** Resources that can be spent to place Influence. */
export type SpendableResource = 'faith' | 'warriors' | 'goods';

/**
 * Core phase machine driven by `dispatch` + `revealTokens` / `startRound`.
 * Setup is handled outside the engine (React `App` screen).
 */
export type Phase =
  | 'crisisReveal'
  | 'crisisChoice' // Angel of the Lord / interactive crisis
  | 'placement'
  | 'action'
  | 'reveal'
  /**
   * Influence is face up and nothing has been scored yet. Discretionary
   * abilities that read the revealed board are spent here — Samson's shift, the
   * Level III covenant rescue, and the Judge powers that modify resolution.
   */
  | 'preResolve'
  | 'resolve'
  | 'gameEnd';

export type TribeId =
  | 'Judah'
  | 'Benjamin'
  | 'Levi'
  | 'Ephraim'
  | 'Manasseh'
  | 'Reuben'
  | 'Simeon'
  | 'Dan'
  | 'Naphtali'
  | 'Gad'
  | 'Asher'
  | 'Issachar'
  | 'Zebulun';

export type Resources = {
  faith: number;
  warriors: number;
  goods: number;
  loyalty: number;
  glory: number;
};

export type InfluenceToken = {
  id: string;
  playerId: string;
  track: TrackId;
  value: number;
  temporary: boolean;
  faceDown: boolean;
  /**
   * Which resource bought this token, or null for a gifted one.
   *
   * Banner/Supply is *derived* from this against the track the token currently
   * sits on (see `isBannerToken`), never stored — so a token moved between
   * tracks by Reposition re-evaluates automatically.
   */
  paidWith: SpendableResource | null;
};

export type PlayerState = {
  id: string;
  tribe: TribeId;
  isHuman: boolean;
  resources: Resources;
  startingLoyalty: number;
  influencePool: number;
  championships: number;
  leaderLevel: number; // 0–3 unlocked
  oncePerGameUsed: Record<string, boolean>;
  oncePerRoundUsed: Record<string, boolean>;
  /** Protect next loyalty loss */
  standFirm: boolean;
  /** Reduce next covenant drop by 1 (Levi) */
  covenantProtect: boolean;
  /** Reduce covenant penalty on a failed track by 1 (Manasseh) */
  holdTheLine: boolean;
  /** Gad Overcomer pending */
  overcomerAvailable: boolean;
  /** Free military token next round (Simeon) */
  freeMilitaryNextRound: number;
  /** Temporary influence to give next round (Naphtali) */
  pendingTempInfluenceGift: number;
  /**
   * Permanent addition to this tribe's per-round income, on top of its printed
   * income line. Ephraim's Abdon I ("+1 Goods permanently") is granted here.
   */
  incomeBonus: { faith: number; warriors: number; goods: number };
  /**
   * Zone-dependent unique queued during the action phase and settled after Reveal
   * (Benjamin Raid, Simeon Skirmish). Deferring keeps the Low-zone test from
   * reading opponents' face-down tokens or depending on seat order.
   */
  pendingZoneUnique: 'raid' | 'skirmish' | null;
  /** Times this player has been raised up as Judge. */
  judgeships: number;
  /**
   * An unspent Judge one-shot, named by the oppression it broke.
   *
   * A judge does not outlive their generation — "and whenever the judge died,
   * they turned back and were more corrupt than their fathers" (Judges 2:19).
   * The power lapses at the end of `judgePowerExpires`, spent or not.
   * The powers themselves are not wired yet.
   */
  judgePower: OppressorId | null;
  /** Round after which an unspent `judgePower` lapses. */
  judgePowerExpires: number;
  /**
   * A Judge power spent this round whose effect lands during resolution
   * (Othniel's Zeal, Gideon's Three Hundred, Samson's Strength).
   */
  judgeArmed: { power: OppressorId; track: TrackId } | null;
  /** Jephthah's Vow taken — the price falls due at the end of the game. */
  jephthahVow: boolean;
  /** Level III covenant rescue declared this round, to cancel one failure. */
  rescueArmed: boolean;
  /** Peeked crisis cards for UI */
  peekedCrisis: CrisisCardDef[] | null;
};

export type OppressorId =
  | 'aram'
  | 'moab'
  | 'hazor'
  | 'midian'
  | 'ammon'
  | 'philistia';

export type OppressorDef = {
  id: OppressorId;
  /** Short name for the board, e.g. "Midian". */
  name: string;
  /** Full card title, e.g. "The Hand of Midian". */
  title: string;
  flavor: string;
  reference: string;
  /** The track this oppression presses on. */
  attacks: TrackId;
  deliverer: string;
  /** Display text for the one-shot the Judge receives. */
  judgePower: string;
};

/**
 * A standing oppression. Unlike a Crisis it does not expire at end of round —
 * it worsens until Israel cries out (Judges 2:11-19).
 */
export type Oppression = {
  oppressorId: OppressorId;
  /**
   * Full rounds already endured. Severity is `roundsEndured + 1`, so the round
   * an Oppressor arrives it is at severity 1.
   */
  roundsEndured: number;
  /** Faith paid into the Cry so far this oppression. */
  cryPool: number;
  /** Faith each player has paid in, for the log and any future reward. */
  contributors: Record<string, number>;
};

export type CrisisSeverity =
  | 'Mild'
  | 'Mild-Positive'
  | 'Moderate'
  | 'Escalating'
  | 'Escalating-Positive/Warning'
  | 'Heavy';

export type CrisisCardDef = {
  id: number;
  name: string;
  flavor: string;
  severity: CrisisSeverity;
  effect: string;
};

/** Resources gained at the start of each round. Loyalty is capped at starting max. */
export type TribeIncome = {
  faith?: number;
  warriors?: number;
  goods?: number;
  loyalty?: number;
  /** Display line matching rules copy, e.g. "1 Faith + 1 Warrior" */
  label: string;
  /** Short thematic note for UI */
  note: string;
};

export type TribeDef = {
  id: TribeId;
  faith: number;
  warriors: number;
  goods: number;
  loyalty: number;
  playstyle: string;
  uniqueName: string;
  uniqueCost: string;
  uniqueEffect: string;
  color: string;
  bias: TrackId;
  upgrades: [string, string, string];
  /** Collected automatically at the start of rounds 2+ (not round 1). */
  income: TribeIncome;
};

export type LogEntry = {
  id: string;
  round: number;
  text: string;
  tone?: 'info' | 'good' | 'bad' | 'crisis';
};

export type TrackResolution = {
  track: TrackId;
  /** Banner + Supply. This is what the success threshold is measured against. */
  total: number;
  /** Banner Influence only — what Champion is decided on. */
  bannerTotal: number;
  /** Influence needed to succeed. Doubled on Military by Day of Midian. */
  threshold: number;
  /**
   * Unmodified threshold for this track. Low/High zones are measured against
   * this so a one-round success modifier (Day of Midian) does not warp abilities
   * that key off zones (Raid, Skirmish, Gad Enduring Defense, Jair, Asher).
   */
  baseThreshold: number;
  success: boolean;
  championId: string | null;
  zone: 'low' | 'normal' | 'high';
};

export type GameState = {
  players: PlayerState[];
  turnOrder: string[];
  firstPlayerIndex: number;
  currentActorIndex: number;
  round: number;
  maxRounds: number;
  phase: Phase;
  covenant: number;
  brokenClock: boolean; // final round after broken
  crisisDeck: CrisisCardDef[];
  crisisDiscard: CrisisCardDef[];
  /** Null while an Oppressor holds the slot, and during a round of rest. */
  activeCrisis: CrisisCardDef | null;
  /** The standing oppression, if Israel is under one. */
  oppression: Oppression | null;
  /** Oppressors not yet drawn this game. */
  oppressorDeck: OppressorId[];
  /** This round is "the land had rest": no Crisis, full income. */
  restRound: boolean;
  tokens: InfluenceToken[];
  log: LogEntry[];
  trackResults: TrackResolution[] | null;
  winners: string[] | null;
  /** First champion this round (Cry of the Oppressed) */
  firstChampionId: string | null;
  gloryFromChampionsThisRound: Record<string, number>;
  pendingCrisisChoice: null | {
    type: 'angel';
    options: CrisisCardDef[];
  };
  seed: number;
  tuningSnapshot: import('../config/tuning').TuningConfig;
};

/**
 * What a player spends on one track. Each unit of each resource buys one
 * Influence token, so `{ warriors: 2, goods: 1 }` places three tokens on that
 * track — two Banner (if it is the Military track) and one Supply.
 */
export type ResourceSpend = Partial<Record<SpendableResource, number>>;

/**
 * A placement is an explicit statement of which resources go where. The choice
 * of *what* pays is the core decision: the track's affinity resource plants a
 * Banner (counts for Champion, exposed to the failure penalty), anything else
 * sends Supply (counts only toward the threshold, and risks nothing).
 */
export type PlacementPlan = Partial<Record<TrackId, ResourceSpend>>;

/** Standard action kinds handled by `applyStandardAction` (not unique / placeInfluence). */
export type StandardActionType =
  | 'recruit'
  | 'gather'
  | 'pray'
  | 'convert'
  | 'rest'
  | 'cryOut'
  | 'pass';

export type PlayerAction =
  | { type: 'confirmPlacement'; plan: PlacementPlan }
  | {
      type: 'standard';
      action: StandardActionType;
      recruitMode?: 'goods' | 'faith';
      gatherSpend?: 'warriors' | 'faith';
      prayMode?: 'rest' | 'goods';
      convert?: { from: 'faith' | 'warriors' | 'goods'; to: 'faith' | 'warriors' | 'goods' };
      /** Faith to pay into the Cry. Only meaningful for `cryOut`. */
      cryFaith?: number;
    }
  | { type: 'placeInfluence'; plan: PlacementPlan }
  | {
      type: 'unique';
      tribe: TribeId;
      // tribe-specific payloads
      targetPlayerId?: string;
      track?: TrackId;
      tokenId?: string;
      toTrack?: TrackId;
      leviMode?: 'raise' | 'protect';
      ephraimMode?: 'doubleGoods' | 'goodsPlusFaith' | 'goodsPlusWarriors';
      manassehSpend?: 'warriors' | 'faith';
      asherMode?: 'faith' | 'rest';
      zebulunConverts?: Array<{
        from: 'faith' | 'warriors' | 'goods';
        to: 'faith' | 'warriors' | 'goods';
      }>;
      issacharOrder?: [number, number]; // deck indices after peek — reorder top two
    }
  | {
      type: 'crisisChoice';
      angel: {
        topId: number;
        bottomId: number;
        covenantDelta: 1 | -1;
      };
    }
  /** Spend the one-shot a deliverance left you. */
  | {
      type: 'judgePower';
      /** Track the power names, where it needs one. */
      track?: TrackId;
      /** Victim of Ehud's Hidden Dagger. */
      targetPlayerId?: string;
      /** Which of the victim's tokens the dagger takes. */
      tokenId?: string;
    }
  /** Dan, Samson II — shift one token once the board is face up. */
  | { type: 'samsonMove'; tokenId: string; toTrack: TrackId }
  /** Level III — one track you held counts twice, cancelling a failure. */
  | { type: 'covenantRescue' }
  | { type: 'advance' }; // for auto phases / human done
