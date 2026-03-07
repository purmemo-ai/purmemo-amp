import type { AMPConversation, AMPMessage, AMPExport } from '@purmemo/schema'
import { AMP_VERSION } from '@purmemo/schema'

// ============================================================
// ChatGPT → AMP Converter
// Parses conversations.json (DAG format) from OpenAI data export
// ============================================================

// --- ChatGPT raw types ---

interface ChatGPTContentPart {
  content_type: string
  parts?: (string | object)[]
  text?: string
  [key: string]: unknown
}

interface ChatGPTMessage {
  id: string
  author: { role: string; name?: string }
  content: ChatGPTContentPart
  create_time: number | null
  status: string
  weight: number
  metadata: Record<string, unknown>
  recipient?: string
  end_turn?: boolean
}

interface ChatGPTNode {
  id: string
  parent: string | null
  children: string[]
  message: ChatGPTMessage | null
}

interface ChatGPTConversation {
  id: string
  title: string
  create_time: number
  update_time: number
  mapping: Record<string, ChatGPTNode>
  current_node: string
  conversation_template_id?: string | null
}

// --- Parser ---

/**
 * Extract plain text content from a ChatGPT content object.
 * Handles text, multimodal parts, and code blocks.
 */
function extractContent(content: ChatGPTContentPart): string {
  if (!content) return ''

  // Simple text content
  if (content.content_type === 'text' && Array.isArray(content.parts)) {
    return content.parts
      .map((p) => (typeof p === 'string' ? p : ''))
      .join('')
      .trim()
  }

  // Code output
  if (content.content_type === 'code' && typeof content.text === 'string') {
    return content.text.trim()
  }

  // Tether quote (web browsing citations)
  if (content.content_type === 'tether_quote') {
    return typeof content.text === 'string' ? content.text.trim() : ''
  }

  // Fallback: join any string parts
  if (Array.isArray(content.parts)) {
    return content.parts
      .map((p) => (typeof p === 'string' ? p : ''))
      .filter(Boolean)
      .join('')
      .trim()
  }

  return ''
}

/**
 * Convert a Unix float timestamp to ISO 8601 string.
 * Returns null if timestamp is missing or invalid.
 */
function toISO(ts: number | null | undefined): string | null {
  if (ts == null || isNaN(ts)) return null
  try {
    return new Date(ts * 1000).toISOString()
  } catch {
    return null
  }
}

/**
 * Walk the ChatGPT DAG from current_node backwards to root,
 * then reverse to get root→leaf canonical path.
 */
function extractCanonicalPath(
  mapping: Record<string, ChatGPTNode>,
  currentNodeId: string
): ChatGPTNode[] {
  const path: ChatGPTNode[] = []
  let nodeId: string | null = currentNodeId

  while (nodeId !== null) {
    const node: ChatGPTNode | undefined = mapping[nodeId]
    if (!node) break
    path.push(node)
    nodeId = node.parent ?? null
  }

  return path.reverse()
}

/**
 * Normalize a ChatGPT role string to an AMP role.
 */
function normalizeRole(role: string): AMPMessage['role'] {
  switch (role) {
    case 'user': return 'user'
    case 'assistant': return 'assistant'
    case 'system': return 'system'
    case 'tool':
    case 'function': return 'tool'
    default: return 'assistant'
  }
}

/**
 * Convert a single ChatGPT conversation object to AMPConversation.
 */
export function convertChatGPTConversation(
  raw: ChatGPTConversation
): AMPConversation {
  const canonicalPath = extractCanonicalPath(raw.mapping, raw.current_node)

  const messages: AMPMessage[] = []

  for (const node of canonicalPath) {
    const msg = node.message
    if (!msg) continue

    // Skip system messages with empty content
    const content = extractContent(msg.content)
    if (!content && msg.author.role !== 'system') continue

    // Skip tool/function internal routing messages
    if (msg.recipient && msg.recipient !== 'all') continue

    messages.push({
      id: msg.id,
      role: normalizeRole(msg.author.role),
      content,
      platform: 'chatgpt',
      timestamp: toISO(msg.create_time),
      model: typeof msg.metadata?.model_slug === 'string'
        ? msg.metadata.model_slug
        : null,
      parent_id: node.parent ?? null,
      metadata: {
        weight: msg.weight,
        status: msg.status,
        end_turn: msg.end_turn,
      },
    })
  }

  return {
    id: raw.id,
    title: raw.title || 'Untitled Conversation',
    platform: 'chatgpt',
    messages,
    created_at: toISO(raw.create_time),
    updated_at: toISO(raw.update_time),
    source_format: 'chatgpt-export-v1',
    amp_version: AMP_VERSION,
  }
}

/**
 * Convert a full ChatGPT conversations.json export (array of conversations)
 * to an AMPExport object.
 */
export function convertChatGPTExport(raw: unknown): AMPExport {
  if (!Array.isArray(raw)) {
    throw new Error(
      'Invalid ChatGPT export: expected an array of conversations. ' +
      'Make sure you are passing the contents of conversations.json.'
    )
  }

  const conversations = (raw as ChatGPTConversation[]).map(
    convertChatGPTConversation
  )

  return {
    amp_version: AMP_VERSION,
    exported_at: new Date().toISOString(),
    platform: 'chatgpt',
    conversation_count: conversations.length,
    conversations,
  }
}
