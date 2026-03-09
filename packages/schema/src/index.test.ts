import { describe, it, expect } from 'vitest'
import {
  AMPPlatform,
  AMPRole,
  AMPSource,
  AMPTextPart,
  AMPImagePart,
  AMPCodePart,
  AMPToolUsePart,
  AMPToolResultPart,
  AMPCitationPart,
  AMPThinkingPart,
  AMPContentPart,
  AMPMessage,
  AMPAlternate,
  AMPConversation,
  AMPExport,
  parseAMPExport,
  parseAMPConversation,
  AMP_VERSION,
} from './index.js'

// ============================================================
// AMPPlatform
// ============================================================

describe('AMPPlatform', () => {
  it('accepts all 9 known platforms', () => {
    const platforms = [
      'chatgpt', 'claude', 'gemini', 'cursor',
      'perplexity', 'grok', 'mistral', 'github-copilot', 'other',
    ]
    for (const p of platforms) {
      expect(AMPPlatform.safeParse(p).success).toBe(true)
    }
  })

  it('rejects unknown platform', () => {
    expect(AMPPlatform.safeParse('openai').success).toBe(false)
  })
})

// ============================================================
// AMPRole
// ============================================================

describe('AMPRole', () => {
  it('accepts all 4 roles', () => {
    for (const r of ['user', 'assistant', 'system', 'tool']) {
      expect(AMPRole.safeParse(r).success).toBe(true)
    }
  })

  it('rejects unknown role', () => {
    expect(AMPRole.safeParse('human').success).toBe(false)
  })
})

// ============================================================
// AMPSource
// ============================================================

