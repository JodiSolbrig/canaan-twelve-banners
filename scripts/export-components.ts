/**
 * Generates the print-ready component data in `print/component-studio/`.
 *
 * Component Studio (The Game Crafter) builds a deck by uploading one CSV whose
 * **column headers match the layer names in your design template**, one row per
 * card. Two columns are special: `name` names the card in your library, and
 * `quantity` is how many copies get printed. Everything else is yours to name —
 * so if you call a text layer `effect` in the template, the `effect` column
 * fills it, and an image layer called `art` takes the filename of an image you
 * uploaded to the same folder.
 *
 * Run: `npm run export:print`
 *
 * This reads the same modules the app plays from, so a tuning change or a
 * reworded upgrade lands in the print files the next time it runs. Nothing here
 * is hand-maintained except the rules text that has no data source (the standard
 * actions, the reference cards) and the art prompts.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_TUNING as T } from '../src/config/tuning.ts';
import { CRISIS_CARDS, TRACK_LABELS, TRIBES } from '../src/data/gameData.ts';
import { OPPRESSORS } from '../src/data/oppressors.ts';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'print', 'component-studio');

/* ------------------------------------------------------------ design CSVs --- */

/**
 * The prose comes from `csv/`, not from `src/data/gameData.ts`.
 *
 * Those two say the same things at different lengths: the engine carries
 * abbreviated strings sized for a UI panel ("Firstborn Advance: You always place
 * last."), while the design CSVs carry the full rule as it should read on a
 * printed card ("Reubenite Scout – Firstborn Advance: You always place last in
 * the placement phase, seeing how heavily every other tribe has committed before
 * you commit."). A card has room; a sidebar does not.
 *
 * Numbers, colours and track affinities still come from the engine, so the print
 * files can never disagree with the tuned game about what anything costs.
 */
const NL = String.fromCharCode(10);

function readDesignCsv(file: string): Record<string, string>[] {
  const text = readFileSync(join(ROOT, 'csv', file), 'utf8').replaceAll('\r\n', '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === NL) { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }

  const headers = rows.shift()!;
  return rows
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

/** Index a design CSV by its Tribe column. */
function byTribe(file: string): Record<string, Record<string, string>> {
  return Object.fromEntries(readDesignCsv(file).map((r) => [r.Tribe!, r]));
}

const CRISIS_CSV = readDesignCsv('crisis_cards.csv');
const PROGRESSION = byTribe('leader_progressions.csv');
const UNIQUE = byTribe('unique_actions.csv');
const OVERVIEW = byTribe('tribes_overview.csv');

/* ------------------------------------------------------------------ CSV --- */

/**
 * RFC 4180. Component Studio's importer is strict about quoting, and almost
 * every string in this game contains a comma, an em-dash or a curly quote.
 */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function writeCsv(file: string, rows: Record<string, string | number>[]): void {
  if (rows.length === 0) throw new Error(`${file}: nothing to write`);
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => csvCell(r[h] ?? '')).join(',')),
  ];
  // No BOM: the importer reads UTF-8 and a BOM shows up inside the first header.
  // LF, not CRLF: the repo normalises to LF everywhere (see .gitattributes), and
  // every CSV reader worth the name accepts either.
  writeFileSync(join(OUT, file), lines.join(NL) + NL, 'utf8');
  console.log(`  ${file.padEnd(26)} ${String(rows.length).padStart(3)} rows`);
}

/** A filename stem safe for an asset library and a Windows/macOS filesystem. */
function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* --------------------------------------------------------------- prompts --- */

/**
 * One art direction, stated once. Every prompt in the manifest ends with it, so
 * fifty images share a palette and a light source instead of looking like fifty
 * different games. The clauses that matter most are the palette and the
 * "no text" — generators love to letter their own titles into the plate, and
 * every title on these cards is a type layer in the template.
 */
const STYLE =
  'painted illustration in the manner of a 19th-century engraved bible plate, ' +
  'muted ochre umber and bone palette with one desaturated accent, dramatic low ' +
  'sunlight, dust in the air, late bronze age Levant, hand-inked texture, ' +
  'no text, no lettering, no watermark, no border';

