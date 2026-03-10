import test from "node:test";
import assert from "node:assert/strict";

import { createMcpServer } from "../src/mcp-server.js";

async function bootstrap(server) {
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
  });
  await server.handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" });
}

test("initialize negocjuje wersję i zwraca capabilities tools", async () => {
  const server = createMcpServer({ clientFactory: () => ({}) });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "tester", version: "1.0.0" } },
  });

  assert.equal(response.result.protocolVersion, "2025-06-18");
  assert.deepEqual(response.result.capabilities, { tools: {}, prompts: { listChanged: false } });
  assert.equal(response.result.serverInfo.name, "mcp-obsidian");
});

test("tools/list zwraca podstawowe narzędzia", async () => {
  const server = createMcpServer({ clientFactory: () => ({}) });
  await bootstrap(server);

  const response = await server.handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const names = response.result.tools.map((tool) => tool.name);

  assert.deepEqual(names, [
    "fetch",
    "get_server_info",
    "get_active_file",
    "update_active_file",
    "append_to_active_file",
    "patch_active_file",
    "delete_active_file",
    "show_file_in_obsidian",
    "search_vault",
    "search_vault_simple",
    "list_vault_files",
    "get_vault_file",
    "create_vault_file",
    "append_to_vault_file",
    "patch_vault_file",
    "delete_vault_file",
    "search_vault_smart",
    "execute_template",
  ]);
});

test("tools/call deleguje do klienta i zwraca structuredContent", async () => {
  let calledWith;
  const server = createMcpServer({
    clientFactory: () => ({
      async getVaultFile(filename, options) {
        calledWith = { filename, options };
        return "zażółć gęślą jaźń";
      },
    }),
  });
  await bootstrap(server);

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "get_vault_file", arguments: { filename: "folder/notatka.md" } },
  });

  assert.deepEqual(calledWith, {
    filename: "folder/notatka.md",
    options: { filename: "folder/notatka.md", format: "markdown" },
  });
  assert.equal(response.result.content[0].text, "zażółć gęślą jaźń");
  assert.equal(response.result.structuredContent.filename, "folder/notatka.md");
});

test("tools/call zwraca błąd protokołu dla złych argumentów", async () => {
  const server = createMcpServer({ clientFactory: () => ({}) });
  await bootstrap(server);

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "create_vault_file", arguments: { filename: "plik.md" } },
  });

  assert.equal(response.error.code, -32602);
  assert.match(response.error.message, /content/i);
});

test("błąd wykonania narzędzia jest zwracany jako isError", async () => {
  const server = createMcpServer({
    clientFactory: () => ({
      async updateActiveFile() {
        throw new Error("Brak aktywnego pliku");
      },
    }),
  });
  await bootstrap(server);

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "update_active_file", arguments: { content: "test" } },
  });

  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /brak aktywnego pliku/i);
});

test("tools/call dla fetch używa wstrzykniętego fetchImpl", async () => {
  const server = createMcpServer({
    clientFactory: () => ({}),
    fetchImpl: async () =>
      new Response("<html><body><h1>Tytuł</h1><p>zażółć gęślą jaźń</p></body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
  });
  await bootstrap(server);

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "fetch", arguments: { url: "https://example.com" } },
  });

  assert.match(response.result.content[0].text, /example\.com/i);
  assert.match(response.result.content[0].text, /zażółć gęślą jaźń/i);
  assert.equal(response.result.structuredContent.url, "https://example.com");
});

test("execute_template wymaga targetPath gdy createFile=true", async () => {
  const server = createMcpServer({ clientFactory: () => ({}) });
  await bootstrap(server);

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "execute_template", arguments: { name: "Templates/x.md", createFile: true } },
  });

  assert.equal(response.error.code, -32602);
  assert.match(response.error.message, /targetPath/i);
});