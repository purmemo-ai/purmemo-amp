# purmemo-amp Launch Posts — AMP v0.2 — March 2026

---

## 1. SHOW HN

**Title:** Show HN: AMP – Open protocol for AI conversation portability (8 platforms, rich content)

**URL:** https://github.com/purmemo-ai/purmemo-amp

**Text (optional — use if you want a text post instead of URL):**

We built AMP (AI Memory Protocol) because there's no IMAP for AI conversations.

ChatGPT exports a nested DAG. Claude is flat JSON with typed content blocks. Gemini is buried in Google Takeout. Cursor is local SQLite. Perplexity has citation arrays. Grok uses BSON timestamps. GitHub Copilot is a request/response pair format. None of them talk to each other.

AMP normalizes all of them into one clean schema. One CLI command:

    npx @purmemo.ai/migrate import conversations.json

Auto-detects the platform. Outputs valid AMP JSON — flat, chronological, typed. 8 platforms today.

**v0.2 (just shipped) adds Level 3 — full fidelity:**

- `content_parts[]` — discriminated union of 7 types: text, image, code, tool_use, tool_result, citation, thinking. So a Claude response with tool calls preserves the actual tool_use/tool_result structure. A ChatGPT multimodal message preserves the image. Extended thinking is captured in a thinking part, not discarded.
- `alternates[]` — ChatGPT's edit history. When you rephrase a prompt and regenerate, AMP captures all branches, not just the canonical path.
- `observed_at` — bi-temporal: when the converter ran vs when the platform created the conversation. Makes deduplication and incremental sync reliable.

Backward compatible — `content` (plain text) stays required at every level so v0.1 consumers keep working.

The spec is deliberately layered:
- Level 1 = 4 required fields. Trivially implementable.
- Level 2 = adds timestamps, model, provenance. Production-quality.
- Level 3 = rich content + branches. Full fidelity.

Everything is Apache 2.0. Schema is Zod + TypeScript. Converters are pure functions — no network calls, no accounts, runs entirely on your machine.

We're building this as part of pūrmemo (https://purmemo.ai), a cross-platform AI memory layer. But AMP is designed to stand alone — if someone wants to build a competing product on the same format, that's the point.

GitHub: https://github.com/purmemo-ai/purmemo-amp
npm: @purmemo.ai/schema, @purmemo.ai/converters, @purmemo.ai/migrate
Discord: https://discord.gg/QWgm9qw4b2

---

## 2. r/ChatGPT

**Title:** I built an open-source tool to convert your ChatGPT export to a universal format — now preserves images, code blocks, and edit history

**Body:**

After the migration wave hit last month, I kept seeing the same question: "How do I actually move my conversations to Claude?"

The answer was painful. Download a ZIP from ChatGPT, get a `conversations.json` that's a nested tree structure (not even chronological), then... manually paste things into Claude's import tool?

So I built a converter. Then I built converters for Claude, Gemini, Cursor, Perplexity, Grok, Mistral, and GitHub Copilot too. And an open schema (AMP — AI Memory Protocol) so they all normalize into the same format.

**One command:**

```
npx @purmemo.ai/migrate import conversations.json
```

It auto-detects the platform. Outputs clean JSON with every conversation in chronological order.

**What v0.2 adds (just shipped):**

ChatGPT's export is actually a DAG — every time you edit a prompt and regenerate, it creates a branch. v0.1 only kept the canonical path (what you ended up with). v0.2 preserves **all branches** in `alternates[]`. If you went back and tried 3 different prompts, all 3 versions are in your export now.

It also captures `content_parts[]` — so a message with code blocks keeps them as typed code parts (with language), images stay as image parts (url/base64), and citations from web browsing are citation parts with url + snippet. Not everything flattened to a string.

**For Cursor users** — reads directly from local SQLite, no export needed:

```
npx @purmemo.ai/migrate cursor-extract
```

Everything runs locally. No accounts, no API calls, no data leaves your computer. Apache 2.0.

GitHub: https://github.com/purmemo-ai/purmemo-amp

8 platforms today, more coming. PRs for new converters very welcome.

---

## 3. r/ClaudeAI

**Title:** Open-source AMP v0.2 — preserves Claude tool calls, thinking traces, and images when exporting/importing conversations

**Body:**

Hey r/ClaudeAI — we just shipped v0.2 of AMP (AI Memory Protocol), the open standard for AI conversation portability. Wanted to share specifically because Claude users care most about what this release adds.

**The Claude-specific additions in v0.2:**

When you export a Claude conversation that used tools or extended thinking, the export has structured content blocks — not just text. v0.1 of AMP discarded all of that, flattening everything to a plain string. v0.2 preserves it:

```typescript
// A Claude assistant message with tool use now looks like:
{
  role: "assistant",
  content: "",  // plain text fallback for compat
  content_parts: [
    { type: "tool_use", tool_name: "bash", tool_input: { command: "ls -la" } },
    { type: "tool_result", tool_use_id: "toolu_01", content: "total 42\n..." },
    { type: "thinking", thinking: "Let me think through this..." },
    { type: "text", text: "Here's what I found..." }
  ]
}
```

This means agentic conversations — ones where Claude called tools, searched the web, wrote and ran code — are now fully portable and analyzable, not just partially captured.

**The broader AMP schema:**

- 8 platforms: ChatGPT, Claude, Gemini, Cursor, Perplexity, Grok, Mistral, GitHub Copilot
- 3 conformance levels (L1 trivial → L3 full fidelity)
- Backward compatible — plain `content` string stays required
- Runs locally, Apache 2.0, no accounts

```
npx @purmemo.ai/migrate import conversations.json
```

