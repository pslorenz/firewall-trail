/* SPDX-License-Identifier: GPL-3.0-or-later */
/* minigames.js: reusable minigames. Each takes a config from the mode with
 * its data (emails, login pages, questions) and its wording. */
(function () {
  const S = FT.S, L = FT.learned, { shuffle, clamp } = FT.util, ui = FT.ui;
  const done = () => FT.screens.endMonth();

  function result(title, text, extraHTML, deltas) {
    ui.screen(`<div class="panel"><h2>${title}</h2><p>${text}</p>${extraHTML || ""}
      <div class="delta">${deltas.map(d => `<span class="up">${d}</span>`).join("  ")}</div>
      <div class="row"><button class="btn" id="n">Continue</button></div></div>`, "#n");
    document.getElementById("n").onclick = done;
  }

  /* Inbox check: phish or legit, with sender and link reveals */
  function inbox(cfg) {
    const set = FT.util.draw("inbox", cfg.data, 4);
    let i = 0, correct = 0, checks = 0, seenSender = false, seenLink = false;
    function draw(answered, ok) {
      const e = set[i], showS = answered || seenSender, showL = answered || seenLink;
      const linkHTML = e.link ? `<span class="elink">${e.link.text}</span>${showL ? `<span class="reveal">Goes to: ${e.link.url}</span>` : ""}` : "";
      FT.app.innerHTML = ui.header() + `<div class="panel"><h2>Inbox check</h2>
        <p>${cfg.intro} (${i + 1} of ${set.length})</p>
        <div class="email">
          <div class="from">From: <b>${e.name}</b>${showS ? `<span class="reveal">${e.addr}</span>` : ""}</div>
          <div class="subj">${e.subj}</div><div>${e.body.replace("{link}", linkHTML)}</div>
        </div>
        ${answered ? "" : `<div class="tools">
          <button class="mini" id="cs" ${seenSender ? "disabled" : ""}>Show sender address</button>
          ${e.link ? `<button class="mini" id="cl" ${seenLink ? "disabled" : ""}>Check where the link goes</button>` : ""}
        </div><p class="hint">Most mail apps only show the sender’s name. Tap the name, or hover over a link, to see what’s really behind it.</p>`}
        ${answered ? `<div class="verdict ${ok ? "ok" : "no"}">${ok ? "Correct." : "Not quite."}</div><p>${e.clue}</p>
          <div class="row"><button class="btn" id="n">${i < set.length - 1 ? "Next email" : "Finish"}</button></div>`
        : `<div class="row"><button class="btn" data-a="1">Phish</button><button class="btn ghost" data-a="0">Legit</button></div>`}
      </div>`;
      if (answered) { const n = document.getElementById("n"); n.focus(); n.onclick = () => { i++; seenSender = seenLink = false; i < set.length ? draw(false) : finish(); }; return; }
      const cs = document.getElementById("cs"); if (cs) cs.onclick = () => { seenSender = true; checks++; draw(false); const b = document.getElementById("cl") || document.querySelector("button[data-a]"); b && b.focus(); };
      const cl = document.getElementById("cl"); if (cl) cl.onclick = () => { seenLink = true; checks++; draw(false); document.querySelector("button[data-a]").focus(); };
      FT.app.querySelectorAll("button[data-a]").forEach(b => b.onclick = () => { const ok = (b.dataset.a === "1") === e.phish; if (ok) correct++; draw(true, ok); });
    }
    function finish() {
      if (correct === set.length) S.mgPerfect = (S.mgPerfect || 0) + 1;
      const gain = correct * 6 + Math.min(checks, 4) * 2; S.training = clamp(S.training + gain);
      L.set(...cfg.lesson);
      FT.note("Inbox check", `${correct} of ${set.length} right.`);
      result(`${correct} of ${set.length} correct`, correct >= 3 ? cfg.good : cfg.bad,
        `<p class="hint">${checks ? `You checked behind the curtain ${checks} time${checks > 1 ? "s" : ""}. That habit counts toward staff awareness.` : "You never checked a sender address or link. Next time, try looking behind the name before deciding."}</p>`,
        [`Staff awareness +${gain}`]);
    }
    draw(false);
  }

  /* Real or fake login page */
  function login(cfg) {
    const set = FT.util.draw("login", cfg.data, 4); let i = 0, correct = 0;
    const lock = `<svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><rect x="1" y="6" width="10" height="7" fill="var(--ink)"/><path d="M3 6V4a3 3 0 0 1 6 0v2" fill="none" stroke="var(--ink)" stroke-width="2"/></svg>`;
    function page(l) {
      return `<div class="browser" role="img" aria-label="Browser showing ${l.url}">
        <div class="bar"><div class="dots"><i></i><i></i><i></i></div>
        <div class="url">${l.secure ? lock : `<span class="ns">Not secure</span>`}<span>${l.url.replace(/^https?:\/\//, "")}</span></div></div>
        <div class="page"><div class="crest">${cfg.crest(l)}</div>
          <h3>${l.title}</h3><p class="sub">${l.sub}</p>
          ${l.fields.map(f => `<div class="fake-field">${f}<div></div></div>`).join("")}
          <div class="fake-btn">Sign in</div></div></div>`;
    }
    function draw(answered, ok) {
      const l = set[i];
      FT.app.innerHTML = ui.header() + `<div class="panel"><h2>Real or fake login?</h2>
        <p>${cfg.intro} (${i + 1} of ${set.length})</p>
        ${page(l)}
        ${answered ? `<div class="verdict ${ok ? "ok" : "no"}">${ok ? "Correct." : "Not quite."}</div><p>${l.clue}</p>
          <div class="row"><button class="btn" id="n">${i < set.length - 1 ? "Next page" : "Finish"}</button></div>`
        : `<p class="hint">Tip: the real website is the name right before the first “/”.</p>
          <div class="row"><button class="btn" data-a="1">Fake</button><button class="btn ghost" data-a="0">Real</button></div>`}
      </div>`;
      if (answered) { const n = document.getElementById("n"); n.focus(); n.onclick = () => { i++; i < set.length ? draw(false) : finish(); }; }
      else FT.app.querySelectorAll("button[data-a]").forEach(b => b.onclick = () => { const ok = (b.dataset.a === "1") === l.fake; if (ok) correct++; draw(true, ok); });
    }
    function finish() {
      if (correct === set.length) S.mgPerfect = (S.mgPerfect || 0) + 1;
      const gain = correct * 6; S.training = clamp(S.training + gain);
      if (correct >= 3) S.trust = clamp(S.trust + 3);
      L.set(...cfg.lesson);
      FT.note("Real or fake login?", `${correct} of ${set.length} right.`);
      result(`${correct} of ${set.length} correct`, correct >= 3 ? cfg.good : cfg.bad, "",
        [`Staff awareness +${gain}`].concat(correct >= 3 ? [`${ui.short("trust")} +3`] : []));
    }
    draw(false);
  }

  /* Multiple-choice password questions */
  function password(cfg) {
    // Shuffle each question's options so the right answer isn't always in the same spot
    const set = FT.util.draw("password", cfg.data, 4).map(q => {
      const order = shuffle(q.opts.map((_, k) => k));
      return Object.assign({}, q, { opts: order.map(k => q.opts[k]), ans: order.indexOf(q.ans) });
    });
    let i = 0, correct = 0;
    function draw(choice) {
      const e = set[i], answered = choice !== undefined, ok = choice === e.ans;
      FT.app.innerHTML = ui.header() + `<div class="panel"><h2>Password check</h2>
        <p>${cfg.intro} (${i + 1} of ${set.length})</p>
        <p class="pq"><b>${e.q}</b></p>
        <div class="opts">${e.opts.map((o, k) => `<button class="opt choice pw ${answered && k === e.ans ? "right" : ""} ${answered && k === choice && !ok ? "wrong" : ""}" data-k="${k}" ${answered ? "disabled" : ""}><div><span class="pwtext">${o}</span></div></button>`).join("")}</div>
        ${answered ? `<div class="verdict ${ok ? "ok" : "no"}">${ok ? "Correct." : "Not quite."}</div><p>${e.why}</p>
          <div class="row"><button class="btn" id="n">${i < set.length - 1 ? "Next question" : "Finish"}</button></div>` : ""}
      </div>`;
      if (answered) { const n = document.getElementById("n"); n.focus(); n.onclick = () => { i++; i < set.length ? draw() : finish(); }; }
      else { FT.app.querySelectorAll("button[data-k]").forEach(b => b.onclick = () => { const k = +b.dataset.k; if (k === e.ans) correct++; draw(k); }); FT.app.querySelector("button[data-k]").focus(); }
    }
    function finish() {
      if (correct === set.length) S.mgPerfect = (S.mgPerfect || 0) + 1;
      const gain = correct * 5; S.training = clamp(S.training + gain);
      L.set(...cfg.lesson);
      FT.note("Password check", `${correct} of ${set.length} right.`);
      result(`${correct} of ${set.length} correct`, correct >= 3 ? cfg.good : cfg.bad, "", [`Staff awareness +${gain}`]);
    }
    draw();
  }

  /* Alert triage: false positive, real threat, or escalate.
   * Each alert has answer "fp", "real" or "escalate". Escalating is the safe
   * middle: half credit when it wasn't the best call, but it costs the team. */
  function triage(cfg) {
    const set = FT.util.draw("triage", cfg.data, cfg.count || 4);
    let i = 0, score = 0, escalations = 0;
    const labels = { fp: "False positive", real: "Real threat: contain it", escalate: "Escalate for review" };
    // The first-time tip is fetched once (fetching it marks it as seen)
    let hintText = cfg.hint ? cfg.hint(S) : "";
    function draw(choice) {
      const a = set[i], answered = choice !== undefined;
      if (i > 0 || answered) hintText = "";
      let verdict = "";
      if (answered) {
        const right = choice === a.answer, half = !right && (choice === "escalate" || a.answer === "escalate");
        verdict = right ? `<div class="verdict ok">Correct.</div>` : half ? `<div class="verdict warn">Not ideal. The best call was: ${labels[a.answer].toLowerCase()}.</div>` : `<div class="verdict no">Wrong call. The best call was: ${labels[a.answer].toLowerCase()}.</div>`;
      }
      FT.app.innerHTML = ui.header() + `<div class="panel"><h2>Alert queue</h2>
        <p>${cfg.intro} (${i + 1} of ${set.length})</p>
        ${hintText ? ui.advisor(`<p>${hintText}</p>`, "tut") : ""}
        <div class="alertcard"><div class="ahead"><b>${a.title}</b><span class="asrc">${a.source}</span><span class="atime">${a.time}</span></div>
          <pre class="log">${a.log}</pre></div>
        ${answered ? `${verdict}<p>${a.why}</p><div class="row"><button class="btn" id="n">${i < set.length - 1 ? "Next alert" : "Finish"}</button></div>`
        : `<div class="row">${["fp", "real", "escalate"].map(k => `<button class="btn ${k === "real" ? "" : "ghost"}" data-t="${k}">${labels[k]}</button>`).join("")}</div>`}
      </div>`;
      if (answered) { const n = document.getElementById("n"); n.focus(); n.onclick = () => { i++; i < set.length ? draw() : finish(); }; }
      else {
        FT.app.querySelectorAll("button[data-t]").forEach(b => b.onclick = () => {
          const c = b.dataset.t;
          if (c === a.answer) score += 1; else if (c === "escalate" || a.answer === "escalate") score += .5;
          if (c === "escalate") escalations++;
          draw(c);
        });
        FT.app.querySelector("button[data-t]").focus();
      }
    }
    function finish() {
      if (score === set.length) S.mgPerfect = (S.mgPerfect || 0) + 1;
      L.set(...cfg.lesson);
      const deltas = cfg.reward(S, score, escalations, set.length);
      FT.note("Alert queue", `${score} of ${set.length} right.`);
      result(`${score} of ${set.length}`, score >= set.length * .7 ? cfg.good : cfg.bad, escalations ? `<p class="hint">You escalated ${escalations} alert${escalations > 1 ? "s" : ""}. Escalating is safe, but every one takes someone’s time.</p>` : "", deltas);
    }
    draw();
  }

  FT.minigames = { inbox, login, password, triage };
})();
