/**
 * JSON helpers.
 *
 * SQLite has no array/JSON column type, so list-like fields (skills, tags,
 * interests...) are persisted as JSON strings. These helpers are the only
 * place that conversion happens, so every repository reuses the same logic
 * instead of repeating `JSON.parse` with try/catch everywhere (DRY).
 */

export const parseJsonArray = (value: string | null | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

export const parseJsonRecord = <T = Record<string, unknown>>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
};

export const parseNumberArray = (value: string | null | undefined): number[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
};

export const stringify = (value: unknown): string => JSON.stringify(value ?? null);

/** Normalises a user supplied list: trims, removes empties and duplicates. */
export const normalizeList = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const item = String(raw).trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};
