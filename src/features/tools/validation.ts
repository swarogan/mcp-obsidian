import { MARKDOWN_CONTENT_TYPE } from "../../lib/obsidian/constants.js";
import { ToolArgumentError } from "./errors.js";

function expectObject(rawArguments: unknown, toolName: string): Record<string, unknown> {
  if (rawArguments === undefined) {
    return {};
  }
  if (rawArguments === null || Array.isArray(rawArguments) || typeof rawArguments !== "object") {
    throw new ToolArgumentError(`Narzędzie \`${toolName}\` oczekuje obiektu arguments.`);
  }
  return rawArguments as Record<string, unknown>;
}

function requireString(object: Record<string, unknown>, key: string, toolName: string): string {
  if (typeof object[key] !== "string" || (object[key] as string).trim() === "") {
    throw new ToolArgumentError(`Pole \`${key}\` w narzędziu \`${toolName}\` musi być niepustym stringiem.`);
  }
  return object[key] as string;
}

function requireEnum<T extends string>(
  object: Record<string, unknown>,
  key: string,
  allowedValues: readonly T[],
  toolName: string,
): T {
  const value = object[key];
  if (!allowedValues.includes(value as T)) {
    throw new ToolArgumentError(
      `Pole \`${key}\` w narzędziu \`${toolName}\` musi mieć jedną z wartości: ${allowedValues.join(", ")}.`,
    );
  }
  return value as T;
}

function optionalString(object: Record<string, unknown>, key: string, toolName: string): string | undefined {
  if (object[key] === undefined) {
    return undefined;
  }
  if (typeof object[key] !== "string") {
    throw new ToolArgumentError(`Pole \`${key}\` w narzędziu \`${toolName}\` musi być stringiem.`);
  }
  return object[key] as string;
}

function optionalBoolean(object: Record<string, unknown>, key: string, toolName: string): boolean | undefined {
  if (object[key] === undefined) {
    return undefined;
  }
  if (typeof object[key] !== "boolean") {
    throw new ToolArgumentError(`Pole \`${key}\` w narzędziu \`${toolName}\` musi być booleanem.`);
  }
  return object[key] as boolean;
}

function optionalBooleanLike(
  object: Record<string, unknown>,
  key: string,
  toolName: string,
  defaultValue?: boolean,
): boolean | undefined {
  const value = object[key] ?? defaultValue;
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new ToolArgumentError(`Pole \`${key}\` w narzędziu \`${toolName}\` musi być booleanem.`);
}

function optionalInteger(
  object: Record<string, unknown>,
  key: string,
  toolName: string,
  { min = 0 } = {},
): number | undefined {
  if (object[key] === undefined) {
    return undefined;
  }
  const value = object[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new ToolArgumentError(
      `Pole \`${key}\` w narzędziu \`${toolName}\` musi być liczbą całkowitą${min > 0 ? ` >= ${min}` : ""}.`,
    );
  }
  return value;
}

function optionalStringArray(object: Record<string, unknown>, key: string, toolName: string): string[] | undefined {
  if (object[key] === undefined) {
    return undefined;
  }
  if (!Array.isArray(object[key]) || (object[key] as unknown[]).some((item) => typeof item !== "string" || (item as string).trim() === "")) {
    throw new ToolArgumentError(`Pole \`${key}\` w narzędziu \`${toolName}\` musi być tablicą niepustych stringów.`);
  }
  return object[key] as string[];
}

function optionalStringRecord(
  object: Record<string, unknown>,
  key: string,
  toolName: string,
  defaultValue?: Record<string, string>,
): Record<string, string> | undefined {
  if (object[key] === undefined) {
    return defaultValue;
  }
  const value = object[key];
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new ToolArgumentError(`Pole \`${key}\` w narzędziu \`${toolName}\` musi być obiektem.`);
  }
  for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entryValue !== "string") {
      throw new ToolArgumentError(`Pole \`${key}.${entryKey}\` w narzędziu \`${toolName}\` musi być stringiem.`);
    }
  }
  return value as Record<string, string>;
}

function optionalEnum<T extends string>(
  object: Record<string, unknown>,
  key: string,
  allowedValues: readonly T[],
  toolName: string,
  defaultValue?: T,
): T | undefined {
  const value = (object[key] ?? defaultValue) as T | undefined;
  if (value === undefined) {
    return undefined;
  }
  if (!allowedValues.includes(value)) {
    throw new ToolArgumentError(
      `Pole \`${key}\` w narzędziu \`${toolName}\` musi mieć jedną z wartości: ${allowedValues.join(", ")}.`,
    );
  }
  return value;
}

export function validateNoArguments(rawArguments: unknown, toolName: string): Record<string, never> {
  const args = expectObject(rawArguments, toolName);
  if (Object.keys(args).length > 0) {
    throw new ToolArgumentError(`Narzędzie \`${toolName}\` nie przyjmuje argumentów.`);
  }
  return {} as Record<string, never>;
}

export function validateFetch(rawArguments: unknown): { url: string; maxLength?: number; startIndex?: number; raw: boolean } {
  const args = expectObject(rawArguments, "fetch");
  return {
    url: requireString(args, "url", "fetch"),
    maxLength: optionalInteger(args, "maxLength", "fetch", { min: 1 }),
    startIndex: optionalInteger(args, "startIndex", "fetch", { min: 0 }),
    raw: optionalBoolean(args, "raw", "fetch") ?? false,
  };
}

export function validateGetActiveFile(rawArguments: unknown): { format: string } {
  const args = expectObject(rawArguments, "get_active_file");
  return {
    format: optionalEnum(args, "format", ["markdown", "json"] as const, "get_active_file", "markdown") ?? "markdown",
  };
}

