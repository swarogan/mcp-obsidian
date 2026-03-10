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

test("prompts/list filtruje prompt markdowni i wyciąga argumenty template", async () => {
  const server = createMcpServer({
    clientFactory: () => ({
      async listVaultFiles(directory) {
        assert.equal(directory, "Prompts");
        return { files: ["plan.md", "not-prompt.md", "ignore.txt"] };
      },
      async getVaultFile(filename, options) {
        assert.deepEqual(options, { format: "json" });

        if (filename === "Prompts/plan.md") {
          return {
            content: '<% tp.mcpTools.prompt("topic", "Temat promptu", true) %>\n<% tp.mcpTools.prompt("language") %>',
            tags: ["mcp-tools-prompt"],
            frontmatter: { description: "Opis promptu" },
          };
        }

        return {
          content: "# zwykła notatka",
          tags: ["inne"],
          frontmatter: {},
        };
      },
    }),
  });

  await bootstrap(server);

  const response = await server.handleMessage({ jsonrpc: "2.0", id: 2, method: "prompts/list", params: {} });

  assert.deepEqual(response.result.prompts, [
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
  let executeTemplateArgs;

  const server = createMcpServer({
    clientFactory: () => ({
      async getVaultFile(filename, options) {
        assert.equal(filename, "Prompts/plan.md");
        assert.deepEqual(options, { format: "json" });

        return {
          content: '<% tp.mcpTools.prompt("topic", true) %>',
          tags: ["mcp-tools-prompt"],
          frontmatter: { description: "Opis promptu" },
        };
      },
      async executeTemplate(args) {
        executeTemplateArgs = args;
        return {
          content: "---\ndescription: x\n---\nWynik zażółć gęślą jaźń",
        };
      },
    }),
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
  assert.equal(response.result.description, "Opis promptu");
  assert.equal(response.result.messages[0].role, "user");
  assert.deepEqual(response.result.messages[0].content, {
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
          tags: ["mcp-tools-prompt"],
          frontmatter: {},
        };
      },
      async executeTemplate() {
        throw new Error("to nie powinno się wykonać");
      },
    }),
  });

  await bootstrap(server);

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "prompts/get",
    params: { name: "plan.md", arguments: {} },
  });

  assert.equal(response.error.code, -32602);
  assert.match(response.error.message, /topic/i);
});