/** Portrait card art, sized for a 2.5x3.5in card at 300dpi with bleed. */
const CARD_AR = '--ar 5:7';

/* ----------------------------------------------------------------- decks --- */

/**
 * Where each Crisis quotation comes from. The flavour lines were written from
 * Judges but the book/chapter/verse was never recorded alongside them, and a
 * card that quotes scripture should say where from.
 *
 * VERIFY THESE AGAINST YOUR TRANSLATION BEFORE PRINTING. Wording and versing
 * both move between translations, and card 11 in particular is a summary of the
 * Benjamite war rather than a quotation of one verse.
 */
const CRISIS_REFERENCE: Record<number, string> = {
  1: 'Judges 2:13',
  2: 'Judges 6:5',
  3: 'Judges 4:3',
  4: 'Judges 3:9',
  5: 'Judges 9:4',
  6: 'Judges 11:13',
  7: 'Judges 17:6',
  8: 'Judges 15:9',
  9: 'Judges 11:31',
  10: 'Judges 19:30',
  11: 'Judges 20:35',
  12: 'Judges 2:1-2',
  13: 'Judges 7:20',
  14: 'Judges 21:25',
};

/** Subject line for each Crisis card's art, before the shared style suffix. */
const CRISIS_ART: Record<number, string> = {
  1: 'a hilltop shrine of carved stone pillars above a sleeping village',
  2: 'a locust swarm darkening the sky over stripped barley terraces',
  3: 'iron-rimmed chariot wheels churning a dry valley floor',
  4: 'a crowd of villagers with raised open hands at dusk',
  5: 'a usurper on a stone throne surrounded by hired swords',
  6: 'a boundary stone contested by two armed delegations',
  7: 'a household idol of silver in a curtained domestic shrine',
  8: 'a Philistine encampment of tents ranged along a ridge',
  9: 'a lit doorway of a house at night, a figure returning alone',
  10: 'a cold dawn over an empty threshold, a discarded cloak',
  11: 'brothers fighting brothers among olive trees, banners fallen',
  12: 'a robed messenger standing in a field of thorns, face unseen',
  13: 'three hundred torches breaking from clay jars in a night camp',
  14: 'a crossroads with no signpost under an enormous empty sky',
};

/** Subject line for each tribe's emblem art. */
const TRIBE_ART: Record<string, string> = {
  Judah: 'a lion couchant on a rock above a valley',
  Benjamin: 'a wolf at dawn beside a broken bowstring',
  Levi: 'a stone altar with rising smoke and a plain linen ephod',
  Ephraim: 'a heavy sheaf of ripe wheat bound with cord',
  Manasseh: 'a walled hill town of thirty towers seen from below',
  Reuben: 'still water over deep stone, a shepherd waiting at the ford',
  Simeon: 'a bundle of iron-headed spears driven into dry ground',
  Dan: 'a serpent coiled at a mountain pass, a torn lion jaw nearby',
  Naphtali: 'a hind leaping across a northern hillside at first light',
  Gad: 'a fortified camp on a raided frontier, dust on the horizon',
  Asher: 'olive presses and jars of oil in a rich coastal grove',
  Issachar: 'a strong ass at rest beside a sundial of stones',
  Zebulun: 'a harbour of beached trading ships under a bruised sky',
};

/* ------------------------------------------------------------------------ */

mkdirSync(OUT, { recursive: true });
console.log(`\nCanaan: Twelve Banners — component export\n\n${OUT}\n`);

/** Every art asset the game needs, collected as the decks are written. */
const art: { file: string; component: string; subject: string; aspect: string }[] = [];

function needArt(file: string, component: string, subject: string, aspect = CARD_AR) {
  art.push({ file, component, subject, aspect });
  return `${file}.png`;
}

/* --- Crisis deck (14 cards, 1 of each) ---------------------------------- */

