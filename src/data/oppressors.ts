import type { OppressorDef, OppressorId } from '../engine/types';

/**
 * The six major oppressions of the Book of Judges, in the order the text gives
 * them. Each attacks the track its biblical account attacks, and each is broken
 * by the judge the text names.
 *
 * These replace the Crisis card while they are in play: an Oppressor is not a
 * one-round modifier but a standing condition that worsens until Israel cries
 * out, which is the pattern set out in Judges 2:11-19.
 */
export const OPPRESSORS: OppressorDef[] = [
  {
    id: 'aram',
    name: 'Cushan-Rishathaim',
    title: 'Cushan-Rishathaim of Aram',
    flavor: 'So the anger of the Lord was hot against Israel, and he sold them into the hand of Cushan-Rishathaim.',
    reference: 'Judges 3:8',
    attacks: 'moral',
    deliverer: 'Othniel',
    judgePower: 'Othniel’s Zeal — once, treat your Moral Banners as +2 Influence.',
  },
  {
    id: 'moab',
    name: 'Eglon of Moab',
    title: 'Eglon, King of Moab',
    flavor: 'And the people of Israel served Eglon the king of Moab eighteen years.',
    reference: 'Judges 3:14',
    attacks: 'provision',
    deliverer: 'Ehud',
    judgePower: 'Ehud’s Hidden Dagger — once, remove 1 Influence from another player before reveal.',
  },
  {
    id: 'hazor',
    name: 'Jabin & Sisera',
    title: 'Jabin of Hazor and Sisera his commander',
    flavor: 'He had nine hundred chariots of iron and he oppressed the people of Israel cruelly for twenty years.',
    reference: 'Judges 4:3',
    attacks: 'military',
    deliverer: 'Deborah & Barak',
    judgePower: 'Deborah’s Summons — once, give every player 1 temporary Influence on a track you name.',
  },
  {
    id: 'midian',
    name: 'Midian',
    title: 'The Hand of Midian',
    flavor: 'They would encamp against them and destroy the produce of the earth, and leave no sustenance in Israel.',
    reference: 'Judges 6:4',
    attacks: 'provision',
    deliverer: 'Gideon',
    judgePower: 'Gideon’s Three Hundred — once, win a track outright with the fewest Banners on it.',
  },
  {
    id: 'ammon',
    name: 'Ammon',
    title: 'The Ammonite Oppression',
    flavor: 'They crushed and oppressed the people of Israel that year… eighteen years.',
    reference: 'Judges 10:8',
    attacks: 'military',
    deliverer: 'Jephthah',
    judgePower: 'Jephthah’s Vow — once, forfeit your largest single store of Faith, Warriors or Goods, and gain 3 Glory.',
  },
  {
    id: 'philistia',
    name: 'The Philistines',
    title: 'The Philistine Yoke',
    flavor: 'So the Lord gave them into the hand of the Philistines for forty years.',
    reference: 'Judges 13:1',
    attacks: 'military',
    deliverer: 'Samson',
    judgePower: 'Samson’s Strength — once, double your Banner Influence on a single track.',
  },
];

export const OPPRESSOR_BY_ID: Record<OppressorId, OppressorDef> = Object.fromEntries(
  OPPRESSORS.map((o) => [o.id, o]),
) as Record<OppressorId, OppressorDef>;
