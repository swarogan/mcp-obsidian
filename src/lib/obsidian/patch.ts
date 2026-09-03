const PATCH_OPERATIONS = new Set(["append", "prepend", "replace"]);
const PATCH_TARGET_TYPES = new Set(["heading", "block", "frontmatter"]);

/**
 * Operation exposed by this server that the Obsidian Local REST API does not implement.
 * The API only understands append/prepend/replace against a heading, block or frontmatter
 * target, so the client emulates this one with a read-modify-write.
 */
export const SEARCH_REPLACE = "search-replace";

export interface PatchRequestArgs {
  operation: string;
  targetType?: string;
  target: string;
  content: unknown;
  contentType?: string;
  targetDelimiter?: string;
  trimTargetWhitespace?: boolean;
  applyIfContentPreexists?: boolean;
  createTargetIfMissing?: boolean;
}

export interface PatchRequest {
  headers: Record<string, string>;
  body: string;
}

/**
 * HTTP header values are latin-1, and vault headings routinely contain non-ASCII characters,
 * so every non-ASCII code point is percent-encoded, as the API documents:
 * "percent-encode any non-ASCII characters, e.g. H%C3%A9llo for Héllo".
 *
 * ASCII is deliberately left untouched: spaces and the `::` heading separator must survive
 * verbatim, otherwise the API answers 40080 invalid-target.
 */
function encodeHeaderValue(value: string): string {
  return Array.from(value)
    .map((char) => ((char.codePointAt(0) ?? 0) < 128 ? char : encodeURIComponent(char)))
    .join("");
}

function boolHeader(value: boolean): string {
  return value ? "true" : "false";
}

/**
 * The PATCH endpoint compares the Content-Type strictly and rejects any parameter, so
 * "text/markdown; charset=utf-8" — valid for PUT/POST and used elsewhere in this client —
 * comes back as 40012 "Unknown or invalid Content-Type". Only the media type is forwarded.
 */
function normalizeContentType(contentType?: string): string {
  const mediaType = String(contentType ?? "text/markdown").split(";")[0].trim().toLowerCase();
  return mediaType || "text/markdown";
}

/**
 * Builds the headers and body of a PATCH request.
 *
 * The Obsidian Local REST API takes every patch parameter as an HTTP **header** and the
 * payload as the raw request body. Sending them as a JSON body makes the API reject the
 * call with 40053 "No 'Target-Type' header was provided".
 */
export function buildPatchRequest({
  operation,
  targetType,
  target,
  content,
  contentType,
  targetDelimiter,
  trimTargetWhitespace,
  applyIfContentPreexists,
  createTargetIfMissing = true,
}: PatchRequestArgs): PatchRequest {
  if (!PATCH_OPERATIONS.has(operation)) {
    throw new TypeError("`operation` musi być jedną z wartości: append, prepend, replace.");
  }

  if (!targetType || !PATCH_TARGET_TYPES.has(targetType)) {
    throw new TypeError("`targetType` musi być jedną z wartości: heading, block, frontmatter.");
  }

  if (typeof target !== "string" || target.trim() === "") {
    throw new TypeError("`target` musi być niepustym stringiem.");
  }

  const headers: Record<string, string> = {
    Operation: operation,
    "Target-Type": targetType,
    Target: encodeHeaderValue(target),
    "Create-Target-If-Missing": boolHeader(createTargetIfMissing),
    "Content-Type": normalizeContentType(contentType),
  };

  if (targetDelimiter !== undefined) {
    headers["Target-Delimiter"] = encodeHeaderValue(targetDelimiter);
  }
  if (trimTargetWhitespace !== undefined) {
    headers["Trim-Target-Whitespace"] = boolHeader(trimTargetWhitespace);
  }
  // The tool exposes the positive form ("apply if the content already exists") while the API
  // takes the negative one ("reject if it already exists"), so the value is inverted here.
  if (applyIfContentPreexists !== undefined) {
    headers["Reject-If-Content-Preexists"] = boolHeader(!applyIfContentPreexists);
  }

  const body = typeof content === "string" ? content : JSON.stringify(content);

  return { headers, body };
}

export interface SearchReplaceResult {
  content: string;
  occurrences: number;
}

/**
 * Applies a search-replace to a document in memory.
 *
 * Throws when the searched text is absent so that a typo fails loudly instead of silently
 * reporting success after changing nothing.
 */
export function applySearchReplace(document: unknown, search: string, replacement: unknown): SearchReplaceResult {
  if (typeof search !== "string" || search === "") {
    throw new TypeError("`target` (szukany tekst) musi być niepustym stringiem.");
  }

  const text = typeof document === "string" ? document : String(document);
  const parts = text.split(search);

  if (parts.length === 1) {
    throw new Error(`Nie znaleziono szukanego tekstu w dokumencie: ${JSON.stringify(search.slice(0, 80))}`);
  }

  const value = typeof replacement === "string" ? replacement : JSON.stringify(replacement);

  return { content: parts.join(value), occurrences: parts.length - 1 };
}
