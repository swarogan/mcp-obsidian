import test from "node:test";
import assert from "node:assert/strict";

import { createMcpServer } from "../src/mcp-server.js";
import type { McpServer, JsonRpcResponse } from "../src/types.js";
import type { ObsidianRestClient } from "../src/lib/obsidian/client.js";

async function bootstrap(server: McpServer): Promise<void> {
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
  });
  await server.handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" });
}

function result(response: JsonRpcResponse | null): Record<string, unknown> {
  return response!.result as Record<string, unknown>;
}

function error(response: JsonRpcResponse | null): { code: number; message: string } {
  return response!.error as { code: number; message: string };
}

test("initialize negocjuje wersję i zwraca capabilities tools", async () => {
  const server = createMcpServer({ clientFactory: () => ({}) as unknown as ObsidianRestClient });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "tester", version: "1.0.0" } },
  });

  const r = result(response);
  assert.equal(r.protocolVersion, "2025-06-18");
  assert.deepEqual(r.capabilities, { tools: {}, prompts: { listChanged: false } });
  assert.equal((r.serverInfo as { name: string }).name, "obsidian-mcp-rest");
});

test("tools/list zwraca podstawowe narzędzia", async () => {
  const server = createMcpServer({ clientFactory: () => ({}) as unknown as ObsidianRestClient });
  await bootstrap(server);

  const response = await server.handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const names = (result(response).tools as Array<{ name: string }>).map((tool) => tool.name);

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
  let calledWith: unknown;
  const server = createMcpServer({
    clientFactory: () => ({
      async getVaultFile(filename: string, options: unknown) {
        calledWith = { filename, options };
        return "zażółć gęślą jaźń";
      },
    }) as unknown as ObsidianRestClient,
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
  const r = result(response);
  assert.equal((r.content as Array<{ text: string }>)[0].text, "zażółć gęślą jaźń");
  assert.equal((r.structuredContent as { filename: string }).filename, "folder/notatka.md");
});

test("tools/call zwraca błąd protokołu dla złych argumentów", async () => {
  const server = createMcpServer({ clientFactory: () => ({}) as unknown as ObsidianRestClient });
  await bootstrap(server);

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "create_vault_file", arguments: { filename: "plik.md" } },
  });

  const e = error(response);
  assert.equal(e.code, -32602);
  assert.match(e.message, /content/i);
});

test("błąd wykonania narzędzia jest zwracany jako isError", async () => {
  const server = createMcpServer({
    clientFactory: () => ({
      async updateActiveFile() {
        throw new Error("Brak aktywnego pliku");
      },
    }) as unknown as ObsidianRestClient,
  });
  await bootstrap(server);

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "update_active_file", arguments: { content: "test" } },
  });

  const r = result(response);
  assert.equal(r.isError, true);
  assert.match((r.content as Array<{ text: string }>)[0].text, /brak aktywnego pliku/i);
});

test("tools/call dla fetch używa wstrzykniętego fetchImpl", async () => {
  const server = createMcpServer({
    clientFactory: () => ({}) as unknown as ObsidianRestClient,
    fetchImpl: (async () =>
      new Response("<html><body><h1>Tytuł</h1><p>zażółć gęślą jaźń</p></body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as typeof globalThis.fetch,
  });
  await bootstrap(server);

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "fetch", arguments: { url: "https://example.com" } },
  });

  const r = result(response);
  assert.match((r.content as Array<{ text: string }>)[0].text, /example\.com/i);
  assert.match((r.content as Array<{ text: string }>)[0].text, /zażółć gęślą jaźń/i);
  assert.equal((r.structuredContent as { url: string }).url, "https://example.com");
});

test("execute_template wymaga targetPath gdy createFile=true", async () => {
  const server = createMcpServer({ clientFactory: () => ({}) as unknown as ObsidianRestClient });
  await bootstrap(server);

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "execute_template", arguments: { name: "Templates/x.md", createFile: true } },
  });

  const e = error(response);
  assert.equal(e.code, -32602);
  assert.match(e.message, /targetPath/i);
});
