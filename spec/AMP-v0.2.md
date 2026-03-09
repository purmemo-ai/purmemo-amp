# AMP — AI Memory Protocol
## Specification v0.2

**Status:** Draft
**Date:** March 2026
**Authors:** pūrmemo (https://purmemo.ai)
**License:** Apache-2.0
**Repository:** https://github.com/purmemo-ai/purmemo-amp

---

## 1. What's New in v0.2

AMP v0.2 adds **Level 3 — Full Fidelity** support:

| Feature | Description |
|---------|-------------|
| `content_parts[]` | Discriminated union of rich content types (text, image, code, tool calls, citations, thinking) |
| `alternates[]` | Non-canonical conversation branches — preserves ChatGPT edit history and DAG paths |
| `observed_at` | Bi-temporal field — when the converter ran (distinct from platform-reported `created_at`) |
| `amp_version: "0.2"` | Version bump — all v0.2 exports use this literal |

**Backward compatibility:** The `content` field on `AMPMessage` remains **required** in v0.2. Implementations that only consume `content` continue to work unchanged. `content_parts[]` is additive.

---

## 2. Conformance Levels

### Level 1 — Core *(unchanged from v0.1)*

A Level 1 conformant implementation MUST produce or consume:

**AMPMessage:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `role` | `"user" \| "assistant" \| "system" \| "tool"` | Author role |
| `content` | `string` | Plain text content (required in all levels) |
| `platform` | `string` | Source platform identifier |

**AMPConversation:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique conversation identifier |
| `title` | `string` | Human-readable title |
| `platform` | `string` | Source platform |
| `messages` | `AMPMessage[]` | Ordered message array (canonical path) |
| `source_format` | `string` | Platform export format string |
| `amp_version` | `"0.1" \| "0.2"` | AMP spec version |

### Level 2 — Production *(unchanged from v0.1)*

Adds to AMPMessage: `timestamp`, `model`, `parent_id`, `sources[]`, `metadata`.

Adds to AMPConversation: `created_at`, `updated_at`.

### Level 3 — Full Fidelity *(new in v0.2)*

Adds to AMPMessage: `content_parts[]`

Adds to AMPConversation: `alternates[]`, `observed_at`

---

## 3. Level 3 Schema

### AMPContentPart — Discriminated Union

Each part has a `type` discriminant. The full union:

```typescript
type AMPContentPart =
  | AMPTextPart
  | AMPImagePart
  | AMPCodePart
  | AMPToolUsePart
  | AMPToolResultPart
  | AMPCitationPart
  | AMPThinkingPart
```

#### AMPTextPart

```typescript
{
  type: "text"
  text: string
}
```

Plain text segment. When a message has only text content, a single `AMPTextPart` is equivalent to the top-level `content` field.

#### AMPImagePart

```typescript
{
  type: "image"
  url?: string | null        // remote URL (e.g., OpenAI CDN asset)
  data?: string | null       // base64-encoded image data
  mime_type?: string | null  // e.g., "image/png", "image/jpeg"
  alt?: string | null        // alt text or description
}
```

Either `url` or `data` should be populated. Inline images from ChatGPT's multimodal export use `url` pointing to the CDN asset reference.

#### AMPCodePart

```typescript
{
  type: "code"
  language?: string | null   // e.g., "python", "typescript", "bash"
  code: string               // raw code content
}
```

For ChatGPT Code Interpreter blocks (`content_type: "code"`) and execution output (`content_type: "execution_output"`). Also used for GitHub Copilot code snippets.

#### AMPToolUsePart

```typescript
{
  type: "tool_use"
  tool_use_id?: string | null  // platform-assigned invocation ID
  tool_name: string            // name of the tool called
  tool_input?: Record<string, unknown>  // structured input arguments
}
```

For Claude tool_use content parts. Represents the model invoking a tool.

#### AMPToolResultPart

```typescript
{
  type: "tool_result"
  tool_use_id?: string | null  // matches AMPToolUsePart.tool_use_id
  content: string              // result text
}
```

For Claude tool_result content parts. Represents the tool's response to the model.

#### AMPCitationPart

```typescript
{
  type: "citation"
  url?: string | null
  title?: string | null
  snippet?: string | null
}
```

Inline citation reference. Preferred over the top-level `sources[]` field for platforms where citations are interleaved with content (Perplexity, Grok). The `sources[]` field is preserved for backward compatibility but considered Level 2; `AMPCitationPart` is the Level 3 representation.

#### AMPThinkingPart

```typescript
{
  type: "thinking"
  thinking: string             // extended thinking / chain-of-thought
}
```

For Claude extended thinking content. Preserved for analytical use cases (research, auditing reasoning quality).

---

### AMPAlternate

```typescript
{
  branch_point_id: string      // node ID where this branch diverges
  messages: AMPMessage[]       // messages on this alternate path
  is_current: boolean          // true = this is the canonical path
}
```

Used to represent non-canonical branches in ChatGPT's DAG format (edit history, regenerated responses). The canonical path is always in `AMPConversation.messages`. Alternates contain the divergent paths.

**Rule:** Exactly one alternate (or the main messages array) should have `is_current: true`.

---

### Updated AMPMessage (v0.2)

```typescript
{
  // Level 1 (required)
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string              // plain text — REQUIRED even in v0.2
  platform: string

  // Level 2 (optional)
  timestamp?: string | null
  model?: string | null
  parent_id?: string | null
  sources?: AMPSource[] | null
  metadata?: Record<string, unknown>

  // Level 3 (optional, new in v0.2)
  content_parts?: AMPContentPart[]
}
```

### Updated AMPConversation (v0.2)

```typescript
{
  // Level 1 (required)
  id: string
  title: string
  platform: string
  messages: AMPMessage[]

  // Level 2 (optional)
  created_at?: string | null
  updated_at?: string | null

  // Provenance (required)
  source_format: string
  amp_version: "0.2"           // bumped from "0.1"

  // Level 3 (optional, new in v0.2)
  observed_at?: string | null  // ISO 8601 — when the converter ran
  alternates?: AMPAlternate[]
}
```

---

## 4. Per-Platform content_parts Support

| Platform | Text | Image | Code | ToolUse | ToolResult | Citation | Thinking | Alternates |
|----------|------|-------|------|---------|------------|----------|----------|------------|
| ChatGPT | ✅ | ✅ | ✅ | — | — | ✅ | — | ✅ |
| Claude | ✅ | — | — | ✅ | ✅ | — | ✅ | — |
| Gemini | ✅ | ✅ | — | — | — | — | — | — |
| Cursor | ✅ | — | — | — | — | — | — | — |
| Perplexity | ✅ | — | — | — | — | ✅ | — | — |
| Grok | ✅ | — | — | — | — | ✅ | — | — |
| Mistral | ✅ | — | — | — | — | — | — | — |
| GitHub Copilot | ✅ | — | ✅ | — | — | — | — | — |

---

## 5. Backward Compatibility

v0.2 is designed to be a superset of v0.1:

1. **`content` is always required.** Converters that produce `content_parts[]` MUST also populate `content` with a plain-text representation of the message. This ensures v0.1 consumers work without modification.

2. **`amp_version` is a literal.** v0.2 exports use `"0.2"`. v0.1 exports remain valid. The schema accepts both via a union (`z.union([z.literal('0.1'), z.literal('0.2')])`).

3. **New fields are all optional.** `content_parts`, `alternates`, and `observed_at` are all optional. Absent = v0.1 behavior.

---

## 6. observed_at — Bi-temporal Design

AMP v0.2 distinguishes two time axes:

| Field | Meaning | Set by |
|-------|---------|--------|
| `created_at` | When the conversation was created on the platform | Platform (from export) |
| `observed_at` | When the converter processed this conversation | Converter (at runtime) |

`observed_at` enables:
- **Deduplication** — detect re-imports of the same source data
- **Provenance auditing** — know when a migration happened
- **Incremental sync** — process only conversations observed after a given timestamp

Converters MUST set `observed_at = new Date().toISOString()` on every exported conversation.

---

## 7. alternates — DAG Branch Preservation

ChatGPT stores conversations as a DAG where each node has a `children[]` array. The canonical path (walking `current_node` back to root) is placed in `AMPConversation.messages`. All other branches are placed in `AMPConversation.alternates[]`.

**Example:**

```
root → A → B (canonical) → D
            ↘ C (alternate)
```

Result:
```json
{
  "messages": [ ..., A, B, D ],
  "alternates": [
    {
      "branch_point_id": "node-B-parent-id",
      "messages": [ C ],
      "is_current": false
    }
  ]
}
```

Non-ChatGPT platforms with linear conversation formats (Claude, Gemini, etc.) will have `alternates: undefined` or an empty array.

---

## 8. Versioning

The `amp_version` field declares which spec version the export uses.

| Value | Spec | Level |
|-------|------|-------|
| `"0.1"` | AMP v0.1 | L1 + L2 |
| `"0.2"` | AMP v0.2 | L1 + L2 + L3 |

v0.1 exports remain valid and parseable. Consumers should handle both version literals.

---

## 9. Migration from v0.1

To upgrade an existing converter to v0.2:

1. Change `amp_version: AMP_VERSION` — the constant is bumped to `"0.2"`
2. Add `observed_at: new Date().toISOString()` to each `AMPConversation`
3. Populate `content_parts[]` on messages where rich content is available (optional but recommended)
4. For ChatGPT: traverse all branches and populate `alternates[]`

Converters that only add `observed_at` (steps 1–2) achieve minimal v0.2 conformance.

---

## 10. License

Apache-2.0. See [LICENSE](../LICENSE).
