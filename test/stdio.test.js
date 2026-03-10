import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";

import { startStdioServer } from "../src/runtime/stdio.js";

function createCapturedStream() {
  const stream = new PassThrough();
  stream.setEncoding("utf8");

  let text = "";
  stream.on("data", (chunk) => {
    text += chunk;
  });

  return {
    stream,
    getText: () => text,
    getMessages: () => text.split("\n").filter(Boolean).map((line) => JSON.parse(line)),
  };
}

async function waitFor(predicate, timeoutMs = 250) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = predicate();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error("Timeout oczekiwania na wynik testu.");
}

test("startStdioServer buforuje fragmenty wejścia i obsługuje CRLF", async () => {
  const input = new PassThrough();
  const output = createCapturedStream();
  const errorOutput = createCapturedStream();
  const received = [];

  startStdioServer(
    {
      async handleMessage(message) {
        received.push(message);
        return { jsonrpc: "2.0", id: message.id, result: { ok: true } };
      },
    },
    { input, output: output.stream, errorOutput: errorOutput.stream },
  );

  input.write('{"jsonrpc":"2.0","id":1,"method":"ping"}\r');
  input.write("\n\n");

  await waitFor(() => output.getMessages().length === 1);

  assert.deepEqual(received, [{ jsonrpc: "2.0", id: 1, method: "ping" }]);
  assert.deepEqual(output.getMessages(), [{ jsonrpc: "2.0", id: 1, result: { ok: true } }]);
  assert.equal(errorOutput.getText(), "");
});

test("startStdioServer zwraca parse error i internal error dla błędnych linii", async () => {
  const input = new PassThrough();
  const output = createCapturedStream();
  const errorOutput = createCapturedStream();

  startStdioServer(
    {
      async handleMessage(message) {
        if (message.method === "explode") {
          throw new Error("boom");
        }
        return null;
      },
    },
    { input, output: output.stream, errorOutput: errorOutput.stream },
  );

  input.write("to nie jest json\n");
  input.write('{"jsonrpc":"2.0","id":7,"method":"explode"}\n');

  await waitFor(() => output.getMessages().length === 2);
  await waitFor(() => errorOutput.getText().includes("boom"));

  const [parseError, internalError] = output.getMessages();
  assert.equal(parseError.error.code, -32700);
  assert.equal(internalError.error.code, -32603);
  assert.equal(internalError.id, 7);
  assert.match(errorOutput.getText(), /\[mcp-obsidian\].*boom/s);
});

test("startStdioServer loguje końcowe dane bez znaku nowej linii", async () => {
  const input = new PassThrough();
  const output = createCapturedStream();
  const errorOutput = createCapturedStream();

  startStdioServer(
    {
      async handleMessage() {
        throw new Error("to nie powinno się wykonać");
      },
    },
    { input, output: output.stream, errorOutput: errorOutput.stream },
  );

  input.write('{"jsonrpc":"2.0","id":1');
  input.end();

  await waitFor(() => errorOutput.getText().includes("Pominięto końcowe dane bez znaku nowej linii"));

  assert.equal(output.getText(), "");
});
