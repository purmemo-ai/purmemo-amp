# purmemo-amp — Claude Code Context

This repo is the public open-source layer of pūrmemo: the AMP (AI Memory Protocol) specification, platform converters, migration CLI, and reference MCP server.

## Load Context from pūrmemo MCP

At session start, always call:
1. `recall_memories("purmemo-amp AMP architecture decisions")` — load ADRs and strategic context
2. `recall_memories("purmemo playbook 2.0")` — load overall strategy
3. `get_user_context()` — load project-wide context

Key memories to recall:
- "purmemo-amp ADR-001 through ADR-004" — all pre-build decisions
- "Purmemo Playbook 2.0 Complete Strategy" — 5-track strategy, 20 Q&A


## Repo Structure

```
packages/schema/     @purmemo.ai/schema     — Zod schema + TypeScript types (AMP v0.1)
packages/converters/ @purmemo.ai/converters — Platform parsers (ChatGPT DAG, more coming)
packages/migrate/    @purmemo.ai/migrate    — Commander.js CLI
packages/mcp/        @purmemo.ai/mcp        — Reference MCP server
spec/AMP-v0.1.md                        — Human-readable spec
```

## Key Decisions (from pūrmemo MCP memory)

- **AMP = AI Memory Protocol** (not Portability). Tagline: "The open protocol for AI conversation portability."
- **pūrmemo owns the spec** — AMP is the standard for AI conversation portability.
- **pnpm workspaces** + changesets for monorepo
- **Zod v4** for schema validation, **Commander.js** for CLI
- **Apache-2.0** license
- **Spec v0.1** = Level 1 + Level 2. Level 3 (content_parts, alternates) = v0.2

## Save Back to pūrmemo MCP

After implementation sessions, save decisions via:
```
save_conversation({ title: "purmemo-amp — [topic] — [date]", ... })
```

This file is intentionally thin. The source of truth for strategy, architecture, and decisions is pūrmemo MCP memory.
