// src/cli/templates/clerk.ts — the Clerk + Next.js App Router scaffold templates that
// `badge init --provider clerk` writes (B3). Each entry is a target-relative path → file
// content. The scaffold pre-empts the #1 Clerk footgun: clerkMiddleware() protects NOTHING
// by default (KP-D2) — the matcher here explicitly covers /dashboard. Keys are read from
// env, NEVER hard-coded (PLAN §5). @clerk/nextjs is pinned (Risk #1 — Core 3 churn).
//
// Content is held as string constants (not copied from disk) so init works identically
// whether run via tsx (src/) or after `pnpm build` (dist/) — no runtime path resolution.

/** A scaffolded file: a target-relative path + its content. */
export interface TemplateFile {
  /** path relative to the target app root. */
  path: string;
  content: string;
}

// Pinned Clerk version — bump deliberately, gated behind the acceptance E2E (OP O10, Risk #1).
export const CLERK_NEXTJS_VERSION = "^6.34.1";

// middleware.ts — clerkMiddleware() + a matcher that COVERS /dashboard (pre-empts KP-D1/D2/F1).
// Without an explicit protect, Core 3 clerkMiddleware() protects nothing — so we both run the
// middleware on /dashboard AND call auth.protect() for that route.
const MIDDLEWARE_TS = `import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that REQUIRE a signed-in user. clerkMiddleware() protects NOTHING by default
// (Clerk Core 3 — the #1 footgun); we opt /dashboard in explicitly.
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    // Redirects an unauthenticated request to the sign-in route (KP-D1/D2 pre-empted).
    await auth.protect();
  }
});

export const config = {
  // Run on everything except Next.js internals + static files, and always on API routes.
  matcher: [
    "/((?!_next|[^?]*\\\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
`;

// app/layout.tsx — root layout wrapped in <ClerkProvider> (required for auth() to work).
const LAYOUT_TSX = `import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "badge-scaffolded app",
  description: "Auth scaffolded by badge (Clerk + Next.js App Router).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
`;

// app/page.tsx — a public home page with sign-in / dashboard links + the signed-in marker.
const PAGE_TSX = `import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <main style={{ padding: 48, fontFamily: "system-ui" }}>
      <h1>badge-scaffolded app</h1>
      <SignedOut>
        <p>You are signed out.</p>
        <Link href="/sign-in">Sign in</Link>
      </SignedOut>
      <SignedIn>
        <p>You are signed in.</p>
        <UserButton />
        <p>
          <Link href="/dashboard">Go to your dashboard</Link>
        </p>
      </SignedIn>
    </main>
  );
}
`;

// app/sign-in/[[...sign-in]]/page.tsx — Clerk's hosted <SignIn> catch-all route.
const SIGN_IN_TSX = `import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main style={{ display: "flex", justifyContent: "center", padding: 48 }}>
      <SignIn />
    </main>
  );
}
`;

// app/dashboard/page.tsx — the PROTECTED route. auth() resolves the signed-in user; the
// middleware already gates access, this asserts it server-side too (defense in depth).
// force-dynamic: a protected, user-specific route MUST render per-request, never be
// statically prerendered at build — Next 16 SSGs auth routes aggressively, and prerendering
// a per-user dashboard both fails on the build-time key check and is semantically wrong.
const DASHBOARD_TSX = `import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

// Render this protected route per-request (it depends on the signed-in user), so Next
// never tries to statically prerender it at build time.
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  // auth() is ASYNC in Core 3 — must be awaited (KP-D2).
  const { userId } = await auth();
  const user = await currentUser();
  return (
    <main style={{ padding: 48, fontFamily: "system-ui" }}>
      <h1>Dashboard</h1>
      <p data-testid="signed-in-marker">Signed in as {user?.primaryEmailAddress?.emailAddress ?? userId}</p>
      <UserButton />
    </main>
  );
}
`;

// .env.local — the SHAPE only. Keys come from the environment at scaffold time; nothing is
// hard-coded into the repo (PLAN §5; the secret-hygiene rule). If env keys are absent the
// placeholders make the requirement explicit and `next build` still compiles.
function envLocal(pk: string, sk: string): string {
  return `# Clerk test-instance keys (scaffolded by badge). NEVER commit this file.
# Provision at dashboard.clerk.com (test instance) — pk_test_… / sk_test_… (PLAN §8).
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${pk}
CLERK_SECRET_KEY=${sk}

# Route Clerk's hosted UI to the scaffolded sign-in path.
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
`;
}

/**
 * Build the full Clerk scaffold file set for a target app.
 * @param env the resolved publishable + secret keys (placeholders when env is unset).
 */
export function clerkTemplate(env: { publishableKey: string; secretKey: string }): TemplateFile[] {
  return [
    { path: "middleware.ts", content: MIDDLEWARE_TS },
    { path: "app/layout.tsx", content: LAYOUT_TSX },
    { path: "app/page.tsx", content: PAGE_TSX },
    { path: "app/sign-in/[[...sign-in]]/page.tsx", content: SIGN_IN_TSX },
    { path: "app/dashboard/page.tsx", content: DASHBOARD_TSX },
    { path: ".env.local", content: envLocal(env.publishableKey, env.secretKey) },
  ];
}
