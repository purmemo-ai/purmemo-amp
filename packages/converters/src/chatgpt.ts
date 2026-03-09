import type {
  AMPConversation,
  AMPMessage,
  AMPExport,
  AMPContentPart,
  AMPAlternate,
} from '@purmemo.ai/schema'
import { AMP_VERSION } from '@purmemo.ai/schema'

// ============================================================
// ChatGPT → AMP Converter
// Parses conversations.json (DAG format) from OpenAI data export
// ============================================================

// --- ChatGPT raw types ---

interface ChatGPTContentPart {
  content_type: string
  parts?: (string | object)[]
  text?: string
  result?: string      // tether_browsing_display
  url?: string         // image asset reference
  asset_pointer?: string
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
 * Used for the required top-level content field (backward compat).
 */
function extractContent(content: ChatGPTContentPart): string {
  if (!content) return ''

  // Standard text
  if (content.content_type === 'text' && Array.isArray(content.parts)) {
    return content.parts
      .map((p) => (typeof p === 'string' ? p : ''))
      .join('')
      .trim()
  }

  // GPT-4o multimodal: mixed text + image parts
  if (content.content_type === 'multimodal_text' && Array.isArray(content.parts)) {
    return content.parts
      .map((p) => {
        if (typeof p === 'string') return p
        if (typeof p === 'object' && p !== null) {
          const part = p as Record<string, unknown>
          if (part.content_type === 'text' && typeof part.text === 'string') return part.text
          if (typeof part.text === 'string') return part.text
        }
        return ''
      })
      .filter(Boolean)
      .join('')
      .trim()
  }

  // Code interpreter output
  if (content.content_type === 'code' && typeof content.text === 'string') {
    return content.text.trim()
  }

  // Tether quote (web browsing citation)
  if (content.content_type === 'tether_quote') {
    return typeof content.text === 'string' ? content.text.trim() : ''
  }

  // Tether browsing display (search result snippet shown inline)
  if (content.content_type === 'tether_browsing_display') {
    return typeof content.result === 'string' ? content.result.trim() : ''
  }

  // Execution output (code interpreter result)
  if (content.content_type === 'execution_output' && typeof content.text === 'string') {
    return content.text.trim()
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
 * Build AMPContentPart[] from a ChatGPT content object (Level 3).
 * Returns undefined when there are no meaningful parts to emit.
 */
function extractContentParts(content: ChatGPTContentPart): AMPContentPart[] | undefined {
  if (!content) return undefined
  const parts: AMPContentPart[] = []

  // Standard text
  if (content.content_type === 'text' && Array.isArray(content.parts)) {
    const text = content.parts
      .map((p) => (typeof p === 'string' ? p : ''))
      .join('')
      .trim()
    if (text) parts.push({ type: 'text', text })
    return parts.length > 0 ? parts : undefined
  }

  // Multimodal: text + images
  if (content.content_type === 'multimodal_text' && Array.isArray(content.parts)) {
    for (const p of content.parts) {
      if (typeof p === 'string' && p.trim()) {
        parts.push({ type: 'text', text: p.trim() })
      } else if (typeof p === 'object' && p !== null) {
        const part = p as Record<string, unknown>
        if (part.content_type === 'text' && typeof part.text === 'string' && part.text.trim()) {
          parts.push({ type: 'text', text: part.text.trim() })
        } else if (
          part.content_type === 'image_asset_pointer' ||
          (typeof part.asset_pointer === 'string')
        ) {
          // OpenAI stores images as asset pointers; URL may be embedded
          const url = typeof part.url === 'string' ? part.url
            : typeof part.asset_pointer === 'string' ? part.asset_pointer
            : null
          parts.push({
            type: 'image',
            url,
            mime_type: typeof part.content_type === 'string' && part.content_type.startsWith('image/')
              ? part.content_type
              : null,
          })
        }
      }
    }
    return parts.length > 0 ? parts : undefined
  }

  // Code interpreter block
  if (content.content_type === 'code' && typeof content.text === 'string' && content.text.trim()) {
    parts.push({
      type: 'code',
      language: typeof content.language === 'string' ? content.language : null,
      code: content.text.trim(),
    })
    return parts
  }

  // Execution output
  if (content.content_type === 'execution_output' && typeof content.text === 'string' && content.text.trim()) {
    parts.push({ type: 'code', language: null, code: content.text.trim() })
    return parts
  }

  // Tether quote — inline citation
  if (content.content_type === 'tether_quote') {
    const url = typeof content.url === 'string' ? content.url : null
    const text = typeof content.text === 'string' ? content.text.trim() : null
    if (url || text) {
      parts.push({
        type: 'citation',
        url,
        title: typeof content.title === 'string' ? content.title : null,
        snippet: text,
      })
      return parts
    }
  }

  // Tether browsing display
  if (content.content_type === 'tether_browsing_display' && typeof content.result === 'string') {
    parts.push({
      type: 'citation',
      url: typeof content.url === 'string' ? content.url : null,
      snippet: content.result.trim(),
    })
    return parts
  }

  return undefined
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
 * Convert a single ChatGPT node (with a message) to AMPMessage.
 * Returns null if the node should be skipped.
 */
function nodeToAMPMessage(node: ChatGPTNode): AMPMessage | null {
  const msg = node.message
  if (!msg) return null

  const content = extractContent(msg.content)
  if (!content && msg.author.role !== 'system') return null
  if (msg.recipient && msg.recipient !== 'all') return null

  const ampMsg: AMPMessage = {
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
  }

  const content_parts = extractContentParts(msg.content)
  if (content_parts) ampMsg.content_parts = content_parts

  return ampMsg
}

/**
 * Extract non-canonical alternate branches from the DAG.
 * For each node in the canonical path, collect sibling branches (children
 * that were NOT on the canonical path) and convert them.
 */
function extractAlternates(
  mapping: Record<string, ChatGPTNode>,
  canonicalPath: ChatGPTNode[]
): AMPAlternate[] {
  if (canonicalPath.length === 0) return []

  const canonicalIds = new Set(canonicalPath.map((n) => n.id))
  const alternates: AMPAlternate[] = []

  for (const node of canonicalPath) {
    // Find siblings: other children of this node's parent
    if (!node.parent) continue
    const parent = mapping[node.parent]
    if (!parent) continue

    const siblings = parent.children.filter((cid) => cid !== node.id)
    if (siblings.length === 0) continue

    for (const siblingId of siblings) {
      // Walk the sibling branch to leaf
      const branchMessages: AMPMessage[] = []
      let current: string | null = siblingId

      while (current !== null) {
        if (canonicalIds.has(current)) break  // rejoined canonical path
        const n: ChatGPTNode | undefined = mapping[current]
        if (!n) break
        const ampMsg = nodeToAMPMessage(n)
        if (ampMsg) branchMessages.push(ampMsg)
        // Follow the first child (pick deepest path of this branch)
        current = n.children.length > 0 ? n.children[0] : null
      }

      if (branchMessages.length > 0) {
        alternates.push({
          branch_point_id: node.parent,
          messages: branchMessages,
          is_current: false,
        })
      }
    }
  }

  return alternates
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
    const ampMsg = nodeToAMPMessage(node)
    if (ampMsg) messages.push(ampMsg)
  }

  const alternates = extractAlternates(raw.mapping, canonicalPath)

  const conv: AMPConversation = {
    id: raw.id,
    title: raw.title || 'Untitled Conversation',
    platform: 'chatgpt',
    messages,
    created_at: toISO(raw.create_time),
    updated_at: toISO(raw.update_time),
    source_format: 'chatgpt-export-v1',
    amp_version: AMP_VERSION,
    observed_at: new Date().toISOString(),
  }

  if (alternates.length > 0) conv.alternates = alternates

  return conv
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
