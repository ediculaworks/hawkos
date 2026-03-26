/**
 * Gap Scanner — Detecção semanal de lacunas nos dados
 *
 * Roda toda segunda-feira às 08:00.
 * 1. Detecta gaps nos dados via detectDataGaps()
 * 2. Persiste gaps no banco
 * 3. Gera perguntas dinâmicas via LLM para gaps sem pergunta associada
 * 4. Loga resultados no activity_log
 */

import {
  type DataGap,
  detectDataGaps,
  insertDynamicQuestion,
  persistDataGaps,
} from '@hawk/module-memory';
import cron from 'node-cron';
import { WORKER_MODEL, getWorkerClient } from '../llm-client.js';

/**
 * Gera uma pergunta natural em português para um gap detectado.
 */
async function generateQuestionForGap(gap: DataGap): Promise<string | null> {
  try {
    const response = await getWorkerClient().chat.completions.create({
      model: WORKER_MODEL,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content:
            'Você gera perguntas naturais e empáticas em português brasileiro para um sistema de gestão de vida pessoal. A pergunta deve ser direta, curta (1-2 frases), e não parecer um formulário.',
        },
        {
          role: 'user',
          content: `Dado este gap nos dados: "${gap.description}" (módulo: ${gap.module}, severidade: ${gap.severity}). Gere UMA pergunta natural para o usuário preencher essa informação. Retorne APENAS a pergunta, sem explicação.`,
        },
      ],
    });

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * Mapeia severidade do gap para prioridade da pergunta.
 */
function severityToPriority(severity: string): number {
  switch (severity) {
    case 'critical':
      return 10;
    case 'high':
      return 8;
    case 'medium':
      return 6;
    case 'low':
      return 4;
    default:
      return 5;
  }
}

/**
 * Executa o scan completo: detectar gaps → persistir → gerar perguntas
 */
export async function runGapScan(): Promise<{ gaps: number; questions: number }> {
  // 1. Detectar gaps
  const gaps = await detectDataGaps();
  if (gaps.length === 0) return { gaps: 0, questions: 0 };

  // 2. Persistir gaps
  await persistDataGaps(gaps);

  // 3. Gerar perguntas dinâmicas para os primeiros 5 gaps mais severos
  const sortedGaps = gaps.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
  });

  let questionsGenerated = 0;
  for (const gap of sortedGaps.slice(0, 5)) {
    const question = await generateQuestionForGap(gap);
    if (question) {
      try {
        await insertDynamicQuestion(question, gap.description, severityToPriority(gap.severity), [
          gap.module,
        ]);
        questionsGenerated++;
      } catch {
        // Pode falhar se pergunta duplicada (unique key), ignorar
      }
    }
  }

  return { gaps: gaps.length, questions: questionsGenerated };
}

/**
 * Inicializa cron do gap scanner — toda segunda às 08:00
 */
export function startGapScannerCron(): void {
  cron.schedule('0 8 * * 1', () => {
    runGapScan().catch((err) => console.error('[gap-scanner] Failed:', err));
  });
}
