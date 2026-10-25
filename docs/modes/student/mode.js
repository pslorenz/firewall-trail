/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Student mode: you're the new IT tech at a school district.
 * This file holds the mode's rules and wording. Events live in events.js and
 * minigame content in minigames.js, both in this folder. */
(function () {
  const S = FT.S, L = FT.learned, { clamp, pick, money } = FT.util, sys = FT.sys;

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
        patch: 40, backupAge: 6, backupTested: false, training: 20, mfa: false, inventory: 10,
        filter: null, irPlan: false, stale: 6, edr: null,
        mdr: null, mdrNoisy: false, mdrRamp: false,
        mdrMonth: 5 + Math.floor(FT.util.rand() * 3),
        finaleMonth: 9 + Math.floor(FT.util.rand() * 3),
        gang: { name: pick(["Night Ledger", "GreyTide", "LockBlossom", "Cold Harbor", "Static Choir"]), ransom: pick([60000, 80000, 95000, 120000]) },
        tipsDone: false
      };
      FT.years.applyConditions(state, FT.years.pickConditions(mode.conditions, 2));
      return state;
    },

    /* ---------- What you can do each month ----------
     * cost is charged by the engine; apply() changes the world. */
    actions: [
      { id: "patch", group: "upkeep", name: "Patch systems", desc: "Install updates on laptops, servers and the network gear.", slots: 1, cost: 0, apply: S => { S.patch = clamp(S.patch + 45); } },
      { id: "backup", group: "upkeep", name: "Test the backups", desc: "Actually try restoring files, not just check that backups ran.", slots: 1, cost: 0, apply: S => { S.backupAge = 0; S.backupTested = true; } },
      { id: "train", group: "upkeep", name: "Run staff phishing training", desc: "A short session on spotting suspicious emails.", slots: 1, cost: 500, apply: S => { S.training = clamp(S.training + 30); } },
      { id: "inventory", group: "upkeep", name: "Inventory devices", desc: "Find out what’s actually plugged into the network.", slots: 1, cost: 0, apply: S => { S.inventory = clamp(S.inventory + 50); } },
      { id: "cleanup", group: "upkeep", name: "Clean up old accounts", desc: "Shut off logins for staff who left or changed jobs.", slots: 1, cost: 0, apply: S => { S.stale = 0; } },
      { id: "tunefilter", group: "upkeep", name: "Tune the email filter", desc: "Adjust rules, block look-alike domains, turn on link scanning.", slots: 1, cost: 0, show: S => S.filter !== null && S.filter < 100, apply: S => { S.filter = clamp(S.filter + 25); } },
      { id: "tuneedr", group: "upkeep", name: "Tune endpoint protection", desc: "Set policies, add exclusions for school software, switch on blocking mode.", slots: 1, cost: 0, show: S => S.edr !== null && S.edr < 100, apply: S => { S.edr = clamp(S.edr + 25); } },
      { id: "tunemdr", group: "upkeep", name: "Tune MDR alerts yourself", desc: "Teach the service what normal looks like here. Self-tuning only goes so far.", slots: 1, cost: 0, show: S => S.mdr !== null && S.mdrNoisy && S.mdr < 60, apply: S => { S.mdr = Math.min(60, S.mdr + 12); if (S.mdr >= 55) S.mdrNoisy = false; } },
      { id: "rest", group: "upkeep", name: "Take a breather", desc: "Leave on time. Eat lunch away from your desk.", slots: 1, cost: 0, apply: S => { S.morale = clamp(S.morale + 20); } },
      { id: "mfa", group: "project", name: "Roll out multi-factor login", desc: "Staff need a code from their phone to sign in.", slots: 2, cost: 3000, show: S => !S.mfa, apply: S => { S.mfa = true; S.morale = clamp(S.morale - 5); } },
      { id: "buyfilter", group: "project", name: "Buy an email security filter", desc: "Scans incoming mail for phishing. Ships with default settings.", slots: 1, cost: 2500, show: S => S.filter === null, apply: S => { S.filter = 25; } },
      { id: "buyedr", group: "project", name: "Buy endpoint protection (EDR)", desc: "Watches every laptop and server for malware behavior. Ships in alert-only mode.", slots: 1, cost: 2000, show: S => S.edr === null, apply: S => { S.edr = 25; } },
      { id: "irplan", group: "project", name: "Write an incident response plan", desc: "Decide ahead of time who does what when something goes wrong.", slots: 1, cost: 0, show: S => !S.irPlan, apply: S => { S.irPlan = true; } }
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
      monthNotes: { 1: "New this month: <b>projects</b>. They cost more, but you only do them once. Look at the red items on the status board and pick what worries you most." }
    },

    /* ---------- Security status board ---------- */
    dashboard(S) {
      const lvl = (v, good, ok) => v >= good ? "good" : v >= ok ? "warn" : "bad";
      const rows = [];
      rows.push(["Patches", lvl(S.patch, 70, 40), S.patch >= 70 ? "Up to date" : S.patch >= 40 ? "Falling behind" : "Badly out of date"]);
      rows.push(["Backups", S.backupTested ? "good" : "bad", S.backupTested ? (S.backupAge === 0 ? "Tested this month" : `Tested ${S.backupAge} month${S.backupAge > 1 ? "s" : ""} ago`) : (S.backupAge >= 6 ? "Never tested" : "Not tested recently")]);
      rows.push(["Staff awareness", lvl(S.training, 60, 35), S.training >= 60 ? "Sharp" : S.training >= 35 ? "Fading" : "Low"]);
      rows.push(["Device inventory", lvl(S.inventory, 50, 25), S.inventory >= 50 ? "Mostly known" : S.inventory >= 25 ? "Getting stale" : "Mostly unknown"]);
      rows.push(["Old accounts", S.stale <= 2 ? "good" : S.stale <= 6 ? "warn" : "bad", S.stale === 0 ? "All cleaned up" : `${S.stale} still active`]);
      rows.push(["Multi-factor login", S.mfa ? "good" : "bad", S.mfa ? "On" : "Off"]);
      rows.push(["Email filter", S.filter === null ? "bad" : lvl(S.filter, 75, 50), S.filter === null ? "None" : S.filter >= 100 ? "Fully tuned" : S.filter >= 50 ? `Partly tuned (${S.filter}%)` : `Default settings (${S.filter}%)`]);
      rows.push(["Endpoint protection", S.edr === null ? "bad" : lvl(S.edr, 75, 50), S.edr === null ? "None" : S.edr >= 100 ? "Fully tuned" : S.edr >= 75 ? `Well tuned (${S.edr}%)` : S.edr >= 50 ? `Partly tuned (${S.edr}%)` : `Alert-only mode (${S.edr}%)`]);
      if (S.mdr !== null || S.month > S.mdrMonth) rows.push(["MDR monitoring", S.mdr === null ? "bad" : S.mdrNoisy ? "warn" : S.mdr >= 80 ? "good" : "warn", S.mdr === null ? "None" : S.mdrRamp ? "Being set up by vendor" : S.mdr >= 80 ? `Tuned by provider (${S.mdr}%)` : S.mdrNoisy ? `Default settings, noisy (${S.mdr}%)` : `Self-tuned (${S.mdr}%)`]);
      rows.push(["Incident plan", S.irPlan ? "good" : "bad", S.irPlan ? "Written" : "None"]);
      return rows;
    },
    explain: {
      "Patches": "Updates that fix known security holes. They fall behind every month as new bugs are found.",
      "Backups": "Copies of your data. They only count if you’ve recently proven you can restore from them.",
      "Staff awareness": "How good staff are at spotting scams. It fades without practice.",
      "Device inventory": "Knowing what’s connected to your network. New devices show up all the time.",
      "Old accounts": "Logins for people who left. Each one is an unwatched door.",
      "Multi-factor login": "A phone code on top of a password. Stolen passwords alone stop working.",
      "Email filter": "Blocks phishing before it reaches inboxes. Much better once it’s tuned.",
      "Endpoint protection": "Software on each computer that blocks malware behavior. Much better once it’s tuned.",
      "MDR monitoring": "A team watching your systems around the clock for attackers who got in.",
      "Incident plan": "Who does what when something goes wrong, decided ahead of time."
    },

    threatWarning(S) {
      if (!(S.month >= S.finaleMonth - 3 && S.month < S.finaleMonth)) return "";
      return `<div class="intel"><b>Threat warning from the state:</b> The ${S.gang.name} ransomware gang has hit ${5 - (S.finaleMonth - S.month)} school districts in your region this year. They look for the easiest way in.</div>`;
    },

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
    vectors: S => [
      { name: "a phishing email", p: 1 - (1 - sys.eff(S.filter)) * (1 - S.training / 100 * .8),
        hold: (S.filter !== null ? "The email filter caught most copies," : "It reached 40 inboxes,") + " and the staff who saw it reported it.",
        fail: "A secretary opened a convincing “bus schedule update” and entered her password on a fake page." },
      { name: "an unpatched VPN server", p: S.patch / 100,
        hold: "The VPN bug they wanted was already patched.",
        fail: "They used a known bug in the district’s VPN. The fix had been available for months." },
      { name: "a stolen password", p: S.mfa ? .95 : .15,
        hold: "They had a teacher’s password, but multi-factor login asked for a code they didn’t have.",
        fail: "They bought a teacher’s stolen password online and logged straight in. No second code was required." },
      { name: "an old account", p: S.stale <= 2 ? .95 : .3,
        hold: "They hunted for forgotten accounts, but you’d cleaned them up.",
        fail: `They guessed the password on one of ${S.stale} forgotten accounts from staff who had left.` }
    ],
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
      restored: S => ({ text: `By morning, every server and most staff computers were locked, with a ransom note demanding ${money(S.gang.ransom)}. But your backups were recent and tested. You declined to pay, wiped everything, and restored. School reopened after three days.`, fx: { trust: -12, morale: -15 }, lesson: ["Backups", "A backup only counts if you’ve proven you can restore from it. Tested backups turn ransomware from a catastrophe into a terrible week."] }),
      body: S => `<p>Every server and most staff computers are locked. Grades, attendance, payroll and the phone system are down. A note from ${S.gang.name} demands <b>${money(S.gang.ransom)}</b>.</p>
        <p>${S.backupTested ? "Your backups haven’t been tested in months." : "You go to restore from backup."} Half the backup files are empty, and the rest are encrypted too.</p>
        <p><b>The board asks what to do.</b> Your insurance would cover part of the ransom, but the district would still owe $5,000.</p>`,
      payLabel: "Pay the ransom", rebuildLabel: "Refuse and rebuild",
      paid: works => ({ text: works ? "You paid. The decryption tool was slow and buggy, and it recovered about 70% of the data. Two months later, the same gang came back." : "You paid. The decryption tool crashed on the biggest servers. The gang stopped answering messages.", fx: { trust: works ? -42 : -55, morale: -20, budget: -5000 }, lesson: backupsLesson }),
      rebuilt: { text: "You refused. Rebuilding everything by hand took five weeks. Teachers recreated gradebooks from paper. The story ran on the evening news.", fx: { trust: -60, morale: -25 }, lesson: backupsLesson }
    },
    lessons: {
      weakest: ["Weakest link", "Attackers look for your easiest way in, not your strongest defense. Being decent at everything beats being great at one thing."],
      assume: ["Assume breach", "Plan as if attackers will eventually get in. Prevention buys time and makes noise; detection, response and backups decide how bad it gets."],
      luck: ["Luck", "Sometimes things just break your way. It’s real, but it isn’t a plan. Good defenses mean you need less of it."],
      ransom: ["Paying the ransom", "Paying doesn’t guarantee you get your data back, it funds criminals, and it marks you as someone who pays. Good backups are what let you refuse."]
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
