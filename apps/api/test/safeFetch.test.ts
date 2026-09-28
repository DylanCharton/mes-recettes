import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/lib/errors';
import { safeFetch, type FetchFn, type SafeFetchOptions } from '../src/lib/safeFetch';

const options: SafeFetchOptions = { allowedHosts: ['jow.fr'], expect: 'html', maxBytes: 1000 };

const html = (body = '<html></html>', headers: Record<string, string> = {}) =>
  new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof AppError) return err.code;
    throw err;
  }
  throw new Error('aucune erreur levée');
}

describe('safeFetch', () => {
  it('renvoie le corps d’une page autorisée', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => html('<p>ok</p>'));
    const result = await safeFetch('https://jow.fr/recipes/x', options, fetchFn);
    expect(new TextDecoder().decode(result.body)).toBe('<p>ok</p>');
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual', credentials: 'omit' });
  });

  it('refuse sans requête un hôte hors liste, http, un port ou des identifiants', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => html());
    for (const url of [
      'https://evil.com/recipes/x',
      'https://jow.fr.evil.com/recipes/x',
      'http://jow.fr/recipes/x',
      'https://jow.fr:8443/recipes/x',
      'https://user:pass@jow.fr/recipes/x',
    ]) {
      expect(await codeOf(safeFetch(url, options, fetchFn))).toBe('UNSUPPORTED_URL');
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('suit une redirection autorisée (http réécrit en https)', async () => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(redirect('http://jow.fr/fr/recipes/x'))
      .mockResolvedValueOnce(html());
    const result = await safeFetch('https://jow.fr/recipes/x', options, fetchFn);
    expect(result.url).toBe('https://jow.fr/fr/recipes/x');
  });

  it('refuse une redirection vers un hôte non autorisé (CA-F15)', async () => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(redirect('https://169.254.169.254/latest'));
    expect(await codeOf(safeFetch('https://jow.fr/recipes/x', options, fetchFn))).toBe(
      'SOURCE_UNREACHABLE',
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('limite le nombre de redirections', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => redirect('https://jow.fr/boucle'));
    expect(await codeOf(safeFetch('https://jow.fr/recipes/x', options, fetchFn))).toBe(
      'SOURCE_UNREACHABLE',
    );
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('interrompt une réponse trop volumineuse, même sans Content-Length (CA-F15)', async () => {
    const big = 'x'.repeat(1001);
    expect(await codeOf(safeFetch('https://jow.fr/a', options, async () => html(big)))).toBe(
      'SOURCE_UNREACHABLE',
    );
    const declared = async () => html('petit', { 'content-length': '5000' });
    expect(await codeOf(safeFetch('https://jow.fr/a', options, declared))).toBe(
      'SOURCE_UNREACHABLE',
    );
  });

  it('vérifie le type de contenu', async () => {
    const json = async () =>
      new Response('{}', { headers: { 'content-type': 'application/json' } });
    expect(await codeOf(safeFetch('https://jow.fr/a', options, json))).toBe('SOURCE_UNREACHABLE');
  });

  it('signale une erreur HTTP de la source', async () => {
    const notFound = async () => new Response('', { status: 503 });
    expect(await codeOf(safeFetch('https://jow.fr/a', options, notFound))).toBe(
      'SOURCE_UNREACHABLE',
    );
  });

  it('abandonne après le délai maximal', async () => {
    const hanging: FetchFn = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    expect(
      await codeOf(safeFetch('https://jow.fr/a', { ...options, timeoutMs: 20 }, hanging)),
    ).toBe('SOURCE_TIMEOUT');
  });
});
