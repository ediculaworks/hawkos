# Hawk OS — Tutorial Completo do Agente

> Guia de referência para usar o sistema Hawk OS: comandos Discord, linguagem natural, automações, memória e dashboard web.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Como Acessar o Agente](#2-como-acessar-o-agente)
3. [Comandos Slash por Módulo](#3-comandos-slash-por-módulo)
   - [Finanças](#finanças)
   - [Calendário](#calendário)
   - [Rotina](#rotina)
   - [Objetivos](#objetivos)
   - [Pessoas (CRM)](#pessoas-crm)
   - [Carreira](#carreira)
   - [Jurídico](#jurídico)
   - [Conhecimento](#conhecimento)
   - [Saúde](#saúde)
   - [Diário](#diário)
   - [Segurança](#segurança)
   - [Social / Conteúdo](#social--conteúdo)
   - [Patrimônio e Documentos](#patrimônio-e-documentos)
   - [Moradia](#moradia)
   - [Entretenimento](#entretenimento)
   - [Espiritualidade](#espiritualidade)
4. [Linguagem Natural com o Agente](#4-linguagem-natural-com-o-agente)
5. [Ferramentas do Agente (AI Tools)](#5-ferramentas-do-agente-ai-tools)
6. [Automações Automáticas](#6-automações-automáticas)
7. [Sistema de Memória](#7-sistema-de-memória)
8. [Dashboard Web](#8-dashboard-web)
9. [Exemplos de Uso Real](#9-exemplos-de-uso-real)

---

## 1. Visão Geral

O **Hawk OS** é um sistema operacional de vida pessoal com AI. Funciona em duas camadas:

| Camada | Interface | Uso principal |
|--------|-----------|---------------|
| **Agente Discord** | Bot no canal `#geral` | Input primário — registrar, consultar, conversar |
| **Dashboard Web** | `localhost:3000/dashboard` | Visualizar, editar, deletar, configurar |

### Os 16 Módulos

| # | Módulo | Finalidade |
|---|--------|-----------|
| 1 | **Finanças** | Transações, contas, orçamento, portfólio |
| 2 | **Saúde** | Treinos, sono, peso, medicamentos, labs |
| 3 | **Pessoas** | CRM completo: contatos, interações, rede |
| 4 | **Carreira** | Horas, projetos, currículo, habilidades |
| 5 | **Objetivos** | Metas de vida, tarefas, kanban, sprints |
| 6 | **Conhecimento** | Notas, livros, insights, segunda mente |
| 7 | **Rotina** | Hábitos com streaks e pontuação |
| 8 | **Patrimônio** | Bens físicos e documentos importantes |
| 9 | **Entretenimento** | Filmes, séries, jogos, hobbies |
| 10 | **Jurídico** | Obrigações fiscais, contratos, entidades |
| 11 | **Social** | Pipeline de conteúdo para redes sociais |
| 12 | **Espiritualidade** | Reflexões, valores, intenções |
| 13 | **Moradia** | Contas domésticas, manutenção |
| 14 | **Segurança** | Checklist digital/físico de segurança |
| 15 | **Calendário** | Eventos, agenda, disponibilidade |
| 16 | **Diário** | Entradas diárias, humor, energia |

---

## 2. Como Acessar o Agente

### Via Discord (Primário)

**Comandos slash** — início rápido e estruturado:
```
/gasto 50 Alimentação descrição:"Almoço no restaurante"
```

**Linguagem natural** — para contexto, análise e operações complexas:
```
Qual foi meu gasto médio com alimentação nos últimos 3 meses?
Cria uma tarefa para revisar o contrato da Eduart até sexta
Lembra que eu prefiro treinar de manhã
```

**Regras de interação:**
- O agente só responde a mensagens no canal configurado (`DISCORD_CHANNEL_GERAL`)
- Apenas o usuário autorizado (`DISCORD_AUTHORIZED_USER_ID`) pode usar
- Sessões expiram após **30 minutos** de inatividade (memórias são extraídas automaticamente)

### Via Dashboard Web

Acesse `/dashboard/chat` para conversar com o agente direto pelo browser. Funciona igual ao Discord com histórico de sessões.

### Automações (passivas)

O agente também envia mensagens proativas sem que você precise fazer nada — veja a [seção de automações](#6-automações-automáticas).

---

## 3. Comandos Slash por Módulo

> **Legenda:** `<obrigatório>` | `[opcional]`

---

### Finanças

#### `/gasto`
Registra uma despesa.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `valor` | número | Valor da transação |
| `categoria` | string | Ex: Alimentação, Transporte, Saúde |
| `descricao` | string (opt.) | Descrição adicional |
| `conta` | string (opt.) | Nome da conta (padrão: primeira conta) |

**Exemplo:**
```
/gasto 89.90 Alimentação descrição:"Supermercado Pão de Açúcar"
```

---

#### `/receita`
Registra uma entrada financeira.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `valor` | número | Valor recebido |
| `categoria` | string | Ex: Salário, Freelance, Dividendos |
| `descricao` | string (opt.) | Descrição adicional |

---

#### `/saldo`
Resumo financeiro mensal.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `periodo` | enum (opt.) | `mes` / `semana` / `hoje` / `30dias` |

---

### Calendário

#### `/event`
Cria um evento na agenda.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `titulo` | string | Nome do evento |
| `data` | string | Data (DD/MM ou YYYY-MM-DD) |
| `hora` | string (opt.) | Horário (HH:MM) |
| `duracao` | número (opt.) | Duração em minutos |
| `descricao` | string (opt.) | Notas do evento |
| `local` | string (opt.) | Localização |

---

#### `/agenda`
Visualiza eventos próximos.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `view` | enum (opt.) | `7dias` / `30dias` / `hoje` / `proximos` |
| `data` | string (opt.) | Data específica (YYYY-MM-DD) |

---

#### `/remind`
Cria um lembrete para um evento.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `evento` | string | Nome ou ID do evento |
| `minutos` | enum (opt.) | `5` / `15` / `30` / `60` / `1440` (1 dia) |
| `tipo` | enum (opt.) | `notification` / `email` |

---

### Rotina

#### `/habito check`
Marca um hábito como feito hoje.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `nome` | string | Nome do hábito |
| `nota` | string (opt.) | Observação opcional |

**Exemplo:**
```
/habito check Meditação nota:"20 minutos, foco total"
```

---

#### `/habito list`
Lista todos os hábitos com status do dia e streaks.

---

#### `/habito novo`
Cria um novo hábito.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `nome` | string | Nome do hábito |
| `freq` | enum | `daily` / `weekly_2x` / `weekly_3x` / `weekdays` |
| `icone` | string (opt.) | Emoji (ex: 🏋️) |

---

#### `/habito nao`
Marca um hábito como não feito (registra falta).

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `nome` | string | Nome do hábito |

---

### Objetivos

#### `/meta list`
Lista objetivos organizados por prazo.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `prazo` | enum (opt.) | `curto` / `medio` / `longo` |

---

#### `/meta novo`
Cria um novo objetivo.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `titulo` | string | Título do objetivo |
| `prazo` | enum | `curto` / `medio` / `longo` |
| `descricao` | string (opt.) | Descrição detalhada |
| `prioridade` | número (opt.) | 1 a 10 |

---

#### `/meta progresso`
Atualiza o progresso de um objetivo.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `titulo` | string | Nome do objetivo |
| `valor` | número | Progresso (0–100) |

---

#### `/tarefa add`
Cria uma nova tarefa.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `titulo` | string | Título da tarefa |
| `prioridade` | enum (opt.) | `low` / `medium` / `high` / `urgent` |
| `data` | string (opt.) | Data de vencimento (YYYY-MM-DD) |

---

#### `/tarefa list`
Lista tarefas pendentes por prioridade/status.

---

#### `/tarefa done`
Marca uma tarefa como concluída.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `titulo` | string | Nome da tarefa |

---

#### `/tarefa bloquear`
Marca uma tarefa como bloqueada.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `titulo` | string | Nome da tarefa |

---

### Pessoas (CRM)

#### `/pessoa`
Exibe o perfil de uma pessoa: histórico de interações, última conversa, aniversário, frequência de contato.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `nome` | string | Nome da pessoa |

---

#### `/interacao`
Registra uma interação com alguém.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `nome` | string | Nome da pessoa |
| `tipo` | enum | `call` / `meeting` / `message` / `visit` / `email` |
| `resumo` | string (opt.) | O que foi discutido |
| `sentimento` | enum (opt.) | `positive` / `neutral` / `negative` |
| `duracao` | número (opt.) | Duração em minutos |

**Exemplo:**
```
/interacao "Pedro Alves" call resumo:"Alinhamos sobre o projeto" sentimento:positive
```

---

#### `/aniversarios`
Lista aniversários nos próximos 30 dias.

---

#### `/contatos`
Lista contatos que estão há mais tempo sem interação (overdue por frequência configurada).

---

#### `/como-nos-conhecemos`
Registra como você se conheceu com alguém.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `nome` | string | Nome da pessoa |
| `descricao` | string | Como se conheceram |
| `local` | string (opt.) | Onde foi |
| `data` | string (opt.) | Quando foi (YYYY-MM-DD) |

---

#### `/lembrar`
Define frequência de contato com uma pessoa.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `nome` | string | Nome da pessoa |
| `frequencia` | enum | `daily` / `weekly` / `biweekly` / `monthly` / `quarterly` |
| `intervalo` | número (opt.) | Intervalo personalizado em dias |
| `descricao` | string (opt.) | Motivo/contexto |

---

#### `/dormentes`
Lista contatos sem nenhum contato nos últimos 30+ dias.

---

### Carreira

#### `/horas`
Registra horas trabalhadas.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `workspace` | string | Nome da empresa/workspace |
| `minutos` | número | Tempo trabalhado em minutos |
| `projeto` | string (opt.) | Projeto específico |
| `descricao` | string (opt.) | O que foi feito |

---

#### `/perfil`
Exibe resumo do perfil de carreira: experiências, habilidades, formação.

---

#### `/experiencia`
Gerencia histórico de experiências profissionais.

---

#### `/formacao`
Gerencia histórico acadêmico.

---

#### `/skill`
Gerencia habilidades técnicas/soft com nível de proficiência.

---

#### `/certificado`
Gerencia certificações com datas de validade.

---

#### `/projetos`
Lista projetos ativos por workspace.

---

### Jurídico

#### `/obrigacoes`
Lista obrigações fiscais/legais pendentes com urgência.

**Urgências:**
- 🔴 `critical` — vencida ou vence hoje
- 🟠 `urgent` — vence em ≤ 7 dias
- 🟡 `warning` — vence em ≤ 15 dias
- ✅ `ok` — prazo confortável

---

#### `/contratos`
Lista contratos ativos com datas e valores.

---

### Conhecimento

#### `/nota add`
Salva uma nota, insight ou referência.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `conteudo` | string | Texto da nota |
| `tipo` | enum (opt.) | `note` / `insight` / `reference` / `quote` / `book_note` |
| `fonte` | string (opt.) | URL ou livro de origem |
| `titulo` | string (opt.) | Título da nota |

---

#### `/nota buscar`
Busca full-text nas notas.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `query` | string | Texto a buscar |

---

#### `/nota recentes`
Exibe as últimas 10 notas salvas.

---

#### `/livro add`
Adiciona um livro à lista de leitura.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `titulo` | string | Título do livro |
| `autor` | string (opt.) | Nome do autor |

---

#### `/livro lendo`
Marca um livro como "lendo atualmente".

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `titulo` | string | Título do livro |

---

#### `/livro done`
Marca um livro como lido.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `titulo` | string | Título do livro |
| `nota` | número (opt.) | Avaliação de 1 a 5 |
| `resumo` | string (opt.) | Aprendizados principais |

---

#### `/livro list`
Lista livros por status.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `status` | enum (opt.) | `want` / `reading` / `completed` / `abandoned` |

---

### Saúde

#### `/saude hoje`
Resumo de saúde do dia: sono, treino, humor, medicamentos.

#### `/saude semana`
Estatísticas da semana.

---

#### `/sono add`
Registra uma sessão de sono.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `horas` | número | Horas dormidas |
| `qualidade` | enum (opt.) | `1`–`5` (1=péssimo, 5=ótimo) |
| `nota` | string (opt.) | Observação (ex: acordei 2x) |

#### `/sono hoje` / `/sono semana`
Visualiza dados de sono.

---

#### `/treino add`
Registra uma sessão de treino.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `tipo` | enum | `musculacao` / `corrida` / `ciclismo` / `natacao` / `caminhada` / `skate` / `futebol` / `outro` |
| `duracao` | número (opt.) | Duração em minutos |
| `nota` | string (opt.) | Observações |

---

#### `/treino serie`
Registra uma série de exercício.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `exercicio` | string | Nome do exercício |
| `serie` | número | Número da série |
| `reps` | número (opt.) | Repetições |
| `carga` | número (opt.) | Peso em kg |
| `rpe` | número (opt.) | Esforço percebido (1–10) |

#### `/treino hoje` / `/treino historico`
Visualiza treinos.

---

#### `/corpo peso`
Registra o peso atual (kg).

---

#### `/remedio`
Subcomandos para gerenciar medicamentos e aderência.

---

#### `/substancia`
Registra uso de substâncias (café, álcool, tabaco, cannabis) para tracking de hábitos.

---

#### `/exame`
Gerencia resultados de exames laboratoriais.

---

### Diário

#### `/diario add`
Cria uma entrada de diário.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `texto` | string | Conteúdo da entrada |
| `humor` | número (opt.) | Humor de 1 a 10 |
| `energia` | número (opt.) | Energia de 1 a 10 |
| `tipo` | enum (opt.) | `daily` / `reflection` / `gratitude` / `freeform` |

---

#### `/diario humor`
Check-in rápido de humor e energia.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `valor` | número | Humor de 1 a 10 |
| `energia` | número (opt.) | Energia de 1 a 10 |

---

#### `/diario hoje` / `/diario semana`
Visualiza entradas do período.

---

### Segurança

#### `/seguranca status`
Resumo do checklist de segurança (ok / atenção / crítico).

#### `/seguranca list`
Lista itens por categoria.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `categoria` | enum (opt.) | `accounts` / `backups` / `2fa` / `passwords` / `recovery` |

#### `/seguranca ok`
Marca um item como verificado.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do item |
| `proxima` | string (opt.) | Próxima revisão (YYYY-MM-DD) |

#### `/seguranca alerta`
Marca um item como crítico.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do item |
| `nota` | string (opt.) | Descrição do problema |

#### `/seguranca pendentes`
Lista itens com status pendente ou crítico.

---

### Social / Conteúdo

#### `/post idea`
Salva uma ideia de conteúdo.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `plataforma` | enum | `instagram` / `linkedin` / `twitter` / `tiktok` |
| `conteudo` | string | Ideia ou rascunho |
| `tags` | string (opt.) | Tags separadas por vírgula |

#### `/post list`
Lista posts por status e plataforma.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `status` | enum (opt.) | `idea` / `draft` / `published` |
| `plataforma` | enum (opt.) | Filtrar por plataforma |

#### `/post publicar`
Marca um post como publicado.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do post |
| `url` | string (opt.) | URL da publicação |

#### `/post stats`
Resumo do pipeline por plataforma.

---

### Patrimônio e Documentos

#### `/bem`
Gerencia bens físicos (eletrônicos, veículos, imóveis, móveis).

#### `/documento`
Gerencia documentos importantes (RG, CNH, contratos, IPTU) com alertas de vencimento.

---

### Moradia

#### `/moradia`
Visualiza residências, contratos de aluguel e contas domésticas.

#### `/conta`
Registra e gerencia contas domésticas (água, luz, internet, aluguel) com datas de vencimento.

---

### Entretenimento

#### `/midia`
Adiciona ou atualiza filmes, séries, jogos e podcasts com status.

#### `/hobby`
Registra atividades de hobby com duração.

---

### Espiritualidade

#### `/reflexao`
Registra reflexões, gratidões, intenções, valores ou mantras.

---

## 4. Linguagem Natural com o Agente

O agente entende linguagem natural e usa o contexto carregado automaticamente. Use mensagens livres para tudo que os slash commands não cobrem.

### Exemplos por Módulo

**Finanças:**
```
Quanto gastei com restaurante esse mês?
Como está meu orçamento de alimentação vs o que planejei?
Mostra minha alocação de portfólio atual
Qual meu patrimônio líquido hoje?
```

**Rotina:**
```
Como estão meus hábitos essa semana?
Quais hábitos estou em risco de quebrar o streak?
Me dá um resumo da minha rotina
```

**Objetivos:**
```
Quais tarefas estão atrasadas?
Cria um objetivo de curto prazo: terminar o livro X até mês que vem
Me conta o progresso dos meus objetivos de 2026
```

**Pessoas:**
```
Com quem não falo há mais de um mês?
O que sei sobre a Maria Silva?
Registra que tive uma reunião excelente com João hoje, falamos sobre a startup
```

**Saúde:**
```
Como foi minha semana de treinos?
Qual meu PR de agachamento?
Como está minha aderência de medicamentos?
Mostra evolução do meu peso nos últimos 3 meses
```

**Conhecimento:**
```
O que tenho anotado sobre produtividade?
Busca minhas notas sobre TypeScript
Salva: "O sucesso é a soma de pequenos esforços repetidos" - Robert Collier
```

**Diário:**
```
Como foi meu humor médio essa semana?
Escreve no diário: hoje foi um dia produtivo, fechei 3 tarefas importantes
Qual meu streak de entradas de diário?
```

### Memória e Preferências

Para o agente lembrar de algo permanentemente:
```
Lembra que eu prefiro receber alertas resumidos, não detalhados
Lembra que meu objetivo principal de 2026 é passar no concurso X
Lembra que a Maria Silva é minha sócia na Eduart
Anota que meu horário preferido de treino é às 7h
```

---

## 5. Ferramentas do Agente (AI Tools)

Estas são as capacidades internas que o agente usa automaticamente ao processar suas mensagens. Você não as chama diretamente — o agente decide quando usar cada uma.

### Finanças
| Tool | O que faz |
|------|-----------|
| `create_transaction` | Registra gasto ou receita |
| `get_financial_summary` | Resumo do mês (receitas, despesas, saldo) |
| `get_portfolio_summary` | Posições de investimento e alocação |
| `get_budget_status` | Orçamento vs real por categoria |

### Rotina
| Tool | O que faz |
|------|-----------|
| `log_habit` | Marca hábito como feito/não feito |
| `create_habit` | Cria novo hábito |
| `get_habit_scores` | Scores de consistência e hábitos em risco |

### Objetivos
| Tool | O que faz |
|------|-----------|
| `create_objective` | Cria novo objetivo (short/medium/long) |
| `create_task` | Cria nova tarefa com prioridade/prazo |

### Pessoas
| Tool | O que faz |
|------|-----------|
| `create_person` | Adiciona pessoa ao CRM |
| `log_interaction` | Registra interação (call/meeting/message/visit/email) |

### Carreira
| Tool | O que faz |
|------|-----------|
| `log_work` | Registra horas trabalhadas por workspace |

### Diário
| Tool | O que faz |
|------|-----------|
| `write_journal` | Salva entrada com texto, humor e energia |

### Espiritualidade
| Tool | O que faz |
|------|-----------|
| `create_reflection` | Registra reflexão/gratidão/intenção/valores/mantra |

### Calendário
| Tool | O que faz |
|------|-----------|
| `create_event` | Cria evento com localização e descrição |
| `find_free_slots` | Encontra horários livres para uma duração |

### Saúde
| Tool | O que faz |
|------|-----------|
| `log_sleep` | Registra sono com horas e qualidade |
| `log_workout` | Registra treino com tipo e duração |
| `log_weight` | Registra peso corporal |
| `log_workout_set` | Registra série de exercício (reps/carga/RPE) |
| `get_exercise_history` | Progresso de exercício + 1RM estimado |

### Conhecimento
| Tool | O que faz |
|------|-----------|
| `create_note` | Salva nota/insight/referência/citação |
| `search_knowledge` | Busca full-text nas notas |

### Entretenimento
| Tool | O que faz |
|------|-----------|
| `add_media` | Adiciona filme/série/livro/jogo à lista |

### Memória (Universal)
| Tool | O que faz |
|------|-----------|
| `save_memory` | Salva memória de longo prazo (6 tipos) |
| `ask_deepening_question` | Busca próxima pergunta de profiling |
| `mark_question_answered` | Marca pergunta de profiling respondida |

### Utilidades (Universal)
| Tool | O que faz |
|------|-----------|
| `lookup_cep` | Busca endereço por CEP (BrasilAPI) |
| `lookup_cnpj` | Busca dados de empresa por CNPJ (BrasilAPI) |

---

## 6. Automações Automáticas

O agente envia mensagens proativas sem que você precise solicitar.

### ⚡ Alertas Diários — 08:00

Envia automaticamente no canal quando há algo urgente:

| Trigger | Alerta |
|---------|--------|
| Aniversário **hoje** | 🎂 HOJE é aniversário de X |
| Aniversário em ≤ 3 dias | 🎂 Aniversário de X em N dias |
| Obrigação fiscal **vencida** | 🔴 VENCIDA: nome + valor |
| Obrigação fiscal **hoje** | 🔴 HOJE vence: nome |
| Obrigação em ≤ 7 dias | 🟠 Nd para: nome |
| Obrigação em ≤ 15 dias | 🟡 Nd para: nome |
| Documento vencendo em ≤ 7 dias | 🔴 Documento: nome |
| Documento vencendo em ≤ 30 dias | 🟡 Documento: nome |
| Contrato vencendo em ≤ 7 dias | 🔴 Contrato: nome |
| Contrato vencendo em ≤ 30 dias | 🟡 Contrato: nome |
| Contatos overdue | 📞 Contatos pendentes: nome1, nome2... |

### 🌅 Check-in Matinal — 09:00

Mensagem de bom dia com:
- Dia da semana + data
- Feriado do dia (se houver) — via BrasilAPI
- Hábitos pendentes para hoje
- **Pergunta de profiling do dia** (para construir seu perfil ao longo do tempo)
- Solicita humor (1-10) e energia (1-10) + top 3 do dia

**Resposta esperada:**
```
humor 8 energia 7
```

### 🌙 Check-out Noturno — 22:00

Mensagem de encerramento do dia com:
- Lista de hábitos ✅ feitos / ⬜ pendentes
- Taxa de conclusão (X/total)
- Humor registrado no dia (se houver)
- Prompt para registrar destaque do dia

### 📊 Revisão Semanal — Domingos às 20:00

Relatório semanal automático com:
- Taxa de conclusão de hábitos por hábito
- Entradas de diário + tendência de humor
- Progresso em objetivos de alta prioridade
- Sugestões de foco: hábitos fracos, objetivos estagnados

### 🔐 Revisão de Segurança — Dia 1 de cada mês às 10:00

- Resumo do checklist: ok / pendentes / críticos
- Lista de itens para revisar no mês

### ⏰ Session Compactor — A cada hora

Processa sessões expiradas (30+ min sem atividade):
1. Arquiva mensagens da sessão
2. Extrai memórias importantes automaticamente
3. Deduplica contra memórias existentes
4. Persiste no sistema V2

---

## 7. Sistema de Memória

O agente possui memória persistente entre sessões. Tudo que você pede para lembrar fica disponível permanentemente.

### 6 Tipos de Memória

| Tipo | Uso | Exemplos |
|------|-----|---------|
| `profile` | Quem você é | Profissão, objetivos de vida, identidade |
| `preference` | Como você prefere as coisas | Horários, formatos, hábitos de trabalho |
| `entity` | Pessoas, empresas, projetos | "Maria Silva é minha sócia" |
| `event` | Acontecimentos importantes | "Em março de 2026 fundei X" |
| `case` | Situações recorrentes | "Quando sinto X, geralmente faço Y" |
| `pattern` | Padrões identificados pelo agente | Comportamentos observados ao longo do tempo |

### Como Salvar Memórias

**Via linguagem natural:**
```
Lembra que prefiro reuniões pela manhã
Anota que a Eduart tem 3 sócios: eu, Pedro e Ana
Memoriza que meu médico é o Dr. Carlos Silva no Hospital X
```

**Via comando explícito do agente** — quando ele identifica algo relevante, salva automaticamente com `save_memory`.

### Hotness Scoring

Memórias frequentemente acessadas ganham peso maior no rankeamento:
- Score = `sigmoid(log(acessos + 1)) × exp(-dias_desde_acesso / 7)`
- Memórias "quentes" aparecem primeiro no contexto do agente

### Deduplicação Automática

O session compactor roda deduplicação em 2 estágios:
1. **Pre-filter vetorial** — busca memórias similares por embedding
2. **Decisão LLM** — decide se mesclar, substituir ou manter ambas

---

## 8. Dashboard Web

Acesse em `localhost:3000/dashboard` (ou URL de produção).

### Páginas Disponíveis

| URL | Página |
|-----|--------|
| `/dashboard` | Grid principal com widgets customizáveis |
| `/dashboard/chat` | Chat com o agente |
| `/dashboard/finances` | Finanças completa |
| `/dashboard/health` | Saúde completa |
| `/dashboard/people` | CRM completo |
| `/dashboard/objectives` | Objetivos e tarefas |
| `/dashboard/routine` | Hábitos e streaks |
| `/dashboard/journal` | Diário |
| `/dashboard/calendar` | Calendário |
| `/dashboard/knowledge` | Notas e livros |
| `/dashboard/career` | Carreira |
| `/dashboard/legal` | Jurídico |
| `/dashboard/assets` | Patrimônio |
| `/dashboard/housing` | Moradia |
| `/dashboard/security` | Segurança |
| `/dashboard/entertainment` | Entretenimento |
| `/dashboard/social` | Social/Conteúdo |
| `/dashboard/spirituality` | Espiritualidade |
| `/dashboard/mission-control` | Logs de atividade + sessões |
| `/dashboard/agents` | Gerenciar agentes |
| `/dashboard/memory` | Visualizar e editar memórias |
| `/dashboard/settings` | Configurações |
| `/dashboard/automations` | Regras e automações |

### Widgets do Grid Principal

O dashboard principal usa um grid de **12 colunas** drag-and-drop. Adicione, remova e redimensione widgets conforme preferir.

| Widget | Módulo | Tamanho padrão |
|--------|--------|----------------|
| Resumo Financeiro | Finanças | 4×4 |
| Transações Recentes | Finanças | 4×4 |
| Categorias (gráfico) | Finanças | 4×4 |
| Hábitos de Hoje | Rotina | 4×5 |
| Streaks de Hábitos | Rotina | 4×3 |
| Metas de Vida | Objetivos | 4×4 |
| Tarefas Ativas | Objetivos | 4×4 |
| Tendência de Humor | Diário | 4×3 |
| Anotação Rápida | Diário | 4×4 |
| Saúde (pulse) | Saúde | 4×4 |
| Próximos Contatos | Pessoas | 4×4 |
| Contatos Dormentes | Pessoas | 4×4 |
| Pessoas desta Semana | Pessoas | 4×4 |
| Prazos (calendário) | Calendário | 4×4 |
| Trabalho/Renda | Carreira | 4×5 |
| Contas Domésticas | Moradia | 4×4 |
| Pipeline de Conteúdo | Social | 4×4 |
| Estatísticas de Memória | Sistema | 3×3 |
| Score de Vida | Sistema | 3×3 |

**Como customizar o layout:**
- Arraste widgets para reposicionar
- Arraste pela borda inferior-direita para redimensionar
- Layout é salvo automaticamente no localStorage

---

## 9. Exemplos de Uso Real

### Registro diário de finanças

```
# Via slash command (rápido):
/gasto 45.90 Alimentação descrição:"Almoço trabalho"
/gasto 8.50 Transporte descrição:"Uber"
/receita 5000 Salário descrição:"Pagamento Eduart"

# Via linguagem natural (com contexto):
"Gastei R$120 no supermercado e R$45 no restaurante hoje"
```

---

### Check-in de rotina matinal

```
# Após o check-in automático das 09:00, responda:
humor 8 energia 7

# Marque hábitos feitos:
/habito check Meditação
/habito check "Leitura 30min"
/habito check Treino nota:"Leg day pesado"
```

---

### Gerenciando relacionamentos

```
# Registra interação:
/interacao "João Marcos" meeting resumo:"Revisamos pitch do produto" sentimento:positive duracao:60

# Consulta perfil:
/pessoa "Maria Ana"

# Verifica quem está dormindo:
/dormentes

# Define frequência de contato:
/lembrar "Pedro Alves" monthly descrição:"Manter relação com ex-sócio"
```

---

### Planejando objetivos

```
# Cria objetivo:
/meta novo "Passar no CREMESP" prazo:curto prioridade:9

# Adiciona tarefas:
/tarefa add "Estudar Clínica Médica - Cap 1-5" prioridade:high data:2026-03-25
/tarefa add "Fazer simulado ENARE 2025" prioridade:high

# Acompanha progresso:
/meta list curto
/tarefa list

# Marca concluída:
/tarefa done "Estudar Clínica Médica - Cap 1-5"
```

---

### Registrando treino completo

```
# Inicia a sessão:
/treino add musculacao duracao:65

# Registra séries:
/treino serie "Agachamento" 1 reps:8 carga:100 rpe:8
/treino serie "Agachamento" 2 reps:8 carga:100 rpe:9
/treino serie "Leg Press" 1 reps:12 carga:200

# Ou via linguagem natural:
"Fiz leg hoje: agachamento 3x8 a 100kg, leg press 3x12 a 200kg, 65 minutos"
```

---

### Salvando conhecimento

```
# Nota rápida:
/nota add "Protocolo de sono: 7-9h, sem tela 1h antes, temperatura 18-20°C" tipo:reference

# Citação:
/nota add "A disciplina é a ponte entre metas e realizações." tipo:quote fonte:"Jim Rohn"

# Livro:
/livro add "O Poder do Hábito" autor:"Charles Duhigg"
/livro lendo "O Poder do Hábito"
/livro done "O Poder do Hábito" nota:5 resumo:"Loop do hábito: deixa → rotina → recompensa. Rotinas podem ser reprogramadas mantendo deixa e recompensa."
```

---

### Usando memória para personalização

```
# Salvar preferências:
"Lembra que prefiro respostas resumidas com bullet points"
"Anota que o meu objetivo financeiro é ter R$100k investido até fim de 2026"
"Memoriza que tenho TDAH e funciono melhor com listas de tarefas pequenas"

# O agente vai usar essas memórias em todas as futuras conversas
```

---

## Dicas Avançadas

**1. Combinando slash commands + linguagem natural**
Use `/gasto` para velocidade máxima no registro, mas peça análises em linguagem natural: *"Compare meu padrão de gastos deste mês vs o mês passado"*.

**2. Contexto automático**
O agente carrega automaticamente o contexto dos módulos relevantes. Mencione "treino" e ele já tem os dados de saúde. Não precisa especificar o módulo.

**3. Sessões de trabalho**
O agente mantém contexto dentro da sessão (30 min). Para projetos longos, trabalhe em sequência para não perder o contexto.

**4. Perguntas de profiling**
O check-in matinal traz uma pergunta por dia para construir seu perfil. Responda para o agente ter mais contexto sobre você ao longo do tempo.

**5. Revisão semanal**
A revisão de domingo (20:00) é o melhor momento para planejar a semana seguinte. Use ela como gatilho para `/meta list` e `/tarefa list`.

---

*Última atualização: março 2026 — Hawk OS v1.0*
