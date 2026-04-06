# Hawk OS — Innovation Ideas

> Documento de ideias para implementação futura. Criado em 2026-04-06.

---

## 1. Sistema de Pré-requisitos (Prerequisite Guard)

**Problema:** Quando um tenant tenta executar uma ação sem ter os dados necessários configurados, o sistema falha silenciosamente ou retorna um erro confuso. Exemplo real: adicionar receita financeira sem conta bancária configurada.

**Solução:** Mapa declarativo de pré-requisitos por intent. Antes de executar qualquer ação, o sistema verifica se os pré-requisitos estão satisfeitos — sem chamar o LLM.

**Como funciona:**
- Cada intent tem uma lista de pré-requisitos declarados (ex: `accounts.count > 0`)
- Se não satisfeito, o agente responde com mensagem guiada: *"Para registar receitas, primeiro precisas de criar uma conta bancária. Quer criar agora?"*
- O agente oferece o próximo passo diretamente na conversa

**Exemplos de mapeamento:**
| Intent | Pré-requisito |
|--------|--------------|
| adicionar transação | pelo menos 1 conta bancária |
| log de treino | pelo menos 1 tipo de treino configurado |
| criar evento | calendário com configuração básica |
| registar sono | nenhum (módulo zero-config) |

**Impacto:** Elimina a classe inteira de erros "ação sem setup", melhora UX do onboarding, reduz LLM calls para casos triviais.

---

## 2. Painel Admin — Monitorização Completa

**Problema:** O admin não consegue saber o estado real de cada tenant sem ir ao servidor manualmente.

**Solução:** Dashboard admin com monitorização em tempo real de todos os tenants.

**Funcionalidades:**
- **Status de conexão Discord** por tenant: online / offline / reconectando (com tempo desde último evento)
- **API key health:** válida / expirada / sem saldo / rate-limited — sem revelar o secret
- **Erros recentes** por tenant: lista dos últimos N erros com tipo, módulo, timestamp e stack trace resumido
- **Botão "Reportar erro"** no dashboard do tenant: abre modal, envia snapshot de contexto anonimizado ao admin
- **Timeline de eventos críticos:** restarts, falhas de auth, migrations aplicadas, novos tenants
- **Usage summary:** mensagens hoje, tokens consumidos, custo estimado

**Privacidade:** Nenhum conteúdo de mensagem exposto — apenas metadados técnicos.

---

## 3. Quick Actions no Discord

**Problema:** Para ações repetitivas simples, o utilizador tem de escrever linguagem natural completa, o que é lento e consome tokens desnecessariamente.

**Solução:** Usar componentes nativos do Discord (botões, select menus, modais) para fluxos comuns.

**Exemplos:**
- Após registar gasto, agente mostra Select Menu com categorias mais usadas
- `/log` slash command abre modal com campos estruturados (valor, categoria, nota)
- Confirmações de ação com botões ✅ / ❌ em vez de resposta textual
- Reação com emoji a uma mensagem do agente executa ação rápida predefinida

**Impacto:** Reduz drasticamente LLM calls para fluxos já previsíveis. Melhora UX especialmente em mobile.

---

## 4. Intent Caching / Short-Circuit

**Problema:** Mensagens simples e repetitivas passam pelo pipeline LLM completo desnecessariamente.

**Solução:** Classificador leve (regex + heurísticas) que resolve intents comuns sem LLM.

**Exemplos de short-circuit:**
- `"quanto gastei este mês"` → query direta, sem LLM
- `"como estou"` → composição de L0 de todos os módulos ativos
- `"adiciona [valor] reais de [palavra]"` → parse regex → criar transação
- `"ver tarefas"` → listar demands abertas diretamente

**Fallback:** Se a mensagem for ambígua, multi-intent ou não encaixar em nenhum padrão → escala para LLM normalmente.

**Impacto:** Potencial de 30-50% de redução de LLM calls em tenants que usam o sistema para ações rotineiras.

---

## 5. Diagnóstico Self-Service por Tenant

**Problema:** O utilizador não sabe o estado do seu próprio sistema sem pedir ajuda ao admin.

**Solução:** Comando `status` ou `saúde` que retorna um relatório completo do estado do tenant.

**Conteúdo do relatório:**
- Módulos configurados vs não configurados (com indicador visual)
- Última interação por módulo
- Dados em falta detectados: "Não registas sono há 3 dias"
- API key status (válida, saldo aproximado se disponível)
- Uptime do bot
- Próximas automações agendadas

**Formato:** Mensagem Discord formatada com emojis de status (✅ / ⚠️ / ❌) e links diretos para configurar o que falta.

---

## 6. Data Completeness Score

**Problema:** Tenants criam conta mas não configuram os módulos corretamente, ficando com uma experiência degradada sem saber.

**Solução:** Score de completude por módulo, calculado periodicamente.

**O que avaliar:**
- Finances: tem contas? categorias custom? orçamento mensal definido?
- Health: tem metas de sono? macros definidos? peso base?
- People: contactos têm próxima interação agendada?
- Objectives: objetivos têm prazo e métricas?

**Exposição:**
- Widget no dashboard: "Configuração: 5/8 módulos completos"
- Wizard de setup inline com próximos passos sugeridos
- Mensagem proativa do agente na primeira semana: "Ainda não configuraste o teu orçamento mensal. Quer fazer agora?"

---

## 7. Cross-Module Pattern Detection

**Problema:** O sistema tem dados de múltiplos domínios da vida do utilizador mas não os correlaciona.

**Solução:** Motor de correlação semanal que detecta padrões entre módulos e os reporta proativamente.

