import {
  getCareerProfile,
  listCareerCertifications,
  listCareerEducations,
  listCareerExperiences,
  listCareerSkills,
} from './career-queries';
// Context Engine: Career / Carreira
import { getWorkSummary, listActiveProjects } from './queries';

export async function loadL0(): Promise<string> {
  try {
    const summaries = await getWorkSummary();
    const profile = await getCareerProfile();

    if (summaries.length === 0 && !profile) return 'Carreira: sem dados.';

    const hourLines = summaries
      .filter((s) => s.total_hours_week > 0)
      .map((s) => `${s.workspace.name}: ${s.total_hours_week}h`);

    const parts: string[] = [];
    if (hourLines.length > 0) parts.push(`Horas: ${hourLines.join(' · ')}`);
    if (profile?.headline) parts.push(`Perfil: ${profile.headline}`);
    if (profile?.open_to_work) parts.push('🔍 Open to Work');

    return parts.length > 0 ? parts.join(' · ') : 'Carreira: sem dados.';
  } catch (_error) {
    return 'Carreira: indisponível';
  }
}

export async function loadL1(): Promise<string> {
  try {
    const [summaries, projects, profile, skills] = await Promise.all([
      getWorkSummary(),
      listActiveProjects(),
      getCareerProfile(),
      listCareerSkills(),
    ]);

    const lines: string[] = ['## Carreira'];

    if (profile?.headline) {
      lines.push(`**${profile.headline}**`);
      if (profile.open_to_work) lines.push('🔍 Open to Work');
      if (profile.location) lines.push(`📍 ${profile.location}`);
      if (profile.summary) lines.push(profile.summary.slice(0, 200));
    }

    if (summaries.length > 0) {
      for (const s of summaries) {
        lines.push(`${s.workspace.name}: ${s.total_hours_week}h/semana`);
      }
    }

    if (projects.length > 0) {
      lines.push(`Projetos: ${projects.map((p) => p.name).join(', ')}`);
    }

    if (skills.length > 0) {
      const topSkills = skills
        .slice(0, 10)
        .map((s) => s.name)
        .join(', ');
      lines.push(`Skills: ${topSkills}`);
    }

    return lines.join('\n');
  } catch (_error) {
    return 'Carreira (detalhes): indisponível';
  }
}

export async function loadL2(): Promise<string> {
  try {
    const [summaries, projects, profile, experiences, educations, skills, certs] =
      await Promise.all([
        getWorkSummary(),
        listActiveProjects(),
        getCareerProfile(),
        listCareerExperiences(),
        listCareerEducations(),
        listCareerSkills(),
        listCareerCertifications(),
      ]);

    const sections: string[] = ['## Carreira Completa'];

    if (profile) {
      const meta: string[] = [];
      if (profile.headline) meta.push(`**${profile.headline}**`);
      if (profile.location) meta.push(`📍 ${profile.location}`);
      if (profile.open_to_work) meta.push('🔍 Open to Work');
      if (profile.linkedin_url) meta.push(`LinkedIn: ${profile.linkedin_url}`);
      if (profile.github_url) meta.push(`GitHub: ${profile.github_url}`);
      if (meta.length > 0) sections.push(meta.join(' · '));
      if (profile.summary) sections.push(profile.summary);
    }

    if (experiences.length > 0) {
      sections.push('### Experiências');
      for (const exp of experiences.slice(0, 5)) {
        const period = `${exp.start_date.slice(0, 7)} – ${exp.is_current ? 'atual' : (exp.end_date?.slice(0, 7) ?? '')}`;
        sections.push(`• **${exp.title ?? exp.company_name}** @ ${exp.company_name} (${period})`);
        if (exp.description) sections.push(`  ${exp.description.slice(0, 150)}`);
      }
    }

    if (educations.length > 0) {
      sections.push('### Formação');
      for (const edu of educations) {
        const period = `${edu.start_date?.slice(0, 4) ?? ''} – ${edu.end_date?.slice(0, 4) ?? ''}`;
        sections.push(`• **${edu.degree}** @ ${edu.institution} (${period})`);
      }
    }

    if (skills.length > 0) {
      const techSkills = skills.filter((s) => s.category === 'technical' || s.category === 'tool');
      const softSkills = skills.filter((s) => s.category === 'soft');
      if (techSkills.length > 0)
        sections.push(`### Skills Técnicas\n${techSkills.map((s) => s.name).join(', ')}`);
      if (softSkills.length > 0)
        sections.push(`Skills Comportamentais: ${softSkills.map((s) => s.name).join(', ')}`);
    }

    if (certs.length > 0) {
      sections.push('### Certificações');
      for (const cert of certs) {
        sections.push(`• **${cert.name}** (${cert.issuer})`);
      }
    }

    if (summaries.length > 0) {
      sections.push('### Horas Recentes');
      for (const s of summaries) {
        const recentLogs = s.logs.slice(0, 3).map((l) => {
          const h = Math.floor(l.duration_minutes / 60);
          const m = l.duration_minutes % 60;
          const dur = h > 0 ? `${h}h${m > 0 ? `${m}m` : ''}` : `${m}m`;
          return `${l.date} ${dur}${l.description ? `: ${l.description.slice(0, 50)}` : ''}`;
        });
        if (recentLogs.length > 0)
          sections.push(
            `**${s.workspace.name}:**\n${recentLogs.map((l) => `  • ${l}`).join('\n')}`,
          );
      }
    }

    if (projects.length > 0) {
      sections.push(
        `### Projetos\n${projects.map((p) => `• ${p.name} (prio ${p.priority})`).join('\n')}`,
      );
    }

    return sections.length > 1 ? sections.join('\n') : 'Carreira: sem dados.';
  } catch (_error) {
    return 'Carreira (histórico): indisponível';
  }
}
