/**
 * Unités canoniques. Masses stockées en grammes, volumes en millilitres (spec § 12.3) :
 * « 0,5 kg » et « 300 g » deviennent comparables sans table de conversion.
 */
export const UNITS = [
  'g',
  'ml',
  'piece',
  'tbsp',
  'tsp',
  'pinch',
  'bunch',
  'clove',
  'slice',
  'can',
  'pack',
  'sprig',
  'leaf',
] as const;

export type Unit = (typeof UNITS)[number];

type UnitAlias = { unit: Unit; factor: number; aliases: string[] };

/**
 * Alias écrits sans accents, en minuscules. Dans un alias :
 * une espace = espaces facultatifs, un point = point facultatif.
 * Les pluriels (s/x final) sont acceptés automatiquement.
 */
const UNIT_ALIASES: UnitAlias[] = [
  { unit: 'g', factor: 1000, aliases: ['kg', 'kilo', 'kilogramme'] },
  { unit: 'g', factor: 1, aliases: ['g', 'gr', 'gramme'] },
  { unit: 'g', factor: 0.001, aliases: ['mg', 'milligramme'] },
  { unit: 'ml', factor: 1000, aliases: ['l', 'litre'] },
  { unit: 'ml', factor: 100, aliases: ['dl', 'decilitre'] },
  { unit: 'ml', factor: 10, aliases: ['cl', 'centilitre'] },
  { unit: 'ml', factor: 1, aliases: ['ml', 'millilitre'] },
  {
    unit: 'tbsp',
    factor: 1,
    aliases: [
      'cuillere a soupe',
      'cuilleres a soupe',
      'cuil. a soupe',
      'c. a soupe',
      'c. a s.',
      'cs',
    ],
  },
  {
    unit: 'tsp',
    factor: 1,
    aliases: ['cuillere a cafe', 'cuilleres a cafe', 'cuil. a cafe', 'c. a cafe', 'c. a c.', 'cc'],
  },
  { unit: 'pinch', factor: 1, aliases: ['pincee'] },
  { unit: 'bunch', factor: 1, aliases: ['bouquet', 'bou.'] },
  { unit: 'clove', factor: 1, aliases: ['gousse'] },
  { unit: 'slice', factor: 1, aliases: ['tranche'] },
  { unit: 'can', factor: 1, aliases: ['boite', 'conserve'] },
  { unit: 'pack', factor: 1, aliases: ['sachet', 'paquet'] },
  { unit: 'sprig', factor: 1, aliases: ['brin'] },
  { unit: 'leaf', factor: 1, aliases: ['feuille'] },
  { unit: 'piece', factor: 1, aliases: ['piece', 'pc', 'pcs'] },
];

const ACCENT_CLASSES: Record<string, string> = {
  a: '[aàâä]',
  c: '[cç]',
  e: '[eéèêë]',
  i: '[iîï]',
  o: '[oôö]',
  u: '[uùûü]',
};

function aliasToPattern(alias: string): string {
  let pattern = '';
  for (const char of alias) {
    if (char === ' ') pattern += '\\s*';
    else if (char === '.') pattern += '\\.?';
    else pattern += ACCENT_CLASSES[char] ?? char;
  }
  // Pluriel automatique pour les mots (« gousses », « feuilles », « boîtes »).
  return /[a-z]{3,}$/.test(alias) ? `${pattern}(?:s|x)?` : pattern;
}

type CompiledAlias = { unit: Unit; factor: number; regex: RegExp };

// Alias les plus longs d'abord : « cuillère à soupe » avant « cs ».
// L'unité ne doit pas être suivie d'une lettre (« 2 clous » ≠ « 2 cl »).
const COMPILED: CompiledAlias[] = UNIT_ALIASES.flatMap(({ unit, factor, aliases }) =>
  aliases.map((alias) => ({ unit, factor, alias })),
)
  .sort((a, b) => b.alias.length - a.alias.length)
  .map(({ unit, factor, alias }) => ({
    unit,
    factor,
    regex: new RegExp(`^(?:${aliasToPattern(alias)})(?!\\p{L})`, 'iu'),
  }));

/** Cherche une unité en tête de `text`. Renvoie la longueur consommée. */
export function matchUnit(text: string): { unit: Unit; factor: number; length: number } | null {
  for (const { unit, factor, regex } of COMPILED) {
    const match = regex.exec(text);
    if (match) return { unit, factor, length: match[0].length };
  }
  return null;
}

const UNIT_LABELS: Record<Unit, [singular: string, plural: string]> = {
  g: ['g', 'g'],
  ml: ['ml', 'ml'],
  piece: ['', ''],
  tbsp: ['c. à soupe', 'c. à soupe'],
  tsp: ['c. à café', 'c. à café'],
  pinch: ['pincée', 'pincées'],
  bunch: ['bouquet', 'bouquets'],
  clove: ['gousse', 'gousses'],
  slice: ['tranche', 'tranches'],
  can: ['boîte', 'boîtes'],
  pack: ['sachet', 'sachets'],
  sprig: ['brin', 'brins'],
  leaf: ['feuille', 'feuilles'],
};

export function isKnownUnit(unit: string): unit is Unit {
  return (UNITS as readonly string[]).includes(unit);
}

/** Libellé d'affichage ; une unité inconnue (libellé brut importé) est affichée telle quelle. */
export function unitLabel(unit: string | null, quantity: number): string {
  if (!unit) return '';
  if (!isKnownUnit(unit)) return unit;
  const [singular, plural] = UNIT_LABELS[unit];
  // En français, le pluriel commence à 2 : « 1,5 bouquet ».
  return quantity >= 2 ? plural : singular;
}
