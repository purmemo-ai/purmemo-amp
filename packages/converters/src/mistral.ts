import type { AMPConversation, AMPMessage, AMPExport } from '@purmemo.ai/schema'
import { AMP_VERSION } from '@purmemo.ai/schema'
import { normalizeRole, normalizeTimestamp } from './utils.js'

// ============================================================
// Mistral Le Chat → AMP Converter
// Parses the in-app data export from Le Chat.
//
// Export path: Settings → Export (or admin.mistral.ai/account/export)
//
// Format: OpenAI-compatible chat schema
//   { conversations: [ { id, created_at, updated_at?,
//                        messages: [
//                          { role: "user"|"assistant"|"system"|"tool",
//                            content: string,
//                            created_at?: string } ] } ] }
//
// Mistral's API uses standard OpenAI-compatible role names.
// Note: data auto-deletes after 30 days by default in Le Chat —
// users should export before this window closes.
// ============================================================

// --- Mistral raw types ---

interface MistralMessage {
  id?: string
  role: string            // "user" | "assistant" | "system" | "tool"
  content: string
  created_at?: string | null
  model?: string | null
  [key: string]: unknown
}

interface MistralConversation {
  id?: string
  title?: string
  created_at?: string | null
  updated_at?: string | null
  messages: MistralMessage[]
}

interface MistralExport {
  conversations: MistralConversation[]
}

// --- Helpers ---

function makeId(convIndex: number, msgIndex: number): string {
  return `mistral-${convIndex}-${msgIndex}`
}

/**
 * Convert a single Mistral conversation to AMPConversation.
 */
export function convertMistralConversation(
  raw: MistralConversation,
  convIndex: number
): AMPConversation {
  const messages: AMPMessage[] = []

  for (let i = 0; i < raw.messages.length; i++) {
    const msg = raw.messages[i]
    const content = (msg.content ?? '').trim()
    if (!content) continue

    messages.push({
      id: msg.id ?? makeId(convIndex, i),
      role: normalizeRole(msg.role),
      content,
      platform: 'mistral',
      timestamp: normalizeTimestamp(msg.created_at),
      model: typeof msg.model === 'string' ? msg.model : null,
      parent_id: i > 0 ? (raw.messages[i - 1].id ?? makeId(convIndex, i - 1)) : null,
      metadata: {},
    })
  }

  return {
    id: raw.id ?? `mistral-conv-${convIndex}`,
    title: raw.title || 'Untitled Conversation',
    platform: 'mistral',
    messages,
    created_at: normalizeTimestamp(raw.created_at),
    updated_at: normalizeTimestamp(raw.updated_at),
    source_format: 'mistral-export-v1',
    amp_version: AMP_VERSION,
  }
}

/**
 * Convert a full Mistral Le Chat export to AMPExport.
 *
 * Accepts:
 *   { conversations: [...] }  — standard export wrapper
 *   [...]                     — bare array of conversations
 */
export function convertMistralExport(raw: unknown): AMPExport {
  let convList: MistralConversation[]

  if (Array.isArray(raw)) {
    convList = raw as MistralConversation[]
  } else if (
    typeof raw === 'object' && raw !== null &&
    Array.isArray((raw as MistralExport).conversations)
  ) {
    convList = (raw as MistralExport).conversations
  } else {
    throw new Error(
      'Invalid Mistral export: expected { conversations: [...] } or a bare array. ' +
      'Make sure you are passing the JSON from the Mistral Le Chat data export.'
    )
  }

  const conversations = convList.map((conv, i) =>
    convertMistralConversation(conv, i)
  )

  return {
    amp_version: AMP_VERSION,
    exported_at: new Date().toISOString(),
    platform: 'mistral',
    conversation_count: conversations.length,
    conversations,
  }
}
