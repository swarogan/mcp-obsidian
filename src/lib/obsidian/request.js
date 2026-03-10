import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS } from "./constants.js";
import { ObsidianApiError } from "./errors.js";

export function parseTimeout(rawValue) {
  const parsed = Number.parseInt(rawValue ?? `${DEFAULT_TIMEOUT_MS}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export function normalizeBaseUrl(baseUrl) {
  const trimmed = String(baseUrl ?? DEFAULT_BASE_URL).trim();
  return trimmed.replace(/\/+$/, "");
}

export function normalizeApiKey(apiKey) {
  if (typeof apiKey !== "string") {
    return undefined;
  }

  const trimmed = apiKey.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function assertText(value, fieldName) {
  if (typeof value !== "string") {
    throw new TypeError(`Pole \`${fieldName}\` musi być stringiem.`);
  }
  return value;
}

export function joinUrl(baseUrl, path) {
  return `${baseUrl}${path}`;
}

export function requireConfiguredApiKey(apiKey) {
  if (!apiKey) {
    throw new Error("Brak OBSIDIAN_API_KEY. Ustaw zmienną środowiskową z kluczem do Local REST API.");
  }
  return apiKey;
}

function assertPlainObject(value, fieldName) {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new TypeError(`Pole \`${fieldName}\` musi być obiektem.`);
  }
  return value;
}

export function assertStringRecord(value, fieldName) {
  const object = assertPlainObject(value, fieldName);
  for (const [key, entry] of Object.entries(object)) {
    if (typeof entry !== "string") {
      throw new TypeError(`Pole \`${fieldName}.${key}\` musi być stringiem.`);
    }
  }
  return object;
}

export async function buildApiError(response) {
  const body = await response.text();
  const detail = body.trim() || response.statusText || "Nieznany błąd";
  return new ObsidianApiError(`Błąd Obsidian Local REST API (${response.status}): ${detail}`, {
    status: response.status,
    body,
  });
}

export async function parseResponse(response, responseType) {
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
