'use server';

import {
  completeObligation,
  createContract,
  createLegalEntity,
  createObligation,
  deleteContract,
  deleteLegalEntity,
  deleteObligation,
  getUrgentObligations,
  listActiveContracts,
  listAllContracts,
  listLegalEntities,
  listPendingObligations,
  updateContract,
  updateLegalEntity,
  updateObligation,
} from '@hawk/module-legal/queries';
import { withAdminTenant } from '../supabase/with-admin-tenant';
import { withTenant } from '../supabase/with-tenant';

import type {
  Contract,
  CreateContractInput,
  CreateLegalEntityInput,
  CreateObligationInput,
  LegalEntity,
  ObligationWithDaysLeft,
  UpdateContractInput,
  UpdateLegalEntityInput,
  UpdateObligationInput,
} from '@hawk/module-legal/types';

export async function fetchPendingObligations(): Promise<ObligationWithDaysLeft[]> {
  return withTenant(async () => listPendingObligations());
}

export async function fetchUrgentObligations(): Promise<ObligationWithDaysLeft[]> {
  return withTenant(async () => getUrgentObligations(15));
}

export async function fetchActiveContracts(): Promise<Contract[]> {
  return withTenant(async () => listActiveContracts());
}

export async function fetchAllContracts(): Promise<Contract[]> {
  return withTenant(async () => listAllContracts());
}

export async function fetchLegalEntities(): Promise<LegalEntity[]> {
  return withTenant(async () => listLegalEntities());
}

export async function completeObligationAction(id: string): Promise<void> {
  return withTenant(async () => {
    await completeObligation(id);
  });
}

export async function deleteObligationAction(id: string): Promise<void> {
  return withTenant(async () => {
    await deleteObligation(id);
  });
}

export async function deleteContractAction(id: string): Promise<void> {
  return withTenant(async () => {
    await deleteContract(id);
  });
}

export async function deleteLegalEntityAction(id: string): Promise<void> {
  return withTenant(async () => {
    await deleteLegalEntity(id);
  });
}

export async function addObligation(input: CreateObligationInput): Promise<void> {
  return withTenant(async () => {
    await createObligation(input);
  });
}

export async function addContract(input: CreateContractInput): Promise<void> {
  return withTenant(async () => {
    await createContract(input);
  });
}

export async function addLegalEntity(input: CreateLegalEntityInput): Promise<void> {
  return withTenant(async () => {
    await createLegalEntity(input);
  });
}

export async function editObligation(id: string, input: UpdateObligationInput): Promise<void> {
  return withTenant(async () => {
    await updateObligation(id, input);
  });
}

export async function editContract(id: string, input: UpdateContractInput): Promise<void> {
  return withTenant(async () => {
    await updateContract(id, input);
  });
}

export async function editLegalEntity(id: string, input: UpdateLegalEntityInput): Promise<void> {
  return withTenant(async () => {
    await updateLegalEntity(id, input);
  });
}

export async function queryLegal(question: string): Promise<string> {
  if (!question.trim()) return '';

  // 1. Fetch legal context + OpenRouter key in parallel
  const [context, apiKey] = await Promise.all([
    withTenant(async () => {
      const [contracts, obligations, entities] = await Promise.all([
        listAllContracts(),
        listPendingObligations(),
        listLegalEntities(),
      ]);
      return { contracts, obligations, entities };
    }),
    withAdminTenant(async ({ admin, slug }) => {
      try {
        const tenant = await admin.getTenantBySlug(slug);
        if (tenant?.openrouter_config_encrypted && tenant.openrouter_config_iv) {
          const cfg = admin.getDecryptedIntegrationConfig({
            config_encrypted: tenant.openrouter_config_encrypted,
            config_iv: tenant.openrouter_config_iv,
          } as never) as Record<string, unknown>;
          return (cfg.api_key as string) || null;
        }
      } catch {
        // fall through to env fallback
      }
      return null;
    }),
  ]);

  const key = apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) {
    return 'Assistente jurídico não disponível: configure a chave OpenRouter em Configurações → Integrações.';
  }

  // 2. Format context
  const today = new Date().toISOString().split('T')[0];
  const contractsText = context.contracts.length
    ? context.contracts
        .map(
          (c) =>
            `- ${c.title} | Partes: ${c.parties.join(', ')} | Status: ${c.status}${c.end_date ? ` | Fim: ${c.end_date}` : ''}${c.value ? ` | Valor: €${c.value}` : ''}${c.notes ? ` | Notas: ${c.notes}` : ''}`,
        )
        .join('\n')
    : 'Nenhum contrato registado.';

  const obligationsText = context.obligations.length
    ? context.obligations
        .map(
          (o) =>
            `- ${o.name} | Vencimento: ${o.due_date} | Status: ${o.status}${o.amount ? ` | Valor: €${o.amount}` : ''}${o.notes ? ` | Notas: ${o.notes}` : ''}`,
        )
        .join('\n')
    : 'Nenhuma obrigação pendente.';

  const entitiesText = context.entities.length
    ? context.entities.map((e) => `- ${e.name} (${e.type.toUpperCase()})`).join('\n')
    : 'Nenhuma entidade registada.';

  const systemPrompt = `És o assistente jurídico pessoal do utilizador. Respondes em português europeu (PT-PT), de forma clara e prática.
Data de hoje: ${today}

CONTRATOS:
${contractsText}

OBRIGAÇÕES PENDENTES:
${obligationsText}

ENTIDADES:
${entitiesText}

Responde à pergunta do utilizador com base nestes dados. Se precisares de mais informação que não está disponível, diz-o claramente. Não dás conselhos jurídicos formais — sugeres acções práticas com base nos dados disponíveis.`;

  // 3. Call OpenRouter
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'qwen/qwen3-235b-a22b:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    return `Erro ao contactar o assistente (${response.status}). Tente novamente.`;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? 'Sem resposta do assistente.';
}
