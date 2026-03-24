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
import { fetchUrgentObligations } from '@/lib/actions/legal';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

type Tab = LegalTab;

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
