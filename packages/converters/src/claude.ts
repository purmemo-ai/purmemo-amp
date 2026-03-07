import type { AMPConversation, AMPMessage, AMPExport } from '@purmemo.ai/schema'
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
 * Extract readable text from Claude content parts array.
 * Skips tool_use/tool_result internals — keeps text and thinking.
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
        // Skip internal chain-of-thought
        break
      case 'tool_use':
        // Skip tool invocations — they're internal plumbing
        break
      case 'tool_result':
        // Skip tool results
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

    messages.push({
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
    })
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
