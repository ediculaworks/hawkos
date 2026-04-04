# Reference Repository Analysis — 2026-04-03

6 repos analyzed across 6 deep passes. ~115 patterns documented.

## Repos Analyzed

| Repo | Type | Key Takeaways |
|------|------|--------------|
| **TaxHacker** | AI accountant (Next.js, Prisma, multi-LLM) | SSE progress, ActionState envelope, custom fields, CSV export |
| **OpenClaw** | Personal AI assistant (Node.js, 20+ channels) | Plugin SDK, MCP bridge, canvas rendering, sandbox execution |
| **Hermes Agent** | Self-improving AI (Python, Nous Research) | Prompt assembly, context compression, skill learning, 51+ secret redaction patterns |
| **Onyx** | Enterprise RAG platform (FastAPI + Next.js) | Hybrid search (RRF), 65+ connectors, deep research, OAuth manager |
| **fff.nvim** | Fast file finder (Rust, MCP server) | Frecency algorithm, combo-boost, LMDB, SIMD search |
| **prompts.chat** | AI prompt library (Next.js, Prisma) | Feature flags, SSRF validation, i18n, change requests |

## Definitive Top 20 — Priority Patterns for Hawk OS

| # | Pattern | Source | Wave | Why |
|---|---------|--------|------|-----|
| 1 | **Secret redaction** (51+ patterns for API keys, tokens in LLM context) | Hermes | 4 | Security — secrets currently sent to LLM unredacted |
| 2 | **Prompt injection scanning** (14 regex + unicode detection) | Hermes | 4 | Security — context files not scanned |
| 3 | **Machine-readable error codes** (`HawkErrorCode` enum) | Onyx | 4 | DX — our errors are inconsistent strings |
| 4 | **[SILENT] cron suppression** | Hermes | 4 | UX — daily check-in always sends even when nothing changed |
| 5 | **Per-component fault isolation** (memory/context failures don't crash handler) | Hermes | 4 | Reliability — single failures cascade |
| 6 | **Platform-specific prompt hints** (Discord vs web formatting) | Hermes | 4 | Quality — same prompt for all channels |
| 7 | **Tool pair sanitization** after compression | Hermes | 4 | Correctness — orphaned tool_calls break LLM |
| 8 | **Per-task auxiliary models** (cheap model for compression, memory flush) | Hermes | 5 | Cost — we use primary model for everything |
| 9 | **SSRF validation** for webhook URLs | prompts.chat | 5 | Security — needed before Wave 5 webhooks |
| 10 | **OAuth token manager** with auto-refresh + 60s buffer | Onyx | 5 | Required — Google Calendar connector needs this |
| 11 | **MCP discovery-first setup** (connect → discover → select tools) | Hermes | 5 | UX — clean MCP onboarding |
| 12 | **SSE progress streaming** for long agent tasks | TaxHacker | 5 | UX — better than polling |
| 13 | **URL-synced filter state** for dashboard pages | TaxHacker | 5 | UX — filters persist in URL, shareable |
| 14 | **Graceful shutdown** (signal handlers, task cancellation, lock cleanup) | Hermes | 5 | Reliability — our agent has no shutdown handler |
| 15 | **Iterative context summaries** (Goal/Progress/Decisions/Next template) | Hermes | 6 | Intelligence — compression loses less info |
| 16 | **Weighted RRF** for hybrid search | Onyx | 6 | Quality — better ranking than linear weighting |
| 17 | **Credential pool with rotation** (FILL_FIRST, ROUND_ROBIN, LEAST_USED) | Hermes | 6 | Resilience — multi-key failover with cooldowns |
| 18 | **Smart model routing** by message complexity | Hermes | 6 | Cost — short messages → cheap model |
| 19 | **Context references with token budgets** (@file, @url with hard/soft limits) | Hermes | 7 | Safety — bounded context injection |
| 20 | **Typed SSE streaming packets** (40+ types for tool progress, citations, permissions) | Onyx | 7 | UX — rich real-time agent feedback |

## Updated Wave Roadmap

### Wave 4 (Already Partially Implemented)
Done: Feature flags, tool approval, hybrid search, frecency scoring.
Remaining: Secret redaction, prompt injection scanning, error codes, [SILENT] cron, fault isolation, platform hints, tool pair sanitization.

### Wave 5 — MCP, Connectors, Infrastructure
Per-task auxiliary models, SSRF validation, OAuth token manager, MCP discovery, SSE streaming, URL-synced filters, graceful shutdown.

### Wave 6 — Intelligence & Cost
Iterative context summaries, weighted RRF, credential pool rotation, smart model routing.

### Wave 7 — Platform & UX
Context references with budgets, typed SSE packets, multi-channel, plugin SDK.

## All 23 Pattern Sections (A-W)

Full analysis with ~115 patterns in plan file: `.claude/plans/glistening-munching-curry.md`

| Section | Area | Count |
|---------|------|-------|
| A | Security & Resilience | 4 |
| B | Agent Intelligence | 6 |
| C | Cost & Token Management | 3 |
| D | UX & Data Patterns | 6 |
| E | Frecency Deep Details | 5 |
| F | Infrastructure Patterns | 6 |
| G | Testing Patterns | 4 |
| H | DevOps & Deployment | 4 |
| I | Advanced Data Patterns | 8 |
| J | Social & API Patterns | 4 |
| K | Real-time & Streaming | 4 |
| L | State Management | 4 |
| M | Caching & Connection Pooling | 5 |
| N | Observability & Error Handling | 5 |
| O | UI Component Patterns | 6 |
| P | API & Validation | 4 |
| Q | Configuration & Environment | 5 |
| R | Hidden Algorithms | 6 |
| S | Skill & Agent Architecture | 4 |
| T | System Prompt Assembly | 5 |
| U | Graceful Shutdown | 4 |
| V | Edge Cases in Agents | 5 |
| W | Data Privacy & Secrets | 4 |

## Decisions

- Feature flags: Per-tenant (6-tenant architecture)
- First connector: Google Calendar
- MCP: Client + Server
- Multi-channel: Deferred to Wave 7
