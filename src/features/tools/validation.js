import { MARKDOWN_CONTENT_TYPE } from "../../lib/obsidian/constants.js";
import { ToolArgumentError } from "./errors.js";

function expectObject(rawArguments, toolName) {
  if (rawArguments === undefined) {
    return {};
  }
  if (rawArguments === null || Array.isArray(rawArguments) || typeof rawArguments !== "object") {
    throw new ToolArgumentError(`Narzędzie \`${toolName}\` oczekuje obiektu arguments.`);
  }
  return rawArguments;
}

function requireString(object, key, toolName) {
  if (typeof object[key] !== "string" || object[key].trim() === "") {
    throw new ToolArgumentError(`Pole \`${key}\` w narzędziu \`${toolName}\` musi być niepustym stringiem.`);
  }
  return object[key];
}

function requireEnum(object, key, allowedValues, toolName) {
  const value = object[key];
  if (!allowedValues.includes(value)) {
    throw new ToolArgumentError(
      `Pole \`${key}\` w narzędziu \`${toolName}\` musi mieć jedną z wartości: ${allowedValues.join(", ")}.`,
    );
  }
  return value;
}

function optionalString(object, key, toolName) {
  if (object[key] === undefined) {
    return undefined;
  }
  if (typeof object[key] !== "string") {
    throw new ToolArgumentError(`Pole \`${key}\` w narzędziu \`${toolName}\` musi być stringiem.`);
  }
  return object[key];
}

function optionalBoolean(object, key, toolName) {
  if (object[key] === undefined) {
    return undefined;
  }
  if (typeof object[key] !== "boolean") {
    throw new ToolArgumentError(`Pole \`${key}\` w narzędziu \`${toolName}\` musi być booleanem.`);
  }
  return object[key];
}

function optionalBooleanLike(object, key, toolName, defaultValue) {
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

function optionalInteger(object, key, toolName, { min = 0 } = {}) {
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

function optionalStringArray(object, key, toolName) {
  if (object[key] === undefined) {
    return undefined;
  }
  if (!Array.isArray(object[key]) || object[key].some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new ToolArgumentError(`Pole \`${key}\` w narzędziu \`${toolName}\` musi być tablicą niepustych stringów.`);
  }
  return object[key];
}

function optionalStringRecord(object, key, toolName, defaultValue) {
  if (object[key] === undefined) {
    return defaultValue;
  }
  const value = object[key];
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new ToolArgumentError(`Pole \`${key}\` w narzędziu \`${toolName}\` musi być obiektem.`);
  }
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "string") {
      throw new ToolArgumentError(`Pole \`${key}.${entryKey}\` w narzędziu \`${toolName}\` musi być stringiem.`);
    }
  }
  return value;
}

