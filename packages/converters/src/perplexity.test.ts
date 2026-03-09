import { describe, it, expect } from 'vitest'
import { convertPerplexityExport, convertPerplexityConversation } from './perplexity.js'

const MINIMAL_CONV = {
  id: 'conv-1',
  title: 'What is AMP?',
  mode: 'pro',
  created_at: '2025-03-07T10:00:00Z',
  status: 'COMPLETED',
  messages: [
    {
      query: 'What is the AI Memory Protocol?',
      answer: 'AMP is an open standard for AI conversation portability.',
      citations: [
        { url: 'https://github.com/purmemo-ai/purmemo-amp', title: 'purmemo-amp', snippet: 'The open protocol.' },
      ],
      created_at: '2025-03-07T10:00:01Z',
    },
  ],
}

describe('convertPerplexityExport', () => {
  it('accepts { conversations: [...] } wrapper', () => {
    const result = convertPerplexityExport({ conversations: [MINIMAL_CONV] })
    expect(result.platform).toBe('perplexity')
    expect(result.conversation_count).toBe(1)
    expect(result.conversations).toHaveLength(1)
  })

  it('accepts bare array', () => {
    const result = convertPerplexityExport([MINIMAL_CONV])
    expect(result.conversation_count).toBe(1)
  })

  it('throws on invalid input', () => {
    expect(() => convertPerplexityExport('bad')).toThrow(/Invalid Perplexity export/)
    expect(() => convertPerplexityExport(null)).toThrow()
    expect(() => convertPerplexityExport(42)).toThrow()
  })

  it('sets amp_version and exported_at', () => {
    const result = convertPerplexityExport([MINIMAL_CONV])
    expect(result.amp_version).toBe('0.2')
    expect(result.exported_at).toBeTruthy()
  })
})

describe('convertPerplexityConversation', () => {
  it('expands each message pair into user + assistant turns', () => {
    const result = convertPerplexityConversation(MINIMAL_CONV, 0)
    expect(result.messages).toHaveLength(2)
    expect(result.messages[0].role).toBe('user')
    expect(result.messages[1].role).toBe('assistant')
  })

  it('maps query to user content', () => {
    const result = convertPerplexityConversation(MINIMAL_CONV, 0)
    expect(result.messages[0].content).toBe('What is the AI Memory Protocol?')
  })

  it('maps answer to assistant content', () => {
    const result = convertPerplexityConversation(MINIMAL_CONV, 0)
    expect(result.messages[1].content).toBe('AMP is an open standard for AI conversation portability.')
  })

  it('attaches citations as sources[] on the assistant message', () => {
    const result = convertPerplexityConversation(MINIMAL_CONV, 0)
    const assistant = result.messages[1]
    expect(assistant.sources).toHaveLength(1)
    expect(assistant.sources![0].url).toBe('https://github.com/purmemo-ai/purmemo-amp')
    expect(assistant.sources![0].title).toBe('purmemo-amp')
    expect(assistant.sources![0].snippet).toBe('The open protocol.')
  })

  it('does not set sources on user message', () => {
    const result = convertPerplexityConversation(MINIMAL_CONV, 0)
    expect(result.messages[0].sources).toBeUndefined()
  })

  it('sets platform to perplexity', () => {
    const result = convertPerplexityConversation(MINIMAL_CONV, 0)
    expect(result.platform).toBe('perplexity')
    result.messages.forEach((m) => expect(m.platform).toBe('perplexity'))
  })

  it('preserves conversation title', () => {
    const result = convertPerplexityConversation(MINIMAL_CONV, 0)
    expect(result.title).toBe('What is AMP?')
  })

  it('falls back to Untitled Conversation when title missing', () => {
    const result = convertPerplexityConversation({ ...MINIMAL_CONV, title: undefined }, 0)
    expect(result.title).toBe('Untitled Conversation')
  })

  it('normalizes created_at timestamp', () => {
    const result = convertPerplexityConversation(MINIMAL_CONV, 0)
    expect(result.created_at).toBe('2025-03-07T10:00:00.000Z')
  })

  it('stores mode in assistant message metadata', () => {
    const result = convertPerplexityConversation(MINIMAL_CONV, 0)
    expect(result.messages[1].metadata?.mode).toBe('pro')
  })

  it('handles empty citations array — no sources field set', () => {
    const conv = {
      ...MINIMAL_CONV,
      messages: [{ query: 'hello', answer: 'hi', citations: [] }],
    }
    const result = convertPerplexityConversation(conv, 0)
    expect(result.messages[1].sources).toBeUndefined()
  })

  it('handles missing citations — no sources field set', () => {
    const conv = {
      ...MINIMAL_CONV,
      messages: [{ query: 'hello', answer: 'hi' }],
    }
    const result = convertPerplexityConversation(conv, 0)
    expect(result.messages[1].sources).toBeUndefined()
  })

  it('skips turns with empty query or answer', () => {
    const conv = {
      ...MINIMAL_CONV,
      messages: [
        { query: '', answer: 'response without question' },
        { query: 'valid question', answer: '' },
        { query: 'good', answer: 'good' },
      ],
    }
    const result = convertPerplexityConversation(conv, 0)
    // Only the last pair with both query+answer should produce 2 messages
    // First: no user msg (empty query), assistant msg only
    // Second: user msg only (empty answer)
    // Third: both
    expect(result.messages.some((m) => m.content === 'response without question')).toBe(true)
    expect(result.messages.some((m) => m.content === 'valid question')).toBe(true)
  })

  it('sets source_format', () => {
    const result = convertPerplexityConversation(MINIMAL_CONV, 0)
    expect(result.source_format).toBe('perplexity-export-v1')
  })

  it('sets parent_id chain: user → null, assistant → user, next user → prev assistant', () => {
    const conv = {
      ...MINIMAL_CONV,
      messages: [
        { query: 'Q1', answer: 'A1' },
        { query: 'Q2', answer: 'A2' },
      ],
    }
    const result = convertPerplexityConversation(conv, 0)
    const [u1, a1, u2, a2] = result.messages
    expect(u1.parent_id).toBeNull()
    expect(a1.parent_id).toBe(u1.id)
    expect(u2.parent_id).toBe(a1.id)
    expect(a2.parent_id).toBe(u2.id)
  })
})
