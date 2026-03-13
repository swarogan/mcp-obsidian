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

test("prompts/list filtruje prompt markdowni i wyciąga argumenty template", async () => {
  const server = createMcpServer({
    clientFactory: () => ({
      async listVaultFiles(directory: string) {
        assert.equal(directory, "Prompts");
        return { files: ["plan.md", "not-prompt.md", "ignore.txt"] };
      },
      async getVaultFile(filename: string, options: unknown) {
        assert.deepEqual(options, { format: "json" });

        if (filename === "Prompts/plan.md") {
          return {
            content: '<% tp.mcpTools.prompt("topic", "Temat promptu", true) %>\n<% tp.mcpTools.prompt("language") %>',
            tags: ["obsidian-mcp-rest-prompt"],
            frontmatter: { description: "Opis promptu" },
          };
        }

        return {
          content: "# zwykła notatka",
          tags: ["inne"],
          frontmatter: {},
        };
      },
    }) as unknown as ObsidianRestClient,
  });

  await bootstrap(server);

  const response = await server.handleMessage({ jsonrpc: "2.0", id: 2, method: "prompts/list", params: {} });

  assert.deepEqual(result(response).prompts, [
    {
      name: "plan.md",
      description: "Opis promptu",
      arguments: [
        { name: "topic", description: "Temat promptu", required: true },
        { name: "language" },
      ],
    },
  ]);
});

test("prompts/get wykonuje template i usuwa frontmatter z wyniku", async () => {
  let executeTemplateArgs: unknown;

  const server = createMcpServer({
    clientFactory: () => ({
      async getVaultFile(filename: string, options: unknown) {
        assert.equal(filename, "Prompts/plan.md");
        assert.deepEqual(options, { format: "json" });

        return {
          content: '<% tp.mcpTools.prompt("topic", true) %>',
          tags: ["obsidian-mcp-rest-prompt"],
          frontmatter: { description: "Opis promptu" },
        };
      },
      async executeTemplate(args: unknown) {
        executeTemplateArgs = args;
        return {
          content: "---\ndescription: x\n---\nWynik zażółć gęślą jaźń",
        };
      },
    }) as unknown as ObsidianRestClient,
  });

  await bootstrap(server);

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "prompts/get",
    params: { name: "plan.md", arguments: { topic: "Unicode" } },
  });

  assert.deepEqual(executeTemplateArgs, {
    name: "Prompts/plan.md",
    arguments: { topic: "Unicode" },
  });
  const r = result(response);
  assert.equal(r.description, "Opis promptu");
  const messages = r.messages as Array<{ role: string; content: { type: string; text: string } }>;
  assert.equal(messages[0].role, "user");
  assert.deepEqual(messages[0].content, {
    type: "text",
    text: "Wynik zażółć gęślą jaźń",
  });
});

test("prompts/get zwraca Invalid params dla brakującego wymaganego argumentu", async () => {
  const server = createMcpServer({
    clientFactory: () => ({
      async getVaultFile() {
        return {
          content: '<% tp.mcpTools.prompt("topic", "Temat", true) %>',
          tags: ["obsidian-mcp-rest-prompt"],
          frontmatter: {},
        };
      },
      async executeTemplate() {
        throw new Error("to nie powinno się wykonać");
      },
    }) as unknown as ObsidianRestClient,
  });

  await bootstrap(server);

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "prompts/get",
    params: { name: "plan.md", arguments: {} },
  });

  const e = error(response);
  assert.equal(e.code, -32602);
  assert.match(e.message, /topic/i);
});
