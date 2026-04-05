/**
 * Career tools — resume generation and career analytics.
 */

import {
  getCareerProfile,
  listCareerCertifications,
  listCareerEducations,
  listCareerExperiences,
  listCareerSkills,
} from '@hawk/module-career';
import { z } from 'zod';

import type { ToolDefinition } from './types.js';

export const careerTools: Record<string, ToolDefinition> = {
  generate_resume: {
    name: 'generate_resume',
    modules: ['career'],
    description:
      'Gera um currículo completo em markdown a partir dos dados do módulo de carreira (perfil, experiências, formação, skills, certificados). O agente pode então adaptar para uma vaga específica.',
    parameters: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['full', 'summary'],
          description: 'full = currículo completo, summary = resumo executivo (default: full)',
        },
      },
    },
    schema: z.object({
      format: z.enum(['full', 'summary']).optional(),
    }),
    handler: async (args: { format?: string }) => {
      const [profile, experiences, educations, skills, certifications] = await Promise.all([
        getCareerProfile().catch(() => null),
        listCareerExperiences().catch(() => []),
        listCareerEducations().catch(() => []),
        listCareerSkills().catch(() => []),
        listCareerCertifications().catch(() => []),
      ]);

      if (!profile && experiences.length === 0 && educations.length === 0) {
        return 'Nenhum dado de carreira encontrado. Use /perfil, /experiencia, /formacao para adicionar.';
      }

      const sections: string[] = [];

      // Header
      if (profile) {
        const p = profile as Record<string, unknown>;
        sections.push(`# ${p.full_name ?? 'Nome'}`);
        if (p.title) sections.push(`**${p.title}**`);
        const contact: string[] = [];
        if (p.email) contact.push(p.email as string);
        if (p.phone) contact.push(p.phone as string);
        if (p.location) contact.push(p.location as string);
        if (p.linkedin_url) contact.push(p.linkedin_url as string);
        if (p.github_url) contact.push(p.github_url as string);
        if (contact.length > 0) sections.push(contact.join(' | '));
        if (p.summary) sections.push(`\n${p.summary}`);
      }

      // Summary format — stop here
      if (args.format === 'summary') {
        if (skills.length > 0) {
          const skillNames = skills.map((s: Record<string, unknown>) => s.name).join(', ');
          sections.push(`\n**Skills:** ${skillNames}`);
        }
        sections.push(
          `\n${experiences.length} experiências, ${educations.length} formações, ${certifications.length} certificados`,
        );
        return sections.join('\n');
      }

      // Experiences
      if (experiences.length > 0) {
        sections.push('\n## Experiência Profissional');
        for (const exp of experiences) {
          const e = exp as Record<string, unknown>;
          const period = `${e.start_date ?? '?'} — ${e.end_date ?? 'Atual'}`;
          sections.push(`\n### ${e.title} @ ${e.company}`);
          sections.push(`*${period}*`);
          if (e.description) sections.push(e.description as string);
        }
      }

      // Education
      if (educations.length > 0) {
        sections.push('\n## Formação Acadêmica');
        for (const edu of educations) {
          const e = edu as Record<string, unknown>;
          const period = `${e.start_date ?? '?'} — ${e.end_date ?? 'Atual'}`;
          sections.push(`\n### ${e.degree} em ${e.field_of_study}`);
          sections.push(`*${e.institution} (${period})*`);
        }
      }

      // Skills
      if (skills.length > 0) {
        sections.push('\n## Competências');
        const byCategory = new Map<string, string[]>();
        for (const skill of skills) {
          const s = skill as Record<string, unknown>;
          const cat = (s.category as string) ?? 'Outros';
          const list = byCategory.get(cat) ?? [];
          list.push(s.name as string);
          byCategory.set(cat, list);
        }
        for (const [cat, names] of byCategory) {
          sections.push(`**${cat}:** ${names.join(', ')}`);
        }
      }

      // Certifications
      if (certifications.length > 0) {
        sections.push('\n## Certificações');
        for (const cert of certifications) {
          const c = cert as Record<string, unknown>;
          const date = c.issue_date ? ` (${c.issue_date})` : '';
          sections.push(`• ${c.name} — ${c.issuing_organization}${date}`);
        }
      }

      return sections.join('\n');
    },
  },
};
