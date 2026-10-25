/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Practitioner ransomware night: assume breach, then make the calls live.
 *   1. Probing: they try every way in, weakest first; a zero-day if all hold.
 *   2. Beachhead: endpoint protection may stop them on the first machine.
 *   3. Early detection (detection rules, MDR, noise from failed attempts)
 *      gives you a first decision: contain narrowly, broadly, or watch.
 *   4. If they reach the servers, a second decision: pull the plug, try
 *      targeted containment, or let the MDR team lead.
 *   5. If encryption happens: a patient-safety decision, then recovery.
 * All wording comes from the setting's finale config (mode.setting.finale).
 * Effects accumulate across the night and land together at the end. */
(function () {
  const S = FT.S, L = FT.learned, { chance, roll, clamp } = FT.util, ui = FT.ui, sys = FT.sys;
  const mode = FT.modes.practitioner;

  mode.scheduled = [
    { when: S => S.month === S.mdrMonth, run: () => mode.setting.mdrOffer() },
    { when: S => mode.setting.midyear && S.month === S.midyearMonth, run: () => mode.setting.midyear() },
    { when: S => S.month === S.expandMonth && mode.setting.expansion, run: () => { S.expanded = true; FT.screens.choiceEvent(mode.setting.expansion); } },
    { when: S => S.month === S.finaleMonth, run: () => run(mode.setting.finale) }
  ];

  function run(cfg) {
    S.finale = true;
    const acc = { trust: 0, care: 0, morale: -10, budget: 0 };
    const story = [];      // what happened, shown in the final summary
    let intel = false;     // watching the attackers taught you their moves
    const vectors = cfg.vectors(S).sort((a, b) => a.p - b.p);
    L.set(...cfg.lessons.weakest); L.set(...cfg.lessons.assume);

    const log = []; let blocked = 0, anyLucky = false, entry = null;
    for (const v of vectors) {
      const r = roll(v.p);
      if (r.ok) { blocked++; if (r.lucky) anyLucky = true; log.push({ v, ok: true, lucky: r.lucky }); }
      else { entry = v; log.push({ v, ok: false }); break; }
    }
    if (!entry) { entry = Object.assign({ zeroDay: true }, cfg.zeroDay); log.push({ v: entry, ok: false }); }

    function page(inner, buttons) {
      ui.screen(`<div class="panel finale">${inner}
        <div class="row">${buttons || `<button class="btn" id="n">Continue</button>`}</div></div>`, buttons ? "button[data-d]" : "#n");
    }
    function decide(clock, title, html, options, onPick) {
      const hint = S.tutorial && !S.seenDecision && cfg.decisionHint ? ui.advisor(`<p>${cfg.decisionHint}</p>`, "tut") : "";
      S.seenDecision = true;
      page(`<div class="clock">${clock}</div><h2>${title}</h2>${html}${hint}<p><b>What do you do?</b></p>`,
        options.map((o, i) => `<button class="btn ${i ? "ghost" : ""}" data-d="${o.id}">${o.label}</button>`).join(""));
      FT.app.querySelectorAll("button[data-d]").forEach(b => b.onclick = () => { FT.note(title, `Chose: ${b.textContent}.`); onPick(b.dataset.d); });
    }
    function narrate(clock, title, label, good, text, next) {
      page(`<div class="clock">${clock}</div><h2>${title}</h2><p class="stage ${good ? "ok" : "no"}">${label}</p><p>${text}</p>`);
      document.getElementById("n").onclick = next;
    }

    /* 1. Probing */
    const items = log.map((l, i) => `<li class="${l.ok ? "ok" : "no"}"><span class="t">${cfg.times[Math.min(i, cfg.times.length - 1)]}</span><div><b>${l.v.zeroDay ? cfg.zeroDay.label : `They try ${l.v.name}.`}</b> ${l.ok ? (l.lucky ? cfg.luckyBlock : l.v.hold) : l.v.fail}</div></li>`).join("");
    page(`<h2>${cfg.title}</h2><p>${cfg.intro(S)}</p><ol class="log">${items}</ol>
      <p class="stage no">A foothold</p><p>${blocked ? `Your defenses turned them away ${blocked} time${blocked > 1 ? "s" : ""}. Every failed attempt left traces in your logs.` : cfg.firstTry}</p>`);
    document.getElementById("n").onclick = beachhead;

    /* 2. Beachhead */
    function beachhead() {
      const b = cfg.beachhead, r = roll(sys.eff(S.edr) * S.diff.edr); // skilled crews often get past a single tool
      if (S.edr) L.set(...sys.notes.edr);
      if (r.ok) { if (r.lucky) anyLucky = true; return narrate(b.clock, b.title, r.lucky ? "Lucky break" : "Blocked on the first machine", true, r.lucky ? b.lucky : b.blocked, () => finish(r.lucky ? "luckyedr" : "edr")); }
      const early = S.diff.detect + .05 + S.detect / 220 + (S.mdr !== null ? (S.mdrNoisy ? S.mdr / 400 : S.mdr / 200) : 0) + .05 * blocked;
      narrate(b.clock, b.title, "They take control", false, b.failed(S), () => chance(Math.min(.95, early)) ? earlyDecision() : late(false));
    }

    /* 3. Early detection: first decision */
    function earlyDecision() {
      const e = cfg.early;
      decide(e.clock, e.title, `<p>${e.alert(S)}</p>`, e.options, d => {
        if (d === "host") {
          if (chance(.45 + S.inventory / 250)) { story.push(e.hostWin); return finish("early"); }
          return narrate(e.clock, e.title, "Too late", false, e.hostLose, () => late(true));
        }
        if (d === "segment") {
          acc.care += e.segmentCare; story.push(e.segmentCost);
          if (chance(.85)) { story.push(e.segmentWin); return finish("segment"); }
          return narrate(e.clock, e.title, "They slipped out", false, e.segmentLose, () => late(true));
        }
        // watch them
        intel = true;
        if (chance(.6)) { story.push(e.watchWin); return finish("watched"); }
        return narrate(e.clock, e.title, "They moved first", false, e.watchLose, () => late(true));
      });
    }

    /* 4. Late detection: second decision */
    function late(known) {
      const c = cfg.contain;
      const p = known ? 1 : S.diff.detect + .05 + S.detect / 260 + (S.mdr !== null ? (S.mdrNoisy ? S.mdr / 500 : S.mdr / 220) : 0) + .04 * blocked;
      if (!chance(Math.min(.95, p))) return narrate(c.clock, c.title, "Nobody is watching", false, c.unseen, encrypt);
      const opts = c.options.filter(o => o.id !== "mdr" || S.mdr !== null);
      decide(c.clock, c.title, `<p>${known ? c.knownAlert : c.alert(S)}</p>`, opts, d => {
        if (d === "plug") {
          acc.care += c.plugCare; acc.trust -= 4; story.push(c.plugCost);
          if (chance(.9)) { story.push(c.plugWin); return finish("downtime"); }
          return narrate(c.clock, c.title, "Not fast enough", false, c.plugLose, encrypt);
        }
        if (d === "targeted") {
          const p2 = .3 + S.detect / 200 + S.inventory / 400 + (intel ? .2 : 0);
          if (chance(Math.min(.9, p2))) { acc.care -= 2; story.push(c.targetedWin); return finish("targeted"); }
          return narrate(c.clock, c.title, "Missed one", false, c.targetedLose, encrypt);
        }
        const p3 = S.mdrNoisy ? .45 : S.mdr / 100 * .9;
        if (chance(p3)) { acc.care -= 4; L.set(...(mode.setting.mdrNote || sys.notes.mdr)); story.push(c.mdrWin); return finish("mdrled"); }
        return narrate(c.clock, c.title, "Not fast enough", false, c.mdrLose, encrypt);
      });
    }

    /* 5. Encryption: patient safety, then recovery */
    function encrypt() {
      const en = cfg.encrypt;
      decide(en.clock, en.title, en.body(S), en.safety, d => {
        if (d === "divert") { acc.care += en.divertCare; acc.trust -= 4; story.push(en.divertText); }
        else if (chance(.5)) { acc.care += en.stayBadCare; story.push(en.stayBad); }
        else { acc.care += en.stayOkCare; story.push(en.stayOk); }
        recover();
      });
    }
    function recover() {
      const en = cfg.encrypt;
      if (sys.backupsGood()) { acc.trust -= 10; acc.care -= 8; story.push(en.restored); return finish("restored"); }
      decide(en.recoverClock, en.recoverTitle, en.noBackups(S), en.recovery, d => {
        L.set(...cfg.lessons.ransom);
        if (d === "pay") {
          const works = chance(.6);
          acc.trust -= works ? 25 : 35; acc.care -= works ? 8 : 18; acc.budget -= en.deductible;
          story.push(works ? en.paidWorks : en.paidFails);
          return finish("paid");
        }
        acc.trust -= 30; acc.care -= 25; story.push(en.rebuilt);
        finish("rebuilt");
      });
    }

    function finish(key) {
      S.finaleResult = key;
      const res = cfg.results[key];
      if (anyLucky) L.set(...cfg.lessons.luck);
      const fx = {};
      for (const k in acc) if (acc[k]) fx[k] = acc[k];
      if (res.fx) for (const k in res.fx) fx[k] = (fx[k] || 0) + res.fx[k];
      FT.screens.outcome(cfg.title, { text: story.concat(res.text).join(" "), fx, lesson: res.lesson });
    }
  }
})();
