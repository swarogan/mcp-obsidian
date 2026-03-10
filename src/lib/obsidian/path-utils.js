export function normalizeVaultPath(input) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new TypeError("Pole `filename` musi być niepustym stringiem.");
  }

  const normalized = input.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
  const segments = normalized.split("/");

  if (
    normalized === "" ||
    normalized.endsWith("/") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new TypeError("Ścieżka pliku vault jest nieprawidłowa.");
  }

  return segments.join("/");
}

export function normalizeVaultDirectoryPath(input, { allowEmpty = false } = {}) {
  if (input === undefined || input === null) {
    if (allowEmpty) {
      return "";
    }
    throw new TypeError("Pole `directory` musi być stringiem.");
  }

  if (typeof input !== "string") {
    throw new TypeError("Pole `directory` musi być stringiem.");
  }

  const normalized = input.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
  if (normalized === "") {
    if (allowEmpty) {
      return "";
    }
    throw new TypeError("Ścieżka katalogu vault jest nieprawidłowa.");
  }

  const segments = normalized.split("/");
  if (
    normalized.endsWith("/") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new TypeError("Ścieżka katalogu vault jest nieprawidłowa.");
  }

  return segments.join("/");
}

export function encodeVaultPath(input) {
  return normalizeVaultPath(input)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function encodeVaultDirectoryPath(input) {
  const normalized = normalizeVaultDirectoryPath(input);
  return normalized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