**Exemplos de correlações:**
- "Nas semanas que dormes menos de 6h, os teus gastos impulsivos aumentam 40%"
- "As tuas interações sociais caíram 60% desde que o objetivo X ficou overdue"
- "Os teus treinos são mais consistentes quando tens reuniões de trabalho agendadas"
- "O teu humor (baseado no tom das mensagens) correlaciona inversamente com gastos"

**Implementação:** Job semanal que corre queries cross-module e passa os dados a um LLM para geração de insights. Resultados guardados como memories do tipo `pattern`.

---

## 8. Fila de Ações Pendentes (Pending Intents)

**Problema:** Quando uma ação falha por pré-requisito em falta, a intenção do utilizador perde-se.

**Solução:** Quando uma ação não pode ser completada por falta de setup, guardar como intent pendente.

**Fluxo:**
1. Utilizador: "adiciona 1000 reais de receita"
2. Pré-requisito falha: sem conta bancária
3. Agente: "Guardei esta intenção. Assim que criares uma conta, executo automaticamente."
4. Utilizador cria conta → sistema executa intent pendente automaticamente (com confirmação)

**Visibilidade:** Lista de intents pendentes visível no dashboard e via comando `pendentes` no Discord.

---

## 9. Import Wizards

**Problema:** Entrada manual de dados históricos é impraticável. Tenants que migram de outras ferramentas ficam sem dados.

**Solução:** Wizards de importação bulk para os módulos principais.

**Importações prioritárias:**
- **Finances:** CSV de extrato bancário com mapping de colunas configurável; detecção automática de formato (Nubank, Millennium, etc.)
- **Health:** Apple Health export (XML), Google Fit; sleep, workout, body measurements
- **Calendar:** Google Calendar sync (two-way); importação inicial de eventos futuros
- **People:** vCard / contactos do telemóvel → base de pessoas

**UX:** Wizard passo-a-passo no dashboard web, preview antes de confirmar, rollback disponível 24h.

---

## 10. Undo para Ações do Agente

**Problema:** Erros de input (valor errado, categoria errada) exigem correção manual e o utilizador não sabe como.

**Solução:** Após qualquer mutação, o agente oferece desfazer com janela de tempo.

**Funcionamento:**
- "Adicionei transação de €50 em Alimentação — [Desfazer] (60s)"
- Botão Discord ou comando `desfazer` na janela de tempo
- Soft-delete com timestamp, hard-delete após expirar
- Histórico de ações desfeitas guardado no activity_log

**Escopo:** Transações, logs de saúde, interações de pessoas, eventos. Memórias e dados estruturais excluídos (reversão mais complexa).

---

## 11. Relatórios Automáticos Configuráveis

**Problema:** As automações atuais são fixas para todos os tenants. Cada pessoa tem ritmos e necessidades diferentes.

**Solução:** Sistema de relatórios configurável por tenant via dashboard.

**Relatórios disponíveis:**
- Resumo financeiro semanal (gastos por categoria, vs orçamento)
- Check de objetivos (progresso, overdue, próximos)
- Análise de saúde mensal (médias de sono, treino, tendências)
- Resumo de pessoas (interações feitas, próximas agendadas)
- Digest completo de vida (cross-module, enviado aos domingos)

**Configuração:** Dia da semana, hora, canal Discord preferido, nível de detalhe (resumido / completo).

---

## 12. Error Budget por Tenant

**Problema:** Não há visibilidade sobre onde o agente "falha em ajudar" — respostas vagas, dados em falta, ações impossíveis.

**Solução:** Tracking de "falhas de assistência" por tenant e por intent.

**O que rastrear:**
- Respostas do tipo "não tenho esses dados" / "não consigo fazer isso"
- Ações que ativaram o pré-requisito guard (ideia 1)
- Perguntas sem resposta satisfatória (baseado em follow-up do utilizador)

**Visibilidade admin:**
- "ten2: 12 falhas em finance esta semana — falta configuração de contas"
- Ranking de intents mais falhados no sistema todo → prioriza próximas features
- Tendência: error rate a subir ou descer por tenant

---

## 13. Contexto de Intenção Não Concluída

**Problema:** O session compactor guarda o que foi dito, mas não o que ficou por fazer.

**Solução:** Ao fim de cada sessão, além de compactar, extrair intenções não concluídas.

**Exemplos:**
- "Da última vez perguntaste sobre o teu orçamento mas a sessão terminou — quer continuar?"
- "Ficaste de registar o treino de ontem — ainda queres?"
- "Tens 3 decisões pendentes que discutimos há 2 dias"

**Implementação:** Campo `pending_intents: string[]` na session archive. Carregado no início de cada nova sessão e apresentado proativamente se relevante.

---

## 14. Tenant Onboarding Intelligence (Primeiros 7 Dias)

**Problema:** Após o onboarding técnico, o tenant fica sozinho sem saber como começar a usar o sistema.

**Solução:** Sequência guiada automática para os primeiros 7 dias, baseada no que já foi feito.

**Sequência adaptativa:**
- Dia 1: "Bem-vindo! Vamos criar a tua primeira conta bancária" (se finances não configurado)
- Dia 2: "Adiciona o teu primeiro gasto de hoje" (se nunca adicionou transação)
- Dia 3: "Registei que ainda não usaste o módulo de saúde — quer configurar as tuas metas?"
- Progressão automática: se o utilizador já fez a ação sugerida, passa à próxima
- Sem spam: se o utilizador ignora 2 sugestões, pausa a sequência e pergunta se quer continuar

---

## 15. Observabilidade de LLM Cost por Intent Type

**Problema:** Sabemos o custo total por tenant mas não sabemos quais tipos de mensagem são mais caros.