pūrmemo's MCP server (in the MCP Registry as `io.github.purmemo-ai/purmemo`) uses AMP under the hood, so cross-platform memory across Claude Desktop, Cursor, and Windsurf shares a consistent schema.

GitHub: https://github.com/purmemo-ai/purmemo-amp
Discord: https://discord.gg/QWgm9qw4b2

Would love feedback — especially from anyone doing agentic workflows where tool call history matters.

---

## 4. Twitter/X Thread

**Tweet 1:**
We just shipped AMP v0.2 — AI Memory Protocol.

Open standard for AI conversation portability. 8 platforms. Now with full fidelity.

🧵

**Tweet 2:**
The problem: every AI platform stores conversations differently.

ChatGPT = nested DAG
Claude = typed content blocks
Gemini = buried in Google Takeout
Cursor = local SQLite
Grok = BSON timestamps

None talk to each other.

**Tweet 3:**
AMP normalizes all of them.

```
npx @purmemo.ai/migrate import conversations.json
```

One command. Auto-detects the platform. Clean JSON out.

8 platforms: ChatGPT, Claude, Gemini, Cursor, Perplexity, Grok, Mistral, GitHub Copilot.

**Tweet 4:**
v0.2 adds Level 3 — full fidelity.

content_parts[] preserves:
→ Images (url or base64)
→ Code blocks (with language)
→ Tool calls (Claude tool_use/tool_result)
→ Extended thinking
→ Citations (Perplexity/Grok)

Not everything flattened to a string anymore.

**Tweet 5:**
ChatGPT's export is a DAG. Every time you edit + regenerate, it branches.

v0.1 only kept the canonical path.

v0.2 captures all branches in alternates[]. Your full edit history, not just what you kept.

**Tweet 6:**
3 conformance levels:

L1 = 4 required fields. Trivially implementable.
L2 = timestamps, model, provenance. Production quality.
L3 = rich content + branches. Full fidelity.

Backward compatible. content string stays required at every level.

**Tweet 7:**
Apache 2.0. Pure TypeScript. Runs locally. No accounts, no network calls.

@purmemo.ai/schema — Zod types
@purmemo.ai/converters — platform parsers
@purmemo.ai/migrate — CLI

github.com/purmemo-ai/purmemo-amp

**Tweet 8:**
This is the open layer of @purmemio.

The spec is designed to stand alone — if someone wants to build a competing product on the same format, that's the point. IMAP for AI conversations.

Star us if you care about AI data portability ⭐

---

## 5. Dev.to / Hashnode Article

**Title:** AMP v0.2: Preserving Rich Content When Migrating AI Conversations

**Subtitle:** How we designed a backward-compatible Level 3 schema for tool calls, images, edit history, and thinking traces

**Intro:**

When we shipped AMP v0.1, we made a deliberate tradeoff: normalize everything to plain text. It got converters shipped fast and made the schema trivially implementable. But it threw away information — tool calls, images, code blocks, citations, edit history — that users actually want to preserve.

v0.2 fixes that without breaking anything.

**The backward compat rule:**

The `content` field stays required. Always. Even when `content_parts[]` is present. This means any v0.1 consumer keeps working — they just ignore the new field.

```typescript
// v0.1 consumer sees:
{ role: "assistant", content: "Here's the code:\nconst x = 1" }

// v0.2 consumer sees:
{
  role: "assistant",
  content: "Here's the code:\nconst x = 1",  // still there
  content_parts: [
    { type: "text", text: "Here's the code:" },
    { type: "code", language: "typescript", code: "const x = 1" }
  ]
}
```

**The discriminated union:**

Seven part types, all on a `type` discriminant:

```typescript
type AMPContentPart =
  | { type: "text";        text: string }
  | { type: "image";       url?: string; data?: string; mime_type?: string }
  | { type: "code";        language?: string; code: string }
  | { type: "tool_use";    tool_name: string; tool_input?: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id?: string; content: string }
  | { type: "citation";    url?: string; title?: string; snippet?: string }
  | { type: "thinking";    thinking: string }
```

Zod's `z.discriminatedUnion('type', [...])` handles this cleanly — fast path discrimination, great TypeScript inference, no manual type guards.

**The ChatGPT DAG problem:**

ChatGPT stores conversations as a directed acyclic graph. Every node has a `children[]` array. When you edit a prompt and regenerate, it doesn't overwrite — it creates a branch. The export includes all nodes; the canonical path is determined by walking `current_node` backwards to root.

v0.1 only captured that canonical path. v0.2 adds `alternates[]`:

```typescript
{
  messages: [ ...canonical path... ],
  alternates: [
    {
      branch_point_id: "node-abc",
      messages: [ ...divergent messages... ],
      is_current: false
    }
  ]
}
```

Your edit history is now portable.

**Bi-temporal with observed_at:**

`created_at` is platform-reported (when the conversation was created).
`observed_at` is converter-reported (when the migration ran).

These are different. If you export your ChatGPT history in March 2026, `created_at` might be June 2023. `observed_at` is today. This matters for deduplication (have I already imported this?), incremental sync, and provenance auditing.

**Per-platform scope:**

Not all platforms support all part types. Gemini doesn't export tool calls. Mistral's format is text only. We built what each platform actually provides:

| Platform | Image | Code | Tool | Citation | Thinking | Alternates |
|----------|-------|------|------|----------|----------|------------|
| ChatGPT  | ✅   | ✅   | —   | ✅       | —        | ✅         |
| Claude   | —    | —    | ✅  | —        | ✅       | —          |
| Gemini   | ✅   | —    | —   | —        | —        | —          |
| Perplexity | —  | —    | —   | ✅       | —        | —          |

**Try it:**

```bash
npx @purmemo.ai/migrate import conversations.json
```

GitHub: https://github.com/purmemo-ai/purmemo-amp
