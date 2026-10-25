/* SPDX-License-Identifier: GPL-3.0-or-later */
/* screens.js: the game loop. Title → plan the month → event → (minigame) →
 * end of month, repeated until the year ends or the player loses. Everything
 * specific to a mode (text, actions, events, numbers) comes from FT.mode. */
(function () {
  const S = FT.S, L = FT.learned, { shuffle, clamp, money } = FT.util, ui = FT.ui;
  let deck = [];

  /* ---------- Title and mode select ---------- */
  function title() {
    document.title = "The Firewall Trail";
    const cards = FT.modeOrder.map(id => {
      const m = FT.modes[id];
      return `<button class="mode-card" data-mode="${id}" ${m.comingSoon ? "disabled" : ""}><b>${m.name}</b><small>${m.blurb}</small>${m.comingSoon ? `<span class="soon">Coming soon</span>` : ""}</button>`;
    }).join("");
    FT.app.innerHTML = `<div style="padding-top:2rem">
      <h1>The Firewall Trail</h1>
      <p class="pixel" style="font-size:1.6rem;color:var(--teal);margin-top:.4rem">Survive a year in security, from the help desk to the boardroom</p>
      ${ui.trail(["Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug"], 0)}
      <p>Choose who you’ll be this year.</p>
      <div class="modes">${cards}</div>
      <div class="titlebar">
        <form class="codeform" id="codeform" autocomplete="off"><label for="code">Have a year code?</label>
          <input id="code" name="code" placeholder="PHNT-K7F3Q" maxlength="12" spellcheck="false"><button class="btn ghost" type="submit">Play it</button></form>
        <p class="hint" id="codemsg" aria-live="polite"></p>
        <button class="linkish" id="achv">Achievements (${Object.keys(FT.ach.unlocked()).length} of ${FT.ach.all().length})</button>
      </div></div>`;
    FT.app.querySelectorAll("button[data-mode]").forEach(b => b.onclick = () => intro(b.dataset.mode));
    document.getElementById("achv").onclick = () => FT.ach.screen();
    document.getElementById("codeform").onsubmit = e => {
      e.preventDefault();
      const parsed = FT.rng.parse(document.getElementById("code").value);
      const m = parsed && FT.modeOrder.map(id => FT.modes[id]).find(x => x.codeLetter === parsed.prefix[0]);
      if (!parsed || !m || (m.loadCode && !m.loadCode(parsed.prefix))) { document.getElementById("codemsg").textContent = "That code doesn’t look right. Codes look like PHNT-K7F3Q."; return; }
      FT.pendingSeed = parsed.seed;
      intro(m.id, `${parsed.prefix}-${parsed.seed}`);
    };
    const first = FT.app.querySelector("button[data-mode]:not(:disabled)"); if (first) first.focus();
  }

  function intro(id, loadedCode) {
    const m = FT.mode = FT.modes[id];
    if (!loadedCode) FT.pendingSeed = null;
    document.title = `The Firewall Trail: ${m.name}`;
    FT.app.innerHTML = `<div style="padding-top:2rem">
      <h1>The Firewall Trail</h1>
      <p class="pixel" style="font-size:1.6rem;color:var(--teal);margin-top:.4rem">${m.name}</p>
      ${ui.trail(m.months, 0)}
      <div class="panel">${loadedCode ? `<div class="notice yearnote"><b>Year code ${loadedCode} loaded.</b> The options below are set to match it. Press start to play that exact year.</div>` : ""}${m.intro}
        ${m.introOptions ? m.introOptions() : ""}
        <div class="row"><button class="btn" id="go">${m.startLabel}</button><button class="linkish" id="back">Choose a different mode</button></div>
      </div></div>`;
    if (m.bindIntroOptions) m.bindIntroOptions(FT.app);
    document.getElementById("go").onclick = start;
    document.getElementById("back").onclick = title;
    document.getElementById("go").focus();
  }

  function start(replaySeed) {
    const m = FT.mode;
    window.scrollTo(0, 0);
    FT.rng.begin(typeof replaySeed === "string" ? replaySeed : FT.pendingSeed);
    FT.pendingSeed = null;
    FT.reset(Object.assign({ month: 0, finale: false, finaleResult: null }, m.newState()));
    S.code = FT.rng.code(m.codePrefix ? m.codePrefix(S) : m.codeLetter);
    deck = shuffle(m.events.filter(e => e.deck !== false).map(e => e.id), FT.rng.fork("events"));
    plan();
  }

  /* ---------- Planning the month ---------- */
  function plan() {
    FT.rng.stream("month" + S.month); // each month's luck comes from its own stream
    if (FT.mode.plan) return FT.mode.plan(); // modes can bring their own planning screen
    const m = FT.mode, t = m.tutorial || {}, tips = t.tips || [], slots = m.slots;
    let used = 0, picked = new Set(), tip = S.tipsDone ? tips.length : 0;
    const costOf = id => m.actions.find(a => a.id === id).cost;

    function draw() {
      const first = S.month === 0 && t.firstMonthActions;
      const visible = a => (!a.show || a.show(S)) && (!first || t.firstMonthActions.includes(a.id));
      const optFor = g => m.actions.filter(a => a.group === g && visible(a)).map(a => {
        const on = picked.has(a.id);
        const spent = [...picked].reduce((s, id) => s + costOf(id), 0);
        const blocked = !on && (used + a.slots > slots || S.budget < a.cost + spent);
        const suggest = first && (t.suggested || []).includes(a.id) ? `<span class="suggest">${m.advisor.name} suggests</span>` : "";
        return `<label class="opt ${on ? "on" : ""} ${blocked ? "off" : ""}"><input type="checkbox" data-id="${a.id}" ${on ? "checked" : ""} ${blocked ? "disabled" : ""}>
          <div><b>${a.name}</b>${suggest}<small>${a.desc}</small></div>
          <span class="cost">${a.slots} slot${a.slots > 1 ? "s" : ""}${a.cost ? `<br>$${a.cost.toLocaleString()}` : ""}</span></label>`;
      }).join("");
      const projects = optFor("project");
      const tipBox = first && tip < tips.length ? ui.advisor(`<p><b>${m.advisor.name}:</b> ${tips[tip]}</p>
          <div class="row"><button class="btn" id="tipnext">${tip < tips.length - 1 ? "Next tip" : "Got it"}</button>${tip < tips.length - 1 ? `<button class="mini" id="tipskip">Skip tips</button>` : ""}<span class="hint">${tip + 1} of ${tips.length}</span></div>`, "tut") : "";
      const note = t.monthNotes && t.monthNotes[S.month] ? ui.advisor(`<p><b>${m.advisor.name}:</b> ${t.monthNotes[S.month]}</p>`) : "";
      const warning = m.threatWarning ? m.threatWarning(S) : "";

      FT.app.innerHTML = ui.header() + `<div class="panel">
        <h2>${m.months[S.month]}: ${m.landmarks[S.month]}</h2>
        ${S.month === 0 ? FT.years.notice() : ""}${warning}${tipBox}${note}
        <div class="${first && tip === 0 && tips.length ? "spot" : ""}">${ui.dashboard()}</div>
        <div class="${first && tip === 1 && tips.length ? "spot" : ""}">
          <p>What will you work on this month?</p>
          <div class="slots" aria-live="polite">Slots used: ${"■".repeat(used)}${"□".repeat(slots - used)}</div>
          <h3 class="grp">Upkeep</h3><p class="hint grp-note">These wear off over time. Come back to them.</p>
          <div class="opts">${optFor("upkeep")}</div>
          ${projects ? `<h3 class="grp">Projects</h3><p class="hint grp-note">Do these once.</p><div class="opts">${projects}</div>` : ""}
          ${first ? `<p class="hint">More tasks and projects unlock next month.</p>` : ""}
        </div>
        <div class="row"><button class="btn" id="next">Start the month</button>
        ${used < slots ? `<span class="hint">Unused slots are lost.</span>` : ""}</div></div>`;

      const tn = document.getElementById("tipnext");
      if (tn) tn.onclick = () => { tip++; if (tip >= tips.length) S.tipsDone = true; draw(); const f = document.getElementById("tipnext") || document.querySelector("input[data-id]"); f && f.focus(); };
      const ts = document.getElementById("tipskip");
      if (ts) ts.onclick = () => { tip = tips.length; S.tipsDone = true; draw(); document.querySelector("input[data-id]").focus(); };
      FT.app.querySelectorAll("input[data-id]").forEach(cb => cb.onchange = () => {
        const a = m.actions.find(x => x.id === cb.dataset.id);
        if (cb.checked) { picked.add(a.id); used += a.slots; } else { picked.delete(a.id); used -= a.slots; }
        draw();
        const again = FT.app.querySelector(`input[data-id="${a.id}"]`); if (again) again.focus();
      });
      document.getElementById("next").onclick = () => {
        picked.forEach(id => { const a = m.actions.find(x => x.id === id); S.budget -= a.cost; a.apply(S); });
        runEvent();
      };
    }
    draw();
  }

  /* ---------- Events ---------- */
  function runEvent() {
    const m = FT.mode;
    // Scheduled moments (a fixed first event, a mid-year offer, the finale)
    for (const s of m.scheduled || []) if (s.when(S)) return s.run();
    // Draw from the deck, skipping events that don't apply right now
    let ev;
    do { const nextId = deck.shift(); ev = m.events.find(e => e.id === nextId); }
    while (ev && ev.available && !ev.available(S) && deck.length);
    if (ev.choices) return choiceEvent(ev);
    outcome(ev.title, ev.run(S));
  }

  function choiceEvent(ev) {
    if (ev.lessonPre) L.set(ev.lessonPre[0], ev.lessonPre[1]);
    ui.screen(`<div class="panel"><h2>${ev.title}</h2><p>${ev.intro}</p>
      <p><b>What do you do?</b></p>
      <div class="row">${ev.choices.map((c, i) => `<button class="btn ${i ? "ghost" : ""}" data-i="${i}">${c.label}</button>`).join("")}</div></div>`, "button[data-i]");
    FT.app.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => { const c = ev.choices[+b.dataset.i]; FT.note(ev.title, `Chose: ${c.label}.`); outcome(ev.title, c.run()); });
  }
  function eventById(id) { return FT.mode.events.find(e => e.id === id); }

  // Apply an fx object ({trust: -5, morale: 3, budget: -500, ...}) and return
  // the delta labels to show. Modes can take over with applyFx (e.g. to turn
  // morale into burnout for each person on a team).
  function applyFx(fx) {
    const m = FT.mode;
    if (m.applyFx) m.applyFx(S, fx);
    else for (const mt of m.meters) if (fx[mt.key]) S[mt.key] = clamp(S[mt.key] + fx[mt.key]);
    if (fx.budget) S.budget += fx.budget;
    const d = [];
    for (const mt of m.meters) if (fx[mt.key]) d.push(`<span class="${fx[mt.key] > 0 ? "up" : "down"}">${mt.short} ${fx[mt.key] > 0 ? "+" : ""}${fx[mt.key]}</span>`);
    if (fx.budget) d.push(`<span class="${fx.budget > 0 ? "up" : "down"}">Budget ${fx.budget > 0 ? "+" : ""}${money(fx.budget)}</span>`);
    return d;
  }

  // r: {text, fx, lesson:[term, explanation], note?}
  function outcome(t, r) {
    const m = FT.mode, fx = r.fx || (r.fx = {});
    if (m.adjustOutcome) m.adjustOutcome(S, r);
    L.set(r.lesson[0], r.lesson[1]);
    const d = applyFx(fx);
    FT.note(t, ""); FT.noteEffects(t, d);
    ui.screen(`<div class="panel"><h2>${t}</h2><p>${r.text}</p>${r.note ? `<p class="hint"><b>${r.noteLabel || "Note"}:</b> ${r.note}</p>` : ""}
      ${d.length ? `<div class="delta">${d.join("  ")}</div>` : ""}
      ${ui.advisor(`<span class="tag">${r.lesson[0]}</span><p><b>${m.advisor.name}:</b> ${r.lesson[1]}</p>`)}
      <div class="row"><button class="btn" id="next">Continue</button></div></div>`, "#next");
    document.getElementById("next").onclick = () => {
      if (checkLoss()) return;
      const game = (m.minigames && m.minigames.schedule[S.month]);
      game ? FT.minigames[game](m.minigames[game]) : endMonth();
    };
  }

  /* ---------- End of month, losing, winning ---------- */
  function endMonth() {
    const m = FT.mode;
    m.monthEnd(S);
    if (checkLoss()) return;
    S.month++;
    if (S.month >= m.months.length) return ending(null);
    plan();
  }

  function checkLoss() {
    const msg = FT.mode.lossCheck(S);
    if (msg) { ending(msg); return true; }
    return false;
  }

  function ending(lossMsg, returning) {
    const m = FT.mode, g = m.grade(S, lossMsg);
    const items = [...L].map(([k, v]) => `<li><b>${k}:</b> ${v}</li>`).join("");
    const fresh = returning ? (S.endFresh || []) : FT.ach.check(m, { lossMsg, grade: g.grade });
    Object.assign(S, { ended: true, endGrade: g.grade, endLoss: lossMsg || "", endFresh: fresh });
    const unlockedHTML = fresh.length ? `<div class="notice yearnote"><b>Achievement${fresh.length > 1 ? "s" : ""} unlocked:</b><ul>${fresh.map(a => `<li><b>${a.name}.</b> ${a.desc}</li>`).join("")}</ul></div>` : "";
    const seed = FT.rng.seed;
    FT.app.innerHTML = `<div style="padding-top:1.5rem">
      <h2 style="font-size:2.6rem">${lossMsg ? `${m.periodLabel || "Month"} ${S.month + 1}: ${m.landmarks[S.month]}` : m.winTitle}</h2>
      ${lossMsg ? `<div class="death">${lossMsg}</div>` : ""}
      <div class="panel" style="margin-top:1rem">
        <div style="display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap">
          <div class="big" aria-label="Grade ${g.grade}">${g.grade}</div>
          <div><p style="font-size:1.2rem"><b>${g.note}</b></p>${g.details || ""}${FT.years.summary()}</div>
        </div>
        ${unlockedHTML}
        <h2 style="margin-top:1.25rem;font-size:1.8rem">Concepts you ran into</h2>
        <ul class="learned">${items || "<li>None yet. Try again!</li>"}</ul>
        <div class="row"><button class="btn" id="again">${m.againLabel}</button><button class="btn ghost" id="replay">Replay this year</button></div>
        <div class="row"><button class="btn ghost" id="report">Year report</button><button class="btn ghost" id="fb">Send feedback</button><button class="linkish" id="menu">Choose a different mode</button></div>
      </div></div>`;
    document.getElementById("report").onclick = () => FT.share.report(() => ending(lossMsg, true));
    document.getElementById("fb").onclick = () => FT.share.sendFeedback();
    const a = document.getElementById("again"); a.focus(); a.onclick = () => start();
    document.getElementById("replay").onclick = () => start(seed);
    document.getElementById("menu").onclick = title;
  }

  FT.screens = { title, intro, start, plan, runEvent, choiceEvent, eventById, outcome, applyFx, endMonth, checkLoss, ending };
})();
