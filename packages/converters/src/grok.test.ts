import { describe, it, expect } from 'vitest'
import { convertGrokExport, convertGrokConversation } from './grok.js'

const BSON_TS = { $date: { $numberLong: '1741348800000' } }  // 2025-03-07T12:00:00.000Z

const MINIMAL_CONV = {
  id: 'grok-conv-abc',
  title: 'AMP discussion',
  create_time: '2025-03-07T08:00:00Z',
  responses: [
    { sender: 'human', message: 'What is AMP?', create_time: BSON_TS },
    { sender: 'grok', message: 'AMP is the AI Memory Protocol.', create_time: BSON_TS },
  ],
}

describe('convertGrokExport', () => {
  it('accepts { conversations: [...] } wrapper', () => {
    const result = convertGrokExport({ conversations: [MINIMAL_CONV] })
    expect(result.platform).toBe('grok')
    expect(result.conversation_count).toBe(1)
  })

  it('accepts bare array', () => {
    const result = convertGrokExport([MINIMAL_CONV])
    expect(result.conversation_count).toBe(1)
  })

  it('throws on invalid input', () => {
    expect(() => convertGrokExport('bad')).toThrow(/Invalid Grok export/)
    expect(() => convertGrokExport(null)).toThrow()
  })

  it('sets amp_version', () => {
    const result = convertGrokExport([MINIMAL_CONV])
    expect(result.amp_version).toBe('0.2')
  })
})

describe('convertGrokConversation', () => {
  it('maps human → user role', () => {
    const result = convertGrokConversation(MINIMAL_CONV, 0)
    expect(result.messages[0].role).toBe('user')
  })

  it('maps grok → assistant role', () => {
    const result = convertGrokConversation(MINIMAL_CONV, 0)
    expect(result.messages[1].role).toBe('assistant')
  })

  it('preserves message content', () => {
    const result = convertGrokConversation(MINIMAL_CONV, 0)
    expect(result.messages[0].content).toBe('What is AMP?')
    expect(result.messages[1].content).toBe('AMP is the AI Memory Protocol.')
  })

  it('unwraps BSON $date.$numberLong timestamps', () => {
    const result = convertGrokConversation(MINIMAL_CONV, 0)
    expect(result.messages[0].timestamp).toBe('2025-03-07T12:00:00.000Z')
    expect(result.messages[1].timestamp).toBe('2025-03-07T12:00:00.000Z')
  })

  it('normalizes ISO conversation-level create_time', () => {
    const result = convertGrokConversation(MINIMAL_CONV, 0)
    expect(result.created_at).toBe('2025-03-07T08:00:00.000Z')
  })

  it('sets platform to grok', () => {
    const result = convertGrokConversation(MINIMAL_CONV, 0)
    expect(result.platform).toBe('grok')
    result.messages.forEach((m) => expect(m.platform).toBe('grok'))
  })

  it('sets parent_id chain', () => {
    const result = convertGrokConversation(MINIMAL_CONV, 0)
    expect(result.messages[0].parent_id).toBeNull()
    expect(result.messages[1].parent_id).toBe(result.messages[0].id)
  })

  it('uses conversation id from export', () => {
    const result = convertGrokConversation(MINIMAL_CONV, 0)
    expect(result.id).toBe('grok-conv-abc')
  })

  it('generates fallback id when missing', () => {
    const result = convertGrokConversation({ ...MINIMAL_CONV, id: undefined }, 5)
    expect(result.id).toBe('grok-conv-5')
  })

  it('falls back to Untitled Conversation when title missing', () => {
    const result = convertGrokConversation({ ...MINIMAL_CONV, title: undefined }, 0)
    expect(result.title).toBe('Untitled Conversation')
  })

  it('skips empty message content', () => {
    const conv = {
      ...MINIMAL_CONV,
      responses: [
        { sender: 'human', message: '', create_time: BSON_TS },
        { sender: 'grok', message: 'response', create_time: BSON_TS },
      ],
    }
    const result = convertGrokConversation(conv, 0)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].role).toBe('assistant')
  })

  it('sets source_format', () => {
    const result = convertGrokConversation(MINIMAL_CONV, 0)
    expect(result.source_format).toBe('grok-export-v1')
  })

  it('handles null create_time on messages gracefully', () => {
    const conv = {
      ...MINIMAL_CONV,
      responses: [
        { sender: 'human', message: 'hi', create_time: null },
      ],
    }
    const result = convertGrokConversation(conv, 0)
    expect(result.messages[0].timestamp).toBeNull()
  })
})
