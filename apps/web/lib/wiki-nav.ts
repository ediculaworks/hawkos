export type WikiItem = {
  slug: string;
  title: string;
};

export type WikiCategory = {
  category: string;
  items: WikiItem[];
};

export const WIKI_NAV: WikiCategory[] = [
  {
    category: 'Visão Geral',
    items: [{ slug: 'visao-geral', title: 'O que é o Hawk OS' }],
  },
  {
    category: 'O Agente',
    items: [
      { slug: 'agent/pipeline', title: 'Pipeline de Mensagem' },
      { slug: 'agent/contexto', title: 'Contexto L0 / L1 / L2' },
      { slug: 'agent/memoria', title: 'Sistema de Memória' },
      { slug: 'agent/tools', title: 'Tools & Routing Dinâmico' },
      { slug: 'agent/personas', title: 'Personas & Templates' },
    ],
  },
  {
    category: 'Módulos',
    items: [
      { slug: 'modules/finances', title: 'Finanças' },
      { slug: 'modules/health', title: 'Saúde' },
      { slug: 'modules/people', title: 'Pessoas (CRM)' },
      { slug: 'modules/career', title: 'Carreira' },
      { slug: 'modules/objectives', title: 'Objetivos' },
      { slug: 'modules/routine', title: 'Rotina' },
      { slug: 'modules/assets', title: 'Patrimônio' },
      { slug: 'modules/entertainment', title: 'Lazer' },
      { slug: 'modules/legal', title: 'Jurídico' },
      { slug: 'modules/housing', title: 'Moradia' },
      { slug: 'modules/calendar', title: 'Agenda' },
    ],
  },
  {
    category: 'Referência',
    items: [
      { slug: 'comandos/referencia', title: 'Comandos do Agente' },
      { slug: 'config/variaveis', title: 'Variáveis de Ambiente' },
      { slug: 'changelog', title: 'Changelog' },
    ],
  },
];

export function flattenNav(): WikiItem[] {
  return WIKI_NAV.flatMap((cat) => cat.items);
}

export function findItem(slug: string): WikiItem | undefined {
  return flattenNav().find((item) => item.slug === slug);
}
