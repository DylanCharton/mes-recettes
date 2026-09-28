import { parse, type HTMLElement } from 'node-html-parser';

export type JsonObject = Record<string, unknown>;

export type ExtractedPage = {
  jsonLd: JsonObject[];
  nextData: unknown;
  openGraph: { title?: string; description?: string; image?: string; url?: string };
  canonical?: string;
};

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Aplati les formes usuelles : objet, tableau, `@graph`. */
function flattenJsonLd(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!isObject(value)) return [];
  const graph = value['@graph'];
  return [value, ...(Array.isArray(graph) ? graph.flatMap(flattenJsonLd) : [])];
}

function meta(root: HTMLElement, property: string): string | undefined {
  const element =
    root.querySelector(`meta[property="${property}"]`) ??
    root.querySelector(`meta[name="${property}"]`);
  return element?.getAttribute('content')?.trim() || undefined;
}

/**
 * Lit uniquement les données structurées d'une page (spec § 16.1) : JSON-LD, état Next.js,
 * OpenGraph et URL canonique. Aucun script n'est exécuté ; un bloc JSON invalide est ignoré.
 */
export function extractPage(html: string): ExtractedPage {
  const root = parse(html, { blockTextElements: { script: true, style: false } });

  const jsonLd = root
    .querySelectorAll('script[type="application/ld+json"]')
    .flatMap((script) => flattenJsonLd(parseJson(script.rawText)));

  const nextDataScript = root.querySelector('script#__NEXT_DATA__');

  return {
    jsonLd,
    nextData: nextDataScript ? parseJson(nextDataScript.rawText) : undefined,
    openGraph: {
      title: meta(root, 'og:title'),
      description: meta(root, 'og:description'),
      image: meta(root, 'og:image'),
      url: meta(root, 'og:url'),
    },
    canonical: root.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? undefined,
  };
}

export function findSchemaOrgRecipe(jsonLd: JsonObject[]): JsonObject | undefined {
  return jsonLd.find((item) => {
    const type = item['@type'];
    return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
  });
}
