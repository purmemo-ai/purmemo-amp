# @purmemo.ai/migrate

CLI tool to migrate AI conversations into the open **AMP (AI Memory Protocol)** format.

## Quick Start

No install required:

```bash
npx @purmemo.ai/migrate import conversations.json
```

## Install

```bash
npm install -g @purmemo.ai/migrate
```

## Commands

### `import <file>`

Convert a platform export to AMP format.

```bash
# ChatGPT export → AMP JSON
purmemo-migrate import conversations.json

# Also write a human-readable Markdown file
purmemo-migrate import conversations.json --markdown

# Preview without writing files
purmemo-migrate import conversations.json --dry-run --stats

# Specify output path
purmemo-migrate import conversations.json -o ~/my-conversations.amp.json
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `-p, --platform` | `chatgpt` | Source platform: `chatgpt` |
| `-o, --output` | `<file>.amp.json` | Output file path |
| `--markdown` | false | Also write `.amp.md` |
| `--dry-run` | false | Parse and validate, no output |
| `--stats` | false | Print conversion summary |

### `validate <file>`

Validate an AMP JSON file against the v0.1 schema.

```bash
purmemo-migrate validate export.amp.json
```

### `info <file>`

Show statistics about a platform export or AMP file.

```bash
purmemo-migrate info conversations.json
purmemo-migrate info export.amp.json
```

## Platform Support

<!-- PLATFORMS:cli -->
| Platform | How to export | CLI command |
|----------|---------------|-------------|
| ChatGPT | Settings → Data Controls → Export Data | `npx @purmemo.ai/migrate import conversations.json` |
| Claude | Settings → Export Data | `npx @purmemo.ai/migrate import conversations.json` |
| Gemini | Google Takeout (converter ready — awaiting Google chat export support) | `npx @purmemo.ai/migrate import <file>` |
| Cursor | Auto-extracted from local SQLite DB | `npx @purmemo.ai/migrate cursor-extract` |
| Perplexity | Settings → Data Controls → Download My Data | `npx @purmemo.ai/migrate import conversations JSON in ZIP` |
| Grok | accounts.x.ai → Download account data | `npx @purmemo.ai/migrate import prod-grok-backend.json` |
| Mistral Le Chat | Settings → Export | `npx @purmemo.ai/migrate import <file>` |
| GitHub Copilot Chat | VS Code: Command Palette → "Chat: Export Chat..." | `npx @purmemo.ai/migrate import <file>` |
<!-- /PLATFORMS -->

## How to Export from ChatGPT

1. Go to **Settings → Data Controls → Export Data**
2. Request your export and wait for the email
3. Download and unzip
4. Run: `npx @purmemo.ai/migrate import conversations.json`

## Community

- [Discord](https://discord.gg/QWgm9qw4b2) — get help, share feedback, discuss converters
- [GitHub Issues](https://github.com/purmemo-ai/purmemo-amp/issues) — bug reports and feature requests

## Links

- [AMP Spec](https://github.com/purmemo-ai/purmemo-amp/blob/main/spec/AMP-v0.1.md)
- [GitHub](https://github.com/purmemo-ai/purmemo-amp)
- [npm org](https://www.npmjs.com/org/purmemo.ai)

Apache 2.0 — by [pūrmemo](https://purmemo.ai)
