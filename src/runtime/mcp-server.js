import { ObsidianApiError, createClientFromEnv } from "../lib/obsidian/index.js";
import { PromptArgumentError, createPromptRegistry } from "../features/prompts/index.js";
import { ToolArgumentError, createToolRegistry } from "../features/tools/index.js";

const SERVER_INFO = {
  name: "mcp-obsidian",
  title: "MCP Obsidian",
  version: "0.2.0",
};

const LATEST_PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, "2025-03-26"];

function makeResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function makeError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasRequestId(message) {
  return Object.hasOwn(message, "id");
}

function negotiateProtocolVersion(requestedVersion) {
  if (SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)) {
    return requestedVersion;
  }
  return LATEST_PROTOCOL_VERSION;
}

function formatExecutionError(error, fallbackMessage) {
  if (error instanceof ObsidianApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackMessage;
}

export function createMcpServer({ clientFactory = () => createClientFromEnv(), fetchImpl = globalThis.fetch } = {}) {
  let initialized = false;
  let clientPromise;

  const getClient = async () => {
    clientPromise ??= Promise.resolve().then(() => clientFactory());
    return clientPromise;
  };

  const toolRegistry = createToolRegistry({ getClient, fetchImpl });
  const promptRegistry = createPromptRegistry({ getClient });
  const toolDefinitions = [...toolRegistry.values()].map(({ execute, validate, ...tool }) => tool);

  return {
    async handleMessage(message) {
      if (!isObject(message)) {
        return makeError(null, -32600, "Invalid Request");
      }

      if (message.jsonrpc !== "2.0") {
        return hasRequestId(message) ? makeError(message.id, -32600, "Invalid Request") : null;
      }

      if (typeof message.method !== "string") {
        return null;
      }

      if (message.method === "notifications/initialized") {
        initialized = true;
        return null;
      }

      if (message.method === "initialize") {
        const params = isObject(message.params) ? message.params : {};
        const protocolVersion = negotiateProtocolVersion(params.protocolVersion);

        return makeResult(message.id, {
          protocolVersion,
          capabilities: {
            tools: {},
            prompts: { listChanged: false },
          },
          serverInfo: SERVER_INFO,
          instructions:
            "Ustaw OBSIDIAN_API_KEY oraz opcjonalnie OBSIDIAN_REST_URL. Serwer udostępnia narzędzia Obsidian Local REST API, prompt templates z katalogu Prompts oraz lekki fetch WWW.",
        });
      }

      if (message.method === "ping") {
        return hasRequestId(message) ? makeResult(message.id, {}) : null;
      }

      if (!initialized) {
        return hasRequestId(message) ? makeError(message.id, -32002, "Server not initialized") : null;
      }

      if (message.method === "tools/list") {
        return makeResult(message.id, { tools: toolDefinitions });
      }

      if (message.method === "tools/call") {
        const params = isObject(message.params) ? message.params : null;
        if (!params || typeof params.name !== "string") {
          return makeError(message.id, -32602, "Nieprawidłowe params dla tools/call.");
        }

        const tool = toolRegistry.get(params.name);
        if (!tool) {
          return makeError(message.id, -32602, `Unknown tool: ${params.name}`);
        }

        let validatedArguments;
        try {
          validatedArguments = tool.validate(params.arguments);
        } catch (error) {
          if (error instanceof ToolArgumentError) {
            return makeError(message.id, -32602, error.message);
          }
          throw error;
        }

        try {
          return makeResult(message.id, await tool.execute(validatedArguments));
        } catch (error) {
          return makeResult(message.id, {
            content: [{ type: "text", text: formatExecutionError(error, "Wystąpił błąd podczas wykonywania narzędzia.") }],
            isError: true,
          });
        }
      }

      if (message.method === "prompts/list") {
        try {
          const prompts = await promptRegistry.listPrompts();
          return makeResult(message.id, { prompts });
        } catch (error) {
          return makeError(message.id, -32603, formatExecutionError(error, "Nie udało się pobrać listy promptów."));
        }
      }

      if (message.method === "prompts/get") {
        const params = isObject(message.params) ? message.params : null;
        if (!params || typeof params.name !== "string") {
          return makeError(message.id, -32602, "Nieprawidłowe params dla prompts/get.");
        }

        try {
          return makeResult(message.id, await promptRegistry.getPrompt(params));
        } catch (error) {
          if (error instanceof PromptArgumentError) {
            return makeError(message.id, -32602, error.message);
          }
          return makeError(message.id, -32603, formatExecutionError(error, "Nie udało się pobrać promptu."));
        }
      }

      return hasRequestId(message) ? makeError(message.id, -32601, `Method not found: ${message.method}`) : null;
    },
  };
}