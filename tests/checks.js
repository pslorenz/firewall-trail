/* SPDX-License-Identifier: GPL-3.0-or-later */
/* checks.js: automated checks that run inside the game page.
 *
 * Run them with `npm test` (see tests/README.md), or paste this file into the
 * browser console on the game page and run `await FTChecks.run()`.
 *
 * What it checks:
 *   - Every mode and setting can be played start to finish by a "monkey"
 *     that clicks random buttons, with no errors and no broken text
 *     (undefined, NaN, [object Object]) on any screen.
 *   - The same year code and the same choices give the same year.
 *   - Year codes round-trip, and carry the mode's rules version.
 *   - Every practitioner event runs without errors in random situations.
 *   - Practitioner ransomware night always reaches an ending, in random
 *     situations, and never offers to pay a sanctioned gang.
 *   - Every practitioner status row lists a task that improves it.
 *
 * Randomness here uses its own seeded generator, never the game's, so the
 * checks don't disturb the game's year-code streams. A failure prints the
 * seed so it can be reproduced with FTChecks.run({ seed }). */
(function () {
  const S = FT.S;

  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  let rand = mulberry(1);
  const pick = a => a[Math.floor(rand() * a.length)];
  // Game seeds come from the checks' own generator, so a whole run repeats exactly with the same --seed
  const gameSeed = () => Array.from({ length: 5 }, () => pick([...FT.rng.ALPHA])).join("");
  const BAD_TEXT = /\bundefined\b|\bNaN\b|\[object Object\]/;
  // Buttons the monkey must not press: they leave the game, open windows or print
  const NO_CLICK = new Set(["back", "menu", "fb", "feedback", "print", "report", "achv", "again", "replay"]);
  const PROGRESS = new Set(["next", "n", "go", "tipnext", "tipfill", "cont", "continue"]);

  const results = [];
  function record(name, ok, detail) { results.push({ name, ok, detail: detail || "" }); }

  // Every way to configure a mode: each setting, and each kind of a setting with kinds
  function configurations(m) {
    if (!m.allSettings) return [{ label: m.name, apply() {} }];
    const out = [];
    for (const st of Object.values(m.allSettings())) {
      const kinds = st.kindOptions ? st.kindOptions.map(k => k[0]) : [null];
      for (const kind of kinds) out.push({ label: `${m.name} / ${st.id}${kind ? ` / ${kind}` : ""}`, apply() { FT.picker.select(m, st.id, kind); } });
    }
    return out;
  }

  /* ---------- The monkey: plays a whole year with random clicks ---------- */
  function monkeyStep() {
    const app = FT.app;
    // Fill selects and text inputs at random
    for (const sel of app.querySelectorAll("select")) {
      if (rand() < .5) continue;
      const opts = [...sel.options].filter(o => !o.disabled);
      if (!opts.length) continue;
      sel.value = pick(opts).value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    for (const inp of app.querySelectorAll("input[type=text], input:not([type]), input[type=password]")) {
      if (!inp.value) { inp.value = pick(["password", "Correct-Horse-Battery-Staple-42", "abc", "Summer2026!"]); inp.dispatchEvent(new Event("input", { bubbles: true })); }
    }
    // Tick and untick task checkboxes (student mode plans with these)
    for (const cb of app.querySelectorAll("input[type=checkbox]:not(:disabled)")) if (rand() < .35) cb.click();
    const buttons = [...app.querySelectorAll("button")].filter(b => !b.disabled && !NO_CLICK.has(b.id));
    if (!buttons.length) {
      const form = app.querySelector("form"); if (form) { form.dispatchEvent(new Event("submit", { cancelable: true })); return true; }
      return false;
    }
    const forward = buttons.filter(b => PROGRESS.has(b.id));
    (forward.length && rand() < .6 ? pick(forward) : pick(buttons)).click();
    return true;
  }
  function playYear(m, conf, opts) {
    FT.mode = m;
    if (m.prefs) { m.prefs.tutorial = !!opts.tutorial; if ("difficulty" in m.prefs) m.prefs.difficulty = opts.difficulty || "normal"; }
    conf.apply();
    FT.pendingSeed = opts.gameSeed || null;
    FT.screens.intro(m.id, opts.gameSeed ? "TEST" : undefined);
    FT.pendingSeed = opts.gameSeed || gameSeed(); // every year comes from the run's seed, so --seed reproduces it
    document.getElementById("go").click();
    let steps = 0, badText = null;
    while (!S.ended && steps < 6000) {
      const txt = FT.app.textContent;
      if (!badText && BAD_TEXT.test(txt)) badText = txt.slice(Math.max(0, txt.search(BAD_TEXT) - 120), txt.search(BAD_TEXT) + 40);
      if (!monkeyStep()) break;
      steps++;
    }
    return { ended: !!S.ended, steps, badText, code: S.code, grade: S.endGrade, loss: S.endLoss, notes: JSON.stringify([S.trust, S.care, S.budget, S.morale, S.board, S.finaleResult]) };
  }

  function checkFullYears(opts) {
    for (const id of FT.modeOrder) {
      const m = FT.modes[id];
      for (const conf of configurations(m)) for (let i = 0; i < opts.years; i++) {
        const difficulty = ["easy", "normal", "hard"][i % 3], tutorial = i % 2 === 0;
        let r, err = null;
        try { r = playYear(m, conf, { difficulty, tutorial }); } catch (e) { err = e; }
        const name = `Full year: ${conf.label} (${difficulty}${tutorial ? ", tutorial" : ""})`;
        if (err) record(name, false, `${err.message}\n${err.stack || ""}`);
        else if (!r.ended) record(name, false, `Didn’t reach the end of the year after ${r.steps} steps (code ${r.code}).`);
        else if (r.badText) record(name, false, `Broken text on screen (code ${r.code}): …${r.badText}…`);
        else record(name, true, `Grade ${r.grade} in ${r.steps} steps (code ${r.code})`);
      }
    }
  }

  /* ---------- Same code, same choices, same year ---------- */
  function checkDeterminism() {
    for (const id of FT.modeOrder) {
      const m = FT.modes[id], conf = configurations(m)[0], seed = "K7F3Q";
      rand = mulberry(42); const a = playYear(m, conf, { gameSeed: seed, difficulty: "normal" });
      rand = mulberry(42); const b = playYear(m, conf, { gameSeed: seed, difficulty: "normal" });
      record(`Same code replays the same year: ${conf.label}`, a.code === b.code && a.notes === b.notes && a.grade === b.grade,
        a.notes === b.notes ? `${a.code}: grade ${a.grade}` : `First run ${a.notes}, second run ${b.notes}`);
      const parsed = FT.rng.parse(a.code);
      const version = m.rulesVersion || 1;
      record(`Year code round-trips: ${conf.label}`, !!parsed && parsed.seed === seed && parsed.version === version && (!m.loadCode || m.loadCode(parsed.prefix)),
        `${a.code} parsed as ${JSON.stringify(parsed)}`);
    }
    const old = FT.rng.parse("PHNT-K7F3Q");
    record("Codes without a version number read as version 1", !!old && old.version === 1, JSON.stringify(old));
  }

  /* ---------- Practitioner: random situations ---------- */
  const PCT = ["patch", "clinPatch", "otPatch", "training", "detect", "inventory", "edr", "filter", "vendor", "cloud", "rmm", "adminAccess", "vault", "standard", "builtin", "admins", "shadow", "mfaCover"];
  const BOOL = ["mfa", "mfaStrong", "immutable", "backupTested", "irPlan", "segmented", "badge", "gateway", "guardrails", "pam", "payRule", "insured", "ownerExempt", "expanded"];
  function randomize() {
    for (const k of PCT) if (typeof S[k] === "number") S[k] = Math.floor(rand() * 101);
    for (const k of BOOL) if (k in S) S[k] = rand() < .5;
    S.backupAge = Math.floor(rand() * 5); S.stale = Math.floor(rand() * 15);
    const mdr = pick([null, "noisy", "tuned"]); S.mdr = mdr === null ? null : mdr === "noisy" ? 35 : 85; S.mdrNoisy = mdr === "noisy";
    S.lingering = []; for (let i = Math.floor(rand() * 3); i > 0; i--) S.lingering.push({ what: "a test foothold", month: "Mar" });
    S.gang.sanctioned = rand() < .3;
    S.month = Math.floor(rand() * 10);
  }
  function startPractitioner(conf) {
    const m = FT.modes.practitioner;
    FT.mode = m; m.prefs.tutorial = rand() < .3; m.prefs.difficulty = pick(["easy", "normal", "hard"]);
    conf.apply(); FT.pendingSeed = gameSeed(); FT.screens.start();
    return m;
  }

  function checkEvents(opts) {
    const m0 = FT.modes.practitioner;
    for (const conf of configurations(m0)) {
      const fails = []; let runs = 0;
      for (let i = 0; i < opts.eventRounds; i++) {
        const m = startPractitioner(conf);
        for (const ev of m.events) {
          randomize();
          const runs_ = ev.choices ? ev.choices.map(c => () => c.run()) : ev.run ? [() => ev.run(S)] : [];
          for (const run of runs_) {
            runs++;
            try {
              const r = run();
              if (!r || typeof r.text !== "string") fails.push(`${ev.id}: no outcome text`);
              else if (BAD_TEXT.test(r.text)) fails.push(`${ev.id}: broken text: ${r.text.slice(0, 140)}`);
            } catch (e) { fails.push(`${ev.id}: ${e.message}`); }
          }
        }
      }
      record(`Every event runs: ${conf.label}`, !fails.length, fails.length ? [...new Set(fails)].slice(0, 8).join("\n") : `${runs} event outcomes`);
    }
  }

  function checkFinale(opts) {
    const m0 = FT.modes.practitioner;
    for (const conf of configurations(m0)) {
      const fails = [], seen = {}; let paidSanctioned = 0;
      for (let i = 0; i < opts.nights; i++) {
        const m = startPractitioner(conf);
        randomize();
        let res = null; const orig = FT.screens.outcome;
        FT.screens.outcome = (t, r) => { res = r; };
        try {
          m.scheduled[m.scheduled.length - 1].run();
          let steps = 0;
          while (!res && steps < 40) {
            const labels = [...FT.app.querySelectorAll("button[data-d]")].map(b => b.textContent);
            if (S.gang.sanctioned && labels.some(l => /^Pay/.test(l))) paidSanctioned++;
            if (BAD_TEXT.test(FT.app.textContent)) { fails.push(`broken text on screen: ${FT.app.textContent.slice(0, 160)}`); break; }
            const bt = [...FT.app.querySelectorAll("button[data-d], #n")];
            if (!bt.length) break;
            pick(bt).click(); steps++;
          }
          if (!res) fails.push("ransomware night never reached an ending");
          else if (BAD_TEXT.test(res.text)) fails.push(`broken result text: ${res.text.slice(0, 160)}`);
          else seen[S.finaleResult] = (seen[S.finaleResult] || 0) + 1;
          if (res && !m.setting.finale.results[S.finaleResult]) fails.push(`unknown result ${S.finaleResult}`);
        } catch (e) { fails.push(e.message); }
        FT.screens.outcome = orig;
      }
      if (paidSanctioned) fails.push(`offered to pay a sanctioned gang ${paidSanctioned} times`);
      record(`Ransomware night: ${conf.label}`, !fails.length, fails.length ? [...new Set(fails)].slice(0, 6).join("\n") : `${opts.nights} nights: ${JSON.stringify(seen)}`);
    }
  }

  /* ---------- Student: ransomware night in random situations ---------- */
  function checkStudentFinale(opts) {
    const m = FT.modes.student, fails = [], seen = {}; let paidSanctioned = 0;
    for (let i = 0; i < opts.nights; i++) {
      FT.mode = m; FT.pendingSeed = gameSeed(); FT.screens.start();
      for (const k of ["patch", "training", "inventory"]) S[k] = Math.floor(rand() * 101);
      for (const k of ["filter", "edr"]) S[k] = rand() < .3 ? null : Math.floor(rand() * 101);
      for (const k of ["mfa", "passkeys", "immutable", "backupTested", "irPlan"]) S[k] = rand() < .5;
      S.backupAge = Math.floor(rand() * 5); S.stale = Math.floor(rand() * 10); S.mfaGaps = Math.floor(rand() * 6);
      const mdr = pick([null, "noisy", "tuned"]); S.mdr = mdr === null ? null : mdr === "noisy" ? 35 : 85; S.mdrNoisy = mdr === "noisy";
      S.lingering = []; for (let j = Math.floor(rand() * 3); j > 0; j--) S.lingering.push({ what: "a test foothold", month: "Oct", real: rand() < .7 });
      S.gang.sanctioned = rand() < .3;
      let res = null; const orig = FT.screens.outcome;
      FT.screens.outcome = (t, r) => { res = r; };
      try {
        FT.finale.run(m.finale);
        let steps = 0;
        while (!res && steps < 20) {
          const btns = [...FT.app.querySelectorAll("button[data-x], button[data-l], #n")];
          if (S.gang.sanctioned && btns.some(b => /^Pay/.test(b.textContent))) paidSanctioned++;
          if (BAD_TEXT.test(FT.app.textContent)) { fails.push(`broken text on screen: ${FT.app.textContent.slice(0, 160)}`); break; }
          if (!btns.length) break;
          pick(btns).click(); steps++;
        }
        if (!res) fails.push("ransomware night never reached an ending");
        else if (BAD_TEXT.test(res.text)) fails.push(`broken result text: ${res.text.slice(0, 160)}`);
        else seen[S.finaleResult] = (seen[S.finaleResult] || 0) + 1;
      } catch (e) { fails.push(e.message); }
      FT.screens.outcome = orig;
    }
    if (paidSanctioned) fails.push(`offered to pay a sanctioned gang ${paidSanctioned} times`);
    record("Ransomware night: Student mode", !fails.length, fails.length ? [...new Set(fails)].slice(0, 6).join("\n") : `${opts.nights} nights: ${JSON.stringify(seen)}`);
    // Every student status row that isn't green lists a task that fixes it
    for (const month of [4, 9]) for (const mdr of [null, 35]) {
      FT.mode = m; FT.pendingSeed = gameSeed(); FT.screens.start(); S.month = month; S.mfa = true; S.mfaGaps = 2; S.lingering = [{ what: "x", month: "Oct", real: true }]; S.filter = 30; S.edr = 30; S.mdr = mdr; S.mdrNoisy = mdr !== null;
      const hints = m.improveHints(), missing = m.dashboard(S).filter(r => r[1] !== "good").map(r => r[0]).filter(l => !(hints[l] || []).length);
      record(`Every status row can be improved: Student mode (month ${month + 1}, ${mdr === null ? "no MDR" : "noisy MDR"})`, !missing.length, missing.length ? `No task improves: ${missing.join(", ")}` : "");
    }
  }

  /* ---------- Leadership: the Q4 crisis in random situations ---------- */
  function checkLeadershipCrisis(opts) {
    const lm = FT.modes.leadership;
    for (const conf of configurations(lm)) {
      const fails = [], seen = {}; let payOffered = 0, denials = 0, misrepRuns = 0;
      for (let i = 0; i < opts.nights; i++) {
        FT.mode = lm; lm.prefs.tutorial = false; conf.apply(); FT.pendingSeed = gameSeed(); FT.screens.start();
        const d = S.d;
        d.mfa = rand() < .5; d.backups = rand() < .5; d.mdr = rand() < .4; d.irPlan = rand() < .4;
        d.patch = Math.floor(rand() * 101); d.detect = Math.floor(rand() * 101); d.vendor = Math.floor(rand() * 101); d.exceptions = Math.floor(rand() * 3);
        S.insured = rand() < .6; S.insuranceMisrep = S.insured && rand() < .5; S.sanctioned = rand() < .3;
        S.lingering = rand() < .3; S.incidentQ = 1; S.falseAttest = rand() < .3; S.leadGone = rand() < .15;
        S.month = 3;
        const misrep = S.insured && S.insuranceMisrep && !d.mfa; if (misrep) misrepRuns++;
        let res = null; const orig = FT.screens.outcome;
        FT.screens.outcome = (t, r) => { res = r; };
        try {
          // The crisis reads the latest report for what the security lead believes about backups
          S.report = [["Multi-factor login", 2], ["Backups", d.backups ? 2 : 1]];
          lm.scheduled.find(x => x.when({ month: 3, accepted: [] }) && String(x.run).includes("crisis")).run();
          let steps = 0;
          while (!res && steps < 20) {
            const btns = [...FT.app.querySelectorAll("button[data-i], button[data-d], #n")];
            if (S.sanctioned && btns.some(b => /Pay the ransom/.test(b.textContent))) payOffered++;
            if (BAD_TEXT.test(FT.app.textContent)) { fails.push(`broken text on screen: ${FT.app.textContent.slice(0, 160)}`); break; }
            if (!btns.length) break;
            pick(btns).click(); steps++;
          }
          if (!res) fails.push("the crisis never reached an ending");
          else if (BAD_TEXT.test(res.text)) fails.push(`broken result text: ${res.text.slice(0, 160)}`);
          else { seen[S.finaleResult] = (seen[S.finaleResult] || 0) + 1; if (/denied the claim/.test(res.text)) denials++; if (/denied the claim/.test(res.text) && !misrep) fails.push("claim denied without a false application"); if (misrep && S.finaleResult !== "contained" && !/denied the claim/.test(res.text)) fails.push("false application but the claim went through"); }
        } catch (e) { fails.push(`${e.message}`); }
        FT.screens.outcome = orig;
      }
      if (payOffered) fails.push(`offered to pay a sanctioned group ${payOffered} times`);
      record(`Q4 crisis: ${conf.label}`, !fails.length, fails.length ? [...new Set(fails)].slice(0, 6).join("\n") : `${opts.nights} crises: ${JSON.stringify(seen)}, ${denials} denied claims`);
    }
  }

  /* A well-prepared CEO who makes the strongest call at every step should usually,
   * but not always, lead the company well through the crisis. */
  function checkPreparedCrisis(opts) {
    const lm = FT.modes.leadership, runs = Math.max(300, opts.nights * 2), seen = {}; let errors = [];
    for (let i = 0; i < runs; i++) {
      FT.mode = lm; lm.prefs.tutorial = false; pick(configurations(lm)).apply(); FT.pendingSeed = gameSeed(); FT.screens.start();
      Object.assign(S.d, { mfa: true, backups: true, mdr: true, irPlan: true, patch: 80, detect: 80, vendor: 80, exceptions: 0 });
      Object.assign(S, { insured: true, insuranceMisrep: false, sanctioned: false, lingering: false, falseAttest: false, claimedSafe: false, leadGone: false, month: 3, accepted: [] });
      S.report = [["Multi-factor login", 2], ["Backups", 2]];
      let res = null; const orig = FT.screens.outcome;
      FT.screens.outcome = (t, r) => { res = r; };
      try {
        lm.scheduled[0].run();
        for (let steps = 0; !res && steps < 20; steps++) { const b = FT.app.querySelector('button[data-d="0"], #n'); if (!b) break; b.click(); }
        if (res) seen[S.finaleResult] = (seen[S.finaleResult] || 0) + 1; else errors.push("no ending");
      } catch (e) { errors.push(e.message); }
      FT.screens.outcome = orig;
    }
    const good = (seen.led || 0) + (seen.contained || 0), share = good / runs;
    const ok = !errors.length && share >= .75 && share <= .985;
    record("Prepared CEO, best calls: usually but not always leads well", ok, `${Math.round(share * 100)}% led well or contained over ${runs} crises: ${JSON.stringify(seen)}${errors.length ? `; errors: ${errors.slice(0, 3).join("; ")}` : ""}`);
  }

  /* ---------- Over budget: free work must still be assignable ---------- */
  function checkOverBudget() {
    const pm = FT.modes.practitioner;
    for (const conf of configurations(pm)) {
      const m = startPractitioner(conf);
      S.month = 2; S.budget = -5000; S.tip = 99; m.prefs.tutorial = false;
      FT.screens.plan();
      const opts = [...FT.app.querySelectorAll("select[data-m] option")].filter(o => o.value && o.value !== "rest");
      const free = opts.filter(o => { const a = m.actions.find(x => x.id === o.value); return a && !a.cost; });
      const paid = opts.filter(o => { const a = m.actions.find(x => x.id === o.value); return a && a.cost && !(a.kind === "project" && S.proj[a.id] !== undefined); });
      const ok = free.length && free.every(o => !o.disabled) && paid.every(o => o.disabled);
      record(`Over budget, free tasks can still be assigned: ${conf.label}`, !!ok, ok ? "" : `free disabled: ${free.filter(o => o.disabled).map(o => o.value).join(", ")}; paid enabled: ${paid.filter(o => !o.disabled).map(o => o.value).join(", ")}`);
    }
    const sm = FT.modes.student;
    FT.mode = sm; FT.pendingSeed = gameSeed(); FT.screens.start(); S.month = 3; S.budget = -2000; S.tipsDone = true;
    FT.screens.plan();
    const boxes = [...FT.app.querySelectorAll("input[data-id]")];
    const cost = id => sm.actions.find(a => a.id === id).cost;
    const ok = boxes.filter(b => !cost(b.dataset.id)).every(b => !b.disabled) && boxes.filter(b => cost(b.dataset.id)).every(b => b.disabled);
    record("Over budget, free tasks can still be assigned: Student mode", ok, ok ? "" : boxes.map(b => `${b.dataset.id}:${b.disabled ? "off" : "on"}`).join(" "));
  }

  function checkHardeningPaths() {
    const m0 = FT.modes.practitioner;
    for (const conf of configurations(m0)) for (const late of [false, true]) {
      const m = startPractitioner(conf);
      m.prefs.tutorial = false;
      if (late) { S.month = 9; S.mdr = null; S.mfa = true; S.mfaCover = 70; }
      const hints = m.improveHints(), info = m.setting.infoRows || [];
      // A row that's already green with nothing left to do (a finished project) is fine
      const missing = m.dashboard(S).filter(r => r[1] !== "good").map(r => r[0]).filter(l => !info.includes(l) && !(hints[l] || []).length);
      record(`Every status row can be improved: ${conf.label}${late ? " (late in the year)" : ""}`, !missing.length, missing.length ? `No task improves: ${missing.join(", ")}` : "");
    }
  }

  async function run(options) {
    const opts = Object.assign({ seed: Math.floor(Math.random() * 1e9), years: 3, nights: 60, eventRounds: 3 }, options || {});
    results.length = 0;
    rand = mulberry(opts.seed);
    const t0 = Date.now();
    const steps = [["full years", () => checkFullYears(opts)], ["determinism", checkDeterminism], ["events", () => checkEvents(opts)], ["ransomware night", () => checkFinale(opts)], ["student ransomware night", () => checkStudentFinale(opts)], ["hardening paths", checkHardeningPaths], ["over budget", checkOverBudget], ["leadership crisis", () => checkLeadershipCrisis(opts)], ["prepared crisis", () => checkPreparedCrisis(opts)]];
    for (const [name, fn] of steps) {
      try { fn(); } catch (e) { record(`Check crashed: ${name}`, false, `${e.message}\n${e.stack || ""}`); }
      await new Promise(r => setTimeout(r, 0)); // let the page breathe between groups
    }
    FT.screens.title();
    const failed = results.filter(r => !r.ok);
    return { seed: opts.seed, ms: Date.now() - t0, passed: results.length - failed.length, failed: failed.length, results };
  }

  window.FTChecks = { run };
})();
