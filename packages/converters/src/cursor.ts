import type { AMPConversation, AMPMessage, AMPExport } from '@purmemo.ai/schema'
import { AMP_VERSION } from '@purmemo.ai/schema'

// ============================================================
// Cursor → AMP Converter
// Parses Cursor AI chat history export format
// Format: { version, conversations: [...] } or flat array
// ============================================================

// --- Cursor raw types ---

interface CursorMessage {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number       // Unix ms
  createdAt?: number       // Unix ms (alternate key)
  model?: string
}

interface CursorConversation {
  id?: string
  title?: string
  createdAt?: number       // Unix ms
  lastUpdatedAt?: number   // Unix ms
  updatedAt?: number       // Unix ms (alternate key)
  messages: CursorMessage[]
}

interface CursorExportFormat {
  version?: number
  conversations: CursorConversation[]
}

// --- Helpers ---

/**
 * Convert Unix milliseconds timestamp to ISO 8601.
 * Returns null if missing or invalid.
 */
function msToISO(ms: number | null | undefined): string | null {
  if (ms == null || isNaN(ms)) return null
  try {
    return new Date(ms).toISOString()
  } catch {
    return null
  }
}

/**
 * Normalize Cursor role to AMP role.
 */
function normalizeRole(role: string): AMPMessage['role'] {
  switch (role) {
    case 'user': return 'user'
    case 'assistant': return 'assistant'
    case 'system': return 'system'
    default: return 'assistant'
  }
}

/**
 * Convert a single Cursor conversation to AMPConversation.
 */
export function convertCursorConversation(raw: CursorConversation): AMPConversation {
  const messages: AMPMessage[] = []

  for (let i = 0; i < raw.messages.length; i++) {
    const msg = raw.messages[i]
    const content = typeof msg.content === 'string' ? msg.content.trim() : ''
    if (!content) continue

    const ts = msg.timestamp ?? msg.createdAt ?? null

    messages.push({
      id: msg.id ?? `cursor-msg-${i}`,
      role: normalizeRole(msg.role),
      content,
      platform: 'cursor',
      timestamp: msToISO(ts),
      model: msg.model ?? null,
      parent_id: i > 0 ? (raw.messages[i - 1].id ?? `cursor-msg-${i - 1}`) : null,
      metadata: {},
    })
  }

  const createdAt = raw.createdAt ?? null
  const updatedAt = raw.lastUpdatedAt ?? raw.updatedAt ?? null

  return {
    id: raw.id ?? `cursor-conv-${Date.now()}`,
    title: raw.title || 'Untitled Conversation',
    platform: 'cursor',
    messages,
    created_at: msToISO(createdAt),
    updated_at: msToISO(updatedAt),
    source_format: 'cursor-export-v1',
    amp_version: AMP_VERSION,
  }
}

/**
 * Convert a Cursor chat history export to AMPExport.
 * Accepts both { version, conversations: [...] } and flat array formats.
 */
export function convertCursorExport(raw: unknown): AMPExport {
  let convList: CursorConversation[]

  if (Array.isArray(raw)) {
    convList = raw as CursorConversation[]
  } else if (
    typeof raw === 'object' &&
    raw !== null &&
    Array.isArray((raw as CursorExportFormat).conversations)
  ) {
    convList = (raw as CursorExportFormat).conversations
  } else {
    throw new Error(
      'Invalid Cursor export: expected { conversations: [...] } or a flat array. ' +
      'Export your chat history from Cursor settings.'
    )
  }

  const conversations = convList.map(convertCursorConversation)

  return {
    amp_version: AMP_VERSION,
    exported_at: new Date().toISOString(),
    platform: 'cursor',
    conversation_count: conversations.length,
    conversations,
  }
}
