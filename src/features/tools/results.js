export function makeTextResult(text, structuredContent, isError = false) {
  const result = {
    content: [{ type: "text", text }],
  };

  if (structuredContent !== undefined) {
    result.structuredContent = structuredContent;
  }
  if (isError) {
    result.isError = true;
  }

  return result;
}

export function stringifyForText(value) {
  return JSON.stringify(value, null, 2);
}

export function makeJsonResult(data, structuredContent = data) {
  return makeTextResult(stringifyForText(data), structuredContent);
}
