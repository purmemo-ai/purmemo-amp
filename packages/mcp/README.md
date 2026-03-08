# @purmemo.ai/mcp

Reference MCP server for **AMP (AI Memory Protocol)** — expose your AI conversation memories via the Model Context Protocol.

> **Status:** v0.1.0 scaffold. Full implementation coming in v0.2. Contributions welcome.

## What This Will Do

This package will provide an MCP server that:

- Exposes AMP conversation data as MCP resources
- Enables AI tools (Claude, Cursor, etc.) to recall your conversation history
- Bridges AMP exports into any MCP-compatible client

## Install

```bash
npm install @purmemo.ai/mcp
```

## Roadmap

- [ ] MCP server with AMP file as data source
- [ ] `list_conversations` tool
- [ ] `search_conversations` tool
- [ ] `get_conversation` tool
- [ ] stdio + HTTP transport support

## Contributing

See [CONTRIBUTING.md](https://github.com/purmemo-ai/purmemo-amp/blob/main/CONTRIBUTING.md) for how to add converters and server features.

## Community

- [Discord](https://discord.gg/QWgm9qw4b2) — get help, share feedback, contribute to the MCP server
- [GitHub Issues](https://github.com/purmemo-ai/purmemo-amp/issues) — bug reports and feature requests

## Links

- [AMP Spec](https://github.com/purmemo-ai/purmemo-amp/blob/main/spec/AMP-v0.1.md)
- [GitHub](https://github.com/purmemo-ai/purmemo-amp)
- [npm org](https://www.npmjs.com/org/purmemo.ai)

Apache 2.0 — by [pūrmemo](https://purmemo.ai)
