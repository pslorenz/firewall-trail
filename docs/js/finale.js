/* SPDX-License-Identifier: GPL-3.0-or-later */
/* finale.js: the ransomware night, modeled as "assume breach".
 *   1. Probing: the gang tries every way in, weakest first, until one works.
 *      If all hold, they buy a zero-day. Each blocked attempt makes noise.
 *   2. Beachhead: EDR may stop them on the first computer.
 *   3. Spread: MDR (or you) may catch them, helped by earlier noise.
 *   4. Encryption: tested backups, or the ransom note.
 *   5. Optionally, the leak site: they stole data before encrypting.
 * Optional hooks in the config, all with sensible defaults:
 *   encrypt.backupState(S): "restored" | "survived" | "slow" | "wiped" | "none"
 *   encrypt.sanctioned(S): text shown when the gang can't legally be paid
 *   leak: { when(S, key), intro(S, key), options(S), choose(S, id) }
 * The mechanics live here; every word comes from the mode's finale config. */
(function () {
  const S = FT.S, L = FT.learned, { chance, roll } = FT.util, ui = FT.ui, sys = FT.sys;

  function run(cfg) {
    S.finale = true;
    const vectors = cfg.vectors(S).sort((a, b) => a.p - b.p);
    L.set(...cfg.lessons.weakest);
    L.set(...cfg.lessons.assume);

    const log = []; let blocked = 0, anyLucky = false, entry = null;
    for (const v of vectors) {
      const r = roll(v.p);
      if (r.ok) { blocked++; if (r.lucky) anyLucky = true; log.push({ v, ok: true, lucky: r.lucky }); }
      else { entry = v; log.push({ v, ok: false }); break; }
    }
    if (!entry) { entry = Object.assign({ zeroDay: true }, cfg.zeroDay); log.push({ v: entry, ok: false }); }

    const panel = (inner, focus) => ui.screen(`<div class="panel finale">${inner}
      <div class="row"><button class="btn" id="n">Continue</button></div></div>`, focus || "#n");

    probing();

    function probing() {
      const items = log.map((l, i) => `<li class="${l.ok ? "ok" : "no"}"><span class="t">${cfg.times[i]}</span><div><b>${l.v.zeroDay ? cfg.zeroDay.label : `They try ${l.v.name}.`}</b> ${l.ok ? (l.lucky ? cfg.luckyBlock : l.v.hold) : l.v.fail}</div></li>`).join("");
      const summary = blocked === 0 ? cfg.firstTry : `Your defenses turned them away ${blocked} time${blocked > 1 ? "s" : ""}. Every failed attempt left traces in your logs, which makes them easier to spot from here on.`;
      panel(`<h2>${cfg.title}</h2><p>${cfg.intro(S)}</p>
        <ol class="log">${items}</ol><p class="stage no">A foothold</p><p>${summary}</p>`);
      document.getElementById("n").onclick = beachhead;
    }

    function beachhead() {
      const b = cfg.beachhead;
      const r = roll(sys.eff(S.edr) * .75); // attackers adapt: even great EDR misses some
      let st, txt, done = null;
      if (r.ok && !r.lucky) { st = ["ok", b.blockedLabel]; txt = b.blocked; done = "edr"; }
      else if (r.ok) { anyLucky = true; st = ["ok", "Lucky break"]; txt = b.lucky(S); done = "luckyedr"; }
      else { st = ["no", b.failedLabel]; txt = b.failed(S); }
      if (S.edr !== null) L.set(...sys.notes.edr);
      panel(`<div class="clock">${b.clock}</div><h2>${b.title}</h2>
        <p>${b.pre}</p><p class="stage ${st[0]}">${st[1]}</p><p>${txt}</p>`);
      document.getElementById("n").onclick = () => done ? finish(done, b.outcomes[done]) : spread();
    }

    function spread() {
      const sp = cfg.spread;
      let who = null;
      if (S.mdr !== null) { const base = S.mdrNoisy ? S.mdr / 200 : S.mdr / 100; if (chance(Math.min(.97, base + .08 * blocked))) who = "mdr"; }
      if (!who && chance(.06 * blocked)) who = "self";
      const res = who === "mdr" ? sp.mdr : who === "self" ? sp.self
        : S.mdr !== null ? sp.mdrMissed + (S.mdrNoisy ? " Nobody saw it until morning." : " It wasn’t enough to stop them in time.")
        : sp.nobody;
      panel(`<div class="clock">${sp.clock}</div><h2>${sp.title}</h2>
        <p>${sp.pre}</p><p class="stage ${who ? "ok" : "no"}">${who ? "Detected" : "Nobody is watching"}</p><p>${res}</p>`);
      document.getElementById("n").onclick = () => {
        if (who === "mdr") { L.set(...sys.notes.mdr); return finish("mdr", sp.outcomes.mdr); }
        if (who === "self") return finish("self", sp.outcomes.self);
        encrypt();
      };
    }

    function encrypt() {
      const en = cfg.encrypt;
      const state = en.backupState ? en.backupState(S) : (sys.backupsGood() ? "restored" : "none");
      if (state === "restored" || state === "survived") return finish("backups", en.restored(S, state === "survived"));
      if (state === "slow") return finish("backups", en.restoredSlow(S));
      // A gang on a sanctions list can't legally be paid, so the only way out is rebuilding
      const banned = !!(S.gang.sanctioned && en.sanctioned);
      if (banned && cfg.lessons.sanctions) L.set(...cfg.lessons.sanctions);
      ui.screen(`<div class="panel finale"><div class="clock">${en.clock}</div><h2>${en.title}</h2>
        ${en.body(S, state)}${banned ? `<p><b>${en.sanctioned(S)}</b></p>` : ""}
        <div class="row">${banned ? "" : `<button class="btn" data-x="pay">${en.payLabel}</button>`}<button class="btn ${banned ? "" : "ghost"}" data-x="rebuild">${banned ? (en.rebuildOnlyLabel || en.rebuildLabel) : en.rebuildLabel}</button></div></div>`, "button[data-x]");
      FT.app.querySelectorAll("button[data-x]").forEach(b => b.onclick = () => {
        FT.note(cfg.title, `Chose: ${b.textContent}.`);
        L.set(...cfg.lessons.ransom);
        if (b.dataset.x === "pay") finish("paid", en.paid(chance(.6)));
        else finish("rebuilt", banned && en.rebuiltNoChoice ? en.rebuiltNoChoice : en.rebuilt);
      });
    }

    function finish(key, r) {
      S.finaleResult = key;
      if (anyLucky) L.set(...cfg.lessons.luck);
      // copy so the config's objects are never mutated by outcome adjustments
      const done = extra => {
        const fx = Object.assign({}, r.fx);
        if (extra) { for (const k in extra.fx || {}) fx[k] = (fx[k] || 0) + extra.fx[k]; if (extra.lesson) L.set(...extra.lesson); }
        FT.screens.outcome(cfg.title, { text: extra ? `${r.text} ${extra.text}` : r.text, fx, lesson: r.lesson });
      };
      if (!cfg.leak || !cfg.leak.when(S, key)) return done(null);
      // They copied data before encrypting: what do you tell people?
      const lk = cfg.leak;
      ui.screen(`<div class="panel finale"><div class="clock">${lk.clock}</div><h2>${lk.title}</h2>${lk.intro(S, key)}
        <p><b>What do you do?</b></p>
        <div class="row">${lk.options(S).map((o, i) => `<button class="btn ${i ? "ghost" : ""}" data-l="${o.id}">${o.label}</button>`).join("")}</div></div>`, "button[data-l]");
      FT.app.querySelectorAll("button[data-l]").forEach(b => b.onclick = () => { FT.note(lk.title, `Chose: ${b.textContent}.`); done(lk.choose(S, b.dataset.l)); });
    }
  }

  FT.finale = { run };
})();
