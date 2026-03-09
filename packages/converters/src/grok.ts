import type { AMPConversation, AMPMessage, AMPExport, AMPContentPart } from '@purmemo.ai/schema'
import { AMP_VERSION } from '@purmemo.ai/schema'
import { normalizeRole, normalizeTimestamp } from './utils.js'

// ============================================================
// Grok (xAI) → AMP Converter
// Parses the official data export from accounts.x.ai/data
//
// Export path: accounts.x.ai → "Download account data" → ZIP
// Primary file: prod-grok-backend.json (all conversations)
//
// Format:
//   { conversations: [ { id, title, create_time (ISO),
//                        responses: [
//                          { sender: "human"|"grok",
//                            message: string,
//                            create_time: { $date: { $numberLong: "ms" } }
//                          } ] } ] }
//
// Timestamp quirk: conversation-level create_time is ISO 8601,
// but message-level create_time uses BSON $date.$numberLong notation
// (MongoDB epoch milliseconds wrapped in nested objects).
// normalizeTimestamp() handles both formats.
// ============================================================

// --- Grok raw types ---

interface GrokBSONDate {
  $date: {
    $numberLong: string   // epoch ms as string
  }
}

interface GrokResponse {
  sender: string          // "human" | "grok"
  message: string
  create_time?: GrokBSONDate | string | null
  [key: string]: unknown
}

interface GrokConversation {
  id?: string
  title?: string
  create_time?: string    // ISO 8601 at conversation level
  responses: GrokResponse[]
}

interface GrokExport {
  conversations: GrokConversation[]
}

// --- Helpers ---

function makeId(convIndex: number, msgIndex: number): string {
  return `grok-${convIndex}-${msgIndex}`
}

/**
 * Convert a single Grok conversation to AMPConversation.
 */
export function convertGrokConversation(
  raw: GrokConversation,
  convIndex: number
): AMPConversation {
  const messages: AMPMessage[] = []

  for (let i = 0; i < raw.responses.length; i++) {
    const resp = raw.responses[i]
    const content = (resp.message ?? '').trim()
    if (!content) continue

    messages.push({
      id: makeId(convIndex, i),
      role: normalizeRole(resp.sender),
      content,
      platform: 'grok',
      // Message timestamps are BSON — normalizeTimestamp handles unwrapping
      timestamp: normalizeTimestamp(resp.create_time as Parameters<typeof normalizeTimestamp>[0]),
      model: null,  // Grok export doesn't include model per-message
      parent_id: i > 0 ? makeId(convIndex, i - 1) : null,
      metadata: {},
      content_parts: [{ type: 'text', text: content }] as AMPContentPart[],
    })
  }

  return {
    id: raw.id ?? `grok-conv-${convIndex}`,
    title: raw.title || 'Untitled Conversation',
    platform: 'grok',
    messages,
    created_at: normalizeTimestamp(raw.create_time),
    updated_at: null,
    source_format: 'grok-export-v1',
    amp_version: AMP_VERSION,
    observed_at: new Date().toISOString(),
  }
}

/**
 * Convert a full Grok data export to AMPExport.
 *
 * Accepts:
 *   { conversations: [...] }  — standard export wrapper (prod-grok-backend.json)
 *   [...]                     — bare array of conversations
 */
export function convertGrokExport(raw: unknown): AMPExport {
  let convList: GrokConversation[]

  if (Array.isArray(raw)) {
    convList = raw as GrokConversation[]
  } else if (
    typeof raw === 'object' && raw !== null &&
    Array.isArray((raw as GrokExport).conversations)
  ) {
    convList = (raw as GrokExport).conversations
  } else {
    throw new Error(
      'Invalid Grok export: expected { conversations: [...] } or a bare array. ' +
      'Make sure you are passing the contents of prod-grok-backend.json from the Grok data export ZIP.'
    )
  }

  const conversations = convList.map((conv, i) =>
    convertGrokConversation(conv, i)
  )

  return {
    amp_version: AMP_VERSION,
    exported_at: new Date().toISOString(),
    platform: 'grok',
    conversation_count: conversations.length,
    conversations,
  }
}
