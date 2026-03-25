'use server';

import {
  createDemand,
  createLog,
  deleteDemand,
  getActiveDemands,
  getDemandFull,
  getDemandWithSteps,
  listArtifacts,
  listDemands,
  listLogs,
  listSteps,
  updateDemand,
  updateStep,
} from '@hawk/module-demands/queries';
import type {
  CreateDemandInput,
  Demand,
  DemandArtifact,
  DemandFull,
  DemandLog,
  DemandStatus,
  DemandWithSteps,
} from '@hawk/module-demands/types';
import { withTenant } from '../supabase/with-tenant';

export async function fetchDemands(status?: DemandStatus | DemandStatus[]): Promise<Demand[]> {
  return withTenant(async () => listDemands({ status }));
}

export async function fetchActiveDemands(): Promise<Demand[]> {
  return withTenant(async () => getActiveDemands());
}

export async function fetchDemandFull(id: string): Promise<DemandFull> {
  return withTenant(async () => getDemandFull(id));
}

export async function fetchDemandWithSteps(id: string): Promise<DemandWithSteps> {
  return withTenant(async () => getDemandWithSteps(id));
}

export async function fetchDemandLogs(demandId: string, limit = 50): Promise<DemandLog[]> {
  return withTenant(async () => listLogs(demandId, limit));
}

export async function fetchDemandArtifacts(demandId: string): Promise<DemandArtifact[]> {
  return withTenant(async () => listArtifacts(demandId));
}

export async function addDemand(input: CreateDemandInput): Promise<Demand> {
  return withTenant(async () => {
    const demand = await createDemand({
      ...input,
      origin: 'web',
    });

    // Trigger triage via the agent API
    try {
      const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL ?? 'http://localhost:3001';
      await fetch(`${agentUrl}/demands/${demand.id}/triage`, { method: 'POST' });
    } catch {
      // Triage will be picked up by the executor cron
    }

    return demand;
  });
}

export async function cancelDemandAction(demandId: string): Promise<Demand> {
  return withTenant(async () => {
    const steps = await listSteps(demandId);
    for (const step of steps) {
      if (['pending', 'ready', 'running', 'waiting_human'].includes(step.status)) {
        await updateStep(step.id, { status: 'cancelled' });
      }
    }

    const demand = await updateDemand(demandId, {
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    });

    await createLog(demandId, null, {
      log_type: 'status_change',
      message: 'Demanda cancelada via dashboard',
    });

    return demand;
  });
}

export async function pauseDemandAction(demandId: string): Promise<Demand> {
  return withTenant(async () => updateDemand(demandId, { status: 'paused' }));
}

export async function resumeDemandAction(demandId: string): Promise<Demand> {
  return withTenant(async () => updateDemand(demandId, { status: 'running' }));
}

export async function approveDemandStepAction(
  stepId: string,
  approved: boolean,
  feedback?: string,
): Promise<void> {
  return withTenant(async () => {
    if (approved) {
      await updateStep(stepId, {
        status: 'completed',
        result: feedback ?? 'Aprovado via dashboard',
        completed_at: new Date().toISOString(),
      });
    } else {
      await updateStep(stepId, {
        status: 'cancelled',
        result: feedback ?? 'Rejeitado via dashboard',
      });
    }
  });
}

export async function removeDemand(demandId: string): Promise<void> {
  return withTenant(async () => deleteDemand(demandId));
}
