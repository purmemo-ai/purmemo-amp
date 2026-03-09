import { z } from 'zod'

// ============================================================
// AMP — AI Memory Protocol v0.2
// The open protocol for AI conversation portability.
// https://github.com/purmemo-ai/purmemo-amp
// Apache-2.0
// ============================================================

/**
 * Supported platform identifiers.
 * Extensible — converters may add new platforms.
 */
export const AMPPlatform = z.enum([
  'chatgpt',
  'claude',
  'gemini',
  'cursor',
  'perplexity',
  'grok',
  'mistral',
  'github-copilot',
  'other',
])
export type AMPPlatform = z.infer<typeof AMPPlatform>

/**
 * Message author roles, normalized across platforms.
 */
export const AMPRole = z.enum(['user', 'assistant', 'system', 'tool'])
export type AMPRole = z.infer<typeof AMPRole>

/**
 * AMP Source — a cited reference attached to a message.
 * Used by platforms that surface web citations (Perplexity, Grok, etc.)
 *
 * Level 2 field — optional, preserved from platform export.
 * For Level 3, prefer AMPCitationPart inside content_parts[].
 */
export const AMPSource = z.object({
  url: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
})
export type AMPSource = z.infer<typeof AMPSource>

// ============================================================
// LEVEL 3 — Content Parts (v0.2)
// Discriminated union of rich content types.
// ============================================================

/**
 * AMPTextPart — plain text segment.
 */
export const AMPTextPart = z.object({
  type: z.literal('text'),
  text: z.string(),
})
export type AMPTextPart = z.infer<typeof AMPTextPart>

/**
 * AMPImagePart — image content (URL or base64 data).
 * Either url or data should be populated.
 */
export const AMPImagePart = z.object({
  type: z.literal('image'),
  url: z.string().nullable().optional(),
  data: z.string().nullable().optional(),       // base64-encoded
  mime_type: z.string().nullable().optional(),  // e.g. "image/png"
  alt: z.string().nullable().optional(),
})
export type AMPImagePart = z.infer<typeof AMPImagePart>

/**
 * AMPCodePart — code block with optional language tag.
 * Used for ChatGPT Code Interpreter, execution output, Copilot snippets.
 */
export const AMPCodePart = z.object({
  type: z.literal('code'),
  language: z.string().nullable().optional(),
  code: z.string(),
})
export type AMPCodePart = z.infer<typeof AMPCodePart>

/**
 * AMPToolUsePart — model invoking a tool (Claude tool_use).
 */
export const AMPToolUsePart = z.object({
  type: z.literal('tool_use'),
  tool_use_id: z.string().nullable().optional(),
  tool_name: z.string(),
  tool_input: z.record(z.unknown()).optional(),
})
export type AMPToolUsePart = z.infer<typeof AMPToolUsePart>

/**
 * AMPToolResultPart — tool response to the model (Claude tool_result).
 */
export const AMPToolResultPart = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string().nullable().optional(),
  content: z.string(),
})
export type AMPToolResultPart = z.infer<typeof AMPToolResultPart>

/**
 * AMPCitationPart — inline citation reference.
 * Level 3 representation; preferred over top-level sources[] for platforms
 * where citations are interleaved with content.
 */
export const AMPCitationPart = z.object({
  type: z.literal('citation'),
  url: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
})
export type AMPCitationPart = z.infer<typeof AMPCitationPart>

/**
 * AMPThinkingPart — extended thinking / chain-of-thought (Claude).
 */
export const AMPThinkingPart = z.object({
  type: z.literal('thinking'),
  thinking: z.string(),
})
export type AMPThinkingPart = z.infer<typeof AMPThinkingPart>

/**
 * AMPContentPart — discriminated union of all rich content types.
 * Optional field on AMPMessage (Level 3).
 */
