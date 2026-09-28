import { LIMITS, type Nutrition, type RecipeDraft } from '@mes-recettes/shared';
import { cleanText } from '../../lib/text';
import type { JsonObject } from '../html';

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] =>
  value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];

/** Durée ISO 8601 (`PT1H15M`, `P0DT20M`) → minutes ; `null` si absente ou invalide. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(value.trim());
  if (!match) return null;
  const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = match;
  const total =
    Number(days) * 1440 + Number(hours) * 60 + Number(minutes) + Math.round(Number(seconds) / 60);
  return total > 0 && total <= 24 * 60 ? total : null;
}

/** `recipeYield` : 4, "4", "4 personnes", ["4", "poulets rôtis"]. */
export function parseYield(value: unknown): { servings: number | null; label: string | null } {
  const items = asArray(value)
    .map((item) => String(item).trim())
    .filter(Boolean);
  for (const [index, item] of items.entries()) {
    const match = /^(\d+)\s*(.*)$/.exec(item);
    const servings = match ? Number(match[1]) : NaN;
    if (Number.isInteger(servings) && servings >= 1 && servings <= 100) {
      const label = cleanText(match?.[2] || items[index + 1], 80);
      return { servings, label };
    }
  }
  return { servings: null, label: null };
}

/** Chaîne unique, tableau de chaînes, `HowToStep`, `HowToSection` (aplatie). */
export function parseInstructions(value: unknown): string[] {
  const steps: string[] = [];
  const visit = (item: unknown, prefix?: string) => {
    if (typeof item === 'string') {
      item
        .split(/\n+/)
        .map((line) => cleanText(line, LIMITS.stepText))
        .forEach((line) => line && steps.push(line));
      return;
    }
    if (!isObject(item)) return;
    if (item['@type'] === 'HowToSection' || Array.isArray(item.itemListElement)) {
      const name = cleanText(item.name, 100) ?? undefined;
      asArray(item.itemListElement).forEach((child, index) =>
        visit(child, index === 0 ? name : undefined),
      );
      return;
    }
    const text = cleanText(item.text ?? item.name, LIMITS.stepText);
    if (text) steps.push(prefix ? `${prefix} : ${text}` : text);
  };
  asArray(value).forEach((item) => visit(item));
  return steps.slice(0, LIMITS.steps);
}

/** « 468 kcal », « 8 g », 12 → nombre ; `undefined` sinon. */
function parseAmount(value: unknown): number | undefined {
  const match = /(\d+(?:[.,]\d+)?)/.exec(String(value ?? ''));
  const amount = match ? Number(match[1]!.replace(',', '.')) : NaN;
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

function parseNutrition(value: unknown): Nutrition | null {
  if (!isObject(value)) return null;
  const nutrition: Nutrition = {
    kcal: parseAmount(value.calories),
    fat: parseAmount(value.fatContent),
    carbs: parseAmount(value.carbohydrateContent),
    protein: parseAmount(value.proteinContent),
    fiber: parseAmount(value.fiberContent),
    sugar: parseAmount(value.sugarContent),
  };
  const defined = Object.fromEntries(Object.entries(nutrition).filter(([, v]) => v !== undefined));
  return Object.keys(defined).length > 0 ? defined : null;
}

export function pickImage(value: unknown): string | null {
  const urls = asArray(value)
    .map((item) => (isObject(item) ? item.url : item))
    .filter((url): url is string => typeof url === 'string' && url.startsWith('https://'));
  return urls[0] ?? null;
}

function parseNames(value: unknown, max: number): string[] {
  return asArray(value)
    .map((item) => cleanText(isObject(item) ? item.name : item, max))
    .filter((name): name is string => name !== null);
}

export type SchemaOrgDraft = Omit<RecipeDraft, 'title'> & {
  title: string | null;
  keywords: string[];
};

/** `Recipe` schema.org → brouillon (spec § 16.2). Réutilisé par tous les importeurs. */
export function mapSchemaOrgRecipe(recipe: JsonObject): SchemaOrgDraft {
  const { servings, label } = parseYield(recipe.recipeYield);
  const prepMinutes = parseIsoDuration(recipe.prepTime);
  const cookMinutes = parseIsoDuration(recipe.cookTime);
  const keywords =
    typeof recipe.keywords === 'string'
      ? recipe.keywords.split(',')
      : asArray(recipe.keywords).map(String);

  return {
    title: cleanText(recipe.name, LIMITS.title),
    description: cleanText(recipe.description, LIMITS.description),
    servings: servings ?? 2,
    servingsLabel: label,
    prepMinutes,
    cookMinutes,
    totalMinutes: parseIsoDuration(recipe.totalTime),
    ingredients: asArray(recipe.recipeIngredient)
      .map((line) => cleanText(line, LIMITS.ingredientText))
      .filter((text): text is string => text !== null)
      .slice(0, LIMITS.ingredients)
      .map((text) => ({ text })),
    steps: parseInstructions(recipe.recipeInstructions),
    tools: parseNames(recipe.tool, LIMITS.tool).slice(0, LIMITS.tools),
    nutrition: parseNutrition(recipe.nutrition),
    cuisine: parseNames(recipe.recipeCuisine, 80)[0] ?? null,
    imageSourceUrl: pickImage(recipe.image),
    keywords: keywords.map((keyword) => keyword.trim()).filter(Boolean),
  };
}