**Solução:** Breakdown de tokens/custo por categoria de intent, visível no admin e no próprio dashboard do tenant.

**Categorias:**
- Simples (saudações, consultas rápidas)
- CRUD (adicionar/editar/apagar dados)
- Análise (resumos, comparações, tendências)
- Complexo (cross-module, insights, relatórios)

**Visualização:**
- Gráfico de barras: distribuição de tokens por categoria
- "72% dos teus tokens são em análise de finanças"
- Identificar onde o intent caching (ideia 4) teria mais impacto
- Alertas se custo de uma categoria explode inesperadamente

---

---

## 16. Sub-Agent Spawning para Tarefas Complexas

**Inspiração:** DeerFlow, Paperclip, Hermes Agent

**Problema:** Tarefas complexas com múltiplos eixos (ex: "planeia a minha mudança de carreira") são executadas sequencialmente, demorando muito e consumindo contexto desnecessário.

**Solução:** Para tarefas com múltiplos sub-problemas independentes, o agente principal spawna sub-agents paralelos, cada um focado numa dimensão.

**Exemplo:**
- "Planeia a minha mudança de carreira para IA"
  - Sub-agent 1: análise de gap de skills
  - Sub-agent 2: pesquisa de mercado (salários, empresas)
  - Sub-agent 3: timeline e milestones
  - Main agent: agrega resultados e apresenta plano coeso

**Implementação:** Pool de workers isolados com contexto mínimo por task. Resultados agregados pelo orchestrator. Visível no dashboard como "tarefa em progresso (3 sub-tasks)".

---

## 17. Browser Task Automation

**Inspiração:** browser-use

**Problema:** Muitas tarefas que o utilizador delega ao agente requerem interação com websites (compras, formulários, consultas), forçando o utilizador a fazê-las manualmente.

**Solução:** O agente pode abrir um browser, navegar e executar ações web em nome do utilizador.

**Exemplos de uso:**
- "Compra o bilhete de comboio Lisboa-Porto para amanhã às 9h"
- "Renova a minha subscrição do ginásio no site deles"
- "Preenche o formulário de declaração de IRS com estes dados"
- "Verifica se há vagas para este curso e inscreve-me"

**Fluxo Discord:**
1. Utilizador pede tarefa
2. Agente confirma intenção e pede aprovação para abrir browser
3. Executa tarefa em background
4. Reporta resultado com screenshot de confirmação

**Considerações:** Gate de aprovação obrigatório antes de qualquer ação com efeitos financeiros ou legais. Sandboxed por tenant.

---

## 18. Web Monitoring & Alerts

**Inspiração:** Crawl4AI, Firecrawl

**Problema:** O utilizador precisa monitorizar manualmente websites para mudanças relevantes (preços, ofertas de emprego, notícias).

**Solução:** Sistema de subscrições de URL com alertas automáticos quando detetada mudança relevante.

**Tipos de monitorização:**
- **Preço**: "avisa quando este apartamento baixar de preço"
- **Conteúdo**: "resume as novidades deste blog toda segunda-feira"
- **Disponibilidade**: "avisa quando este produto estiver disponível"
- **Emprego**: "monitoriza vagas de ML Engineer nesta empresa"

**Configuração via Discord:** "monitoriza [URL] e avisa-me se [condição]" → o agente cria o monitor.

**Gestão:** Lista de monitores ativos visível no dashboard, com botão para pausar/remover.

---

## 19. Deep Research Mode

**Inspiração:** Onyx, DeerFlow

**Problema:** Para questões complexas que requerem múltiplas fontes e síntese, o agente faz uma única pesquisa superficial.

**Solução:** Modo de pesquisa profunda multi-step, ativado quando o utilizador quer uma análise completa.

**Fluxo:**
1. Utilizador: "faz uma pesquisa completa sobre ETFs de baixo custo para investidor português"
2. Agente planeia queries de pesquisa (5-10 sub-queries)
3. Executa pesquisas em paralelo (web search + crawl de páginas relevantes)
4. Sintetiza num relatório estruturado com fontes citadas
5. Guarda como artefacto (PDF/Markdown descarregável)

**Trigger:** Ativado automaticamente para perguntas que incluam "pesquisa completa", "análise aprofundada", "deep research" ou quando o agente deteta que a resposta requer múltiplas fontes.

**Custo:** Mais caro em tokens/tempo — informar o utilizador antes de iniciar, com estimativa de duração.

---

## 20. Skill Auto-Creation (Aprendizagem Procedural)

**Inspiração:** Hermes Agent learning loop

**Problema:** Quando o utilizador executa uma tarefa complexa e multi-step pela primeira vez, na segunda vez o agente repete todo o processo de raciocínio do zero.

**Solução:** Após concluir uma tarefa complexa com sucesso, o agente extrai automaticamente o procedimento como uma "skill" reutilizável.

**Exemplo:**
- 1ª vez: "Como faço a reconciliação mensal das finanças?" → agente descobre o processo passo-a-passo
- Após conclusão: extrai procedimento → guarda como skill "reconciliação-financeira-mensal"
- 2ª vez: executa diretamente a skill sem raciocínio redundante

**Estrutura de skill:**
```markdown
# reconciliação-financeira-mensal
Trigger: pedido de reconciliação mensal
Pré-requisitos: contas configuradas, transações do mês presentes
Steps:
  1. Listar transações não categorizadas
  2. Sugerir categorias por histórico
  3. Verificar saldo vs objetivo de poupança
  4. Gerar resumo
```

**Gestão:** Skills visíveis e editáveis no dashboard. Utilizador pode aprovar/rejeitar skill criada. Skills partilhadas entre sessões.

---

