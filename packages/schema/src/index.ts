import { z } from 'zod'

// ============================================================
// AMP — AI Memory Protocol v0.1
// The open protocol for AI conversation portability.
// https://github.com/purmemo/purmemo-amp
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
  'other',
])
export type AMPPlatform = z.infer<typeof AMPPlatform>

/**
 * Message author roles, normalized across platforms.
 */
export const AMPRole = z.enum(['user', 'assistant', 'system', 'tool'])
export type AMPRole = z.infer<typeof AMPRole>

// ============================================================
// LEVEL 1 — Core (all conformant implementations must support)
// id, role, content, platform
// ============================================================

/**
 * AMP Message — Level 1 + Level 2 (v0.1)
 *
 * Level 1 fields: id, role, content, platform
 * Level 2 fields: timestamp, model, parent_id, metadata
 * Level 3 (v0.2): content_parts, alternates
 */
export const AMPMessage = z.object({
  // Level 1
  id: z.string(),
  role: AMPRole,
  content: z.string(),    // normalized plain text; rich content in v0.2 content_parts
  platform: AMPPlatform,

  // Level 2
  timestamp: z.string().datetime({ offset: true }).nullable().optional(),
  model: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
})
export type AMPMessage = z.infer<typeof AMPMessage>

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
  amp_version: z.literal('0.1'),
})
export type AMPConversation = z.infer<typeof AMPConversation>

/**
 * AMP Export — a collection of conversations from a single platform export.
 */
export const AMPExport = z.object({
  amp_version: z.literal('0.1'),
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
export const AMP_VERSION = '0.1' as const