function optionalEnum(object, key, allowedValues, toolName, defaultValue) {
  const value = object[key] ?? defaultValue;
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

export function validateNoArguments(rawArguments, toolName) {
  const args = expectObject(rawArguments, toolName);
  if (Object.keys(args).length > 0) {
    throw new ToolArgumentError(`Narzędzie \`${toolName}\` nie przyjmuje argumentów.`);
  }
  return {};
}

export function validateFetch(rawArguments) {
  const args = expectObject(rawArguments, "fetch");
  return {
    url: requireString(args, "url", "fetch"),
    maxLength: optionalInteger(args, "maxLength", "fetch", { min: 1 }),
    startIndex: optionalInteger(args, "startIndex", "fetch", { min: 0 }),
    raw: optionalBoolean(args, "raw", "fetch") ?? false,
  };
}

export function validateGetActiveFile(rawArguments) {
  const args = expectObject(rawArguments, "get_active_file");
  return {
    format: optionalEnum(args, "format", ["markdown", "json"], "get_active_file", "markdown"),
  };
}

export function validateActiveTextMutation(rawArguments, toolName) {
  const args = expectObject(rawArguments, toolName);
  return { content: requireString(args, "content", toolName) };
}

export function validateVaultGet(rawArguments) {
  const args = expectObject(rawArguments, "get_vault_file");
  return {
    filename: requireString(args, "filename", "get_vault_file"),
    format: optionalEnum(args, "format", ["markdown", "json"], "get_vault_file", "markdown"),
  };
}

export function validateVaultTextMutation(rawArguments, toolName) {
  const args = expectObject(rawArguments, toolName);
  return {
    filename: requireString(args, "filename", toolName),
    content: requireString(args, "content", toolName),
  };
}

export function validatePatch(rawArguments, toolName, withFilename = false) {
  const args = expectObject(rawArguments, toolName);

  if (!Object.hasOwn(args, "content")) {
    throw new ToolArgumentError(`Pole \`content\` w narzędziu \`${toolName}\` jest wymagane.`);
  }

  return {
    ...(withFilename ? { filename: requireString(args, "filename", toolName) } : {}),
    operation: requireEnum(args, "operation", ["append", "prepend", "replace"], toolName),
    targetType: requireEnum(args, "targetType", ["heading", "block", "frontmatter"], toolName),
    target: requireString(args, "target", toolName),
    content: args.content,
    contentType: optionalString(args, "contentType", toolName) ?? MARKDOWN_CONTENT_TYPE,
    targetDelimiter: optionalString(args, "targetDelimiter", toolName),
    trimTargetWhitespace: optionalBoolean(args, "trimTargetWhitespace", toolName),
    applyIfContentPreexists: optionalBoolean(args, "applyIfContentPreexists", toolName),
    createTargetIfMissing: optionalBoolean(args, "createTargetIfMissing", toolName),
  };
}

export function validateShowFileInObsidian(rawArguments) {
  const args = expectObject(rawArguments, "show_file_in_obsidian");
  return {
    filename: requireString(args, "filename", "show_file_in_obsidian"),
    newLeaf: optionalBoolean(args, "newLeaf", "show_file_in_obsidian") ?? false,
  };
}

export function validateSearchVault(rawArguments) {
  const args = expectObject(rawArguments, "search_vault");
  return {
    queryType: requireEnum(args, "queryType", ["dataview", "jsonlogic"], "search_vault"),
    query: requireString(args, "query", "search_vault"),
  };
}

export function validateSearchVaultSimple(rawArguments) {
  const args = expectObject(rawArguments, "search_vault_simple");
  return {
    query: requireString(args, "query", "search_vault_simple"),
    contextLength: optionalInteger(args, "contextLength", "search_vault_simple", { min: 1 }),
  };
}

export function validateListVaultFiles(rawArguments) {
  const args = expectObject(rawArguments, "list_vault_files");
  return {
    directory: optionalString(args, "directory", "list_vault_files"),
  };
}

function validateSmartFilter(rawArguments, toolName) {
  if (rawArguments === undefined) {
    return undefined;
  }
  if (rawArguments === null || Array.isArray(rawArguments) || typeof rawArguments !== "object") {
    throw new ToolArgumentError(`Pole \`filter\` w narzędziu \`${toolName}\` musi być obiektem.`);
  }
  return {
    folders: optionalStringArray(rawArguments, "folders", toolName),
    excludeFolders: optionalStringArray(rawArguments, "excludeFolders", toolName),
    limit: optionalInteger(rawArguments, "limit", toolName, { min: 1 }),
  };
}

export function validateSearchVaultSmart(rawArguments) {
  const args = expectObject(rawArguments, "search_vault_smart");
  return {
    query: requireString(args, "query", "search_vault_smart"),
    filter: validateSmartFilter(args.filter, "search_vault_smart"),
  };
}

export function validateExecuteTemplate(rawArguments) {
  const args = expectObject(rawArguments, "execute_template");
  const createFile = optionalBooleanLike(args, "createFile", "execute_template", false) ?? false;
  const validated = {
    name: requireString(args, "name", "execute_template"),
    arguments: optionalStringRecord(args, "arguments", "execute_template", {}),
    createFile,
    targetPath: optionalString(args, "targetPath", "execute_template"),
  };
  if (validated.createFile && !validated.targetPath) {
    throw new ToolArgumentError("Pole `targetPath` jest wymagane, gdy `createFile` ma wartość true.");
  }
  return validated;
}

export function validateDeleteVaultFile(rawArguments) {
  const args = expectObject(rawArguments, "delete_vault_file");
  return {
    filename: requireString(args, "filename", "delete_vault_file"),
  };
}
