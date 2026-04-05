import { validateURLForSSRF } from '@hawk/shared';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';
import { z } from 'zod';
import type { ToolDefinition } from './types.js';

const MAX_FETCH_BYTES = 30_000;
const SEARCH_RESULTS_COUNT = 5;

// ── Web Search via Brave or DuckDuckGo ──────────────────────────────

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function searchBrave(query: string, count: number): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error('NO_KEY');

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
  const res = await fetch(url, {
    headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
  });

  if (!res.ok) throw new Error(`Brave API ${res.status}`);
  const data = (await res.json()) as {
    web?: { results?: { title: string; url: string; description: string }[] };
  };

  return (data.web?.results ?? [])
    .slice(0, count)
    .map((r: { title: string; url: string; description: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }));
}

async function searchDuckDuckGoHTML(query: string, count: number): Promise<SearchResult[]> {
  const res = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: `q=${encodeURIComponent(query)}&b=`,
  });

  if (!res.ok) throw new Error(`DDG HTML ${res.status}`);
  const html = await res.text();

  const results: SearchResult[] = [];
  const resultBlocks =
    html.match(/<div class="result[^"]*results_links[^"]*"[\s\S]*?<\/div>\s*<\/div>/g) ?? [];

  for (const block of resultBlocks) {
    if (results.length >= count) break;

    const urlMatch = block.match(/href="([^"]+)"/);
    const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

    if (urlMatch?.[1] && titleMatch?.[1]) {
      let url = urlMatch[1];
      const uddgMatch = url.match(/uddg=([^&]+)/);
      if (uddgMatch?.[1]) url = decodeURIComponent(uddgMatch[1]);

      const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      const snippet = snippetMatch?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '';

      if (title && url.startsWith('http')) {
        results.push({ title, url, snippet });
      }
    }
  }

  return results;
}

async function searchSearXNG(query: string, count: number): Promise<SearchResult[]> {
  const instances = ['https://search.sapti.me', 'https://searx.be', 'https://search.bus-hit.me'];

  for (const instance of instances) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=pt-BR`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;

      const data = (await res.json()) as {
        results?: { title: string; url: string; content: string }[];
      };
      return (data.results ?? [])
        .slice(0, count)
        .map((r: { title: string; url: string; content: string }) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
        }));
    } catch (err) {
      console.warn(`[web_search] SearXNG instance ${instance} failed:`, err);
    }
  }

  throw new Error('All SearXNG instances failed');
}

// ── HTML to Markdown extraction (Crawl4AI-inspired) ──────────────────

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Remove images and iframes to save tokens
turndown.remove(['img', 'iframe', 'svg', 'video', 'audio', 'canvas', 'noscript']);

/**
 * Extract main content from HTML using Mozilla Readability,
 * then convert to clean Markdown via Turndown.
 * Falls back to basic regex extraction if Readability fails.
 */
function htmlToMarkdown(html: string, _url: string): string {
  try {
    const { document } = parseHTML(html);

    // Try Readability first (extracts article content like Firefox Reader View)
    const reader = new Readability(document, { charThreshold: 100 });
    const article = reader.parse();

    if (article?.content) {
      const md = turndown.turndown(article.content);
      const title = article.title ? `# ${article.title}\n\n` : '';
      return title + md;
    }
  } catch {
    // Readability failed, fall through to basic extraction
  }

  // Fallback: basic HTML to Markdown via Turndown on body
  try {
    const { document } = parseHTML(html);
    // Remove noise elements
    for (const sel of [
      'script',
      'style',
      'nav',
      'footer',
      'header',
      'aside',
      '.sidebar',
      '.ad',
      '.advertisement',
    ]) {
      for (const el of document.querySelectorAll(sel)) {
        el.remove();
      }
    }
    const body = document.querySelector('body');
    if (body) {
      return turndown.turndown(body.innerHTML);
    }
  } catch {
    // linkedom body fallback failed, return raw text
  }

  // Last resort: return raw text stripped of tags
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decode HTTP response respecting Content-Type charset.
 * Bun's res.text() always assumes UTF-8 per Fetch API spec — this handles
 * ISO-8859-1, windows-1252, and other charsets common in PT/BR legacy sites.
 */
