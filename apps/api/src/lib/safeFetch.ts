import { AppError } from './errors';

export type FetchFn = typeof fetch;

export type SafeFetchOptions = {
  /** Hôtes autorisés (comparaison exacte), y compris pour chaque redirection. */
  allowedHosts: readonly string[];
  /** Type de contenu attendu : page HTML ou image. */
  expect: 'html' | 'image';
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
};

export type SafeFetchResult = { url: string; contentType: string; body: Uint8Array };

const USER_AGENT = 'MesRecettes/1.0 (bibliotheque personnelle; import manuel)';
const EXPECTED_TYPES = {
  html: /^(?:text\/html|application\/xhtml\+xml)\b/i,
  image: /^image\//i,
};

export function assertAllowedUrl(url: URL, allowedHosts: readonly string[]) {
  if (url.protocol !== 'https:' || (url.port && url.port !== '443')) {
    throw new AppError('UNSUPPORTED_URL', 422, 'Seuls les liens https sont acceptés');
  }
  if (url.username || url.password || !allowedHosts.includes(url.hostname)) {
    throw new AppError('UNSUPPORTED_URL', 422, 'Ce site n’est pas pris en charge');
  }
}

async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes) throw tooLarge();
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

const tooLarge = () =>
  new AppError('SOURCE_UNREACHABLE', 502, 'La réponse du site est trop volumineuse');

/**
 * Requête sortante sécurisée contre la SSRF (spec § 18.1) : https uniquement, liste blanche
 * d'hôtes revalidée à chaque redirection (suivies manuellement), délai et taille bornés,
 * type de contenu vérifié, aucun cookie ni identifiant transmis.
 */
export async function safeFetch(
  input: string | URL,
  options: SafeFetchOptions,
  fetchFn: FetchFn = fetch,
): Promise<SafeFetchResult> {
  const { allowedHosts, expect, maxBytes, timeoutMs = 10_000, maxRedirects = 3 } = options;
  const signal = AbortSignal.timeout(timeoutMs);
  let url = new URL(input);

  for (let redirects = 0; ; redirects++) {
    assertAllowedUrl(url, allowedHosts);

    let response: Response;
    try {
      response = await fetchFn(url, {
        redirect: 'manual',
        credentials: 'omit',
        signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: expect === 'html' ? 'text/html' : 'image/*',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
      });
    } catch (err) {
      if (signal.aborted)
        throw new AppError('SOURCE_TIMEOUT', 504, 'Le site met trop de temps à répondre');
      throw new AppError('SOURCE_UNREACHABLE', 502, 'Le site est injoignable', {
        cause: String(err),
      });
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new AppError('SOURCE_UNREACHABLE', 502, 'Redirection invalide');
      if (redirects >= maxRedirects) {
        throw new AppError('SOURCE_UNREACHABLE', 502, 'Trop de redirections');
      }
      const next = new URL(location, url);
      if (next.protocol === 'http:' && allowedHosts.includes(next.hostname))
        next.protocol = 'https:';
      try {
        assertAllowedUrl(next, allowedHosts);
      } catch {
        throw new AppError('SOURCE_UNREACHABLE', 502, 'Redirection vers un site non autorisé', {
          location: next.hostname,
        });
      }
      url = next;
      continue;
    }

    if (!response.ok) {
      throw new AppError(
        'SOURCE_UNREACHABLE',
        502,
        `Le site a répondu par une erreur (${response.status})`,
        {
          status: response.status,
        },
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!EXPECTED_TYPES[expect].test(contentType)) {
      throw new AppError('SOURCE_UNREACHABLE', 502, 'Le site n’a pas renvoyé le contenu attendu', {
        contentType,
      });
    }

    try {
      return { url: url.toString(), contentType, body: await readLimited(response, maxBytes) };
    } catch (err) {
      if (signal.aborted)
        throw new AppError('SOURCE_TIMEOUT', 504, 'Le site met trop de temps à répondre');
      throw err;
    }
  }
}
