# Contributing to AMP — AI Memory Protocol

Thanks for your interest in contributing. AMP is an open specification — community-owned, practically useful, and easy to implement.

## What's Most Needed Right Now

### 1. Platform Converters
The highest-impact contribution. Each converter lives in `packages/converters/src/<platform>.ts` and exports:

```typescript
export function convert<Platform>Export(raw: unknown): AMPExport
```

Platforms shipped: ChatGPT ✅, Claude ✅, Gemini ✅, Cursor ✅

Platforms needed (priority order):
- **Perplexity** — JSON export via Settings → Data Controls
- **GitHub Copilot** — local chat history
- **Mistral Le Chat** — export format TBD

See `packages/converters/src/chatgpt.ts` as the reference implementation.

### 2. Level 3 Spec Design
`spec/AMP-v0.1.md` defers `content_parts[]` (images, code blocks, citations, tool calls) to v0.2. Open an issue with a proposal if you have opinions on the schema.

### 3. MIF Bridge
Bidirectional converter between AMP and [MIF (Memory Interchange Format)](https://github.com/zircote/MIF). Interoperable without dependent.

### 4. Validators in Other Languages
Python, Go, and Rust validators that check AMP compliance.

---

## Getting Started

```bash
# Install pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Clone and install
git clone https://github.com/purmemo-ai/purmemo-amp
cd purmemo-amp
pnpm install
pnpm build

# Test against a real export
node packages/migrate/dist/cli.js import ~/Downloads/conversations.json --platform chatgpt --stats --dry-run
```

## Development

```bash
pnpm --filter @purmemo.ai/converters build   # build one package
pnpm --filter @purmemo.ai/converters dev     # watch mode
pnpm build                                # build all
pnpm test                                 # test all
```

## Adding a New Converter

1. Create `packages/converters/src/<platform>.ts`
2. Export `convert<Platform>Export(raw: unknown): AMPExport`
3. Re-export from `packages/converters/src/index.ts`
4. Add `case '<platform>':` in `packages/migrate/src/cli.ts`
5. Add platform to `AMPPlatform` enum in `packages/schema/src/index.ts` if needed
6. Document export instructions in `spec/AMP-v0.1.md` → Platform Source Formats table
7. Add a test fixture (anonymized real export) to `packages/converters/test/fixtures/`

## Submitting Changes

- Open an issue first for spec changes or new platform converters
- Bug fix PRs welcome without an issue
- One platform converter per PR, one spec change per PR
- Include a test fixture

## Code Rules

- TypeScript strict mode throughout
- Converters must **never throw** on valid platform exports — return `null`/`''` for missing data
- Timestamps must always be nullable — never synthesize a timestamp that doesn't exist in the source
- No runtime deps beyond what's already in the package

## License

By contributing, you agree your contributions are licensed under Apache-2.0.
