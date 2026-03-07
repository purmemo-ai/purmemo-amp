# AMP — AI Memory Protocol

**The open protocol for AI conversation portability.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/@purmemo/migrate)](https://www.npmjs.com/package/@purmemo/migrate)
[![Spec](https://img.shields.io/badge/spec-v0.1-green.svg)](spec/AMP-v0.1.md)

---

There is no IMAP for AI conversations. ChatGPT's export is a nested DAG. Claude's is different JSON. Gemini's is somewhere in Google Takeout. Cursor's is in SQLite. None of them talk to each other.

**AMP is the missing standard.**

---

## What It Does

AMP defines a minimal, platform-agnostic format for AI conversations. One schema. Every platform. Your conversations move with you.

```bash
# Export your ChatGPT history to open AMP format
npx @purmemo/migrate import conversations.json --platform chatgpt

# Output: conversations.amp.json — readable by any AMP tool
# Output: conversations.amp.md  — human-readable Markdown (--markdown)
```

---

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [`@purmemo/schema`](packages/schema) | Zod schema + TypeScript types for AMP v0.1 | [![npm](https://img.shields.io/npm/v/@purmemo/schema)](https://www.npmjs.com/package/@purmemo/schema) |
| [`@purmemo/converters`](packages/converters) | Platform parsers: ChatGPT (more coming) | [![npm](https://img.shields.io/npm/v/@purmemo/converters)](https://www.npmjs.com/package/@purmemo/converters) |
| [`@purmemo/migrate`](packages/migrate) | CLI tool: `npx @purmemo/migrate import <file>` | [![npm](https://img.shields.io/npm/v/@purmemo/migrate)](https://www.npmjs.com/package/@purmemo/migrate) |
| [`@purmemo/mcp`](packages/mcp) | Reference MCP server for AMP data | [![npm](https://img.shields.io/npm/v/@purmemo/mcp)](https://www.npmjs.com/package/@purmemo/mcp) |

---

## Quick Start

### Migrate from ChatGPT

1. Go to ChatGPT → Settings → Data Controls → Export Data
2. Download the ZIP and extract `conversations.json`
3. Run:

```bash
npx @purmemo/migrate import conversations.json --platform chatgpt --markdown --stats
```

Output:
```
📊 Conversion summary:
   Platform:      chatgpt
   Conversations: 847
   Messages:      12,431
   AMP version:   0.1

✅ AMP export written to: conversations.amp.json
📝 Markdown written to:   conversations.amp.md
```

### Use Programmatically

```typescript
import { convertChatGPTExport } from '@purmemo/converters'
import { parseAMPExport } from '@purmemo/schema'
import { readFileSync } from 'fs'

const raw = JSON.parse(readFileSync('conversations.json', 'utf-8'))
const ampExport = convertChatGPTExport(raw)

console.log(`${ampExport.conversation_count} conversations converted`)
```

### Validate an AMP File

```bash
npx @purmemo/migrate validate conversations.amp.json
# ✅ Valid AMP v0.1 export — 847 conversation(s)
```

---

## The AMP Schema

AMP defines two core types:

**AMPMessage** — a single message in a conversation:
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

## Platform Support

| Platform | Import | Export | Status |
|----------|--------|--------|--------|
| ChatGPT | ✅ | — | v0.1 |
| Claude | 🚧 | — | Coming v0.1.x |
| Gemini | 🚧 | — | Coming v0.1.x |
| Cursor | 🚧 | — | Coming v0.1.x |
| Perplexity | 🚧 | — | Coming v0.1.x |

---

## Built By

[pūrmemo](https://purmemo.com) — the memory layer for AI-native workflows. We built AMP because we needed it, and because the ecosystem needs it.

If you find AMP useful, consider trying pūrmemo: cross-platform AI memory management that uses AMP under the hood.

---

## Contributing

AMP is open-source and open-standard. Contributions welcome:

- **Platform converters** — Claude, Gemini, Cursor, Perplexity
- **Level 3 spec** — `content_parts[]` for rich content (images, code, citations)
- **MIF bridge** — converter between AMP and MIF formats
- **Validators** — JSON Schema, Python, Go implementations

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

Apache-2.0 — use freely in commercial or open-source projects.
