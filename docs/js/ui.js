/* SPDX-License-Identifier: GPL-3.0-or-later */
/* ui.js: shared drawing helpers. */
(function () {
  const S = FT.S, { money } = FT.util;

  function van(left) {
    return `<svg class="van" style="left:${left}%" viewBox="0 0 42 24" aria-hidden="true"><rect x="2" y="4" width="28" height="13" fill="var(--teal)" stroke="var(--ink)" stroke-width="2"/><path d="M30 8h6l4 5v4H30z" fill="var(--panel)" stroke="var(--ink)" stroke-width="2"/><circle cx="10" cy="19" r="3.5" fill="var(--ink)"/><circle cx="33" cy="19" r="3.5" fill="var(--ink)"/><rect x="6" y="7" width="6" height="4" fill="var(--panel)"/><rect x="15" y="7" width="6" height="4" fill="var(--panel)"/></svg>`;
  }
  function advisorFace() {
    return `<svg width="48" height="48" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true"><rect x="3" y="1" width="6" height="3" fill="var(--ink)"/><rect x="3" y="3" width="6" height="5" fill="#C98E6A"/><rect x="4" y="5" width="1" height="1" fill="var(--ink)"/><rect x="7" y="5" width="1" height="1" fill="var(--ink)"/><rect x="5" y="7" width="2" height="1" fill="var(--ink)"/><rect x="2" y="8" width="8" height="4" fill="var(--teal)"/><rect x="2" y="2" width="1" height="4" fill="var(--ink)"/><rect x="9" y="2" width="1" height="4" fill="var(--ink)"/></svg>`;
  }
  // An advisor speech box. extraClass "tut" is the tutorial style.
  function advisor(html, extraClass) {
    return `<div class="advisor ${extraClass || ""}">${advisorFace()}<div>${html}</div></div>`;
  }

  function trail(months, month) {
    const pct = 4 + (month / (months.length - 1)) * 92;
    return `<div class="trail" aria-label="Month ${month + 1} of ${months.length}"><div class="trail-line"></div>${van(pct)}
      <div class="stops">${months.map((m, i) => `<div class="stop ${i < month ? "done" : ""}"><span>${m}</span></div>`).join("")}</div></div>`;
  }

  // A mode's meters: [{key, label, short, value?(S)}]. value() lets a meter
  // be computed (e.g. team morale from each person's burnout).
  function meterValue(mt) { return mt.value ? mt.value(S) : S[mt.key]; }
  function short(key) { const mt = FT.mode.meters.find(x => x.key === key); return mt ? mt.short : key; }

  // $8,000 stays as is; $88,000 becomes $88k; $1,250,000 becomes $1.25M
  function compact(n) {
    const a = Math.abs(n), sign = n < 0 ? "−" : "";
    if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, "")}M`;
    if (a >= 10000) return `${sign}$${Math.round(a / 1000)}k`;
    return money(n);
  }

  function header() {
    const m = FT.mode;
    const bar = v => `<div class="meter ${v < 30 ? "low" : ""}"><i style="width:${v}%"></i></div>`;
    const meters = m.meters.map(mt => { const v = meterValue(mt); return `<div class="stat"><div class="k">${mt.label}</div><div class="v">${v}</div>${bar(v)}</div>`; }).join("");
    return trail(m.months, S.month) + `<div class="stats">${meters}
      <div class="stat"><div class="k">Budget</div><div class="v">${compact(S.budget)}</div></div>
      <div class="stat"><div class="k">${m.periodLabel || "Month"}</div><div class="v">${S.month + 1} / ${m.months.length}</div></div>
    </div>`;
  }

  // rows: [label, "good"|"warn"|"bad", status text]
  function dashboard() {
    const m = FT.mode, rows = m.dashboard(S), explain = m.explain || {};
    return `<div class="dash" aria-label="Security status"><div class="dash-head">Security status</div>
      ${rows.map(([k, c, v]) => `<div class="drow"><span class="dk">${k}</span><span class="dv ${c}"><i aria-hidden="true"></i>${v}</span></div>`).join("")}
      <details class="explain"><summary>What do these mean?</summary><dl>${rows.map(([k]) => explain[k] ? `<dt>${k}</dt><dd>${explain[k]}</dd>` : "").join("")}</dl></details></div>`;
  }

  // Show a screen inside the standard frame, then focus the first control.
  function screen(html, focusSel) {
    FT.app.innerHTML = header() + html;
    const f = focusSel && FT.app.querySelector(focusSel);
    if (f) f.focus();
  }

  FT.ui = { compact, van, advisorFace, advisor, trail, header, dashboard, screen, meterValue, short };
})();
