#!/usr/bin/env node
import { Command } from 'commander'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, basename, extname } from 'path'
import { convertChatGPTExport, convertClaudeExport, convertGeminiExport, convertCursorExport, convertCursorDBRows } from '@purmemo.ai/converters'
import { parseAMPExport } from '@purmemo.ai/schema'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const program = new Command()

program
  .name('purmemo-migrate')
  .description('AMP — AI Memory Protocol\nMigrate AI conversations to open AMP format.')
  .version('0.1.0')

// ── import ──────────────────────────────────────────────────
program
  .command('import <file>')
  .description('Parse a platform export and convert to AMP format')
  .option(
    '-p, --platform <platform>',
    'Source platform: chatgpt | claude | gemini | cursor',
    'chatgpt'
  )
  .option(
    '-o, --output <path>',
    'Output file path (default: <file>.amp.json)'
  )
  .option(
    '--markdown',
    'Also write a human-readable Markdown file',
    false
  )
  .option(
    '--dry-run',
    'Parse and validate without writing output',
    false
  )
  .option(
    '--stats',
    'Print summary statistics after conversion',
    false
  )
  .action(async (file: string, opts: {
    platform: string
    output?: string
    markdown: boolean
    dryRun: boolean
    stats: boolean
  }) => {
    const inputPath = resolve(file)

    // Read input
    let raw: unknown
    try {
      const text = readFileSync(inputPath, 'utf-8')
      raw = JSON.parse(text)
    } catch (err) {
      console.error(`Error reading ${inputPath}:`, err instanceof Error ? err.message : err)
      process.exit(1)
    }

    // Auto-detect platform if not specified
    let platform = opts.platform
    if (platform === 'chatgpt') {
      if (Array.isArray(raw)) {
        const first = (raw as Record<string, unknown>[])[0]
        if (first && first['uuid'] && first['chat_messages']) {
          platform = 'claude'
          console.log('🔍 Auto-detected: Claude export')
        } else if (first && first['messages'] && Array.isArray((first as Record<string, unknown>)['messages'])) {
          const msgs = (first as Record<string, unknown[]>)['messages']
          if (msgs.length > 0 && (msgs[0] as Record<string, unknown>)['role'] === 'user' &&
              (msgs[0] as Record<string, unknown>)['parts']) {
            platform = 'gemini'
            console.log('🔍 Auto-detected: Gemini export')
          }
        }
      } else if (typeof raw === 'object' && raw !== null) {
        const obj = raw as Record<string, unknown>
        if (Array.isArray(obj['conversations'])) {
          platform = 'cursor'
          console.log('🔍 Auto-detected: Cursor export')
        }
      }
    }

    // Convert
    let ampExport: ReturnType<typeof convertChatGPTExport>
    try {
      switch (platform) {
        case 'chatgpt':
          ampExport = convertChatGPTExport(raw)
          break
        case 'claude':
          ampExport = convertClaudeExport(raw)
          break
        case 'gemini':
          ampExport = convertGeminiExport(raw)
          break
        case 'cursor':
          ampExport = convertCursorExport(raw)
          break
        default:
          console.error(`Platform "${platform}" is not yet supported.`)
          console.error('Supported platforms: chatgpt, claude, gemini, cursor')
          process.exit(1)
      }
    } catch (err) {
      console.error('Conversion failed:', err instanceof Error ? err.message : err)
      process.exit(1)
    }

    // Validate output
    const validation = parseAMPExport(ampExport!)
    if (!validation.success) {
      console.error('AMP validation failed:', validation.error.format())
      process.exit(1)
    }

    const result = ampExport!
    if (opts.stats || opts.dryRun) {
      const totalMessages = result.conversations.reduce(
        (sum, c) => sum + c.messages.length,
        0
      )
      console.log(`\n📊 Conversion summary:`)
      console.log(`   Platform:      ${result.platform}`)
      console.log(`   Conversations: ${result.conversation_count}`)
      console.log(`   Messages:      ${totalMessages}`)
      console.log(`   AMP version:   ${result.amp_version}`)
    }

    if (opts.dryRun) {
      console.log('\n✅ Dry run complete — no files written.')
      return
    }

    // Write JSON
    const base = basename(inputPath, extname(inputPath))
    const outJson = opts.output ?? resolve(process.cwd(), `${base}.amp.json`)
    writeFileSync(outJson, JSON.stringify(result, null, 2), 'utf-8')
    console.log(`\n✅ AMP export written to: ${outJson}`)

    // Write Markdown
    if (opts.markdown) {
      const outMd = outJson.replace(/\.amp\.json$/, '.amp.md')
      const md = toMarkdown(result)
      writeFileSync(outMd, md, 'utf-8')
      console.log(`📝 Markdown written to:   ${outMd}`)
    }
  })

