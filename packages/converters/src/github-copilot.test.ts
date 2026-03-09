import { describe, it, expect } from 'vitest'
import { convertCopilotExport, convertCopilotConversation } from './github-copilot.js'

const MINIMAL_SESSION = {
  requesterUsername: 'chrisoladapo',
  responderUsername: 'GitHub Copilot',
  initialLocation: 'panel',
  requests: [
    {
      requestId: 'req-1',
      responseId: 'res-1',
      message: { text: 'What is AMP?', parts: [] },
      response: [
        { kind: 'text', content: 'AMP is the AI Memory Protocol.' },
        { kind: 'toolInvocationSerialized', name: 'read_file' },  // should be skipped
      ],
      result: { timings: { firstProgress: 120, totalElapsed: 850 } },
    },
  ],
}

describe('convertCopilotExport', () => {
  it('accepts single session object { requests: [...] }', () => {
    const result = convertCopilotExport(MINIMAL_SESSION)
    expect(result.platform).toBe('github-copilot')
    expect(result.conversation_count).toBe(1)
  })

  it('accepts array of sessions', () => {
    const result = convertCopilotExport([MINIMAL_SESSION])
    expect(result.conversation_count).toBe(1)
  })

  it('throws on invalid input', () => {
    expect(() => convertCopilotExport('bad')).toThrow(/Invalid GitHub Copilot Chat export/)
    expect(() => convertCopilotExport(null)).toThrow()
    expect(() => convertCopilotExport(42)).toThrow()
  })

  it('sets amp_version', () => {
    const result = convertCopilotExport(MINIMAL_SESSION)
    expect(result.amp_version).toBe('0.2')
  })
})

describe('convertCopilotConversation', () => {
  it('expands each request into user + assistant turns', () => {
    const result = convertCopilotConversation(MINIMAL_SESSION, 0)
    expect(result.messages).toHaveLength(2)
    expect(result.messages[0].role).toBe('user')
    expect(result.messages[1].role).toBe('assistant')
  })

  it('extracts user message text', () => {
    const result = convertCopilotConversation(MINIMAL_SESSION, 0)
    expect(result.messages[0].content).toBe('What is AMP?')
  })

  it('extracts only text-kind assistant response items', () => {
    const result = convertCopilotConversation(MINIMAL_SESSION, 0)
    expect(result.messages[1].content).toBe('AMP is the AI Memory Protocol.')
  })

  it('skips tool invocation response items', () => {
    const result = convertCopilotConversation(MINIMAL_SESSION, 0)
    // Only the text kind should appear — no tool invocation content
    expect(result.messages[1].content).not.toContain('read_file')
  })

  it('uses requestId as user message id', () => {
    const result = convertCopilotConversation(MINIMAL_SESSION, 0)
    expect(result.messages[0].id).toBe('req-1')
  })

  it('uses responseId as assistant message id', () => {
    const result = convertCopilotConversation(MINIMAL_SESSION, 0)
    expect(result.messages[1].id).toBe('res-1')
  })

  it('sets parent_id: assistant → user, second user → first assistant', () => {
    const session = {
      ...MINIMAL_SESSION,
      requests: [
        ...MINIMAL_SESSION.requests,
        {
          requestId: 'req-2',
          responseId: 'res-2',
          message: { text: 'Follow up?', parts: [] },
          response: [{ kind: 'text', content: 'Sure.' }],
          result: { timings: {} },
        },
      ],
    }
    const result = convertCopilotConversation(session, 0)
    const [u1, a1, u2, a2] = result.messages
    expect(u1.parent_id).toBeNull()
    expect(a1.parent_id).toBe('req-1')
    expect(u2.parent_id).toBe('res-1')
    expect(a2.parent_id).toBe('req-2')
  })

  it('sets platform to github-copilot', () => {
    const result = convertCopilotConversation(MINIMAL_SESSION, 0)
    result.messages.forEach((m) => expect(m.platform).toBe('github-copilot'))
  })

  it('stores timings in assistant message metadata', () => {
    const result = convertCopilotConversation(MINIMAL_SESSION, 0)
    expect(result.messages[1].metadata?.timings).toEqual({ firstProgress: 120, totalElapsed: 850 })
  })

  it('uses first user message as title (truncated to 80 chars)', () => {
    const result = convertCopilotConversation(MINIMAL_SESSION, 0)
    expect(result.title).toBe('What is AMP?')
  })

  it('falls back to "GitHub Copilot Chat" title when all user messages empty', () => {
    const session = {
      ...MINIMAL_SESSION,
      requests: [
        { requestId: 'r1', responseId: 'rs1', message: { text: '', parts: [] }, response: [{ kind: 'text', content: 'hi' }], result: {} },
      ],
    }
    const result = convertCopilotConversation(session, 0)
    expect(result.title).toBe('GitHub Copilot Chat')
  })

  it('sets source_format', () => {
    const result = convertCopilotConversation(MINIMAL_SESSION, 0)
    expect(result.source_format).toBe('github-copilot-export-v1')
  })

  it('handles multi-text response — joins with double newline', () => {
    const session = {
      ...MINIMAL_SESSION,
      requests: [{
        requestId: 'r1',
        responseId: 'rs1',
        message: { text: 'explain', parts: [] },
        response: [
          { kind: 'text', content: 'Part one.' },
          { kind: 'progressTaskSerialized', data: 'skip me' },
          { kind: 'text', content: 'Part two.' },
        ],
        result: {},
      }],
    }
    const result = convertCopilotConversation(session, 0)
    expect(result.messages[1].content).toBe('Part one.\n\nPart two.')
  })

  it('falls back to parts[] when message.text is missing', () => {
    const session = {
      ...MINIMAL_SESSION,
      requests: [{
        requestId: 'r1',
        responseId: 'rs1',
        message: { parts: [{ text: 'From parts', kind: 'text' }] },
        response: [{ kind: 'text', content: 'ok' }],
        result: {},
      }],
    }
    const result = convertCopilotConversation(session, 0)
    expect(result.messages[0].content).toBe('From parts')
  })

  it('skips request when both user and assistant content are empty', () => {
    const session = {
      ...MINIMAL_SESSION,
      requests: [
        { requestId: 'r1', responseId: 'rs1', message: { text: '', parts: [] }, response: [], result: {} },
        { requestId: 'r2', responseId: 'rs2', message: { text: 'real', parts: [] }, response: [{ kind: 'text', content: 'yes' }], result: {} },
      ],
    }
    const result = convertCopilotConversation(session, 0)
    expect(result.messages).toHaveLength(2)
  })
})
