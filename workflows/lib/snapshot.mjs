// workflows/lib/snapshot.mjs — snapshot + diff helpers for the deterministic RSI engine (E4).
//
// The refresh-brain step fetches the TM-watchlist sources, hashes each response, and stores
// the hashes in a snapshot file. On the next cycle it diffs the new hashes against the stored
// ones; a changed hash = a watched fact moved = flag the affected brain file + write a delta
// to brain/ORG_MEMORY.md (it does NOT auto-rewrite the brain — that's the Claude half, D8).
// Zero deps (node:crypto + node:fs). Never throws on a fetch/IO error — RSI is best-effort.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** SHA-256 hex of a string (stable content fingerprint for diffing). */
export function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

/** Read the JSON snapshot of last cycle's watchlist hashes ({ [sourceId]: hash }). */
export function readSnapshot(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {}; // corrupt snapshot → treat as empty (a full re-check, not a crash).
  }
}

/** Write the snapshot JSON (creates the dir if needed). Best-effort. */
export function writeSnapshot(path, snapshot) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(snapshot, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch a URL with a hard timeout; return its text, or null on any failure (offline-safe).
 * @param {string} url
 * @param {number} timeoutMs
 */
export async function tryFetchText(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "badge-rsi/0.1" } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Diff new hashes against a snapshot. Returns the list of source ids whose hash changed
 * (or are newly present). A first-ever run reports everything as "new" (changed=true).
 * @param {Record<string,string>} prev  last cycle's { id: hash }
 * @param {Record<string,string>} next  this cycle's { id: hash }
 */
export function diffHashes(prev, next) {
  const changed = [];
  for (const [id, hash] of Object.entries(next)) {
    if (prev[id] !== hash) changed.push(id);
  }
  return changed;
}
