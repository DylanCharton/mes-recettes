import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertJowUnit, JowImporter } from '../src/importers/jow/JowImporter';
import { AppError } from '../src/lib/errors';

const importer = new JowImporter();
const CURRY_URL = new URL('https://jow.fr/fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5');
const ROAST_URL = new URL(
  'https://jow.fr/fr/recipes/poulet-roti-au-miel-et-aux-epices-8uzk9vraelo3jgw70jpx',
);

const fixture = (name: string) =>
  fs.readFileSync(path.join(import.meta.dirname, 'fixtures/jow', `${name}.html`), 'utf8');

const lines = (draft: ReturnType<JowImporter['parse']>['draft']) =>
  draft.ingredients?.map(({ text, quantity, unit, isOptional, isPantry }) => ({
    text,
    quantity,
    unit,
    isOptional,
    isPantry,
  }));

describe('JowImporter.canHandle / identify', () => {
  it.each([
    'https://jow.fr/fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5',
    'https://jow.fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5',
    'https://jow.fr/en/recipes/poulet-au-curry-89y06dxjhfua0twu16x5',
    'https://jow.fr/fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5/print',
    'https://jow.fr/fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5?utm_source=share#step2',
    'https://www.jow.fr/fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5/',
    'http://jow.fr/fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5',
  ])('reconnaît %s avec le même identifiant (CA-F1)', (raw) => {
    const url = new URL(raw);
    expect(importer.canHandle(url)).toBe(true);
    expect(importer.identify(url)).toEqual({
      fetchUrl: 'https://jow.fr/fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5',
      canonicalUrl: 'https://jow.fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5',
      externalId: '89y06dxjhfua0twu16x5',
    });
  });

  it('accepte une URL sans slug', () => {
    const url = new URL('https://jow.fr/fr/recipes/89y06dxjhfua0twu16x5');
    expect(importer.identify(url).externalId).toBe('89y06dxjhfua0twu16x5');
  });

  it.each([
    'https://jow.fr/fr/recipes',
    'https://jow.fr/fr/recipes/poulet-au-curry',
    'https://jow.fr/fr/help?question=x',
    'https://jow.fr.evil.com/fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5',
    'https://evil.com/jow.fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5',
    'https://api.jow.fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5',
    'ftp://jow.fr/fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5',
  ])('refuse %s', (raw) => {
    expect(importer.canHandle(new URL(raw))).toBe(false);
  });
});

describe('convertJowUnit', () => {
  it.each([
    ['Kilogramme', 'g', 1000],
    ['Litre', 'ml', 1000],
    ['Cuillère à soupe', 'tbsp', 1],
    ['Pièce', 'piece', 1],
    ['Pincée', 'pinch', 1],
    ['Noisette', 'noisette', 1],
  ])('%s → %s ×%d', (name, unit, factor) => {
    expect(convertJowUnit({ name, abbreviations: [{ label: 'dab' }] })).toEqual({ unit, factor });
  });
});

