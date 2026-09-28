import { describe, expect, it } from 'vitest';
import { extractPage, findSchemaOrgRecipe } from '../src/importers/html';
import {
  mapSchemaOrgRecipe,
  parseInstructions,
  parseIsoDuration,
  parseYield,
} from '../src/importers/schemaOrg/mapper';

describe('parseIsoDuration', () => {
  it.each([
    ['PT15M', 15],
    ['PT1H15M', 75],
    ['P0DT20M', 20],
    ['PT2H', 120],
    ['PT90S', 2],
    ['PT0M', null],
    ['15 min', null],
    [undefined, null],
  ])('%s → %s', (value, expected) => {
    expect(parseIsoDuration(value)).toBe(expected);
  });
});

describe('parseYield', () => {
  it.each([
    [4, { servings: 4, label: null }],
    ['6 personnes', { servings: 6, label: 'personnes' }],
    [['4', 'poulets rôtis'], { servings: 4, label: 'poulets rôtis' }],
    ['un gâteau', { servings: null, label: null }],
  ])('%j', (value, expected) => {
    expect(parseYield(value)).toEqual(expected);
  });
});

describe('parseInstructions', () => {
  it('gère chaînes, HowToStep et HowToSection', () => {
    expect(parseInstructions('Étape 1\nÉtape 2')).toEqual(['Étape 1', 'Étape 2']);
    expect(
      parseInstructions([
        { '@type': 'HowToStep', text: 'Préchauffer le four.' },
        {
          '@type': 'HowToSection',
          name: 'Pour la sauce',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Mélanger.' },
            { '@type': 'HowToStep', text: 'Réduire.' },
          ],
        },
      ]),
    ).toEqual(['Préchauffer le four.', 'Pour la sauce : Mélanger.', 'Réduire.']);
  });
});

describe('extractPage / mapSchemaOrgRecipe', () => {
  it('trouve une recette dans un @graph et ignore un bloc JSON invalide', () => {
    const html = `<html><head>
      <script type="application/ld+json">{ invalide </script>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
        {"@type":"WebPage","name":"Page"},
        {"@type":["Recipe"],"name":"Tarte &amp; pommes","recipeYield":"6","totalTime":"PT1H",
         "recipeIngredient":["3 pommes","200 g de farine"],"recipeInstructions":"Mélanger.",
         "image":{"@type":"ImageObject","url":"https://example.com/tarte.jpg"},
         "nutrition":{"calories":"320 kcal","proteinContent":"4,5 g"}}
      ]}</script>
      <meta property="og:title" content="Tarte" />
      <link rel="canonical" href="https://example.com/tarte" />
    </head></html>`;

    const page = extractPage(html);
    expect(page.canonical).toBe('https://example.com/tarte');
    const recipe = findSchemaOrgRecipe(page.jsonLd);
    expect(recipe).toBeDefined();

    expect(mapSchemaOrgRecipe(recipe!)).toMatchObject({
      title: 'Tarte & pommes',
      servings: 6,
      totalMinutes: 60,
      ingredients: [{ text: '3 pommes' }, { text: '200 g de farine' }],
      steps: ['Mélanger.'],
      imageSourceUrl: 'https://example.com/tarte.jpg',
      nutrition: { kcal: 320, protein: 4.5 },
    });
  });
});
