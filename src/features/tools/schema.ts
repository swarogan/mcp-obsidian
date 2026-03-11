import type { JsonSchema } from "../../types.js";

const patchContentSchema = {
  description: "Treść patcha. Dla application/json może być stringiem lub dowolną wartością JSON.",
  oneOf: [
    { type: "string" },
    { type: "number" },
    { type: "boolean" },
    { type: "object" },
    { type: "array" },
    { type: "null" },
  ],
} as const;

const patchProperties = {
  operation: {
    type: "string",
    enum: ["append", "prepend", "replace", "search-replace"],
    description: "Operacja PATCH v3. Użyj 'search-replace' do zamiany fragmentu tekstu (target = stary tekst, content = nowy tekst).",
  },
  targetType: {
    type: "string",
    enum: ["heading", "block", "frontmatter"],
    description: "Typ celu patchowania. Nie wymagane dla operacji 'search-replace'.",
  },
  target: {
    type: "string",
    description: "Nagłówek, block id, pole frontmatter lub szukany tekst (dla search-replace).",
  },
  content: patchContentSchema,
  contentType: {
    type: "string",
    description: "Domyślnie text/markdown; charset=utf-8. Ustaw application/json dla structured frontmatter.",
  },
  targetDelimiter: {
    type: "string",
    description: "Delimiter dla zagnieżdżonych targetów heading, np. ::",
  },
  trimTargetWhitespace: {
    type: "boolean",
  },
  applyIfContentPreexists: {
    type: "boolean",
  },
  createTargetIfMissing: {
    type: "boolean",
    default: true,
  },
} as const;

export function patchSchema(withFilename: boolean): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      ...(withFilename
        ? {
            filename: {
              type: "string",
              description: "Ścieżka pliku w vault, np. folder/notatka.md",
            },
          }
        : {}),
      ...patchProperties,
    },
    required: [
      ...(withFilename ? ["filename"] : []),
      "operation",
      "target",
      "content",
    ],
  };
}
