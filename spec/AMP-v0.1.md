# AMP — AI Memory Protocol
## Specification v0.1

**Status:** Draft
**Date:** March 2026
**Authors:** pūrmemo (https://purmemo.ai)
**License:** Apache-2.0
**Repository:** https://github.com/purmemo-ai/purmemo-amp

---

## 1. Introduction

AMP (AI Memory Protocol) is an open specification for representing and exchanging AI conversation history across platforms. It defines a minimal, platform-agnostic data format for AI conversations that enables:

- **Portability** — move your conversations between ChatGPT, Claude, Gemini, Cursor, and any future platform
- **Interoperability** — any tool can read and write AMP without understanding platform-specific formats
- **Ownership** — your conversations are yours; AMP gives you a format that no single vendor controls
- **Intelligence** — structured data enables search, analysis, and cross-platform pattern detection

There is currently no equivalent of IMAP for AI conversations. No common schema. No interchange format. AMP is that format.

---

## 2. Design Principles

1. **Flat over nested.** AMP normalizes platform-specific structures (e.g., ChatGPT's DAG) into a linear message array. Complexity is hidden in the converter, not the format.

2. **Platform-agnostic core.** The core fields contain no platform-specific concepts. Platform-specific data belongs in `metadata{}`.

3. **Provenance required.** Every conversation must declare its `platform` and `source_format`. You should always know where data came from.

4. **Null-safe timestamps.** Many platforms have missing or unreliable timestamps. AMP treats all timestamps as nullable rather than requiring synthetic values.

5. **Content as plain text in v0.1.** The `content` field is always a normalized plain text string. Rich content types (images, code blocks, citations) are reserved for v0.2 `content_parts[]`.

6. **Conformance levels.** AMP defines three conformance levels to minimize the barrier for implementers:
   - **Level 1** — trivially implementable (5 fields)
   - **Level 2** — production-quality (adds timestamps, model, provenance)
   - **Level 3** — full fidelity (rich content, branches) — *v0.2*

---

## 3. Conformance Levels

### Level 1 — Core

A Level 1 conformant implementation MUST produce or consume:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the message |
| `role` | `"user" \| "assistant" \| "system" \| "tool"` | Author role |
| `content` | `string` | Plain text content of the message |
| `platform` | `string` | Source platform identifier |

And at the conversation level:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique conversation identifier |
| `title` | `string` | Human-readable conversation title |
| `platform` | `string` | Source platform identifier |
| `messages` | `AMPMessage[]` | Ordered array of messages (canonical path) |
| `source_format` | `string` | Platform export format (e.g. `"chatgpt-export-v1"`) |
| `amp_version` | `"0.1"` | AMP spec version |

### Level 2 — Production

A Level 2 conformant implementation additionally supports:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `string (ISO 8601) \| null` | Message creation time |
| `model` | `string \| null` | Model that generated the response |
| `parent_id` | `string \| null` | Parent message ID (for provenance) |
| `metadata` | `Record<string, unknown>` | Platform-specific extra data |

And at the conversation level:

| Field | Type | Description |
|-------|------|-------------|
| `created_at` | `string (ISO 8601) \| null` | Conversation creation time |
| `updated_at` | `string (ISO 8601) \| null` | Last update time |

### Level 3 — Full Fidelity *(v0.2 — not yet specified)*

Level 3 will add:
- `content_parts[]` — rich content (images, code blocks, citations, tool calls)
- `alternates[]` — conversation branches (non-canonical paths)
- Confidence scores on extracted entities
- Bi-temporal tracking (created_at vs observed_at)

---

## 4. Full Schema

### AMPMessage

```typescript
{
  // Level 1
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string              // normalized plain text
  platform: string             // "chatgpt" | "claude" | "gemini" | "cursor" | "perplexity" | "other"

  // Level 2 (optional)
  timestamp?: string | null    // ISO 8601 with timezone offset, e.g. "2026-03-07T10:00:00.000Z"
  model?: string | null        // e.g. "gpt-4o", "claude-3-5-sonnet", "gemini-2.0-pro"
  parent_id?: string | null    // ID of the parent message in the original platform
  metadata?: Record<string, unknown>  // platform-specific fields
}
```

### AMPConversation

```typescript
{
  // Level 1
  id: string
  title: string
  platform: string
  messages: AMPMessage[]       // canonical path, root to leaf, ordered chronologically

  // Level 2 (optional)
  created_at?: string | null   // ISO 8601
  updated_at?: string | null   // ISO 8601

  // Provenance (required)
  source_format: string        // e.g. "chatgpt-export-v1", "claude-api-v1"
  amp_version: "0.1"
}
```

### AMPExport

```typescript
{
  amp_version: "0.1"
  exported_at: string          // ISO 8601 — when this AMP file was generated
  platform: string
  conversation_count: number
  conversations: AMPConversation[]
}
```

---

## 5. Platform Source Formats

| Platform | Source Format Identifier | Export Method |
|----------|--------------------------|---------------|
| ChatGPT | `chatgpt-export-v1` | Settings → Data Controls → Export Data → `conversations.json` |
| Claude | `claude-export-v1` | Settings → Export Data → `conversations.json` |
| Gemini | `gemini-takeout-v1` | Google Takeout → My Activity → Gemini Apps Activity |
| Cursor | `cursor-sqlite-v1` | Local `state.vscdb` (auto-extracted, no export needed) |
| Perplexity | `perplexity-export-v1` | Settings → Data Controls → Download My Data |
| Grok | `grok-export-v1` | accounts.x.ai → Download account data → `prod-grok-backend.json` |
| Mistral Le Chat | `mistral-export-v1` | Settings → Export |
| GitHub Copilot Chat | `github-copilot-export-v1` | VS Code: Command Palette → "Chat: Export Chat..." |

---

## 6. Known Platform Quirks

### ChatGPT
- Export is a DAG (directed acyclic graph), not a linear array. Converters must walk from `current_node` backwards to extract the canonical path.
- Many nodes have `create_time: null` — always treat as nullable.
- `content.parts[]` is heterogeneous: strings, image asset pointers, code blocks.
- Internal routing messages (where `recipient !== "all"`) should be excluded from the canonical path in v0.1.

### Gemini
- Google Takeout's "Gemini" category exports Gems configuration, NOT chat history.
- Chat history is under **My Activity → Gemini Apps Activity** in Takeout.

### Cursor
- Older Cursor versions lack timestamps entirely — `timestamp: null` is expected.
- Cursor stores chats in local SQLite (`state.vscdb`) — this is the user's data on their own machine.

### Grok
- Export uses BSON-style timestamps: `{ "$date": { "$numberLong": "1741348800000" } }` — must be normalized to ISO 8601.
- Assistant messages include web search citations — preserved in the `sources[]` field.

### GitHub Copilot Chat
- Each exported file is a single session. Converters accept either a single session object or an array.
- VS Code exports via Command Palette → "Chat: Export Chat..." (JSON format).

---

## 7. Versioning

AMP uses semantic versioning. The `amp_version` field in all exports identifies the spec version used.

- **v0.x** — draft spec, may have breaking changes between minor versions
- **v1.0** — stable spec, backwards compatibility guaranteed within major version
- **vN.0** — major versions may have breaking changes

Converters MUST set `amp_version` to the version of the spec they implement.

---

## 8. Relationship to Other Standards

### MCP (Model Context Protocol)
MCP defines transport (JSON-RPC 2.0) for Resources, Prompts, and Tools. It has no concept of conversation schema or portability. AMP is complementary: AMP defines what conversation data looks like; MCP defines how to serve it to AI tools. The `@purmemo/mcp` package provides a reference MCP server that serves AMP data.

### IMAP / MBOX
AMP aspires to be for AI conversations what IMAP/MBOX is for email: an open, vendor-neutral format that enables portability and interoperability at scale.

---

## 9. Contributing

AMP is an open specification. Contributions welcome:

- **Converters** for new platforms (Perplexity, Mistral, GitHub Copilot, and others)
- **Level 3 spec design** — `content_parts[]` schema for rich content
- **Tooling** — validators, importers, MCP server implementations
- **Translations** — spec in other languages

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

## 10. License

Apache-2.0. See [LICENSE](../LICENSE).

This specification is intentionally permissively licensed. Implement it freely in commercial or open-source projects.
