# Módulo: Pessoas (CRM)

## O que Rastreia

O módulo de pessoas é um CRM pessoal — não uma lista de contatos, mas um sistema de gestão de relacionamentos.

> 🧩 **Para leigos:** CRM (Customer Relationship Management) é um termo de vendas para "sistema de gestão de relacionamentos". Aqui, aplicamos o mesmo conceito à vida pessoal: ao invés de "clientes", são amigos, família, parceiros, mentores. Você configura com que frequência quer falar com cada pessoa, e o sistema avisa quando está atrasado. Rastreia quem são as pessoas importantes na sua vida, quando você interagiu com elas, o que conversaram, o que você sabe sobre elas, e quando precisa entrar em contato novamente.

A filosofia é similar ao Clay ou Monica CRM: relacionamentos precisam de intenção e sistema. Sem sistema, você perde contato com pessoas importantes sem perceber.

## Tabelas no Banco

| Tabela | O que armazena |
|--------|---------------|
| `people` | Pessoas (nome, empresa, cargo, notas, aniversário, frequência desejada de contato) |
| `interactions` | Interações registradas (tipo, data, notas, próxima ação) |

### Estrutura de uma Pessoa

```typescript
type Person = {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  birthday?: string;
  relationship_type: 'amigo' | 'familiar' | 'profissional' | 'mentor' | 'cliente';
  contact_frequency_days?: number;  // quantos dias entre contatos
  last_contact_at?: string;
  notes?: string;
  tags?: string[];
};

type Interaction = {
  id: string;
  person_id: string;
  type: 'ligação' | 'mensagem' | 'encontro' | 'email' | 'outro';
  date: string;
  summary: string;
  next_action?: string;
  next_action_date?: string;
};
```

## Keywords que Ativam o Módulo

```
pessoa, contato, ligou, mensagem, encontrei, aniversário
```

Exemplos de mensagens que ativam o módulo:
- "o João me ligou hoje"
- "encontrei a Maria no café"
- "aniversário do Pedro amanhã"
- "preciso ligar pro meu sócio"

## Tools do Agente

| Tool | Parâmetros principais | Quando usar |
|------|----------------------|-------------|
| `create_person` | name, company?, role?, phone?, relationship_type | Adicionar nova pessoa ao CRM |
| `find_person_by_name` | name | Buscar pessoa existente (fuzzy match) |
| `log_interaction` | person_id ou name, type, summary, next_action? | Registrar interação |

## Comandos Comuns no Chat

```
"o João Silva me ligou hoje, falamos sobre o projeto Atlas"
→ find_person_by_name("João Silva")
→ log_interaction({ person: João, type: "ligação", summary: "Falamos sobre projeto Atlas" })

"adiciona a Maria Santos, médica do HC, vou trabalhar com ela"
→ create_person({ name: "Maria Santos", company: "HC", role: "Médica", relationship_type: "profissional" })

"encontrei o Pedro hoje no café, tá bem"
→ log_interaction({ person: Pedro, type: "encontro", summary: "Encontro casual no café, está bem" })

"anota que preciso ligar pro meu sócio amanhã"
→ log_interaction({ ..., next_action: "ligar", next_action_date: "amanhã" })

"quem não falo há mais de 30 dias?"
→ Consulta people com last_contact_at < 30 dias atrás
```

## Contexto L0/L1/L2

### L0 (~40 tokens)
```
[people] 24 contatos ativos. 3 pessoas para contactar esta semana.
```

### L1 (~400 tokens)
```
Contatos recentes (7 dias):
  - João Silva (EdiculaWorks): ligação 20/03 — projeto Atlas em andamento
  - Dr. Carlos: encontro 18/03 — reunião médica mensal
Próximas ações:
  - Pedro Alves: ligar até 25/03 (configurado)
  - Maria Santos: mensagem de aniversário (dia 28/03)
Fila de reach-out (não fala há muito):
  - Rafael Lima: 45 dias sem contato (frequência: 30 dias)
  - Ana Costa: 62 dias sem contato (frequência: 30 dias)
```

### L2 (~600 tokens)
Ativado por nomes específicos ou "histórico de":
```
Perfil completo da pessoa + histórico de todas as interações com ela
```

## Dashboard

A página `/dashboard/people` inclui:

- **CRM Header**: total de contatos, interações esta semana
- **Person Profile**: view detalhada de uma pessoa com histórico completo
- **Reach Out Queue**: lista de pessoas que precisam de contato (baseado em `contact_frequency_days`)
- **Próximas ações**: ações agendadas com pessoas

## Reach Out Queue

> 💡 **Dica:** Configure `contact_frequency_days` para cada pessoa de acordo com a importância do relacionamento. Amigos próximos: 7-14 dias. Mentores: 30 dias. Contatos profissionais: 60-90 dias. O sistema cuida do lembrete.

O sistema calcula automaticamente quem precisa de atenção:

```typescript
// Pessoas onde: hoje > last_contact_at + contact_frequency_days
const overdueContacts = await db
  .from('people')
  .select('*')
  .lt('last_contact_at', subDays(new Date(), person.contact_frequency_days));
```

Isso aparece no L1 e na página do dashboard, criando uma fila de prioridades de relacionamento.

## Integração com Outros Módulos

- **Calendar**: aniversários de pessoas viram eventos no calendário
- **Objectives**: objetivos podem ser vinculados a pessoas (ex: "fechar parceria com Maria")
- **Memory**: o agente extrai memórias do tipo `entity` para pessoas importantes mencionadas frequentemente
