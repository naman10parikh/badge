# badge — LEARNINGS (append-only)

Every error → root cause → rule. Auto-compressed when >500 lines (memory-compress.sh).

## 2026-10-19 · CP158 standard pass

- **Skill frontmatter that does not parse is silently dropped.** All five `skills/*/SKILL.md` had
  `trigger: "a", "b"`, which is not valid YAML, so Claude Code loaded each skill with no name and no
  description. Rule: write a list as `trigger: ["a", "b"]`, quote any description that holds `#` or `: `,
  and run `claude plugin validate skills` after touching a skill.
- **A git install drops `dist/`.** npm packs a git dependency with the `.gitignore` rules when there is no
  `files` field or `.npmignore`, so a `prepare` build is thrown away. Rule: the bins load the TypeScript
  source through tsx (a runtime dependency) when `dist/` is missing; prove it with
  `npx -y -p github:naman10parikh/badge badge --help` from an empty folder.
- **A dry-run loop is not a self-improvement loop.** The scheduled RSI run used `--dry-run`, which writes
  nothing, so it proposed nothing. Rule: the schedule runs live, keeps its snapshot in the Actions cache,
  and uploads the `brain/` diff as a proposal; a person merges.
