// src/cli/mcp-check.ts — `badge mcp-check <url>` (B4e): drive the MCP-OAuth discovery
// dance against a server and report 2025-11-25 spec gaps. Wraps MCP Inspector semantics
// (OP O25): 401 → PRM (.well-known/oauth-protected-resource) → ASM
// (.well-known/oauth-authorization-server) → registration (CIMD>DCR) → authorize/token →
// tools/list. The ONE network-touching verb — it degrades gracefully offline (PLAN §9
// chaos no-network: returns reachable:false with a clear message, never crashes).
// Grounded in EM JTBD-5, KP-E, OP O23/O24/O25/O35.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { BadgeError } from "./output.js";
import type { HandlerResult } from "./dispatch.js";

export interface McpCheckResult {
  url: string;
  reachable: boolean;
  /** the discovery probe that ran first, and what came back. */
  discovered: { prm: boolean; asm: boolean; www_authenticate: string | null };
  /** which registration mechanism the AS advertises (CIMD preferred — OP O24). */
  registration: "cimd" | "dcr" | "pre-registered" | "unknown";
  pkce_method: "S256" | "plain" | "unknown";
  audience_bound: "checked" | "unverified";
  /** the spec gaps found, each cited. */
  gaps: string[];
  /** the next action for the operator. */
  next: string;
  cites: string[];
}

const TIMEOUT_MS = 5000;

/** Normalize a base URL (lowercase scheme/host, no fragment) per the canonical-URI rule. */
function canonical(url: string): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new BadgeError(`invalid URL "${url}" — pass an absolute MCP server URL, e.g. https://example.com/mcp`);
  }
  if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
    throw new BadgeError(`"${url}" is not HTTPS — MCP OAuth requires HTTPS except for localhost (EM 5.1)`);
  }
  u.hash = "";
  return u;
}

// SSRF guard (KP-A4 / GHSA-5rr4-8452-hf4v): discovery-by-URL is an SSRF vector. The brain's
// own AVOID is explicit — "block internal IP ranges (RFC 1918, link-local, metadata
// endpoints) on metadata fetch." badge is an auth employee whose brain flags exactly this
// pitfall, so the verb that does the metadata fetch MUST NOT commit it. Loopback (127/8,
// ::1) stays allowed: it is the documented localhost-dev case (EM 5.1) used to point
// mcp-check at a local MCP server.

/** True for an IP literal that targets an internal/link-local/metadata range (NOT loopback). */
function isInternalIp(addr: string): boolean {
  const a = addr.toLowerCase();
  // Loopback is the intentional exception (localhost dev) — never treated as internal here.
  if (a === "::1" || a.startsWith("127.")) return false;
  if (isIP(addr) === 4) {
    const o = addr.split(".").map(Number);
    if (o.length !== 4 || o.some((n) => Number.isNaN(n))) return true; // malformed → reject
    if (o[0] === 10) return true; // 10.0.0.0/8 (RFC 1918)
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true; // 172.16.0.0/12 (RFC 1918)
    if (o[0] === 192 && o[1] === 168) return true; // 192.168.0.0/16 (RFC 1918)
    if (o[0] === 169 && o[1] === 254) return true; // 169.254.0.0/16 link-local + cloud metadata
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true; // 100.64.0.0/10 (CGNAT, RFC 6598)
    if (o[0] === 0) return true; // 0.0.0.0/8 (this-host)
    return false;
  }
  // IPv6: strip a zone id, normalize, then range-check link-local / ULA / mapped/metadata.
  const v6 = a.replace(/%.*$/, "");
  if (v6.startsWith("fe80:")) return true; // link-local
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // unique-local fc00::/7
  if (v6 === "::") return true; // unspecified
  // IPv4-mapped — Node may render the tail as dotted-quad (::ffff:169.254.169.254) OR as
  // two hextets (::ffff:a9fe:a9fe). Decode either and re-check the embedded v4.
  if (v6.startsWith("::ffff:")) {
    const tail = v6.slice("::ffff:".length);
    if (isIP(tail) === 4) return isInternalIp(tail);
    const hx = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail);
    if (hx) {
      const hi = parseInt(hx[1], 16);
      const lo = parseInt(hx[2], 16);
      const dotted = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isInternalIp(dotted);
    }
  }
  return false;
}