writeCsv(
  'crisis-cards.csv',
  CRISIS_CARDS.map((c) => {
    const long = CRISIS_CSV.find((r) => Number(r['Card Number']) === c.id)!;
    return {
    name: c.name,
    quantity: 1,
    card_number: `${c.id} / 14`,
    title: c.name,
    flavor: `“${long['Flavor Text']}”`,
    reference: CRISIS_REFERENCE[c.id] ?? '',
    severity: c.severity,
    effect: long.Effect!,
    art: needArt(`crisis-${String(c.id).padStart(2, '0')}-${slug(c.name)}`, 'Crisis card', CRISIS_ART[c.id]!),
    };
  }),
);

/* --- Oppressor deck (6 cards) ------------------------------------------- */

writeCsv(
  'oppressor-cards.csv',
  OPPRESSORS.map((o) => ({
    name: o.title,
    quantity: 1,
    title: o.title,
    subtitle: o.name,
    flavor: `“${o.flavor}”`,
    reference: o.reference,
    presses_on: TRACK_LABELS[o.attacks],
    deliverer: o.deliverer,
    // The two rules an Oppressor needs on its face; both scale with severity,
    // which is tracked with a marker on the card rather than printed per-value.
    escalation:
      'Severity 1 on arrival, +1 per generation endured. ' +
      `${TRACK_LABELS[o.attacks]} threshold +severity. Cry +1 Faith per severity.`,
    cry: `Cry = 1 Faith per player, +${T.cryThresholdBase}, +1 per generation endured.`,
    art: needArt(`oppressor-${slug(o.id)}`, 'Oppressor card', oppressorArt(o.id)),
  })),
);

function oppressorArt(id: string): string {
  const byId: Record<string, string> = {
    aram: 'a distant Aramean king enthroned beyond a river of dust',
    moab: 'a very fat king alone in a cool upper chamber',
    hazor: 'nine hundred chariots ranked across a plain at dawn',
    midian: 'camel raiders stripping a threshing floor bare',
    ammon: 'an Ammonite host massed on the far bank of the Jordan',
    philistia: 'a Philistine smithy, the only forge in the land',
  };
  return byId[id]!;
}

/* --- Judge deck (6 one-shot cards) -------------------------------------- */

writeCsv(
  'judge-cards.csv',
  OPPRESSORS.map((o) => {
    const [powerName, powerText] = splitOnce(o.judgePower, ' — ');
    return {
      name: `Judge — ${o.deliverer}`,
      quantity: 1,
      title: o.deliverer,
      power_name: powerName,
      power_text: powerText,
      window: judgeWindow(o.id),
      duration: `Lapses after ${T.judgeGenerations} generations, spent or not.`,
      flavor: '“Then the Lord raised up judges, who saved them.”',
      reference: 'Judges 2:16',
      art: needArt(`judge-${slug(o.deliverer)}`, 'Judge card', judgeArt(o.id)),
    };
  }),
);

function judgeWindow(id: string): string {
  // Mirrors JUDGE_POWER_WINDOW in src/engine/judges.ts.
  return ['moab', 'hazor', 'ammon'].includes(id)
    ? 'On your turn'
    : 'After the reveal, before scoring';
}

function judgeArt(id: string): string {
  const byId: Record<string, string> = {
    aram: 'a young judge kneeling alone at a field altar',
    moab: 'a left hand drawing a short blade from beneath a cloak',
    hazor: 'a woman seated in judgement beneath a palm tree',
    midian: 'a farmer threshing wheat in hiding inside a winepress',
    ammon: 'an outcast captain returning at the head of raiders',
    philistia: 'a long-haired strong man with his hands on two pillars',
  };
  return byId[id]!;
}

/* --- Tribe boards (13) --------------------------------------------------- */

const AFFINITY: Record<string, string> = {
  military: 'Warriors',
  moral: 'Faith',
  provision: 'Goods',
};


