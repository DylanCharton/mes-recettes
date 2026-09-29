import {
  formatQuantity,
  LIMITS,
  matchUnit,
  RecipeInputSchema,
  type ImportStrategy,
  type IngredientInput,
  type Nutrition,
  type RecipeDraft,
} from '@mes-recettes/shared';
import { cleanText } from '../../lib/text';
import { extractPage, findSchemaOrgRecipe } from '../html';
import { mapSchemaOrgRecipe, pickImage } from '../schemaOrg/mapper';
import { buildSuggestions } from '../suggestions';
import { parseFailed, type ImportResult, type RecipeImporter } from '../types';
import { readJowRecipe, type JowConstituent, type JowRecipe } from './nextData';

const PAGE_HOSTS = ['jow.fr', 'www.jow.fr'];
// /fr/recipes/poulet-au-curry-89y06dxjhfua0twu16x5, /recipes/89y06dxjhfua0twu16x5/print…
const RECIPE_PATH =
  /^\/(?:[a-z]{2}\/)?recipes\/(?:([a-z0-9-]+)-)?([a-z0-9]{16,24})(?:\/print)?\/?$/;
// Lien partagé par l'app Jow : https://app.jow.com/EC0U?action=recipe&recipeId=69f86dad46828277dd71568b
// jow.fr/fr/recipes/<recipeId> redirige (308) vers la fiche : app.jow.com n'est jamais téléchargé.
const SHARE_HOSTS = ['app.jow.com'];
const SHARE_RECIPE_ID = /^[a-z0-9]{16,24}$/;

/** Identifiant de recette d'un lien de partage de l'app Jow, sinon null. */
function shareRecipeId(url: URL): string | null {
  if (!SHARE_HOSTS.includes(url.hostname)) return null;
  const action = url.searchParams.get('action');
  const id = url.searchParams.get('recipeId')?.toLowerCase() ?? '';
  return (action === null || action === 'recipe') && SHARE_RECIPE_ID.test(id) ? id : null;
}

const NUTRIENTS: Record<string, keyof Nutrition> = {
  ENERC: 'kcal',
  FAT: 'fat',
  CHOAVL: 'carbs',
  PRO: 'protein',
  FIBTG: 'fiber',
  SUGAR: 'sugar',
  NACL: 'salt',
};

const round = (value: number) => Math.round(value * 1e6) / 1e6;

/** Unité Jow (« Kilogramme », « Cuillère à café »…) → unité canonique et facteur. */
export function convertJowUnit(unit: JowConstituent['unit']): {
  unit: string | null;
  factor: number;
} {
  if (!unit) return { unit: null, factor: 1 };
  const name = unit.name.trim();
  const match = matchUnit(name);
  if (match && match.length === name.length) return { unit: match.unit, factor: match.factor };

  // Unité inconnue (« Noisette ») : nom français en minuscules, sans conversion. Les abréviations
  // Jow sont parfois en anglais (« dab »), on ne s'en sert qu'en dernier recours.
  const label = name || unit.abbreviations?.map((a) => a.label.trim()).find(Boolean) || '';
  return { unit: label.toLowerCase().slice(0, 30) || null, factor: 1 };
}

function toIngredient(
  constituent: JowConstituent,
  covers: number,
  isPantry: boolean,
): IngredientInput | null {
  const name = cleanText(
    constituent.name ?? constituent.ingredient?.name,
    LIMITS.ingredientText - 30,
  );
  if (!name) return null;

  const { unit, factor } = convertJowUnit(constituent.unit);
  const perCover = constituent.quantityPerCover ?? 0;
  const quantity = perCover > 0 ? round(perCover * covers * factor) : null;

  return {
    text: quantity === null ? name : `${formatQuantity(quantity, unit)} ${name}`,
    name,
    quantity,
    unit: quantity === null ? null : unit,
    isOptional: constituent.isOptional ?? false,
    isPantry,
  };
}

