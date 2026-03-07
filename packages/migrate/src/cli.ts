#!/usr/bin/env node
import { Command } from 'commander'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, basename, extname } from 'path'
import { convertChatGPTExport } from '@purmemo.ai/converters'
import { parseAMPExport } from '@purmemo.ai/schema'

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

    // Convert
    let ampExport: ReturnType<typeof convertChatGPTExport>
    try {
      switch (opts.platform) {
        case 'chatgpt':
          ampExport = convertChatGPTExport(raw)
          break
        default:
          console.error(`Platform "${opts.platform}" is not yet supported.`)
          console.error('Supported platforms: chatgpt')
          console.error('Claude, Gemini, and Cursor converters coming soon.')
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

    // Raw ChatGPT export
    if (Array.isArray(raw)) {
      const conversations = raw as Array<{ title?: string; mapping?: object }>
      const totalMessages = conversations.reduce(
        (s, c) => s + (c.mapping ? Object.keys(c.mapping).length : 0),
        0
      )
      console.log(`\n📦 Raw export (detected: chatgpt)`)
      console.log(`   Conversations: ${conversations.length}`)
      console.log(`   Total nodes:   ${totalMessages} (includes branches)`)
      console.log(`\nRun: purmemo-migrate import <file> --platform chatgpt`)
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