## 21. Cross-Session Search

**Inspiração:** Hermes Agent (FTS5 + LLM summarization)

**Problema:** As memórias guardam factos extraídos, mas o utilizador não consegue pesquisar o conteúdo real de conversas passadas.

**Solução:** Full-text search através de todos os arquivos de sessão, com LLM a sintetizar os resultados relevantes.

**Exemplos:**
- "Quando foi a última vez que falei sobre o apartamento de Lisboa?"
- "O que ficou combinado na reunião sobre o projeto X?"
- "Que recomendações já me deste para dormir melhor?"

**Implementação:** FTS index sobre `session_archives.content`. Query → matching sessions → LLM extrai contexto relevante → resposta com referência temporal ("há 3 semanas, disseste que...").

**Diferença das memórias:** Memórias são factos extraídos. Cross-session search é o arquivo completo — mais verboso mas mais fiel ao que foi dito.

---

## 22. Natural Language Cron

**Inspiração:** Hermes, DeerFlow scheduling

**Problema:** Criar automações e lembretes requer acesso ao painel de configuração. O utilizador não deveria precisar de configurar crons manualmente.

**Solução:** O utilizador cria automações em linguagem natural diretamente no Discord.

**Exemplos:**
- "Lembra-me toda segunda às 9h de verificar o orçamento" → cron semanal
- "Envia-me um resumo de saúde todo domingo à noite" → relatório automático
- "Pergunta-me sobre os meus hábitos todos os dias às 22h" → check-in personalizado
- "Avisa-me 3 dias antes de qualquer deadline de objetivos" → trigger condicional

**Gestão:** Comando `automações` lista todas as ativas. Botão de pausa/remover por automação. Visível também no dashboard.

**Parsing:** LLM extrai schedule (cron expression), ação, e condições. Confirmação antes de ativar.

---

## 23. Heartbeat Autonomy (Módulos Pró-Ativos)

**Inspiração:** Paperclip heartbeats, OpenClaw heartbeats

**Problema:** O sistema só age quando o utilizador envia uma mensagem. Muitos problemas importantes passam despercebidos.

**Solução:** Cada módulo tem um "heartbeat" configurável — acorda em schedule, analisa o estado atual, e age proativamente se necessário.

**Exemplos por módulo:**
- **Finances**: Deteta transação recorrente que deveria ter acontecido mas não foi registada → notifica utilizador
- **Health**: Calculado gap de 3 dias sem registo de sono → envia nudge personalizado
- **People**: Identifica contacto próximo com quem não houve interação há mais de X dias → sugere check-in
- **Objectives**: Detecta objetivo com prazo em 7 dias e 0% progresso → escala urgência
- **Legal**: Deteta deadline de renovação de documento a 30 dias → alerta preventivo

**Diferença das automações atuais:** As automações atuais são fixas e genéricas. O heartbeat é por módulo, analisa dados reais do tenant, e só notifica quando há algo relevante — sem spam.

---

## 24. Geração de Artefactos (Documentos e Relatórios)

**Inspiração:** Onyx Artifacts, LobeHub Artifacts

**Problema:** Não há forma de exportar ou descarregar informação do sistema em formatos utilizáveis (PDF, Excel, Markdown).

**Solução:** O agente pode gerar documentos completos a partir dos dados do tenant, descarregáveis via dashboard.

**Tipos de artefactos:**
- **Relatório financeiro mensal** em PDF com gráficos
- **CV atualizado** baseado nos dados do módulo de carreira
- **Resumo anual de saúde** com tendências e evolução
- **Plano de objetivos** em formato apresentação
- **Backup completo de dados** em JSON (GDPR compliance)
- **Relatório de rede pessoal** (pessoas, interações, próximos passos)

**Trigger:** "gera o meu relatório financeiro de março" ou botão "Exportar" em cada módulo do dashboard.

---

## 25. Hierarquia Visual de Objetivos

**Inspiração:** Paperclip org charts, AI-Scientist BFTS, DeerFlow goal ancestry

**Problema:** Os objetivos são tratados como lista plana, sem relação entre si. Não há visibilidade de como objetivos se decompõem em sub-objetivos e tarefas.

**Solução:** Objetivos têm relação parent-child. O dashboard mostra uma árvore interativa com estado de progresso.

**Estrutura:**
```
Objetivo: Comprar casa (2027)
├── Financeiro: Poupar 30k para entrada
│   ├── Reduzir gastos em 500€/mês
│   └── Aumentar receita freelance
├── Legal: Preparar documentação
│   ├── Declaração de IRS 2025
│   └── Simulação de crédito habitation
└── Pesquisa: Escolher zona
    └── Visitar 5 imóveis por trimestre
```

**Features:**
- Drag-and-drop para reorganizar hierarquia
- Progresso do pai calculado automaticamente pelos filhos
- Criar sub-objetivos a partir do agente: "divide este objetivo em sub-tasks"
- Alertas quando nó bloqueado propaga para cima

---

---

## 26. Simulação do Eu Futuro

**Problema:** O utilizador toma decisões financeiras e de hábitos sem visibilidade de onde essas tendências o levam a longo prazo.

**Solução:** Com base nos dados reais dos últimos 3-6 meses, o sistema projeta onde o utilizador vai estar em 6/12/24 meses se mantiver o ritmo atual.

**Exemplos:**
- Finanças: "Se continuares a poupar €400/mês, terás €12.800 em 32 meses — a tua meta de entrada de casa"
- Saúde: "Com a tua média actual de 5.8h de sono, o risco de burnout aumenta 40% em 6 meses (baseado nos teus padrões)"
- Objetivos: "Os teus 3 objetivos principais têm 0% de progresso nas últimas 3 semanas. Ao ritmo atual, nenhum será concluído no prazo"

