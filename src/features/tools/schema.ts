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
    description: "Operacja PATCH. append/prepend/replace trafiają do API i wymagają targetType. 'search-replace' jest emulowane po stronie klienta (odczyt-zamiana-zapis): target = szukany tekst, content = nowy tekst.",
  },
  targetType: {
    type: "string",
    enum: ["heading", "block", "frontmatter"],
    description: "Typ celu. Wymagany dla append/prepend/replace; ignorowany dla 'search-replace'.",
  },
  target: {
    type: "string",
    description: "Dla heading: pełna ścieżka od korzenia rozdzielona '::' (np. 'Nagłówek::Podsekcja') — sam tytuł podsekcji zwróci 40080 invalid-target. Dla block: block id. Dla frontmatter: nazwa pola. Dla search-replace: szukany tekst.",
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
