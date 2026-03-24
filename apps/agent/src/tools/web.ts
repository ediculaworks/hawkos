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
  // Scrape DDG HTML endpoint for real search results (no API key needed)
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

  // Parse result blocks: <div class="result...">
  const resultBlocks =
    html.match(/<div class="result[^"]*results_links[^"]*"[\s\S]*?<\/div>\s*<\/div>/g) ?? [];

  for (const block of resultBlocks) {
    if (results.length >= count) break;

    // Extract URL from <a class="result__a" href="...">
    const urlMatch = block.match(/href="([^"]+)"/);
    // Extract title text
    const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
    // Extract snippet from <a class="result__snippet">
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

    if (urlMatch?.[1] && titleMatch?.[1]) {
      let url = urlMatch[1];
      // DDG wraps URLs in redirect — extract actual URL
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
  // Use public SearXNG instances as fallback (no key needed)
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
    } catch {}
  }

  throw new Error('All SearXNG instances failed');
}

// ── HTML to Text extraction ─────────────────────────────────────────

function htmlToText(html: string): string {
  let text = html;
  // Remove script/style blocks
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '');
  // Convert block elements to newlines
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr|blockquote)[^>]*>/gi, '\n');
  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');
  return text.trim();
}

function truncateText(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, 'utf-8') <= maxBytes) return text;
  const truncated = Buffer.from(text, 'utf-8').subarray(0, maxBytes).toString('utf-8');
  return `${truncated}\n\n... [conteúdo truncado em ${maxBytes} bytes]`;
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
    handler: async (args: { query: string; count?: number }) => {
      const count = Math.min(args.count ?? SEARCH_RESULTS_COUNT, 10);

      let results: SearchResult[];
      let provider: string;

      // Try Brave (if key), DDG HTML scraping, SearXNG public instances
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
      'Busca o conteúdo de uma URL e extrai o texto principal. Útil para ler artigos, docs, APIs.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL para buscar' },
        raw: {
          type: 'boolean',
          description: 'Retornar HTML bruto em vez de texto extraído (default false)',
        },
      },
      required: ['url'],
    },
    handler: async (args: { url: string; raw?: boolean }) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        const res = await fetch(args.url, {
          headers: {
            'User-Agent': 'HawkOS/1.0 (bot)',
            Accept: 'text/html,application/json,text/plain',
          },
          signal: controller.signal,
          redirect: 'follow',
        });

        clearTimeout(timeout);

        if (!res.ok) return `Erro HTTP ${res.status}: ${res.statusText}`;

        const contentType = res.headers.get('content-type') ?? '';
        const body = await res.text();

        let text: string;
        if (
          args.raw ||
          contentType.includes('application/json') ||
          contentType.includes('text/plain')
        ) {
          text = body;
        } else {
          text = htmlToText(body);
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