**Visualização:** Gráfico de projeção no dashboard com cenários — atual vs. otimizado. Activado também via Discord: "onde vou estar financeiramente em 1 ano?"

---

## 27. Detector de Contradições

**Problema:** O utilizador declara objetivos mas os seus comportamentos contradizem-nos — sem que o sistema o confronte.

**Solução:** O agente deteta discrepâncias entre objetivos declarados e comportamento real, e reporta proativamente (com tacto).

**Exemplos:**
- "Queres poupar mais, mas os teus gastos em restaurantes triplicaram este mês"
- "O teu objetivo é correr uma maratona em outubro, mas não registas treinos há 2 semanas"
- "Disseste querer reduzir o tempo de ecrã, mas as tuas sessões Discord são 40% mais longas esta semana"

**Tom:** Não punitivo — apresentado como insight, não crítica. Frequência máxima: 1 contradição por módulo por semana, para não ser irritante.

---

## 28. Briefing de Reunião Automático

**Problema:** Antes de uma reunião importante, o utilizador tem de ir buscar contexto manualmente a vários sítios.

**Solução:** 30 minutos antes de cada evento do calendário com pessoa(s) associada(s), o agente envia automaticamente um briefing.

**Conteúdo do briefing:**
- Perfil da pessoa (do módulo People): cargo, empresa, última interação, o que ficou pendente
- Histórico de conversas relevantes do módulo de memória
- Notas de reuniões anteriores com essa pessoa
- Contexto do projeto/tema da reunião (se mencionado no título)
- Sugestões de pontos a abordar baseados no histórico

**Trigger:** Evento de calendário com attendees conhecidos, 30 minutos antes.

---

## 29. Auditoria de Subscrições

**Problema:** Ao longo do tempo acumulam-se subscrições pagas esquecidas, serviços duplicados, e planos mais caros do que o necessário.

**Solução:** Análise automática das transações recorrentes para identificar subscrições, classificá-las, e sugerir otimizações.

**O que faz:**
- Deteta padrões de cobrança recorrente nas transações (mesmo valor, mesma entidade, periodicidade)
- Lista todas as subscrições ativas com custo mensal/anual total
- Identifica subscrições não utilizadas (sem interação mencionada nas mensagens)
- Sugere alternativas gratuitas ou mais baratas para cada serviço
- Calcula poupança potencial

**Trigger:** Manual ("audita as minhas subscrições") ou automático mensalmente.

---

## 30. Diário de Decisões

**Problema:** O utilizador toma decisões importantes (emprego, investimentos, relações) mas nunca regista o raciocínio — impossibilitando aprender com elas.

**Solução:** Sistema estruturado para registar decisões importantes, o contexto em que foram tomadas, e depois rever os resultados.

**Fluxo:**
1. "Tomei uma decisão sobre X" → agente guia com perguntas: alternativas consideradas, critérios, o que pesou mais, nível de confiança
2. Decisão guardada como entrada estruturada
3. Após N semanas/meses (configurável), agente faz follow-up: "Como correu a decisão X? O que mudou?"
4. Padrões emergem: "Tomas melhores decisões quando dormes bem. As tuas decisões financeiras têm 80% de acerto."

**Dashboard:** Timeline de decisões com outcome anotado. Filtros por área (carreira, finanças, saúde, pessoal).

---

## 31. Radar de Equilíbrio de Vida

**Problema:** É fácil focar excessivamente numa área da vida enquanto outras se deterioram — e não ter uma visão holística disso.

**Solução:** Gráfico radar (spider chart) que mostra o equilíbrio entre as diferentes dimensões de vida, calculado automaticamente a partir dos dados reais.

**Dimensões calculadas:**
- Saúde (sono, treino, energia)
- Finanças (poupança, gastos controlados, dívida)
- Carreira (progresso, aprendizagem, satisfação)
- Relações (frequência de interações, qualidade)
- Objetivos (progresso, conclusão)
- Rotina (consistência de hábitos)

**Interatividade:** Click em qualquer dimensão → drill-down para o módulo. Histórico semanal para ver evolução. Alerta quando uma dimensão cai abaixo de threshold.

---

## 32. Detector de Oportunidades

**Problema:** O utilizador tem objetivos e skills registadas mas o sistema não os usa para surfaçar oportunidades relevantes.

**Solução:** Motor que cruza objetivos + skills + preferências com oportunidades externas (vagas, cursos, eventos, bolsas).

**Exemplos:**
- Carreira: "Encontrei 3 vagas de ML Engineer em Lisboa que correspondem ao teu perfil e objetivo de mudança de emprego"
- Formação: "Este curso de Python advanced tem desconto esta semana e está alinhado com o teu roadmap de skills"
- Financeiro: "A tua seguradora tem uma taxa 30% melhor que a média de mercado para o teu perfil — vale a pena renegociar"
- Networking: "Esta conferência tem 2 pessoas do teu setor que ainda não conheces mas têm perfil interessante"