describe('AMPSource', () => {
  it('accepts full source', () => {
    const result = AMPSource.safeParse({
      url: 'https://example.com',
      title: 'Example',
      snippet: 'A snippet',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty source object', () => {
    expect(AMPSource.safeParse({}).success).toBe(true)
  })
})

// ============================================================
// Level 3 — Content Parts
// ============================================================

describe('AMPTextPart', () => {
  it('parses valid text part', () => {
    const result = AMPTextPart.safeParse({ type: 'text', text: 'Hello world' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.text).toBe('Hello world')
  })

  it('rejects missing text', () => {
    expect(AMPTextPart.safeParse({ type: 'text' }).success).toBe(false)
  })
})

describe('AMPImagePart', () => {
  it('parses image with url', () => {
    const result = AMPImagePart.safeParse({
      type: 'image',
      url: 'https://cdn.openai.com/img.png',
      mime_type: 'image/png',
    })
    expect(result.success).toBe(true)
  })

  it('parses image with base64 data', () => {
    const result = AMPImagePart.safeParse({
      type: 'image',
      data: 'iVBORw0KGgoAAAANSUhEUgAA',
      mime_type: 'image/png',
    })
    expect(result.success).toBe(true)
  })

  it('parses image with no fields (all optional)', () => {
    expect(AMPImagePart.safeParse({ type: 'image' }).success).toBe(true)
  })
})

describe('AMPCodePart', () => {
  it('parses code part with language', () => {
    const result = AMPCodePart.safeParse({
      type: 'code',
      language: 'python',
      code: 'print("hello")',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.language).toBe('python')
  })

  it('parses code without language', () => {
    expect(AMPCodePart.safeParse({ type: 'code', code: 'x = 1' }).success).toBe(true)
  })
})

describe('AMPToolUsePart', () => {
  it('parses tool use with input', () => {
    const result = AMPToolUsePart.safeParse({
      type: 'tool_use',
      tool_use_id: 'toolu_01',
      tool_name: 'bash',
      tool_input: { command: 'ls -la' },
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.tool_name).toBe('bash')
  })

  it('requires tool_name', () => {
    expect(AMPToolUsePart.safeParse({ type: 'tool_use' }).success).toBe(false)
  })
})

describe('AMPToolResultPart', () => {
  it('parses tool result', () => {
    const result = AMPToolResultPart.safeParse({
      type: 'tool_result',
      tool_use_id: 'toolu_01',
      content: 'total 42\ndrwxr-xr-x 1 user user',
    })
    expect(result.success).toBe(true)
  })

  it('requires content', () => {
    expect(AMPToolResultPart.safeParse({ type: 'tool_result' }).success).toBe(false)
  })
})

describe('AMPCitationPart', () => {
  it('parses citation', () => {
    const result = AMPCitationPart.safeParse({
      type: 'citation',
      url: 'https://arxiv.org/abs/2303.08774',
      title: 'GPT-4 Technical Report',
      snippet: 'We report the development of GPT-4...',
    })
    expect(result.success).toBe(true)
  })
})

describe('AMPThinkingPart', () => {
  it('parses thinking part', () => {
    const result = AMPThinkingPart.safeParse({
      type: 'thinking',
      thinking: 'Let me think about this step by step...',
    })
    expect(result.success).toBe(true)
  })

  it('requires thinking field', () => {
    expect(AMPThinkingPart.safeParse({ type: 'thinking' }).success).toBe(false)
  })
})

describe('AMPContentPart discriminated union', () => {
  it('routes to correct type by discriminant', () => {
    const parts = [
      { type: 'text', text: 'hi' },
      { type: 'image', url: 'https://example.com/img.png' },
      { type: 'code', code: 'x = 1' },
      { type: 'tool_use', tool_name: 'bash' },
      { type: 'tool_result', content: 'ok' },
      { type: 'citation', url: 'https://example.com' },
      { type: 'thinking', thinking: 'hmm...' },
    ]
    for (const part of parts) {
      const result = AMPContentPart.safeParse(part)
      expect(result.success).toBe(true)
    }
  })

  it('rejects unknown type', () => {
    expect(AMPContentPart.safeParse({ type: 'video', src: 'https://youtube.com' }).success).toBe(false)
  })
})

// ============================================================
// AMPMessage
// ============================================================

describe('AMPMessage', () => {
  const baseMsg = {
    id: 'msg-001',
    role: 'user',
    content: 'Hello',
    platform: 'claude',
  }

  it('parses minimal L1 message', () => {
    expect(AMPMessage.safeParse(baseMsg).success).toBe(true)
  })

  it('parses L2 message with optional fields', () => {
    const result = AMPMessage.safeParse({
      ...baseMsg,
      timestamp: '2026-03-09T10:00:00.000Z',
      model: 'claude-sonnet-4-6',
      parent_id: null,
      metadata: { has_attachments: false },
    })
    expect(result.success).toBe(true)
  })

  it('parses L3 message with content_parts', () => {
    const result = AMPMessage.safeParse({
      ...baseMsg,
      content: 'Here is some code:',
      content_parts: [
        { type: 'text', text: 'Here is some code:' },
        { type: 'code', language: 'typescript', code: 'const x = 1' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('parses message with tool_use and tool_result parts', () => {
    const result = AMPMessage.safeParse({
      id: 'msg-002',
      role: 'assistant',
      content: '',
      platform: 'claude',
      content_parts: [
        { type: 'tool_use', tool_name: 'bash', tool_input: { command: 'ls' } },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects message without content', () => {
    const { content: _, ...noContent } = baseMsg
    expect(AMPMessage.safeParse(noContent).success).toBe(false)
  })

  it('rejects invalid role', () => {
    expect(AMPMessage.safeParse({ ...baseMsg, role: 'bot' }).success).toBe(false)
  })

  it('rejects invalid platform', () => {
    expect(AMPMessage.safeParse({ ...baseMsg, platform: 'bard' }).success).toBe(false)
  })

  it('rejects malformed timestamp', () => {
    expect(AMPMessage.safeParse({ ...baseMsg, timestamp: '2026-03-09' }).success).toBe(false)
  })
})

// ============================================================
// AMPAlternate
// ============================================================

describe('AMPAlternate', () => {
  it('parses valid alternate branch', () => {
    const result = AMPAlternate.safeParse({
      branch_point_id: 'node-abc',
      messages: [
        { id: 'alt-msg-1', role: 'user', content: 'Different prompt', platform: 'chatgpt' },
      ],
      is_current: false,
    })
    expect(result.success).toBe(true)
  })

  it('requires branch_point_id', () => {
    expect(AMPAlternate.safeParse({ messages: [], is_current: false }).success).toBe(false)
  })
})

// ============================================================
// AMPConversation
// ============================================================

describe('AMPConversation', () => {
  const baseConv = {
    id: 'conv-001',
    title: 'Test Conversation',
    platform: 'chatgpt',
    messages: [],
    source_format: 'chatgpt-export-v1',
    amp_version: '0.2',
  }

  it('parses minimal v0.2 conversation', () => {
    expect(AMPConversation.safeParse(baseConv).success).toBe(true)
  })

  it('accepts v0.1 amp_version for backward compat', () => {
    expect(AMPConversation.safeParse({ ...baseConv, amp_version: '0.1' }).success).toBe(true)
  })

  it('parses conversation with observed_at', () => {
    const result = AMPConversation.safeParse({
      ...baseConv,
      observed_at: '2026-03-09T12:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('parses conversation with alternates', () => {
    const result = AMPConversation.safeParse({
      ...baseConv,
      alternates: [
        {
          branch_point_id: 'node-x',
          messages: [{ id: 'alt-1', role: 'user', content: 'alt prompt', platform: 'chatgpt' }],
          is_current: false,
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown amp_version', () => {
    expect(AMPConversation.safeParse({ ...baseConv, amp_version: '1.0' }).success).toBe(false)
  })
})

// ============================================================
// AMPExport
// ============================================================

describe('AMPExport', () => {
  const baseExport = {
    amp_version: '0.2',
    exported_at: '2026-03-09T12:00:00.000Z',
    platform: 'claude',
    conversation_count: 0,
    conversations: [],
  }

  it('parses minimal empty export', () => {
    expect(AMPExport.safeParse(baseExport).success).toBe(true)
  })

  it('rejects negative conversation_count', () => {
    expect(AMPExport.safeParse({ ...baseExport, conversation_count: -1 }).success).toBe(false)
  })
})

// ============================================================
// Helpers
// ============================================================

describe('parseAMPExport', () => {
  it('returns success: false for invalid input', () => {
    expect(parseAMPExport('not an object').success).toBe(false)
  })

  it('returns success: true for valid export', () => {
    const result = parseAMPExport({
      amp_version: '0.2',
      exported_at: '2026-03-09T00:00:00.000Z',
      platform: 'gemini',
      conversation_count: 0,
      conversations: [],
    })
    expect(result.success).toBe(true)
  })
})

describe('parseAMPConversation', () => {
  it('returns success: false for null', () => {
    expect(parseAMPConversation(null).success).toBe(false)
  })
})

describe('AMP_VERSION', () => {
  it('is 0.2', () => {
    expect(AMP_VERSION).toBe('0.2')
  })
})
