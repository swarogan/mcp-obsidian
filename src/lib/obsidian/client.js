import {
  DATAVIEW_DQL_CONTENT_TYPE,
  DEFAULT_BASE_URL,
  JSON_CONTENT_TYPE,
  JSONLOGIC_CONTENT_TYPE,
  JSON_NOTE_CONTENT_TYPE,
  MARKDOWN_CONTENT_TYPE,
} from "./constants.js";
import { buildPatchHeaders, normalizePatchContent } from "./patch.js";
import { encodeVaultDirectoryPath, encodeVaultPath, normalizeVaultDirectoryPath, normalizeVaultPath } from "./path-utils.js";
import {
  assertStringRecord,
  assertText,
  buildApiError,
  joinUrl,
  normalizeApiKey,
  normalizeBaseUrl,
  parseResponse,
  parseTimeout,
  requireConfiguredApiKey,
} from "./request.js";

export class ObsidianRestClient {
  constructor({
    baseUrl = process.env.OBSIDIAN_REST_URL ?? DEFAULT_BASE_URL,
    apiKey = process.env.OBSIDIAN_API_KEY,
    timeoutMs = parseTimeout(process.env.OBSIDIAN_REQUEST_TIMEOUT_MS),
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new Error("Globalne `fetch` nie jest dostępne w tym środowisku.");
    }

    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.apiKey = normalizeApiKey(apiKey);
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async request(path, { method = "GET", headers = {}, body, responseType = "auto", requireAuth = true } = {}) {
    const requestHeaders = {
      ...headers,
    };

    if (requireAuth) {
      requestHeaders.Authorization = `Bearer ${requireConfiguredApiKey(this.apiKey)}`;
    } else if (this.apiKey) {
      requestHeaders.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), {
      method,
      headers: requestHeaders,
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw await buildApiError(response);
    }

    return parseResponse(response, responseType);
  }

  async getActiveFile({ format = "markdown" } = {}) {
    const responseType = format === "json" ? "json" : "text";
    const accept = format === "json" ? JSON_NOTE_CONTENT_TYPE : MARKDOWN_CONTENT_TYPE;

    return this.request("/active/", {
      headers: { Accept: accept },
      responseType,
    });
  }

  async getServerInfo() {
    return this.request("/", {
      responseType: "json",
      requireAuth: false,
    });
  }

  async updateActiveFile(content) {
    await this.request("/active/", {
      method: "PUT",
      headers: { "Content-Type": MARKDOWN_CONTENT_TYPE },
      body: assertText(content, "content"),
      responseType: "none",
    });
  }

  async appendToActiveFile(content) {
    await this.request("/active/", {
      method: "POST",
      headers: { "Content-Type": MARKDOWN_CONTENT_TYPE },
      body: assertText(content, "content"),
      responseType: "none",
    });
  }

  async patchActiveFile(args) {
    const contentType = args.contentType ?? MARKDOWN_CONTENT_TYPE;
    return this.request("/active/", {
      method: "PATCH",
      headers: buildPatchHeaders({ ...args, contentType }),
      body: normalizePatchContent(args.content, contentType),
      responseType: "text",
    });
  }

  async deleteActiveFile() {
    await this.request("/active/", {
      method: "DELETE",
      responseType: "none",
    });
  }

  async showFileInObsidian(filename, { newLeaf = false } = {}) {
    const query = newLeaf ? "?newLeaf=true" : "";
    await this.request(`/open/${encodeURIComponent(normalizeVaultPath(filename))}${query}`, {
      method: "POST",
      responseType: "none",
    });
  }

  async searchVault({ queryType, query }) {
    const contentType = queryType === "jsonlogic" ? JSONLOGIC_CONTENT_TYPE : DATAVIEW_DQL_CONTENT_TYPE;
    return this.request("/search/", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: assertText(query, "query"),
      responseType: "json",
    });
  }

  async searchVaultSimple({ query, contextLength } = {}) {
    const params = new URLSearchParams({ query: assertText(query, "query") });
    if (contextLength !== undefined) {
      params.set("contextLength", `${contextLength}`);
    }

    return this.request(`/search/simple/?${params.toString()}`, {
      method: "POST",
      responseType: "json",
    });
  }

  async listVaultFiles(directory) {
    const normalizedDirectory = directory === undefined ? "" : normalizeVaultDirectoryPath(directory);
    const suffix = normalizedDirectory ? `${encodeVaultDirectoryPath(normalizedDirectory)}/` : "";
    return this.request(`/vault/${suffix}`, {
      responseType: "json",
    });
  }

  async getVaultFile(filename, { format = "markdown" } = {}) {
    const responseType = format === "json" ? "json" : "text";
    const accept = format === "json" ? JSON_NOTE_CONTENT_TYPE : MARKDOWN_CONTENT_TYPE;

    return this.request(`/vault/${encodeVaultPath(filename)}`, {
      headers: { Accept: accept },
      responseType,
    });
  }

  async createVaultFile(filename, content) {
    await this.request(`/vault/${encodeVaultPath(filename)}`, {
      method: "PUT",
      headers: { "Content-Type": MARKDOWN_CONTENT_TYPE },
      body: assertText(content, "content"),
      responseType: "none",
    });
  }

  async appendToVaultFile(filename, content) {
    await this.request(`/vault/${encodeVaultPath(filename)}`, {
      method: "POST",
      headers: { "Content-Type": MARKDOWN_CONTENT_TYPE },
      body: assertText(content, "content"),
      responseType: "none",
    });
  }

  async patchVaultFile({ filename, ...args }) {
    const contentType = args.contentType ?? MARKDOWN_CONTENT_TYPE;
    return this.request(`/vault/${encodeVaultPath(filename)}`, {
      method: "PATCH",
      headers: buildPatchHeaders({ ...args, contentType }),
      body: normalizePatchContent(args.content, contentType),
      responseType: "text",
    });
  }

  async deleteVaultFile(filename) {
    await this.request(`/vault/${encodeVaultPath(filename)}`, {
      method: "DELETE",
      responseType: "none",
    });
  }

  async searchVaultSmart({ query, filter } = {}) {
    return this.request("/search/smart", {
      method: "POST",
      headers: { "Content-Type": JSON_CONTENT_TYPE },
      body: JSON.stringify({ query: assertText(query, "query"), ...(filter ? { filter } : {}) }),
      responseType: "json",
    });
  }

  async executeTemplate({ name, arguments: templateArguments = {}, createFile = false, targetPath } = {}) {
    const payload = {
      name: normalizeVaultPath(name),
      arguments: assertStringRecord(templateArguments, "arguments"),
      ...(createFile ? { createFile: true } : {}),
      ...(targetPath ? { targetPath: normalizeVaultPath(targetPath) } : {}),
    };

    if (createFile && !targetPath) {
      throw new TypeError("Pole `targetPath` jest wymagane, gdy `createFile` ma wartość true.");
    }

    return this.request("/templates/execute", {
      method: "POST",
      headers: { "Content-Type": JSON_CONTENT_TYPE },
      body: JSON.stringify(payload),
      responseType: "json",
    });
  }
}

export function createClientFromEnv(options = {}) {
  return new ObsidianRestClient(options);
}