export function validateActiveTextMutation(rawArguments: unknown, toolName: string): { content: string } {
  const args = expectObject(rawArguments, toolName);
  return { content: requireString(args, "content", toolName) };
}

export function validateVaultGet(rawArguments: unknown): { filename: string; format: string } {
  const args = expectObject(rawArguments, "get_vault_file");
  return {
    filename: requireString(args, "filename", "get_vault_file"),
    format: optionalEnum(args, "format", ["markdown", "json"] as const, "get_vault_file", "markdown") ?? "markdown",
  };
}

export function validateVaultTextMutation(rawArguments: unknown, toolName: string): { filename: string; content: string } {
  const args = expectObject(rawArguments, toolName);
  return {
    filename: requireString(args, "filename", toolName),
    content: requireString(args, "content", toolName),
  };
}

export function validatePatch(
  rawArguments: unknown,
  toolName: string,
  withFilename = false,
): Record<string, unknown> {
  const args = expectObject(rawArguments, toolName);

  if (!Object.hasOwn(args, "content")) {
    throw new ToolArgumentError(`Pole \`content\` w narzędziu \`${toolName}\` jest wymagane.`);
  }

  const operation = requireEnum(args, "operation", ["append", "prepend", "replace", "search-replace"] as const, toolName);

  return {
    ...(withFilename ? { filename: requireString(args, "filename", toolName) } : {}),
    operation,
    ...(operation === "search-replace"
      ? {}
      : { targetType: requireEnum(args, "targetType", ["heading", "block", "frontmatter"] as const, toolName) }),
    target: requireString(args, "target", toolName),
    content: args.content,
    contentType: optionalString(args, "contentType", toolName) ?? MARKDOWN_CONTENT_TYPE,
    targetDelimiter: optionalString(args, "targetDelimiter", toolName),
    trimTargetWhitespace: optionalBoolean(args, "trimTargetWhitespace", toolName),
    applyIfContentPreexists: optionalBoolean(args, "applyIfContentPreexists", toolName),
    createTargetIfMissing: optionalBoolean(args, "createTargetIfMissing", toolName),
  };
}

export function validateShowFileInObsidian(rawArguments: unknown): { filename: string; newLeaf: boolean } {
  const args = expectObject(rawArguments, "show_file_in_obsidian");
  return {
    filename: requireString(args, "filename", "show_file_in_obsidian"),
    newLeaf: optionalBoolean(args, "newLeaf", "show_file_in_obsidian") ?? false,
  };
}

export function validateSearchVault(rawArguments: unknown): { queryType: string; query: string } {
  const args = expectObject(rawArguments, "search_vault");
  return {
    queryType: requireEnum(args, "queryType", ["dataview", "jsonlogic"] as const, "search_vault"),
    query: requireString(args, "query", "search_vault"),
  };
}

export function validateSearchVaultSimple(rawArguments: unknown): { query: string; contextLength?: number } {
  const args = expectObject(rawArguments, "search_vault_simple");
  return {
    query: requireString(args, "query", "search_vault_simple"),
    contextLength: optionalInteger(args, "contextLength", "search_vault_simple", { min: 1 }),
  };
}

export function validateListVaultFiles(rawArguments: unknown): { directory?: string } {
  const args = expectObject(rawArguments, "list_vault_files");
  return {
    directory: optionalString(args, "directory", "list_vault_files"),
  };
}

function validateSmartFilter(rawArguments: unknown, toolName: string): { folders?: string[]; excludeFolders?: string[]; limit?: number } | undefined {
  if (rawArguments === undefined) {
    return undefined;
  }
  if (rawArguments === null || Array.isArray(rawArguments) || typeof rawArguments !== "object") {
    throw new ToolArgumentError(`Pole \`filter\` w narzędziu \`${toolName}\` musi być obiektem.`);
  }
  const obj = rawArguments as Record<string, unknown>;
  return {
    folders: optionalStringArray(obj, "folders", toolName),
    excludeFolders: optionalStringArray(obj, "excludeFolders", toolName),
    limit: optionalInteger(obj, "limit", toolName, { min: 1 }),
  };
}

export function validateSearchVaultSmart(rawArguments: unknown): { query: string; filter?: { folders?: string[]; excludeFolders?: string[]; limit?: number } } {
  const args = expectObject(rawArguments, "search_vault_smart");
  return {
    query: requireString(args, "query", "search_vault_smart"),
    filter: validateSmartFilter(args.filter, "search_vault_smart"),
  };
}

export function validateExecuteTemplate(rawArguments: unknown): { name: string; arguments: Record<string, string>; createFile: boolean; targetPath?: string } {
  const args = expectObject(rawArguments, "execute_template");
  const createFile = optionalBooleanLike(args, "createFile", "execute_template", false) ?? false;
  const validated = {
    name: requireString(args, "name", "execute_template"),
    arguments: optionalStringRecord(args, "arguments", "execute_template", {}) ?? {},
    createFile,
    targetPath: optionalString(args, "targetPath", "execute_template"),
  };
  if (validated.createFile && !validated.targetPath) {
    throw new ToolArgumentError("Pole `targetPath` jest wymagane, gdy `createFile` ma wartość true.");
  }
  return validated;
}

export function validateDeleteVaultFile(rawArguments: unknown): { filename: string } {
  const args = expectObject(rawArguments, "delete_vault_file");
  return {
    filename: requireString(args, "filename", "delete_vault_file"),
  };
}
