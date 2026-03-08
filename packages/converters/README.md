# @purmemo.ai/converters

Platform converters for **AMP (AI Memory Protocol)** — parse ChatGPT, Claude, Gemini, Cursor, Perplexity, Grok, Mistral, and GitHub Copilot exports into portable AMP format.

## Install

```bash
npm install @purmemo.ai/converters
```

## Platform Support

| Platform | Converter | Export Path |
|----------|-----------|-------------|
| ChatGPT | `convertChatGPTExport` | Settings → Data Controls → Export Data → `conversations.json` |
| Claude | `convertClaudeExport` | Settings → Export Data → `conversations.json` |
| Gemini | `convertGeminiExport` | Google Takeout (converter ready; awaiting Google chat export support) |
| Cursor | `convertCursorDBRows` | Auto-extracted from `state.vscdb` via `@purmemo.ai/migrate` |
| Perplexity | `convertPerplexityExport` | Settings → Data Controls → Download My Data |
| Grok | `convertGrokExport` | accounts.x.ai → Download account data → `prod-grok-backend.json` |
| Mistral Le Chat | `convertMistralExport` | Settings → Export |
| GitHub Copilot | `convertGitHubCopilotExport` | VS Code: Command Palette → "Chat: Export Chat..." |

## Usage

```typescript
import {
  convertChatGPTExport,
  convertClaudeExport,
  convertGeminiExport,
  convertCursorDBRows,
  convertPerplexityExport,
  convertGrokExport,
  convertMistralExport,
  convertGitHubCopilotExport,
} from '@purmemo.ai/converters'
import { readFileSync } from 'fs'

// ChatGPT
const chatgpt = convertChatGPTExport(JSON.parse(readFileSync('conversations.json', 'utf-8')))

// Claude
const claude = convertClaudeExport(JSON.parse(readFileSync('conversations.json', 'utf-8')))

// Perplexity
const perplexity = convertPerplexityExport(JSON.parse(readFileSync('perplexity-export.json', 'utf-8')))

// Grok
const grok = convertGrokExport(JSON.parse(readFileSync('prod-grok-backend.json', 'utf-8')))

// Mistral
const mistral = convertMistralExport(JSON.parse(readFileSync('mistral-export.json', 'utf-8')))

// GitHub Copilot Chat (single session or array of sessions)
const copilot = convertGitHubCopilotExport(JSON.parse(readFileSync('copilot-session.json', 'utf-8')))
```

All converters return an `AMPExport` object:

```typescript
{
  amp_version: "0.1",
  exported_at: "2026-03-08T00:00:00.000Z",
  platform: "chatgpt",
  conversation_count: 42,
  conversations: [
    {
      id: "...",
      title: "...",
      platform: "chatgpt",
      messages: [
        {
          id: "...",
          role: "user",       // "user" | "assistant" | "system" | "tool"
          content: "...",
          platform: "chatgpt",
          timestamp: "2026-03-08T00:00:00.000Z",
          model: "gpt-4o",
          parent_id: null,
          sources: null,      // AMPSource[] for Perplexity/Grok citations
          metadata: {}
        }
      ],
      created_at: "...",
      updated_at: "...",
      source_format: "chatgpt-export-v1",
      amp_version: "0.1"
    }
  ]
}
```

## Utilities

Shared normalization helpers — useful when building custom converters:

```typescript
import { normalizeRole, normalizeTimestamp } from '@purmemo.ai/converters'

// Maps platform-specific role strings to AMP roles
normalizeRole('human')       // → "user"   (Claude)
normalizeRole('grok')        // → "assistant" (Grok)
normalizeRole('model')       // → "assistant" (Gemini)
normalizeRole('userPrompt')  // → "user"   (M365 Copilot)
normalizeRole('CHATBOT')     // → "assistant" (Cohere)

// Handles ISO 8601, Unix seconds, Unix ms, BSON $date.$numberLong
normalizeTimestamp(1741348800)                           // Unix seconds → ISO
normalizeTimestamp(1741348800000)                        // Unix ms → ISO
normalizeTimestamp({ $date: { $numberLong: "1741348800000" } })  // BSON → ISO
normalizeTimestamp("2026-03-08T00:00:00Z")              // pass-through
normalizeTimestamp(null)                                 // → null
```

## Citations / Sources

Perplexity and Grok include web search citations. These are preserved in the `sources` field on assistant messages:

```typescript
{
  role: "assistant",
  content: "AMP is the AI Memory Protocol...",
  sources: [
    {
      url: "https://github.com/purmemo-ai/purmemo-amp",
      title: "purmemo-amp",
      snippet: "The open protocol for AI conversation portability."
    }
  ]
}
```

## Community

- [Discord](https://discord.gg/QWgm9qw4b2) — get help, discuss the spec, share your conversions
- [GitHub Issues](https://github.com/purmemo-ai/purmemo-amp/issues) — bug reports and feature requests

## Links

- [AMP Spec](https://github.com/purmemo-ai/purmemo-amp/blob/main/spec/AMP-v0.1.md)
- [GitHub](https://github.com/purmemo-ai/purmemo-amp)
- [npm org](https://www.npmjs.com/org/purmemo.ai)

Apache 2.0 — by [pūrmemo](https://purmemo.ai)
