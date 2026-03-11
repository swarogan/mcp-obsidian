# mcp-obsidian

A lightweight MCP (Model Context Protocol) server for Obsidian, built as a thin wrapper over the Obsidian REST API.

Also available as an **Obsidian plugin** with settings UI, auto-detection of [obsidian-api](https://github.com/vigeron/obsidian-api), and one-click MCP server installation.

Zero npm dependencies. Node.js built-ins only.

## Features

- **18 MCP tools** — full vault CRUD, search, templates, active file operations
- **MCP prompts** — auto-discovery of prompt templates from vault
- **Obsidian plugin** — settings tab with auto-detect, install, and copyable config
- **Zero dependencies** — uses only Node.js built-in modules
- **UTF-8 correct** — all markdown operations preserve Unicode properly
- **PATCH v3** — heading/block/frontmatter targeting + `search-replace` for precise text substitution
- **Web fetch** — built-in HTML to Markdown conversion

## Requirements

- Node.js >= 20
- [obsidian-api](https://github.com/vigeron/obsidian-api) plugin (or obsidian-local-rest-api)
- API key configured in the plugin settings
- Optionally: Smart Connections plugin (for `search_vault_smart`)
- Optionally: Templater plugin (for `execute_template` and prompts)

## Installation

### As MCP server

```bash
npx -y mcp-obsidian
```

### As Obsidian plugin

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/vigeron/mcp-obsidian/releases/latest)
2. Create `<vault>/.obsidian/plugins/mcp-obsidian/` and place the files there
3. Enable the plugin in Obsidian settings
4. The plugin auto-detects obsidian-api settings and provides a copyable MCP config

## Configuration

Set environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OBSIDIAN_API_KEY` | Yes | — | Bearer token from plugin settings |
| `OBSIDIAN_REST_URL` | No | `https://127.0.0.1:27124` | Obsidian REST API URL |
| `OBSIDIAN_REQUEST_TIMEOUT_MS` | No | `30000` | Request timeout in ms |

## MCP Client Configuration

### Claude Code

```bash
claude mcp add obsidian -e OBSIDIAN_API_KEY="your-api-key" -- npx -y mcp-obsidian
```

### Claude Desktop / other MCP clients

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "mcp-obsidian"],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key",
        "OBSIDIAN_REST_URL": "https://127.0.0.1:27124"
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
- `patch_active_file` — patch heading/block/frontmatter or search-replace text
- `delete_active_file` — delete current file
- `show_file_in_obsidian` — open file in Obsidian UI

### Vault Files
- `list_vault_files` — list directory contents
- `get_vault_file` — read file by path
- `create_vault_file` — create or overwrite file
- `append_to_vault_file` — append to file
- `patch_vault_file` — patch heading/block/frontmatter or search-replace text
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

28 tests covering tools, prompts, client, UTF-8, PATCH operations, and stdio transport.

## Network Usage

This MCP server communicates **only** with the local Obsidian REST API (default `127.0.0.1:27124`). It does not connect to any external services.

The `fetch` tool makes outbound HTTP requests only when explicitly invoked by the user.

## Support

If this project is useful to you and you'd like to support further development, you can do so on Ko-fi.

<a href='https://ko-fi.com/O4O11VQFK1' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

## License

[MIT](LICENSE)
