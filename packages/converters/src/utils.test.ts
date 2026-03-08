import { describe, it, expect } from 'vitest'
import { normalizeRole, normalizeTimestamp } from './utils.js'

describe('normalizeRole', () => {
  it('passes standard AMP roles through', () => {
    expect(normalizeRole('user')).toBe('user')
    expect(normalizeRole('assistant')).toBe('assistant')
    expect(normalizeRole('system')).toBe('system')
    expect(normalizeRole('tool')).toBe('tool')
  })

  it('maps function → tool', () => {
    expect(normalizeRole('function')).toBe('tool')
  })

  it('maps Claude: human → user', () => {
    expect(normalizeRole('human')).toBe('user')
  })

  it('maps Gemini: model → assistant', () => {
    expect(normalizeRole('model')).toBe('assistant')
  })

  it('maps Grok: grok → assistant', () => {
    expect(normalizeRole('grok')).toBe('assistant')
  })

  it('maps M365 Copilot: userPrompt → user, aiResponse → assistant', () => {
    expect(normalizeRole('userPrompt')).toBe('user')
    expect(normalizeRole('aiResponse')).toBe('assistant')
  })

  it('maps Cohere: CHATBOT → assistant (case-insensitive)', () => {
    expect(normalizeRole('CHATBOT')).toBe('assistant')
    expect(normalizeRole('USER')).toBe('user')
  })

  it('defaults unknown roles to assistant', () => {
    expect(normalizeRole('robot')).toBe('assistant')
    expect(normalizeRole('')).toBe('assistant')
  })
})

describe('normalizeTimestamp', () => {
  it('returns null for null/undefined', () => {
    expect(normalizeTimestamp(null)).toBeNull()
    expect(normalizeTimestamp(undefined)).toBeNull()
  })

  it('passes through ISO 8601 strings', () => {
    const iso = '2025-03-07T12:00:00.000Z'
    expect(normalizeTimestamp(iso)).toBe(iso)
  })

  it('handles ISO 8601 with timezone offset', () => {
    const result = normalizeTimestamp('2025-03-07T12:00:00+05:30')
    expect(result).toBe('2025-03-07T06:30:00.000Z')
  })

  it('converts Unix seconds (float) — ChatGPT style', () => {
    // 1741348800 seconds = 2025-03-07T12:00:00.000Z
    const result = normalizeTimestamp(1741348800)
    expect(result).toBe('2025-03-07T12:00:00.000Z')
  })

  it('converts Unix milliseconds (integer) — Cursor style', () => {
    // 1741348800000 ms = 2025-03-07T12:00:00.000Z
    const result = normalizeTimestamp(1741348800000)
    expect(result).toBe('2025-03-07T12:00:00.000Z')
  })

  it('unwraps BSON $date.$numberLong — Grok message style', () => {
    const bson = { $date: { $numberLong: '1741348800000' } }
    const result = normalizeTimestamp(bson)
    expect(result).toBe('2025-03-07T12:00:00.000Z')
  })

  it('returns null for BSON object missing $numberLong', () => {
    expect(normalizeTimestamp({ $date: {} })).toBeNull()
    expect(normalizeTimestamp({})).toBeNull()
  })

  it('converts numeric string as milliseconds', () => {
    const result = normalizeTimestamp('1741348800000')
    expect(result).toBe('2025-03-07T12:00:00.000Z')
  })

  it('returns null for NaN number', () => {
    expect(normalizeTimestamp(NaN)).toBeNull()
  })
})
