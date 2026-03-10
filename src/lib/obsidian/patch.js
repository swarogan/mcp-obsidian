import { JSON_CONTENT_TYPE, MARKDOWN_CONTENT_TYPE } from "./constants.js";
import { assertText } from "./request.js";

const PATCH_OPERATIONS = new Set(["append", "prepend", "replace"]);
const PATCH_TARGET_TYPES = new Set(["heading", "block", "frontmatter"]);

export function normalizePatchContent(content, contentType = MARKDOWN_CONTENT_TYPE) {
  const normalizedContentType = String(contentType).trim().toLowerCase();

  if (normalizedContentType.startsWith(JSON_CONTENT_TYPE)) {
    return typeof content === "string" ? content : JSON.stringify(content);
  }

  if (typeof content !== "string") {
    throw new TypeError("Treść patcha dla content-type tekstowego musi być stringiem.");
  }

  return content;
}

export function buildPatchHeaders({
  operation,
  targetType,
  target,
  targetDelimiter,
  trimTargetWhitespace,
  applyIfContentPreexists,
  createTargetIfMissing = true,
  contentType = MARKDOWN_CONTENT_TYPE,
}) {
  if (!PATCH_OPERATIONS.has(operation)) {
    throw new TypeError("`operation` musi być jedną z wartości: append, prepend, replace.");
  }

  if (!PATCH_TARGET_TYPES.has(targetType)) {
    throw new TypeError("`targetType` musi być jedną z wartości: heading, block, frontmatter.");
  }

  if (typeof target !== "string" || target.trim() === "") {
    throw new TypeError("`target` musi być niepustym stringiem.");
  }

  const headers = {
    Operation: operation,
    "Target-Type": targetType,
    Target: encodeURIComponent(target),
    "Content-Type": String(contentType).trim() || MARKDOWN_CONTENT_TYPE,
    "Create-Target-If-Missing": String(createTargetIfMissing),
  };

  if (targetDelimiter !== undefined) {
    headers["Target-Delimiter"] = assertText(targetDelimiter, "targetDelimiter");
  }
  if (trimTargetWhitespace !== undefined) {
    headers["Trim-Target-Whitespace"] = String(Boolean(trimTargetWhitespace));
  }
  if (applyIfContentPreexists !== undefined) {
    headers["Apply-If-Content-Preexists"] = String(Boolean(applyIfContentPreexists));
  }

  return headers;
}
