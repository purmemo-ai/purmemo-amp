# @purmemo.ai/schema

TypeScript types and Zod validators for the **AMP (AI Memory Protocol)** format.

## Install

```bash
npm install @purmemo.ai/schema
```

## Usage

```typescript
import { AMPExport, AMPConversation, AMPMessage, parseAMPExport } from '@purmemo.ai/schema'

// Validate an AMP export
const result = parseAMPExport(data)
if (result.success) {
  console.log(result.data.conversations.length)
} else {
  console.error(result.error.format())
}
```

## AMP Format

AMP (AI Memory Protocol) is an open format for AI conversation portability. A valid AMP export looks like:

```json
{
  "amp_version": "0.1",
  "exported_at": "2026-03-07T00:00:00.000Z",
  "platform": "chatgpt",
  "conversation_count": 1,
  "conversations": [
    {
      "id": "abc123",
      "title": "My conversation",
      "platform": "chatgpt",
      "source_format": "chatgpt-export-v1",
      "amp_version": "0.1",
      "messages": [
        {
          "id": "msg1",
          "role": "user",
          "content": "Hello",
          "platform": "chatgpt"
        }
      ]
    }
  ]
}
```

## Supported Platforms

<!-- PLATFORMS:schema -->
`chatgpt` | `claude` | `gemini` | `cursor` | `perplexity` | `grok` | `mistral` | `github-copilot`
<!-- /PLATFORMS -->

## Conformance Levels

| Level | Fields |
|-------|--------|
| L1 | `id`, `role`, `content`, `platform` |
| L2 | + `timestamp`, `model`, `parent_id`, `metadata` |

## Community

- [Discord](https://discord.gg/QWgm9qw4b2) — get help, share feedback, discuss the spec
- [GitHub Issues](https://github.com/purmemo-ai/purmemo-amp/issues) — bug reports and feature requests

## Links

- [AMP Spec](https://github.com/purmemo-ai/purmemo-amp/blob/main/spec/AMP-v0.1.md)
- [GitHub](https://github.com/purmemo-ai/purmemo-amp)
- [npm org](https://www.npmjs.com/org/purmemo.ai)

Apache 2.0 — by [pūrmemo](https://purmemo.ai)