async function decodeResponse(res: Response): Promise<string> {
  const contentType = res.headers.get('content-type') ?? '';
  const charsetMatch = contentType.match(/charset=([^\s;,]+)/i);
  const charset = (charsetMatch?.[1] ?? 'utf-8').toLowerCase().replace(/['"]/g, '');

  const buffer = await res.arrayBuffer();
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  // Truncate by character count (safe for UTF-8, no broken multi-byte chars)
  return `${text.slice(0, maxChars)}\n\n... [conteúdo truncado em ${maxChars} caracteres]`;
}

// ── Tool Definitions ────────────────────────────────────────────────

export const webTools: Record<string, ToolDefinition> = {
  web_search: {
    name: 'web_search',
    modules: [],
    description:
      'Busca na web. Retorna títulos, URLs e snippets dos resultados. Usa Brave Search (se disponível) ou DuckDuckGo.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termo de busca' },
        count: {
          type: 'number',
          description: `Número de resultados (default ${SEARCH_RESULTS_COUNT}, max 10)`,
        },
      },
      required: ['query'],
    },
    schema: z.object({
      query: z.string().min(1),
      count: z.number().int().min(1).max(10).optional(),
    }),
    handler: async (args: { query: string; count?: number }) => {
      const count = Math.min(args.count ?? SEARCH_RESULTS_COUNT, 10);

      let results: SearchResult[];
      let provider: string;

      try {
        results = await searchBrave(args.query, count);
        provider = 'Brave';
      } catch {
        try {
          results = await searchDuckDuckGoHTML(args.query, count);
          provider = 'DuckDuckGo';
        } catch {
          try {
            results = await searchSearXNG(args.query, count);
            provider = 'SearXNG';
          } catch {
            return `Nenhum provider de busca disponível para "${args.query}".`;
          }
        }
      }

      if (results.length === 0) return `Nenhum resultado para "${args.query}".`;

      const lines = results.map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`);

      return [`**Busca web** (${provider}): "${args.query}"`, '', ...lines].join('\n');
    },
  },

  web_fetch: {
    name: 'web_fetch',
    modules: [],
    description:
      'Busca o conteúdo de uma URL e extrai o texto principal em Markdown limpo. Útil para ler artigos, docs, APIs.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL para buscar' },
        format: {
          type: 'string',
          enum: ['markdown', 'text', 'raw'],
          description:
            'Formato de saída: markdown (default, limpo), text (plain text), raw (HTML bruto)',
        },
      },
      required: ['url'],
    },
    schema: z.object({
      url: z.string().url(),
      format: z.enum(['markdown', 'text', 'raw']).optional(),
      max_chars: z.number().int().positive().max(100000).optional(),
    }),
    handler: async (args: { url: string; format?: 'markdown' | 'text' | 'raw' }) => {
      // L4: SSRF validation — block private IPs, loopback, metadata endpoints
      const ssrfCheck = validateURLForSSRF(args.url);
      if (!ssrfCheck.safe) {
        return `Erro: URL bloqueada por validação SSRF: ${ssrfCheck.reason}`;
      }

      const format = args.format ?? 'markdown';

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        const res = await fetch(args.url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            Accept: 'text/html,application/json,text/plain',
          },
          signal: controller.signal,
          redirect: 'follow',
        });

        clearTimeout(timeout);

        if (!res.ok) return `Erro HTTP ${res.status}: ${res.statusText}`;

        const contentType = res.headers.get('content-type') ?? '';
        const body = await decodeResponse(res);

        // JSON and plain text: return as-is
        if (contentType.includes('application/json') || contentType.includes('text/plain')) {
          return truncateText(body, MAX_FETCH_BYTES);
        }

        let text: string;
        switch (format) {
          case 'raw':
            text = body;
            break;
          default:
            text = htmlToMarkdown(body, args.url);
            break;
        }

        return truncateText(text, MAX_FETCH_BYTES);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('abort')) return 'Erro: Timeout ao buscar URL (15s).';
        return `Erro ao buscar URL: ${msg}`;
      }
    },
  },
};