/**
 * Resolve the URL's host and reject any internal/link-local/metadata target before any
 * network touch (KP-A4 SSRF). DNS names are resolved first because a name like
 * `metadata.google.internal` resolves to 169.254.169.254. Throws BadgeError on a hit.
 */
async function assertNotInternal(u: URL): Promise<void> {
  // url.hostname keeps the brackets on an IPv6 literal ([::ffff:a9fe:a9fe]) — strip them so
  // isIP() recognizes it; otherwise a bracketed-IPv6 SSRF target slips to the DNS path.
  const host = u.hostname.replace(/^\[/, "").replace(/\]$/, "");
  // Hostnames that name the metadata service directly (never resolved on a dev box).
  if (/(^|\.)metadata\.google\.internal$/i.test(host) || host.toLowerCase() === "metadata") {
    throw new BadgeError(
      `refusing to fetch "${u.href}" — host targets a cloud metadata endpoint (KP-A4 SSRF; the brain's own AVOID blocks internal/metadata targets).`,
    );
  }
  // An IP literal — check it directly.
  if (isIP(host) !== 0) {
    if (isInternalIp(host)) {
      throw new BadgeError(
        `refusing to fetch "${u.href}" — host is an internal/link-local IP (KP-A4 SSRF; allowlist OIDC issuer hosts, block RFC-1918/link-local/metadata ranges).`,
      );
    }
    return;
  }
  // localhost is the documented dev exception — it resolves to loopback, allow it.
  if (host.toLowerCase() === "localhost") return;
  // A DNS name — resolve and reject if ANY resolved address is internal (DNS-rebinding /
  // metadata aliasing defense). A resolution failure is left to tryFetch's offline path.
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    return; // unresolvable host → tryFetch returns null → graceful offline result
  }
  for (const { address } of addrs) {
    if (isInternalIp(address)) {
      throw new BadgeError(
        `refusing to fetch "${u.href}" — host "${host}" resolves to an internal/link-local IP ${address} (KP-A4 SSRF).`,
      );
    }
  }
}

/** Fetch with a hard timeout; returns null on any network failure (offline-graceful). */
async function tryFetch(url: string, init?: RequestInit): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    // Network error / DNS failure / timeout — the offline case. Not fatal (chaos no-network).
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Drive the MCP-OAuth discovery dance against a server and report spec gaps.
 * @param url the MCP server base URL.
 */
