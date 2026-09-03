import {
  DATAVIEW_DQL_CONTENT_TYPE,
  DEFAULT_BASE_URL,
  JSON_CONTENT_TYPE,
  JSONLOGIC_CONTENT_TYPE,
  JSON_NOTE_CONTENT_TYPE,
  MARKDOWN_CONTENT_TYPE,
} from "./constants.js";
import { applySearchReplace, buildPatchRequest, SEARCH_REPLACE } from "./patch.js";
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
import type { PatchArgs, RequestOptions, SmartSearchFilter } from "../../types.js";

type FetchFn = typeof globalThis.fetch;

export interface ObsidianRestClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: FetchFn;
}

export class ObsidianRestClient {
  readonly baseUrl: string;
  readonly apiKey: string | undefined;
  readonly timeoutMs: number;
  private readonly fetchImpl: FetchFn;

  constructor({
    baseUrl = process.env.OBSIDIAN_REST_URL ?? DEFAULT_BASE_URL,
    apiKey = process.env.OBSIDIAN_API_KEY,
    timeoutMs = parseTimeout(process.env.OBSIDIAN_REQUEST_TIMEOUT_MS),
    fetchImpl = globalThis.fetch,
  }: ObsidianRestClientOptions = {}) {
    if (typeof fetchImpl !== "function") {
      throw new Error("Globalne `fetch` nie jest dostępne w tym środowisku.");
    }

    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.apiKey = normalizeApiKey(apiKey);
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async request(path: string, { method = "GET", headers = {}, body, responseType = "auto", requireAuth = true }: RequestOptions = {}): Promise<unknown> {
    const requestHeaders: Record<string, string> = {
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

  async getActiveFile({ format = "markdown" } = {}): Promise<unknown> {
    const responseType = format === "json" ? "json" : "text";
    const accept = format === "json" ? JSON_NOTE_CONTENT_TYPE : MARKDOWN_CONTENT_TYPE;

    return this.request("/active/", {
      headers: { Accept: accept },
      responseType,
    });
  }

  async getServerInfo(): Promise<unknown> {
    return this.request("/", {
      responseType: "json",
      requireAuth: false,
    });
  }

  async updateActiveFile(content: string): Promise<void> {
    await this.request("/active/", {
      method: "PUT",
      headers: { "Content-Type": MARKDOWN_CONTENT_TYPE },
      body: assertText(content, "content"),
      responseType: "none",
    });
  }

  async appendToActiveFile(content: string): Promise<void> {
    await this.request("/active/", {
      method: "POST",
      headers: { "Content-Type": MARKDOWN_CONTENT_TYPE },
      body: assertText(content, "content"),
      responseType: "none",
    });
  }

  async patchActiveFile(args: PatchArgs): Promise<unknown> {
    if (args.operation === SEARCH_REPLACE) {
      const current = await this.getActiveFile({ format: "markdown" });
      const { content } = applySearchReplace(current, args.target, args.content);
      await this.updateActiveFile(content);
      return content;
    }

    const { headers, body } = buildPatchRequest(args);

    return this.request("/active/", {
      method: "PATCH",
      headers,
      body,
      responseType: "text",
    });
  }

  async deleteActiveFile(): Promise<void> {
    await this.request("/active/", {
      method: "DELETE",
      responseType: "none",
    });
  }

  async showFileInObsidian(filename: string, { newLeaf = false } = {}): Promise<void> {
    const query = newLeaf ? "?newLeaf=true" : "";
    await this.request(`/open/${encodeURIComponent(normalizeVaultPath(filename))}${query}`, {
      method: "POST",
      responseType: "none",
    });
  }

  async searchVault({ queryType, query }: { queryType: string; query: string }): Promise<unknown> {
    const contentType = queryType === "jsonlogic" ? JSONLOGIC_CONTENT_TYPE : DATAVIEW_DQL_CONTENT_TYPE;
    return this.request("/search/", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: assertText(query, "query"),
      responseType: "json",
    });
  }

  async searchVaultSimple({ query, contextLength }: { query: string; contextLength?: number }): Promise<unknown> {
    const params = new URLSearchParams({ query: assertText(query, "query") });
    if (contextLength !== undefined) {
      params.set("contextLength", `${contextLength}`);
    }

    return this.request(`/search/simple/?${params.toString()}`, {
      method: "POST",
      responseType: "json",
    });
  }

  async listVaultFiles(directory?: string): Promise<unknown> {
    const normalizedDirectory = directory === undefined ? "" : normalizeVaultDirectoryPath(directory);
    const suffix = normalizedDirectory ? `${encodeVaultDirectoryPath(normalizedDirectory)}/` : "";
    return this.request(`/vault/${suffix}`, {
      responseType: "json",
    });
  }

  async getVaultFile(filename: string, { format = "markdown" } = {}): Promise<unknown> {
    const responseType = format === "json" ? "json" : "text";
    const accept = format === "json" ? JSON_NOTE_CONTENT_TYPE : MARKDOWN_CONTENT_TYPE;

    return this.request(`/vault/${encodeVaultPath(filename)}`, {
      headers: { Accept: accept },
      responseType,
    });
  }

  async createVaultFile(filename: string, content: string): Promise<void> {
    await this.request(`/vault/${encodeVaultPath(filename)}`, {
      method: "PUT",
      headers: { "Content-Type": MARKDOWN_CONTENT_TYPE },
      body: assertText(content, "content"),
      responseType: "none",
    });
  }

  async appendToVaultFile(filename: string, content: string): Promise<void> {
    await this.request(`/vault/${encodeVaultPath(filename)}`, {
      method: "POST",
      headers: { "Content-Type": MARKDOWN_CONTENT_TYPE },
      body: assertText(content, "content"),
      responseType: "none",
    });
  }

  async patchVaultFile({ filename, ...args }: PatchArgs & { filename: string }): Promise<unknown> {
    if (args.operation === SEARCH_REPLACE) {
      const current = await this.getVaultFile(filename, { format: "markdown" });
      const { content } = applySearchReplace(current, args.target, args.content);
      await this.createVaultFile(filename, content);
      return content;
    }

    const { headers, body } = buildPatchRequest(args);

    return this.request(`/vault/${encodeVaultPath(filename)}`, {
      method: "PATCH",
      headers,
      body,
      responseType: "text",
    });
  }

  async deleteVaultFile(filename: string): Promise<void> {
    await this.request(`/vault/${encodeVaultPath(filename)}`, {
      method: "DELETE",
      responseType: "none",
    });
  }

  async searchVaultSmart({ query, filter }: { query: string; filter?: SmartSearchFilter }): Promise<unknown> {
    return this.request("/search/smart", {
      method: "POST",
      headers: { "Content-Type": JSON_CONTENT_TYPE },
      body: JSON.stringify({ query: assertText(query, "query"), ...(filter ? { filter } : {}) }),
      responseType: "json",
    });
  }

  async executeTemplate({ name, arguments: templateArguments = {}, createFile = false, targetPath }: {
    name: string;
    arguments?: Record<string, string>;
    createFile?: boolean;
    targetPath?: string;
  }): Promise<unknown> {
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

export function createClientFromEnv(options: ObsidianRestClientOptions = {}): ObsidianRestClient {
  return new ObsidianRestClient(options);
}
