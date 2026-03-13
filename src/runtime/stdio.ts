import type { McpServer, JsonRpcResponse } from "../types.js";

interface StdioOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  errorOutput?: NodeJS.WritableStream;
}

export function startStdioServer(server: McpServer, { input = process.stdin, output = process.stdout, errorOutput = process.stderr }: StdioOptions = {}): void {
  let buffer = "";
  let queue = Promise.resolve();

  function writeMessage(message: JsonRpcResponse): void {
    (output as NodeJS.WritableStream).write(`${JSON.stringify(message)}\n`);
  }

  async function handleLine(line: string): Promise<void> {
    let message: unknown;

    try {
      message = JSON.parse(line);
    } catch {
      writeMessage({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      });
      return;
    }

    try {
      const response = await server.handleMessage(message);
      if (response) {
        writeMessage(response);
      }
    } catch (error) {
      const text = error instanceof Error ? error.stack ?? error.message : String(error);
      (errorOutput as NodeJS.WritableStream).write(`[obsidian-mcp-rest] ${text}\n`);

      if (message && typeof message === "object" && Object.hasOwn(message as object, "id")) {
        writeMessage({
          jsonrpc: "2.0",
          id: (message as { id: number | string | null }).id,
          error: { code: -32603, message: "Internal error" },
        });
      }
    }
  }

  function flushBuffer(): void {
    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);

      if (line !== "") {
        queue = queue.then(() => handleLine(line));
      }

      newlineIndex = buffer.indexOf("\n");
    }
  }

  (input as NodeJS.ReadableStream & { setEncoding(encoding: string): void }).setEncoding("utf8");
  input.on("data", (chunk: string) => {
    buffer += chunk;
    flushBuffer();
  });

  input.on("end", () => {
    if (buffer.trim() !== "") {
      (errorOutput as NodeJS.WritableStream).write("[obsidian-mcp-rest] Pominięto końcowe dane bez znaku nowej linii.\n");
    }
  });

  (input as NodeJS.ReadableStream & { resume(): void }).resume();
}
