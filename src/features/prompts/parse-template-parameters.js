function decodeQuotedString(token) {
  let result = "";

  for (let index = 1; index < token.length - 1; index += 1) {
    const character = token[index];

    if (character !== "\\") {
      result += character;
      continue;
    }

    const escaped = token[index + 1];
    index += 1;

    if (escaped === undefined) {
      break;
    }

    switch (escaped) {
      case "n":
        result += "\n";
        break;
      case "r":
        result += "\r";
        break;
      case "t":
        result += "\t";
        break;
      case "\\":
        result += "\\";
        break;
      case "\"":
        result += "\"";
        break;
      case "'":
        result += "'";
        break;
      default:
        result += escaped;
        break;
    }
  }

  return result;
}

function parseCallArguments(source) {
  const tokenPattern = /\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|true|false)\s*(?:,|$)/gy;
  const values = [];
  let index = 0;

  while (index < source.length) {
    if (/^\s*$/.test(source.slice(index))) {
      break;
    }

    tokenPattern.lastIndex = index;
    const match = tokenPattern.exec(source);
    if (!match) {
      return null;
    }

    const [token] = match;
    const trimmed = match[1];
    values.push(trimmed === "true" || trimmed === "false" ? trimmed === "true" : decodeQuotedString(trimmed));
    index += token.length;
  }

  if (typeof values[0] !== "string" || values[0].trim() === "") {
    return null;
  }

  let description;
  let required = false;

  if (typeof values[1] === "string") {
    description = values[1];
    required = values[2] === true;
  } else if (typeof values[1] === "boolean") {
    required = values[1];
  }

  return {
    name: values[0],
    ...(description ? { description } : {}),
    ...(required ? { required: true } : {}),
  };
}

export function parseTemplateParameters(content) {
  const templateTagPattern = /<%[*_=-]?([\s\S]*?)[-_]*%>/g;
  const promptCallPattern = /tp\.mcpTools\.prompt\(([\s\S]*?)\)/g;
  const parameters = new Map();

  for (const tagMatch of String(content).matchAll(templateTagPattern)) {
    const tagCode = tagMatch[1] ?? "";

    for (const callMatch of tagCode.matchAll(promptCallPattern)) {
      const parsed = parseCallArguments(callMatch[1] ?? "");
      if (!parsed) {
        continue;
      }

      const current = parameters.get(parsed.name);
      parameters.set(parsed.name, {
        name: parsed.name,
        ...(current?.description ? { description: current.description } : {}),
        ...(parsed.description ? { description: parsed.description } : {}),
        ...(current?.required || parsed.required ? { required: true } : {}),
      });
    }
  }

  return [...parameters.values()];
}