// Automation: Content Pipeline
// - Detecta insights recentes que podem viraram posts
// - Lista posts drafts que podem ser publicados
// - Sugere conteúdo baseado em notas e valores
// Roda toda sexta-feira às 17:00

import { searchNotes } from '@hawk/module-knowledge/queries';
import { listPosts } from '@hawk/module-social/queries';
import cron from 'node-cron';
import { sendToChannel } from '../channels/discord.js';
import { resolveChannel } from './resolve-channel.js';

/**
 * Analisa pipeline de conteúdo e sugere criações
 */
export async function runContentPipeline(slug?: string): Promise<void> {
  const channelId = resolveChannel(slug);
  if (!channelId) return;

  const suggestions: string[] = [];

  // ── Verificar posts drafts ──────────────────────────────────────────────
  const posts = await listPosts();
  const drafts = posts.filter((p) => p.status === 'draft');
  const scheduled = posts.filter((p) => p.status === 'scheduled');
  const ideas = posts.filter((p) => p.status === 'idea');

  if (drafts.length > 0) {
    suggestions.push(
      `📝 **Rascunhos prontos:** ${drafts.length} post(s) em rascunho. Use \`/post publish <id>\` para publicar.`,
    );
  }

  if (scheduled.length > 0) {
    const thisWeek = scheduled.filter((p) => {
      if (!p.scheduled_at) return false;
      const scheduled = new Date(p.scheduled_at);
      const now = new Date();
      const diffDays = Math.ceil((scheduled.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });
    if (thisWeek.length > 0) {
      suggestions.push(`📅 **Agendados essa semana:** ${thisWeek.length} post(s)`);
    }
  }

  if (ideas.length > 5) {
    suggestions.push(
      `💡 **Muitas ideias:** ${ideas.length} ideias de posts. Considere transformar algumas em rascunhos!`,
    );
  }

  // ── Buscar insights recentes que podem viraram posts ────────────────────────
  const insights = await searchNotes('insight');
  const recentInsights = insights.filter((n) => {
    const created = new Date(n.created_at);
    const now = new Date();
    const diffDays = Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  });

  if (recentInsights.length > 0) {
    suggestions.push(
      `💎 **Insights dessa semana:** ${recentInsights.length} nota(ns) de insight recente. Considere criar posts!`,
    );
  }

  // ── Resumo do pipeline ───────────────────────────────────────────────────
  const total = posts.length;
  const published = posts.filter((p) => p.status === 'published').length;

  suggestions.push(`📊 **Estatísticas:** ${published}/${total} posts publicados`);

  const message = `📱 **Pipeline de Conteúdo:**\n\n${suggestions.join('\n\n')}`;
  await sendToChannel(channelId, message, slug);
}

/**
 * Inicializar cron de pipeline de conteúdo (sexta-feira 17:00)
 */
export function startContentPipelineCron(): void {
  cron.schedule('0 17 * * 5', () => {
    runContentPipeline().catch((err) => console.error('[content-pipeline] Failed:', err));
  });
}