// ── validate ─────────────────────────────────────────────────
program
  .command('validate <file>')
  .description('Validate an AMP JSON file against the v0.1 schema')
  .action((file: string) => {
    const inputPath = resolve(file)
    let raw: unknown
    try {
      const text = readFileSync(inputPath, 'utf-8')
      raw = JSON.parse(text)
    } catch (err) {
      console.error(`Error reading ${inputPath}:`, err instanceof Error ? err.message : err)
      process.exit(1)
    }

    const result = parseAMPExport(raw)
    if (result.success) {
      console.log(`✅ Valid AMP v${result.data.amp_version} export`)
      console.log(`   ${result.data.conversation_count} conversation(s)`)
    } else {
      console.error('❌ Invalid AMP file:')
      console.error(result.error.format())
      process.exit(1)
    }
  })

// ── info ─────────────────────────────────────────────────────
program
  .command('info <file>')
  .description('Show statistics about a platform export or AMP file')
  .option('-p, --platform <platform>', 'Platform hint for raw exports')
  .action((file: string, opts: { platform?: string }) => {
    const inputPath = resolve(file)
    let raw: unknown
    try {
      const text = readFileSync(inputPath, 'utf-8')
      raw = JSON.parse(text)
    } catch (err) {
      console.error(`Error reading ${inputPath}:`, err instanceof Error ? err.message : err)
      process.exit(1)
    }

    // Try to detect AMP format
    const ampResult = parseAMPExport(raw)
    if (ampResult.success) {
      const exp = ampResult.data
      const totalMessages = exp.conversations.reduce((s, c) => s + c.messages.length, 0)
      console.log(`\n📦 AMP Export v${exp.amp_version}`)
      console.log(`   Platform:      ${exp.platform}`)
      console.log(`   Exported at:   ${exp.exported_at}`)
      console.log(`   Conversations: ${exp.conversation_count}`)
      console.log(`   Total messages:${totalMessages}`)
      return
    }

    // Raw export — detect platform
    if (Array.isArray(raw) && raw.length > 0) {
      const first = (raw as Record<string, unknown>[])[0]
      const isClauде = first['uuid'] && first['chat_messages']
      const conversations = raw as Array<Record<string, unknown>>

      if (isClauде) {
        const totalMessages = conversations.reduce(
          (s, c) => s + (Array.isArray(c['chat_messages']) ? (c['chat_messages'] as unknown[]).length : 0),
          0
        )
        console.log(`\n📦 Raw export (detected: claude)`)
        console.log(`   Conversations: ${conversations.length}`)
        console.log(`   Total messages: ${totalMessages}`)
        console.log(`\nRun: purmemo-migrate import <file> --platform claude`)
      } else {
        const totalMessages = conversations.reduce(
          (s, c) => s + (c['mapping'] ? Object.keys(c['mapping'] as object).length : 0),
          0
        )
        console.log(`\n📦 Raw export (detected: chatgpt)`)
        console.log(`   Conversations: ${conversations.length}`)
        console.log(`   Total nodes:   ${totalMessages} (includes branches)`)
        console.log(`\nRun: purmemo-migrate import <file> --platform chatgpt`)
      }
    }
  })