export const AMPContentPart = z.discriminatedUnion('type', [
  AMPTextPart,
  AMPImagePart,
  AMPCodePart,
  AMPToolUsePart,
  AMPToolResultPart,
  AMPCitationPart,
  AMPThinkingPart,
])
export type AMPContentPart = z.infer<typeof AMPContentPart>

// ============================================================
// LEVEL 1 — Core (all conformant implementations must support)
// id, role, content, platform
// ============================================================

/**
 * AMP Message — Level 1 + Level 2 + Level 3 (v0.2)
 *
 * Level 1 fields: id, role, content, platform
 * Level 2 fields: timestamp, model, parent_id, sources, metadata
 * Level 3 fields: content_parts (v0.2)
 *
 * NOTE: content is REQUIRED even in v0.2. When content_parts is present,
 * content must contain a plain-text representation for backward compatibility.
 */
export const AMPMessage = z.object({
  // Level 1
  id: z.string(),
  role: AMPRole,
  content: z.string(),    // normalized plain text; always required
  platform: AMPPlatform,

  // Level 2
  timestamp: z.string().datetime({ offset: true }).nullable().optional(),
  model: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  sources: z.array(AMPSource).nullable().optional(),  // citations from search-augmented platforms
  metadata: z.record(z.unknown()).optional(),

  // Level 3 (v0.2)
  content_parts: z.array(AMPContentPart).optional(),
})
export type AMPMessage = z.infer<typeof AMPMessage>

/**
 * AMPAlternate — a non-canonical conversation branch.
 * Used to preserve ChatGPT edit history and DAG branch paths.
 *
 * The canonical path is always in AMPConversation.messages.
 * Alternates contain divergent paths.
 */
export const AMPAlternate = z.object({
  branch_point_id: z.string(),
  messages: z.array(AMPMessage),
  is_current: z.boolean(),
})
export type AMPAlternate = z.infer<typeof AMPAlternate>

/**
 * AMP spec version union — accepts v0.1 and v0.2 exports.
 */
export const AMPVersionLiteral = z.union([z.literal('0.1'), z.literal('0.2')])
export type AMPVersionLiteral = z.infer<typeof AMPVersionLiteral>

/**
 * AMP Conversation — the top-level unit of portability.
 *
 * A conversation is a linear sequence of messages representing
 * the canonical path of an AI interaction.
 */
export const AMPConversation = z.object({
  // Level 1
  id: z.string(),
  title: z.string(),
  platform: AMPPlatform,
  messages: z.array(AMPMessage),

  // Level 2
  created_at: z.string().datetime({ offset: true }).nullable().optional(),
  updated_at: z.string().datetime({ offset: true }).nullable().optional(),

  // Provenance (required for all conformance levels)
  source_format: z.string(),    // e.g. "chatgpt-export-v1", "claude-api-v1"
  amp_version: AMPVersionLiteral,

  // Level 3 (v0.2)
  observed_at: z.string().datetime({ offset: true }).nullable().optional(),
  alternates: z.array(AMPAlternate).optional(),
})
export type AMPConversation = z.infer<typeof AMPConversation>

/**
 * AMP Export — a collection of conversations from a single platform export.
 */
export const AMPExport = z.object({
  amp_version: AMPVersionLiteral,
  exported_at: z.string().datetime({ offset: true }),
  platform: AMPPlatform,
  conversation_count: z.number().int().nonnegative(),
  conversations: z.array(AMPConversation),
})
export type AMPExport = z.infer<typeof AMPExport>

// ============================================================
// Helpers
// ============================================================

/**
 * Safely parse a value as an AMPExport.
 * Returns { success, data } or { success, error }.
 */
export function parseAMPExport(input: unknown) {
  return AMPExport.safeParse(input)
}

/**
 * Safely parse a single AMPConversation.
 */
export function parseAMPConversation(input: unknown) {
  return AMPConversation.safeParse(input)
}

/**
 * Current AMP spec version.
 */
export const AMP_VERSION = '0.2' as const
