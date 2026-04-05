'use server';

import {
  getCareerProfile,
  getWorkSummary,
  listActiveProjects,
  listCareerCertifications,
  listCareerEducations,
  listCareerExperiences,
  listCareerSkills,
  listRecentWorkLogs,
  listWorkspaces,
} from '@hawk/module-career';
import type {
  CareerCertification,
  CareerEducation,
  CareerExperience,
  CareerProfile,
  CareerSkill,
} from '@hawk/module-career';
import { createProject, createWorkspace, logWorkDirect } from '@hawk/module-career/queries';
import type {
  CreateProjectInput,
  CreateWorkspaceInput,
  Project,
  WorkLog,
  WorkSummary,
  Workspace,
} from '@hawk/module-career/types';
import { withTenant } from '../supabase/with-tenant';

export async function fetchWorkspaces(): Promise<Workspace[]> {
  return withTenant(async () => listWorkspaces());
}

export async function fetchProjects(): Promise<Project[]> {
  return withTenant(async () => listActiveProjects());
}

export async function fetchWorkSummary(): Promise<WorkSummary[]> {
  return withTenant(async () => getWorkSummary());
}

export async function fetchRecentLogs(limit = 20): Promise<WorkLog[]> {
  return withTenant(async () => listRecentWorkLogs(limit));
}

export async function addWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
  return withTenant(async () => createWorkspace(input));
}

export async function addProject(input: CreateProjectInput): Promise<Project> {
  return withTenant(async () => createProject(input));
}

export async function logWork(input: {
  workspace_id: string;
  project_id?: string;
  duration_minutes: number;
  description?: string;
  date?: string;
  billable?: boolean;
}): Promise<WorkLog> {
  return withTenant(async () => logWorkDirect(input));
}

// ── Career Profile / Development ──────────────────────────────────────────────

export async function fetchCareerProfile(): Promise<CareerProfile | null> {
  return withTenant(async () => getCareerProfile());
}

export async function fetchCareerExperiences(): Promise<CareerExperience[]> {
  return withTenant(async () => listCareerExperiences());
}

export async function fetchCareerEducations(): Promise<CareerEducation[]> {
  return withTenant(async () => listCareerEducations());
}

export async function fetchCareerSkills(): Promise<CareerSkill[]> {
  return withTenant(async () => listCareerSkills());
}

export async function fetchCareerCertifications(): Promise<CareerCertification[]> {
  return withTenant(async () => listCareerCertifications());
}
