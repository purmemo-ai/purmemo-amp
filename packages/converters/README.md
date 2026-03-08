# @purmemo.ai/converters

Platform converters for **AMP (AI Memory Protocol)** — parse ChatGPT, Claude, Gemini, and Cursor exports into portable AMP format.

## Install

```bash
npm install @purmemo.ai/converters
```

## Usage

```typescript
import { convertChatGPTExport, convertChatGPTConversation } from '@purmemo.ai/converters'

// Convert a full conversations.json export
const ampExport = convertChatGPTExport(rawJSON)

// Convert a single conversation
const ampConversation = convertChatGPTConversation(rawConversation)
```

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| ChatGPT | ✅ v0.1.0 | Full DAG parsing, multimodal, code interpreter |
| Claude | Coming v0.2 | |
| Gemini | Coming v0.2 | |
| Cursor | Coming v0.2 | |

## ChatGPT Export Format

ChatGPT exports conversations as a DAG (directed acyclic graph) in `conversations.json`. This converter:

- Walks the canonical path from `current_node` back to root
- Handles GPT-4o multimodal messages (text + image parts)
- Handles code interpreter output, browsing citations, tether quotes
- Skips internal tool routing messages
- Preserves model slug per message

## Community

- [Discord](https://discord.gg/QWgm9qw4b2) — get help, share feedback, discuss the spec
- [GitHub Issues](https://github.com/purmemo-ai/purmemo-amp/issues) — bug reports and feature requests

## Links

- [AMP Spec](https://github.com/purmemo-ai/purmemo-amp/blob/main/spec/AMP-v0.1.md)
- [GitHub](https://github.com/purmemo-ai/purmemo-amp)
- [npm org](https://www.npmjs.com/org/purmemo.ai)

Apache 2.0 — by [pūrmemo](https://purmemo.ai)
