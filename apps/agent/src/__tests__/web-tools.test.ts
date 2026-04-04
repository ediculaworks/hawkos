import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockValidateURLForSSRF = vi.fn().mockReturnValue({ safe: true });

vi.mock('@hawk/shared', () => ({
  validateURLForSSRF: mockValidateURLForSSRF,
}));

vi.mock('@mozilla/readability', () => ({
  Readability: vi.fn().mockImplementation(() => ({
    parse: () => null,
  })),
}));

vi.mock('linkedom', () => ({
  parseHTML: (html: string) => {
    // Minimal DOM stub sufficient for Turndown fallback path
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');
    return {
      document: {
        querySelectorAll: () => [],
        querySelector: (sel: string) => (sel === 'body' ? { innerHTML: stripped } : null),
      },
    };
  },
}));

import { webTools } from '../tools/web.js';

// ── Helpers ──────────────────────────────────────────────────────────

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function braveResponse(results: { title: string; url: string; description: string }[]) {
  return new Response(JSON.stringify({ web: { results } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function ddgHtmlResponse(results: { title: string; url: string; snippet: string }[]) {
  const blocks = results
    .map(
      (r) =>
        `<div class="result results_links result--more"><a class="result__a" href="${r.url}">${r.title}</a><a class="result__snippet">${r.snippet}</a></div></div>`,
    )
    .join('\n');
  return new Response(blocks, {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });
}

function htmlResponse(html: string, contentType = 'text/html') {
  return new Response(html, {
    status: 200,
    headers: { 'content-type': contentType },
  });
}

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = mockFetch;
  mockValidateURLForSSRF.mockReturnValue({ safe: true });
  process.env.BRAVE_SEARCH_API_KEY = 'test-key';
});

// ── web_search ───────────────────────────────────────────────────────

describe('web_search', () => {
  const handler = webTools.web_search!.handler;

  it('returns formatted results when Brave succeeds', async () => {
    mockFetch.mockResolvedValueOnce(
      braveResponse([
        { title: 'Result One', url: 'https://example.com/1', description: 'Snippet one' },
        { title: 'Result Two', url: 'https://example.com/2', description: 'Snippet two' },
      ]),
    );

    const result = await handler({ query: 'test query' });

    expect(result).toContain('Brave');
    expect(result).toContain('Result One');
    expect(result).toContain('https://example.com/1');
    expect(result).toContain('Snippet one');
    expect(result).toContain('Result Two');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]![0]).toContain('api.search.brave.com');
  });

  it('falls back to DuckDuckGo when Brave fails', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Brave down'))
      .mockResolvedValueOnce(
        ddgHtmlResponse([
          { title: 'DDG Result', url: 'https://ddg.example.com', snippet: 'DDG snippet' },
        ]),
      );

    const result = await handler({ query: 'fallback query' });

    expect(result).toContain('DuckDuckGo');
    expect(result).toContain('DDG Result');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns error message when all providers fail', async () => {
    process.env.BRAVE_SEARCH_API_KEY = undefined;
    // DDG fails
    mockFetch.mockRejectedValueOnce(new Error('DDG down'));
    // SearXNG instances fail (3 attempts)
    mockFetch.mockRejectedValueOnce(new Error('SearXNG 1 down'));
    mockFetch.mockRejectedValueOnce(new Error('SearXNG 2 down'));
    mockFetch.mockRejectedValueOnce(new Error('SearXNG 3 down'));

    const result = await handler({ query: 'impossible query' });

    expect(result).toContain('Nenhum provider de busca');
    expect(result).toContain('impossible query');
  });
});

// ── web_fetch ────────────────────────────────────────────────────────

describe('web_fetch', () => {
  const handler = webTools.web_fetch!.handler;

  it('blocks SSRF URLs', async () => {
    mockValidateURLForSSRF.mockReturnValue({ safe: false, reason: 'private IP' });

    const result = await handler({ url: 'http://192.168.1.1/admin' });

    expect(result).toContain('SSRF');
    expect(result).toContain('private IP');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns markdown from HTML', async () => {
    const html = '<html><body><h1>Hello World</h1><p>Some content here.</p></body></html>';
    mockFetch.mockResolvedValueOnce(htmlResponse(html));

    const result = await handler({ url: 'https://example.com/article' });

    expect(result).toContain('Hello World');
    expect(result).toContain('Some content here');
  });

  it('handles timeout gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('The operation was aborted'));

    const result = await handler({ url: 'https://slow.example.com' });

    expect(result).toContain('Timeout');
  });

  it('returns raw JSON for application/json content-type', async () => {
    const json = JSON.stringify({ data: 'value', count: 42 });
    mockFetch.mockResolvedValueOnce(
      new Response(json, {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    );

    const result = await handler({ url: 'https://api.example.com/data' });

    expect(result).toContain('"data":"value"');
    expect(result).toContain('"count":42');
  });

  it('truncates content exceeding 30000 chars', async () => {
    const longContent = `<html><body>${'a'.repeat(35_000)}</body></html>`;
    mockFetch.mockResolvedValueOnce(htmlResponse(longContent));

    const result = await handler({ url: 'https://example.com/long' });

    expect(result.length).toBeLessThanOrEqual(35_000);
    expect(result).toContain('truncado');
    expect(result).toContain('30000');
  });
});
