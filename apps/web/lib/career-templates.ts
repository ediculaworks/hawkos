import type { CareerTemplate } from '@hawk/module-career/types';

export const CAREER_TEMPLATES: CareerTemplate[] = [
  {
    id: 'medico',
    label: 'Médico',
    description: 'Plantões, consultório, procedimentos. Integração com Saúde.',
    icon: '🏥',
    workspaces: [
      { name: 'Plantões', type: 'employment', hourly_rate: 80 },
      { name: 'Consultório', type: 'freelance', hourly_rate: 200 },
    ],
    projects: [
      {
        name: 'Atendimentos',
        workspace_name: 'Consultório',
        description: 'Consultas e retornos',
        priority: 8,
      },
      {
        name: 'Plantões Emergência',
        workspace_name: 'Plantões',
        description: 'Escalas de plantão',
        priority: 9,
      },
      {
        name: 'Educação Médica',
        workspace_name: 'Consultório',
        description: 'Congressos, cursos, certificações',
        priority: 5,
      },
    ],
    integrations: ['health'],
  },
  {
    id: 'advogado',
    label: 'Advogado',
    description: 'Escritório, processos, clientes. Integração com Jurídico.',
    icon: '⚖️',
    workspaces: [
      { name: 'Escritório', type: 'company', monthly_income: 8000 },
      { name: 'Consultoria', type: 'freelance', hourly_rate: 300 },
    ],
    projects: [
      {
        name: 'Processos Ativos',
        workspace_name: 'Escritório',
        description: 'Gestão de processos em andamento',
        priority: 9,
      },
      {
        name: 'Contratos',
        workspace_name: 'Escritório',
        description: 'Revisão e elaboração de contratos',
        priority: 8,
      },
      {
        name: 'Consultoria Jurídica',
        workspace_name: 'Consultoria',
        description: 'Pareceres e orientações avulsas',
        priority: 7,
      },
    ],
    integrations: ['legal'],
  },
  {
    id: 'desenvolvedor',
    label: 'Desenvolvedor',
    description: 'Emprego, freelance, projetos pessoais. Repos GitHub.',
    icon: '💻',
    workspaces: [
      { name: 'Empresa', type: 'employment', monthly_income: 12000 },
      { name: 'Freelance', type: 'freelance', hourly_rate: 150 },
      { name: 'Projetos Pessoais', type: 'company' },
    ],
    projects: [
      {
        name: 'Projeto Principal',
        workspace_name: 'Empresa',
        description: 'Feature development',
        priority: 9,
      },
      {
        name: 'Side Project',
        workspace_name: 'Projetos Pessoais',
        description: 'Produto próprio',
        priority: 7,
      },
      {
        name: 'Open Source',
        workspace_name: 'Projetos Pessoais',
        description: 'Contribuições OSS',
        priority: 4,
      },
    ],
    integrations: ['knowledge'],
  },
];
