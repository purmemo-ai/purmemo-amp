import type { AMPConversation, AMPMessage, AMPExport, AMPContentPart } from '@purmemo.ai/schema'
import { AMP_VERSION } from '@purmemo.ai/schema'

// ============================================================
// Claude → AMP Converter
// Parses conversations.json from Anthropic data export
// Format: flat array (no DAG), sender: "human"|"assistant"
// ============================================================

// --- Claude raw types ---

interface ClaudeContentPart {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'voice_note' | 'token_budget' | string
  text?: string
  // tool_use fields
  id?: string
  name?: string
  input?: unknown
  message?: string
  // tool_result fields
  tool_use_id?: string
  content?: ClaudeContentPart[] | string
  [key: string]: unknown
}

interface ClaudeAttachment {
  file_name: string
  file_size: number
  file_type: string
  extracted_content?: string
}

interface ClaudeChatMessage {
  uuid: string
  text: string
  content: ClaudeContentPart[]
  sender: 'human' | 'assistant'
  created_at: string
  updated_at: string
  attachments: ClaudeAttachment[]
  files: unknown[]
}

interface ClaudeConversation {
  uuid: string
  name: string
  summary?: string
  created_at: string
  updated_at: string
  account: { uuid: string }
  chat_messages: ClaudeChatMessage[]
}

// --- Helpers ---

/**
 * Extract readable plain text from Claude content parts array.
 * Used for the required top-level content field (backward compat).
 */
function extractContent(parts: ClaudeContentPart[], fallbackText: string): string {
  if (!parts || parts.length === 0) return fallbackText.trim()

  const chunks: string[] = []

  for (const part of parts) {
    switch (part.type) {
      case 'text':
        if (typeof part.text === 'string' && part.text.trim()) {
          chunks.push(part.text.trim())
        }
        break
      case 'thinking':
        // Skip internal chain-of-thought from plain text
        break
      case 'tool_use':
        // Skip tool invocations from plain text
        break
      case 'tool_result':
        // Skip tool results from plain text
        break
      case 'token_budget':
        // Internal metadata — skip
        break
      case 'voice_note':
        if (typeof part.text === 'string' && part.text.trim()) {
          chunks.push(part.text.trim())
        }
        break
      default:
        if (typeof part.text === 'string' && part.text.trim()) {
          chunks.push(part.text.trim())
        }
    }
  }

  // If all parts were tool_use/tool_result, fall back to top-level .text
  if (chunks.length === 0) return fallbackText.trim()

  return chunks.join('\n\n')
}

/**
 * Build AMPContentPart[] from Claude content parts (Level 3).
 * Returns undefined when no meaningful rich parts exist.
 */
function extractContentParts(parts: ClaudeContentPart[]): AMPContentPart[] | undefined {
  if (!parts || parts.length === 0) return undefined

  const result: AMPContentPart[] = []

  for (const part of parts) {
    switch (part.type) {
      case 'text':
        if (typeof part.text === 'string' && part.text.trim()) {
          result.push({ type: 'text', text: part.text.trim() })
        }
        break
      case 'thinking':
        if (typeof part.text === 'string' && part.text.trim()) {
          result.push({ type: 'thinking', thinking: part.text.trim() })
        }
        break
      case 'tool_use': {
        const toolInput = typeof part.input === 'object' && part.input !== null
          ? (part.input as Record<string, unknown>)
          : undefined
        result.push({
          type: 'tool_use',
          tool_use_id: typeof part.id === 'string' ? part.id : null,
          tool_name: typeof part.name === 'string' ? part.name : 'unknown',
          tool_input: toolInput,
        })
        break
      }
      case 'tool_result': {
        const content = typeof part.content === 'string'
          ? part.content
          : typeof part.message === 'string'
          ? part.message
          : ''
        if (content) {
          result.push({
            type: 'tool_result',
            tool_use_id: typeof part.tool_use_id === 'string' ? part.tool_use_id : null,
            content,
          })
        }
        break
      }
      case 'voice_note':
        if (typeof part.text === 'string' && part.text.trim()) {
          result.push({ type: 'text', text: part.text.trim() })
        }
        break
      // token_budget and unknown types: skip
    }
  }

  // Only return if there's actual rich content beyond simple text
  const hasRichContent = result.some(
    (p) => p.type === 'tool_use' || p.type === 'tool_result' || p.type === 'thinking'
  )
  return hasRichContent ? result : undefined
}

/**
 * Map Claude sender to AMP role.
 */
function normalizeRole(sender: string): AMPMessage['role'] {
  switch (sender) {
    case 'human': return 'user'
    case 'assistant': return 'assistant'
    default: return 'assistant'
  }
}

/**
 * Convert a single Claude conversation to AMPConversation.
 */
export function convertClaudeConversation(raw: ClaudeConversation): AMPConversation {
  const messages: AMPMessage[] = []

  for (const msg of raw.chat_messages) {
    const content = extractContent(msg.content, msg.text)

    // Skip completely empty messages
    if (!content) continue

    // Append extracted attachment text if present
    const attachmentText = msg.attachments
      .filter((a) => a.extracted_content)
      .map((a) => `[Attachment: ${a.file_name}]\n${a.extracted_content}`)
      .join('\n\n')

    const finalContent = attachmentText
      ? `${content}\n\n${attachmentText}`
      : content

    const ampMsg: AMPMessage = {
      id: msg.uuid,
      role: normalizeRole(msg.sender),
      content: finalContent,
      platform: 'claude',
      timestamp: msg.created_at ?? null,
      model: null, // Claude export doesn't include model per-message
      parent_id: null, // Flat format — no parent tracking
      metadata: {
        has_attachments: msg.attachments.length > 0,
        has_files: msg.files.length > 0,
      },
    }

    const content_parts = extractContentParts(msg.content)
    if (content_parts) ampMsg.content_parts = content_parts

    messages.push(ampMsg)
  }

  return {
    id: raw.uuid,
    title: raw.name || 'Untitled Conversation',
    platform: 'claude',
    messages,
    created_at: raw.created_at ?? null,
    updated_at: raw.updated_at ?? null,
    source_format: 'claude-export-v1',
    amp_version: AMP_VERSION,
    observed_at: new Date().toISOString(),
  }
}

/**
 * Convert a full Claude conversations.json export to AMPExport.
 */
export function convertClaudeExport(raw: unknown): AMPExport {
  if (!Array.isArray(raw)) {
    throw new Error(
      'Invalid Claude export: expected an array of conversations. ' +
      'Make sure you are passing the contents of conversations.json.'
    )
  }

  const conversations = (raw as ClaudeConversation[]).map(convertClaudeConversation)

  return {
    amp_version: AMP_VERSION,
    exported_at: new Date().toISOString(),
    platform: 'claude',
    conversation_count: conversations.length,
    conversations,
  }
}
