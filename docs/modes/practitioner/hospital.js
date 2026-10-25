/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Practitioner setting: a mid-size regional hospital.
 * The core tension is security versus patient care: downtime is dangerous,
 * some medical devices can't be patched, and every fix can break something
 * a clinician depends on. */
(function () {
  const S = FT.S, L = FT.learned, { chance, clamp, money } = FT.util, sys = FT.sys;
  const mode = FT.modes.practitioner, team = mode.team;
  const ORG = "Riverside Regional Medical Center";

  const hospital = {
    id: "hospital", letter: "H",
    name: "Mid-size hospital",
    short: "Hospital",
    summary: "A 320-bed regional hospital. Security versus patient care: downtime is dangerous, and some medical devices can’t be patched.",
    meters: [
      { key: "trust", label: "Leadership trust", short: "Trust" },
      { key: "care", label: "Patient care", short: "Care" },
      { key: "morale", label: "Team morale", short: "Morale", value: () => team.morale() }
    ],
    briefing: "<b>Your new job:</b> security lead at Riverside Regional Medical Center, 320 beds and 2,400 staff. The fiscal year runs July to June.",
    irNote: "The incident plan meant nobody improvised: the right people were called, clinical leaders were looped in early, and communications were ready. That cut the damage.",
    chief: "Dana Whitfield, CIO",
    months: ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun"],
    landmarks: ["New residents arrive","EHR upgrade weekend","Flu season prep","Open enrollment","Holiday staffing","Budget planning","Winter surge","Joint Commission visit","HIPAA risk assessment","Spring construction","Nurses Week","Fiscal year close"],
    winTitle: "You made it to fiscal year close",
    startBudget: 80000,
    monthlyBudget: 8000,
    intro: `
      <p>You lead security at <b>${ORG}</b>: 320 beds, 2,400 staff, one electronic health record system everyone depends on, and a team of three, including you.</p>
      <p>Each month you assign work to your team. Specialists are faster at their own work, projects take months, and everyone has a burnout level. Push too hard and people quit.</p>
      <p>Keep <b>leadership trust</b>, <b>patient care</b> and your <b>team</b> intact until the fiscal year closes. Some security fixes disrupt care, and some risks can’t be patched away.</p>
      <p class="hint">Health-ISAC has been warning that ransomware gangs are targeting hospitals this year.</p>`,
    orientation: "Welcome aboard. You’ve inherited a lot: no multi-factor login, a flat network where medical devices sit next to everything else, and backups nobody has tested in months. Priya is our detection analyst and Marcus runs infrastructure. Assign their work below, and watch their burnout. I can’t afford to lose either of them.",

    newState() {
      return {
        clinPatch: 30, labTested: false, segmented: false, badge: false,
        team: [
          { id: "you", name: "You", role: "Security lead", skill: "lead", cap: 2, burnout: 25 },
          { id: "priya", name: "Priya", role: "Analyst", skill: "detect", cap: 2, burnout: 20 },
          { id: "marcus", name: "Marcus", role: "Engineer", skill: "infra", cap: 2, burnout: 30 }
        ]
      };
    },
    replacement(p) {
      const names = p.skill === "detect" ? ["Jordan", "Aisha", "Tomás"] : ["Kenji", "Rosa", "Devon"];
      return { name: names[Math.floor(FT.util.rand() * names.length)], burnout: 10, newHire: 2, away: 0 };
    },

    /* ---------- Hospital-specific tasks ---------- */
    actions: [
      { id: "labtest", kind: "upkeep", skill: "infra", order: 1, name: "Test clinical patches in the lab", desc: "Try this month’s clinical patches on test systems first.",
        apply: S => { S.labTested = true; return "Tested clinical patches in the lab. Two needed workarounds."; } },
      { id: "patchclin", kind: "upkeep", skill: "infra", name: "Patch clinical systems", desc: "EHR, imaging, lab and pharmacy systems. Untested patches can break things.",
        apply: (S, k) => {
          S.clinPatch = clamp(S.clinPatch + Math.round(40 * k));
          const risk = S.labTested ? .05 : .3;
          if (chance(risk)) return { bad: true, text: S.labTested ? "Patched clinical systems, but the lab pharmacy interface still broke for six hours. Testing reduces risk; it doesn’t remove it." : "Patched clinical systems without testing. The imaging viewer broke, and radiologists read scans on backup workstations for most of a day.", fx: { care: -6, trust: -3 } };
          return S.labTested ? "Rolled out clinical patches that were tested first. No surprises." : "Patched clinical systems without testing. Nothing broke this time.";
        } },
      { id: "segment", kind: "project", skill: "infra", cost: 35000, work: 4, name: "Segment medical devices", desc: "Move pumps, monitors and imaging onto their own protected network.",
        done: S => { S.segmented = true; return "Medical devices are on their own network, walled off from everything else."; } },
      { id: "clinic", kind: "project", skill: "infra", cost: 20000, work: 4, name: "Bring Lakeview Clinic up to standard", desc: "Rebuild the clinic’s network, accounts and remote access to match the hospital’s.", show: S => S.expanded,
        done: S => { S.stale = Math.max(0, S.stale - 4); return "Lakeview Clinic is fully integrated: new network, cleaned-up accounts, no more contractor back doors."; } },
      { id: "badge", kind: "project", skill: "infra", cost: 25000, work: 3, name: "Tap-badge login for shared workstations", desc: "Fast individual logins so clinicians stop sharing accounts.",
        done: S => { S.badge = true; return "Tap-badge login is live. Shared clinical logins are retired."; } }
    ],

    monthEnd(S) {
      const d = n => Math.round(n * S.diff.decay); // difficulty scales decay
      S.patch = clamp(S.patch - d(15));
      S.clinPatch = clamp(S.clinPatch - d(10));
      S.labTested = false;
      S.backupAge++; if (S.backupAge > 2) S.backupTested = false;
      S.training = clamp(S.training - d(5));
      S.detect = clamp(S.detect - d(5));
      S.inventory = clamp(S.inventory - d(5));
      S.vendor = clamp(S.vendor - d(5));
      S.stale = Math.min(20, S.stale + d(2));
    },

    /* ---------- The guided first month ---------- */
    tutorial: {
      tips: [
        { target: "dash", text: "Welcome aboard. This is the security status board. Red is a gap, yellow is slipping, green is solid. You’ve inherited a lot of red: no multi-factor login, medical devices on the same flat network as everything else, and backups nobody has restore-tested in months. Open “What do these mean?” any time." },
        { target: "team", text: "This is your team. Each person gets two tasks a month. A ★ marks their specialty, where they work about 40% faster: Priya is detection, Marcus is infrastructure, and you’re leadership. You can do anything at normal speed; they’re slower outside their specialty." },
        { target: "team", text: "Watch the burnout number next to each name. It creeps up every month, and overtime or a bad incident pushes it up fast. Past 65 they work slower, past 80 their work starts slipping, and past about 85 they may resign, and hiring a replacement takes two months. <b>Time off</b> is in everyone’s task list. Leaving a task unassigned also helps a little." },
        { target: "budget", text: "Projects like multi-factor login or segmenting the medical devices take several person-months, so they can take a few months to finish, and they only pay off once they’re done. You pay for a project when you start it. Your committed spending is shown here." },
        { target: "team", text: "Clinical patching is the tricky one. Patching untested can break something nurses and doctors depend on. Having Marcus test in the lab first takes one of his tasks but nearly removes the risk. My suggestion for this month: Marcus tests and patches clinical systems, Priya tunes detection rules and hunts, and you start multi-factor login and run phishing training." }
      ],
      suggested: { you: ["mfa", "train"], priya: ["tunedetect", "hunt"], marcus: ["labtest", "patchclin"] },
      report: "This is the change report: what each person did, and anything that broke. Red lines are changes that went wrong. Check it every month, because a broken change can hurt patient care as badly as an attack.",
      monthNotes: {
        1: "Quick reminder: look at the burnout numbers before you assign anything, and give time off before someone hits the red. A rested team is a faster team.",
        2: "If a project is in progress, keep someone on it. Half-finished projects protect nothing."
      }
    },

    /* ---------- Status board ---------- */
    dashboard(S) {
      const lvl = (v, g, o) => v >= g ? "good" : v >= o ? "warn" : "bad";
      const pct = (v, words) => `${v >= 70 ? words[0] : v >= 40 ? words[1] : words[2]}`;
      const rows = [
        ["IT patches", lvl(S.patch, 70, 40), pct(S.patch, ["Current", "Falling behind", "Badly behind"])],
        ["Clinical patches", lvl(S.clinPatch, 70, 40), pct(S.clinPatch, ["Current", "Falling behind", "Badly behind"])],
        ["Medical devices", S.segmented ? "good" : "bad", S.segmented ? "Segmented" : "On the flat network"],
        ["EHR backups", S.backupTested ? "good" : "bad", S.backupTested ? (S.backupAge === 0 ? "Restore tested this month" : `Restore tested ${S.backupAge} month${S.backupAge > 1 ? "s" : ""} ago`) : "Restore not tested recently"],
        ["Staff awareness", lvl(S.training, 60, 35), pct(S.training, ["Sharp", "Fading", "Low"])],
        ["Detection rules", lvl(S.detect, 70, 40), S.detect >= 70 ? "Sharp" : S.detect >= 40 ? "Drifting" : "Noisy and blind"],
        ["Endpoint protection", lvl(S.edr, 75, 50), S.edr >= 100 ? "Fully tuned" : S.edr >= 75 ? `Well tuned (${S.edr}%)` : S.edr >= 50 ? `Partly tuned (${S.edr}%)` : `Mostly alert-only (${S.edr}%)`],
        ["Email filter", lvl(S.filter, 75, 50), S.filter >= 75 ? `Well tuned (${S.filter}%)` : `Partly tuned (${S.filter}%)`],
        ["Multi-factor login", S.mfa ? "good" : "bad", S.mfa ? "On for everyone" : "Off"],
        ["Old accounts", S.stale <= 3 ? "good" : S.stale <= 9 ? "warn" : "bad", S.stale === 0 ? "All cleaned up" : `${S.stale} still active`],
        ["Vendor access", lvl(S.vendor, 60, 30), S.vendor >= 60 ? "Reviewed" : S.vendor >= 30 ? "Partly reviewed" : "Unknown"],
        ["Shared logins", S.badge ? "good" : "warn", S.badge ? "Retired" : "Still in use"],
        ["Incident plan", S.irPlan ? "good" : "bad", S.irPlan ? "Written and tested" : "None"]
      ];
      if (S.expanded) rows.push(["Lakeview Clinic", S.done.clinic ? "good" : "bad", S.done.clinic ? "Integrated securely" : "Connected, not yet secured"]);
      if (S.mdr !== null || S.month > S.mdrMonth) rows.push(["MDR service", S.mdr === null ? "bad" : S.mdrNoisy ? "warn" : S.mdr >= 80 ? "good" : "warn", S.mdr === null ? "None" : S.mdrRamp ? "Onboarding" : S.mdr >= 80 ? `Tuned by provider (${S.mdr}%)` : S.mdrNoisy ? `Self-onboarded, noisy (${S.mdr}%)` : `Self-tuned (${S.mdr}%)`]);
      return rows;
    },
    explain: {
      "IT patches": "Servers, laptops, the VPN and network gear. Attackers love unpatched edge devices.",
      "Clinical patches": "EHR, imaging, lab and pharmacy systems. Patching them untested can disrupt care.",
      "Medical devices": "Pumps, monitors and imaging often can’t be patched. Segmentation keeps attackers from reaching them.",
      "EHR backups": "Only proven by an actual restore test. They decide whether ransomware is a bad week or a catastrophe.",
      "Staff awareness": "How well staff spot phishing and social engineering. It fades without practice.",
      "Detection rules": "Whether your alerts catch real attacker behavior. Rules drift as systems change.",
      "Endpoint protection": "Software on each machine that blocks malicious behavior once it’s tuned and in blocking mode.",
      "Email filter": "Stops phishing before it reaches inboxes.",
      "Multi-factor login": "Stops stolen passwords from being enough on their own.",
      "Old accounts": "Accounts of people who left. Hospitals have a lot of turnover.",
      "Vendor access": "Device and software vendors often have standing remote access. Every one is a door.",
      "Shared logins": "Shared clinical accounts make it impossible to tell who did what.",
      "Incident plan": "Who does what during an incident, rehearsed with clinical leadership.",
      "MDR service": "An outside team watching your systems around the clock.",
      "Lakeview Clinic": "The newly acquired clinic: its own old network, accounts and contractor access, now connected to yours."
    },

    threatWarning(S) {
      if (!(S.month >= S.finaleMonth - 3 && S.month < S.finaleMonth)) return "";
      return `<div class="intel"><b>Health-ISAC alert:</b> The ${S.gang.name} ransomware gang has hit ${5 - (S.finaleMonth - S.month)} hospitals in your region this year. They go after the weakest way in, then disable backups before encrypting.</div>`;
    },

    deaths: {
      ransomware: "Your hospital has died of ransomware.",
      care: "Patient care collapsed. The state has opened an investigation.",
      trust: "The board brought in an outside firm. Your contract was not renewed."
    },

    /* ---------- Mid-year budget offer: MDR ---------- */
    mdrOffer() {
      const pro = 30000, canPro = S.budget >= pro, title = "Year-end budget surplus";
      FT.ui.screen(`<div class="panel"><h2>${title}</h2>
        <p>Finance found surplus in the capital budget, and Dana can steer some of it to security if you move this month: a year of <b>managed detection and response (MDR)</b>, with analysts watching your systems around the clock.</p>
        <p>The vendor offers onboarding services from your own budget, where their engineers tune it to the hospital. Or your team can onboard it.</p>
        <div class="opts">
          <button class="opt choice" data-c="pro" ${canPro ? "" : "disabled"}><div><b>Take it, with vendor onboarding</b><small>Tuned to your clinical systems. About 85% effective from next month.${canPro ? "" : " Your budget can’t cover this right now."}</small></div><span class="cost">${money(pro)}</span></button>
          <button class="opt choice" data-c="self"><div><b>Take it, onboard it yourselves</b><small>Free, but default settings, about 35% effective, and a flood of alerts landing on Priya every month until it’s tuned.</small></div><span class="cost">$0</span></button>
          <button class="opt choice" data-c="no"><div><b>Pass</b><small>One less thing for a stretched team.</small></div><span class="cost">$0</span></button>
        </div></div>`, "button[data-c]:not(:disabled)");
      FT.app.querySelectorAll("button[data-c]").forEach(b => b.onclick = () => {
        const c = b.dataset.c; let r; FT.note(title, `Chose: ${b.querySelector("b").textContent}.`);
        if (c === "pro") { S.budget -= pro; S.mdr = 40; S.mdrRamp = true; S.mdrNoisy = false;
          r = { text: "The vendor’s engineers spent two weeks with Priya learning what normal looks like here: which systems talk to the EHR, which vendor connections are expected, when the night shift logs in.", fx: { morale: -2 }, lesson: ["Professional services", "Paying experts to set up a tool properly often matters as much as the tool itself."] }; }
        else if (c === "self") { S.mdr = 35; S.mdrNoisy = true;
          r = { text: "Marcus and Priya deployed it over a weekend. It works, sort of. Priya now gets about 90 alerts a day, most of them the infusion pumps’ normal chatter.", fx: { morale: -5 }, lesson: ["Alert fatigue", "A badly tuned tool buries real warnings under false alarms. The people watching it burn out, and eventually stop looking."] }; }
        else r = { text: "You passed. Dana understood, but she’ll remember it at the next budget meeting.", fx: { trust: -2 }, lesson: ["Opportunity cost", "Every choice has a price, including saying no."] };
        L.set(...sys.notes.mdr);
        FT.screens.outcome(title, r);
      });
    }
  };

  /* ---------- Unplanned work specific to a hospital ---------- */
  hospital.interrupts = [
    { skill: "lead", text: "The accreditation prep team needs security policies reviewed this week.", done: "Reviewed security policies for accreditation prep." },
    { skill: "infra", text: "Biomed needs firewall rules for new patient monitors, today.", done: "Set up firewall rules for new patient monitors." },
    { skill: "detect", text: "A patient asked who looked at her chart; the privacy office needs an access report.", done: "Built a chart-access report for the privacy office." }
  ];

  /* ---------- Mid-year expansion: an acquisition ---------- */
  const integration = ["Mergers and acquisitions", "When you buy an organization, you buy its security debt too. Connecting first and securing later is common, and risky."];
  hospital.expansion = {
    id: "acquisition", title: "Riverside buys a clinic",
    intro: "The board has bought Lakeview Outpatient Clinic: 40 staff, a different EHR, its own small network, and an IT contractor who set it all up in 2016. The CEO wants it connected to the hospital network next week.",
    choices: [
      { label: "Hold it for a security review ($20,000)", run() {
        S.budget -= Math.min(20000, Math.max(0, S.budget)); S.proj.clinic = 1; S.stale += 4; S.inventory = clamp(S.inventory - 10);
        return { text: "You held the connection for three weeks while you reviewed the clinic and started fixing it. The CEO was impatient, but the integration project is already under way. ($20,000 from your budget.)", fx: { trust: -4 }, lesson: integration };
      } },
      { label: "Connect it now, secure it later", run() {
        S.stale += 8; S.inventory = clamp(S.inventory - 20); S.vendor = clamp(S.vendor - 15);
        return { text: "Lakeview joined the network the next week, and the doctors were happy. On day two, you found the contractor’s remote-access tool and 8 accounts nobody could explain. Securing it is now a project on your list.", fx: { trust: 2 }, lesson: integration };
      } }
    ]
  };

  /* ---------- Events ---------- */
  const lessons = {
    phishing: ["Payroll diversion", "Attackers phish staff, then quietly change direct-deposit details. Multi-factor login and a verification step for payroll changes stop it."],
    legacy: ["Legacy medical devices", "Many devices run old, unpatchable operating systems for years. You protect them with network isolation, not updates."],
    disclosure: ["Breach notification", "Under HIPAA, breaches of patient data must be reported to affected patients without unreasonable delay, and within 60 days at most. Waiting for perfect information usually makes it worse."],
    baa: ["Business associate agreements", "Any vendor handling patient data needs a signed agreement covering how they protect it. Convenient tools without one are a breach waiting to happen."],
    vendor: ["Vendor remote access", "Always-on vendor access is one of the most common ways into hospitals. Access should be on-demand, logged and reviewed."],
    snooping: ["Insider access monitoring", "Curious staff looking at records they don’t need is a real and common breach. Logging and alerting on unusual record access catches it."]
  };

  hospital.events = [
    { id: "payroll", title: "A nurse’s paycheck never arrives", run() {
      const f = sys.filterCatch();
      if (f.caught) return { text: "A wave of fake “benefits enrollment” emails hit the hospital. The email filter caught nearly all of them before anyone saw one.", fx: { trust: 3 }, lesson: ["Email filtering", "A tuned filter stops many phishing campaigns before people ever get the chance to click."] };
      if (!chance((100 - S.training) / 100 * .8)) return { text: "A fake “benefits enrollment” email reached staff." + (f.note || "") + " Nurses on 4 West reported it within minutes, and Priya blocked the sender.", fx: { trust: 3 }, lesson: ["Phishing", "Staff who report quickly turn a phishing campaign into a non-event."] };
      if (S.mfa) return { text: "A nurse entered her password on a fake benefits page. The attacker tried to log in and change her direct deposit, but multi-factor login stopped them.", fx: { trust: -1 }, lesson: lessons.phishing };
      return { text: "A nurse entered her password on a fake benefits page. Two weeks later her paycheck went to someone else’s account, and so did three colleagues’.", fx: { trust: -10, morale: -4, budget: -6000 }, lesson: lessons.phishing };
    } },
    { id: "ehrpatch", title: "Emergency EHR patch", intro: "The EHR vendor released an emergency fix for a flaw attackers are already using. Installing it means taking the EHR down for two hours, and the next scheduled maintenance window is two weeks away.", choices: [
      { label: "Patch tonight, 2 to 4 a.m.", run() { S.clinPatch = clamp(S.clinPatch + 25); team.burn("marcus", 10);
        return { text: "Clinical units switched to downtime procedures for two hours overnight. A few delayed med-pass scans, no harm done, and the hole is closed.", fx: { care: -3, trust: 3 }, lesson: ["Emergency change windows", "When a flaw is being actively exploited, a short planned outage is usually safer than two weeks of exposure."] }; } },
      { label: "Wait for the scheduled window", run() {
        if (chance(.4)) return { text: "Attackers used the flaw nine days later to pull data from the EHR’s web portal before the patch went in.", fx: { trust: -12, care: -4 }, lesson: ["Emergency change windows", "When a flaw is being actively exploited, a short planned outage is usually safer than two weeks of exposure."] };
        return { text: "You got lucky: no one targeted the hospital before the scheduled window.", fx: {}, lesson: ["Emergency change windows", "Waiting on an actively exploited flaw is a gamble, even when it pays off."] }; } }
    ] },
    { id: "pumps", title: "An infusion pump advisory", run() {
      if (S.segmented) return { text: "CISA published a remote-access flaw in your infusion pumps. Because the pumps sit on their own segmented network, you could wait for the vendor’s fix without pulling them from service.", fx: { trust: 5 }, lesson: lessons.legacy };
      if (chance(.4)) return { text: "CISA published a remote-access flaw in your infusion pumps, and a scan from an infected workstation found them. Biomed pulled 60 pumps from service for a week while the vendor rushed a fix.", fx: { care: -12, trust: -6, morale: -4 }, lesson: lessons.legacy };
      return { text: "CISA published a remote-access flaw in your infusion pumps. Nothing hit them, but they sit on the same network as everything else, and the vendor’s fix is months away.", fx: { morale: -3 }, lesson: lessons.legacy };
    } },
    { id: "mri", title: "The Windows 7 MRI console", intro: "During a threat hunt, Priya found the MRI console still running Windows 7. The vendor says upgrading it would void its certification, and the hospital can’t afford a new scanner this year.", choices: [
      { label: "Isolate it this weekend", run() { team.burn("marcus", 12); S.inventory = clamp(S.inventory + 10);
        return { text: "Marcus spent a weekend moving the console onto its own locked-down network segment, with only the vendor’s service connection allowed in.", fx: { trust: 2 }, lesson: lessons.legacy }; } },
      { label: "Leave it; the vendor says it’s fine", run() {
        if (chance(.45)) return { text: "A worm spreading through the network found the console and crashed it. MRI was down for four days while the vendor rebuilt it.", fx: { care: -10, trust: -6 }, lesson: lessons.legacy };
        return { text: "Nothing happened this month. The console is still sitting on the main network, though.", fx: {}, lesson: lessons.legacy }; } }
    ] },
    { id: "gmail", title: "Patient records in a personal inbox", intro: "A resident emailed 40 patients’ records to his personal Gmail so he could finish notes at home. He meant well.", choices: [
      { label: "Report it to the privacy officer", run() { return { text: "The privacy officer assessed it, the resident deleted the copies and signed an attestation, and the hospital documented a low-risk incident. Done properly.", fx: { trust: 2, morale: -2 }, lesson: lessons.disclosure }; } },
      { label: "Quietly have him delete it", run() {
        if (chance(.5)) return { text: "It surfaced in an audit three months later. Now it’s an unreported breach and a cover-up, not a mistake.", fx: { trust: -15 }, lesson: lessons.disclosure };
        return { text: "He deleted it. Nobody found out, but you know it wasn’t handled properly.", fx: { morale: -3 }, lesson: lessons.disclosure }; } }
    ] },
    { id: "shared", title: "Who changed that order?", run() {
      if (S.badge) return { text: "A medication order was changed in error. Because every clinician now logs in with their own badge, it took ten minutes to find out who did it and why.", fx: { trust: 4, care: 2 }, lesson: ["Individual accountability", "Individual logins that are fast enough for clinicians to actually use make every action traceable."] };
      return { text: "A medication order was changed in error, under the emergency department’s shared login. Nobody can tell who did it. The patient safety review is not going well.", fx: { trust: -7, care: -3 }, lesson: ["Individual accountability", "Shared accounts make it impossible to know who did what. Fast individual logins, like tap-badges, fix it without slowing clinicians down."] };
    } },
    { id: "billing", title: "The billing vendor was breached", lessonPre: ["Third-party risk", "Your patients’ data lives with vendors too. Their breach is your notification problem."], intro: "Your outsourced billing company says attackers stole files that include about 9,000 of your patients’ names and insurance details. Their forensics will take weeks.", choices: [
      { label: "Start notification planning now", run() { return { text: "Legal, the privacy officer and communications drafted notices with what you knew, and updated them as the vendor learned more. Patients were upset, but heard it from you first.", fx: { trust: -5, morale: -3 }, lesson: lessons.disclosure }; } },
      { label: "Wait for the vendor’s full report", run() { return { text: "The vendor’s report took nine weeks. A reporter got the story first, and the state attorney general asked why patients weren’t told.", fx: { trust: -18 }, lesson: lessons.disclosure }; } }
    ] },
    { id: "laptop", title: "A resident’s laptop is stolen", run() {
      if (S.inventory >= 50) return { text: "A resident’s laptop was stolen from his car. It was on the managed device list with full-disk encryption, so you confirmed the data was unreadable and wiped it remotely.", fx: { trust: 2 }, lesson: ["Encryption and device management", "An encrypted, managed laptop is a lost device. An unencrypted one is a reportable breach."] };
      return { text: "A resident’s laptop was stolen from his car. It wasn’t encrypted, and it held exported patient lists. That’s a reportable breach.", fx: { trust: -12, morale: -3 }, lesson: ["Encryption and device management", "An encrypted, managed laptop is a lost device. An unencrypted one is a reportable breach."] };
    } },
    { id: "helpdesk", title: "“I’m in surgery, reset my MFA”", run() {
      if (S.irPlan || S.training >= 60) return { text: "A caller claiming to be Dr. Hale demanded an urgent login reset “between cases.” The help desk followed the callback procedure. The real Dr. Hale was on vacation.", fx: { trust: 3 }, lesson: ["Help desk social engineering", "Attackers impersonate busy doctors to pressure the help desk. A callback rule that applies to everyone stops it."] };
      return { text: "A caller claiming to be Dr. Hale pressured the help desk into resetting his login. The attacker spent a day reading his email and searching for patients before Priya spotted it.", fx: { trust: -10, morale: -4 }, lesson: ["Help desk social engineering", "Attackers impersonate busy doctors to pressure the help desk. A callback rule that applies to everyone stops it."] };
    } },
    { id: "vendorra", title: "An always-on vendor connection", run() {
      if (S.vendor >= 60) return { text: "A lab equipment vendor’s remote-access account was stolen. Because your review had switched vendor access to on-demand, the stolen login had nothing to connect to.", fx: { trust: 4 }, lesson: lessons.vendor };
      if (sys.edrCatch()) { L.set(...sys.notes.edr); return { text: "Attackers used a lab vendor’s always-on remote-access tool to get in. Endpoint protection blocked their next step, but it was close.", fx: { trust: -3 }, lesson: lessons.vendor }; }
      return { text: "Attackers used a lab vendor’s always-on remote-access tool to reach the lab system. Results were delayed for a day while you cleaned up.", fx: { trust: -10, care: -6 }, lesson: lessons.vendor };
    } },
    { id: "aiscribe", title: "The AI scribe nobody approved", intro: "Cardiology started using a free AI transcription app that records patient visits and writes notes. The doctors love it. There’s no business associate agreement, and nobody knows where the audio goes.", choices: [
      { label: "Shut it down today", run() { return { text: "You shut it down. Cardiology is furious and has escalated to the chief medical officer.", fx: { trust: -3, morale: -2 }, lesson: lessons.baa }; } },
      { label: "Pause it and fast-track a review", run() { team.burn("you", 10);
        return { text: "You paused it for two weeks, reviewed the vendor, got a business associate agreement signed and switched on data retention limits. Cardiology got their tool back, properly.", fx: { trust: 5 }, lesson: lessons.baa }; } }
    ] },
    { id: "recruiter", title: "Priya gets an offer", run: null },
    { id: "generator", title: "The generator test goes wrong", run() {
      if (sys.backupsGood()) return { text: "During a generator test, a power transfer fault took down a storage array. Your recently tested restore process had the EHR back within four hours.", fx: { care: -3 }, lesson: ["Availability", "In a hospital, keeping systems running is a safety issue. Proven backups and restore procedures are what make outages short."] };
      return { text: "During a generator test, a power transfer fault took down a storage array. The backups hadn’t been restore-tested, and two were corrupt. The EHR was down for most of a day.", fx: { care: -10, trust: -6 }, lesson: ["Availability", "In a hospital, keeping systems running is a safety issue. Proven backups and restore procedures are what make outages short."] };
    } },
    { id: "snooping", title: "A celebrity in the emergency department", run() {
      if (S.detect >= 50) return { text: "A local news anchor was treated in the ED. Within an hour, a detection rule flagged six staff members outside her care team opening her chart. The privacy officer handled it before anything leaked.", fx: { trust: 4 }, lesson: lessons.snooping };
      return { text: "A local news anchor was treated in the ED. Details of her visit appeared online two days later. An audit found 23 staff had opened her chart without a reason.", fx: { trust: -12 }, lesson: lessons.snooping };
    } },
    { id: "vpnzero", title: "A VPN zero-day", intro: "Your VPN vendor disclosed a flaw that attackers are already exploiting. Patching requires a reboot that drops every remote clinician and the telehealth service.", choices: [
      { label: "Patch tonight", run() { S.patch = clamp(S.patch + 30); team.burn("marcus", 10);
        return { text: "Marcus patched at 11 p.m. Telehealth was down for 40 minutes. Closed.", fx: { care: -2, trust: 3 }, lesson: ["Edge devices", "VPNs and firewalls face the internet directly. When their flaws are exploited, hours matter."] }; } },
      { label: "Patch at the weekend", run() {
        if (chance(.5)) return { text: "Attackers got in through the VPN two nights later. Priya caught them dumping account lists, and you spent the weekend resetting passwords anyway.", fx: { trust: -12, morale: -6 }, lesson: ["Edge devices", "VPNs and firewalls face the internet directly. When their flaws are exploited, hours matter."] };
        return { text: "Nobody hit you before the weekend. You patched with no fuss.", fx: {}, lesson: ["Edge devices", "VPNs and firewalls face the internet directly. Waiting on an exploited flaw is a gamble."] }; } }
    ] },
    { id: "survey", title: "The surveyors ask about security", run() {
      const good = (S.irPlan ? 1 : 0) + (S.backupTested ? 1 : 0) + (S.mfa ? 1 : 0);
      if (good >= 2) return { text: "The accreditation surveyors asked how you’d keep caring for patients during a cyberattack. You walked them through the tested incident plan and your last restore test. They moved on, satisfied.", fx: { trust: 6 }, lesson: ["Proving your controls", "Auditors want evidence, not intentions: a tested plan and a recent restore test say more than any policy."] };
      return { text: "The accreditation surveyors asked how you’d keep caring for patients during a cyberattack. You didn’t have a good answer, and it ended up in their findings.", fx: { trust: -8 }, lesson: ["Proving your controls", "Auditors want evidence, not intentions: a tested plan and a recent restore test say more than any policy."] };
    } },
    { id: "mfafatigue", title: "A 2 a.m. login approval", run() {
      if (!S.mfa) return { text: "An attacker with a stolen password logged in as an anesthesiologist and searched patient records for two days before anyone noticed.", fx: { trust: -10 }, lesson: ["Multi-factor login", "Without it, a stolen password is all an attacker needs."] };
      if (S.detect >= 50) return { text: "An attacker sent an anesthesiologist 30 login approval requests at 2 a.m. until he tapped “approve” to make it stop. Priya’s impossible-travel rule caught the login minutes later.", fx: { trust: 2 }, lesson: ["MFA fatigue", "Attackers spam approval requests until someone gives in. Number matching and good detection rules close the gap."] };
      return { text: "An attacker sent an anesthesiologist 30 login approval requests at 2 a.m. until he tapped “approve” to make it stop. They read his email for a week.", fx: { trust: -8 }, lesson: ["MFA fatigue", "Attackers spam approval requests until someone gives in. Number matching and good detection rules close the gap."] };
    } },
    { id: "lakeview", title: "Lakeview’s old server", available: S => S.expanded && !S.done.clinic, run() {
      if (sys.edrCatch()) { L.set(...sys.notes.edr); return { text: "Malware from a phishing email at Lakeview Clinic tried to spread onto the hospital network. Endpoint protection caught it at the boundary, but the clinic’s own machines needed cleaning.", fx: { morale: -3 }, lesson: integration }; }
      return { text: "Malware from a phishing email at Lakeview Clinic spread across the clinic’s old network and onto two hospital file servers. Lakeview closed for two days.", fx: { trust: -8, care: -5, morale: -3 }, lesson: integration };
    } },
    { id: "quiet", title: "A quiet month", run() { return { text: "No incidents, no outages, no angry calls from the chief medical officer. Your team almost got to finish their own work.", fx: { morale: 6 }, lesson: ["Invisible wins", "When security works, nothing happens, which makes it hard to notice. That’s normal."] }; } }
  ];

  // The recruiter event depends on whether Priya is still around.
  const recruiter = hospital.events.find(e => e.id === "recruiter");
  recruiter.run = undefined;
  Object.assign(recruiter, {
    available: S => { const p = team.member("priya"); return p && !p.away && !p.newHire && p.name === "Priya"; },
    intro: "A security vendor offered Priya a job: 30% more pay, fully remote, no 2 a.m. pages. She told you before deciding.",
    choices: [
      { label: "Fight for a retention raise", run() {
        if (S.budget < 15000) { leave(); return { text: "You couldn’t find the money in your budget. Priya took the job.", fx: { morale: -8 }, lesson: ["Retention", "Replacing a skilled analyst costs far more than keeping one, and takes months."] }; }
        S.budget -= 15000; team.burn("priya", -20);
        return { text: "You spent $15,000 of your budget on a retention raise and promised her a more sustainable on-call rotation. She stayed.", fx: { trust: -1 }, lesson: ["Retention", "Replacing a skilled analyst costs far more than keeping one, and takes months."] }; } },
      { label: "Wish her well", run() { leave(); return { text: "Priya took the job. The team threw her a goodbye lunch, then went back to splitting her work.", fx: { morale: -8 }, lesson: ["Retention", "Replacing a skilled analyst costs far more than keeping one, and takes months."] }; } }
    ]
  });
  function leave() {
    const p = team.member("priya");
    if (p && !p.away) Object.assign(p, { away: 3, awayNote: "Position open", replacement: hospital.replacement(p) });
  }

  /* ---------- Alert triage ---------- */
  const ALERTS = [
    { title: "Impossible travel", source: "Identity provider", time: "07:21", answer: "real",
      log: "user        lin.j (hospitalist)\n07:02  sign-in  Columbus, OH   hospital network\n07:21  sign-in  Bucharest, RO  residential ISP\nMFA         push approved 07:21\nuser agent  python-requests/2.31",
      why: "Two countries in 19 minutes, a residential address, and a script instead of a browser. The approved push means MFA fatigue. Revoke sessions and reset the account." },
    { title: "Impossible travel", source: "Identity provider", time: "09:25", answer: "fp",
      log: "user        patel.r (pharmacy)\n09:10  sign-in  Columbus, OH   hospital network\n09:25  sign-in  Frankfurt, DE  ASN: corporate web proxy\ndevice      managed laptop, compliant",
      why: "Frankfurt is where the hospital’s web proxy exits to the internet. Same managed laptop, same person. A known false positive worth a tuning rule." },
    { title: "Mass file access", source: "File server", time: "01:40", answer: "fp",
      log: "account   svc_pacs_backup\nshare     \\\\imaging\\archive\nread      48,211 files, 01:00 to 01:40\nhistory   same pattern for the last 30 nights",
      why: "The nightly imaging backup, doing what it does every night. Add an exception so it stops paging Priya." },
    { title: "Mass file rename", source: "Endpoint protection", time: "02:14", answer: "real",
      log: "host      FIN-WS-07\nuser      k.morris\nrenamed   3,200 files  *.xlsx -> *.xlsx.lkd\nprocess   svchost_update.exe (unsigned, 2 hours old)",
      why: "Mass renaming to a new extension by an unsigned, brand-new process at 2 a.m. is ransomware encryption. Isolate the host immediately." },
    { title: "New domain admin", source: "Directory", time: "23:52", answer: "real",
      log: "account     helpdesk_temp2\ncreated by  svc_scripting\nadded to    Domain Admins\nticket      none",
      why: "A service account creating a new admin account at midnight with no change ticket is a classic attacker move. Disable it and investigate." },
    { title: "New domain admin", source: "Directory", time: "10:15", answer: "fp",
      log: "account     a.nguyen-adm\ncreated by  j.brooks (identity team)\nadded to    Server Admins\nticket      CHG-4471, approved",
      why: "Created by the identity team, during business hours, with an approved change ticket. Legitimate." },
    { title: "Encoded PowerShell", source: "Endpoint protection", time: "14:03", answer: "real",
      log: "host     NURS-4W-12 (nursing station)\nparent   WINWORD.EXE\ncommand  powershell -nop -w hidden -enc SQBFAFgAIAAoAE4A...",
      why: "Word launching hidden, encoded PowerShell is a malicious document at work. Isolate the workstation; the nurses can use the one next to it." },
    { title: "Large upload from the MRI console", source: "Firewall", time: "14:22", answer: "escalate",
      log: "host     MRI-CONSOLE-2 (Windows 7)\ndest     vendor remote-service IP\nsent     2.1 GB\nwindow   vendor service visit booked 14:00 to 16:00",
      why: "It matches a booked vendor visit, but 2 GB is far more than a normal service session. Ask Biomed and the vendor before closing it, rather than cutting off a scanner mid-service." },
    { title: "Login to a retired doctor’s account", source: "EHR audit log", time: "23:40", answer: "real",
      log: "account   dr.okonkwo (retired in March)\nsource    hospital VPN\naction    patient search, 212 records opened",
      why: "A retired doctor’s account searching hundreds of records late at night is either a stolen account or misuse. Disable it now." },
    { title: "Unusual chart access", source: "EHR audit log", time: "16:10", answer: "escalate",
      log: "user      nurse.cole (oncology)\nopened    chart flagged VIP\nrelation  not on care team; patient is in the ED",
      why: "This isn’t an attack to contain; it’s possible snooping. Escalate to the privacy officer, who handles it with HR." },
    { title: "Regular calls to a new domain", source: "DNS", time: "03:00", answer: "real",
      log: "host      PHARM-01 (pharmacy)\ndomain    pyxis-update-cdn.top\nregistered 2 days ago\npattern   every 60 seconds, all night",
      why: "A brand-new domain dressed up as a vendor name, called on a perfect timer: malware checking in with its controller. Block it and isolate the host." },
    { title: "Burst of failed logins", source: "Identity provider", time: "08:05", answer: "fp",
      log: "account   scheduling_kiosk\nsource    KIOSK-LOBBY-1\nfailures  400 in 5 minutes\nnote      password rotated Friday",
      why: "A lobby kiosk retrying an old saved password after Friday’s rotation. Update the kiosk; it isn’t an attack." }
  ];
  hospital.minigames = {
    schedule: { 1: "triage", 4: "triage", 7: "triage" },
    triage: {
      data: ALERTS, count: 4, // 12 alerts, 3 rounds: no repeats in a year
      intro: "Priya is buried. Help her clear the overnight alert queue: false positive, real threat, or escalate?",
      hint: S => S.tutorial && !S.seenTriage && (S.seenTriage = true) ? "<b>How triage works:</b> read the log details, not just the title. Two alerts with the same name can be completely different. <b>False positive</b> closes it, <b>real threat</b> starts containment, and <b>escalate</b> hands it to someone else to verify. Escalating is safe, but each one costs Priya time and adds to her burnout." : "",
      good: "The queue is clear, and Priya turned two of the false positives into tuning rules.",
      bad: "The queue is clear, but some calls were wrong. Priya walked you through what she’d have done.",
      lesson: ["Alert triage", "Most alerts are noise. The skill is spotting what matters quickly, closing the rest with confidence, and turning repeat false positives into tuning."],
      reward(S, score, esc, n) {
        const gain = Math.round(score * 4); S.detect = clamp(S.detect + gain);
        team.burn("priya", esc * 2);
        return [`Detection rules +${gain}`].concat(esc ? [`Priya’s burnout +${esc * 2}`] : []);
      }
    }
  };

  /* ---------- Ransomware night wording ---------- */
  hospital.finale = {
    title: "Ransomware night",
    times: ["11:48 PM", "12:02 AM", "12:15 AM", "12:29 AM", "12:41 AM", "12:54 AM", "1:04 AM", "1:12 AM"],
    intro: S => `Late on a Saturday, the ${S.gang.name} gang turns its attention to ${ORG}. Weekends are thinly staffed, and they know it. They start with your weakest spot and keep going until something works.`,
    vectors: S => [
      { name: "a phishing email", p: 1 - (1 - sys.eff(S.filter)) * (1 - S.training / 100 * .8), hold: "The filter caught most copies, and the staff who saw it reported it.", fail: "A unit secretary entered her password on a fake “shift swap” page." },
      { name: "the VPN", p: S.patch / 100, hold: "The VPN flaw they wanted was already patched.", fail: "They used a known VPN flaw. The fix had been out for weeks." },
      { name: "a stolen password", p: S.mfa ? .95 : .15, hold: "Multi-factor login asked for a code they didn’t have.", fail: "They logged in with a nurse’s password bought online. No second factor was required." },
      { name: "a vendor’s remote access", p: S.vendor >= 60 ? .9 : .3, hold: "The vendor connection they found was switched off; access is on-demand now.", fail: "An imaging vendor’s always-on remote tool was still running, with a reused password." },
      { name: "an old account", p: S.stale <= 3 ? .95 : .3, hold: "The forgotten accounts they hunted for were already disabled.", fail: `One of ${S.stale} accounts belonging to people who’d left still worked.` }
    ].concat(S.expanded ? [{ name: "the newly acquired clinic", p: S.done.clinic ? .9 : .2, hold: "Lakeview Clinic’s network had been rebuilt to hospital standards.", fail: "Lakeview Clinic’s old file server, still running its 2016 setup, let them straight in and onto the hospital network." }] : []),
    zeroDay: { label: "They buy a zero-day.", fail: "With every door locked, they bought a brand-new flaw in the hospital’s remote-access gateway. No patch exists yet." },
    luckyBlock: "It should have worked, but their tool crashed halfway through. <i>Lucky break.</i>",
    firstTry: "They got in on the first try, quietly.",
    decisionHint: "<b>Live decisions:</b> from here, you make the calls. There’s rarely a perfect answer. Broader containment is more certain but disrupts patient care; narrower containment is gentler but riskier. What you’ve built all year (detection, inventory, backups, MDR) changes the odds.",
    beachhead: {
      clock: "1:20 AM", title: "The first machine",
      blocked: "Endpoint protection caught their tools the moment they ran and quarantined them. They lost their foothold before they had it.",
      lucky: "Their malware crashed on an outdated driver before it finished installing. The foothold is gone. That was too close.",
      failed: S => S.edr < 75 ? "Endpoint protection logged a warning but was still in alert-only mode on that machine. Their tools are running." : "Endpoint protection blocked one tool, but they disguised the next. They have a machine."
    },
    early: {
      clock: "1:40 AM", title: "The on-call phone buzzes",
      alert: S => S.mdr !== null && !S.mdrNoisy ? "The MDR provider calls: attacker tools are running on a nursing workstation on 4 West, and the account is starting to look around the network." : "A detection rule fires: attacker tools are running on a nursing workstation on 4 West, and the account is starting to look around the network.",
      options: [
        { id: "host", label: "Isolate that one workstation" },
        { id: "segment", label: "Cut off all of 4 West’s network" },
        { id: "watch", label: "Watch them for an hour" }
      ],
      hostWin: "You isolated the workstation and disabled the account. A sweep confirmed they hadn’t reached anything else.",
      hostLose: "You isolated the workstation, but they had already moved to a second machine you didn’t know about.",
      segmentCare: -4,
      segmentCost: "4 West switched to downtime procedures for the rest of the night.",
      segmentWin: "Cutting off the whole unit trapped them. Morning shift found a contained, boring mess.",
      segmentLose: "You cut off the unit, but they had already reached a server outside it.",
      watchWin: "You watched them map the network, learned which accounts and tools they were using, then cut them all off at once. Textbook.",
      watchLose: "While you watched, they moved faster than expected and reached the servers."
    },
    contain: {
      clock: "3:10 AM", title: "They’re on the servers",
      alert: S => "An alert finally fires: backup snapshots are being deleted on the main file servers. Someone with admin rights is inside.",
      knownAlert: "They’re on the servers now, deleting backup snapshots. You know their accounts and tools from earlier tonight.",
      unseen: "Nobody is watching closely enough to notice them deleting backup snapshots on the main servers. At 4:55 a.m., the encryption begins.",
      options: [
        { id: "plug", label: "Take the hospital off the network" },
        { id: "targeted", label: "Targeted containment" },
        { id: "mdr", label: "Let the MDR team lead" }
      ],
      plugCare: -15,
      plugCost: "You disconnected the hospital’s networks. Every unit went to paper charts and downtime procedures for two days.",
      plugWin: "It worked. Nothing was encrypted.",
      plugLose: "Two servers were already encrypting before the cables came out.",
      targetedWin: "You disabled their accounts and isolated the servers they’d touched, one by one, without taking clinical systems down. Nothing was encrypted.",
      targetedLose: "You missed an account. They noticed what you were doing and started the encryption early.",
      mdrWin: "The MDR team isolated the affected servers within twenty minutes and walked Marcus through the rest.",
      mdrLose: "The MDR team couldn’t contain them fast enough."
    },
    encrypt: {
      clock: "5:30 AM", title: "The hospital goes dark",
      body: S => `<p>The EHR, imaging, lab and pharmacy systems are encrypted. A note from ${S.gang.name} is on every screen. The emergency department is still open, and ambulances are on their way.</p>`,
      safety: [{ id: "divert", label: "Go on ambulance diversion" }, { id: "stay", label: "Stay open on paper" }],
      divertCare: -10, divertText: "You went on diversion, so serious cases went to other hospitals while staff switched to paper.",
      stayBadCare: -25, stayBad: "You stayed open on paper. A stroke patient’s scan was delayed for over an hour while staff walked images between buildings.",
      stayOkCare: -8, stayOk: "You stayed open on paper. It was chaotic, but the downtime drills held.",
      restored: "Your backups were proven good. It took four days to restore the EHR and two weeks for everything else.",
      recoverClock: "9:00 AM", recoverTitle: "Recovery",
      noBackups: S => `<p>The backups are gone: snapshots deleted, the backup server encrypted too. The gang wants $2.4 million. Cyber insurance would cover most of it, after a $50,000 deductible from your budget.</p>`,
      recovery: [{ id: "pay", label: "Pay the ransom" }, { id: "rebuild", label: "Refuse and rebuild" }],
      deductible: 50000,
      paidWorks: "You paid. The decryptor was slow and buggy; the EHR came back in ten days.",
      paidFails: "You paid. The decryptor failed on the biggest database, and you rebuilt it anyway.",
      rebuilt: "You refused. Rebuilding took four weeks of paper charts, cancelled surgeries and national news coverage."
    },
    lessons: {
      weakest: ["Weakest link", "Attackers look for your easiest way in, not your strongest defense."],
      assume: ["Assume breach", "Plan as if attackers will get in. Prevention buys time; detection, response and backups decide how bad it gets."],
      luck: ["Luck", "Sometimes things break your way. It isn’t a plan."],
      ransom: ["Paying the ransom", "Paying doesn’t guarantee recovery, funds criminals and marks you as a payer. Proven, protected backups are what let you refuse."]
    },
    results: {
      edr: { label: "Stopped on the first machine", bonus: 15, text: "By morning they’d moved on. You found the evidence in the logs over coffee.", fx: { trust: 6 }, lesson: ["Defense in depth", "When one layer fails, the next one can still stop the attack."] },
      luckyedr: { label: "Lucky break on the first machine", bonus: 8, text: "You found the crash logs on Monday and realized how close it was.", fx: { trust: 2 }, lesson: ["Defense in depth", "When one layer fails, the next one can still stop the attack."] },
      early: { label: "Contained one workstation", bonus: 15, text: "One workstation rebuilt, one account reset, and patient care never noticed.", fx: { trust: 5 }, lesson: ["Detection and response", "Catching an attacker on the first machine is the cheapest win there is."] },
      segment: { label: "Contained one unit", bonus: 13, text: "One unit had a rough night on paper. Everyone else slept through it.", fx: { trust: 4 }, lesson: ["Containment trade-offs", "Broader containment is more certain but costs more. Sometimes that’s the right price."] },
      watched: { label: "Watched, then evicted", bonus: 16, text: "Because you watched first, you got every foothold in one sweep.", fx: { trust: 6 }, lesson: ["Scoping before containing", "Cutting off attackers before you know their full footprint can leave footholds behind. Watching is powerful and risky."] },
      downtime: { label: "Pulled the plug in time", bonus: 8, text: "Two days on paper, but no ransomware, no ransom and no lost data.", fx: { trust: 2 }, lesson: ["Downtime procedures", "Disconnecting is blunt but effective. Rehearsed downtime procedures are what make it survivable for patients."] },
      targeted: { label: "Targeted containment", bonus: 14, text: "Precise containment kept clinical systems running all night.", fx: { trust: 5 }, lesson: ["Detection and response", "Good detection and a well-mapped network let you contain precisely instead of shutting everything down."] },
      mdrled: { label: "Contained by MDR", bonus: 12, text: "A few servers rebuilt and a long report from the MDR provider.", fx: { trust: 3 }, lesson: ["Detection and response", "A tuned MDR service brings round-the-clock expertise a small team can’t staff itself."] },
      restored: { label: "Encrypted, restored from backups", bonus: 4, text: "Painful, but you never had to consider paying.", fx: {}, lesson: ["Backups", "Proven, protected backups turn ransomware from a catastrophe into a terrible few weeks."] },
      paid: { label: "Paid the ransom", bonus: 0, text: "The board has questions.", fx: {}, lesson: ["Backups", "Without proven, protected backups, every option is bad."] },
      rebuilt: { label: "Rebuilt from scratch", bonus: 0, text: "The board has a lot of questions.", fx: {}, lesson: ["Backups", "Without proven, protected backups, every option is bad."] }
    }
  };

  mode.addSetting(hospital);
})();
