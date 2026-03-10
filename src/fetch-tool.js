const DEFAULT_FETCH_USER_AGENT = "mcp-obsidian/0.1";

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#([0-9]+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)));
}

function stripTags(text) {
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").trim();
}

function resolveUrl(baseUrl, candidate) {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return candidate;
  }
}

export function htmlToMarkdownish(html, sourceUrl) {
  let content = String(html);

  content = content.replace(/<script[\s\S]*?<\/script>/gi, "");
  content = content.replace(/<style[\s\S]*?<\/style>/gi, "");
  content = content.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, text) => `\n\n\`\`\`\n${stripTags(text)}\n\`\`\`\n\n`);
  content = content.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, text) => `\`${stripTags(text)}\``);
  content = content.replace(/<a\b[^>]*href=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_, _quote, href, text) => {
    const label = stripTags(text) || resolveUrl(sourceUrl, href);
    return `[${label}](${resolveUrl(sourceUrl, href)})`;
  });
  content = content.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, text) => `\n\n## ${stripTags(text)}\n\n`);
  content = content.replace(/<li[^>]*>/gi, "\n- ");
  content = content.replace(/<br\s*\/?>/gi, "\n");
  content = content.replace(/<\/(p|div|section|article|header|footer|aside|main|ul|ol|table|tr)>/gi, "\n\n");
  content = content.replace(/<[^>]+>/g, " ");
  content = decodeHtmlEntities(content);
  content = content.replace(/\r/g, "");
  content = content.replace(/[ \t]+\n/g, "\n");
  content = content.replace(/\n{3,}/g, "\n\n");

  return content.trim();
}

export async function fetchUrlContent(
  { url, maxLength = 5000, startIndex = 0, raw = false },
  { fetchImpl = globalThis.fetch } = {},
) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Globalne `fetch` nie jest dostępne do obsługi narzędzia `fetch`.");
  }

  const response = await fetchImpl(url, {
    headers: {
      "User-Agent": DEFAULT_FETCH_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Nie udało się pobrać ${url} - status HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const bodyText = await response.text();
  const isHtml = bodyText.toLowerCase().includes("<html") || contentType.includes("text/html") || contentType === "";

  let content = bodyText;
  let prefix = `Contents of ${url}:\n`;

  if (isHtml && !raw) {
    content = htmlToMarkdownish(bodyText, url);
  } else if (!isHtml && !contentType.includes("text/plain") && !raw) {
    prefix = `Content type ${contentType || "unknown"} cannot be simplified to markdown, here is the raw content:\n\nContents of ${url}:\n`;
  }

  const totalLength = content.length;
  const pageContent = content.slice(startIndex, startIndex + maxLength);
  const hasMore = startIndex + maxLength < totalLength;
  const text = hasMore
    ? `${prefix}${pageContent}\n\n<error>Content truncated. Call the fetch tool with a startIndex of ${
        startIndex + maxLength
      } to get more content.</error>`
    : `${prefix}${pageContent}`;

  return {
    text,
    structuredContent: {
      url,
      contentType,
      totalLength,
      startIndex,
      endIndex: startIndex + pageContent.length,
      hasMore,
      raw,
    },
  };
}