// ── cursor-extract ───────────────────────────────────────────
program
  .command('cursor-extract')
  .description('Extract Cursor chat history directly from the local SQLite database')
  .option('-o, --output <path>', 'Output file path (default: cursor.amp.json)')
  .option('--db <path>', 'Path to state.vscdb (auto-detected if omitted)')
  .option('--markdown', 'Also write a human-readable Markdown file', false)
  .option('--stats', 'Print summary statistics', false)
  .option('--dry-run', 'Parse and validate without writing output', false)
  .action(async (opts: { output?: string; db?: string; markdown: boolean; stats: boolean; dryRun: boolean }) => {
    // Auto-detect DB path
    const candidates = [
      opts.db,
      join(homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
      join(homedir(), '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
      join(process.env['APPDATA'] ?? '', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    ].filter(Boolean) as string[]

    const dbPath = candidates.find((p) => existsSync(p))
    if (!dbPath) {
      console.error('Could not find Cursor database. Install Cursor or specify --db <path>')
      process.exit(1)
    }

    console.log(`📂 Reading Cursor database: ${dbPath}`)

    // Dynamically require sqlite3 (optional peer dep)
    let Database: new (path: string, cb: (err: Error | null) => void) => {
      all: (sql: string, cb: (err: Error | null, rows: {key: string; value: string}[]) => void) => void
      close: () => void
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('better-sqlite3') as { default: typeof Database }
      Database = mod.default ?? mod as unknown as typeof Database
    } catch {
      console.error('Missing dependency: better-sqlite3')
      console.error('Install it: npm install -g better-sqlite3')
      process.exit(1)
    }

    let rows: { key: string; value: string }[]
    try {
      const db = new Database(dbPath, () => {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows = (db as any).prepare('SELECT key, value FROM cursorDiskKV').all() as { key: string; value: string }[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(db as any).close()
    } catch (err) {
      console.error('Failed to read database:', err instanceof Error ? err.message : err)
      process.exit(1)
    }

    const result = convertCursorDBRows(rows)
    const validation = parseAMPExport(result)
    if (!validation.success) {
      console.error('AMP validation failed:', validation.error.format())
      process.exit(1)
    }

    if (opts.stats || opts.dryRun) {
      const totalMessages = result.conversations.reduce((s: number, c: { messages: unknown[] }) => s + c.messages.length, 0)
      console.log(`\n📊 Cursor extraction summary:`)
      console.log(`   Conversations: ${result.conversation_count}`)
      console.log(`   Messages:      ${totalMessages}`)
      console.log(`   AMP version:   ${result.amp_version}`)
    }

    if (opts.dryRun) {
      console.log('\n✅ Dry run complete — no files written.')
      return
    }

    const outJson = opts.output ?? resolve(process.cwd(), 'cursor.amp.json')
    writeFileSync(outJson, JSON.stringify(result, null, 2), 'utf-8')
    console.log(`\n✅ AMP export written to: ${outJson}`)

    if (opts.markdown) {
      const outMd = outJson.replace(/\.amp\.json$/, '.amp.md')
      writeFileSync(outMd, toMarkdown(result), 'utf-8')
      console.log(`📝 Markdown written to:   ${outMd}`)
    }
  })

// ── helpers ──────────────────────────────────────────────────

interface AMPExportType {
  platform: string
  exported_at: string
  conversation_count: number
  conversations: Array<{
    id: string
    title: string
    created_at?: string | null
    messages: Array<{ role: string; content: string; timestamp?: string | null; model?: string | null }>
  }>
}

function toMarkdown(exp: AMPExportType): string {
  const lines: string[] = [
    `# AI Conversation Export`,
    ``,
    `**Platform:** ${exp.platform}`,
    `**Exported:** ${exp.exported_at}`,
    `**Conversations:** ${exp.conversation_count}`,
    `**Format:** AMP (AI Memory Protocol) v0.1`,
    ``,
    `---`,
    ``,
  ]

  for (const convo of exp.conversations) {
    lines.push(`## ${convo.title}`)
    lines.push(``)
    if (convo.created_at) {
      lines.push(`*${new Date(convo.created_at).toLocaleString()}*`)
      lines.push(``)
    }

    for (const msg of convo.messages) {
      const roleLabel = msg.role === 'user' ? '**You**' : `**${capitalize(msg.role)}**`
      const modelNote = msg.model ? ` *(${msg.model})*` : ''
      lines.push(`${roleLabel}${modelNote}`)
      lines.push(``)
      lines.push(msg.content)
      lines.push(``)
    }

    lines.push(`---`)
    lines.push(``)
  }

  return lines.join('\n')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

program.parse()
