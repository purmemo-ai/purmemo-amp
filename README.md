# AMP — AI Memory Protocol

**The open protocol for AI conversation portability.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/@purmemo.ai/migrate)](https://www.npmjs.com/package/@purmemo.ai/migrate)
[![Spec](https://img.shields.io/badge/spec-v0.1-green.svg)](spec/AMP-v0.1.md)

---

There is no IMAP for AI conversations. ChatGPT's export is a nested DAG. Claude's is a flat JSON with tool call noise. Gemini's lives in Google Takeout. Cursor's is buried in a local SQLite database. None of them talk to each other.

**AMP is the missing standard.**

---

## Quick Start

```bash
# ChatGPT, Claude, or Gemini — auto-detects the platform
npx @purmemo.ai/migrate import conversations.json

# Cursor — reads directly from your local database, no export needed
npx @purmemo.ai/migrate cursor-extract

# Add --markdown for a human-readable version
npx @purmemo.ai/migrate import conversations.json --markdown
```

---

## How to Export

### ChatGPT
1. ChatGPT → Settings → Data Controls → **Export Data**
2. Download ZIP → extract `conversations.json`
3. `npx @purmemo.ai/migrate import conversations.json`

### Claude
1. Claude.ai → Settings → **Export Data**
2. Download ZIP → extract `conversations.json`
3. `npx @purmemo.ai/migrate import conversations.json`

### Gemini
> **Note:** Google Takeout does not currently include Gemini chat history — only Gems (custom instructions) and Workspace data. This is a Google limitation. The AMP Gemini converter is ready for when Google adds chat export support. [Request it here](https://support.google.com/gemini/answer/13594961).

### Cursor
No export needed — Cursor stores your full chat history locally:

```bash
npx @purmemo.ai/migrate cursor-extract
# Reads from: ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
# Outputs: cursor.amp.json
```

---

## Platform Support

| Platform | Status | How to export |
|----------|--------|---------------|
| ChatGPT | ✅ v0.1.0 | Settings → Data Controls → Export Data |
| Claude | ✅ v0.1.1 | Settings → Export Data |
| Gemini | ✅ v0.1.2 (converter ready) | Awaiting Google Takeout chat export support |
| Cursor | ✅ v0.1.3 | Auto-extracted from local SQLite DB |
| Perplexity | 🚧 Coming soon | — |

---

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [`@purmemo.ai/schema`](packages/schema) | Zod schema + TypeScript types for AMP v0.1 | [![npm](https://img.shields.io/npm/v/@purmemo.ai/schema)](https://www.npmjs.com/package/@purmemo.ai/schema) |
| [`@purmemo.ai/converters`](packages/converters) | Platform parsers: ChatGPT, Claude, Gemini, Cursor | [![npm](https://img.shields.io/npm/v/@purmemo.ai/converters)](https://www.npmjs.com/package/@purmemo.ai/converters) |
| [`@purmemo.ai/migrate`](packages/migrate) | CLI: `npx @purmemo.ai/migrate import <file>` | [![npm](https://img.shields.io/npm/v/@purmemo.ai/migrate)](https://www.npmjs.com/package/@purmemo.ai/migrate) |
| [`@purmemo.ai/mcp`](packages/mcp) | Reference MCP server for AMP data | [![npm](https://img.shields.io/npm/v/@purmemo.ai/mcp)](https://www.npmjs.com/package/@purmemo.ai/mcp) |

---

## The AMP Schema

**AMPMessage** — a single message:
```typescript
{
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string              // normalized plain text
  platform: string             // "chatgpt" | "claude" | "gemini" | "cursor" | ...
  timestamp?: string | null    // ISO 8601
  model?: string | null        // e.g. "gpt-4o", "claude-3-5-sonnet"
  parent_id?: string | null
  metadata?: Record<string, unknown>
}
```

**AMPConversation** — a full conversation:
```typescript
{
  id: string
  title: string
  platform: string
  messages: AMPMessage[]       // canonical path, chronological order
  created_at?: string | null
  updated_at?: string | null
  source_format: string        // e.g. "chatgpt-export-v1"
  amp_version: "0.1"
}
```

Full spec → [spec/AMP-v0.1.md](spec/AMP-v0.1.md)

---

## Use Programmatically

```typescript
import { convertChatGPTExport, convertClaudeExport, convertCursorDBRows } from '@purmemo.ai/converters'
import { parseAMPExport } from '@purmemo.ai/schema'
import { readFileSync } from 'fs'

// ChatGPT
const raw = JSON.parse(readFileSync('conversations.json', 'utf-8'))
const ampExport = convertChatGPTExport(raw)
console.log(`${ampExport.conversation_count} conversations converted`)

// Validate
const result = parseAMPExport(ampExport)
if (result.success) console.log('Valid AMP export')
```

---

## Contributing

AMP is open-source and open-standard. Contributions welcome:

- **Platform converters** — Perplexity, Mistral, Copilot, and others
- **Level 3 spec** — `content_parts[]` for rich content (images, code, citations)
- **Validators** — JSON Schema, Python, Go implementations
- **MIF bridge** — converter between AMP and MIF formats

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Built By

[pūrmemo](https://purmemo.ai) — the memory layer for AI-native workflows. We built AMP because we needed it, and because the ecosystem needs it.

---

## License

Apache-2.0 — use freely in commercial or open-source projects.
