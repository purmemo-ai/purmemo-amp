import type { AMPConversation, AMPMessage, AMPExport } from '@purmemo.ai/schema'
import { AMP_VERSION } from '@purmemo.ai/schema'
import { normalizeTimestamp } from './utils.js'

// ============================================================
// GitHub Copilot Chat → AMP Converter
// Parses VS Code Copilot Chat session exports.
//
// Export path: VS Code Command Palette → "Chat: Export Chat..." → JSON
// Also stored in: %APPDATA%/Code/User/workspaceStorage/<id>/chatSessions/
//                 globalStorage/github.copilot-chat/
//                 (same state.vscdb SQLite format as Cursor)
//
// Format — no explicit role field; roles are structural:
//   {
//     requesterUsername: string,       ← identifies the human user
//     responderUsername: string,       ← "GitHub Copilot"
//     requests: [
//       {
//         requestId: string,
//         message: { text: string, parts: [...] },
//         response: [
//           { kind: "text", content: string },
//           { kind: "toolInvocationSerialized", ... },
//           { kind: "toolCallResults", ... },
//           ...
//         ],
//         result: { timings: { firstProgress, totalElapsed } }
//       }
//     ]
//   }
//
// Each request is one user turn + one assistant turn.
// Tool invocations in response[] are skipped (internal plumbing).
// ============================================================

// --- GitHub Copilot raw types ---

interface CopilotMessagePart {
  text?: string
  kind?: string
  [key: string]: unknown
}

interface CopilotUserMessage {
  text?: string
  parts?: CopilotMessagePart[]
}

type CopilotResponseKind =
  | 'text'
  | 'progressTaskSerialized'
  | 'toolInvocationSerialized'
  | 'toolCallResults'
  | 'markdownVuln'
  | string

interface CopilotResponseItem {
  kind: CopilotResponseKind
  content?: string
  [key: string]: unknown
}

interface CopilotTimings {
  firstProgress?: number
  totalElapsed?: number
}

interface CopilotRequest {
  requestId?: string
  responseId?: string
  message?: CopilotUserMessage
  variableData?: unknown
  response?: CopilotResponseItem[]
  result?: {
    timings?: CopilotTimings
    metadata?: Record<string, unknown>
  }
}

interface CopilotSession {
  requesterUsername?: string
  responderUsername?: string
  initialLocation?: string
  requests?: CopilotRequest[]
}

// --- Helpers ---

/**
 * Extract plain text from a Copilot user message.
 * Prefers message.text; falls back to joining text parts.
 */
function extractUserContent(msg?: CopilotUserMessage): string {
  if (!msg) return ''
  if (typeof msg.text === 'string' && msg.text.trim()) return msg.text.trim()
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .map((p) => (typeof p.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('')
      .trim()
  }
  return ''
}

/**
 * Extract plain text from a Copilot assistant response array.
 * Collects only `kind: "text"` items — skips tool invocations,
 * progress tasks, and vulnerability warnings (internal plumbing).
 */
function extractAssistantContent(items?: CopilotResponseItem[]): string {
  if (!Array.isArray(items)) return ''
  return items
    .filter((item) => item.kind === 'text' && typeof item.content === 'string')
    .map((item) => (item.content as string).trim())
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Convert a single Copilot Chat session export to AMPConversation.
 *
 * Each request in session.requests expands to two AMP messages:
 *   request.message → user turn
 *   request.response (text items only) → assistant turn
 */
export function convertCopilotConversation(
  raw: CopilotSession,
  convIndex: number
): AMPConversation {
  const requests = raw.requests ?? []
  const messages: AMPMessage[] = []

  // Use first user message as title
  let title = 'GitHub Copilot Chat'

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i]
    const userContent = extractUserContent(req.message)
    const assistantContent = extractAssistantContent(req.response)

    const userMsgId = req.requestId ?? `copilot-${convIndex}-${i}-user`
    const assistantMsgId = req.responseId ?? `copilot-${convIndex}-${i}-assistant`

    if (userContent) {
      if (title === 'GitHub Copilot Chat') {
        title = userContent.slice(0, 80).replace(/\n/g, ' ')
      }
      const prevAssistantId = i > 0
        ? (requests[i - 1].responseId ?? `copilot-${convIndex}-${i - 1}-assistant`)
        : null

      messages.push({
        id: userMsgId,
        role: 'user',
        content: userContent,
        platform: 'github-copilot',
        timestamp: null,  // no per-message timestamp in Copilot export
        model: null,
        parent_id: prevAssistantId,
        metadata: {},
      })
    }

    if (assistantContent) {
      messages.push({
        id: assistantMsgId,
        role: 'assistant',
        content: assistantContent,
        platform: 'github-copilot',
        timestamp: null,
        model: null,
        parent_id: userMsgId,
        metadata: {
          timings: req.result?.timings ?? null,
        },
      })
    }
  }

  return {
    id: `copilot-session-${convIndex}`,
    title,
    platform: 'github-copilot',
    messages,
    created_at: null,   // no session-level timestamp in Copilot export
    updated_at: null,
    source_format: 'github-copilot-export-v1',
    amp_version: AMP_VERSION,
  }
}

/**
 * Convert a GitHub Copilot Chat session export file to AMPExport.
 *
 * Accepts:
 *   { requests: [...] }   — single session export (VS Code "Export Chat")
 *   [...]                 — array of sessions
 */
export function convertCopilotExport(raw: unknown): AMPExport {
  let sessions: CopilotSession[]

  if (Array.isArray(raw)) {
    sessions = raw as CopilotSession[]
  } else if (
    typeof raw === 'object' && raw !== null &&
    Array.isArray((raw as CopilotSession).requests)
  ) {
    // Single session export
    sessions = [raw as CopilotSession]
  } else {
    throw new Error(
      'Invalid GitHub Copilot Chat export: expected a session object { requests: [...] } or an array of sessions. ' +
      'Use VS Code Command Palette → "Chat: Export Chat..." to export.'
    )
  }

  const conversations = sessions.map((session, i) =>
    convertCopilotConversation(session, i)
  )

  return {
    amp_version: AMP_VERSION,
    exported_at: new Date().toISOString(),
    platform: 'github-copilot',
    conversation_count: conversations.length,
    conversations,
  }
}

// Re-export for single-session use
export { convertCopilotConversation as convertGitHubCopilotConversation }
export { convertCopilotExport as convertGitHubCopilotExport }
