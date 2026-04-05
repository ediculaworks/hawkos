import { z } from 'zod';
import type { ToolDefinition } from './types.js';

const _MAX_IMAGE_DIMENSION = 2000;

export const mediaTools: Record<string, ToolDefinition> = {
  analyze_image: {
    name: 'analyze_image',
    modules: [],
    description:
      'Analisa uma imagem por URL. Pode descrever conteúdo, extrair texto (OCR), identificar objetos, etc. Útil para screenshots, recibos, documentos.',
    parameters: {
      type: 'object',
      properties: {
        image_url: { type: 'string', description: 'URL da imagem para analisar' },
        question: {
          type: 'string',
          description:
            'Pergunta específica sobre a imagem (default: "Descreva esta imagem em detalhes")',
        },
      },
      required: ['image_url'],
    },
    schema: z.object({ image_url: z.string().url(), question: z.string().optional() }),
    handler: async (args: { image_url: string; question?: string }) => {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/hawk-os',
          'X-Title': 'Hawk OS',
        },
      });

      const question =
        args.question ?? 'Descreva esta imagem em detalhes. Se houver texto, extraia-o.';

      try {
        const response = await client.chat.completions.create({
          model: 'google/gemini-2.5-flash-preview',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: question },
                {
                  type: 'image_url',
                  image_url: {
                    url: args.image_url,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
        } as never);

        const content = response.choices[0]?.message.content;
        return content ?? 'Não foi possível analisar a imagem.';
      } catch (err) {
        return `Erro ao analisar imagem: ${err}`;
      }
    },
  },
};
