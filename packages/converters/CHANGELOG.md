# @purmemo.ai/converters

## 0.3.0

### Minor Changes

- b5b8d24: ## Platform Expansion — Perplexity, Grok, Mistral, GitHub Copilot

  ### @purmemo.ai/converters v0.2.0

  **New converters (4 platforms):**

  - **Perplexity** — parses GDPR data export ZIP; expands `query`/`answer` pairs into user/assistant turns; preserves `citations[]` as `sources[]`
  - **Grok (xAI)** — parses `prod-grok-backend.json` from accounts.x.ai export; handles BSON `$date.$numberLong` timestamps; maps `"human"`/`"grok"` roles
  - **Mistral Le Chat** — parses OpenAI-compatible export schema; role names map directly
  - **GitHub Copilot Chat** — parses VS Code `"Chat: Export Chat..."` JSON; expands `requests[]` into user/assistant turns; skips tool invocations; partial code reuse with Cursor SQLite reader

  **New shared utilities:**

  - `normalizeRole(raw)` — maps 8+ platform-specific role strings to AMP roles (`human`→`user`, `grok`→`assistant`, `model`→`assistant`, `userPrompt`→`user`, `CHATBOT`→`assistant`, etc.)
  - `normalizeTimestamp(raw)` — handles ISO 8601, Unix seconds, Unix milliseconds, BSON `$date.$numberLong`, and numeric strings

  **Test coverage:**

  - 90 tests across 5 test files (utils, perplexity, grok, mistral, github-copilot)

  ### @purmemo.ai/schema v0.1.3

  **New field:**

  - `AMPMessage.sources?: AMPSource[]` — Level 2 field for search citations (Perplexity, Grok, etc.)
  - `AMPSource` type: `{ url?, title?, snippet? }`

  **New platforms in `AMPPlatform` enum:**

  - `"grok"`, `"mistral"`, `"github-copilot"`

  **Platform coverage: 4 → 8**

  | Platform           | Format          | Converter |
  | ------------------ | --------------- | --------- |
  | ChatGPT            | DAG JSON        | ✅ v0.1   |
  | Claude             | Flat JSON       | ✅ v0.1   |
  | Gemini             | Google Takeout  | ✅ v0.1   |
  | Cursor             | SQLite vscdb    | ✅ v0.1   |
  | **Perplexity**     | GDPR ZIP JSON   | ✅ v0.2   |
  | **Grok**           | xAI data export | ✅ v0.2   |
  | **Mistral**        | Le Chat export  | ✅ v0.2   |
  | **GitHub Copilot** | VS Code export  | ✅ v0.2   |

- **AMP v0.2 — Level 3: Rich Content, Edit History, and Bi-temporal Tracking**

  ### Schema (`@purmemo.ai/schema`)

  - **NEW**: `AMPContentPart` — discriminated union of 7 rich content types:

    - `AMPTextPart` (`type: "text"`)
    - `AMPImagePart` (`type: "image"`) — URL or base64 data
    - `AMPCodePart` (`type: "code"`) — with optional language tag
    - `AMPToolUsePart` (`type: "tool_use"`) — Claude tool invocations
    - `AMPToolResultPart` (`type: "tool_result"`) — tool responses
    - `AMPCitationPart` (`type: "citation"`) — inline citations
    - `AMPThinkingPart` (`type: "thinking"`) — Claude extended thinking

  - **NEW**: `AMPAlternate` — non-canonical conversation branches (`branch_point_id`, `messages[]`, `is_current`)

  - **NEW**: `content_parts?: AMPContentPart[]` on `AMPMessage` (Level 3, optional)

  - **NEW**: `observed_at?: string` on `AMPConversation` — when the converter ran (bi-temporal)

  - **NEW**: `alternates?: AMPAlternate[]` on `AMPConversation` — for DAG branch preservation

  - **CHANGED**: `amp_version` accepts `"0.1" | "0.2"` (union, backward compatible)

  - **CHANGED**: `AMP_VERSION` constant bumped from `"0.1"` to `"0.2"`

  - **NEW**: 43 tests covering all new types, backward compatibility, and edge cases

  ### Converters (`@purmemo.ai/converters`)

  All 8 converters updated for AMP v0.2:

  - **ChatGPT**: `content_parts[]` for text, images, code blocks, citations; `alternates[]` from full DAG traversal
  - **Claude**: `content_parts[]` for text, `tool_use`, `tool_result`, `thinking` parts
  - **Gemini**: `content_parts[]` for text and `inlineData` images
  - **Cursor**: `content_parts[]` (text)
  - **Perplexity**: `content_parts[]` with text + citation parts
  - **Grok**: `content_parts[]` (text)
  - **Mistral**: `content_parts[]` (text)
  - **GitHub Copilot**: `content_parts[]` with text and code block splitting

  All converters now set `observed_at` on every exported conversation.

  ### Spec

  - **NEW**: `spec/AMP-v0.2.md` — full Level 3 specification

### Patch Changes

- Updated dependencies [b5b8d24]
- Updated dependencies
  - @purmemo.ai/schema@0.3.0
