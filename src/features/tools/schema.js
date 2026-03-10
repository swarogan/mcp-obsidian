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
};

const patchProperties = {
  operation: {
    type: "string",
    enum: ["append", "prepend", "replace"],
    description: "Operacja PATCH v3.",
  },
  targetType: {
    type: "string",
    enum: ["heading", "block", "frontmatter"],
    description: "Typ celu patchowania.",
  },
  target: {
    type: "string",
    description: "Nagłówek, block id lub pole frontmatter.",
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
};

export function patchSchema(withFilename) {
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
      "targetType",
      "target",
      "content",
    ],
  };
}
