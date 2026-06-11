// src/cli/index.ts — the `badge` CLI entry. Commander wiring for the 8-command tree
// (PLAN §4). Every command flows through dispatch() (src/cli/dispatch.ts) so the
// observability seam fires once per invocation for ALL commands. Global --json on every
// command (EM JTBD-9 / OP O34). TS strict, Node 20+. Run via bin/badge (tsx loader).

import { Command } from "commander";
import { dispatch } from "./dispatch.js";
import { classify } from "./classify.js";
import { initProvider } from "./init.js";
import { audit } from "./audit.js";
import { samlTriage } from "./saml-triage.js";
import { advise } from "./advise.js";
import { migrate } from "./migrate.js";
import { mcpCheck } from "./mcp-check.js";
import { runsView } from "./runs.js";

const program = new Command();

program
  .name("badge")
  .description(
    "Auth employee — AuthN/AuthZ/SSO + agent identity. Scaffolds, classifies (P1-P4), audits OAuth/MCP, triages SAML.",
  )
  .version("0.1.0", "-v, --version", "print badge version")
  .option("--json", "emit structured JSON instead of human-readable output");

// Helper: read the merged --json flag (global or command-level).
function wantsJson(cmd: Command): boolean {
  return Boolean(cmd.optsWithGlobals().json);
}

program
  .command("init")
  .description("scaffold auth into a target app to a working sign-in→protected-route flow (the acceptance test)")
  .requiredOption("--provider <provider>", "clerk | betterauth | workos | stytch")
  .option("--target <dir>", "target app directory", process.cwd())
  .option("--json", "emit structured JSON")
  .action(async (opts, cmd: Command) => {
    const json = wantsJson(cmd);
    await dispatch({ cmd: "init", jtbd: 1 }, json, () =>
      initProvider({ provider: opts.provider, target: opts.target }),
    );
  });

program
  .command("classify")
  .description("place plane (1/2) + classify P1-P4, return the default tool + why (badge's core verb)")
  .argument("<task>", "the agent-auth task description")
  .option("--json", "emit structured JSON")
  .action(async (task: string, _opts, cmd: Command) => {
    const json = wantsJson(cmd);
    await dispatch({ cmd: "classify", jtbd: 4 }, json, () => classify(task));
  });

program
  .command("advise")
  .description("a DECISION with $ breakpoints + the boring-enterprise checklist, not a feature table (OP O5)")
  .requiredOption("--use-case <useCase>", "consumer | b2b | enterprise | self-host")
  .option("--mau <n>", "monthly active users (for $ breakpoints)")
  .option("--enterprise", "include the enterprise SSO/SCIM checklist", false)
  .option("--json", "emit structured JSON")
  .action(async (opts, cmd: Command) => {
    const json = wantsJson(cmd);
    await dispatch({ cmd: "advise", jtbd: 2 }, json, () =>
      advise({
        useCase: opts.useCase,
        mau: opts.mau ? Number(opts.mau) : undefined,
        enterprise: Boolean(opts.enterprise),
      }),
    );
  });

program
  .command("audit")
  .description("run the pitfall checklist (PKCE method, RFC-8707 bind, account-linking, rotation, redirect, alg=none)")
  .argument("<path>", "path to the auth/OAuth/MCP config or code to audit")
  .option("--mcp", "audit as an MCP server OAuth config", false)
  .option("--scim", "audit SCIM provisioning", false)
  .option("--agent", "audit agent-authorization design", false)
  .option("--saml", "audit SAML/SSO config", false)
  .option("--json", "emit structured JSON")
  .action(async (path: string, opts, cmd: Command) => {
    const json = wantsJson(cmd);
    const kind = opts.mcp ? "mcp" : opts.scim ? "scim" : opts.agent ? "agent" : opts.saml ? "saml" : undefined;
    await dispatch({ cmd: "audit", jtbd: 5 }, json, () => audit({ path, kind }));
  });

program
  .command("saml-triage")
  .description("the 7-step SSO/SAML triage runbook (timestamps→cert→ACS→Issuer→Audience→sig-alg→Destination)")
  .argument("<symptom>", "the production SSO/SAML failure symptom")
  .option("--json", "emit structured JSON")
  .action(async (symptom: string, _opts, cmd: Command) => {
    const json = wantsJson(cmd);
    await dispatch({ cmd: "saml-triage", jtbd: 7 }, json, () => samlTriage(symptom));
  });

program
  .command("migrate")
  .description("the dual-validation-window plan + the four casualties (sessions, SSO, social links, claims)")
  .requiredOption("--from <provider>", "the source provider")
  .requiredOption("--to <provider>", "the target provider")
  .option("--json", "emit structured JSON")
  .action(async (opts, cmd: Command) => {
    const json = wantsJson(cmd);
    await dispatch({ cmd: "migrate", jtbd: 8 }, json, () =>
      migrate({ from: opts.from, to: opts.to }),
    );
  });

program
  .command("mcp-check")
  .description("drive PRM→ASM→DCR/CIMD→authorize→token→tools/list against an MCP server; report 2025-11-25 spec gaps")
  .argument("<url>", "the MCP server base URL")
  .option("--json", "emit structured JSON")
  .action(async (url: string, _opts, cmd: Command) => {
    const json = wantsJson(cmd);
    await dispatch({ cmd: "mcp-check", jtbd: 5 }, json, () => mcpCheck(url));
  });

program
  .command("runs")
  .description("aggregate logs/runs.jsonl (the observability view)")
  .option("--since <ts>", "only include runs at or after this ISO timestamp")
  .option("--json", "emit structured JSON")
  .action(async (opts, cmd: Command) => {
    const json = wantsJson(cmd);
    await dispatch({ cmd: "runs", jtbd: null }, json, () => runsView({ since: opts.since }));
  });

program.parseAsync(process.argv);