**Implementação:** Combina Web Monitoring (#18) + Deep Research (#19) + dados dos módulos do tenant.

---

## 33. Delegação Inteligente

**Problema:** O utilizador pede coisas a outras pessoas (colegas, fornecedores, família) e depois não tem follow-up estruturado.

**Solução:** O sistema rastreia o que foi delegado a quem, com prazo, e faz follow-up automático.

**Fluxo:**
1. "Pedi ao João para me enviar o relatório até sexta" → criado como delegation entry
2. Na sexta, se não houver registo de conclusão → "O relatório do João estava previsto para hoje, recebeste?"
3. Se concluído → "Marcar como feito"
4. Padrões: "O João costuma atrasar 2 dias nas entregas — ajustar expectativas?"

**Integração com People:** Delegações associadas ao perfil da pessoa. Visível no histórico de interações.

---

## 34. Extension / Web Clipper

**Problema:** O utilizador encontra informação relevante no browser (artigos, ofertas de emprego, preços, receitas) mas não tem forma rápida de a enviar para o Hawk OS.

**Solução:** Extensão de browser que envia conteúdo para o Hawk OS com um clique.

**Funcionalidades:**
- Clip de artigo → guardado no módulo Knowledge com resumo automático
- Clip de oferta de emprego → enviada para módulo Career com campos preenchidos
- Clip de produto → monitorização de preço ativada (liga-se ao #18)
- Clip de receita/restaurante → guardado no módulo Health/Rotina
- Clip de imóvel → módulo Housing com dados extraídos

**Tech:** Extensão Chrome/Firefox. Envia para API do agent. O agent classifica e encaminha para o módulo correto.

---

## 35. Modo Revisão Semanal Guiada

**Problema:** A weekly review é uma das práticas mais impactantes de produtividade, mas sem estrutura a maioria das pessoas não a faz.

**Solução:** Toda semana (domingo à noite, configurável), o agente conduz uma revisão guiada interativa via Discord.

**Estrutura:**
1. **Recap automático:** "Esta semana: X transações, Y horas de sono médio, Z treinos, N interações"
2. **O que correu bem?** → agente sugere destaques positivos baseados nos dados
3. **O que não correu?** → aponta gaps e tendências negativas
4. **Objetivos:** progresso real vs. planeado
5. **Próxima semana:** o que priorizar? (agente sugere com base em deadlines e padrões)
6. **Uma coisa a melhorar:** agente identifica o maior lever de impacto

**Output:** Resumo guardado como entrada semanal. Dashboard mostra histórico de reviews. Streak de reviews consecutivas.

---

## 36. Histórico de Evolução Pessoal

**Problema:** O utilizador vive no presente e raramente tem perspetiva de quanto evoluiu ao longo do tempo.

**Solução:** Timeline visual de marcos pessoais com comparação "eu há 1 ano vs. eu hoje".

**Conteúdo automático:**
- Marcos financeiros: "Há 1 ano tinhas €X de poupança. Hoje tens €Y (+Z%)"
- Marcos de saúde: "Há 6 meses dormias em média 5.5h. Agora dormes 7.2h"
- Objetivos concluídos ao longo do tempo
- Skills adquiridas, pessoas conhecidas, lugares visitados

**Formato:** Timeline interativa no dashboard. Trigger anual/semestral automático: "Olha quanto evoluíste nos últimos 12 meses".

**Efeito psicológico:** Contrariar o viés de que "nada está a mudar" — mostrar progresso real com dados.

---

## 37. Modo Foco com Silêncio Inteligente

**Problema:** O utilizador pode estar em modo de trabalho profundo e não quer ser interrompido por notificações do agente — mas também não quer perder alertas críticos.

**Solução:** Modo foco configurável que filtra o que pode interromper durante blocos de tempo.

**Funcionamento:**
- "Vou trabalhar durante 2 horas, não me interrompas" → modo foco ativado
- Notificações buffered → entregues após o bloco
- Exceções configuráveis: alertas críticos (saúde, finanças acima de threshold) passam sempre
- Integração com calendário: bloco "Focus Time" no calendário ativa automaticamente

**Discord:** Agente responde a mensagens durante foco com "Estás em modo foco até as 15h. Guardo esta mensagem para depois."

---

## 38. Coaching de Negociação

**Problema:** Em situações de negociação (salário, renda, contratos), o utilizador não tem dados de mercado nem estratégia preparada.

**Solução:** Quando o utilizador menciona uma negociação pendente, o agente conduz research de mercado e prepara um briefing.

**Para salários:**
- Pesquisa de faixas salariais para o cargo/localização (via web)
- Comparação com o salário atual do utilizador (do módulo Career)
- Argumentos baseados nos dados do utilizador (tempo de empresa, skills adquiridas, objetivos alcançados)
- Scripts de abertura sugeridos

**Para rendas/contratos:**
- Preços de mercado para a zona
- Histórico de pagamentos pontual do utilizador como argumento
- Cláusulas a negociar

---

## 39. Notas de Voz

**Problema:** Às vezes o utilizador tem um pensamento importante mas está a conduzir, a correr, ou simplesmente prefere falar em vez de escrever.

**Solução:** Suporte a mensagens de voz no Discord — o agente transcreve, classifica, e age sobre o conteúdo.

**Fluxo:**
1. Utilizador envia mensagem de voz no Discord
2. Agente transcreve via Whisper (local ou API)
3. Processa como texto normal — pode criar transação, log de saúde, nota, reminder
4. Confirma ação com transcrição mostrada

**Casos de uso:**
- Captura rápida de ideias durante exercício
- Registo de gastos durante compras
- Nota de reunião em tempo real
- Journaling falado

---

## 40. Assistente de Preparação de Impostos

**Problema:** A preparação anual de impostos é stressante porque a informação está dispersa e nunca foi organizada ao longo do ano.

**Solução:** O sistema organiza proativamente ao longo do ano toda a informação relevante para os impostos.

**O que faz:**
- Categoriza transações com flag fiscal (despesas dedutíveis, rendimentos, etc.)
- Reminders de prazos fiscais importantes (IRS em Portugal: março-junho)
- Lista de documentos necessários e quais já foram recolhidos
- Estimativa de impostos a pagar/receber com base nos dados acumulados
- Geração de relatório de deduções potenciais

**Quando a declaração se aproxima:** "Já tens X de despesas de saúde, Y de formação e Z de habitação documentadas. Estimativa de reembolso: €W."

---

## 41. Telegram / WhatsApp Channel

**Problema:** Discord e uma excelente interface para power users, mas a maioria das pessoas no mundo real usa WhatsApp ou Telegram. O sistema esta limitado a utilizadores que aceitam usar Discord.

**Solucao:** Channel adapters para Telegram e/ou WhatsApp, usando a infra de multi-channel que ja existe.

**O que ja existe:**
- `ChannelCapabilities` com presets para Discord, Web, Telegram, WhatsApp em `channels/types.ts`
- `getFormattingHints()` gera prompt hints a partir de capabilities
- Feature flag `multi-channel` definida

**Implementacao:**
- **Telegram:** Bot API gratuita, sem custos. `telegram-bot-api` ou `grammy`. Suporta botoes inline, markdown, voice messages.
- **WhatsApp:** WhatsApp Business API (Meta Cloud API) — gratuito ate 1000 conversas/mes. Suporta botoes, listas, media.
- Cada tenant configura o token do bot no dashboard (como ja faz com Discord)
- Adapter pattern identico ao `discord-adapter.ts`

**Impacto:** Expande o publico potencial massivamente. Telegram e especialmente relevante para utilizadores tecnicos na Europa.

---

## 42. Google Calendar Sync Bidireccional

**Problema:** O modulo calendar existe mas os dados sao manuais. Ninguem vai duplicar eventos entre Google Calendar e Hawk OS.

**Solucao:** Sync bidireccional com Google Calendar via API, tornando o modulo calendar util no dia-a-dia.

**Fluxo:**
- **Import inicial:** Puxa todos os eventos futuros + ultimos 30 dias
- **Sync continuo:** Webhook (Google push notifications) ou polling a cada 5 minutos
- **Bidireccional:** Eventos criados no Hawk OS sao empurrados para o Google Calendar
- **Conflitos:** Google Calendar e source of truth para eventos externos; Hawk OS e source of truth para metadata (notas, links a pessoas/objectivos)

**Configuracao:** OAuth2 no dashboard (Settings > Integrations > Google Calendar). Token gerido pelo OAuth Token Manager que ja existe em `token-manager.ts`.

**Impacto:** Transforma o modulo calendar de decorativo para essencial. Habilita o briefing de reuniao (#28) e o modo foco (#37).

---

## 43. LLM Feedback Loop (Thumbs Up/Down)

**Problema:** O utilizador nao tem forma de indicar se uma resposta do agente foi boa ou ma. Sem este sinal, nao ha como melhorar a qualidade das respostas ao longo do tempo.

**Solucao:** Apos cada resposta do agente, oferecer feedback simples (thumbs up/down) que alimenta um dataset de qualidade.

**Implementacao:**
- **Discord:** Reacoes automaticas com emojis (thumbs up / thumbs down) na mensagem do agente. O bot escuta a reacao e regista.
- **Web:** Botoes discretos no canto de cada mensagem do agente
- **Storage:** Tabela `response_feedback(message_id, rating, created_at)` — sem conteudo da mensagem, apenas o ID + rating
- **Uso imediato:** Dashboard de quality score por tenant, por modulo, por intent type
- **Uso futuro:** Dataset para fine-tuning, prompt optimization, ou A/B testing de system prompts

**Impacto:** Fecha o feedback loop. Sem isto, melhorias de qualidade sao cegas.

---

## 44. Offline Resilience / Message Queue

**Problema:** Se o agent crashar, o Ollama demorar a carregar o modelo, ou o Discord reconectar, as mensagens enviadas durante o downtime perdem-se silenciosamente.

**Solucao:** Message queue simples que garante que nenhuma mensagem e perdida.

**Implementacao:**
- Tabela `pending_messages(id, tenant_schema, channel, channel_message_id, content, status, created_at, processed_at)`
- Quando o handler recebe mensagem: INSERT com status `pending` ANTES de processar
- Apos processar: UPDATE para `processed`
- No startup do agent: query `pending_messages WHERE status = 'pending'` e processa os pendentes
- Timeout: mensagens pendentes ha mais de 1 hora sao marcadas `expired` com notificacao ao user

**Impacto:** Resiliencia fundamental para um sistema que pretende ser o "OS de vida". Nenhuma mensagem perdida.

---

## 45. Dashboard Sharing / Public Pages

**Problema:** O tenant nao consegue partilhar progresso com amigos, mentores ou parceiros de accountability.

**Solucao:** Gerar links publicos read-only para widgets ou paginas especificas do dashboard.

**Implementacao:**
- Tabela `shared_links(id, tenant_schema, widget_id_or_page, token, expires_at, created_at)`
- Rota publica: `/public/:token` renderiza o widget/pagina sem autenticacao
- Dados filtrados: apenas o widget especifico, sem sidebar, sem navegacao
- Expiracao configuravel (24h, 7d, 30d, permanente)
- Revogavel a qualquer momento pelo tenant

**Exemplos de uso:**
- Partilhar progresso de objetivo com mentor
- Mostrar habitos de saude a um PT ou nutricionista
- Resumo financeiro partilhado entre casal

**Impacto:** Accountability social. O facto de alguem poder ver o progresso aumenta adesao.

---

## 46. Open Banking Integration

**Problema:** A entrada manual de transacoes financeiras e o maior ponto de atrito do modulo finances. Import via CSV e melhor mas ainda requer acao manual.

**Solucao:** Integracao com Open Banking (PSD2 na Europa) para leitura automatica de transacoes bancarias.

**Implementacao:**
- **Provider:** Plaid (global), GoCardless Bank Account Data (EU, gratis ate 50 contas), ou Nordigen (gratis)
- **Fluxo:** Tenant liga conta bancaria via OAuth no dashboard → sistema puxa transacoes automaticamente
- **Sync:** Polling diario (APIs gratuitas nao suportam webhooks real-time)
- **Matching:** Transacoes importadas sao matched com categorias existentes via LLM ou regras do tenant
- **Duplicacao:** Hash de (data + valor + descricao) para evitar duplicatas com entradas manuais

**Consideracoes:** Regulado (PSD2). Requer registo como TPP ou uso de agregador licenciado. GoCardless/Nordigen ja sao licenciados.

**Impacto:** Elimina o maior ponto de atrito do sistema inteiro. Finances e o modulo mais usado — automatizar a entrada de dados transforma a experiencia.

---

## Priorizacao Sugerida

| Ideia | Impacto | Esforço | Sprint | Notas |
|-------|---------|---------|--------|-------|
| 1. Prerequisite Guard | Alto | Baixo | S1 | Inseparavel do #13 |
| 13. Pending Intents (context) | Medio | Baixo | S1 | Complemento do #1 — 50 linhas extra |
| 5. Diagnostico Self-Service | Medio | Baixo | S1 | Uma tool do agente, ~100 linhas |
| 10. Undo Actions | Medio | Baixo | S1 | Soft-delete + botao Discord |
| 4. Intent Caching | Alto | Medio | S2 | Expande isLikelySimpleMessage() existente |
| 3. Quick Actions Discord | Alto | Medio | S2 | discord.js v14 components nativos |
| 43. LLM Feedback Loop | Medio | Baixo | S2 | Thumbs up/down, fecha feedback loop |
| 39. Notas de Voz | Alto | Medio | S3 | Discord voice messages + Whisper |
| 22. Natural Language Cron | Alto | Baixo | S3 | Infra de crons ja existe |
| 23. Heartbeat Autonomy | Alto | Medio | S3 | Tornar automacoes existentes data-driven |
| 44. Offline Resilience | Medio | Baixo | S3 | Message queue simples em Postgres |
| 2. Painel Admin Monitoring | Alto | Medio | S4 | ~40% ja existe, completar |
| 6. Data Completeness Score | Medio | Medio | S4 | Widget + calculo por modulo |
| 15. LLM Cost by Intent | Baixo | Medio | S4 | Informa priorizacao dos proximos sprints |
| 12. Error Budget | Medio | Medio | S4 | Tracking de falhas de assistencia |
| 8. Pending Intents (fila) | Medio | Medio | S5 | Fila de accoes pendentes |
| 14. 7-Day Onboarding | Alto | Alto | S5 | Sequencia adaptativa pos-onboarding |
| 35. Weekly Review Guiada | Alto | Medio | S5 | weekly-review.ts ja existe, tornar interactiva |
| 42. Google Calendar Sync | Alto | Alto | S5 | OAuth2 + token-manager.ts existente |
| 41. Telegram/WhatsApp | Alto | Alto | S6 | Multi-channel presets ja definidos |
| 11. Relatorios Configuraveis | Medio | Alto | S6 | Sistema de relatorios por tenant |
| 9. Import Wizards | Alto | Alto | S6 | CSV finances prioritario |
| 46. Open Banking | Alto | Alto | S6 | PSD2 / GoCardless / Nordigen |
| 7. Cross-Module Patterns | Alto | Alto | S7 | Precisa de meses de dados |
| 19. Deep Research Mode | Alto | Alto | S7 | Web search + crawl + sintese |
| 20. Skill Auto-Creation | Alto | Alto | S7 | Saved procedures reutilizaveis |
| 21. Cross-Session Search | Medio | Medio | S7 | FTS sobre session_archives |
| 24. Artifact Generation | Alto | Medio | S7 | PDF/Markdown export |
| 25. Goal Hierarchy | Alto | Alto | S7 | parent-child + tree UI |
| 26. Simulacao Eu Futuro | Alto | Alto | S8 | Projecoes baseadas em dados reais |
| 27. Detector Contradicoes | Medio | Medio | S8 | Objectivos vs comportamento |
| 28. Briefing de Reuniao | Alto | Medio | S8 | Depende do #42 (calendar sync) |
| 29. Auditoria Subscricoes | Medio | Medio | S8 | Deteccao de recorrencias |
| 30. Diario de Decisoes | Medio | Medio | S8 | Registro estruturado + follow-up |
| 31. Radar Equilibrio Vida | Medio | Medio | S8 | Spider chart com dados reais |
| 32. Detector Oportunidades | Alto | Alto | S9 | Depende do #18 + #19 |
| 33. Delegacao Inteligente | Medio | Medio | S9 | Integra com People |
| 34. Web Clipper Extension | Alto | Alto | S9 | Browser extension separada |
| 36. Historico Evolucao | Medio | Medio | S9 | Timeline de marcos |
| 37. Modo Foco | Medio | Baixo | S9 | Silencio inteligente + buffer |
| 38. Coaching Negociacao | Medio | Alto | S9 | Research de mercado + briefing |
| 40. Assistente Impostos | Alto | Alto | S9 | Categorizacao fiscal + prazos |
| 45. Dashboard Sharing | Medio | Medio | S9 | Links publicos read-only |
| 16. Sub-Agent Spawning | Alto | Alto | S10 | Orchestrator de sub-tasks |
| 17. Browser Automation | Alto | Alto | S10 | Headless Chrome — requer infra |
| 18. Web Monitoring | Medio | Medio | S10 | URL subscriptions + alertas |
