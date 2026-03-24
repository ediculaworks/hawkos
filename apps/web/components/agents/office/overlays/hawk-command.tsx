'use client';

import { Send, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useOfficeStore } from '../store/office-store';

import { getAgentApiUrl } from '@/lib/config';

const MODULE_KEYWORDS: Record<string, string[]> = {
  finances: ['finanças', 'financ', 'dinheiro', 'conta', 'gasto', 'receita', 'banco', 'invest'],
  health: ['saúde', 'health', 'exercício', 'treino', 'sono', 'peso', 'dieta', 'medic'],
  people: ['pessoa', 'contato', 'network', 'crm', 'amigo', 'família', 'relacion'],
  career: ['carreira', 'emprego', 'currículo', 'linkedin', 'vaga', 'trabalho', 'profiss'],
  objectives: ['meta', 'objetivo', 'goal', 'tarefa', 'projeto', 'plano'],
  knowledge: ['conhecimento', 'nota', 'estudo', 'aprendizado', 'artigo', 'leitura'],
  routine: ['rotina', 'hábito', 'ritual', 'manhã', 'noite', 'diário'],
  assets: ['patrimônio', 'asset', 'imóvel', 'veículo', 'bem', 'seguro'],
  entertainment: ['entretenimento', 'filme', 'série', 'jogo', 'música', 'hobby'],
  legal: ['jurídico', 'contrato', 'legal', 'documento', 'obrigação'],
  housing: ['moradia', 'casa', 'apartamento', 'aluguel', 'manutenção'],
  calendar: ['agenda', 'evento', 'reunião', 'compromisso', 'calendário'],
};

function detectModules(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.entries(MODULE_KEYWORDS)
    .filter(([, keywords]) => keywords.some((k) => lower.includes(k)))
    .map(([module]) => module);
}

const MODULE_LABELS: Record<string, string> = {
  finances: 'Finanças',
  health: 'Saúde',
  people: 'Pessoas',
  career: 'Carreira',
  objectives: 'Metas',
  knowledge: 'Conhecimento',
  routine: 'Rotina',
  assets: 'Patrimônio',
  entertainment: 'Entretenimento',
  legal: 'Jurídico',
  housing: 'Moradia',
  calendar: 'Agenda',
};

type CommandState = 'idle' | 'sending' | 'streaming' | 'done' | 'error';

export function HawkCommandPanel() {
  const isOpen = useOfficeStore((s) => s.hawkCommandOpen);
  const closeCommand = useOfficeStore((s) => s.closeHawkCommand);
  const agents = useOfficeStore((s) => s.agents);
  const setActivatedAgentIds = useOfficeStore((s) => s.setActivatedAgentIds);

  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [state, setState] = useState<CommandState>('idle');
  const [designatedModules, setDesignatedModules] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const responseRef = useRef('');
  const wsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (wsTimeoutRef.current) clearTimeout(wsTimeoutRef.current);
    };
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || state === 'sending' || state === 'streaming') return;

    setState('sending');
    setResponse('');
    setDesignatedModules([]);
    responseRef.current = '';

    try {
      // Create session if needed
      let sid = sessionId;
      if (!sid) {
        const res = await fetch(`${getAgentApiUrl()}/chat/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error('Failed to create session');
        const data = await res.json();
        sid = data.sessionId;
        setSessionId(sid);
      }

      // Connect WebSocket
      const wsUrl = getAgentApiUrl().replace('http', 'ws');
      const ws = new WebSocket(`${wsUrl}/ws`);
      wsRef.current = ws;

      wsTimeoutRef.current = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
          ws.close();
          setState('error');
          setResponse('Tempo limite excedido');
        }
      }, 15000);

      ws.onopen = () => {
        clearTimeout(wsTimeoutRef.current ?? undefined);
        ws.send(JSON.stringify({ type: 'chat_join', sessionId: sid }));
        ws.send(JSON.stringify({ type: 'chat_message', sessionId: sid, content: input.trim() }));
        setState('streaming');
      };

      ws.onmessage = (event) => {
        clearTimeout(wsTimeoutRef.current ?? undefined);
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'chat_chunk' && msg.content) {
            responseRef.current += msg.content;
            setResponse(responseRef.current);
          } else if (msg.type === 'chat_message' && msg.role === 'assistant') {
            // Final response
            const fullText = msg.content ?? responseRef.current;
            setResponse(fullText);
            setState('done');

            // Detect modules and activate agents
            const modules = detectModules(`${fullText} ${input}`);
            setDesignatedModules(modules);

            // Find agents with matching modules
            const activatedIds = agents
              .filter((a) => !a.is_system && a.enabled_tools?.some((t) => modules.includes(t)))
              .map((a) => a.id);
            setActivatedAgentIds(activatedIds);

            ws.close();
          } else if (msg.type === 'chat_error') {
            setState('error');
            setResponse(msg.content ?? 'Erro ao processar demanda');
            ws.close();
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        clearTimeout(wsTimeoutRef.current ?? undefined);
        setState('error');
        setResponse('Erro de conexão com o agente');
      };

      setInput('');
    } catch {
      setState('error');
      setResponse('Erro ao enviar demanda');
    }
  }, [input, state, sessionId, agents, setActivatedAgentIds]);

  if (!isOpen) return null;

  const handleClose = () => {
    closeCommand();
    setState('idle');
    setResponse('');
    setDesignatedModules([]);
    setInput('');
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg font-mono" style={{ boxShadow: '4px 4px 0 #0a0a14' }}>
        {/* Header */}
        <div className="bg-[#1a1a2e] border-2 border-b-0 border-[#4a4a6a] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#ffd700] text-lg">🦅</span>
            <div>
              <span className="text-white text-sm font-bold tracking-wider">HAWK</span>
              <span className="text-[#666] text-xs ml-2">Central de Comando</span>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="text-[#666] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Response area */}
        <div className="bg-[#111122] border-2 border-b-0 border-[#4a4a6a] px-4 py-3 min-h-[120px] max-h-[240px] overflow-y-auto">
          {state === 'idle' && !response && (
            <p className="text-[#555] text-xs">
              Digite uma demanda e o Hawk delegará aos agentes relevantes.
            </p>
          )}
          {state === 'sending' && (
            <p className="text-[#888] text-xs animate-pulse">Processando...</p>
          )}
          {response && (
            <p className="text-[#ccc] text-xs leading-relaxed whitespace-pre-wrap">{response}</p>
          )}
          {state === 'streaming' && <span className="text-[#ffd700] animate-pulse">▌</span>}
        </div>

        {/* Designated agents */}
        {designatedModules.length > 0 && (
          <div className="bg-[#141428] border-2 border-b-0 border-[#4a4a6a] px-4 py-2">
            <span className="text-[#666] text-[9px] uppercase tracking-wider">
              Agentes designados
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {designatedModules.map((mod) => (
                <span key={mod} className="text-[10px] text-[#44cc88] bg-[#1a2e1a] px-1.5 py-0.5">
                  {MODULE_LABELS[mod] ?? mod} ✓
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="bg-[#1e1e2e] border-2 border-[#4a4a6a] px-3 py-2 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Digite uma demanda..."
            disabled={state === 'sending' || state === 'streaming'}
            className="flex-1 bg-transparent text-white text-xs placeholder:text-[#555] outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || state === 'sending' || state === 'streaming'}
            className="text-[#4488ff] hover:text-[#66aaff] disabled:text-[#333] transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
