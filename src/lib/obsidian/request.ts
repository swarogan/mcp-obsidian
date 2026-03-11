import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS } from "./constants.js";
import { ObsidianApiError } from "./errors.js";

export function parseTimeout(rawValue: string | undefined): number {
  const parsed = Number.parseInt(rawValue ?? `${DEFAULT_TIMEOUT_MS}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export function normalizeBaseUrl(baseUrl: string | undefined): string {
  const trimmed = String(baseUrl ?? DEFAULT_BASE_URL).trim();
  return trimmed.replace(/\/+$/, "");
}

export function normalizeApiKey(apiKey: string | undefined): string | undefined {
  if (typeof apiKey !== "string") {
    return undefined;
  }

  const trimmed = apiKey.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function assertText(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`Pole \`${fieldName}\` musi być stringiem.`);
  }
  return value;
}

export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}

export function requireConfiguredApiKey(apiKey: string | undefined): string {
  if (!apiKey) {
    throw new Error("Brak OBSIDIAN_API_KEY. Ustaw zmienną środowiskową z kluczem do Local REST API.");
  }
  return apiKey;
}

function assertPlainObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new TypeError(`Pole \`${fieldName}\` musi być obiektem.`);
  }
  return value as Record<string, unknown>;
}

export function assertStringRecord(value: unknown, fieldName: string): Record<string, string> {
  const object = assertPlainObject(value, fieldName);
  for (const [key, entry] of Object.entries(object)) {
    if (typeof entry !== "string") {
      throw new TypeError(`Pole \`${fieldName}.${key}\` musi być stringiem.`);
    }
  }
  return object as Record<string, string>;
}

export async function buildApiError(response: Response): Promise<ObsidianApiError> {
  const body = await response.text();
  const detail = body.trim() || response.statusText || "Nieznany błąd";
  return new ObsidianApiError(`Błąd Obsidian Local REST API (${response.status}): ${detail}`, {
    status: response.status,
    body,
  });
}

export function parseResponse(response: Response, responseType: string): Promise<unknown> | null {
  if (response.status === 204 || responseType === "none") {
    return null;
  }

  if (responseType === "json") {
    return response.json();
  }

  if (responseType === "text") {
    return response.text();
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("json") ? response.json() : response.text();
}
