import type { ActivityItem, AddedToken, PendingUnwrap } from "../types";

const namespace = "zama-wrapper-registry";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${namespace}:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(`${namespace}:${key}`, JSON.stringify(value));
}

export function readActivity(account?: string): ActivityItem[] {
  return readJson<ActivityItem[]>(`activity:${account?.toLowerCase() ?? "readonly"}`, []);
}

export function writeActivity(items: ActivityItem[], account?: string): void {
  writeJson(`activity:${account?.toLowerCase() ?? "readonly"}`, items.slice(0, 80));
}

export function readPendingUnwraps(account?: string): PendingUnwrap[] {
  return readJson<PendingUnwrap[]>(`pending-unwraps:${account?.toLowerCase() ?? "readonly"}`, []);
}

export function writePendingUnwraps(items: PendingUnwrap[], account?: string): void {
  writeJson(`pending-unwraps:${account?.toLowerCase() ?? "readonly"}`, items);
}

export function readAddedTokens(account?: string): AddedToken[] {
  return readJson<AddedToken[]>(`added-tokens:${account?.toLowerCase() ?? "readonly"}`, []);
}

export function writeAddedTokens(items: AddedToken[], account?: string): void {
  writeJson(`added-tokens:${account?.toLowerCase() ?? "readonly"}`, items);
}

export function readDecryptCache(): Record<string, { value: string; lastDecryptedAt: number }> {
  return readJson("decrypt-cache", {});
}

export function writeDecryptCache(cache: Record<string, { value: string; lastDecryptedAt: number }>): void {
  writeJson("decrypt-cache", cache);
}