export async function mcpCheck(url: string): Promise<HandlerResult> {
  const u = canonical(url);
  // SSRF gate BEFORE any network touch — reject internal/link-local/metadata targets
  // (KP-A4). This is the auth employee refusing to commit the SSRF pitfall its own brain
  // documents. Throws BadgeError → dispatch maps to a clean non-zero exit / MCP tool error.
  await assertNotInternal(u);
  const base = `${u.origin}`;

  // Step 1 — probe the MCP endpoint unauthenticated; expect a 401 with WWW-Authenticate.
  const probe = await tryFetch(u.href, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  if (probe === null) {
    // Offline / unreachable — degrade with a clear message (PLAN §9 chaos no-network).
    const offline: McpCheckResult = {
      url: u.href,
      reachable: false,
      discovered: { prm: false, asm: false, www_authenticate: null },
      registration: "unknown",
      pkce_method: "unknown",
      audience_bound: "unverified",
      gaps: ["could not reach the server (offline, DNS failure, or timeout) — discovery not attempted"],
      next: "re-run with network access; mcp-check is the only badge verb that needs the network (classify/advise/audit/saml-triage work offline).",
      cites: ["EM-JTBD-5", "OP-O35"],
    };
    return { data: offline, human: renderHuman(offline) };
  }

  const wwwAuth = probe.headers.get("www-authenticate");

  // Step 2 — PRM: .well-known/oauth-protected-resource (RFC 9728; SEP-985 allows it without the 401 header).
  const prmRes = await tryFetch(`${base}/.well-known/oauth-protected-resource`);
  const prmOk = prmRes !== null && prmRes.ok;
  let asUrl: string | null = null;
  if (prmOk && prmRes) {
    try {
      const prm = (await prmRes.json()) as { authorization_servers?: string[] };
      asUrl = prm.authorization_servers?.[0] ?? null;
    } catch {
      // PRM not valid JSON — treat as a gap below.
    }
  }

  // Step 3 — ASM: .well-known/oauth-authorization-server (RFC 8414).
  const asmTarget = asUrl ? `${asUrl.replace(/\/$/, "")}/.well-known/oauth-authorization-server` : `${base}/.well-known/oauth-authorization-server`;
  const asmRes = await tryFetch(asmTarget);
  const asmOk = asmRes !== null && asmRes.ok;
  let registration: McpCheckResult["registration"] = "unknown";
  let pkce: McpCheckResult["pkce_method"] = "unknown";
  const gaps: string[] = [];

  if (asmOk && asmRes) {
    try {
      const asm = (await asmRes.json()) as {
        registration_endpoint?: string;
        client_id_metadata_document_supported?: boolean;
        code_challenge_methods_supported?: string[];
        id_token_signing_alg_values_supported?: string[];
      };
      // CIMD > DCR > pre-registered (OP O24).
      if (asm.client_id_metadata_document_supported) registration = "cimd";
      else if (asm.registration_endpoint) registration = "dcr";
      else registration = "pre-registered";

      const methods = asm.code_challenge_methods_supported ?? [];
      if (methods.includes("S256")) pkce = "S256";
      else if (methods.includes("plain")) pkce = "plain";

      // Spec-gap checks against 2025-11-25 (KP-E1/E2, OP O23/O24).
      if (pkce !== "S256") gaps.push("PKCE S256 not advertised in code_challenge_methods_supported (KP-A2; `plain` is banned by RFC 9700 §2.1.1).");
      if (methods.includes("plain")) gaps.push("`plain` PKCE advertised — must be removed (KP-A2).");
      if ((asm.id_token_signing_alg_values_supported ?? []).includes("none")) gaps.push("`alg=none` advertised in id_token_signing_alg_values_supported (KP-A2; unsigned-token risk).");
      if (registration === "dcr") gaps.push("AS advertises DCR but not CIMD — SEP-991 (2025-11-25) makes CIMD the recommended mechanism; prefer CIMD > DCR > pre-registered (KP-E2 / OP O24).");
    } catch {
      gaps.push("authorization-server metadata is not valid JSON.");
    }
  } else {
    gaps.push("authorization-server metadata (.well-known/oauth-authorization-server) not reachable — cannot verify registration / PKCE / signing alg (KP-E5).");
  }

  if (!prmOk) gaps.push("protected-resource metadata (.well-known/oauth-protected-resource) not reachable — discovery should start here (EM 9.1 / SEP-985).");
  if (probe.status !== 401 && !wwwAuth) gaps.push(`unauthenticated probe returned ${probe.status} without a WWW-Authenticate: Bearer header — expected 401 → resource_metadata pointer (EM 5.1).`);

  const result: McpCheckResult = {
    url: u.href,
    reachable: true,
    discovered: { prm: prmOk, asm: asmOk, www_authenticate: wwwAuth },
    registration,
    pkce_method: pkce,
    audience_bound: "unverified", // verifying RFC-8707 binding needs a full token round-trip (Inspector) — not done statically here.
    gaps,
    next:
      gaps.length === 0
        ? "discovery clean against 2025-11-25 — complete a full token round-trip with MCP Inspector to verify the RFC-8707 audience bind (OP O25)."
        : "fix the gaps above; then run a full 401→PRM→ASM→register→authorize→token→tools/list round-trip with MCP Inspector (OP O25).",
    cites: ["EM-JTBD-5", "KP-E1", "OP-O23", "OP-O24", "OP-O25"],
  };
  return { data: result, human: renderHuman(result) };
}

function renderHuman(r: McpCheckResult): string[] {
  const lines = [
    `mcp-check:   ${r.url}`,
    `reachable:   ${r.reachable}`,
    `discovered:  PRM=${r.discovered.prm} ASM=${r.discovered.asm} WWW-Authenticate=${r.discovered.www_authenticate ?? "—"}`,
    `registration:${r.registration}   pkce: ${r.pkce_method}   audience-bound: ${r.audience_bound}`,
    "",
  ];
  if (r.gaps.length === 0) {
    lines.push("✓ no spec gaps detected against 2025-11-25.");
  } else {
    lines.push(`spec gaps (${r.gaps.length}):`);
    lines.push(...r.gaps.map((g) => `  - ${g}`));
  }
  lines.push("", `next:        ${r.next}`, `cites:       ${r.cites.join(", ")}`);
  return lines;
}
