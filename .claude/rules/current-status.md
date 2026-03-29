# Current Status

**Ultima atualizacao:** 2026-03-29

## Wave 2 Improvements (2026-03-29)
**Status: [✅ Completo]**

Continuacao do hardening. Score estimado subiu de ~69 para ~78/100.

### O que foi implementado:

| Area | O que mudou |
|------|------------|
| Zod Validation | +3 modulos completados: career, entertainment, legal → 18/18 agora |
| Tool Arg Validation | Zod schemas para save_memory, create_transaction, log_sleep, log_workout, create_person |
| Budget Control | Daily budget guard: MODEL_DAILY_BUDGET_USD env var, trackUsage() no handler |
| Memory System | getLinkedMemories com BFS multi-hop real (ate 3 hops), explore_memory_graph tool |
| Context Engine | Keywords expandidos (~3x mais por modulo), requiresSpecificData patterns adicionados |
| Agent Intelligence | Confidence signaling: "Acredito que..." / "Nao tenho certeza..." instructions |
| Mobile | Dashboard layout, sidebar overlay, topbar hamburger, finances/health/people/objectives/calendar/routine |
| A11y | aria-label em sidebar/topbar, aria-current em nav links, biome ARIA rules enabled |
| Tests | 84 → 117 testes, 12 → 15 test files (context-engine, shared/validation, agent-resolver) |
| i18n | next-intl wired: withNextIntl plugin + NextIntlClientProvider em layout |
| Error Tracking | /errors endpoint no agent server + error-reporter.ts no web |
| Welcome Wizard | Componente de onboarding para novos usuarios |
| Web Vitals | initWebVitals() monitorando LCP/FID/CLS |
| Memory Forgetter | Automation: arquiva memorias nao usadas (>90d sem acesso ou >180d) |
| Layout Export/Import | Export/import de widget layout como JSON nas settings |

## P0 Proximas Acoes

1. Knowledge graph visualization no memory dashboard
2. Testes E2E com Playwright (login, settings, automations)
3. Proactive insights via gap-scanner UI
4. PWA support (manifest + service worker)
5. Multi-tenant observability (por-tenant activity_log dashboard)
