export function startStdioServer(server, { input = process.stdin, output = process.stdout, errorOutput = process.stderr } = {}) {
  let buffer = "";
  let queue = Promise.resolve();

  function writeMessage(message) {
    output.write(`${JSON.stringify(message)}\n`);
  }

  async function handleLine(line) {
    let message;

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
      errorOutput.write(`[mcp-obsidian] ${text}\n`);

      if (message && Object.hasOwn(message, "id")) {
        writeMessage({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32603, message: "Internal error" },
        });
      }
    }
  }

  function flushBuffer() {
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

  input.setEncoding("utf8");
  input.on("data", (chunk) => {
    buffer += chunk;
    flushBuffer();
  });

  input.on("end", () => {
    if (buffer.trim() !== "") {
      errorOutput.write("[mcp-obsidian] Pominięto końcowe dane bez znaku nowej linii.\n");
    }
  });

  input.resume();
}