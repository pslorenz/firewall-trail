/* SPDX-License-Identifier: GPL-3.0-or-later */
/* share.js: the decision log, feedback to GitHub issues, and the year report.
 *
 * FT.note(title, detail) records what happened during the year. The engine
 * and modes call it at decision points; the year report shows it as a
 * timeline. Feedback opens a pre-filled GitHub issue, so every report comes
 * with the year code needed to replay it. */
(function () {
  const S = FT.S;

  // Fallback repository, used when the game isn't running on GitHub Pages
  const FALLBACK_REPO = "https://github.com/pslorenz/firewall-trail";

  /* ---------- The decision log ---------- */
  const strip = html => String(html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  function period() { const m = FT.mode; return m && m.months ? m.months[S.month] : ""; }
  // Record an entry. If the previous entry has the same title, add to it instead.
  FT.note = function (title, detail) {
    if (!S.log) S.log = [];
    title = strip(title); detail = strip(detail);
    const last = S.log[S.log.length - 1];
    if (last && last.title === title && last.when === period()) { if (detail && !last.detail.includes(detail)) last.detail = last.detail ? `${last.detail} ${detail}` : detail; return; }
    S.log.push({ when: period(), title, detail });
  };
  // Summarize effect labels like "Trust −12" into one line
  FT.noteEffects = function (title, deltas) {
    const d = (deltas || []).map(strip).filter(Boolean).join(", ");
    if (d) FT.note(title, `(${d})`);
  };

  /* ---------- Where the game lives ---------- */
  function repo() {
    const h = location.hostname, parts = location.pathname.split("/").filter(Boolean);
    if (/\.github\.io$/i.test(h)) {
      const user = h.split(".")[0];
      return parts.length && !/\.html?$/i.test(parts[0]) ? `https://github.com/${user}/${parts[0]}` : `https://github.com/${user}/${user}.github.io`;
    }
    return FALLBACK_REPO;
  }
  function siteUrl() { return /^https?:/.test(location.protocol) ? location.href.split("#")[0].split("?")[0] : ""; }

  /* ---------- Feedback as a GitHub issue ---------- */
  function context() {
    const m = FT.mode, lines = [];
    if (!m || !S.code) return { title: "Playtest feedback", lines: ["**Where:** title screen"] };
    const setting = m.setting ? m.setting.name : "";
    const extras = [setting, S.diff && S.diff.label, S.startInfo && S.startInfo.name.toLowerCase()].filter(Boolean).join(", ");
    lines.push(`**Year code:** ${S.code}`);
    lines.push(`**Mode:** ${m.name}${extras ? ` (${extras})` : ""}`);
    if ((S.conditions || []).length) lines.push(`**Conditions:** ${S.conditions.map(c => c.name).join(", ")}`);
    if (S.ended) lines.push(`**Result:** ${S.endGrade}${S.endLoss ? `, ${S.endLoss}` : ""}`);
    else {
      const h = document.querySelector(".panel h2");
      lines.push(`**Where:** ${m.periodLabel || "Month"} ${S.month + 1} of ${m.months.length}${h ? `, “${strip(h.textContent)}” screen` : ""}`);
    }
    if (S.finaleResult && m.setting && m.setting.finale && m.setting.finale.results && m.setting.finale.results[S.finaleResult]) lines.push(`**Ransomware night:** ${m.setting.finale.results[S.finaleResult].label}`);
    return { title: `Playtest: ${m.name}${setting ? `, ${setting}` : ""} (${S.code})`, lines };
  }
  function issueUrl() {
    const c = context();
    const body = c.lines.join("\n") + "\n\n### What happened?\n\n\n### What did you expect, or what would make it better?\n\n\n### Anything else?\n\n";
    return `${repo()}/issues/new?title=${encodeURIComponent(c.title)}&body=${encodeURIComponent(body)}`;
  }
  function sendFeedback() { window.open(issueUrl(), "_blank", "noopener"); }

  /* ---------- The year report ---------- */
  function report(back) {
    const m = FT.mode, g = m.grade(S, S.endLoss || null);
    const setting = m.setting ? m.setting.name : "";
    const extras = [setting, S.diff && `${S.diff.label} difficulty`, S.startInfo && S.startInfo.name].filter(Boolean).join(", ");
    const log = (S.log || []).map(e => `<tr><td class="when">${e.when}</td><td><b>${e.title}</b>${e.detail ? ` <span>${e.detail}</span>` : ""}</td></tr>`).join("");
    const concepts = [...FT.learned].map(([k, v]) => `<li><b>${k}:</b> ${v}</li>`).join("");
    const url = siteUrl();
    FT.app.innerHTML = `<div class="report-page">
      <div class="noprint row" style="margin:1rem 0"><button class="btn" id="print">Print or save as PDF</button><button class="btn ghost" id="back">Back</button></div>
      <article class="panel yearreport">
        <p class="pixel rp-brand">The Firewall Trail</p>
        <h1 class="rp-title">Year report</h1>
        <p class="rp-meta">${m.name}${extras ? `: ${extras}` : ""}<br>${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
        <div class="rp-grade"><div class="big">${g.grade}</div><div><p><b>${S.endLoss || g.note}</b></p>${g.details || ""}</div></div>
        ${(S.conditions || []).length ? `<h2>The year’s conditions</h2><ul>${S.conditions.map(c => `<li><b>${c.name}.</b> ${c.desc}</li>`).join("")}</ul>` : ""}
        <h2>How the year went</h2>
        ${log ? `<div style="overflow-x:auto"><table class="rp-log">${log}</table></div>` : "<p>No decisions were recorded.</p>"}
        <h2>Concepts</h2><ul class="learned">${concepts}</ul>
        <p class="rp-code">Year code <b class="code">${S.code}</b>. ${url ? `Play this exact year at ${url} by entering the code on the title screen.` : "Enter it on the title screen to play this exact year."}</p>
      </article></div>`;
    document.getElementById("print").onclick = () => window.print();
    const b = document.getElementById("back"); b.onclick = back; document.getElementById("print").focus();
  }

  FT.share = { repo, issueUrl, sendFeedback, report, siteUrl };
})();