writeCsv(
  'tribe-boards.csv',
  TRIBES.map((t) => ({
    name: t.id,
    quantity: 1,
    tribe: t.id,
    color_hex: t.color,
    affinity_track: TRACK_LABELS[t.bias],
    // The affinity resource is what plants this tribe's Banners — the single
    // most important thing on the board and the thing new players miss.
    banner_resource: AFFINITY[t.bias],
    start_faith: t.faith,
    start_warriors: t.warriors,
    start_goods: t.goods,
    start_loyalty: t.loyalty,
    income: t.income.label,
    income_note: t.income.note,
    playstyle: OVERVIEW[t.id]!.Playstyle!,
    unique_name: UNIQUE[t.id]!['Unique Action Name']!,
    unique_cost: UNIQUE[t.id]!.Cost!,
    unique_effect: UNIQUE[t.id]!.Effect!,
    ...upgradeColumns(upgradesOf(t.id)),
    art: needArt(`tribe-${slug(t.id)}`, 'Tribe board', TRIBE_ART[t.id]!, '--ar 3:2'),
  })),
);

/** The three full-length upgrade lines for a tribe, in order. */
function upgradesOf(tribe: string): string[] {
  const row = PROGRESSION[tribe]!;
  return [row['Upgrade 1']!, row['Upgrade 2']!, row['Upgrade 3']!];
}

/** Flatten the three upgrade strings into twelve printable columns. */
function upgradeColumns(upgrades: string[]): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  upgrades.forEach((raw, i) => {
    const u = parseUpgrade(raw);
    const n = i + 1;
    out[`upgrade_${n}_leader`] = u.leader;
    out[`upgrade_${n}_name`] = u.ability;
    out[`upgrade_${n}_text`] = u.text;
    out[`upgrade_${n}_glory`] = T.leaderUnlockGlory[i] ?? 0;
  });
  return out;
}

/** `Othniel I – Lion's Rally: When Champion, +1 extra Glory.` */
function parseUpgrade(raw: string): { leader: string; ability: string; text: string } {
  const dash = raw.indexOf(' – ');
  const colon = raw.indexOf(': ');

  // `Othniel I – Lion's Rally: When Champion, +1 extra Glory.`
  if (dash >= 0 && colon > dash) {
    const [leader, rest] = splitOnce(raw, ' – ');
    const [ability, text] = splitOnce(rest, ': ');
    return { leader, ability, text };
  }
  // `Furious Assault – After a Military Track failure…` — no named leader.
  if (dash >= 0 && colon < 0) {
    const [ability, text] = splitOnce(raw, ' – ');
    return { leader: '', ability, text };
  }
  // `Firstborn Advance: You always place last…`
  if (colon >= 0) {
    const [ability, text] = splitOnce(raw, ': ');
    return { leader: '', ability, text };
  }
  throw new Error(`Cannot parse upgrade: ${raw}`);
}

/** Split on the first occurrence only; the tail may contain the separator. */
function splitOnce(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep);
  return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + sep.length)];
}

/* --- Leader cards (39) --------------------------------------------------- */

/**
 * The same three upgrades again as individual cards. Printing them on the tribe
 * board keeps the table tidy; dealing them as cards lets a player physically
 * take one when they unlock it, which reads better across ten generations. Use
 * whichever you prefer — both files are generated so you can try both.
 */
writeCsv(
  'leader-cards.csv',
  TRIBES.flatMap((t) =>
    upgradesOf(t.id).map((raw, i) => {
      const u = parseUpgrade(raw);
      return {
        name: `${t.id} ${['I', 'II', 'III'][i]} — ${u.ability}`,
        quantity: 1,
        tribe: t.id,
        color_hex: t.color,
        level: ['I', 'II', 'III'][i]!,
        leader: u.leader,
        ability_name: u.ability,
        ability_text: u.text,
        unlock: `${T.leaderUnlockGlory[i]} Glory`,
        art: `tribe-${slug(t.id)}.png`,
      };
    }),
  ),
);

/* --- Player aid (double sided) ------------------------------------------ */

