import { fetchUrlContent } from "../../fetch-tool.js";
import { patchSchema } from "./schema.js";
import { makeJsonResult, makeTextResult, stringifyForText } from "./results.js";
import {
  validateActiveTextMutation,
  validateDeleteVaultFile,
  validateExecuteTemplate,
  validateFetch,
  validateGetActiveFile,
  validateListVaultFiles,
  validateNoArguments,
  validatePatch,
  validateSearchVault,
  validateSearchVaultSimple,
  validateSearchVaultSmart,
  validateShowFileInObsidian,
  validateVaultGet,
  validateVaultTextMutation,
} from "./validation.js";

export function createToolRegistry({ getClient, fetchImpl = globalThis.fetch }) {
  const tools = [
    {
      name: "fetch",
      title: "Pobierz stronę WWW",
      description: "Pobiera zawartość dowolnego URL i zwraca ją jako markdown-ish albo raw HTML.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: { type: "string" },
          maxLength: { type: "integer", minimum: 1 },
          startIndex: { type: "integer", minimum: 0 },
          raw: { type: "boolean" },
        },
        required: ["url"],
      },
      validate: validateFetch,
      execute: async (args) => {
        const result = await fetchUrlContent(args, { fetchImpl });
        return makeTextResult(result.text, result.structuredContent);
      },
    },
    {
      name: "get_server_info",
      title: "Pobierz status Local REST API",
      description: "Zwraca podstawowe informacje o Obsidian Local REST API i statusie uwierzytelnienia.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      validate: (args) => validateNoArguments(args, "get_server_info"),
      execute: async () => makeJsonResult(await (await getClient()).getServerInfo()),
    },
    {
      name: "get_active_file",
      title: "Pobierz aktywny plik",
      description: "Zwraca treść aktualnie otwartego pliku w Obsidianie jako markdown albo JSON note payload.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          format: { type: "string", enum: ["markdown", "json"], default: "markdown" },
        },
      },
      validate: validateGetActiveFile,
      execute: async (args) => {
        const result = await (await getClient()).getActiveFile(args);
        return args.format === "json"
          ? makeTextResult(stringifyForText(result), { format: "json", source: "active", data: result })
          : makeTextResult(result, { format: "markdown", source: "active", content: result });
      },
    },
    {
      name: "update_active_file",
      title: "Zastąp aktywny plik",
      description: "Nadpisuje treść aktywnie otwartego pliku markdownem w UTF-8.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { content: { type: "string" } },
        required: ["content"],
      },
      validate: (args) => validateActiveTextMutation(args, "update_active_file"),
      execute: async (args) => {
        await (await getClient()).updateActiveFile(args.content);
        return makeTextResult("Aktywny plik został zaktualizowany.", {
          ok: true,
          operation: "update",
          target: "active",
        });
      },
    },
    {
      name: "append_to_active_file",
      title: "Dopisz do aktywnego pliku",
      description: "Dopisuje markdown do końca aktualnie otwartego pliku.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { content: { type: "string" } },
        required: ["content"],
      },
      validate: (args) => validateActiveTextMutation(args, "append_to_active_file"),
      execute: async (args) => {
        await (await getClient()).appendToActiveFile(args.content);
        return makeTextResult("Treść została dopisana do aktywnego pliku.", {
          ok: true,
          operation: "append",
          target: "active",
        });
      },
    },
    {
      name: "patch_active_file",
      title: "Patch aktywnego pliku",
      description: "Stosuje PATCH v3 względem heading, block id lub frontmatter w aktywnym pliku.",
      inputSchema: patchSchema(false),
      validate: (args) => validatePatch(args, "patch_active_file"),
      execute: async (args) => {
        const patched = await (await getClient()).patchActiveFile(args);
        return makeTextResult(patched, {
          ok: true,
          operation: "patch",
          target: "active",
          content: patched,
        });
      },
    },
    {
      name: "delete_active_file",
      title: "Usuń aktywny plik",
      description: "Usuwa aktualnie otwarty plik w Obsidianie.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      validate: (args) => validateNoArguments(args, "delete_active_file"),
      execute: async () => {
        await (await getClient()).deleteActiveFile();
        return makeTextResult("Aktywny plik został usunięty.", {
          ok: true,
          operation: "delete",
          target: "active",
        });
      },
    },
    {
      name: "show_file_in_obsidian",
      title: "Pokaż plik w Obsidianie",
      description: "Otwiera wskazany plik w UI Obsidiana.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          filename: { type: "string" },
          newLeaf: { type: "boolean" },
        },
        required: ["filename"],
      },
      validate: validateShowFileInObsidian,
      execute: async (args) => {
        await (await getClient()).showFileInObsidian(args.filename, { newLeaf: args.newLeaf });
        return makeTextResult("Plik został otwarty w Obsidianie.", {
          ok: true,
          operation: "open",
          filename: args.filename,
          newLeaf: args.newLeaf,
        });
      },
    },
    {
      name: "search_vault",
      title: "Wyszukaj vault przez Dataview lub JsonLogic",
      description: "Uruchamia wyszukiwanie przez endpoint /search/ z queryType dataview albo jsonlogic.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          queryType: { type: "string", enum: ["dataview", "jsonlogic"] },
          query: { type: "string" },
        },
        required: ["queryType", "query"],
      },
      validate: validateSearchVault,
      execute: async (args) => {
        const result = await (await getClient()).searchVault(args);
        return makeJsonResult(result, {
          source: "search_vault",
          queryType: args.queryType,
          data: result,
        });
      },
    },
    {
      name: "search_vault_simple",
      title: "Proste wyszukiwanie tekstowe",
      description: "Uruchamia proste wyszukiwanie tekstowe w vault.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          contextLength: { type: "integer", minimum: 1 },
        },
        required: ["query"],
      },
      validate: validateSearchVaultSimple,
      execute: async (args) => {
        const result = await (await getClient()).searchVaultSimple(args);
        return makeJsonResult(result, {
          source: "search_vault_simple",
          query: args.query,
          data: result,
        });
      },
    },
    {
      name: "list_vault_files",
      title: "Listuj pliki w vault",
      description: "Zwraca listę plików i katalogów w katalogu głównym lub wskazanym podkatalogu vault.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          directory: { type: "string" },
        },
      },
      validate: validateListVaultFiles,
      execute: async (args) => {
        const result = await (await getClient()).listVaultFiles(args.directory);
        return makeJsonResult(result, {
          source: "list_vault_files",
          directory: args.directory ?? "",
          data: result,
        });
      },
    },
    {
      name: "get_vault_file",
      title: "Pobierz plik z vault",
      description: "Zwraca treść pliku z vault jako markdown albo JSON note payload.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          filename: { type: "string" },
          format: { type: "string", enum: ["markdown", "json"], default: "markdown" },
        },
        required: ["filename"],
      },
      validate: validateVaultGet,
      execute: async (args) => {
        const result = await (await getClient()).getVaultFile(args.filename, args);
        return args.format === "json"
          ? makeTextResult(stringifyForText(result), { format: "json", filename: args.filename, data: result })
          : makeTextResult(result, { format: "markdown", filename: args.filename, content: result });
      },
    },
    {
      name: "create_vault_file",
      title: "Utwórz lub nadpisz plik w vault",
      description: "Tworzy plik w vault lub nadpisuje istniejący treścią markdown w UTF-8.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          filename: { type: "string" },
          content: { type: "string" },
        },
        required: ["filename", "content"],
      },
      validate: (args) => validateVaultTextMutation(args, "create_vault_file"),
      execute: async (args) => {
        await (await getClient()).createVaultFile(args.filename, args.content);
        return makeTextResult("Plik został zapisany w vault.", {
          ok: true,
          operation: "create",
          filename: args.filename,
        });
      },
    },
    {
      name: "append_to_vault_file",
      title: "Dopisz do pliku w vault",
      description: "Dopisuje markdown do pliku w vault przez Local REST API.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          filename: { type: "string" },
          content: { type: "string" },
        },
        required: ["filename", "content"],
      },
      validate: (args) => validateVaultTextMutation(args, "append_to_vault_file"),
      execute: async (args) => {
        await (await getClient()).appendToVaultFile(args.filename, args.content);
        return makeTextResult("Treść została dopisana do pliku w vault.", {
          ok: true,
          operation: "append",
          filename: args.filename,
        });
      },
    },
    {
      name: "patch_vault_file",
      title: "Patch pliku w vault",
      description: "Stosuje PATCH v3 względem heading, block id lub frontmatter w wybranym pliku vault.",
      inputSchema: patchSchema(true),
      validate: (args) => validatePatch(args, "patch_vault_file", true),
      execute: async (args) => {
        const patched = await (await getClient()).patchVaultFile(args);
        return makeTextResult(patched, {
          ok: true,
          operation: "patch",
          filename: args.filename,
          content: patched,
        });
      },
    },
    {
      name: "delete_vault_file",
      title: "Usuń plik z vault",
      description: "Usuwa wskazany plik z vault.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          filename: { type: "string" },
        },
        required: ["filename"],
      },
      validate: validateDeleteVaultFile,
      execute: async (args) => {
        await (await getClient()).deleteVaultFile(args.filename);
        return makeTextResult("Plik został usunięty z vault.", {
          ok: true,
          operation: "delete",
          filename: args.filename,
        });
      },
    },
    {
      name: "search_vault_smart",
      title: "Semantyczne wyszukiwanie w vault",
      description: "Uruchamia wyszukiwanie semantyczne przez endpoint /search/smart.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          filter: {
            type: "object",
            additionalProperties: false,
            properties: {
              folders: { type: "array", items: { type: "string" } },
              excludeFolders: { type: "array", items: { type: "string" } },
              limit: { type: "integer", minimum: 1 },
            },
          },
        },
        required: ["query"],
      },
      validate: validateSearchVaultSmart,
      execute: async (args) => {
        const result = await (await getClient()).searchVaultSmart(args);
        return makeJsonResult(result, {
          source: "search_vault_smart",
          query: args.query,
          data: result,
        });
      },
    },
    {
      name: "execute_template",
      title: "Wykonaj template Templatera",
      description: "Uruchamia endpoint /templates/execute dla wskazanego template file.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          arguments: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          createFile: {
            oneOf: [{ type: "boolean" }, { type: "string", enum: ["true", "false"] }],
          },
          targetPath: { type: "string" },
        },
        required: ["name"],
      },
      validate: validateExecuteTemplate,
      execute: async (args) => {
        const result = await (await getClient()).executeTemplate(args);
        return makeJsonResult(result, {
          source: "execute_template",
          template: args.name,
          data: result,
        });
      },
    },
  ];

  return new Map(tools.map((tool) => [tool.name, tool]));
}
