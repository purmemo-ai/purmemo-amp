import type { AMPMessage } from '@purmemo.ai/schema'

// ============================================================
// Shared converter utilities
// Normalizes the role and timestamp babel across platforms.
// ============================================================

/**
 * Role strings used by each platform → AMP role mapping.
 *
 * Platform-specific values:
 *   ChatGPT:       "user" | "assistant" | "system" | "tool" | "function"
 *   Claude:        "human" | "assistant"
 *   Gemini:        "user" | "model"
 *   Cursor:        1 (user) | 2 (assistant)  [handled by caller]
 *   Perplexity:    query→user, answer→assistant  [structural, handled by caller]
 *   Grok:          "human" | "grok"
 *   Mistral:       "user" | "assistant" | "system" | "tool"
 *   GitHub Copilot: structural — requesterUsername vs responderUsername
 *   M365 Copilot:  "userPrompt" | "aiResponse"
 *   Cohere:        "USER" | "CHATBOT"
 */
export function normalizeRole(raw: string): AMPMessage['role'] {
  switch (raw.toLowerCase()) {
    // Standard
    case 'user':         return 'user'
    case 'assistant':    return 'assistant'
    case 'system':       return 'system'
    case 'tool':
    case 'function':     return 'tool'

    // Claude
    case 'human':        return 'user'

    // Gemini
    case 'model':        return 'assistant'

    // Grok
    case 'grok':         return 'assistant'

    // M365 Copilot
    case 'userprompt':   return 'user'
    case 'airesponse':   return 'assistant'

    // Cohere
    case 'chatbot':      return 'assistant'

    default:             return 'assistant'
  }
}

/**
 * Normalize a timestamp from any platform format to ISO 8601 string.
 *
 * Handles:
 *   - ISO 8601 strings (pass-through)
 *   - Unix seconds (float) — ChatGPT
 *   - Unix milliseconds (integer) — Cursor, Copilot timings
 *   - BSON $date.$numberLong (string of ms) — Grok message timestamps
 *   - null / undefined → null
 */
export function normalizeTimestamp(
  raw: string | number | null | undefined | { $date?: { $numberLong?: string } }
): string | null {
  if (raw == null) return null

  // BSON $date.$numberLong — Grok message timestamps
  if (typeof raw === 'object' && raw !== null) {
    const bson = raw as { $date?: { $numberLong?: string } }
    const ms = bson.$date?.$numberLong
    if (ms != null) {
      const n = Number(ms)
      if (!isNaN(n)) return safeISOFromMs(n)
    }
    return null
  }

  if (typeof raw === 'string') {
    // Already ISO 8601
    if (raw.includes('T') || raw.includes('-')) {
      try {
        const d = new Date(raw)
        if (!isNaN(d.getTime())) return d.toISOString()
      } catch { /* fall through */ }
    }
    // Numeric string — treat as ms
    const n = Number(raw)
    if (!isNaN(n)) return safeISOFromMs(n)
    return null
  }

  if (typeof raw === 'number') {
    if (isNaN(raw)) return null
    // Heuristic: values < 1e10 are Unix seconds, >= 1e10 are milliseconds
    return raw < 1e10
      ? safeISOFromMs(raw * 1000)
      : safeISOFromMs(raw)
  }

  return null
}

function safeISOFromMs(ms: number): string | null {
  try {
    const d = new Date(ms)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  } catch {
    return null
  }
}