const ACTIONS = [
  ['Place Influence', 'Spend any resources → 1 Influence token each. Face down. What you pay with decides Banner or Supply.'],
  ['Recruit', 'Spend 1 Goods → 2 Warriors. Or commit 1 Faith → 1 Warrior (the Faith is returned).'],
  ['Gather / Harvest', 'Spend 1 Warrior or 1 Faith → 2 Goods.'],
  ['Pray / Seek the Lord', 'Rest → 2 Faith. Or spend 1 Goods → 1 Faith + 1 Loyalty (never above your starting Loyalty).'],
  ['Convert / Bargain', '2 Goods → 1 Faith or 1 Warrior. 2 Warriors → 1 Goods. 2 Faith → 1 Goods or 1 Warrior.'],
  ['Rest & Recover', 'Do nothing else → 1 Loyalty, and look at the top Crisis card (return it to the top or the bottom).'],
  ['Cry Out', 'Only under an Oppressor. Pay any Faith into the shared Cry.'],
  ['Your Unique Action', 'Printed on your tribe board. Replaces the standard action for the generation.'],
];

writeCsv(
  'player-aid.csv',
  [
    {
      name: 'Player Aid — front',
      quantity: 6,
      side: 'Front — the generation',
      heading: 'One generation',
      body: [
        '1. Reveal the Crisis (or endure the Oppressor).',
        '2. Placement — all players place Influence face down.',
        '3. Action — one standard action or your Unique Action.',
        '4. Reveal all Influence.',
        '5. Before scoring — spend anything that reads the full board.',
        '6. Score each track, then move the Covenant.',
      ].join('\n'),
      footer: [
        `Threshold: 1 Influence per player${T.thresholdBonus ? ` +${T.thresholdBonus}` : ''} on every track.`,
        'Banner = the track’s affinity resource. Counts for the threshold AND for Champion, and loses 1 Loyalty if the track fails.',
        'Supply = anything else. Counts for the threshold only. Risks nothing, shares the spoil.',
        'Warriors → Military · Faith → Moral · Goods → Provision',
      ].join('\n'),
    },
    {
      name: 'Player Aid — back',
      quantity: 6,
      side: 'Back — actions',
      heading: 'Choose one each generation',
      body: ACTIONS.map(([n, d]) => `${n} — ${d}`).join('\n'),
      footer: [
        `Champion of a track: +${T.championRewards.military.glory} Glory and +1 of that track’s resource.`,
        'Covenant: −1 for every track that gave way; +1 only if all three held.',
        `Leaders unlock at ${T.leaderUnlockGlory.join(', ')} Glory.`,
        `The game is ${T.generations} generations long.`,
      ].join('\n'),
    },
  ],
);

/* --- Reference cards ----------------------------------------------------- */

writeCsv('reference-cards.csv', [
  {
    name: 'The Covenant Meter',
    quantity: 2,
    heading: 'The Covenant Meter',
    body: [
      '8–10  Strength — no effect.',
      '4–7   Warning — every player loses 1 Loyalty unless at least one track held.',
      '1–3   Judgment — every failed track drops the meter 1 deeper, and everyone tied for lowest Loyalty discards 1 Goods or 1 Warrior.',
      '0     Broken — everyone loses 2 Loyalty. The game ends after the next full generation.',
    ].join('\n'),
    footer:
      `At ${T.oppressionTriggerAt} or below, Israel is sold into the hand of an Oppressor. ` +
      'Deliverance restores the meter to 8.',
    art: needArt('reference-covenant', 'Reference card', 'a bronze balance scale against a plain wall'),
  },
  {
    name: 'The Cycle of the Judges',
    quantity: 2,
    heading: 'The Cycle of the Judges',
    body: [
      `1. Oppression — the meter falls to ${T.oppressionTriggerAt}. Draw an Oppressor. It replaces the Crisis until it is broken.`,
      '2. Escalation — severity rises 1 every generation endured. The track it presses on gets harder, and the Cry gets dearer.',
      '3. Crying Out — spend your action to pay Faith into the shared Cry.',
      '4. Deliverance — the Cry is met. The Covenant returns to 8, and a Judge is raised from the LEAST among the tribes (lowest Glory).',
      '5. Rest — the next generation draws no Crisis and pays full income.',
    ].join('\n'),
    footer: 'Whoever pays for the deliverance, it elevates their weakest rival.',
    art: needArt('reference-cycle', 'Reference card', 'a wheel rut worn deep into a stone road'),
  },
  {
    name: 'Scoring',
    quantity: 2,
    heading: 'Final scoring',
    body: [
      'Glory earned across the game.',
      '+1 Glory per 2 Loyalty remaining.',
      '+1 Glory per 3 resources remaining, of any kind.',
      'Ties: most Championships, then highest Loyalty.',
    ].join('\n'),
    footer: 'Most Glory wins.',
    art: needArt('reference-scoring', 'Reference card', 'a heap of grain and a stack of clay counting tokens'),
  },
]);

