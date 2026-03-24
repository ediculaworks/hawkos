# Referência de Comandos do Agente

Guia de referência rápida para interagir com o Hawk OS via Discord ou chat web. O agente entende linguagem natural — não precisa seguir sintaxe exata. Use estas frases como ponto de partida.

> 🧩 **Para leigos:** Você não precisa decorar nenhum comando. Fale como falaria com uma pessoa. "Gastei 50 reais no mercado hoje" funciona perfeitamente. Esta página é só uma referência do que é possível fazer.

---

## Finanças

| O que dizer | O que acontece | Tool chamada |
|-------------|---------------|--------------|
| "gastei R$50 no mercado" | Registra transação de R$50 em alimentação | `create_transaction` |
| "gastei R$120 no posto, conta Nubank" | Registra em transporte na conta especificada | `create_transaction` |
| "recebi R$5.000 de salário" | Registra receita | `create_transaction` |
| "paguei a fatura do cartão R$2.300" | Registra pagamento de fatura | `create_transaction` |
| "quanto gastei esse mês?" | Resumo do mês atual com gasto vs orçamento | `get_financial_summary` |
| "como tá o orçamento de alimentação?" | Gasto vs orçamento da categoria | `get_budget_vs_actual` |
| "qual o saldo total?" | Soma de todas as contas | `get_accounts` |
| "quanto tenho investido?" | Posições de investimento | `get_portfolio_positions` |
| "quanto gastei em restaurantes essa semana?" | Transações filtradas por categoria e período | `get_financial_summary` + L2 |
| "quais categorias ultrapassaram o orçamento?" | Categorias acima de 100% do orçamento | `get_budget_vs_actual` |

---

## Saúde

| O que dizer | O que acontece | Tool chamada |
|-------------|---------------|--------------|
| "fui na academia hoje, 1h" | Cria sessão de treino | `log_workout` |
| "fiz peito: supino 80kg×10, 80kg×8" | Adiciona séries ao treino | `log_workout` + `add_workout_set` |
| "dormi 7h, qualidade boa" | Registra sono | `log_sleep` |
| "dormi das 23h às 06h30" | Registra sono com horários exatos | `log_sleep` |
| "pesando 79.5kg" | Registra peso | `log_weight` |
| "humor hoje: 7/10" | Registra observação de humor | health_observation |
| "tomei remédio hoje" | Registra uso de medicação | health_observation |
| "fumei hoje" | Registra uso de substância | health_observation |
| "qual meu progresso no supino?" | Histórico de carga no exercício | `get_exercise_progress` |
| "se fiz 80kg × 10, qual meu 1RM?" | Calcula 1RM pela fórmula Epley | `estimate_1rm` |
| "como foi meu sono essa semana?" | Resumo de sono dos últimos 7 dias | L1 de health |

---

## Rotina e Hábitos

| O que dizer | O que acontece | Tool chamada |
|-------------|---------------|--------------|
| "meditei hoje" | Marca hábito como feito | `find_habit_by_name` + `log_habit` |
| "academia feita" | Marca hábito academia | `find_habit_by_name` + `log_habit` |
| "li 30 min, Atomic Habits" | Marca leitura com nota | `log_habit` |
| "bebi 2L de água" | Marca hábito hidratação | `log_habit` |
| "cria hábito: meditação diária" | Cria novo hábito | `create_habit` |
| "cria hábito: ler 20min, dias úteis" | Hábito com frequência customizada | `create_habit` |
| "quais hábitos estão em risco?" | Lista hábitos com streak prestes a quebrar | `get_habits_at_risk` |
| "como tá minha rotina hoje?" | Status de todos os hábitos do dia | L1 de routine |

---

## Objetivos e Tarefas

| O que dizer | O que acontece | Tool chamada |
|-------------|---------------|--------------|
| "cria objetivo: lançar LifeOS até junho" | Novo objetivo com área e prazo | `create_objective` |
| "adiciona tarefa: revisar contrato" | Tarefa avulsa | `create_task` |
| "tarefa urgente: ligar pro João ainda hoje" | Tarefa com prioridade urgente | `create_task` |
| "tarefa para o objetivo LifeOS: implementar memória" | Tarefa vinculada ao objetivo | `create_task` |
| "quais minhas tarefas para hoje?" | Tarefas com deadline hoje ou em andamento | L1 de objectives |
| "progresso dos meus objetivos?" | Resumo de todos os objetivos ativos | L1 de objectives |

---

## Agenda e Compromissos

