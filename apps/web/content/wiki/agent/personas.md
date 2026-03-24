# Personas do Agente (Templates)

## O que são Personas

Personas são configurações de agente que especializam o comportamento do LLM para um domínio específico. Cada persona tem:

- **System prompt customizado**: estilo de comunicação, foco, restrições
- **Módulos habilitados**: quais módulos de dados o agente pode acessar
- **Tools permitidas**: filtradas pelos módulos habilitados
- **Canal Discord**: qual canal Discord usa esta persona

O agente Hawk padrão é generalista. As personas especializadas são mais eficientes — enviam menos contexto, usam menos tokens e respondem mais focado.

> 🧩 **Para leigos:** Pense nas personas como diferentes "modos" do assistente. O modo Hawk sabe de tudo. O modo CFO só fala de dinheiro. O modo Coach só fala de saúde e hábitos. Você escolhe qual modo usar em qual canal do Discord.

## Os 7 Templates

### 1. Hawk (Padrão)

**Foco**: Generalista, todos os módulos
**Módulos**: Todos os 11 módulos activos
**Quando usar**: Canal principal, conversa geral do dia a dia

O Hawk é o agente completo. Responde sobre qualquer módulo, tem acesso a todas as tools e carrega contexto de todos os módulos. É o "sistema operacional" completo.

```
System prompt: "Você é o Hawk, assistente pessoal de [nome].
Você gerencia todos os aspectos da vida dele: finanças, saúde,
objetivos, relacionamentos, rotina e mais. Seja direto e prático."
```

### 2. CFO

**Foco**: Finanças, patrimônio, jurídico
**Módulos**: `finances`, `legal`, `assets`
**Quando usar**: Canal dedicado a dinheiro e questões empresariais

O CFO foca em análise financeira, planejamento tributário, gestão de patrimônio e obrigações legais. Responde como um CFO de startup — dados precisos, análise crítica, sem rodeios.

```
Tools disponíveis: create_transaction, get_financial_summary,
get_budget_vs_actual, get_accounts, get_portfolio_positions,
search_documents, + universais
```

### 3. Coach

**Foco**: Saúde e rotina
**Módulos**: `health`, `routine`
**Quando usar**: Canal de bem-estar e hábitos

O Coach atua como personal trainer + coach de vida. Registra treinos, monitora hábitos e acompanha o bem-estar geral. Tom mais próximo e encorajador que o Hawk.

```
Tools disponíveis: log_workout, add_workout_set, log_sleep,
log_weight, get_exercise_progress, estimate_1rm,
create_habit, log_habit, get_habits_at_risk, + universais
```

### 4. Career Coach

**Foco**: Carreira e objetivos
**Módulos**: `career`, `objectives`
**Quando usar**: Canal de produtividade e crescimento profissional

O Career Coach ajuda a gerenciar projetos, rastrear horas de trabalho, definir e acompanhar objetivos. Tom estratégico e orientado a resultados.

```
Tools disponíveis: log_work, find_workspace_by_name,
create_objective, create_task, + universais
```

### 5. Chief of Staff

**Foco**: Agenda, objetivos, pessoas
**Módulos**: `calendar`, `objectives`, `people`
**Quando usar**: Canal de coordenação e relacionamentos

O Chief of Staff gerencia sua agenda, acompanha relacionamentos importantes e garante que objetivos estratégicos estão avançando. Funciona como um EA (Executive Assistant) inteligente.

```
Tools disponíveis: create_event, find_free_slots,
create_objective, create_task,
create_person, find_person_by_name, log_interaction, + universais
```

### 6. House Manager

**Foco**: Moradia e patrimônio
**Módulos**: `housing`, `assets`
**Quando usar**: Canal doméstico e gestão de ativos

O House Manager cuida das questões práticas da vida: contas de moradia, manutenções, e inventário de bens. Tom pragmático e organizado.

```
Tools disponíveis: search_documents, + universais
(maioria das operações de housing/assets são via dashboard)
```

> 💡 **Dica:** O House Manager é ótimo para registrar despesas de moradia ("conta de luz chegou R$180") e consultas sobre documentos ("qual o vencimento do meu seguro do carro?").

### 7. Creative Director

**Foco**: Entretenimento e mídia
**Módulos**: `entertainment`
**Quando usar**: Canal criativo e de mídia

O Creative Director rastreia mídias que você consome e recomenda novas. Tom mais descontraído e criativo.

```
Tools disponíveis: create_media, + universais
```

## Roteamento por Canal Discord

O `DISCORD_CHANNEL_MAP` no `.env` mapeia canais Discord para templates de agente:

```env
DISCORD_CHANNEL_MAP=1234567890:hawk-default,9876543210:cfo-template,1111111111:coach-template
# Formato: channelId:agentTemplateId,...
```

Quando uma mensagem chega no Discord, o sistema:
1. Identifica o canal de origem
2. Busca o template correspondente no mapa
3. Carrega as configurações da persona (system prompt, módulos, tools)
4. Processa com o contexto correto

Se o canal não está no mapa, usa o template padrão (Hawk).

## Gerenciando Personas

### Via Dashboard

Acesse `/dashboard/agents` para:
- Ver todos os agentes configurados
- Criar nova persona com formulário
- Editar system prompt, módulos e configurações
- Deletar personas (exceto o Hawk — agente do sistema)

> ⚠️ **Atenção:** O agente `hawk` é protegido pelo sistema e não pode ser deletado. Todos os outros podem ser editados ou removidos livremente.

### Criando uma Persona Nova

Via `/dashboard/agents/new`:

```
Nome: "CFO Pessoal"
System Prompt: "Você é o CFO pessoal. Análise financeira rigorosa..."
Módulos Habilitados: finances, legal, assets
Tools Habilitadas: null (herda dos módulos) ou lista específica
Canal Discord: ID do canal
```

## Como Templates Afetam o Escopo de Tools

O campo `toolsEnabled` no template funciona como lista de permissão adicional:

```typescript
// null = todas as tools dos módulos habilitados
toolsEnabled: null

// array = apenas estas tools específicas
toolsEnabled: ['create_transaction', 'get_financial_summary', 'save_memory']
```

O pipeline combina duas listas:
1. Tools detectadas pelos módulos da mensagem
2. Tools permitidas pelo template (`toolsEnabled`)

A interseção é o que o LLM recebe. Isso permite criar personas muito restritas (ex: um agente que só pode ler dados, nunca escrever).

> 🧩 **Para leigos:** `toolsEnabled: null` significa "pode fazer tudo que o módulo permite". Se você colocar uma lista específica, o agente só consegue fazer exatamente o que está na lista. Útil para criar agentes muito focados ou seguros.

## Automações e Personas

Cada automação (daily check-in, weekly review, etc.) usa o template Hawk por padrão. Você pode configurar automações específicas para usar outras personas no código de cada automação em `apps/agent/src/automations/`.
