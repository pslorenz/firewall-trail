/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Practitioner mode: you lead a small security team.
 *
 * Differences from student mode:
 *  - A team instead of slots. Each person has a specialty and their own
 *    burnout. Push too hard and an analyst quits; replacements take time.
 *  - Projects take several months of work, and specialists move them faster.
 *  - A change report after each month's work, because changes can break things.
 *  - Settings (hospital first) supply the world: months, events, alerts,
 *    setting-specific tasks and the ransomware night's wording.
 * The mechanics here are shared by every setting. */
(function () {
  const S = FT.S, L = FT.learned, { clamp, chance, pick, money } = FT.util, ui = FT.ui;

  const SKILLS = { lead: "Leadership", infra: "Infrastructure", detect: "Detection" };
  const settings = {};

  /* ---------- Difficulty ----------
   * budget: starting and monthly budget. decay: how fast defenses wear off.
   * burn: monthly burnout for everyone. quit: burnout at which analysts may resign.
   * harm: multiplier on every bad outcome. detect/edr: ransomware night odds. */
  const DIFFICULTY = {
    easy:   { label: "Easy",   desc: "More budget, slower decay, gentler incidents, less unplanned work, a less skilled ransomware crew. Good for learning the systems.", interrupts: [.45, .45], budget: 1.25, decay: .7, burn: 2, quit: 92, harm: .75, detect: .1, edr: .65 },
    normal: { label: "Normal", desc: "The intended balance. Careful planning usually wins; neglect usually doesn’t.", interrupts: [.2, .5], budget: 1, decay: 1, burn: 4, quit: 85, harm: 1, detect: 0, edr: .55 },
    hard:   { label: "Hard",   desc: "A tight budget, faster decay, harsher incidents, more unplanned work, and a skilled crew on ransomware night. For people who do this for a living.", interrupts: [.1, .45], budget: .8, decay: 1.3, burn: 6, quit: 80, harm: 1.25, detect: -.05, edr: .45 }
  };

  /* ---------- Team ---------- */
  const team = {
    present: () => S.team.filter(p => !p.away),
    member: id => S.team.find(p => p.id === id),
    // How good someone is at a task: specialists are faster, you are decent at
    // everything, an analyst working outside their specialty is slower.
    mult(p, a) {
      if (a.skill === "any") return 1;
      let k = p.skill === a.skill ? 1.4 : p.skill === "lead" ? 1 : .7;
      if (p.newHire) k *= .7;
      if (p.burnout >= 65) k *= .8; // tired people work slower
      return k;
    },
    capacity: p => p.away ? 0 : p.newHire ? 1 : p.cap,
    burn(id, amt) { const p = team.member(id); if (p && !p.away) p.burnout = clamp(p.burnout + amt); },
    burnAll(amt) { team.present().forEach(p => p.burnout = clamp(p.burnout + amt)); },
    morale: () => { const t = team.present().filter(p => !p.vendor); return t.length ? Math.round(100 - t.reduce((s, p) => s + p.burnout, 0) / t.length) : 0; },
    burnLabel(b) { return b < 30 ? ["good", "Fresh"] : b < 55 ? ["warn", "Tired"] : b < 65 ? ["warn", "Worn down"] : b < 80 ? ["bad", "Burning out, slower"] : ["bad", "Making mistakes"]; }
  };

  /* ---------- Tasks shared by every setting ----------
   * skill: who's best at it. kind: "upkeep" (repeatable) or "project" (multi-month).
   * apply(S, k, person) changes the world and returns a line for the change
   * report, or {text, fx, bad} if something went wrong. k is the skill multiplier. */
  const baseActions = [
    { id: "patchit", kind: "upkeep", skill: "infra", name: "Patch IT systems", desc: "Servers, laptops, VPN and network gear.", apply: (S, k) => { S.patch = clamp(S.patch + Math.round(40 * k)); return "Patched IT systems."; } },
    { id: "backup", kind: "upkeep", skill: "infra", name: "Run a restore test", desc: "Prove the backups actually restore.", apply: S => { S.backupAge = 0; S.backupTested = true; return "Restore test passed. Backups are proven good."; } },
    { id: "train", kind: "upkeep", skill: "lead", cost: 2000, name: "Run phishing training", desc: "A short session plus a simulated phish.", apply: (S, k) => { S.training = clamp(S.training + Math.round(25 * k)); return "Ran phishing training for staff."; } },
    { id: "tunedetect", kind: "upkeep", skill: "detect", name: "Tune detection rules", desc: "Cut noisy alerts, add rules for real attacker behavior.", apply: (S, k) => { S.detect = clamp(S.detect + Math.round(20 * k)); return "Tuned detection rules."; } },
    { id: "hunt", kind: "upkeep", skill: "detect", name: "Threat hunt", desc: "Go looking for what the alerts miss.", apply: (S, k) => { S.inventory = clamp(S.inventory + Math.round(30 * k)); const found = Math.min(S.stale, Math.round(3 * k)); S.stale -= found; return `Threat hunt mapped more of the network${found ? ` and found ${found} forgotten account${found > 1 ? "s" : ""}` : ""}.`; } },
    { id: "cleanup", kind: "upkeep", skill: "lead", name: "Offboarding cleanup with HR", desc: "Disable accounts for people who left.", apply: S => { const n = S.stale; S.stale = 0; return n ? `Disabled ${n} accounts for people who had left.` : "Checked offboarding. Nothing to disable."; } },
    { id: "tuneedr", kind: "upkeep", skill: "infra", name: "Tune endpoint protection", desc: "Policies, exclusions, more machines in blocking mode.", show: S => S.edr < 100, apply: (S, k) => { S.edr = clamp(S.edr + Math.round(20 * k)); return "Tuned endpoint protection."; } },
    { id: "tunefilter", kind: "upkeep", skill: "detect", name: "Tune the email filter", desc: "Look-alike domains, attachment sandboxing, link rewriting.", show: S => S.filter < 100, apply: (S, k) => { S.filter = clamp(S.filter + Math.round(20 * k)); return "Tuned the email filter."; } },
    { id: "vendorreview", kind: "upkeep", skill: "lead", name: "Review vendor access", desc: "Who still has remote access, and do they need it?", apply: (S, k) => { S.vendor = clamp(S.vendor + Math.round(30 * k)); return "Reviewed vendor remote access."; } },
    { id: "tunemdr", kind: "upkeep", skill: "detect", name: "Tune the MDR service", desc: "Teach it what normal looks like here. Self-tuning only goes so far.", show: S => S.mdr !== null && S.mdrNoisy && S.mdr < 60, apply: (S, k) => { S.mdr = Math.min(60, S.mdr + Math.round(12 * k)); if (S.mdr >= 55) S.mdrNoisy = false; return "Tuned MDR alerts."; } },
    { id: "mfa", kind: "project", skill: "lead", cost: 20000, work: 3, name: "Roll out multi-factor login", desc: "Every account, including remote access.", done: S => { S.mfa = true; return "Multi-factor login is live for all staff."; } },
    { id: "irplan", kind: "project", skill: "lead", cost: 0, work: 2, name: "Write and test an incident plan", desc: "Roles, call trees and a tabletop exercise with leadership.", done: S => { S.irPlan = true; return "The incident plan is written and tested."; } }
  ];

  /* ---------- Yearly conditions: two per year ---------- */
  const analyst = S => S.team.find(p => p.skill === "detect");
  const CONDITIONS = [
    { id: "freeze", name: "Budget freeze", good: false, excludes: ["backing"], desc: "Leadership froze spending. Your budget is 20% smaller all year.", apply: S => { S.budget = Math.round(S.budget * .8); S.budgetMult = .8; } },
    { id: "jobs", name: "Hot job market", good: false, desc: "Recruiters are calling your team every week. Burnout builds faster, and people resign sooner.", apply: S => { S.diff.burn += 1; S.diff.quit -= 10; } },
    { id: "wave", name: "Ransomware wave", good: false, desc: "Ransomware is surging in your industry. The big attack will come earlier, and the crew is sharper.", apply: (S, gen) => { S.finaleMonth = 8 + Math.floor(gen() * 2); S.diff.edr *= .9; } },
    { id: "watch", name: "Regulators are watching", good: false, desc: "A regulator is paying attention to your industry. Every incident hurts a bit more.", apply: S => { S.diff.harm *= 1.15; } },
    { id: "leave", name: "Parental leave", good: false, desc: "Your analyst is on parental leave for the first two months. Congratulations to them; good luck to you.", apply: S => { const p = analyst(S); Object.assign(p, { away: 2, awayNote: "On leave until month 3", replacement: { name: p.name, burnout: 10, newHire: 0, away: 0, returning: true } }); } },
    { id: "calm", name: "A calm year", good: true, desc: "Fewer audits and fewer outages. Less unplanned work lands on your team.", apply: S => { S.diff.interrupts = [.45, .45]; } },
    { id: "backing", name: "Board backing", good: true, excludes: ["freeze"], desc: "After a competitor’s breach, the board raised your budget 20%. They also expect more.", apply: S => { S.budget = Math.round(S.budget * 1.2); S.budgetMult = 1.2; S.trust = 60; } },
    { id: "grant", name: "Grant funding", good: true, desc: "A government cybersecurity grant adds $25,000 to this year’s budget.", apply: S => { S.budget += 25000; } }
  ];

  /* ---------- Starting situations ---------- */
  const STARTS = [
    { id: "typical", letter: "T", short: "Typical", name: "A typical program", desc: "Some things work, many don’t, and nobody’s quite sure which.", apply: S => {} },
    { id: "mess", letter: "M", short: "Inherited mess", name: "An inherited mess", desc: "Last year’s breach shook the board. You get a bigger budget, a tired team, and systems that are worse than they look.", apply: S => {
      S.trust = 50; S.budget = Math.round(S.budget * 1.3); S.patch -= 20; S.detect -= 15; S.stale += 6; S.vendor = Math.max(0, S.vendor - 10);
      S.team.forEach(p => p.burnout = Math.min(100, p.burnout + 15)); } },
    { id: "mature", letter: "A", short: "Mature program", name: "A mature program", desc: "Your predecessor built a lot: multi-factor login and an incident plan are done. The board thinks security is “handled” and trimmed your budget.", apply: S => {
      S.mfa = true; S.irPlan = true; S.done.mfa = true; S.done.irplan = true;
      S.patch += 20; S.detect += 25; S.edr += 20; S.filter += 15; S.budget = Math.round(S.budget * .7); S.budgetMult = (S.budgetMult || 1) * .8; S.trust = 70;
      S.team.forEach(p => p.burnout = Math.max(5, p.burnout - 10)); } },
    { id: "fresh", letter: "F", short: "Brand new", name: "A brand-new function", desc: "Security never existed here. A fresh, eager team, a clean slate, and almost no tools.", apply: S => {
      S.edr = 25; S.filter = 30; S.detect = 20; S.stale += 4; S.budget = Math.round(S.budget * 1.1);
      S.team.forEach(p => p.burnout = 10); } }
  ];

  /* ---------- Achievements ---------- */
  const ACHIEVEMENTS = [
    { id: "pr-survive", name: "Year one", desc: "Finish a year in practitioner mode.", test: (S, c) => !c.lossMsg },
    { id: "pr-hard", name: "For people who do this for a living", desc: "Finish a year on Hard.", test: (S, c) => !c.lossMsg && S.difficulty === "hard" },
    { id: "pr-hard-a", name: "Unflappable", desc: "Earn an A on Hard.", test: (S, c) => c.grade === "A" && S.difficulty === "hard" },
    { id: "pr-loyal", name: "Nobody quit", desc: "Finish a year without anyone on your team resigning.", test: (S, c) => !c.lossMsg && S.settingId !== "smallbiz" && S.replaced === 0 && S.team.every(p => !p.away || p.replacement && p.replacement.returning) },
    { id: "pr-quiet", name: "Quiet night", desc: "End ransomware night before it touches the servers.", test: S => ["edr", "early", "watched", "segment", "targeted"].includes(S.finaleResult) },
    { id: "pr-mess", name: "Turnaround", desc: "Earn a B or better after inheriting a mess.", test: (S, c) => ["A", "B"].includes(c.grade) && S.startInfo && S.startInfo.id === "mess" },
    { id: "pr-patience", name: "Patience", desc: "At the manufacturer, patch plant systems during shutdowns and never outside one, and finish the year.", test: (S, c) => !c.lossMsg && S.settingId === "manufacturing" && (S.otWindow || 0) > 0 && !(S.otOutside || 0) },
    { id: "pr-smallbiz", name: "Small but mighty", desc: "Earn an A at the small business.", test: (S, c) => c.grade === "A" && S.settingId === "smallbiz" },
    { id: "pr-wire", name: "Call to confirm", desc: "At the small business, stop a fake bank-detail change with your payment verification rule.", test: S => S.settingId === "smallbiz" && !!S.wireStopped },
    { id: "pr-keystone", name: "Keystone", desc: "Earn an A at the MSP.", test: (S, c) => c.grade === "A" && S.settingId === "msp" },
    { id: "pr-standard", name: "No exceptions", desc: "At the MSP, finish the year with no client exceptions to your standard stack.", test: (S, c) => !c.lossMsg && S.settingId === "msp" && !(S.exceptions || []).length },
    { id: "pr-all", name: "Three for three", desc: "Earn an A at the hospital, the manufacturer and the software company.", test: (S, c, data) => FT.ach.allSettingsA(data, "practitioner", ["hospital", "manufacturing", "software"]) }
  ];

  const mode = {
    id: "practitioner",
    name: "Practitioner mode",
    blurb: "Lead a small security team at a hospital, a manufacturer, a software company or an MSP, or be the one person who does IT at a small business. Hard trade-offs, real constraints.",
    intro: `
      <p>You run security at a regional hospital, a manufacturer, a B2B software company, or a managed service provider whose tools reach dozens of clients, leading a team of three, including you. Or you’re the one person who handles IT at a small business, with a few hours a month and some outside help. Each has its own systems, its own constraints, and its own version of the worst night of the year.</p>
      <p>Each month you assign work to your team. Specialists are faster at their own work, projects take months, and everyone has a burnout level. Push too hard and people quit.</p>
      <p>Keep <b>leadership trust</b>, your organization’s <b>core mission</b> (patient care, production, business momentum or client health) and your <b>team</b> intact for a full year. Some security fixes disrupt the very work you’re protecting, and some risks can’t be patched away.</p>`,
    slots: 0,
    advisor: { name: "Post-incident review" },
    prefs: { difficulty: "normal", tutorial: true, group: "random", sub: {}, start: "random" },
    /* The setting picker: the shapes of the job, with industries or kinds underneath */
    randomDesc: "You’ll find out where you work on day one.",
    groups: [
      { id: "midsize", label: "Mid-size organization", members: ["hospital", "manufacturing", "software"], subLegend: "Kind of organization",
        desc: "Lead a three-person security team inside one organization: a regional hospital, a manufacturer or a B2B software company.",
        subRandomDesc: "You’ll find out which organization on day one." },
      { id: "msp", label: "MSP", members: ["msp"],
        desc: "Lead a three-person security team at a managed service provider, where your tools reach about 70 clients at once." },
      { id: "smallbiz", label: "Small business", members: ["smallbiz"], subLegend: "Kind of business",
        desc: "No security team: just you, a few hours a month, and some outside help, at a medical practice, a machine shop or a software startup.",
        subRandomDesc: "You’ll find out what kind of business it is on day one." }
    ],
    allSettings: () => settings,
    DIFFICULTY,

    /* Choices on the intro screen, kept for "Play another year" */
    /* ---------- Year codes: P + setting + difficulty + start, e.g. PHNT ---------- */
    codeLetter: "P",
    codePrefix: S => "P" + mode.setting.letter + { easy: "E", normal: "N", hard: "H" }[S.difficulty] + STARTS.find(x => x.id === S.startInfo.id).letter,
    loadCode(prefix) {
      if (prefix.length !== 4) return false;
      // A setting with kinds (like the small business) has one code letter per kind
      const st = Object.values(settings).find(x => x.codeLetters && prefix[1] in x.codeLetters) || Object.values(settings).find(x => x.letter === prefix[1]);
      const diff = { E: "easy", N: "normal", H: "hard" }[prefix[2]];
      const start = STARTS.find(x => x.letter === prefix[3]);
      if (!st || !diff || !start) return false;
      Object.assign(mode.prefs, { difficulty: diff, start: start.id });
      return FT.picker.select(mode, st.id, st.codeLetters ? st.codeLetters[prefix[1]] : null);
    },
    conditions: CONDITIONS, starts: STARTS, achievements: ACHIEVEMENTS,

    introOptions() {
      const p = mode.prefs;
      return `${FT.picker.html(mode)}
        <fieldset class="seg"><legend>Difficulty</legend>
        <div class="seg-row">${Object.entries(DIFFICULTY).map(([k, d]) => `<label class="seg-opt"><input type="radio" name="diff" value="${k}" ${p.difficulty === k ? "checked" : ""}><span>${d.label}</span></label>`).join("")}</div>
        <p class="hint" id="diffdesc">${DIFFICULTY[p.difficulty].desc}</p></fieldset>
        ${FT.years.startOptions(STARTS, p.start)}
        <label class="ot tutopt"><input type="checkbox" id="tutorial" ${p.tutorial ? "checked" : ""}> Show the guided first month</label>`;
    },
    bindIntroOptions(root) {
      root.querySelectorAll('input[name="diff"]').forEach(r => r.onchange = () => { mode.prefs.difficulty = r.value; root.querySelector("#diffdesc").textContent = DIFFICULTY[r.value].desc; });
      root.querySelector("#tutorial").onchange = e => { mode.prefs.tutorial = e.target.checked; };
      FT.picker.bind(mode, root);
      FT.years.bindStartOptions(root, STARTS, v => { mode.prefs.start = v; });
    },
    startLabel: "Start the year",
    againLabel: "Play another year",
    team, SKILLS,
    meters: [
      { key: "trust", label: "Leadership trust", short: "Trust" },
      // "care" is the organization's core mission: patient care, production...
      { key: "care", label: "Patient care", short: "Care" },
      { key: "morale", label: "Team morale", short: "Morale", value: () => team.morale() }
    ],

    addSetting(st) { settings[st.id] = st; if (!mode.setting) mode.useSetting(st.id); },
    useSetting(id) {
      const st = mode.setting = settings[id];
      for (const k of ["months", "landmarks", "events", "minigames", "explain", "winTitle"]) mode[k] = st[k];
      mode.actions = (st.replaceBase ? [] : baseActions).concat(st.actions || []);
      if (st.meters) mode.meters = st.meters;
    },

    newState() {
      // The picker resolves random choices on their own stream, so a code that names the setting replays identically
      const w = FT.picker.resolve(mode);
      mode.useSetting(w.setting);
      mode.pendingKind = w.kind;
      const st = mode.setting, diff = Object.assign({}, DIFFICULTY[mode.prefs.difficulty]);
      const state = Object.assign({
        diff, difficulty: mode.prefs.difficulty, settingId: st.id, tutorial: mode.prefs.tutorial, tip: 0, replaced: 0,
        budget: Math.round((st.startBudget || 80000) * diff.budget), trust: 65, care: 90,
        patch: 50, backupAge: 4, backupTested: false, training: 30, detect: 35, inventory: 30,
        mfa: false, filter: 50, edr: 50, stale: 10, vendor: 20, irPlan: false,
        mdr: null, mdrNoisy: false, mdrRamp: false,
        proj: {}, done: {}, notices: [st.briefing],
        mdrMonth: 5 + Math.floor(FT.util.rand() * 3),
        expandMonth: 3 + Math.floor(FT.util.rand() * 2), expanded: false,
        interrupts: [], interruptMonth: -1,
        finaleMonth: 9 + Math.floor(FT.util.rand() * 3),
        gang: { name: pick(["Night Ledger", "GreyTide", "LockBlossom", "Cold Harbor", "Static Choir"]) }
      }, st.newState());
      FT.years.applyStart(state, FT.years.pickStart(STARTS, mode.prefs.start));
      FT.years.applyConditions(state, FT.years.pickConditions(CONDITIONS.filter(c => !(st.excludeConditions || []).includes(c.id)), 2));
      state.budget = Math.round(state.budget / 1000) * 1000;
      return state;
    },

    /* morale in fx becomes burnout for everyone present; the rest are meters */
    applyFx(S, fx) {
      if (fx.trust) S.trust = clamp(S.trust + fx.trust);
      if (fx.care) S.care = clamp(S.care + fx.care);
      if (fx.morale) team.burnAll(-fx.morale);
    },

    adjustOutcome(S, r) {
      harm(r.fx);
      // Settings can scale down trust rewards, so careful players can't stockpile trust
      const rs = mode.setting.rewardScale;
      if (rs && r.fx.trust > 0) r.fx.trust = Math.max(1, Math.round(r.fx.trust * rs));
      if (S.irPlan && (r.fx.trust <= -8 || r.fx.care <= -8)) {
        if (r.fx.trust <= -8) r.fx.trust = Math.round(r.fx.trust * .6);
        if (r.fx.care <= -8) r.fx.care = Math.round(r.fx.care * .7);
        r.noteLabel = "Plan in action";
        r.note = mode.setting.irNote;
        L.set("Incident response plan", "A plan written and rehearsed before an emergency, so people act fast and calmly instead of improvising.");
      }
    },

    /* ---------- The planning screen ---------- */
    plan() {
      const st = mode.setting, acts = mode.actions;
      const assign = {}, overtime = {};
      if (S.interruptMonth !== S.month) { S.interruptMonth = S.month; S.interrupts = rollInterrupts(); }
      const lockedFor = id => S.interrupts.filter(x => x.who === id);
      team.present().forEach(p => { assign[p.id] = []; overtime[p.id] = false; });

      const visible = a => !a.show || a.show(S);
      const projectOpen = a => a.kind === "project" && !S.done[a.id];
      const upfront = id => { const a = acts.find(x => x.id === id); return !a || !a.cost ? 0 : a.kind === "project" ? (S.proj[a.id] === undefined ? a.cost : 0) : a.cost; };
      function committed() {
        // project costs count once however many people work on it
        const seen = new Set(); let total = 0;
        for (const id of Object.keys(overtime)) { const p = team.member(id); if (overtime[id] && p && p.vendor) total += st.vendorHourCost; }
        for (const id of Object.keys(assign)) for (const t of assign[id]) {
          if (!t || t === "rest") continue;
          const a = acts.find(x => x.id === t);
          if (a.kind === "project") { if (seen.has(t)) continue; seen.add(t); }
          total += upfront(t);
        }
        return total;
      }

      function optionList(p, current) {
        const recover = p.vendor ? "" : `<optgroup label="Recover"><option value="rest" ${current === "rest" ? "selected" : ""}>Time off</option></optgroup>`;
        const left = S.budget - committed() + upfront(current);
        const opt = a => {
          const star = p.skill === a.skill ? " ★" : "";
          const prog = a.kind === "project" ? ` (${S.proj[a.id] !== undefined ? `${fmt(S.proj[a.id])} of ${a.work} person-months done` : `${a.work} person-months`})` : "";
          const cost = upfront(a.id) ? `, ${money(upfront(a.id))}` : "";
          const blocked = upfront(a.id) > left && current !== a.id;
          return `<option value="${a.id}" ${current === a.id ? "selected" : ""} ${blocked ? "disabled" : ""}>${a.name}${star}${prog}${cost}</option>`;
        };
        const up = acts.filter(a => a.kind === "upkeep" && visible(a)).map(opt).join("");
        const pr = acts.filter(a => projectOpen(a) && visible(a)).map(opt).join("");
        return `<option value="">Unassigned</option><optgroup label="Upkeep">${up}</optgroup>${pr ? `<optgroup label="Projects">${pr}</optgroup>` : ""}${recover}`;
      }

      function draw() {
        const cards = S.team.map(p => {
          if (p.away) return `<div class="member away"><div class="mhead"><b>${p.name}</b><span class="mrole">${p.role}</span><span class="burn">${p.awayNote}</span></div></div>`;
          const [cls, word] = team.burnLabel(p.burnout);
          const locked = lockedFor(p.id);
          const n = Math.max(0, team.capacity(p) - locked.length) + (overtime[p.id] ? 1 : 0);
          while (assign[p.id].length < n) assign[p.id].push("");
          assign[p.id].length = n;
          const selects = locked.map(x => `<div class="locked"><b>Unplanned:</b> ${x.text}</div>`).join("") +
            assign[p.id].map((cur, i) => `<select data-m="${p.id}" data-s="${i}" aria-label="${p.name}, task ${i + 1}">${optionList(p, cur)}</select>`).join("");
          if (p.vendor) return `<div class="member vendor"><div class="mhead"><b>${p.name}</b><span class="mrole">${p.role}</span><span class="burn">${team.capacity(p)} task${team.capacity(p) > 1 ? "s" : ""} a month on contract</span></div>
            <div class="mslots">${selects}</div>
            <label class="ot"><input type="checkbox" data-ot="${p.id}" ${overtime[p.id] ? "checked" : ""} ${!overtime[p.id] && S.budget - committed() < st.vendorHourCost ? "disabled" : ""}> Buy extra hours: one more task, ${money(st.vendorHourCost)}</label></div>`;
          return `<div class="member"><div class="mhead"><b>${p.name}</b><span class="mrole">${p.role}${st.hideSkills ? "" : `, ${SKILLS[p.skill].toLowerCase()}`}${p.newHire ? ", still ramping up" : ""}</span><span class="burn ${cls}">${word} (${p.burnout})</span></div>
            <div class="mslots">${selects}</div>
            ${p.id === "you" || p.newHire ? "" : `<label class="ot"><input type="checkbox" data-ot="${p.id}" ${overtime[p.id] ? "checked" : ""}> Ask for overtime: one more task, a lot more burnout</label>`}</div>`;
        }).join("");
        const notices = S.notices.map(n => `<div class="notice">${n}</div>`).join("") +
          (S.interrupts.length ? `<div class="notice"><b>Unplanned work:</b> ${S.interrupts.length === 1 ? "one task slot is" : `${S.interrupts.length} task slots are`} already taken this month. ${S.tutorial && !S.seenInterrupt ? "This happens most months: audits, outages and urgent requests don’t wait for your plan. Leave some slack for it." : ""}</div>` : "");
        if (S.interrupts.length) S.seenInterrupt = true;
        const tut = st.tutorial, tips = tut.tips, guided = S.tutorial && S.month === 0 && S.tip < tips.length;
        const target = guided ? tips[S.tip].target : null;
        let orient = "";
        if (guided) {
          const last = S.tip === tips.length - 1;
          orient = ui.advisor(`<p><b>${st.chief}:</b> ${tips[S.tip].text}</p>
            <div class="row"><button class="btn" id="tipnext">${last ? "Got it" : "Next tip"}</button>
            ${last ? `<button class="btn ghost" id="tipfill">Fill in your suggestion</button>` : `<button class="mini" id="tipskip">Skip tips</button>`}
            <span class="hint">${S.tip + 1} of ${tips.length}</span></div>`, "tut");
        } else if (S.month === 0) orient = ui.advisor(`<p><b>${st.chief}:</b> ${st.orientation}</p>`);
        else if (S.tutorial && tut.monthNotes[S.month]) orient = ui.advisor(`<p><b>${st.chief}:</b> ${tut.monthNotes[S.month]}</p>`);
        const spot = name => target === name ? "spot" : "";
        FT.app.innerHTML = ui.header() + `<div class="panel">
          <h2>${mode.months[S.month]}: ${mode.landmarks[S.month]}</h2>
          ${S.month === 0 ? FT.years.notice() : ""}${st.threatWarning(S)}${notices}${orient}
          <div class="${spot("dash")}">${ui.dashboard()}</div>
          <div class="${spot("team")}">
          <p>Assign this month’s work. ★ marks someone’s specialty: they do it about 40% better. Projects are measured in person-months, so a specialist finishes sooner, and they pay off only when finished.</p>
          <div class="team">${cards}</div>
          <p class="hint ${spot("budget")}">Committed this month: ${money(committed())} of ${money(S.budget)}.</p></div>
          <div class="row"><button class="btn" id="next">Start the month</button></div></div>`;
        FT.app.querySelectorAll("select[data-m]").forEach(sel => sel.onchange = () => {
          assign[sel.dataset.m][+sel.dataset.s] = sel.value; draw();
          const again = FT.app.querySelector(`select[data-m="${sel.dataset.m}"][data-s="${sel.dataset.s}"]`); again && again.focus();
        });
        FT.app.querySelectorAll("input[data-ot]").forEach(cb => cb.onchange = () => {
          overtime[cb.dataset.ot] = cb.checked; draw();
          const again = FT.app.querySelector(`input[data-ot="${cb.dataset.ot}"]`); again && again.focus();
        });
        const tn = document.getElementById("tipnext");
        if (tn) tn.onclick = () => { S.tip++; draw(); const f = document.getElementById("tipnext") || document.querySelector("select[data-m]"); f && f.focus(); };
        const tk = document.getElementById("tipskip");
        if (tk) tk.onclick = () => { S.tip = tips.length; draw(); document.querySelector("select[data-m]").focus(); };
        const tf = document.getElementById("tipfill");
        if (tf) tf.onclick = () => {
          for (const id of Object.keys(assign)) if (tut.suggested[id]) assign[id] = tut.suggested[id].slice();
          S.tip = tips.length; draw(); document.getElementById("next").focus();
        };
        document.getElementById("next").onclick = () => doWork(assign, overtime);
      }
      draw();
    },

    dashboard(S) {
      const rows = mode.setting.dashboard(S);
      for (const a of mode.actions) if (a.kind === "project" && S.proj[a.id] !== undefined)
        rows.push([a.name, "warn", `In progress: ${fmt(S.proj[a.id])} of ${a.work} person-months`]);
      return rows;
    },

    threatWarning(S) { return mode.setting.threatWarning(S); },

    monthEnd(S) {
      mode.setting.monthEnd(S);
      if (S.mdrRamp && S.month >= S.mdrMonth) { S.mdr = 85; S.mdrRamp = false; }
      S.notices = [];
      for (const p of S.team) {
        if (p.away) {
          p.away--;
          if (!p.away) {
            const back = p.replacement && p.replacement.returning;
            Object.assign(p, p.replacement);
            if (back) { delete p.returning; S.notices.push(`<b>${p.name}</b> is back from leave, rested and ready.`); }
            else { S.replaced++; S.notices.push(`<b>${p.name}</b> joined the team to replace the analyst who left. New hires work at reduced speed for a couple of months.`); }
          }
          continue;
        }
        if (p.vendor) { p.ot = false; p.idle = 0; continue; }
        p.burnout = clamp(p.burnout + S.diff.burn + (p.ot ? 12 : 0) - (p.idle ? 5 * p.idle : 0) + (S.mdrNoisy && p.skill === "detect" ? 6 : 0));
        p.ot = false; p.idle = 0;
        if (p.newHire) p.newHire--;
        if (p.id !== "you" && p.burnout >= S.diff.quit && chance(.4)) {
          const rep = mode.setting.replacement(p);
          S.notices.push(`<b>${p.name}</b> resigned. Burnout finally won. Hiring a replacement will take about two months.`);
          Object.assign(p, { away: 3, awayNote: "Position open", replacement: rep });
          L.set("Burnout is a security risk", "When people leave, their knowledge leaves with them, and the team that’s left gets stretched even thinner.");
        }
      }
      S.budget += Math.round(mode.setting.monthlyBudget * S.diff.budget * (S.budgetMult || 1));
    },

    lossCheck(S) {
      const you = team.member("you");
      if (S.trust <= 0 && S.finale) return mode.setting.deaths.ransomware;
      if (S.care <= 0) return mode.setting.deaths.care;
      if (S.trust <= 0) return mode.setting.deaths.trust;
      if (you.burnout >= 100) return "You have died of burnout.";
      return null;
    },

    grade(S, lossMsg) {
      const fr = S.finaleResult ? mode.setting.finale.results[S.finaleResult] : null;
      const morale = team.morale();
      const score = S.trust * .5 + S.care * .3 + morale * .1 + (fr ? fr.bonus : 0);
      const grade = lossMsg ? "F" : score >= 68 ? "A" : score >= 55 ? "B" : score >= 42 ? "C" : "D";
      const notes = { A: "The board wants to clone your whole team.", B: "A solid year. Bruised, not broken.", C: "You made it. Next year needs a better plan.", D: "Rough year. Everyone’s updating their résumé.", F: "The trail ends here." };
      return {
        grade, note: notes[grade],
        details: `<p class="hint">${mode.setting.name}, ${S.diff.label.toLowerCase()} difficulty. Final trust ${S.trust}, ${mode.meters[1].label.toLowerCase()} ${S.care}, team morale ${morale}, budget ${money(S.budget)}</p>` +
          (fr ? `<p class="hint">Ransomware night: <b>${fr.label}</b>${fr.bonus ? ` (+${fr.bonus} to your grade)` : ""}</p>` : "")
      };
    }
  };

  function fmt(n) { return Math.round(n * 10) / 10; }

  /* ---------- Unplanned work ----------
   * Most months, audits, outages and urgent requests eat some of the team's
   * time before you get to plan. Each interrupt lands on the person whose
   * skill it needs, if they have a free slot. Not in the first month. */
  const GENERIC_INTERRUPTS = [
    { skill: "lead", text: "The cyber insurance renewal questionnaire is due Friday.", done: "Answered the cyber insurance renewal questionnaire." },
    { skill: "lead", text: "An auditor wants evidence for 14 controls by next week.", done: "Pulled together audit evidence." },
    { skill: "lead", text: "Leadership wants a briefing on “that ransomware thing in the news.”", done: "Briefed leadership on the latest headline attack." },
    { skill: "lead", text: "Legal needs the security terms in a vendor contract reviewed today.", done: "Reviewed a vendor contract’s security terms for legal." },
    { skill: "detect", text: "A software update set off an alert storm that needs sorting out.", done: "Sorted out an alert storm caused by a software update." },
    { skill: "detect", text: "A phishing wave hit 200 inboxes, and the reports need triage.", done: "Triaged 200 reported phishing emails." },
    { skill: "detect", text: "Legal needs a year of email logs pulled for a lawsuit.", done: "Pulled a year of email logs for a legal hold." },
    { skill: "infra", text: "An expired certificate took down a login page.", done: "Replaced an expired certificate that broke a login page." },
    { skill: "infra", text: "A firewall power supply failed and needs replacing tonight.", done: "Replaced a failed firewall power supply overnight." },
    { skill: "infra", text: "A storage array is nearly full and needs emergency cleanup.", done: "Cleaned up a storage array that was about to fill." }
  ];
  function rollInterrupts() {
    if (S.month === 0) return [];
    const [p0, p1] = S.diff.interrupts, r = FT.util.rand();
    const count = mode.setting.noGenericInterrupts ? 0 : r < p0 ? 0 : r < p0 + p1 ? 1 : 2;
    const pool = GENERIC_INTERRUPTS.concat(mode.setting.interrupts || []);
    const out = [];
    for (let i = 0; i < count; i++) {
      const it = FT.util.draw("interrupts", pool, 1)[0];
      const free = p => !p.away && team.capacity(p) - out.filter(x => x.who === p.id).length > 0;
      let who = team.present().find(p => p.skill === it.skill && free(p));
      if (!who) who = team.present().find(free);
      if (who) out.push({ who: who.id, text: it.text, done: it.done });
    }
    // Settings can add their own pressure, e.g. a shared engineer pulled onto client work
    if (mode.setting.extraInterrupts) for (const x of mode.setting.extraInterrupts(S)) {
      const p = team.member(x.who);
      if (p && !p.away && team.capacity(p) - out.filter(o => o.who === p.id).length > 0) out.push(x);
    }
    return out;
  }
  // Scale bad outcomes by difficulty. Good outcomes are left alone.
  function harm(fx) {
    const h = S.diff ? S.diff.harm : 1;
    if (h === 1) return;
    for (const k of ["trust", "care", "morale", "budget"]) if (fx[k] < 0) fx[k] = Math.round(fx[k] * h);
  }

  /* ---------- Doing the work, then the change report ---------- */
  function doWork(assign, overtime) {
    const acts = mode.actions, lines = [], fx = {};
    const jobs = [];
    for (const x of S.interrupts) { const p = team.member(x.who); if (p && !p.away) lines.push({ who: p.name, text: `Unplanned: ${x.done}`, unplanned: true }); }
    for (const p of team.present()) {
      p.ot = !!overtime[p.id];
      if (p.ot && p.vendor) { S.budget -= mode.setting.vendorHourCost; lines.push({ who: p.name, text: `Bought extra hours (${money(mode.setting.vendorHourCost)}).` }); }
      p.idle = assign[p.id].filter(t => !t).length;
      for (const t of assign[p.id]) if (t) jobs.push({ p, t });
    }
    // tasks with a lower order run first (e.g. testing patches before deploying them)
    const ord = t => ((acts.find(x => x.id === t) || {}).order || 5);
    jobs.sort((a, b) => ord(a.t) - ord(b.t));
    const paid = new Set();
    for (const { p, t } of jobs) {
      if (t === "rest") { p.burnout = clamp(p.burnout - 25); lines.push({ who: p.name, text: "Took time off and came back rested." }); continue; }
      const a = acts.find(x => x.id === t), k = team.mult(p, a);
      // Near burnout, work starts slipping: a control misconfigured, a step skipped
      if (p.burnout >= 80 && chance(.35)) {
        if (a.cost && !(a.kind === "project" && S.proj[a.id] !== undefined)) { S.budget -= a.cost; if (a.kind === "project") S.proj[a.id] = 0; }
        lines.push({ who: p.name, text: `Too exhausted to do it right: ${a.kind === "project" ? `no real progress on “${a.name}” this month` : `“${a.name.toLowerCase()}” was rushed and misconfigured, so it didn’t stick`}.`, bad: true });
        L.set("Burnout erodes controls", "Exhausted people make mistakes before they quit: a rushed change, a skipped check. Watch the work, not just the resignations.");
        continue;
      }
      if (a.kind === "project") {
        if (S.done[a.id]) { lines.push({ who: p.name, text: `Helped wrap up the project “${a.name}”.` }); continue; }
        if (S.proj[a.id] === undefined) { S.proj[a.id] = 0; if (a.cost && !paid.has(a.id)) { S.budget -= a.cost; paid.add(a.id); } }
        S.proj[a.id] += k;
        if (S.proj[a.id] >= a.work) { delete S.proj[a.id]; S.done[a.id] = true; lines.push({ who: p.name, text: "Finished: " + a.done(S) }); }
        else lines.push({ who: p.name, text: `Worked on the project “${a.name}” (${fmt(S.proj[a.id])} of ${a.work} person-months done).` });
      } else {
        if (a.cost) S.budget -= a.cost;
        const r = a.apply(S, k, p);
        if (typeof r === "string") lines.push({ who: p.name, text: r });
        else { lines.push({ who: p.name, text: r.text, bad: r.bad }); for (const key in r.fx) fx[key] = (fx[key] || 0) + r.fx[key]; }
      }
    }
    if (!lines.length) lines.push({ who: "", text: "Nobody was assigned anything. The work piled up." });
    for (const l of lines) if (l.bad || /^Finished:/.test(l.text)) FT.note("Change report", `${l.who}: ${l.text}`);
    harm(fx);
    const deltas = Object.keys(fx).length ? FT.screens.applyFx(fx) : [];
    const reportTip = S.tutorial && S.month === 0 && mode.setting.tutorial.report ? FT.ui.advisor(`<p><b>${mode.setting.chief}:</b> ${mode.setting.tutorial.report}</p>`, "tut") : "";
    ui.screen(`<div class="panel"><h2>Change report</h2>${reportTip}
      <ul class="report">${lines.map(l => `<li class="${l.bad ? "bad" : ""} ${l.unplanned ? "unplanned" : ""}">${l.who ? `<span class="who">${l.who}:</span>` : ""}${l.text}</li>`).join("")}</ul>
      ${deltas.length ? `<div class="delta">${deltas.join("  ")}</div>` : ""}
      <div class="row"><button class="btn" id="next">See what the month brings</button></div></div>`, "#next");
    document.getElementById("next").onclick = () => { if (FT.screens.checkLoss()) return; FT.screens.runEvent(); };
  }

  FT.register(mode);
})();
