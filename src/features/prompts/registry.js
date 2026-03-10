import { ObsidianApiError, normalizeVaultPath } from "../../lib/obsidian/index.js";
import { PromptArgumentError } from "./errors.js";
import { parseTemplateParameters } from "./parse-template-parameters.js";

const PROMPT_DIRECTORY = "Prompts";
const PROMPT_TAG = "mcp-tools-prompt";

function asPromptFileList(result) {
  if (Array.isArray(result)) {
    return result;
  }
  if (Array.isArray(result?.files)) {
    return result.files;
  }
  return [];
}

function normalizePromptName(name) {
  if (typeof name !== "string" || name.trim() === "") {
    throw new PromptArgumentError("Pole `name` w prompts/get musi być niepustym stringiem.");
  }

  const trimmed = name.trim().replace(/^Prompts\//i, "");
  return normalizeVaultPath(trimmed);
}

function toPromptPath(name) {
  return normalizeVaultPath(`${PROMPT_DIRECTORY}/${normalizePromptName(name)}`);
}

function toPromptName(path) {
  const normalized = String(path ?? "").trim().replace(/\\/g, "/").replace(/^\.?\//, "");
  return normalized.startsWith(`${PROMPT_DIRECTORY}/`) ? normalized.slice(PROMPT_DIRECTORY.length + 1) : normalized;
}

function getTags(note) {
  if (Array.isArray(note?.tags)) {
    return note.tags.filter((tag) => typeof tag === "string");
  }
  if (typeof note?.tags === "string") {
    return [note.tags];
  }
  return [];
}

function getDescription(frontmatter) {
  return typeof frontmatter?.description === "string" ? frontmatter.description : undefined;
}

function buildPromptDefinition(note, promptName) {
  if (!getTags(note).includes(PROMPT_TAG)) {
    return null;
  }

  const definition = {
    name: promptName,
    description: getDescription(note?.frontmatter),
    arguments: parseTemplateParameters(typeof note?.content === "string" ? note.content : ""),
  };

  return {
    name: definition.name,
    ...(definition.description ? { description: definition.description } : {}),
    ...(definition.arguments.length > 0 ? { arguments: definition.arguments } : {}),
  };
}

function validatePromptArguments(parameters, rawArguments) {
  if (rawArguments === undefined) {
    rawArguments = {};
  }

  if (rawArguments === null || Array.isArray(rawArguments) || typeof rawArguments !== "object") {
    throw new PromptArgumentError("Pole `arguments` w prompts/get musi być obiektem stringów.");
  }

  const allowedNames = new Set(parameters.map((parameter) => parameter.name));
  const validated = {};

  for (const [key, value] of Object.entries(rawArguments)) {
    if (!allowedNames.has(key)) {
      throw new PromptArgumentError(`Prompt nie przyjmuje argumentu \`${key}\`.`);
    }
    if (typeof value !== "string") {
      throw new PromptArgumentError(`Argument \`${key}\` musi być stringiem.`);
    }
    validated[key] = value;
  }

  for (const parameter of parameters) {
    if (parameter.required && !Object.hasOwn(validated, parameter.name)) {
      throw new PromptArgumentError(`Brakuje wymaganego argumentu \`${parameter.name}\`.`);
    }
  }

  return validated;
}

function stripFrontmatter(content) {
  const text = String(content ?? "").trim();
  const match = text.match(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n)?([\s\S]*)$/);
  return (match ? match[1] : text).trim();
}

async function readPromptNote(client, promptName) {
  try {
    return await client.getVaultFile(toPromptPath(promptName), { format: "json" });
  } catch (error) {
    if (error instanceof ObsidianApiError && error.status === 404) {
      throw new PromptArgumentError(`Nie znaleziono promptu \`${normalizePromptName(promptName)}\`.`);
    }
    throw error;
  }
}

export function createPromptRegistry({ getClient }) {
  return {
    async listPrompts() {
      const client = await getClient();
      let directoryListing;

      try {
        directoryListing = await client.listVaultFiles(PROMPT_DIRECTORY);
      } catch (error) {
        if (error instanceof ObsidianApiError && error.status === 404) {
          return [];
        }
        throw error;
      }

      const promptFiles = asPromptFileList(directoryListing)
        .filter((entry) => typeof entry === "string" && entry.toLowerCase().endsWith(".md"))
        .sort((left, right) => left.localeCompare(right));

      const prompts = (
        await Promise.all(
          promptFiles.map(async (entry) => {
            const promptName = toPromptName(entry);
            const note = await readPromptNote(client, promptName);
            return buildPromptDefinition(note, promptName);
          }),
        )
      )
        .filter(Boolean)
        .sort((left, right) => left.name.localeCompare(right.name));

      return prompts;
    },

    async getPrompt({ name, arguments: rawArguments }) {
      const client = await getClient();
      const promptName = normalizePromptName(name);
      const note = await readPromptNote(client, promptName);
      const promptDefinition = buildPromptDefinition(note, promptName);

      if (!promptDefinition) {
        throw new PromptArgumentError(`Plik \`${promptName}\` nie jest oznaczony tagiem \`${PROMPT_TAG}\`.`);
      }

      const validatedArguments = validatePromptArguments(promptDefinition.arguments ?? [], rawArguments);
      const executionResult = await client.executeTemplate({
        name: toPromptPath(promptName),
        arguments: validatedArguments,
      });

      return {
        ...(promptDefinition.description ? { description: promptDefinition.description } : {}),
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: stripFrontmatter(executionResult?.content),
            },
          },
        ],
      };
    },
  };
}