function toNutrition(recipe: JowRecipe): Nutrition | null {
  const entries = (recipe.nutritionalFacts ?? [])
    .filter((fact) => NUTRIENTS[fact.id] && fact.amount >= 0)
    .map((fact) => [NUTRIENTS[fact.id]!, fact.amount] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

const score = (recipe: JowRecipe, id: string) =>
  cleanText(recipe.nutritionalRatingScores?.find((s) => s.id === id)?.score, 3);

const minutes = (value: number | null | undefined) =>
  typeof value === 'number' && value >= 0 && value <= 24 * 60 ? Math.round(value) : null;

/** Image `1024x768` en JPEG si elle existe (bon compromis poids/qualité), sinon la première. */
function preferredImage(images: unknown): string | null {
  const list = Array.isArray(images) ? images : [images];
  const preferred = list.find(
    (url): url is string => typeof url === 'string' && /\/1024x768\/.+\.jpe?g$/i.test(url),
  );
  return preferred ?? pickImage(images);
}

export class JowImporter implements RecipeImporter {
  readonly source = 'jow' as const;
  readonly pageHosts = PAGE_HOSTS;
  readonly imageHosts = ['static.jow.fr'];

  canHandle(url: URL): boolean {
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (shareRecipeId(url)) return true;
    return PAGE_HOSTS.includes(url.hostname) && RECIPE_PATH.test(url.pathname.toLowerCase());
  }

  identify(url: URL) {
    const shareId = shareRecipeId(url);
    if (shareId) {
      // L'identifiant public (celui de la fiche) n'est connu qu'après la redirection :
      // le doublon est alors vérifié sur le brouillon (services/imports.ts).
      return {
        fetchUrl: `https://jow.fr/fr/recipes/${shareId}`,
        canonicalUrl: `https://jow.fr/recipes/${shareId}`,
        externalId: null,
      };
    }
    const match = RECIPE_PATH.exec(url.pathname.toLowerCase());
    if (!match) throw new Error(`URL Jow non reconnue : ${url.pathname}`);
    const [, slug, id] = match;
    const path = slug ? `${slug}-${id}` : id!;
    return {
      // Préfixe /fr/ : garantit le contenu en français quel que soit le lien partagé.
      fetchUrl: `https://jow.fr/fr/recipes/${path}`,
      canonicalUrl: `https://jow.fr/recipes/${path}`,
      externalId: id!,
    };
  }

  parse(html: string, url: URL): ImportResult {
    const page = extractPage(html);
    const { canonicalUrl, externalId } = this.identify(url);
    const canonical =
      page.canonical && this.canHandle(new URL(page.canonical, url))
        ? page.canonical
        : canonicalUrl;

    const strategies: ImportStrategy[] = [];
    const warnings: string[] = [];

    const schemaRecipe = findSchemaOrgRecipe(page.jsonLd);
    const base = schemaRecipe ? mapSchemaOrgRecipe(schemaRecipe) : undefined;
    if (base) strategies.push('json_ld');

    const jow = readJowRecipe(page.nextData);
    if (jow.ok) strategies.push('next_data');

    if (!base && !jow.ok) {
      throw parseFailed({
        title:
          cleanText(
            page.openGraph.title?.replace(/^Recette\s*:\s*|\s*\|\s*Jow$/g, ''),
            LIMITS.title,
          ) ?? undefined,
        imageUrl: page.openGraph.image,
        sourceUrl: canonical,
      });
    }
    if (!jow.ok) {
      warnings.push(
        'Import partiel : quantités exactes, ingrédients « à avoir chez soi », ustensiles et Nutri-Score non récupérés.',
      );
    }

    const { keywords: baseKeywords, ...baseDraft } = base ?? { keywords: [] };
    let draft: RecipeDraft = {
      servings: 2,
      ingredients: [],
      steps: [],
      ...baseDraft,
      title: base?.title ?? '',
      imageSourceUrl: preferredImage(schemaRecipe?.image) ?? page.openGraph.image ?? null,
      source: 'jow',
      sourceUrl: canonical,
      externalId,
      sourcePayload: jow.ok ? jow.recipe : schemaRecipe,
    };

    if (jow.ok) {
      const { recipe } = jow;
      const covers = recipe.coversCount;
      const prepMinutes = minutes(recipe.preparationTime) ?? draft.prepMinutes ?? null;
      const cookMinutes = minutes(recipe.cookingTime) ?? draft.cookMinutes ?? null;

      draft = {
        ...draft,
        title: cleanText(recipe.title, LIMITS.title) ?? draft.title,
        description: cleanText(recipe.description, LIMITS.description) ?? draft.description ?? null,
        servings: covers,
        prepMinutes,
        cookMinutes,
        totalMinutes:
          draft.totalMinutes ??
          (prepMinutes !== null || cookMinutes !== null
            ? (prepMinutes ?? 0) + (cookMinutes ?? 0)
            : null),
        difficulty: [1, 2, 3].includes(recipe.difficulty ?? 0)
          ? (recipe.difficulty as 1 | 2 | 3)
          : null,
        ingredients: [
          ...recipe.constituents.map((c) => toIngredient(c, covers, false)),
          ...(recipe.additionalConstituents ?? []).map((c) => toIngredient(c, covers, true)),
        ]
          .filter((line): line is IngredientInput => line !== null)
          .slice(0, LIMITS.ingredients),
        steps: (recipe.directions ?? [])
          .map((step) => cleanText(step.label, LIMITS.stepText))
          .filter((text): text is string => text !== null)
          .slice(0, LIMITS.steps),
        tools: (recipe.requiredTools ?? [])
          .map((tool) => cleanText(tool.name, LIMITS.tool))
          .filter((name): name is string => name !== null)
          .slice(0, LIMITS.tools),
        nutrition: toNutrition(recipe) ?? draft.nutrition ?? null,
        nutriScore: score(recipe, 'nutriscore'),
        greenScore: score(recipe, 'greenscore'),
        cuisine: draft.cuisine ?? cleanText(recipe.origin?.name, 80),
      };
    }

    if (!page.openGraph.image && !draft.imageSourceUrl) warnings.push('Aucune image trouvée.');
    if (!draft.imageSourceUrl && page.openGraph.image) draft.imageSourceUrl = page.openGraph.image;
    if (draft.imageSourceUrl && !draft.imageSourceUrl.startsWith('https://'))
      draft.imageSourceUrl = null;

    // Dernier garde-fou : un brouillon doit toujours être enregistrable tel quel.
    if (!RecipeInputSchema.safeParse(draft).success) {
      throw parseFailed({ title: draft.title || undefined, sourceUrl: canonical });
    }

    const suggestions = buildSuggestions({
      cuisine: draft.cuisine,
      totalMinutes: draft.totalMinutes,
      vegetarian: jow.ok ? (jow.recipe.eatingHabitsCompatibility?.vegetarian ?? false) : false,
      vegan: jow.ok ? (jow.recipe.eatingHabitsCompatibility?.vegan ?? false) : false,
      keywords: [...baseKeywords, ...(jow.ok ? (jow.recipe.keywords ?? []) : [])],
    });

    return { draft, strategies, warnings, suggestions };
  }
}
