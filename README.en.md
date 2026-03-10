# mcp-obsidian

A lightweight MCP (Model Context Protocol) server for Obsidian, built as a thin wrapper over the Obsidian REST API.

Zero npm dependencies. Node.js built-ins only.

## Features

- **18 MCP tools** — full vault CRUD, search, templates, active file operations
- **MCP prompts** — auto-discovery of prompt templates from vault
- **Zero dependencies** — uses only Node.js built-in modules
- **UTF-8 correct** — all markdown operations preserve Unicode properly
- **PATCH v3** — proper header-based patch with heading/block/frontmatter targeting
- **Web fetch** — built-in HTML to Markdown conversion

## Requirements

- Node.js >= 20
- [obsidian-api](https://github.com/vigeron/obsidian-api) plugin (or obsidian-local-rest-api)
- API key configured in the plugin settings
- Optionally: Smart Connections plugin (for `search_vault_smart`)
- Optionally: Templater plugin (for `execute_template` and prompts)

## Installation

```bash
npx mcp-obsidian
```

Or clone and run directly:

```bash
git clone https://github.com/vigeron/mcp-obsidian.git
cd mcp-obsidian
node src/index.js
```

## Configuration

Set environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OBSIDIAN_API_KEY` | Yes | — | Bearer token from plugin settings |
| `OBSIDIAN_REST_URL` | No | `http://127.0.0.1:27124` | Obsidian REST API URL |
| `OBSIDIAN_REQUEST_TIMEOUT_MS` | No | `30000` | Request timeout in ms |

## MCP Client Configuration

Add to your MCP client config (e.g. Claude Code):

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/path/to/mcp-obsidian/src/index.js"],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key",
        "OBSIDIAN_REST_URL": "http://127.0.0.1:27124"
      }
    }
  }
}
```

## Available MCP Tools

### Server
- `get_server_info` — API status (no auth required)

### Active File
- `get_active_file` — read current file (markdown or JSON)
- `update_active_file` — replace entire content
- `append_to_active_file` — append content
- `patch_active_file` — patch heading/block/frontmatter
- `delete_active_file` — delete current file
- `show_file_in_obsidian` — open file in Obsidian UI

### Vault Files
- `list_vault_files` — list directory contents
- `get_vault_file` — read file by path
- `create_vault_file` — create or overwrite file
- `append_to_vault_file` — append to file
- `patch_vault_file` — patch heading/block/frontmatter
- `delete_vault_file` — delete file

### Search
- `search_vault` — Dataview DQL or JsonLogic queries
- `search_vault_simple` — full-text search with context
- `search_vault_smart` — semantic search (requires Smart Connections)

### Other
- `execute_template` — run Templater templates with arguments
- `fetch` — download web content, convert HTML to markdown

## MCP Prompts

The server supports MCP `prompts` capability:

- Auto-discovers `.md` files in `Prompts/` directory with `mcp-tools-prompt` tag
- Parses `tp.mcpTools.prompt(...)` calls for argument definitions
- Executes templates via Templater plugin
- Strips frontmatter from output

## Tests

```bash
npm test
```

27 tests covering tools, prompts, client, UTF-8, PATCH headers, and stdio transport.

## Network Usage

This MCP server communicates **only** with the local Obsidian REST API (default `127.0.0.1:27124`). It does not connect to any external services.

The `fetch` tool makes outbound HTTP requests only when explicitly invoked by the user.

## License

[MIT](LICENSE)
