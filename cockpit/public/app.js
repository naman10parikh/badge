// app.js — badge cockpit SPA. Vanilla JS, zero deps, no build step.
// Four views (brain / runs / evals / ask). Talks to the stdlib server's /api/* routes,
// which shell out to the badge CLI. This file is the chairman's presentation layer only.

"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** escape HTML so brain markdown / CLI text can never inject markup. */
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------- markdown ---
// A deliberately small markdown→HTML renderer (zero-dep contract — no marked/remark).
// Handles what the brain files use: # ## ### headers, **bold**, *italic*, `code`,
// fenced ```code```, > blockquote, - / 1. lists, --- rules, and GitHub pipe tables.
// Not a full CommonMark engine — just enough to render badge's own docs readably.
function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  const inline = (t) => {
    // escape first, then re-introduce the small set of inline markup.
    let s = esc(t);
    s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${c}</strong>`);
    s = s.replace(/\*([^*]+)\*/g, (_, c) => `<em>${c}</em>`);
    // [text](url) → link (open in new tab, rel-safe). URLs are escaped above.
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`);
    return s;
  };

  while (i < lines.length) {
    const line = lines[i];

    // YAML frontmatter block at the very top — render as nothing (it's metadata).
    if (i === 0 && line.trim() === "---") {
      i++;
      while (i < lines.length && lines[i].trim() !== "---") i++;
      i++; // skip closing ---
      continue;
    }

    // fenced code block
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(esc(lines[i]));
        i++;
      }
      i++; // skip closing fence
      out.push(`<pre>${buf.join("\n")}</pre>`);
      continue;
    }

    // headers
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      const lvl = Math.min(m[1].length, 3); // we only style h1-h3
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      i++;
      continue;
    }

    // horizontal rule
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line)) {
      out.push("<hr/>");
      i++;
      continue;
    }

    // blockquote (collapse consecutive > lines)
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(inline(lines[i].replace(/^>\s?/, "")));
        i++;
      }
      out.push(`<blockquote>${buf.join("<br/>")}</blockquote>`);
      continue;
    }

    // GitHub pipe table — header row + separator row of dashes.
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(cells(lines[i]));
        i++;
      }
      let html = "<table><thead><tr>" + head.map((h) => `<th>${inline(h)}</th>`).join("") + "</tr></thead><tbody>";
      for (const r of rows) html += "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>";
      html += "</tbody></table>";
      out.push(html);
      continue;
    }

    // unordered / ordered list (collapse consecutive list lines)
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const buf = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        buf.push(`<li>${inline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""))}</li>`);
        i++;
      }
      out.push(ordered ? `<ol>${buf.join("")}</ol>` : `<ul>${buf.join("")}</ul>`);
      continue;
    }

    // blank line → paragraph break
    if (line.trim() === "") {
      i++;
      continue;
    }

    // default: a paragraph (merge following non-blank, non-structural lines)
    const buf = [inline(line)];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6}\s|>\s?|```|---+\s*$|\s*([-*]|\d+\.)\s+|\s*\|.*\|\s*$)/.test(lines[i])
    ) {
      buf.push(inline(lines[i]));
      i++;
    }
    out.push(`<p>${buf.join(" ")}</p>`);
  }

  return out.join("\n");
}

// ---------------------------------------------------------- fetch ---
async function getJson(url) {
  const r = await fetch(url);
  return r.json();
}

// ---------------------------------------------------------- views ---
function switchView(name) {
  $$(".nav-item").forEach((b) => b.classList.toggle("is-active", b.dataset.view === name));
  $$(".view").forEach((v) => v.classList.toggle("is-active", v.dataset.view === name));
  if (name === "runs") loadRuns();
  if (name === "evals") loadEvals();
}

// --- Brain browser ---
let brainLoaded = false;
async function loadBrainList() {
  if (brainLoaded) return;
  brainLoaded = true;
  const { files } = await getJson("/api/brain/list");
  const ul = $("#brain-files");
  ul.innerHTML = "";
  files.forEach((name, idx) => {
    const li = document.createElement("li");
    li.textContent = name.replace(/\.md$/, "");
    li.dataset.name = name;
    li.addEventListener("click", () => selectBrainFile(name));
    if (idx === 0) li.classList.add("is-active");
    ul.appendChild(li);
  });
  if (files[0]) selectBrainFile(files[0]);
}

async function selectBrainFile(name) {
  $$("#brain-files li").forEach((li) => li.classList.toggle("is-active", li.dataset.name === name));
  const content = $("#brain-content");
  content.innerHTML = '<p class="muted">Loading…</p>';
  const r = await getJson(`/api/brain/file?name=${encodeURIComponent(name)}`);
  if (!r.ok) {
    content.innerHTML = `<p class="ans-error">${esc(r.error)}</p>`;
    return;
  }
  content.innerHTML = renderMarkdown(r.markdown);
  content.scrollTop = 0;
}

async function doSearch() {
  const q = $("#search-input").value.trim();
  const box = $("#search-results");
  if (!q) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.textContent = "Searching the brain…";
  const r = await getJson(`/api/search?q=${encodeURIComponent(q)}`);
  box.textContent = r.text || r.error || "(no matches)";
}

// --- Run log ---
async function loadRuns() {
  const r = await getJson("/api/runs");
  const body = $("#runs-body");
  const summary = $("#runs-summary");
  body.innerHTML = "";
  if (!r.ok) {
    summary.innerHTML = `<span class="ans-error">${esc(r.error)}</span>`;
    return;
  }
  const rows = r.rows || [];
  const ok = rows.filter((x) => x.outcome === "ok").length;
  const err = rows.length - ok;
  summary.innerHTML =
    `<span class="chip"><strong>${r.total ?? rows.length}</strong> total runs</span>` +
    `<span class="chip"><strong>${ok}</strong> ok</span>` +
    `<span class="chip"><strong>${err}</strong> error</span>`;
  for (const row of rows) {
    const tr = document.createElement("tr");
    const when = row.ts ? new Date(row.ts).toLocaleString() : "—";
    const dot = row.outcome === "ok" ? '<span class="dot-ok">●</span>' : '<span class="dot-err">●</span>';
    tr.innerHTML =
      `<td class="mono">${esc(when)}</td>` +
      `<td class="mono">${esc(row.cmd)}</td>` +
      `<td>${esc(row.jtbd ?? "—")}</td>` +
      `<td>${esc(row.model ?? "deterministic ($0)")}</td>` +
      `<td>${esc(row.duration_ms ?? "—")}</td>` +
      `<td>${dot} ${esc(row.outcome ?? "")}</td>`;
    body.appendChild(tr);
  }
}

// --- Eval scores ---
async function loadEvals() {
  const r = await getJson("/api/eval");
  const body = $("#eval-body");
  if (!r.ok) {
    body.innerHTML = `<p class="ans-error">${esc(r.error)}</p>`;
    return;
  }
  if (!r.present) {
    body.innerHTML =
      '<p class="muted">No eval state yet. Run <code>npm run eval</code> to populate ' +
      "<code>eval/state.json</code> — the cockpit reads it (it does not run the multi-second pyramid itself).</p>";
    return;
  }
  const s = r.state;
  const g = s.gate || {};
  const f1 = s.f1 || {};
  const passDot = s.pass ? '<span class="dot-ok">●</span>' : '<span class="dot-err">●</span>';

  let html = '<div class="eval-cards">';
  html += card("Gate", `${passDot} ${s.pass ? "GREEN" : "RED"}`, `mode: ${esc(s.mode || "?")}`);
  html += card("Golden tasks", `${g.golden_pass ?? "?"}/${g.golden_required ?? "?"}`, `${g.golden_fail ?? 0} failing`);
  html += card("Macro-F1", (f1.macro_f1 ?? "—").toString(), `gate ≥ ${g.f1_threshold ?? 0.8} · acc ${f1.accuracy ?? "—"}`);
  html += card("Labeled rows", (f1.rows ?? "—").toString(), "hand-labeled P1–P4/plane1");
  html += "</div>";

  // per-class F1
  if (f1.per_class) {
    html += '<div><p class="section-label">Per-class F1 (no self-grading — graded vs Resolution text)</p><div class="per-class">';
    for (const [k, v] of Object.entries(f1.per_class)) {
      html += `<div class="pc"><span class="pcl">${esc(k)}</span> <span class="pcv">f1 ${v.f1} · p ${v.precision} · r ${v.recall}</span></div>`;
    }
    html += "</div></div>";
  }

  // the 14 golden tasks (G1-G14) — green/red from the goldens list if present, else
  // derive a simple all-pass view from golden_pass count.
  const goldens = s.goldens || s.golden_results || null;
  html += '<div><p class="section-label">The 14 golden tasks (CI-blocking subset = G1-G7, G10, G12, G13)</p><div class="golden-grid">';
  if (Array.isArray(goldens)) {
    for (const gt of goldens) {
      const ok = gt.pass !== false;
      html += `<div class="golden"><span class="gdot ${ok ? "pass" : "fail"}"></span>${esc(gt.id || gt.name || "G?")}</div>`;
    }
  } else {
    // no per-golden breakdown in state.json — show G1..G14 all-pass iff golden_fail==0.
    const allPass = (g.golden_fail ?? 1) === 0;
    for (let n = 1; n <= 14; n++) {
      html += `<div class="golden"><span class="gdot ${allPass ? "pass" : "fail"}"></span>G${n}</div>`;
    }
  }
  html += "</div></div>";

  html += `<p class="muted">Snapshot: ${esc(s.ts || "")}. Acceptance (G1) runs in CI (Clerk sign-in→protected, pass^k k≥3); see <code>acceptance.yml</code>.</p>`;
  body.innerHTML = html;
}

function card(label, big, sub) {
  return `<div class="eval-card"><div class="label">${esc(label)}</div><div class="big">${big}</div><div class="sub">${esc(sub)}</div></div>`;
}

// --- Ask the employee ---
async function doAsk() {
  const verb = $("#ask-verb").value;
  const q = $("#ask-input").value.trim();
  const ans = $("#ask-answer");
  ans.innerHTML = '<p class="spinner">badge is thinking…</p>';
  const r = await getJson(`/api/ask?verb=${encodeURIComponent(verb)}&q=${encodeURIComponent(q)}`);
  if (!r.ok || !r.answer) {
    ans.innerHTML = `<p class="ans-error">${esc(r.error || "no answer")}</p>`;
    return;
  }
  ans.innerHTML = renderAnswer(verb, r.answer);
}

function renderAnswer(verb, a) {
  // classify → plane + P + default_tool + rationale + alternatives + cites.
  if (verb === "classify") {
    let h = '<div class="ans-head">';
    h += `<span class="ans-pill">${esc(a.problem ?? "?")}</span>`;
    h += `<span class="ans-tool">${esc(a.default_tool ?? "")}</span>`;
    h += `<span class="ans-plane">plane ${esc(a.plane ?? "?")}</span>`;
    h += "</div>";
    h += `<p class="ans-rationale">${esc(a.rationale ?? "")}</p>`;
    h += listSection("Alternatives", a.alternatives);
    h += citeSection(a.cites);
    return h;
  }
  // advise → recommendation + why + $ breakpoints + checklist + cites.
  if (verb === "advise") {
    let h = '<div class="ans-head">';
    h += `<span class="ans-tool">${esc(a.recommendation ?? "")}</span>`;
    h += `<span class="ans-plane">${esc(a.use_case ?? "")}</span>`;
    h += "</div>";
    h += `<p class="ans-rationale">${esc(a.why ?? "")}</p>`;
    if (Array.isArray(a.breakpoints) && a.breakpoints.length) {
      h += '<div class="ans-section"><div class="k">$ breakpoints</div>';
      for (const bp of a.breakpoints) {
        h += `<div class="bp"><span class="bp-prov">${esc(bp.provider)} <span class="muted">${esc(bp.at || "")}</span></span><span class="bp-cost">${esc(bp.cost)}</span></div>`;
      }
      h += "</div>";
    }
    if (a.reliability_note) h += `<div class="ans-section"><div class="k">reliability</div><p class="ans-rationale">${esc(a.reliability_note)}</p></div>`;
    h += listSection("Checklist", a.checklist);
    h += citeSection(a.cites);
    return h;
  }
  // audit → path + findings (severity/rule/cve/fix) + clean flag.
  if (verb === "audit") {
    let h = '<div class="ans-head">';
    h += `<span class="ans-tool">${a.clean ? "clean ✓" : `${(a.findings || []).length} finding(s)`}</span>`;
    h += `<span class="ans-plane">${esc(a.path ?? "")}</span>`;
    h += "</div>";
    for (const f of a.findings || []) {
      h += `<div class="ans-section"><div class="k">${esc(f.severity)} · ${esc(f.rule)}${f.cve ? " · " + esc(f.cve) : ""}</div>`;
      h += `<p class="ans-rationale">${esc(f.detected || "")}</p>`;
      if (f.fix) h += `<p class="ans-rationale"><strong style="color:var(--amber)">fix:</strong> ${esc(f.fix)}</p></div>`;
      else h += "</div>";
    }
    return h;
  }
  // saml-triage → ordered steps with cites.
  if (verb === "saml-triage") {
    let h = '<div class="ans-head"><span class="ans-tool">7-step SSO/SAML triage</span>';
    h += `<span class="ans-plane">${esc(a.symptom ?? "")}</span></div>`;
    h += '<ol class="ans-list">';
    for (const st of a.steps || []) {
      h += `<li>${esc(st.check)} <span class="cite">${esc(st.cite || "")}</span></li>`;
    }
    h += "</ol>";
    return h;
  }
  // fallback — pretty-print the raw structured answer.
  return `<pre>${esc(JSON.stringify(a, null, 2))}</pre>`;
}

function listSection(title, arr) {
  if (!Array.isArray(arr) || !arr.length) return "";
  let h = `<div class="ans-section"><div class="k">${esc(title)}</div><ul class="ans-list">`;
  for (const x of arr) h += `<li>${esc(typeof x === "string" ? x : JSON.stringify(x))}</li>`;
  return h + "</ul></div>";
}

function citeSection(cites) {
  if (!Array.isArray(cites) || !cites.length) return "";
  let h = '<div class="ans-section"><div class="k">cites</div><div class="ans-cites">';
  for (const c of cites) h += `<span class="cite">${esc(c)}</span>`;
  return h + "</div></div>";
}

// ---------------------------------------------------------- boot ---
function boot() {
  $$(".nav-item").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));
  $("#search-btn").addEventListener("click", doSearch);
  $("#search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
  $("#ask-btn").addEventListener("click", doAsk);
  $("#ask-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doAsk();
  });
  loadBrainList(); // brain is the default view
}

document.addEventListener("DOMContentLoaded", boot);
