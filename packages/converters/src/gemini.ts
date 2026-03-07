import type { AMPConversation, AMPMessage, AMPExport } from '@purmemo.ai/schema'
import { AMP_VERSION } from '@purmemo.ai/schema'

// ============================================================
// Gemini → AMP Converter
// Parses Google Takeout Gemini export format
// Format: array of conversations, each with messages[].parts[]
// ============================================================

// --- Gemini raw types ---

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
  [key: string]: unknown
}

interface GeminiMessage {
  role: 'user' | 'model'
  createTime?: string
  parts: GeminiPart[]
}

interface GeminiConversation {
  title?: string
  createTime?: string
  updateTime?: string
  messages: GeminiMessage[]
  // Some exports use 'conversation' key
  conversation?: GeminiMessage[]
}

// --- Helpers ---

/**
 * Extract text from Gemini parts array.
 * Skips inline data (images/audio).
 */
function extractContent(parts: GeminiPart[]): string {
  if (!parts || parts.length === 0) return ''
  return parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .filter(Boolean)
    .join('')
    .trim()
}

/**
 * Map Gemini role to AMP role.
 * Gemini uses "model" for assistant responses.
 */
function normalizeRole(role: string): AMPMessage['role'] {
  switch (role) {
    case 'user': return 'user'
    case 'model': return 'assistant'
    default: return 'assistant'
  }
}

/**
 * Generate a stable ID for a Gemini message (no native ID in export).
 */
function makeId(convIndex: number, msgIndex: number): string {
  return `gemini-${convIndex}-${msgIndex}`
}

/**
 * Convert a single Gemini conversation to AMPConversation.
 */
export function convertGeminiConversation(
  raw: GeminiConversation,
  convIndex: number
): AMPConversation {
  const msgs = raw.messages ?? raw.conversation ?? []
  const messages: AMPMessage[] = []

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i]
    const content = extractContent(msg.parts)
    if (!content) continue

    messages.push({
      id: makeId(convIndex, i),
      role: normalizeRole(msg.role),
      content,
      platform: 'gemini',
      timestamp: msg.createTime ?? null,
      model: null, // Gemini export doesn't include model per-message
      parent_id: i > 0 ? makeId(convIndex, i - 1) : null,
      metadata: {},
    })
  }

  return {
    id: `gemini-conv-${convIndex}`,
    title: raw.title || 'Untitled Conversation',
    platform: 'gemini',
    messages,
    created_at: raw.createTime ?? null,
    updated_at: raw.updateTime ?? null,
    source_format: 'gemini-takeout-v1',
    amp_version: AMP_VERSION,
  }
}

/**
 * Convert a full Gemini Takeout conversations export to AMPExport.
 */
export function convertGeminiExport(raw: unknown): AMPExport {
  if (!Array.isArray(raw)) {
    throw new Error(
      'Invalid Gemini export: expected an array of conversations. ' +
      'Make sure you are passing the Gemini conversations JSON from Google Takeout.'
    )
  }

  const conversations = (raw as GeminiConversation[]).map(
    (conv, i) => convertGeminiConversation(conv, i)
  )

  return {
    amp_version: AMP_VERSION,
    exported_at: new Date().toISOString(),
    platform: 'gemini',
    conversation_count: conversations.length,
    conversations,
  }
}
