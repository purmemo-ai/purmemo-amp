import { describe, it, expect } from 'vitest'
import { convertMistralExport, convertMistralConversation } from './mistral.js'

const MINIMAL_CONV = {
  id: 'mistral-conv-1',
  title: 'AMP overview',
  created_at: '2025-03-07T09:00:00Z',
  updated_at: '2025-03-07T09:05:00Z',
  messages: [
    { id: 'msg-1', role: 'user', content: 'What is AMP?', created_at: '2025-03-07T09:00:01Z' },
    { id: 'msg-2', role: 'assistant', content: 'AMP is the AI Memory Protocol.', created_at: '2025-03-07T09:00:05Z', model: 'mistral-large-latest' },
  ],
}

describe('convertMistralExport', () => {
  it('accepts { conversations: [...] } wrapper', () => {
    const result = convertMistralExport({ conversations: [MINIMAL_CONV] })
    expect(result.platform).toBe('mistral')
    expect(result.conversation_count).toBe(1)
  })

  it('accepts bare array', () => {
    const result = convertMistralExport([MINIMAL_CONV])
    expect(result.conversation_count).toBe(1)
  })

  it('throws on invalid input', () => {
    expect(() => convertMistralExport('bad')).toThrow(/Invalid Mistral export/)
    expect(() => convertMistralExport(42)).toThrow()
  })

  it('sets amp_version', () => {
    const result = convertMistralExport([MINIMAL_CONV])
    expect(result.amp_version).toBe('0.2')
  })
})

describe('convertMistralConversation', () => {
  it('maps user role correctly', () => {
    const result = convertMistralConversation(MINIMAL_CONV, 0)
    expect(result.messages[0].role).toBe('user')
  })

  it('maps assistant role correctly', () => {
    const result = convertMistralConversation(MINIMAL_CONV, 0)
    expect(result.messages[1].role).toBe('assistant')
  })

  it('maps system role correctly', () => {
    const conv = {
      ...MINIMAL_CONV,
      messages: [{ role: 'system', content: 'You are helpful.' }],
    }
    const result = convertMistralConversation(conv, 0)
    expect(result.messages[0].role).toBe('system')
  })

  it('preserves message content', () => {
    const result = convertMistralConversation(MINIMAL_CONV, 0)
    expect(result.messages[0].content).toBe('What is AMP?')
    expect(result.messages[1].content).toBe('AMP is the AI Memory Protocol.')
  })

  it('preserves message id from export', () => {
    const result = convertMistralConversation(MINIMAL_CONV, 0)
    expect(result.messages[0].id).toBe('msg-1')
    expect(result.messages[1].id).toBe('msg-2')
  })

  it('generates fallback id when message id missing', () => {
    const conv = {
      ...MINIMAL_CONV,
      messages: [{ role: 'user', content: 'hello' }],
    }
    const result = convertMistralConversation(conv, 3)
    expect(result.messages[0].id).toBe('mistral-3-0')
  })

  it('normalizes timestamps', () => {
    const result = convertMistralConversation(MINIMAL_CONV, 0)
    expect(result.created_at).toBe('2025-03-07T09:00:00.000Z')
    expect(result.updated_at).toBe('2025-03-07T09:05:00.000Z')
    expect(result.messages[0].timestamp).toBe('2025-03-07T09:00:01.000Z')
  })

  it('preserves model field on assistant message', () => {
    const result = convertMistralConversation(MINIMAL_CONV, 0)
    expect(result.messages[1].model).toBe('mistral-large-latest')
  })

  it('sets model null when not present', () => {
    const result = convertMistralConversation(MINIMAL_CONV, 0)
    expect(result.messages[0].model).toBeNull()
  })

  it('sets parent_id chain', () => {
    const result = convertMistralConversation(MINIMAL_CONV, 0)
    expect(result.messages[0].parent_id).toBeNull()
    expect(result.messages[1].parent_id).toBe('msg-1')
  })

  it('sets platform to mistral', () => {
    const result = convertMistralConversation(MINIMAL_CONV, 0)
    expect(result.platform).toBe('mistral')
    result.messages.forEach((m) => expect(m.platform).toBe('mistral'))
  })

  it('skips empty content messages', () => {
    const conv = {
      ...MINIMAL_CONV,
      messages: [
        { role: 'user', content: '' },
        { role: 'assistant', content: 'hello' },
      ],
    }
    const result = convertMistralConversation(conv, 0)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].role).toBe('assistant')
  })

  it('falls back to Untitled Conversation', () => {
    const result = convertMistralConversation({ ...MINIMAL_CONV, title: undefined }, 0)
    expect(result.title).toBe('Untitled Conversation')
  })

  it('sets source_format', () => {
    const result = convertMistralConversation(MINIMAL_CONV, 0)
    expect(result.source_format).toBe('mistral-export-v1')
  })
})
