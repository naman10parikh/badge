// src/cli/init.ts — `badge init --provider clerk --target <dir>` (B3): scaffold auth into
// a target Next.js app to a working sign-in→protected-route flow (THE acceptance test).
// Clerk is the C1 bar (HS1); betterauth/workos/stytch are recognized targets but stubbed
// (smoke-only, not CI-gated). Idempotent: each file is written atomically (temp + rename)
// so a kill mid-init leaves either the old file intact or the fully-written new one —
// never a half-written/broken app (PLAN §9 chaos-a). Keys read from env, never hard-coded.

import { mkdirSync, writeFileSync, renameSync, existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { BadgeError } from "./output.js";
import type { HandlerResult } from "./dispatch.js";
import { clerkTemplate, CLERK_NEXTJS_VERSION, type TemplateFile } from "./templates/clerk.js";

export type Provider = "clerk" | "betterauth" | "workos" | "stytch";

export interface InitResult {
  provider: Provider;
  target: string;
  /** the files written (target-relative). */
  written: string[];
  /** the dependency pinned into the target package.json, if any. */
  pinned: string | null;
  notes: string[];
  /** false for the stubbed providers (not the C1 acceptance bar). */
  scaffolded: boolean;
}

const KNOWN_PROVIDERS: Provider[] = ["clerk", "betterauth", "workos", "stytch"];

/** Atomically write a file: temp file in the same dir, then rename (POSIX-atomic). */
function atomicWrite(absPath: string, content: string): void {
  mkdirSync(dirname(absPath), { recursive: true });
  const tmp = `${absPath}.badge-tmp-${process.pid}`;
  try {
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, absPath); // atomic: a kill before this leaves the old file; after, the new one.
  } catch (err) {
    // Clean up the temp file on failure so no .badge-tmp-* litter remains (chaos-a hygiene).
    try {
      if (existsSync(tmp)) rmSync(tmp);
    } catch {
      // best-effort cleanup; the original error is what matters.
    }
    throw new BadgeError(`failed to write ${absPath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Pin @clerk/nextjs into the target's package.json (creates a minimal one if absent). */
function pinClerkDependency(target: string): string {
  const pkgPath = join(target, "package.json");
  let pkg: { dependencies?: Record<string, string>; name?: string; [k: string]: unknown };
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch {
      throw new BadgeError(`target package.json at ${pkgPath} is not valid JSON — fix it before scaffolding`);
    }
  } else {
    // No package.json yet (bare target) — create a minimal one so the pin has a home.
    pkg = { name: "badge-scaffolded-app", dependencies: {} };
  }
  pkg.dependencies = pkg.dependencies ?? {};
  // Idempotent: only set if missing or different, so re-running doesn't churn the file.
  if (pkg.dependencies["@clerk/nextjs"] !== CLERK_NEXTJS_VERSION) {
    pkg.dependencies["@clerk/nextjs"] = CLERK_NEXTJS_VERSION;
    atomicWrite(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }
  return `@clerk/nextjs@${CLERK_NEXTJS_VERSION}`;
}

/** Resolve Clerk keys from env; fall back to explicit placeholders (never hard-code a real key). */
function resolveClerkEnv(): { publishableKey: string; secretKey: string; usedEnv: boolean } {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const sk = process.env.CLERK_SECRET_KEY;
  return {
    publishableKey: pk ?? "pk_test_REPLACE_ME_provision_at_dashboard.clerk.com",
    secretKey: sk ?? "sk_test_REPLACE_ME_provision_at_dashboard.clerk.com",
    usedEnv: Boolean(pk && sk),
  };
}

function scaffoldClerk(target: string): InitResult {
  const env = resolveClerkEnv();
  const files: TemplateFile[] = clerkTemplate({ publishableKey: env.publishableKey, secretKey: env.secretKey });

  const written: string[] = [];
  for (const f of files) {
    atomicWrite(join(target, f.path), f.content);
    written.push(f.path);
  }
  const pinned = pinClerkDependency(target);

  const notes = [
    "middleware.ts protects /dashboard explicitly — Clerk Core 3 clerkMiddleware() protects NOTHING by default (KP-D2).",
    "auth() is async in Core 3 and is awaited in app/dashboard/page.tsx (KP-D2).",
    `@clerk/nextjs pinned to ${CLERK_NEXTJS_VERSION} — bump deliberately, gated behind the acceptance E2E (OP O10, Risk #1).`,
    env.usedEnv
      ? "Clerk keys taken from the environment (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY)."
      : "Clerk keys NOT in env — .env.local written with pk_test_/sk_test_ placeholders. Provision test keys (PLAN §8) before the sign-in E2E.",
  ];

  return { provider: "clerk", target, written, pinned, notes, scaffolded: true };
}

/** Stub for the non-Clerk providers — recognized targets, but not the C1 acceptance bar (HS1). */
function scaffoldStub(provider: Provider, target: string): InitResult {
  return {
    provider,
    target,
    written: [],
    pinned: null,
    notes: [
      `${provider} is a recognized init target but NOT the C1 acceptance bar — Clerk-only is CI-gated (HS1, PLAN §14).`,
      `badge reasons about ${provider} from the brain (see badge advise / badge classify); a full ${provider} scaffold is a post-C1 add.`,
    ],
    scaffolded: false,
  };
}

/**
 * Scaffold auth into a target app.
 * @param opts provider (required) + target dir (defaults to cwd at the CLI layer).
 */
export function initProvider(opts: { provider: string; target: string }): HandlerResult {
  const provider = opts.provider.toLowerCase() as Provider;
  if (!KNOWN_PROVIDERS.includes(provider)) {
    // PLAN §9 chaos-b: bad provider → clear message + non-zero exit, no crash.
    throw new BadgeError(`unknown provider "${opts.provider}" — expected one of: ${KNOWN_PROVIDERS.join(" | ")}`);
  }
  const target = opts.target;
  // Ensure the target dir exists (init can scaffold into a fresh create-next-app or a bare dir).
  mkdirSync(target, { recursive: true });

  const result = provider === "clerk" ? scaffoldClerk(target) : scaffoldStub(provider, target);
  return { data: result, human: renderHuman(result) };
}

function renderHuman(r: InitResult): string[] {
  const lines = [
    `init:        ${r.provider} → ${r.target}`,
    `scaffolded:  ${r.scaffolded}`,
  ];
  if (r.written.length > 0) {
    lines.push("", "files written:");
    lines.push(...r.written.map((w) => `  + ${w}`));
  }
  if (r.pinned) lines.push("", `pinned:      ${r.pinned}`);
  lines.push("", "notes:");
  lines.push(...r.notes.map((n) => `  - ${n}`));
  return lines;
}
