'use client';

import { AddContractForm } from '@/components/legal/add-contract-form';
import { AddEntityForm } from '@/components/legal/add-entity-form';
import { AddObligationForm } from '@/components/legal/add-obligation-form';
import { ContractsList } from '@/components/legal/contracts-list';
import { EntitiesSummary } from '@/components/legal/entities-summary';
import { LegalHeader, type LegalTab } from '@/components/legal/legal-header';
import { ObligationsList } from '@/components/legal/obligations-list';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { fetchUrgentObligations, queryLegal } from '@/lib/actions/legal';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Bot, Send } from 'lucide-react';
import { useRef, useState } from 'react';

type Tab = LegalTab;

function LegalAIAssistant() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleQuery() {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer(null);
    try {
      const result = await queryLegal(question);
      setAnswer(result);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleQuery();
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
          <Bot className="h-4 w-4 text-[var(--color-accent)]" />
          Assistente Jurídico
        </div>
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunta sobre os teus contratos e obrigações... (Ctrl+Enter para enviar)"
            rows={2}
            className="flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <button
            type="button"
            onClick={handleQuery}
            disabled={loading || !question.trim()}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            {loading ? 'A pensar…' : 'Enviar'}
          </button>
        </div>
        {answer && (
          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border-subtle)] px-4 py-3 text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
            {answer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LegalPage() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [showObligationForm, setShowObligationForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [showEntityForm, setShowEntityForm] = useState(false);

  const { data: urgentObligations } = useQuery({
    queryKey: ['legal', 'urgent'],
    queryFn: () => fetchUrgentObligations(),
  });

  return (
    <div className="space-y-[var(--space-6)]">
      <LegalAIAssistant />
      <LegalHeader
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setShowObligationForm(false);
          setShowContractForm(false);
          setShowEntityForm(false);
        }}
        onAddObligation={() => setShowObligationForm((v) => !v)}
        onAddContract={() => setShowContractForm((v) => !v)}
        onAddEntity={() => setShowEntityForm((v) => !v)}
      />

      {activeTab === 'today' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-6)]">
          <div className="space-y-[var(--space-6)]">
            {showContractForm && <AddContractForm onClose={() => setShowContractForm(false)} />}
            {urgentObligations && urgentObligations.length > 0 ? (
              <Card className="border-red-500/30">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 text-red-500 mb-4">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-semibold">
                      {urgentObligations.length} obrigação(ões) urgente(s)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {urgentObligations.slice(0, 5).map((o) => (
                      <div key={o.id} className="flex justify-between text-sm">
                        <span>{o.name}</span>
                        <span className="text-[var(--color-text-muted)]">
                          {o.days_until_due <= 0 ? 'Vencida' : `${o.days_until_due}d`}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                icon={AlertTriangle}
                title="Nenhuma obrigação urgente"
                description="Suas obrigações fiscais e legais estão em dia"
              />
            )}
          </div>
          <div className="space-y-[var(--space-6)]">
            <ContractsList />
          </div>
        </div>
      )}

      {activeTab === 'obligations' && (
        <div className="space-y-[var(--space-4)]">
          {showObligationForm && <AddObligationForm onClose={() => setShowObligationForm(false)} />}
          <ObligationsList />
        </div>
      )}

      {activeTab === 'contracts' && (
        <div className="space-y-[var(--space-4)]">
          {showContractForm && <AddContractForm onClose={() => setShowContractForm(false)} />}
          {showEntityForm && <AddEntityForm onClose={() => setShowEntityForm(false)} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-6)]">
            <ContractsList />
            <div className="space-y-[var(--space-6)]">
              <EntitiesSummary />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'entities' && (
        <div className="space-y-[var(--space-4)]">
          {showEntityForm && <AddEntityForm onClose={() => setShowEntityForm(false)} />}
          <EntitiesSummary />
        </div>
      )}
    </div>
  );
}
