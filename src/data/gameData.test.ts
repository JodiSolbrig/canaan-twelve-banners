/**
 * The CSV design package is the source of truth for tribe stats, income, and the
 * Crisis deck. These tests fail if the shipped data drifts away from it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CRISIS_CARDS, TRIBES, TRIBE_BY_ID } from './gameData';
import type { TribeId } from '../engine/types';

const CSV_DIR = join(process.cwd(), 'csv');

/** Minimal RFC-4180 reader: handles quoted fields containing commas. */
function readCsv(name: string): Array<Record<string, string>> {
  const text = readFileSync(join(CSV_DIR, name), 'utf8').replace(/\r\n/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!header) throw new Error(`${name} is empty`);
  return body.map((r) =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])),
  );
}

describe('starting_resources.csv', () => {
  const rows = readCsv('starting_resources.csv');

  it('covers exactly the tribes the game ships', () => {
    expect(rows.map((r) => r.Tribe).sort()).toEqual(TRIBES.map((t) => t.id).sort());
  });

  it.each(readCsv('starting_resources.csv'))(
    'matches the printed values for $Tribe',
    (row) => {
      const def = TRIBE_BY_ID[row.Tribe as TribeId];
      expect(def.faith).toBe(Number(row.Faith));
      expect(def.warriors).toBe(Number(row.Warriors));
      expect(def.goods).toBe(Number(row.Goods));
      expect(def.loyalty).toBe(Number(row.Loyalty));
    },
  );

  it('starts every tribe on 0 Glory', () => {
    for (const row of rows) expect(Number(row['Starting Glory'])).toBe(0);
  });
});

describe('tribes_overview.csv', () => {
  it.each(readCsv('tribes_overview.csv'))(
    'agrees with starting_resources.csv for $Tribe',
    (row) => {
      const def = TRIBE_BY_ID[row.Tribe as TribeId];
      expect(def.faith).toBe(Number(row.Faith));
      expect(def.warriors).toBe(Number(row.Warriors));
      expect(def.goods).toBe(Number(row.Goods));
      expect(def.loyalty).toBe(Number(row.Loyalty));
    },
  );
});

describe('unique_actions.csv', () => {
  it.each(readCsv('unique_actions.csv'))(
    'matches the unique action name and cost for $Tribe',
    (row) => {
      const def = TRIBE_BY_ID[row.Tribe as TribeId];
      expect(def.uniqueName).toBe(row['Unique Action Name']);
      expect(def.uniqueCost.toLowerCase()).toBe(
        row.Cost === 'None (action)' ? 'action' : row.Cost.toLowerCase(),
      );
    },
  );
});

describe('tribe_income.csv', () => {
  const rows = readCsv('tribe_income.csv');

  it('covers every tribe', () => {
    expect(rows.map((r) => r.Tribe).sort()).toEqual(TRIBES.map((t) => t.id).sort());
  });

  it.each(readCsv('tribe_income.csv'))('matches the income for $Tribe', (row) => {
    const inc = TRIBE_BY_ID[row.Tribe as TribeId].income;
    expect(inc.faith ?? 0).toBe(Number(row.Faith));
    expect(inc.warriors ?? 0).toBe(Number(row.Warriors));
    expect(inc.goods ?? 0).toBe(Number(row.Goods));
    expect(inc.loyalty ?? 0).toBe(Number(row.Loyalty));
    expect(inc.label).toBe(row['Income Line']);
    expect(inc.note).toBe(row.Theme);
  });
});

describe('crisis_cards.csv', () => {
  const rows = readCsv('crisis_cards.csv');

  it('ships all 14 cards with matching ids', () => {
    expect(CRISIS_CARDS).toHaveLength(14);
    expect(CRISIS_CARDS.map((c) => c.id)).toEqual(rows.map((r) => Number(r['Card Number'])));
  });

  it.each(readCsv('crisis_cards.csv'))(
    'matches name, severity, and quoted flavour for $Name',
    (row) => {
      const card = CRISIS_CARDS.find((c) => c.id === Number(row['Card Number']));
      expect(card).toBeDefined();
      expect(card!.name).toBe(row.Name);
      expect(card!.severity).toBe(row.Severity);
      // Flavour lines are scripture quotations — they must not be reworded.
      expect(card!.flavor).toBe(row['Flavor Text']);
    },
  );
});

describe('leader_progressions.csv', () => {
  const rows = readCsv('leader_progressions.csv');

  it('covers every tribe', () => {
    expect(rows.map((r) => r.Tribe).sort()).toEqual(TRIBES.map((t) => t.id).sort());
  });

  it('gives every tribe exactly three upgrades in both sources', () => {
    for (const row of rows) {
      expect(row['Upgrade 1']).not.toBe('');
      expect(row['Upgrade 2']).not.toBe('');
      expect(row['Upgrade 3']).not.toBe('');
      const def = TRIBE_BY_ID[row.Tribe as TribeId];
      expect(def.upgrades).toHaveLength(3);
      expect(def.upgrades.every((u) => u.length > 0)).toBe(true);
    }
  });
});

describe('tribe definitions', () => {
  it('has no duplicate ids or colours', () => {
    const ids = TRIBES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const colors = TRIBES.map((t) => t.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('gives every tribe a track affinity', () => {
    for (const t of TRIBES) {
      expect(['military', 'moral', 'provision']).toContain(t.bias);
    }
  });
});