/* --- Bill of materials --------------------------------------------------- */

/**
 * Everything that goes in the box. Counts assume a full 6-player table; the
 * thirteen tribes are the pool you draft from, so tribe boards and Influence
 * tokens are made for all thirteen even though at most six play.
 */
writeCsv('bill-of-materials.csv', [
  bom('Crisis cards', 14, 'Poker 2.5×3.5', 'crisis-cards.csv', 'Deck. One of each.'),
  bom('Oppressor cards', 6, 'Tarot 2.75×4.75', 'oppressor-cards.csv', 'Larger than the Crisis deck on purpose — an Oppressor stays on the table for generations, and should not look like a card that leaves at the end of the round.'),
  bom('Judge cards', 6, 'Poker 2.5×3.5', 'judge-cards.csv', 'Held by a player for two generations, then discarded.'),
  bom('Tribe boards', 13, 'Mat 6×9 or Jumbo card', 'tribe-boards.csv', 'Needs printed tracks for Loyalty (0–5) and Glory (0–20), plus three leader slots.'),
  bom('Leader cards', 39, 'Mini 1.75×2.5', 'leader-cards.csv', 'Optional — the same text is on the tribe board. Nice if you want players to physically take an upgrade.'),
  bom('Player aid cards', 6, 'Tarot 2.75×4.75, double sided', 'player-aid.csv', 'One per player.'),
  bom('Reference cards', 6, 'Poker 2.5×3.5', 'reference-cards.csv', 'Two copies of each of three, so the table can share.'),
  bom('Main board', 1, 'Folding board 20×20', '—', 'Three track rows with threshold markings, the Covenant meter 0–10, a generation track 1–10, a Crisis/Oppressor slot and a Cry pool space.'),
  bom('Influence tokens', 156, '3/4in double-sided disc', '—', 'Twelve per tribe, in the tribe colour. BANNER on one face, SUPPLY on the other — this is how the table sees what a token counts for without anyone declaring it.'),
  bom('Faith cubes', 60, '8mm wooden cube, white', '—', 'Shared bank.'),
  bom('Warrior cubes', 60, '8mm wooden cube, red', '—', 'Shared bank.'),
  bom('Goods cubes', 60, '8mm wooden cube, yellow', '—', 'Shared bank.'),
  bom('Loyalty & Glory markers', 26, '8mm wooden cube, tribe colour', '—', 'Two per tribe, for the tracks on the tribe board.'),
  bom('Covenant marker', 1, '15mm wooden disc, black', '—', 'Starts at 8.'),
  bom('Severity marker', 1, '15mm wooden disc, red', '—', 'Sits on the Oppressor card.'),
  bom('Generation marker', 1, '15mm wooden disc, white', '—', `Counts 1 to ${T.generations}.`),
  bom('Player screens', 6, 'Small screen', '—', 'Placement is simultaneous and secret. A screen is what makes that work at a table — build your placement behind it, then everyone reveals at once.'),
]);

function bom(item: string, qty: number, spec: string, data: string, notes: string) {
  return { item, quantity: qty, spec, data_file: data, notes };
}

/* --- Art manifest -------------------------------------------------------- */

writeCsv(
  'art-manifest.csv',
  art.map((a) => ({
    file: `${a.file}.png`,
    component: a.component,
    subject: a.subject,
    prompt: `${a.subject}, ${STYLE} ${a.aspect}`,
    status: 'todo',
  })),
);

console.log(`\n  ${art.length} art assets to generate — see art-manifest.csv\n`);
