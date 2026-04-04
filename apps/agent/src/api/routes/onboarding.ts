import { getChatClient } from '../../llm-client.js';
import { buildOnboardingSystemPrompt } from './onboarding-prompt.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface OnboardingPayload {
  name: string;
  birthDate?: string;
  timezone?: string;
  bio?: string;
  goals?: string;
  enabledModules?: string[];
  enabledAgents?: string[];
  checkinMorning?: string;
  checkinEvening?: string;
  weeklyReviewDay?: string;
  weeklyReviewTime?: string;
  farewell?: string;
}

const COMPLETE_ONBOARDING_TOOL = {
  type: 'function' as const,
  function: {
    name: 'complete_onboarding',
    description:
      'Call this when you have collected all the information you need (or the user wants to skip the rest). Saves the configuration and marks onboarding as complete.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The user\'s name (required)' },
        birthDate: { type: 'string', description: 'ISO date YYYY-MM-DD, or empty string if skipped' },
        timezone: { type: 'string', description: 'IANA timezone string' },
        bio: { type: 'string', description: 'Short bio, or empty string if skipped' },
        goals: { type: 'string', description: 'Main goals, or empty string if skipped' },
        enabledModules: {
          type: 'array',
          items: { type: 'string' },
          description: 'Module IDs to enable',
        },
        enabledAgents: {
          type: 'array',
          items: { type: 'string' },
          description: 'Agent IDs to enable',
        },
        checkinMorning: { type: 'string', description: 'Morning check-in time HH:MM' },
        checkinEvening: { type: 'string', description: 'Evening check-in time HH:MM' },
        weeklyReviewDay: {
          type: 'string',
          description: 'Day of week: monday tuesday wednesday thursday friday saturday sunday',
        },
        weeklyReviewTime: { type: 'string', description: 'Weekly review time HH:MM' },
        farewell: {
          type: 'string',
          description: 'Short warm farewell/welcome message to display to the user',
        },
      },
      required: ['name'],
    },
  },
};

// Onboarding always uses OpenRouter (reliable, valid free tier, tool calling support).
const ONBOARDING_MODEL = process.env.MODEL_TIER_DEFAULT ?? 'qwen/qwen3.6-plus:free';

export async function handleOnboardingRoute(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { history?: Message[]; message?: string; timezone?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { history = [], message = '', timezone = 'UTC' } = body;

  const systemPrompt = buildOnboardingSystemPrompt(timezone);

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: string) {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      try {
        const client = getChatClient();
        const openaiStream = await client.chat.completions.create({
          model: ONBOARDING_MODEL,
          messages,
          tools: [COMPLETE_ONBOARDING_TOOL],
          tool_choice: 'auto',
          stream: true,
        });

        // Accumulate tool call data across streaming chunks
        let toolCallId = '';
        let toolCallName = '';
        let toolCallArgs = '';
        let isToolCall = false;
        let assistantText = '';

        for await (const chunk of openaiStream) {
          const choice = chunk.choices[0];
          if (!choice) continue;

          const delta = choice.delta;

          // Accumulate text content
          if (delta.content) {
            assistantText += delta.content;
            send(JSON.stringify({ type: 'chunk', content: delta.content }));
          }

          // Accumulate tool call data
          if (delta.tool_calls && delta.tool_calls.length > 0) {
            isToolCall = true;
            const tc = delta.tool_calls[0];
            if (tc) {
              if (tc.id) toolCallId = tc.id;
              if (tc.function?.name) toolCallName = tc.function.name;
              if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
            }
          }

          // Check finish reason
          if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
            break;
          }
        }

        // Handle tool call completion
        if (isToolCall && toolCallName === 'complete_onboarding') {
          let payload: OnboardingPayload;
          try {
            payload = JSON.parse(toolCallArgs) as OnboardingPayload;
          } catch {
            payload = { name: 'Usuário' };
          }

          // Ensure defaults
          const finalPayload: OnboardingPayload = {
            name: payload.name || 'Usuário',
            birthDate: payload.birthDate || '',
            timezone: payload.timezone || timezone,
            bio: payload.bio || '',
            goals: payload.goals || '',
            enabledModules: payload.enabledModules ?? ['finances', 'health', 'objectives', 'routine'],
            enabledAgents: payload.enabledAgents ?? ['bull', 'wolf', 'owl', 'bee'],
            checkinMorning: payload.checkinMorning || '09:00',
            checkinEvening: payload.checkinEvening || '22:00',
            weeklyReviewDay: payload.weeklyReviewDay || 'sunday',
            weeklyReviewTime: payload.weeklyReviewTime || '20:00',
            farewell: payload.farewell || `Tudo pronto, ${payload.name}! Bem-vindo ao Hawk OS.`,
          };

          // If the model sent a farewell message as text, it's already streamed.
          // If not, and the farewell is in the payload, send it now.
          if (!assistantText && finalPayload.farewell) {
            send(JSON.stringify({ type: 'chunk', content: finalPayload.farewell }));
          }

          send(JSON.stringify({ type: 'complete', payload: finalPayload }));
        }

        send('[DONE]');
        controller.close();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'LLM error';
        send(JSON.stringify({ type: 'error', error: errMsg }));
        send('[DONE]');
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
