/**
 * Automation: Job Monitor
 * Busca vagas de emprego via web search (DDG/SearXNG, 100% grátis)
 * Roda diariamente às 08:30 BRT
 */

import cron from 'node-cron';
import { sendToChannel } from '../channels/discord.js';
import { hookRegistry } from '../hooks/index.js';

const CHANNEL_ID = process.env.DISCORD_CHANNEL_GERAL ?? '';

// Job search config via env
const JOB_KEYWORDS = process.env.JOB_MONITOR_KEYWORDS ?? '';
const JOB_LOCATION = process.env.JOB_MONITOR_LOCATION ?? '';

// Track seen job URLs to avoid duplicates (in-memory, resets on restart)
const seenJobs = new Set<string>();

interface JobResult {
  title: string;
  url: string;
  snippet: string;
}

async function searchJobs(): Promise<JobResult[]> {
  if (!JOB_KEYWORDS) return [];

  const queries = JOB_KEYWORDS.split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const allResults: JobResult[] = [];

  for (const keyword of queries) {
    const searchQuery = JOB_LOCATION ? `vaga ${keyword} ${JOB_LOCATION}` : `vaga ${keyword}`;

    try {
      // Use DDG HTML scraping (same as web_search tool)
      const res = await fetch('https://html.duckduckgo.com/html/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: `q=${encodeURIComponent(searchQuery)}&b=`,
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) continue;
      const html = await res.text();

      // Parse results (same logic as web.ts)
      const blocks =
        html.match(/<div class="result[^"]*results_links[^"]*"[\s\S]*?<\/div>\s*<\/div>/g) ?? [];

      for (const block of blocks) {
        const urlMatch = block.match(/href="([^"]+)"/);
        const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
        const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

        if (urlMatch?.[1] && titleMatch?.[1]) {
          let url = urlMatch[1];
          const uddgMatch = url.match(/uddg=([^&]+)/);
          if (uddgMatch?.[1]) url = decodeURIComponent(uddgMatch[1]);

          const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
          const snippet = snippetMatch?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '';

          if (title && url.startsWith('http') && !seenJobs.has(url)) {
            allResults.push({ title, url, snippet });
          }
        }
      }
    } catch (err) {
      console.error(`[job-monitor] Search failed for "${keyword}":`, err);
    }
  }

  return allResults;
}

export async function runJobMonitor(): Promise<void> {
  if (!CHANNEL_ID || !JOB_KEYWORDS) {
    console.log(
      '[job-monitor] Skipped: no DISCORD_CHANNEL_GERAL or JOB_MONITOR_KEYWORDS configured',
    );
    return;
  }

  await hookRegistry.emit('automation:before', { automationName: 'job-monitor' }).catch(() => {});

  const results = await searchJobs();
  const newResults = results.filter((r) => !seenJobs.has(r.url));

  // Mark as seen
  for (const r of newResults) {
    seenJobs.add(r.url);
  }

  if (newResults.length === 0) {
    console.log('[job-monitor] No new jobs found');
    return;
  }

  // Take top 5
  const top = newResults.slice(0, 5);
  const lines = top.map(
    (r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet.slice(0, 150)}`,
  );

  const message = [
    `🔍 **Vagas encontradas (${newResults.length} novas):**`,
    '',
    ...lines,
    newResults.length > 5 ? `\n...e mais ${newResults.length - 5} resultados.` : '',
  ]
    .filter(Boolean)
    .join('\n');

  await sendToChannel(CHANNEL_ID, message);
  await hookRegistry.emit('automation:after', { automationName: 'job-monitor' }).catch(() => {});
}

export function startJobMonitorCron(): void {
  if (!JOB_KEYWORDS) {
    console.log('[hawk] Job monitor disabled (no JOB_MONITOR_KEYWORDS)');
    return;
  }

  cron.schedule(
    '30 8 * * *',
    () => {
      runJobMonitor().catch((err) => console.error('[job-monitor] Failed:', err));
    },
    { timezone: 'America/Sao_Paulo' },
  );

  console.log(`[hawk] Job monitor started (daily 08:30, keywords: ${JOB_KEYWORDS})`);
}
