/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Student mode: you're the new IT tech at a school district.
 * This file holds the mode's rules and wording. Events live in events.js and
 * minigame content in minigames.js, both in this folder. */
(function () {
  const S = FT.S, L = FT.learned, { clamp, pick, money, chance } = FT.util, sys = FT.sys;

  const mode = {
    id: "student",
    name: "Student mode",
    blurb: "You’re the new IT tech at a school district. Learn the basics, one month at a time.",
    months: ["Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug"],
    landmarks: ["First day of school","Parent portal launch","Report card week","Winter concert","Snow days","Science fair","State testing","Spring audit","Prom season","Graduation","Summer refresh","Back-to-school prep"],
    slots: 3,
    meters: [
      { key: "trust", label: "District trust", short: "Trust" },
      { key: "morale", label: "Your energy", short: "Energy" }
    ],
    advisor: { name: "Ms. Reyes" },
    startLabel: "Start the school year",
    againLabel: "Play another year",
    winTitle: "You made it to August",
    intro: `
      <p>You’re the new IT tech at <b>Maple Valley School District</b>. Your job: get the district from September to August without a disaster.</p>
      <p>Each month you get <b>3 work slots</b> to spend on security tasks. Then something happens. Your past choices decide how bad it gets.</p>
      <p>Keep <b>district trust</b> and <b>your energy</b> above zero. Ms. Reyes, the district’s network admin, will explain what went right or wrong along the way.</p>
      <p class="hint">Rumor has it a ransomware gang is targeting school districts this year.</p>`,

    codeLetter: "S",
    // Bump when a change makes an existing year code play out differently
    rulesVersion: 2,
    codePrefix: () => "S",
    loadCode: prefix => prefix === "S",

    /* ---------- Yearly conditions: two per year ---------- */
    conditions: [
      { id: "cut", name: "Budget cut", good: false, excludes: ["grant"], desc: "The district trimmed IT’s budget. You start with less and get less each month.", apply: S => { S.budget = 6000; S.monthlyAdd = 400; } },
      { id: "grant", name: "Technology grant", good: true, excludes: ["cut"], desc: "A state grant already paid for an email filter. It’s on default settings, so it still needs tuning.", apply: S => { S.filter = 25; } },
      { id: "wave", name: "Ransomware wave", good: false, desc: "Ransomware is surging in schools. The big attack will come earlier than usual.", apply: (S, gen) => { S.finaleMonth = 8 + Math.floor(gen() * 2); } },
      { id: "support", name: "A supportive superintendent", good: true, desc: "The new superintendent backs IT. You start with more trust.", apply: S => { S.trust = 80; } },
      { id: "phishseason", name: "Phishing season", good: false, desc: "Scammers are targeting schools hard. Staff awareness fades faster.", apply: S => { S.trainingDecay = 8; } },
      { id: "calm", name: "A calm year", good: true, desc: "Fewer fires to fight. Your energy drains more slowly.", apply: S => { S.moraleDecay = 5; } }
    ],

    /* ---------- Achievements ---------- */
    achievements: [
      { id: "st-survive", name: "Made it to August", desc: "Finish a year in student mode.", test: (S, c) => !c.lossMsg },
      { id: "st-a", name: "Honor roll", desc: "Earn an A in student mode.", test: (S, c) => c.grade === "A" },
      { id: "st-clean", name: "Never encrypted", desc: "Stop ransomware night before the encryption starts.", test: S => ["edr", "luckyedr", "mdr", "self"].includes(S.finaleResult) },
      { id: "st-eagle", name: "Eagle eye", desc: "Get every answer right in a minigame round.", test: S => (S.mgPerfect || 0) > 0 },
      { id: "st-hard-year", name: "Rough draw, good grade", desc: "Earn a B or better in a year with two bad conditions.", test: (S, c) => !c.lossMsg && ["A", "B"].includes(c.grade) && (S.conditions || []).filter(x => !x.good).length === 2 }
    ],

    newState() {
      const state = {
        budget: 8000, morale: 80, trust: 70,
        patch: 40, backupAge: 6, backupTested: false, immutable: false, training: 20, mfa: false, mfaGaps: 0, passkeys: false, inventory: 10,
        lingering: [], cleanupReport: null,
        filter: null, irPlan: false, stale: 6, edr: null,
        mdr: null, mdrNoisy: false, mdrRamp: false,
        mdrMonth: 5 + Math.floor(FT.util.rand() * 3),
        finaleMonth: 9 + Math.floor(FT.util.rand() * 3),
        // About one gang in four is on a sanctions list; its own stream, so nothing else shifts
        gang: { name: pick(["Night Ledger", "GreyTide", "LockBlossom", "Cold Harbor", "Static Choir"]), ransom: pick([60000, 80000, 95000, 120000]), sanctioned: FT.rng.fork("sanctions")() < .25 },
        tipsDone: false
      };
      FT.years.applyConditions(state, FT.years.pickConditions(mode.conditions, 2));
      return state;
    },

    /* ---------- What you can do each month ----------
     * cost is charged by the engine; apply() changes the world. */
    actions: [
      { id: "patch", group: "upkeep", improves: ["Patches"], name: "Patch systems", desc: "Install updates on laptops, servers and the network gear.", slots: 1, cost: 0, apply: S => { S.patch = clamp(S.patch + 45); } },
      { id: "backup", group: "upkeep", improves: ["Backups"], name: "Test the backups", desc: "Actually try restoring files, not just check that backups ran.", slots: 1, cost: 0, apply: S => { S.backupAge = 0; S.backupTested = true; } },
      { id: "train", group: "upkeep", improves: ["Staff awareness"], name: "Run staff phishing training", desc: "A short session on spotting suspicious emails.", slots: 1, cost: 500, apply: S => { S.training = clamp(S.training + 30); } },
      { id: "inventory", group: "upkeep", improves: ["Device inventory"], name: "Inventory devices", desc: "Find out what’s actually plugged into the network.", slots: 1, cost: 0, apply: S => { S.inventory = clamp(S.inventory + 50); } },
      { id: "cleanup", group: "upkeep", improves: ["Old accounts"], name: "Clean up old accounts", desc: "Shut off logins for staff who left or changed jobs.", slots: 1, cost: 0, apply: S => { S.stale = 0; } },
      { id: "tunefilter", group: "upkeep", improves: ["Email filter"], name: "Tune the email filter", desc: "Adjust rules, block look-alike domains, turn on link scanning.", slots: 1, cost: 0, show: S => S.filter !== null && S.filter < 100, apply: S => { S.filter = clamp(S.filter + 25); } },
      { id: "tuneedr", group: "upkeep", improves: ["Endpoint protection"], name: "Tune endpoint protection", desc: "Set policies, add exclusions for school software, switch on blocking mode.", slots: 1, cost: 0, show: S => S.edr !== null && S.edr < 100, apply: S => { S.edr = clamp(S.edr + 25); } },
      { id: "tunemdr", group: "upkeep", improves: ["MDR monitoring"], name: "Tune MDR alerts yourself", desc: "Teach the service what normal looks like here. Self-tuning only goes so far.", slots: 1, cost: 0, show: S => S.mdr !== null && S.mdrNoisy && S.mdr < 60, apply: S => { S.mdr = Math.min(60, S.mdr + 12); if (S.mdr >= 55) S.mdrNoisy = false; } },
      { id: "mfagaps", group: "upkeep", improves: ["Multi-factor login"], name: "Set up MFA for new staff", desc: "New hires and substitutes don’t set up multi-factor login on their own. Walk them through it.", slots: 1, cost: 0, show: S => S.mfa && S.mfaGaps > 0, apply: S => { S.mfaGaps = 0; } },
      { id: "leftover", group: "upkeep", improves: ["Incident cleanup"], name: "Check for leftover access", desc: "After an incident, look for anything the attacker left behind: mail-forwarding rules, new accounts, remote-access tools.", slots: 1, cost: 0, show: S => S.lingering.length > 0, apply: S => {
        const found = S.lingering.filter(x => x.real);
        S.cleanupReport = { month: S.month, found: found.map(x => x.what), incidents: [...new Set(S.lingering.map(x => x.month))] };
        S.lingering = [];
        L.set(...mode.cleanupLesson);
      } },
      { id: "rest", group: "upkeep", name: "Take a breather", desc: "Leave on time. Eat lunch away from your desk.", slots: 1, cost: 0, apply: S => { S.morale = clamp(S.morale + 20); } },
      { id: "mfa", group: "project", improves: ["Multi-factor login"], name: "Roll out multi-factor login", desc: "Staff need a code from their phone to sign in.", slots: 2, cost: 3000, show: S => !S.mfa, apply: S => { S.mfa = true; S.morale = clamp(S.morale - 5); } },
      { id: "passkeys", group: "project", improves: ["Multi-factor login"], name: "Switch staff to passkeys", desc: "A sign-in that only works on the real website, so a fake login page gets nothing it can use.", slots: 1, cost: 2000, show: S => S.mfa && !S.passkeys, apply: S => { S.passkeys = true; } },
      { id: "offline", group: "project", improves: ["Backups"], name: "Keep an offline copy of the backups", desc: "A copy attackers can’t reach or delete: unplugged, or locked so even an admin can’t erase it early.", slots: 1, cost: 1500, show: S => !S.immutable, apply: S => { S.immutable = true; } },
      { id: "buyfilter", group: "project", improves: ["Email filter"], name: "Buy an email security filter", desc: "Scans incoming mail for phishing. Ships with default settings.", slots: 1, cost: 2500, show: S => S.filter === null, apply: S => { S.filter = 25; } },
      { id: "buyedr", group: "project", improves: ["Endpoint protection"], name: "Buy endpoint protection (EDR)", desc: "Watches every laptop and server for malware behavior. Ships in alert-only mode.", slots: 1, cost: 2000, show: S => S.edr === null, apply: S => { S.edr = 25; } },
      { id: "mdrbuy", group: "project", improves: ["MDR monitoring"], name: "Sign up for MDR after all", desc: "The grant is gone, so it costs more now, but the vendor still sets it up and tunes it for you.", slots: 1, cost: 4000, show: S => S.mdr === null && S.month > S.mdrMonth, apply: S => { S.mdr = 40; S.mdrRamp = true; S.mdrNoisy = false; } },
      { id: "irplan", group: "project", improves: ["Incident plan"], name: "Write an incident response plan", desc: "Decide ahead of time who does what when something goes wrong.", slots: 1, cost: 0, show: S => !S.irPlan, apply: S => { S.irPlan = true; } }
    ],

    /* ---------- The gentle first month ---------- */
    tutorial: {
      tips: [
        "Welcome to Maple Valley! I’m Ms. Reyes. This board is your <b>security status</b>. Red means weak, yellow means slipping, green means solid. Lots of red is normal here: the district hasn’t had an IT tech in a while.",
        "Each month you get <b>3 work slots</b>. Upkeep tasks like patching wear off over time, so you’ll come back to them. Bigger one-time projects unlock next month.",
        "My suggestion for month one: <b>patch systems</b> and <b>test the backups</b>. Those two prevent the most common disasters. Your third slot is up to you."
      ],
      firstMonthActions: ["patch", "backup", "train", "rest"],
      suggested: ["patch", "backup"],
      monthNotes: {
        1: "New this month: <b>projects</b>. They cost more, but you only do them once. Look at the red items on the status board and pick what worries you most.",
        2: "Stuck on a red row? Open <b>What do these mean?</b> under the status board. Every row lists the tasks that fix it.",
        3: "Backups need <b>two</b> things. A recent restore test proves they work. An <b>offline copy</b> means attackers can’t delete them, and ransomware gangs go after backups first.",
        4: "Training helps a lot, but it never gets clicks to zero. Some people will always fall for a really good fake. That’s why the email filter and multi-factor login matter too.",
        5: "Multi-factor login isn’t one-and-done. New staff and substitutes join all year, and they don’t set it up on their own. Keep an eye on that row.",
        6: "After any incident, <b>check for leftover access</b>. Attackers often set up a way back in, and changing the password doesn’t remove it.",
        7: "Most ransomware gangs now copy data before they lock anything. Backups get your systems back, but they can’t un-steal student records. Being honest with families fast is part of the response."
      }
    },

    /* ---------- Security status board ---------- */
    dashboard(S) {
      const lvl = (v, good, ok) => v >= good ? "good" : v >= ok ? "warn" : "bad";
      const rows = [];
      rows.push(["Patches", lvl(S.patch, 70, 40), S.patch >= 70 ? "Up to date" : S.patch >= 40 ? "Falling behind" : "Badly out of date"]);
      const tested = S.backupTested ? (S.backupAge === 0 ? "Tested this month" : `Tested ${S.backupAge} month${S.backupAge > 1 ? "s" : ""} ago`) : (S.backupAge >= 6 ? "Never tested" : "Not tested recently");
      rows.push(["Backups", S.backupTested && S.immutable ? "good" : S.backupTested || S.immutable ? "warn" : "bad", `${tested}, ${S.immutable ? "offline copy" : "no offline copy"}`]);
      rows.push(["Staff awareness", lvl(S.training, 60, 35), S.training >= 60 ? "Sharp" : S.training >= 35 ? "Fading" : "Low"]);
      rows.push(["Device inventory", lvl(S.inventory, 50, 25), S.inventory >= 50 ? "Mostly known" : S.inventory >= 25 ? "Getting stale" : "Mostly unknown"]);
      rows.push(["Old accounts", S.stale <= 2 ? "good" : S.stale <= 6 ? "warn" : "bad", S.stale === 0 ? "All cleaned up" : `${S.stale} still active`]);
      rows.push(["Multi-factor login", !S.mfa ? "bad" : S.mfaGaps ? "warn" : "good", !S.mfa ? "Off" : S.mfaGaps ? `On, but ${S.mfaGaps} new staff not set up` : S.passkeys ? "On, with passkeys" : "On for everyone"]);
      rows.push(["Email filter", S.filter === null ? "bad" : lvl(S.filter, 75, 50), S.filter === null ? "None" : S.filter >= 100 ? "Fully tuned" : S.filter >= 50 ? `Partly tuned (${S.filter}%)` : `Default settings (${S.filter}%)`]);
      rows.push(["Endpoint protection", S.edr === null ? "bad" : lvl(S.edr, 75, 50), S.edr === null ? "None" : S.edr >= 100 ? "Fully tuned" : S.edr >= 75 ? `Well tuned (${S.edr}%)` : S.edr >= 50 ? `Partly tuned (${S.edr}%)` : `Alert-only mode (${S.edr}%)`]);
      if (S.mdr !== null || S.month > S.mdrMonth) rows.push(["MDR monitoring", S.mdr === null ? "bad" : S.mdrNoisy ? "warn" : S.mdr >= 80 ? "good" : "warn", S.mdr === null ? "None" : S.mdrRamp ? "Being set up by vendor" : S.mdr >= 80 ? `Tuned by provider (${S.mdr}%)` : S.mdrNoisy ? `Default settings, noisy (${S.mdr}%)` : `Self-tuned (${S.mdr}%)`]);
      rows.push(["Incident plan", S.irPlan ? "good" : "bad", S.irPlan ? "Written" : "None"]);
      if (S.lingering.length) rows.push(["Incident cleanup", "bad", `Not checked after ${[...new Set(S.lingering.map(x => x.month))].join(" and ")}`]);
      return rows;
    },
    explain: {
      "Patches": "Updates that fix known security holes. They fall behind every month as new bugs are found.",
      "Backups": "Copies of your data. A recent restore test proves they work, and counts for about two months. An offline copy keeps attackers from deleting them.",
      "Staff awareness": "How good staff are at spotting scams. It fades without practice.",
      "Device inventory": "Knowing what’s connected to your network. New devices show up all the time.",
      "Old accounts": "Logins for people who left. Each one is an unwatched door.",
      "Multi-factor login": "A phone code on top of a password. Stolen passwords alone stop working. New staff need to be set up as they join. Passkeys go further: fake login pages can’t use them.",
      "Incident cleanup": "After an incident, checking for anything the attacker left behind. A password change alone doesn’t remove it.",
      "Email filter": "Blocks phishing before it reaches inboxes. Much better once it’s tuned.",
      "Endpoint protection": "Software on each computer that blocks malware behavior. Much better once it’s tuned.",
      "MDR monitoring": "A team watching your systems around the clock for attackers who got in.",
      "Incident plan": "Who does what when something goes wrong, decided ahead of time."
    },

    threatWarning(S) {
      let out = "";
      const r = S.cleanupReport;
      if (r && r.month === S.month - 1) out += `<div class="notice"><b>Leftover access check:</b> ${r.found.length
        ? `you found ${r.found.join(" and ")}, and removed ${r.found.length > 1 ? "them" : "it"}. Changing the password alone would have left ${r.found.length > 1 ? "those" : "that"} in place.`
        : `nothing left behind after the ${r.incidents.join(" and ")} incident. All clear, and now you know for sure.`}</div>`;
      if (!(S.month >= S.finaleMonth - 3 && S.month < S.finaleMonth)) return out;
      return out + `<div class="intel"><b>Threat warning from the state:</b> The ${S.gang.name} ransomware gang has hit ${5 - (S.finaleMonth - S.month)} school districts in your region this year. They look for the easiest way in.${S.gang.sanctioned ? ` They’re also on the US Treasury’s <b>sanctions list</b>, so paying them a ransom could be illegal. If they hit you, paying won’t be an option.` : ""}</div>`;
    },

    // "Improve it with" on the status board: the tasks that help each row
    improveHints() {
      const hints = {};
      for (const a of mode.actions) if ((!a.show || a.show(S)) && a.improves) for (const label of a.improves) (hints[label] = hints[label] || []).push(a.name);
      return hints;
    },

    /* ---------- Multi-factor gaps and leftover access ---------- */
    // Is the account an attacker targets covered? New staff who never set it up aren't.
    mfaCovers() { return S.mfa && !(S.mfaGaps && chance(Math.min(.5, S.mfaGaps * .07))); },
    // An incident may leave something behind. Not always, which is why you check.
    foothold(what, r) {
      S.lingering.push({ what, month: mode.months[S.month], real: chance(.7) });
      r.text += " You locked the account, but nobody checked whether they’d left anything behind.";
      return r;
    },
    cleanupLesson: ["Incident cleanup", "After an incident, attackers often leave a way back in: a mail-forwarding rule, a new account, a remote-access tool. Changing the password doesn’t remove those. Looking for them does."],
    gapLesson: ["Multi-factor gaps", "Multi-factor login only protects accounts that have it. New staff join all year, so someone has to set them up as they arrive."],

    // An incident response plan softens serious hits.
    adjustOutcome(S, r) {
      if (S.irPlan && r.fx.trust <= -8) {
        r.fx.trust = Math.round(r.fx.trust * .6);
        r.noteLabel = "Plan in action";
        r.note = "Because you had an incident response plan, everyone knew their role: who to call, what to shut off, what to tell parents. That cut the damage.";
        L.set("Incident response plan", "A plan written before an emergency, so people act fast and calmly instead of improvising.");
      }
    },

    // Things decay every month: this is where delayed consequences come from.
    monthEnd(S) {
      S.patch = clamp(S.patch - 15);
      S.backupAge++; if (S.backupAge > 2) S.backupTested = false;
      S.training = clamp(S.training - (S.trainingDecay || 5));
      S.inventory = clamp(S.inventory - 5);
      if (S.mdrRamp && S.month >= S.mdrMonth) { S.mdr = 85; S.mdrRamp = false; }
      if (S.mdrNoisy) S.morale = clamp(S.morale - 4);
      S.stale = Math.min(12, S.stale + 2);
      if (S.mfa) S.mfaGaps = Math.min(8, S.mfaGaps + 1); // new staff and substitutes join every month
      S.morale = clamp(S.morale - (S.moraleDecay || 8));
      S.budget += S.monthlyAdd || 600;
    },

    lossCheck(S) {
      if (S.trust <= 0 && S.finale) return "Your district has died of ransomware.";
      if (S.trust <= 0) return "The school board voted to outsource IT. You have been replaced by a vendor.";
      if (S.morale <= 0) return "You have died of burnout.";
      return null;
    },

    grade(S, lossMsg) {
      const fr = S.finaleResult ? mode.finale.results[S.finaleResult] : null;
      const score = S.trust * .6 + S.morale * .25 + (fr ? fr.bonus : 0);
      const grade = lossMsg ? "F" : score >= 68 ? "A" : score >= 55 ? "B" : score >= 42 ? "C" : "D";
      const notes = { A: "The board wants to clone you.", B: "A solid year. A few bruises, no disasters.", C: "You survived. Next year, plan further ahead.", D: "Rough year. The trail was hard on you.", F: "The trail ends here." };
      return {
        grade, note: notes[grade],
        details: `<p class="hint">Final trust ${S.trust}, energy ${S.morale}, budget ${money(S.budget)}</p>` +
          (fr ? `<p class="hint">Ransomware night: <b>${fr.label}</b>${fr.bonus ? ` (+${fr.bonus} to your grade)` : ""}</p>` : "")
      };
    }
  };

  /* ---------- Scheduled moments ---------- */
  mode.scheduled = [
    { when: S => S.month === S.mdrMonth, run: () => mdrOffer() },
    { when: S => S.month === S.finaleMonth, run: () => FT.finale.run(mode.finale) },
    { when: S => S.month === 0, run: () => FT.screens.choiceEvent(FT.screens.eventById("firstweek")) }
  ];

  function mdrOffer() {
    const extra = 2500, canPro = S.budget >= extra, title = "A state cybersecurity grant";
    FT.ui.screen(`<div class="panel"><h2>${title}</h2>
      <p>The state is offering districts $3,000 toward a <b>managed detection and response (MDR)</b> service: a team that watches your systems around the clock and responds when something gets past your defenses.</p>
      <p>The catch: use it by the end of the month or lose it. The vendor also offers a professional services package where their engineers set it up and tune it for your district.</p>
      <div class="opts">
        <button class="opt choice" data-c="pro" ${canPro ? "" : "disabled"}><div><b>Take the grant, add professional setup</b><small>Their team tunes it to your district. Ramps up to about 85% effective next month, with few false alarms.${canPro ? "" : " You can’t afford this right now."}</small></div><span class="cost">$${extra.toLocaleString()}</span></button>
        <button class="opt choice" data-c="self"><div><b>Take the grant, set it up yourself</b><small>Free beyond the grant. Default settings, about 35% effective, and a lot of noisy alerts landing on you.</small></div><span class="cost">$0</span></button>
        <button class="opt choice" data-c="no"><div><b>Pass on it</b><small>Nothing changes. One less thing to manage.</small></div><span class="cost">$0</span></button>
      </div></div>`, "button[data-c]:not(:disabled)");
    FT.app.querySelectorAll("button[data-c]").forEach(b => b.onclick = () => {
      const c = b.dataset.c; let r; FT.note(title, `Chose: ${b.querySelector("b").textContent}.`);
      if (c === "pro") {
        S.budget -= extra; S.mdr = 40; S.mdrRamp = true; S.mdrNoisy = false;
        r = { text: "The vendor’s engineers spent two weeks learning your network: which servers matter, what normal traffic looks like, who logs in when. It’ll be fully tuned by next month.", fx: { morale: -3 }, lesson: ["Professional services", "Paying experts to set up a tool properly often matters as much as the tool itself."] };
      } else if (c === "self") {
        S.mdr = 35; S.mdrNoisy = true;
        r = { text: "You installed the agents yourself over a weekend. It works, sort of. Your inbox now gets about 60 alerts a day, and most of them are the gym’s scoreboard doing something odd.", fx: { morale: -5 }, lesson: ["Alert fatigue", "A badly tuned tool buries real warnings under false alarms, and the people watching start ignoring them. You can tune it yourself over time, but only so far."] };
      } else {
        r = { text: "You let the grant go. The superintendent asked why. You said you were stretched thin, which was true.", fx: {}, lesson: ["Opportunity cost", "Every choice has a price, including saying no. Sometimes stretched-thin teams pass on things that would have helped them."] };
      }
      L.set(...sys.notes.mdr);
      FT.screens.outcome(title, r);
    });
  }

  /* ---------- Ransomware night ---------- */
  const backupsLesson = ["Backups", "A backup only counts if you’ve proven you can restore from it. Without one, every option is bad."];
  const detectionLesson = "Prevention eventually fails somewhere. Catching attackers quickly once they’re inside is what keeps a breach from becoming a disaster.";
  mode.finale = {
    title: "The ransomware gang",
    times: ["11:48 PM", "12:06 AM", "12:22 AM", "12:41 AM", "1:03 AM"],
    intro: S => `Late on a Thursday, the ${S.gang.name} ransomware gang, which has been hitting school districts all year, turns its attention to Maple Valley. They start with your weakest spot and keep going until something works.`,
    vectors: S => (S.lingering.some(x => x.real) && L.set(...mode.cleanupLesson), [
      // Access left over from an earlier incident nobody cleaned up: no need to break in
      ...S.lingering.filter(x => x.real).map(x => ({ name: `the way back in from ${x.month}`, p: .1,
        hold: "It had stopped working. A routine change had cleared it without anyone noticing.",
        fail: `They didn’t need to break in. ${x.what[0].toUpperCase() + x.what.slice(1)}, left over from the ${x.month} incident, still worked. Nobody had checked.` })),
      // Multi-factor login helps against phishing, but a fake page can pass a phone code straight through; passkeys can't be passed on
      (() => {
        const base = 1 - (1 - sys.eff(S.filter)) * (1 - sys.awareness(S));
        const p = !S.mfa ? base : 1 - (1 - base) * (S.passkeys ? .15 : .7);
        return { name: "a phishing email", p,
          hold: S.passkeys ? "A teacher typed her password into the fake page, but her passkey only works on the real site, so they got nothing." : (S.filter !== null ? "The email filter caught most copies," : "It reached 40 inboxes,") + " and the staff who saw it reported it.",
          fail: "A secretary opened a convincing “bus schedule update” and entered her password on a fake page." +
            (S.mfa && !S.passkeys ? " Then she typed in the code from her phone too. The fake page passed it to the real site within seconds, and they were in." : "") };
      })(),
      { name: "an unpatched VPN server", p: S.patch / 100,
        hold: "The VPN bug they wanted was already patched.",
        fail: "They used a known bug in the district’s VPN. The fix had been available for months." },
      { name: "a stolen password", p: !S.mfa ? .15 : S.mfaGaps ? Math.max(.5, .95 - S.mfaGaps * .07) : .95,
        hold: "They had a teacher’s password, but multi-factor login asked for a code they didn’t have.",
        fail: S.mfa ? "They bought the stolen password of a substitute teacher who started this year and never set up multi-factor login. Nothing asked for a code." : "They bought a teacher’s stolen password online and logged straight in. No second code was required." },
      { name: "an old account", p: S.stale <= 2 ? .95 : .3,
        hold: "They hunted for forgotten accounts, but you’d cleaned them up.",
        fail: `They guessed the password on one of ${S.stale} forgotten accounts from staff who had left.` }
    ]),
    zeroDay: { label: "They buy a zero-day.", fail: "With every door locked, they paid another criminal $40,000 for a brand-new bug in the district’s remote-access software. No patch exists yet. They’re in." },
    luckyBlock: "It should have worked, but their tool timed out halfway through. <i>Lucky break.</i>",
    firstTry: "They got in on the first try. Nobody will notice anything unusual in the logs.",
    beachhead: {
      clock: "1:20 AM", title: "The first computer",
      pre: "Next they try to install their tools on that first computer, so they can take control of it.",
      blockedLabel: "Blocked on the first computer", failedLabel: "They take control",
      blocked: "Endpoint protection flagged the tools the moment they ran and quarantined them. The attackers lost their foothold.",
      lucky: S => (S.edr === null ? "There’s no endpoint protection, but their malware crashed on an outdated driver before it finished installing." : "Endpoint protection only half-recognized it, but the malware crashed on an outdated driver before it finished installing.") + " The foothold is gone.",
      failed: S => S.edr === null ? "Nothing on the computer is watching for that kind of behavior." : S.edr < 75 ? "Endpoint protection was still mostly in alert-only mode. It logged a warning and let the tools run." : "Endpoint protection caught one of their tools, but they disguised the next one well enough to slip by.",
      outcomes: {
        edr: { text: "They got a foot in the door, but couldn’t take control of a single computer. By morning they’d moved on. You found the evidence in the logs over coffee.", fx: { trust: 6 }, lesson: ["Defense in depth", "When one layer fails, the next one can still stop the attack. That’s why you don’t rely on a single tool."] },
        luckyedr: { text: "They got a foot in the door and then tripped over their own malware. You found the crash logs in the morning and realized how close it was.", fx: { trust: 2, morale: -3 }, lesson: ["Defense in depth", "When one layer fails, the next one can still stop the attack. That’s why you don’t rely on a single tool."] }
      }
    },
    spread: {
      clock: "2:13 AM", title: "Moving through the network",
      pre: "Over the next hour they quietly move from computer to computer, looking for servers and backups.",
      mdr: "Your MDR provider connected the dots: failed logins earlier in the night, then an account touching twelve servers it had never used. An analyst called your cell, and together you cut those machines off before the encryption started.",
      self: "Your phone had been buzzing with failed-login alerts all night. You couldn’t sleep, logged in to check, and saw a teacher’s account copying files at 2 a.m. You pulled the network cable on the main server room.",
      mdrMissed: "Your MDR service generated an alert, but it was buried among dozens of false alarms.",
      nobody: "There’s no one monitoring the network overnight. At 2:58 a.m., the encryption begins.",
      outcomes: {
        mdr: { text: "They got in, but they never got to encrypt anything. A few computers needed rebuilding, and you lost a night of sleep.", fx: { trust: -2, morale: -6 }, lesson: ["Detection and response", detectionLesson] },
        self: { text: "Some files were stolen, but nothing was encrypted. You spent the weekend rebuilding three servers and writing a very long report.", fx: { trust: -5, morale: -12 }, lesson: ["Detection and response", "Prevention eventually fails somewhere. Failed attempts leave clues, and someone watching for them can stop a breach from becoming a disaster."] }
      }
    },
    encrypt: {
      clock: "7:05 AM", title: "The ransom note",
      // Tested AND offline: restored. Tested only: they may find and delete the backups first.
      // Offline only: they survive, but nobody has practiced restoring, so it's slow.
      backupState: S => {
        const tested = S.backupTested && S.backupAge <= 2;
        if (tested && S.immutable) return "restored";
        if (tested) return chance(.6) ? "wiped" : "survived";
        return S.immutable ? "slow" : "none";
      },
      restored: (S, survived) => ({ text: `By morning, every server and most staff computers were locked, with a ransom note demanding ${money(S.gang.ransom)}. ${survived ? "They went looking for your backup server, but ran out of time before they found it. Your backups could have been deleted; this time they weren’t." : "But your backups were recent, tested, and had an offline copy they couldn’t touch."} You declined to pay, wiped everything, and restored. School reopened after three days.`, fx: { trust: -12, morale: -15 }, lesson: ["Backups", "A backup only counts if you’ve proven you can restore from it, and if attackers can’t delete it first. Tested, offline backups turn ransomware from a catastrophe into a terrible week."] }),
      restoredSlow: S => ({ text: `By morning, every server and most staff computers were locked, with a ransom note demanding ${money(S.gang.ransom)}. Your offline copy survived, because they couldn’t reach it. But nobody had practiced restoring from it: the first tries failed on missing passwords and forgotten steps. School reopened after nine days instead of three.`, fx: { trust: -18, morale: -20 }, lesson: ["Testing backups", "An untested backup is a guess. Practicing the restore is how you find the missing steps before the day you need them."] }),
      body: (S, state) => `<p>Every server and most staff computers are locked. Grades, attendance, payroll and the phone system are down. A note from ${S.gang.name} demands <b>${money(S.gang.ransom)}</b>.</p>
        <p>${state === "wiped" ? "Your restore test last month proved the backups worked. It couldn’t prove they’d survive: the backups were online, and the gang found the backup server and deleted everything before they started encrypting." : "You go to restore from backup. Half the backup files are empty, and the rest are encrypted too."}</p>
        <p><b>The board asks what to do.</b> Your insurance would cover part of the ransom, but the district would still owe $5,000.</p>`,
      sanctioned: S => `Before anyone could call the gang, the district’s lawyer checked: ${S.gang.name} is on the US Treasury’s sanctions list. Paying them could be illegal, and insurance won’t cover it. Paying is off the table.`,
      rebuildOnlyLabel: "Rebuild from scratch",
      rebuiltNoChoice: { text: "Rebuilding everything by hand took five weeks. Teachers recreated gradebooks from paper. The story ran on the evening news.", fx: { trust: -60, morale: -25 }, lesson: backupsLesson },
      payLabel: "Pay the ransom", rebuildLabel: "Refuse and rebuild",
      paid: works => ({ text: works ? "You paid. The decryption tool was slow and buggy, and it recovered about 70% of the data. Two months later, the same gang came back." : "You paid. The decryption tool crashed on the biggest servers. The gang stopped answering messages.", fx: { trust: works ? -42 : -55, morale: -20, budget: -5000 }, lesson: backupsLesson }),
      rebuilt: { text: "You refused. Rebuilding everything by hand took five weeks. Teachers recreated gradebooks from paper. The story ran on the evening news.", fx: { trust: -60, morale: -25 }, lesson: backupsLesson }
    },
    lessons: {
      weakest: ["Weakest link", "Attackers look for your easiest way in, not your strongest defense. Being decent at everything beats being great at one thing."],
      assume: ["Assume breach", "Plan as if attackers will eventually get in. Prevention buys time and makes noise; detection, response and backups decide how bad it gets."],
      luck: ["Luck", "Sometimes things just break your way. It’s real, but it isn’t a plan. Good defenses mean you need less of it."],
      ransom: ["Paying the ransom", "Paying doesn’t guarantee you get your data back, it funds criminals, and it marks you as someone who pays. Good backups are what let you refuse."],
      sanctions: ["Sanctioned gangs", "Some ransomware gangs are on government sanctions lists. Paying them can be illegal, and insurance won’t cover it. That’s one more reason not to count on paying."]
    },
    /* Most gangs copy data before encrypting. When they got that far, the night
     * ends with a choice about what to tell families. */
    leak: {
      clock: "Two days later", title: "The leak site",
      when: (S, key) => ["self", "backups", "paid", "rebuilt"].includes(key),
      intro: (S, key) => `<p>The ${S.gang.name} gang posted a sample of Maple Valley student records on its leak site: names, birthdays and some special-education files. They copied them before they ${key === "self" ? "were stopped" : "encrypted anything"}.${key === "backups" ? " Your backups got the systems back, but they can’t un-steal the data." : ""}</p>
        ${FT.ui.advisor(`<p><b>Ms. Reyes:</b> This is the part most people forget. Ransomware gangs steal data first, so they can threaten to publish it even if you restore.</p>`)}`,
      options: S => [{ id: "now", label: "Tell families now" }, { id: "wait", label: "Wait until you know exactly what was taken" }].concat(S.gang.sanctioned ? [] : [{ id: "pay", label: "Pay them to delete it" }]),
      choose: (S, id) => {
        const disclosure = ["Breach disclosure", "When data is stolen, telling people quickly and honestly protects trust, and many places require it by law. Silence usually makes it worse."];
        if (id === "now") return { text: "You and the superintendent told families that day: what happened, what might have been taken, and what the district was doing. It was a hard week, but nobody heard it from the gang first.", fx: { trust: -4 }, lesson: disclosure };
        if (id === "wait") return chance(.5)
          ? { text: "Forensics finished in ten days, and you told families with real answers. Careful, and this time it worked out.", fx: { trust: -3 }, lesson: disclosure }
          : { text: "The gang published the records while you were still waiting. Parents found out from a news story before they heard from the district.", fx: { trust: -14, morale: -5 }, lesson: disclosure };
        const paid = ["Paying for deletion", "Criminals can’t prove they deleted anything. Paying doesn’t remove the duty to tell families, and the data often shows up anyway."];
        return chance(.5)
          ? { text: "You paid. The gang took the post down and sent a “proof of deletion.” There’s no way to know what that’s worth, and you still had to tell families.", fx: { trust: -6, budget: -5000 }, lesson: paid }
          : { text: "You paid, and the records showed up for sale on another site a month later anyway. You still had to tell families.", fx: { trust: -14, budget: -5000 }, lesson: paid };
      }
    },
    // How ransomware night ended, and what it adds to the grade
    results: {
      edr: { label: "Stopped on the first computer", bonus: 15 },
      luckyedr: { label: "Lucky break on the first computer", bonus: 8 },
      mdr: { label: "Caught by MDR before encryption", bonus: 13 },
      self: { label: "You caught them yourself", bonus: 10 },
      backups: { label: "Encrypted, restored from backups", bonus: 5 },
      paid: { label: "Paid the ransom", bonus: 0 },
      rebuilt: { label: "Rebuilt from scratch", bonus: 0 }
    }
  };

  FT.register(mode);
})();
