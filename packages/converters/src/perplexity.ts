import type { AMPConversation, AMPMessage, AMPExport, AMPSource } from '@purmemo.ai/schema'
import { AMP_VERSION } from '@purmemo.ai/schema'
import { normalizeTimestamp } from './utils.js'

// ============================================================
// Perplexity → AMP Converter
// Parses the GDPR data export ZIP (conversations JSON).
//
// Export path: Settings → Data Controls → "Download My Data"
// File: conversations JSON inside the ZIP archive
//
// Format:
//   { conversations: [ { title, mode, created_at, status,
//                        collection_uuid, messages: [
//                          { query, answer, citations } ] } ] }
//
// Roles: query → user, answer → assistant (structural, not field-based)
// Citations: array of { url, title, snippet } on the answer object
// ============================================================

// --- Perplexity raw types ---

interface PerplexityCitation {
  url?: string
  title?: string
  snippet?: string
  [key: string]: unknown
}

interface PerplexityMessage {
  query: string
  answer: string
  citations?: PerplexityCitation[]
  created_at?: string
  [key: string]: unknown
}

interface PerplexityConversation {
  id?: string
  title?: string
  mode?: string           // "copilot" | "pro" | "default"
  created_at?: string
  status?: string         // "COMPLETED" | etc.
  collection_uuid?: string
  messages: PerplexityMessage[]
}

interface PerplexityExport {
  conversations: PerplexityConversation[]
}

// --- Helpers ---

function makeId(convIndex: number, msgIndex: number, turn: 'user' | 'assistant'): string {
  return `perplexity-${convIndex}-${msgIndex}-${turn}`
}

function normalizeCitations(raw?: PerplexityCitation[]): AMPSource[] | null {
  if (!raw || raw.length === 0) return null
  return raw.map((c) => ({
    url: typeof c.url === 'string' ? c.url : null,
    title: typeof c.title === 'string' ? c.title : null,
    snippet: typeof c.snippet === 'string' ? c.snippet : null,
  }))
}

/**
 * Convert a single Perplexity conversation to AMPConversation.
 *
 * Each Perplexity message is a Q&A pair (query + answer).
 * We expand each pair into two AMP messages: user + assistant.
 * Citations from the answer are attached to the assistant message.
 */
export function convertPerplexityConversation(
  raw: PerplexityConversation,
  convIndex: number
): AMPConversation {
  const messages: AMPMessage[] = []

  for (let i = 0; i < raw.messages.length; i++) {
    const pair = raw.messages[i]

    // User turn
    if (pair.query?.trim()) {
      messages.push({
        id: makeId(convIndex, i, 'user'),
        role: 'user',
        content: pair.query.trim(),
        platform: 'perplexity',
        timestamp: normalizeTimestamp(pair.created_at),
        model: null,
        parent_id: i > 0 ? makeId(convIndex, i - 1, 'assistant') : null,
        metadata: {},
      })
    }

    // Assistant turn — attach citations as sources
    if (pair.answer?.trim()) {
      const sources = normalizeCitations(pair.citations)
      const msg: AMPMessage = {
        id: makeId(convIndex, i, 'assistant'),
        role: 'assistant',
        content: pair.answer.trim(),
        platform: 'perplexity',
        timestamp: normalizeTimestamp(pair.created_at),
        model: null,
        parent_id: makeId(convIndex, i, 'user'),
        metadata: {
          mode: raw.mode ?? null,
        },
      }
      if (sources) msg.sources = sources
      messages.push(msg)
    }
  }

  const convId = raw.id ?? `perplexity-conv-${convIndex}`

  return {
    id: convId,
    title: raw.title || 'Untitled Conversation',
    platform: 'perplexity',
    messages,
    created_at: normalizeTimestamp(raw.created_at),
    updated_at: null,
    source_format: 'perplexity-export-v1',
    amp_version: AMP_VERSION,
  }
}

/**
 * Convert a full Perplexity GDPR export to AMPExport.
 *
 * Accepts:
 *   { conversations: [...] }  — standard GDPR export wrapper
 *   [...]                     — bare array of conversations
 */
export function convertPerplexityExport(raw: unknown): AMPExport {
  let convList: PerplexityConversation[]

  if (Array.isArray(raw)) {
    convList = raw as PerplexityConversation[]
  } else if (
    typeof raw === 'object' && raw !== null &&
    Array.isArray((raw as PerplexityExport).conversations)
  ) {
    convList = (raw as PerplexityExport).conversations
  } else {
    throw new Error(
      'Invalid Perplexity export: expected { conversations: [...] } or a bare array. ' +
      'Make sure you are passing the conversations JSON from the Perplexity GDPR data export ZIP.'
    )
  }

  const conversations = convList.map((conv, i) =>
    convertPerplexityConversation(conv, i)
  )

  return {
    amp_version: AMP_VERSION,
    exported_at: new Date().toISOString(),
    platform: 'perplexity',
    conversation_count: conversations.length,
    conversations,
  }
}