| O que dizer | O que acontece | Tool chamada |
|-------------|---------------|--------------|
| "reunião com João amanhã às 14h, 1h" | Cria evento | `create_event` |
| "consulta dentista quarta 10h" | Cria compromisso | `create_event` |
| "bloqueia sexta manhã para deep work" | Cria bloqueio de calendário | `create_event` |
| "o que tenho essa semana?" | Lista eventos da semana | L1 de calendar |
| "tenho horário livre para 2h de reunião?" | Busca slots disponíveis | `find_free_slots` |
| "amanhã tem alguma coisa?" | Eventos de amanhã | L0 de calendar |

---

## Pessoas e Relacionamentos

| O que dizer | O que acontece | Tool chamada |
|-------------|---------------|--------------|
| "o João me ligou, falamos sobre o Atlas" | Registra interação | `find_person_by_name` + `log_interaction` |
| "encontrei a Maria no café" | Registra encontro | `log_interaction` |
| "adiciona Pedro Santos, engenheiro, vou trabalhar com ele" | Adiciona ao CRM | `create_person` |
| "anota que preciso ligar pro João até sexta" | Próxima ação na interação | `log_interaction` |
| "quem não falo há mais de 30 dias?" | Lista contatos vencidos | L1 de people |
| "aniversário da Maria é quando?" | Busca pessoa + birthday | `find_person_by_name` |

---

## Carreira e Trabalho

| O que dizer | O que acontece | Tool chamada |
|-------------|---------------|--------------|
| "trabalhei 3h na EdiculaWorks" | Registra sessão de trabalho | `log_work` |
| "2h de consultoria no HC, reunião de strategy" | Sessão com notas | `log_work` |
| "quantas horas trabalhei essa semana?" | Total de horas por projeto | L1 de career |
| "qual projeto consumiu mais tempo esse mês?" | Breakdown por workspace | L2 de career |

---

## Entretenimento e Lazer

| O que dizer | O que acontece | Tool chamada |
|-------------|---------------|--------------|
| "assisti Oppenheimer, nota 9/10" | Registra filme assistido | `create_media` |
| "add Dune 2 na lista para ver" | Adiciona à lista de quero ver | `create_media` |
| "terminei Atomic Habits, nota 8" | Marca livro como lido | `create_media` |
| "estou no ep 5 de The Bear" | Atualiza progresso de série | `create_media` |
| "skate hoje, 1h" | Registra sessão de hobby | via hobby session |

---

## Demandas e Projetos

| O que dizer | O que acontece | Tool chamada |
|-------------|---------------|--------------|
| "cria demanda: migrar dados" | Nova demanda para tarefa complexa | `create_demand` |
| "mostra demandas ativas" | Lista demandas em execução | L1 de demands |
| "pausa demanda #1" | Pausa uma demanda | `update_demand` |
| "retoma demanda #1" | Retoma demanda pausada | `update_demand` |
| "qual progresso da demanda?" | Status atual com steps | L1 de demands |

---

## Memória e Preferências

| O que dizer | O que acontece | Tool chamada |
|-------------|---------------|--------------|
| "anota que prefiro reuniões curtas, máximo 30min" | Salva preferência permanente | `save_memory` |
| "lembra que o João me deve R$500 desde fevereiro" | Salva como case memory | `save_memory` |
| "meu horário de pico de produtividade é 10h-13h" | Salva padrão comportamental | `save_memory` |
| "tenho consulta mensal com o Dr. Carlos" | Salva como entity memory | `save_memory` |

---

## Perguntas Gerais

| O que dizer | O que acontece |
|-------------|---------------|
| "como tô indo?" | Resumo geral da semana (finanças, saúde, hábitos, objetivos) |
| "o que preciso fazer hoje?" | Tarefas urgentes + hábitos + compromissos do dia |
| "revisão da semana" | Análise completa dos últimos 7 dias |
| "onde estou com meus objetivos?" | Progresso dos objetivos ativos com próximos passos |
| "o que esqueci de fazer?" | Hábitos não feitos + tarefas vencidas + follow-ups pendentes |

---

## Dicas

> 💡 **Dica:** **Linguagem natural**: Não precisa de sintaxe especial. "gastei 50 reais no mercado" funciona igual a "gastei R$50 no supermercado ontem".

> 💡 **Dica:** **Datas relativas**: "ontem", "amanhã", "semana passada", "segunda-feira" — o agente interpreta tudo.

> 💡 **Dica:** **Contexto implícito**: "fiz isso hoje" depois de falar de treino → o agente assume que é sobre o treino.

> 💡 **Dica:** **Correções**: "na verdade foram R$60" → o agente atualiza o último registro.

> 💡 **Dica:** **Perguntas sobre dados**: Sempre funciona em linguagem natural — não precisa saber os nomes das tabelas ou queries.
