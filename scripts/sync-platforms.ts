#!/usr/bin/env tsx
/**
 * sync-platforms.ts
 *
 * Reads platforms.json and rewrites the platform table in every README
 * that contains a <!-- PLATFORMS:table-name --> ... <!-- /PLATFORMS --> marker.
 *
 * Available table names:
 *   support      — full table: Platform | Status | Since | How to export
 *   converters   — converter table: Platform | Converter | Export Path
 *   cli          — CLI table: Platform | How to export | CLI command
 *   schema       — comma-separated platform IDs for schema README
 *
 * Usage:
 *   pnpm sync-platforms
 *   npx tsx scripts/sync-platforms.ts
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

interface Platform {
  id: string
  name: string
  status: string
  since: string | null
  converter: string | null
  export_path: string
  export_file: string | null
  notes: string
}

const platforms: Platform[] = JSON.parse(
  readFileSync(join(ROOT, 'platforms.json'), 'utf-8')
)

const shipped = platforms.filter((p) => p.status === '✅')
const coming  = platforms.filter((p) => p.status !== '✅')

// ============================================================
// Table renderers
// ============================================================

function renderSupport(): string {
  const header = [
    '| Platform | Status | Since | How to export |',
    '|----------|--------|-------|---------------|',
  ]
  const rows = platforms.map((p) =>
    `| ${p.name} | ${p.status} ${p.since ?? ''} | ${p.since ?? '—'} | ${p.export_path} |`
  )
  return [...header, ...rows].join('\n')
}

function renderConverters(): string {
  const header = [
    '| Platform | Converter | Export Path |',
    '|----------|-----------|-------------|',
  ]
  const rows = shipped.map((p) =>
    `| ${p.name} | \`${p.converter}\` | ${p.export_path} |`
  )
  const comingRows = coming.map((p) =>
    `| ${p.name} | 🔜 coming | ${p.export_path} |`
  )
  return [...header, ...rows, ...comingRows].join('\n')
}

function renderCLI(): string {
  const header = [
    '| Platform | How to export | CLI command |',
    '|----------|---------------|-------------|',
  ]
  const rows = shipped.map((p) => {
    const cmd = p.id === 'cursor'
      ? '`npx @purmemo.ai/migrate cursor-extract`'
      : `\`npx @purmemo.ai/migrate import ${p.export_file ?? '<file>'}\``
    return `| ${p.name} | ${p.export_path} | ${cmd} |`
  })
  return [...header, ...rows].join('\n')
}

function renderSchema(): string {
  return '`' + shipped.map((p) => p.id).join('` | `') + '`'
}

const RENDERERS: Record<string, () => string> = {
  support:    renderSupport,
  converters: renderConverters,
  cli:        renderCLI,
  schema:     renderSchema,
}

// ============================================================
// README rewriter
// ============================================================

function syncFile(filePath: string): boolean {
  let content = readFileSync(filePath, 'utf-8')
  let changed = false

  for (const [name, render] of Object.entries(RENDERERS)) {
    const open  = `<!-- PLATFORMS:${name} -->`
    const close = `<!-- /PLATFORMS -->`
    const start = content.indexOf(open)
    const end   = content.indexOf(close, start)

    if (start === -1 || end === -1) continue

    const generated = render()
    const replacement = `${open}\n${generated}\n${close}`
    const current = content.slice(start, end + close.length)

    if (current !== replacement) {
      content = content.slice(0, start) + replacement + content.slice(end + close.length)
      changed = true
    }
  }

  if (changed) {
    writeFileSync(filePath, content, 'utf-8')
  }

  return changed
}

// ============================================================
// Find all READMEs in the repo
// ============================================================

function findReadmes(dir: string, results: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      findReadmes(full, results)
    } else if (entry.toLowerCase() === 'readme.md') {
      results.push(full)
    }
  }
  return results
}

// ============================================================
// Main
// ============================================================

const readmes = findReadmes(ROOT)
let totalChanged = 0

for (const readme of readmes) {
  const rel = readme.replace(ROOT + '/', '')
  const changed = syncFile(readme)
  if (changed) {
    console.log(`✅ Updated: ${rel}`)
    totalChanged++
  } else {
    console.log(`   No change: ${rel}`)
  }
}

if (totalChanged === 0) {
  console.log('\nAll platform tables are up to date.')
} else {
  console.log(`\n${totalChanged} file(s) updated.`)
}
