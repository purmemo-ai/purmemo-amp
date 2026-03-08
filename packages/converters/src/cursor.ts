import type { AMPConversation, AMPMessage, AMPExport } from '@purmemo.ai/schema'
import { AMP_VERSION } from '@purmemo.ai/schema'

// ============================================================
// Cursor → AMP Converter
// Reads from Cursor's SQLite state.vscdb (cursorDiskKV table)
//
// DB schema:
//   composerData:{composerId}  — conversation container
//     .fullConversationHeadersOnly[]: { bubbleId, type (1=user, 2=assistant) }
//     .createdAt: Unix ms
//   bubbleId:{composerId}:{bubbleId} — individual message
//     .type: 1 (user) | 2 (assistant)
//     .text: string
//     .modelType?: string
//
// DB path:
//   macOS: ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
//   Windows: %APPDATA%\Cursor\User\globalStorage\state.vscdb
//   Linux: ~/.config/Cursor/User/globalStorage/state.vscdb
// ============================================================

// --- Raw types ---

interface CursorBubbleHeader {
  bubbleId: string
  type: 1 | 2  // 1 = user, 2 = assistant
  serverBubbleId?: string
}

interface CursorComposerData {
  _v?: number
  composerId: string
  fullConversationHeadersOnly: CursorBubbleHeader[]
  createdAt?: number   // Unix ms
  unifiedMode?: string // 'chat' | 'agent'
}

interface CursorBubble {
  _v?: number
  type: 1 | 2
  bubbleId: string
  text?: string
  rawText?: string
  modelType?: string
  tokenCount?: { inputTokens: number; outputTokens: number }
}

// --- Exported intermediate types for CLI use ---

export interface CursorDBRow {
  key: string
  value: string
}

// --- Helpers ---

function msToISO(ms: number | null | undefined): string | null {
  if (ms == null || isNaN(ms)) return null
  try { return new Date(ms).toISOString() } catch { return null }
}

function normalizeRole(type: 1 | 2): AMPMessage['role'] {
  return type === 1 ? 'user' : 'assistant'
}

/**
 * Convert raw DB rows (key/value pairs) into AMPExport.
 * Accepts the full cursorDiskKV table dump as an array of {key, value}.
 */
export function convertCursorDBRows(rows: CursorDBRow[]): AMPExport {
  // Index all rows by key
  const index = new Map<string, string>()
  for (const row of rows) {
    index.set(row.key, row.value)
  }

  // Find all composerData entries
  const composers: CursorComposerData[] = []
  for (const [key, val] of index) {
    if (key.startsWith('composerData:') && val) {
      try {
        const data = JSON.parse(val) as CursorComposerData
        // Only include composers that have actual conversation messages
        if (data.fullConversationHeadersOnly?.length > 0) {
          composers.push(data)
        }
      } catch { /* skip malformed */ }
    }
  }

  const conversations: AMPConversation[] = []

  for (const composer of composers) {
    const messages: AMPMessage[] = []
    let convTitle = 'Cursor Conversation'

    for (let i = 0; i < composer.fullConversationHeadersOnly.length; i++) {
      const header = composer.fullConversationHeadersOnly[i]
      const bubbleKey = `bubbleId:${composer.composerId}:${header.bubbleId}`
      const bubbleVal = index.get(bubbleKey)
      if (!bubbleVal) continue

      let bubble: CursorBubble
      try {
        bubble = JSON.parse(bubbleVal) as CursorBubble
      } catch { continue }

      const text = (bubble.rawText || bubble.text || '').trim()
      if (!text) continue

      // Use first user message as title
      if (bubble.type === 1 && convTitle === 'Cursor Conversation') {
        convTitle = text.slice(0, 80).replace(/\n/g, ' ')
      }

      messages.push({
        id: header.bubbleId,
        role: normalizeRole(bubble.type),
        content: text,
        platform: 'cursor',
        timestamp: null, // bubbles don't have per-message timestamps
        model: bubble.modelType ?? null,
        parent_id: i > 0 ? composer.fullConversationHeadersOnly[i - 1].bubbleId : null,
        metadata: {
          serverBubbleId: header.serverBubbleId ?? null,
        },
      })
    }

    if (messages.length === 0) continue

    conversations.push({
      id: composer.composerId,
      title: convTitle,
      platform: 'cursor',
      messages,
      created_at: msToISO(composer.createdAt),
      updated_at: null,
      source_format: 'cursor-vscdb-v1',
      amp_version: AMP_VERSION,
    })
  }

  return {
    amp_version: AMP_VERSION,
    exported_at: new Date().toISOString(),
    platform: 'cursor',
    conversation_count: conversations.length,
    conversations,
  }
}

/**
 * Convert a legacy JSON export format (for backward compat with synthetic test files).
 * Accepts { version, conversations: [...] } or flat array.
 */
interface LegacyCursorMessage {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
  createdAt?: number
  model?: string
}

interface LegacyCursorConversation {
  id?: string
  title?: string
  createdAt?: number
  lastUpdatedAt?: number
  updatedAt?: number
  messages: LegacyCursorMessage[]
}

interface LegacyCursorExport {
  version?: number
  conversations: LegacyCursorConversation[]
}

function convertLegacyCursorConversation(raw: LegacyCursorConversation): AMPConversation {
  const messages: AMPMessage[] = []
  for (let i = 0; i < raw.messages.length; i++) {
    const msg = raw.messages[i]
    const content = typeof msg.content === 'string' ? msg.content.trim() : ''
    if (!content) continue
    const ts = msg.timestamp ?? msg.createdAt ?? null
    messages.push({
      id: msg.id ?? `cursor-msg-${i}`,
      role: msg.role === 'user' ? 'user' : msg.role === 'system' ? 'system' : 'assistant',
      content,
      platform: 'cursor',
      timestamp: msToISO(ts),
      model: msg.model ?? null,
      parent_id: i > 0 ? (raw.messages[i - 1].id ?? `cursor-msg-${i - 1}`) : null,
      metadata: {},
    })
  }
  return {
    id: raw.id ?? `cursor-conv-${Date.now()}`,
    title: raw.title || 'Untitled Conversation',
    platform: 'cursor',
    messages,
    created_at: msToISO(raw.createdAt ?? null),
    updated_at: msToISO(raw.lastUpdatedAt ?? raw.updatedAt ?? null),
    source_format: 'cursor-export-v1',
    amp_version: AMP_VERSION,
  }
}

export function convertCursorExport(raw: unknown): AMPExport {
  let convList: LegacyCursorConversation[]
  if (Array.isArray(raw)) {
    convList = raw as LegacyCursorConversation[]
  } else if (
    typeof raw === 'object' && raw !== null &&
    Array.isArray((raw as LegacyCursorExport).conversations)
  ) {
    convList = (raw as LegacyCursorExport).conversations
  } else {
    throw new Error(
      'Invalid Cursor export format. Use "purmemo-migrate cursor-extract" to export directly from the Cursor database.'
    )
  }
  const conversations = convList.map(convertLegacyCursorConversation)
  return {
    amp_version: AMP_VERSION,
    exported_at: new Date().toISOString(),
    platform: 'cursor',
    conversation_count: conversations.length,
    conversations,
  }
}

// Re-export for single conversation use
export { convertLegacyCursorConversation as convertCursorConversation }