describe('JowImporter.parse', () => {
  it('extrait toute la recette « Poulet au curry » (CA-F1)', () => {
    const { draft, strategies, warnings } = importer.parse(
      fixture('poulet-au-curry-89y06dxjhfua0twu16x5'),
      CURRY_URL,
    );

    expect(strategies).toEqual(['json_ld', 'next_data']);
    expect(warnings).toEqual([]);
    expect(draft).toMatchObject({
      title: 'Poulet au curry',
      description: 'Un curry tout doux, tout simple !',
      servings: 1,
      prepMinutes: 4,
      cookMinutes: 11,
      totalMinutes: 15,
      difficulty: 1,
      tools: ['Poêle', 'Plaques de cuisson', 'Casserole'],
      nutrition: { kcal: 468, fat: 8, carbs: 56, protein: 41, fiber: 0.9 },
      nutriScore: 'A',
      greenScore: 'C',
      cuisine: 'Indienne',
      source: 'jow',
      externalId: '89y06dxjhfua0twu16x5',
      sourceUrl: 'https://jow.fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5',
      imageSourceUrl: 'https://static.jow.fr/1024x768/recipes/gR0kkvSrtRIyvQ.jpg',
    });
    expect(lines(draft)).toEqual([
      {
        text: '1 Poulet (escalope)',
        quantity: 1,
        unit: 'piece',
        isOptional: false,
        isPantry: false,
      },
      {
        text: '¼ c. à café Curry (poudre)',
        quantity: 0.25,
        unit: 'tsp',
        isOptional: false,
        isPantry: false,
      },
      {
        text: '2 c. à soupe Lait de coco',
        quantity: 2,
        unit: 'tbsp',
        isOptional: false,
        isPantry: false,
      },
      { text: '70 g Riz', quantity: 70, unit: 'g', isOptional: false, isPantry: false },
      {
        text: '½ bouquet Coriandre (frais)',
        quantity: 0.5,
        unit: 'bunch',
        isOptional: true,
        isPantry: false,
      },
      {
        text: "1 c. à café Huile d'olive",
        quantity: 1,
        unit: 'tsp',
        isOptional: false,
        isPantry: true,
      },
    ]);
    expect(draft.steps).toHaveLength(6);
    expect(draft.steps?.[0]).toMatch(/^Versez le riz/);
  });

  it('multiplie les quantités par portion par le nombre de portions (poulet rôti, 4 portions)', () => {
    const { draft } = importer.parse(
      fixture('poulet-roti-au-miel-et-aux-epices-8uzk9vraelo3jgw70jpx'),
      ROAST_URL,
    );
    expect(draft.servings).toBe(4);
    expect(draft.servingsLabel).toBe('poulets rôtis');
    expect(lines(draft)?.[0]).toMatchObject({
      text: '1 Poulet (entier)',
      quantity: 1,
      unit: 'piece',
    });
    expect(lines(draft)).toContainEqual(
      expect.objectContaining({
        text: '320 g Marrons (cuits en conserve)',
        quantity: 320,
        unit: 'g',
      }),
    );
  });

  it('se replie sur le JSON-LD sans __NEXT_DATA__, avec un avertissement', () => {
    const { draft, strategies, warnings } = importer.parse(
      fixture('degraded-no-next-data'),
      CURRY_URL,
    );
    expect(strategies).toEqual(['json_ld']);
    expect(warnings[0]).toMatch(/Import partiel/);
    expect(draft).toMatchObject({ title: 'Poulet au curry', servings: 1, totalMinutes: 15 });
    expect(draft.nutriScore).toBeUndefined();
    expect(draft.ingredients?.map((line) => line.text)).toContain('70 g Riz');
    expect(draft.ingredients?.every((line) => line.name === undefined)).toBe(true);
    expect(draft.steps).toHaveLength(6);
  });

  it('ignore un __NEXT_DATA__ de structure inattendue sans lever d’exception', () => {
    const { strategies, warnings } = importer.parse(
      fixture('degraded-corrupted-next-data'),
      CURRY_URL,
    );
    expect(strategies).toEqual(['json_ld']);
    expect(warnings).toHaveLength(1);
  });

  it('échoue proprement avec les données OpenGraph quand il n’y a plus de recette', () => {
    try {
      importer.parse(fixture('degraded-open-graph-only'), CURRY_URL);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        code: 'PARSE_FAILED',
        details: {
          partial: {
            title: 'Poulet au curry',
            imageUrl: 'https://static.jow.fr/1200x630/recipes/gR0kkvSrtRIyvQ.jpg',
            sourceUrl: 'https://jow.fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5',
          },
        },
      });
    }
  });

  it('stocke un titre contenant du HTML comme texte brut (CA-F15)', () => {
    const html = fixture('degraded-no-next-data').replace(
      '"name":"Poulet au curry"',
      // Échappé comme dans un vrai JSON-LD (un « </script> » brut fermerait la balise).
      '"name":"\\u003cscript\\u003ealert(1)\\u003c/script\\u003ePoulet \\u003cb\\u003eau\\u003c/b\\u003e curry"',
    );
    const { title } = importer.parse(html, CURRY_URL).draft;
    expect(title).not.toMatch(/[<>]/);
    expect(title).toContain('Poulet au curry');
  });
});

describe('suggestions à l’import', () => {
  it('propose cuisine et « rapide » pour le curry, sans saison', () => {
    const { suggestions } = importer.parse(
      fixture('poulet-au-curry-89y06dxjhfua0twu16x5'),
      CURRY_URL,
    );
    expect(suggestions).toEqual({ tags: ['indien', 'rapide'], seasons: [] });
  });

  it('propose automne et hiver pour le poulet rôti au potimarron (CA-F8b)', () => {
    const { suggestions } = importer.parse(
      fixture('poulet-roti-au-miel-et-aux-epices-8uzk9vraelo3jgw70jpx'),
      ROAST_URL,
    );
    expect(suggestions.seasons).toEqual(['autumn', 'winter']);
    expect(suggestions.tags).not.toContain('rapide');
  });
});
