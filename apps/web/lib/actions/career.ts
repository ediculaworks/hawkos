'use server';

import {
  createProject,
  createWorkspace,
  getWorkSummary,
  listActiveProjects,
  listRecentWorkLogs,
  listWorkspaces,
  logWorkDirect,
} from '@hawk/module-career/queries';
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
