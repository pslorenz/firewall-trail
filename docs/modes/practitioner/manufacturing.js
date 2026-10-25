/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Practitioner setting: a mid-size manufacturer.
 * The core tension is security versus production: plant systems (OT) run old
 * software that often can't be patched, changes to them are only safe during
 * planned shutdowns, and every hour a line stops costs real money. */
(function () {
  const S = FT.S, L = FT.learned, { chance, clamp, money } = FT.util, sys = FT.sys;
  const mode = FT.modes.practitioner, team = mode.team;
  const ORG = "Hallett Precision Components";
  // Planned shutdowns: the only times plant systems can be changed without stopping lines
  const WINDOWS = [3, 6, 11]; // Apr, Jul, Dec

  const isWindow = S => WINDOWS.includes(S.month);
  const nextWindow = S => { const n = WINDOWS.find(w => w >= S.month); return n === undefined ? null : n; };

  const plant = {
    id: "manufacturing", letter: "M",
    name: "Mid-size manufacturer",
    short: "Manufacturer",
    summary: "A 650-person precision parts maker. Security versus production: plant systems can’t be patched on a whim, and every stopped line costs money.",
    chief: "Glenn Hallett, COO",
    meters: [
      { key: "trust", label: "Leadership trust", short: "Trust" },
      { key: "care", label: "Production", short: "Production" },
      { key: "morale", label: "Team morale", short: "Morale", value: () => team.morale() }
    ],
    months: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    landmarks: ["Annual planning","Big customer audit","Q1 close","Spring shutdown","New line install","Peak orders","Summer shutdown","ERP upgrade","Q3 close","Trade show","Year-end rush","Holiday shutdown"],
    winTitle: "You made it through the holiday shutdown",
    startBudget: 70000,
    monthlyBudget: 7000,
    briefing: `<b>Your new job:</b> security lead at ${ORG}, a family-owned maker of machined and molded parts for automotive and medical-device customers. One plant, three shifts, 650 people. Planned shutdowns in April, July and December are the only safe times to change plant systems.`,
    irNote: "The incident plan meant nobody improvised: plant leadership knew when to stop lines safely, the integrators were on a call tree, and customers heard from you first. That cut the damage.",
    orientation: "Glad you’re here. Straight talk: our plant runs on machines older than some of our operators. Half the control systems run Windows versions nobody supports, the office and the plant share one flat network, and every integrator who ever touched a line still has a way in. Lena watches the alerts and Rafael handles the network and the plant systems. Keep the lines running.",

    newState() {
      return {
        otPatch: 20, otCfgAge: 8, segmented: false, gateway: false,
        team: [
          { id: "you", name: "You", role: "Security lead", skill: "lead", cap: 2, burnout: 25 },
          { id: "lena", name: "Lena", role: "Analyst", skill: "detect", cap: 2, burnout: 20 },
          { id: "rafael", name: "Rafael", role: "Network and plant engineer", skill: "infra", cap: 2, burnout: 35 }
        ]
      };
    },
    replacement(p) {
      const names = p.skill === "detect" ? ["Morgan", "Imani", "Pavel"] : ["Hector", "Bea", "Quinn"];
      return { name: names[Math.floor(FT.util.rand() * names.length)], burnout: 10, newHire: 2, away: 0 };
    },

    /* ---------- Plant-specific tasks ---------- */
    actions: [
      { id: "patchot", kind: "upkeep", skill: "infra", name: "Patch plant systems", desc: "HMIs, engineering workstations, historians. Safe only during a planned shutdown; otherwise a line has to stop.",
        apply: (S, k) => {
          S.otPatch = clamp(S.otPatch + Math.round(40 * k));
          if (isWindow(S)) { S.otWindow = (S.otWindow || 0) + 1; return "Patched plant systems during the shutdown. No production impact."; }
          S.otOutside = (S.otOutside || 0) + 1;
          return { bad: true, text: "Patched plant systems outside a shutdown. Line 2 stopped for most of a shift while each station rebooted and was re-verified.", fx: { care: -6, trust: -2 } };
        } },
      { id: "otbackup", kind: "upkeep", skill: "infra", name: "Back up PLC and HMI configurations", desc: "Save the programs and settings the machines run on, so they can be restored.",
        apply: S => { S.otCfgAge = 0; return "Backed up PLC programs and HMI configurations for every line."; } },
      { id: "segment", kind: "project", skill: "infra", cost: 40000, work: 4, name: "Build an IT/OT boundary", desc: "Separate the plant network from the office, with a controlled zone in between.",
        done: S => { S.segmented = true; return "The plant network is separated from the office, with only approved traffic crossing between them."; } },
      { id: "line5", kind: "project", skill: "infra", cost: 15000, work: 3, name: "Secure line 5", desc: "Change default passwords, remove the integrator’s tools, put the line behind the plant boundary.", show: S => S.expanded,
        done: S => { S.inventory = clamp(S.inventory + 10); return "Line 5 is secured: new passwords, no leftover integrator tools, and documented in the inventory."; } },
      { id: "gateway", kind: "project", skill: "infra", cost: 15000, work: 2, name: "Secure remote access for integrators", desc: "One logged, on-demand gateway instead of a dozen vendor tools.",
        done: S => { S.gateway = true; S.vendor = Math.max(S.vendor, 80); return "Integrators now connect through one logged gateway, and only when someone approves it."; } }
    ],

    monthEnd(S) {
      const d = n => Math.round(n * S.diff.decay);
      S.patch = clamp(S.patch - d(15));
      S.otPatch = clamp(S.otPatch - d(5));
      S.otCfgAge++;
      S.backupAge++; if (S.backupAge > 2) S.backupTested = false;
      S.training = clamp(S.training - d(5));
      S.detect = clamp(S.detect - d(5));
      S.inventory = clamp(S.inventory - d(5));
      if (!S.gateway) S.vendor = clamp(S.vendor - d(5));
      S.stale = Math.min(20, S.stale + d(2));
    },

    /* ---------- Status board ---------- */
    dashboard(S) {
      const lvl = (v, g, o) => v >= g ? "good" : v >= o ? "warn" : "bad";
      const words = v => v >= 70 ? "Current" : v >= 40 ? "Falling behind" : "Badly behind";
      const nw = nextWindow(S);
      const rows = [
        ["IT patches", lvl(S.patch, 70, 40), words(S.patch)],
        ["Plant patches", lvl(S.otPatch, 70, 40), words(S.otPatch)],
        ["Next shutdown", isWindow(S) ? "good" : "warn", isWindow(S) ? "This month: safe to patch" : nw === null ? "None left this year" : `${plant.months[nw]} (${nw - S.month} month${nw - S.month > 1 ? "s" : ""})`],
        ["Plant network", S.segmented ? "good" : "bad", S.segmented ? "Separated from office" : "Flat, shared with office"],
        ["IT backups", S.backupTested ? "good" : "bad", S.backupTested ? (S.backupAge === 0 ? "Restore tested this month" : `Restore tested ${S.backupAge} month${S.backupAge > 1 ? "s" : ""} ago`) : "Restore not tested recently"],
        ["Machine configs", S.otCfgAge <= 3 ? "good" : S.otCfgAge <= 6 ? "warn" : "bad", S.otCfgAge === 0 ? "Backed up this month" : S.otCfgAge > 7 ? "No recent backup" : `Backed up ${S.otCfgAge} months ago`],
        ["Staff awareness", lvl(S.training, 60, 35), S.training >= 60 ? "Sharp" : S.training >= 35 ? "Fading" : "Low"],
        ["Detection rules", lvl(S.detect, 70, 40), S.detect >= 70 ? "Sharp" : S.detect >= 40 ? "Drifting" : "Noisy and blind"],
        ["Endpoint protection", lvl(S.edr, 75, 50), (S.edr >= 75 ? `Well tuned (${S.edr}%)` : S.edr >= 50 ? `Partly tuned (${S.edr}%)` : `Mostly alert-only (${S.edr}%)`) + ", office only"],
        ["Email filter", lvl(S.filter, 75, 50), S.filter >= 75 ? `Well tuned (${S.filter}%)` : `Partly tuned (${S.filter}%)`],
        ["Multi-factor login", S.mfa ? "good" : "bad", S.mfa ? "On for everyone" : "Off"],
        ["Old accounts", S.stale <= 3 ? "good" : S.stale <= 9 ? "warn" : "bad", S.stale === 0 ? "All cleaned up" : `${S.stale} still active`],
        ["Integrator access", S.gateway ? "good" : lvl(S.vendor, 60, 30), S.gateway ? "Through the gateway" : S.vendor >= 60 ? "Reviewed" : S.vendor >= 30 ? "Partly reviewed" : "Unknown"],
        ["Incident plan", S.irPlan ? "good" : "bad", S.irPlan ? "Written and tested" : "None"]
      ];
      if (S.expanded) rows.push(["Line 5", S.done.line5 ? "good" : "bad", S.done.line5 ? "Secured" : "Running, not yet secured"]);
      if (S.mdr !== null || S.month > S.mdrMonth) rows.push(["MDR service", S.mdr === null ? "bad" : S.mdrNoisy ? "warn" : S.mdr >= 80 ? "good" : "warn", S.mdr === null ? "None" : S.mdrRamp ? "Onboarding" : S.mdr >= 80 ? `Tuned by provider (${S.mdr}%)` : S.mdrNoisy ? `Self-onboarded, noisy (${S.mdr}%)` : `Self-tuned (${S.mdr}%)`]);
      return rows;
    },
    explain: {
      "IT patches": "Office servers, laptops, firewalls and the VPN. Patch these any time.",
      "Plant patches": "HMIs, engineering workstations and historians on the plant floor. Patching outside a planned shutdown stops a line.",
      "Next shutdown": "Planned shutdowns are the only safe time to change plant systems. Plan plant work around them.",
      "Plant network": "Whether the plant is walled off from the office. On a flat network, office malware can reach the machines.",
      "IT backups": "Office systems and the ERP, proven by an actual restore test.",
      "Machine configs": "Backups of PLC programs and HMI settings. Without them, a dead controller can idle a line for days.",
      "Staff awareness": "How well staff spot phishing and fraud. It fades without practice.",
      "Detection rules": "Whether your alerts catch real attacker behavior, including on the plant network.",
      "Endpoint protection": "Office machines only. Most plant systems are too old or too sensitive to run it.",
      "Email filter": "Stops phishing and fraud attempts before they reach inboxes.",
      "Multi-factor login": "Stops stolen passwords from being enough on their own.",
      "Old accounts": "Accounts of people who left, including contractors and temps.",
      "Integrator access": "Machine builders and integrators often keep standing remote access to the lines they installed.",
      "Incident plan": "Who does what during an incident, including when to stop lines safely.",
      "MDR service": "An outside team watching your systems around the clock.",
      "Line 5": "The new automated line: new controllers, default passwords and the integrator’s remote tools, until you secure it."
    },

    threatWarning(S) {
      if (!(S.month >= S.finaleMonth - 3 && S.month < S.finaleMonth)) return "";
      return `<div class="intel"><b>Industry alert:</b> The ${S.gang.name} ransomware gang has hit ${5 - (S.finaleMonth - S.month)} manufacturers in your region this year. They like to strike when plants are thinly staffed.</div>`;
    },

    deaths: {
      ransomware: "Your plant has died of ransomware.",
      care: "Production collapsed. Your biggest customer moved its orders elsewhere.",
      trust: "The owners brought in an outside firm. Your contract was not renewed."
    },

    /* ---------- Mid-year offer: MDR ---------- */
    mdrOffer() {
      const pro = 25000, canPro = S.budget >= pro, title = "The owners approve an MDR contract";
      FT.ui.screen(`<div class="panel"><h2>${title}</h2>
        <p>After a competitor’s plant was hit by ransomware, the owners approved a year of <b>managed detection and response (MDR)</b>, with analysts watching your systems around the clock. It must be signed this month.</p>
        <p>The vendor offers onboarding services from your budget, including tuning for the plant network. Or your team can onboard it.</p>
        <div class="opts">
          <button class="opt choice" data-c="pro" ${canPro ? "" : "disabled"}><div><b>Sign it, with vendor onboarding</b><small>Tuned to your office and plant traffic. About 85% effective from next month.${canPro ? "" : " Your budget can’t cover this right now."}</small></div><span class="cost">${money(pro)}</span></button>
          <button class="opt choice" data-c="self"><div><b>Sign it, onboard it yourselves</b><small>Free, but default settings, about 35% effective, and Lena buried in alerts until it’s tuned.</small></div><span class="cost">$0</span></button>
          <button class="opt choice" data-c="no"><div><b>Decline it</b><small>One less thing for a stretched team.</small></div><span class="cost">$0</span></button>
        </div></div>`, "button[data-c]:not(:disabled)");
      FT.app.querySelectorAll("button[data-c]").forEach(b => b.onclick = () => {
        const c = b.dataset.c; let r; FT.note(title, `Chose: ${b.querySelector("b").textContent}.`);
        if (c === "pro") { S.budget -= pro; S.mdr = 40; S.mdrRamp = true; S.mdrNoisy = false;
          r = { text: "The vendor’s engineers spent two weeks with Lena and Rafael learning what normal looks like: which machines talk to the historian, when integrators connect, what the night shift does.", fx: { morale: -2 }, lesson: ["Professional services", "Paying experts to set up a tool properly often matters as much as the tool itself."] }; }
        else if (c === "self") { S.mdr = 35; S.mdrNoisy = true;
          r = { text: "Rafael deployed the sensors over a weekend. It works, sort of. Lena now gets about 80 alerts a day, most of them the PLCs’ perfectly normal chatter.", fx: { morale: -5 }, lesson: ["Alert fatigue", "A badly tuned tool buries real warnings under false alarms. The people watching it burn out, and eventually stop looking."] }; }
        else r = { text: "You declined. The owners were surprised and asked you to put your reasons in writing.", fx: { trust: -3 }, lesson: ["Opportunity cost", "Every choice has a price, including saying no."] };
        L.set(...sys.notes.mdr);
        FT.screens.outcome(title, r);
      });
    },

    /* ---------- The guided first month ---------- */
    tutorial: {
      tips: [
        { target: "dash", text: "This is the security status board. Red is a gap, yellow is slipping, green is solid. Note the line for the next planned shutdown: plant systems can only be changed safely during one, and the next is in April." },
        { target: "team", text: "This is your team. Each person gets two tasks a month. A ★ marks their specialty, where they work about 40% faster: Lena is detection, Rafael is network and plant systems, and you’re leadership. You can do anything at normal speed; they’re slower outside their specialty." },
        { target: "team", text: "Watch the burnout number next to each name. It creeps up every month, and overtime or a bad incident pushes it up fast. Past 65 they work slower, past 80 their work starts slipping, and past about 85 they may resign, and replacing them takes two months. <b>Time off</b> is in everyone’s task list. Rafael is already more tired than I’d like." },
        { target: "budget", text: "Projects, like separating the plant from the office network, take several person-months and only pay off once finished. You pay when you start one. Your committed spending is shown here." },
        { target: "team", text: "Plant systems are the tricky part. Patching them outside a shutdown stops a line, so save that for April, July and December. Until then, back up the machine configurations and start the network separation. My suggestion: Rafael starts the IT/OT boundary and backs up the machine configs, Lena tunes detection and hunts, and you start multi-factor login and run phishing training." }
      ],
      suggested: { you: ["mfa", "train"], lena: ["tunedetect", "hunt"], rafael: ["segment", "otbackup"] },
      report: "This is the change report: what each person did, and anything that broke. Red lines are changes that went wrong. On the plant floor, a careless change can stop production as surely as an attack.",
      monthNotes: {
        1: "Look at the burnout numbers before assigning anything, especially Rafael’s. A rested team is a faster team.",
        3: "This is the spring shutdown: the lines are down, so it’s the safe time to patch plant systems."
      }
    }
  };

  /* ---------- Unplanned work specific to a plant ---------- */
  plant.interrupts = [
    { skill: "lead", text: "A customer wants a call to walk through your security questionnaire answers.", done: "Walked a customer through your security questionnaire answers." },
    { skill: "infra", text: "An integrator needs emergency remote access to fix a down line.", done: "Set up supervised emergency access for an integrator to fix a down line." },
    { skill: "detect", text: "The plant monitor flagged 300 “new devices” after a switch was replaced.", done: "Cleared 300 false “new device” alerts after a switch replacement." }
  ];

  /* ---------- Mid-year expansion: a new line ---------- */
  const newLine = ["New systems arrive insecure", "New equipment usually ships with default passwords and the installer’s remote tools. Securing it before or right after go-live is far cheaper than after an incident."];
  plant.expansion = {
    id: "line5", title: "Line 5 arrives",
    intro: "A new automated assembly line, line 5, is installed and ready, built by an integrator you haven’t worked with before. It runs new controllers, and the integrator’s laptop software is still on it. Glenn wants it producing for a big new order on Monday.",
    choices: [
      { label: "Security check before go-live ($15,000)", run() {
        S.budget -= Math.min(15000, Math.max(0, S.budget)); S.proj.line5 = 1;
        return { text: "You held go-live for a week to change default passwords and review the integrator’s access. Glenn was not pleased about the order, but securing the line is already under way. ($15,000 from your budget.)", fx: { care: -4, trust: -2 }, lesson: newLine };
      } },
      { label: "Go live on Monday, secure it later", run() {
        S.vendor = clamp(S.vendor - 20); S.inventory = clamp(S.inventory - 15);
        return { text: "Line 5 went live on Monday and hit the order. It also went live with factory passwords and the integrator’s remote tool. Securing it is now a project on your list.", fx: { care: 3, trust: 2 }, lesson: newLine };
      } }
    ]
  };

  /* ---------- Events ---------- */
  const legacy = ["Legacy plant systems", "Plant systems often run unsupported software for decades. You protect them by isolating them, not by patching them."];
  const vendorLesson = ["Integrator remote access", "Machine builders and integrators often leave always-on remote tools behind. Every one is a door into the plant."];

  plant.events = [
    { id: "bec", title: "A supplier changes bank details", run() {
      if (S.irPlan || S.training >= 60) return { text: "An email from your steel supplier’s real address asked to update the bank account for a $480,000 invoice. Accounts payable followed the callback rule and phoned the supplier’s known number. The supplier’s email had been hacked.", fx: { trust: 4 }, lesson: ["Business email compromise", "Attackers take over a real supplier’s email, then ask you to pay a new account. A callback to a known number is the fix, every time."] };
      const f = sys.filterCatch();
      if (f.caught) return { text: "A bank-change request from a look-alike supplier domain was quarantined by the email filter before accounts payable saw it.", fx: { trust: 2 }, lesson: ["Business email compromise", "Attackers impersonate suppliers to redirect payments. Filters help with look-alike domains, but not when the real supplier is hacked."] };
      return { text: "An email from your steel supplier’s real address asked to update the bank account for a $480,000 invoice. Accounts payable updated it. The supplier’s email had been hacked, and the money is gone. Insurance covers part of it.", fx: { trust: -14, budget: -15000 }, lesson: ["Business email compromise", "Attackers take over a real supplier’s email, then ask you to pay a new account. A callback to a known number is the fix, every time."] };
    } },
    { id: "xphmi", title: "The HMI that runs Windows XP", intro: "Rafael found that the injection molding line’s control screen still runs Windows XP. The machine builder says upgrading it means replacing the whole control cabinet: $180,000 and three weeks of downtime.", choices: [
      { label: "Isolate it this weekend", run() { team.burn("rafael", 12); S.inventory = clamp(S.inventory + 10);
        return { text: "Rafael put the molding line behind its own firewall, allowing only the traffic it actually needs.", fx: { trust: 2 }, lesson: legacy }; } },
      { label: "Leave it; it’s worked for 15 years", run() {
        if (chance(.45)) return { text: "A worm from an infected office laptop crossed the flat network and crashed the XP screen. The molding line was down for three days.", fx: { care: -10, trust: -5 }, lesson: legacy };
        return { text: "Nothing happened this month. The XP screen is still sitting on the shared network, though.", fx: {}, lesson: legacy }; } }
    ] },
    { id: "usb", title: "A USB stick on line 3", run() {
      if (S.segmented) return { text: "An operator loaded CNC programs from a USB stick that had picked up malware at home. It infected the line 3 terminal, but the plant network’s boundary stopped it from spreading.", fx: { care: -2 }, lesson: ["Removable media", "USB sticks still carry malware onto plant floors. Isolation limits the damage when one gets through."] };
      return { text: "An operator loaded CNC programs from a USB stick that had picked up malware at home. It spread across the flat network to four machine terminals. Line 3 was down for two days.", fx: { care: -9, trust: -4 }, lesson: ["Removable media", "USB sticks still carry malware onto plant floors. Isolation and scanning stations limit the damage."] };
    } },
    { id: "integrator", title: "The integrator’s remote tool", run() {
      if (S.gateway || S.vendor >= 60) return { text: "The integrator who built the packaging line had their remote-access tool hacked. Because integrators now connect only through your approved gateway, the stolen access led nowhere.", fx: { trust: 4 }, lesson: vendorLesson };
      if (S.segmented) return { text: "Attackers used the packaging integrator’s forgotten remote tool to get in, but the network boundary kept them away from the office. Rafael removed the tool.", fx: { care: -3 }, lesson: vendorLesson };
      return { text: "Attackers used the packaging integrator’s forgotten remote tool to reach the plant, then the office. You spent a week cleaning up, and packaging ran at half speed.", fx: { care: -8, trust: -8 }, lesson: vendorLesson };
    } },
    { id: "cad", title: "Drawings walk out the door", run() {
      if (S.detect >= 50) return { text: "A design engineer who had just given notice started copying 18 GB of customer CAD drawings to a personal cloud account. A detection rule flagged it within the hour, and HR and legal stepped in.", fx: { trust: 4 }, lesson: ["Insider data theft", "People leaving for competitors sometimes take the crown jewels. Watching for unusual data movement catches it in time."] };
      return { text: "A design engineer who left for a competitor took 18 GB of customer CAD drawings with him. You found out when your customer saw their part at a trade show.", fx: { trust: -14 }, lesson: ["Insider data theft", "People leaving for competitors sometimes take the crown jewels. Watching for unusual data movement catches it in time."] };
    } },
    { id: "questionnaire", title: "The customer security questionnaire", run: null },
    { id: "fwzero", title: "A firewall zero-day", intro: "Your firewall vendor disclosed a flaw attackers are already exploiting. Patching means a reboot that briefly cuts the office off and interrupts the ERP feed to the plant.", choices: [
      { label: "Patch tonight", run() { S.patch = clamp(S.patch + 30); team.burn("rafael", 10);
        return { text: "Rafael patched at 10 p.m. The night shift lost the ERP feed for 20 minutes and worked from printed orders. Closed.", fx: { care: -1, trust: 3 }, lesson: ["Edge devices", "Firewalls and VPNs face the internet directly. When their flaws are exploited, hours matter."] }; } },
      { label: "Patch at the weekend", run() {
        if (chance(.5)) return { text: "Attackers got in through the firewall two nights later. Lena caught them dumping account lists, and you spent the weekend resetting passwords anyway.", fx: { trust: -12, morale: -6 }, lesson: ["Edge devices", "Firewalls and VPNs face the internet directly. When their flaws are exploited, hours matter."] };
        return { text: "Nobody hit you before the weekend. You patched with no fuss.", fx: {}, lesson: ["Edge devices", "Waiting on an exploited flaw is a gamble, even when it pays off."] }; } }
    ] },
    { id: "sis", title: "The safety controller changed modes", run() {
      if (S.segmented && S.detect >= 40) return { text: "The safety controller on the heat-treat furnace logged a change to programming mode. Lena traced it in minutes: a controls engineer with a work order, from the approved engineering station. Logged and closed.", fx: { trust: 3 }, lesson: ["Safety systems", "Safety controllers exist to stop machines before they hurt people. Any unexplained change to them is treated as an emergency."] };
      return { text: "The safety controller on the heat-treat furnace logged a change to programming mode, and nobody could say who did it. Plant leadership shut heat treat down for two days while an outside firm checked it. It turned out to be a contractor’s laptop, but you couldn’t prove it fast.", fx: { care: -12, trust: -5 }, lesson: ["Safety systems", "Safety controllers exist to stop machines before they hurt people. You need to be able to answer “who changed it?” in minutes, not days."] };
    } },
    { id: "kiosk", title: "Who changed the recipe?", intro: "Operators on the molding floor share one login on each station. Someone changed a temperature setting mid-shift, and 4,000 parts went to scrap. Nobody knows who.", choices: [
      { label: "Push for individual logins", run() { return { text: "You worked with plant leadership to give operators individual badge logins. Shift changes are a minute slower, and the supervisors grumbled, but changes are now traceable.", fx: { care: -3, trust: 3 }, lesson: ["Individual accountability", "Shared logins make it impossible to know who did what. Fast individual logins fix it without slowing the floor much."] }; } },
      { label: "Leave it; the floor needs speed", run() {
        if (chance(.4)) return { text: "It happened again a month later, on a customer’s rush order. Still no idea who.", fx: { care: -6, trust: -6 }, lesson: ["Individual accountability", "Shared logins make it impossible to know who did what."] };
        return { text: "Nothing happened again, yet. The shared logins are still there.", fx: {}, lesson: ["Individual accountability", "Shared logins make it impossible to know who did what."] }; } }
    ] },
    { id: "supplier", title: "Your main supplier gets ransomware", lessonPre: ["Third-party risk", "Your suppliers’ problems quickly become yours, through shared connections and shared dependencies."], intro: "Your resin supplier was hit by ransomware. Their order system has a direct connection into your ERP for automatic restocking.", choices: [
      { label: "Cut the connection now", run() { return { text: "You disconnected them and switched to phone and email orders for three weeks. Restocking was slower and one line ran short, but nothing crossed over.", fx: { care: -5 }, lesson: ["Third-party risk", "When a connected partner is compromised, cutting the connection first and asking questions later is usually right."] }; } },
      { label: "Keep it; they say it’s contained", run() {
        if (chance(.4)) return { text: "It wasn’t contained. The attackers used the supplier connection to reach your ERP, and you spent a week rebuilding it.", fx: { care: -8, trust: -10 }, lesson: ["Third-party risk", "When a connected partner is compromised, cutting the connection first and asking questions later is usually right."] };
        return { text: "They were right this time. You still don’t love how much you had to trust their word.", fx: {}, lesson: ["Third-party risk", "Taking a partner’s word that a breach is contained is a gamble."] }; } }
    ] },
    { id: "erp", title: "The ERP upgrade weekend", run() {
      if (sys.backupsGood()) return { text: "The ERP upgrade failed halfway through. Because the backups had just been restore-tested, IT rolled back in two hours and rescheduled.", fx: { care: -1 }, lesson: ["Change management", "Big changes fail sometimes. A tested way back is what makes them safe to attempt."] };
      return { text: "The ERP upgrade failed halfway through, and the rollback backup wouldn’t restore. The plant ran on spreadsheets and phone calls for four days.", fx: { care: -10, trust: -6 }, lesson: ["Change management", "Big changes fail sometimes. A tested way back is what makes them safe to attempt."] };
    } },
    { id: "plantphish", title: "The plant manager’s password", run() {
      if (S.mfa) return { text: "The plant manager entered his password on a fake shipping-portal page. Multi-factor login stopped the attacker at the door.", fx: { trust: 1 }, lesson: ["Multi-factor login", "A stolen password alone isn’t enough when a second factor is required."] };
      return { text: "The plant manager entered his password on a fake shipping-portal page. The attacker read his email for two weeks and learned your production schedule and pricing.", fx: { trust: -10 }, lesson: ["Multi-factor login", "Without it, a stolen password is all an attacker needs."] };
    } },
    { id: "rogueap", title: "A wireless router in the warehouse", run() {
      if (S.inventory >= 50) return { text: "A threat hunt turned up a cheap wireless router that a forklift vendor had plugged in for their own diagnostics. Rafael removed it.", fx: { trust: 2 }, lesson: ["Asset inventory", "Plants accumulate devices nobody remembers installing. You can’t protect what you don’t know about."] };
      return { text: "A forklift vendor’s wireless router, plugged in for their diagnostics, had been broadcasting an open network into the plant for months. Someone in the parking lot used it.", fx: { trust: -8, care: -3 }, lesson: ["Asset inventory", "Plants accumulate devices nobody remembers installing. You can’t protect what you don’t know about."] };
    } },
    { id: "contractor", title: "A contractor’s account wakes up", run() {
      if (S.stale <= 3) return { text: "Someone tried to sign in as a maintenance contractor whose job ended in the spring. The account was already disabled.", fx: { trust: 2 }, lesson: ["Offboarding", "Contractors and temps come and go constantly in manufacturing. Their accounts need to go with them."] };
      return { text: "A former maintenance contractor’s account, never disabled, was used to log into the ERP and change shipping addresses on two orders. You caught it when a customer called.", fx: { trust: -10, care: -3 }, lesson: ["Offboarding", "Contractors and temps come and go constantly in manufacturing. Their accounts need to go with them."] };
    } },
    { id: "firmware", title: "A robot firmware update", intro: "The robot vendor emailed a link to an “urgent firmware update” for the welding cell, on their usual portal. The line supervisor wants it installed tonight.", choices: [
      { label: "Verify with the vendor first", run() { return { text: "You called your vendor contact. The update was real, and they confirmed the file’s checksum. It went in during the next planned stop, a day later.", fx: { care: -1, trust: 2 }, lesson: ["Verifying updates", "Confirm updates through a known channel and check they’re genuine before installing them on production equipment."] }; } },
      { label: "Install it tonight", run() {
        if (chance(.3)) return { text: "The update was real, but it wasn’t tested with your welding cell’s configuration. The cell faulted, and was down for a day and a half.", fx: { care: -8 }, lesson: ["Verifying updates", "Confirm updates through a known channel, and test before installing on production equipment."] };
        return { text: "It installed cleanly. You got lucky that it was genuine and compatible.", fx: {}, lesson: ["Verifying updates", "Confirm updates through a known channel, and test before installing on production equipment."] }; } }
    ] },
    { id: "surge", title: "A power surge hits line 1", run() {
      if (S.otCfgAge <= 3) return { text: "A power surge wiped a PLC on line 1. Rafael restored its program from the recent configuration backup, and the line was running again by lunch.", fx: { care: -2 }, lesson: ["Machine configuration backups", "If a controller dies, its program is the only thing that matters. Backing it up turns a multi-day outage into a few hours."] };
      return { text: "A power surge wiped a PLC on line 1. There was no recent backup of its program, so the integrator had to rebuild it from old notes. Line 1 was down for four days.", fx: { care: -12, trust: -4 }, lesson: ["Machine configuration backups", "If a controller dies, its program is the only thing that matters. Backing it up turns a multi-day outage into a few hours."] };
    } },
    { id: "recruiter", title: "Lena gets an offer", run: null },
    { id: "line5default", title: "Line 5’s factory password", available: S => S.expanded && !S.done.line5, run() {
      if (S.segmented) return { text: "Someone on the office network tried line 5’s factory password on its robot controller. The plant boundary blocked the connection.", fx: { morale: -2 }, lesson: newLine };
      return { text: "Malware on an office laptop found line 5’s robot controller and logged in with its factory password, crashing the cell. Line 5 was down for three days.", fx: { care: -8, trust: -6 }, lesson: newLine };
    } },
    { id: "quiet", title: "A quiet month", run() { return { text: "No incidents, no line stoppages, no calls from the owners. Your team almost got to finish their own work.", fx: { morale: 6 }, lesson: ["Invisible wins", "When security works, nothing happens, which makes it hard to notice. That’s normal."] }; } }
  ];

  // The customer questionnaire: easy if you've done the work, a choice if not.
  Object.assign(plant.events.find(e => e.id === "questionnaire"), {
    run: undefined,
    intro: "Your largest automotive customer sent a security questionnaire. They want evidence of multi-factor login, a tested incident plan and tested backups, or they’ll review your contract.",
    choices: [
      { label: "Answer honestly, with a fix-it plan", run() {
        const good = (S.mfa ? 1 : 0) + (S.irPlan ? 1 : 0) + (S.backupTested ? 1 : 0);
        team.burn("you", 8);
        if (good >= 2) return { text: "You had real evidence for most of it, and a dated plan for the rest. The customer renewed without conditions.", fx: { trust: 6 }, lesson: ["Customer security requirements", "Big customers increasingly require proof of security. Honest answers with a credible plan keep their trust."] };
        return { text: "You were honest: several gaps, with a dated plan to close them. The customer put you on a 90-day improvement plan, but kept the contract.", fx: { trust: -2 }, lesson: ["Customer security requirements", "Big customers increasingly require proof of security. Honest answers with a credible plan keep their trust."] };
      } },
      { label: "Check “yes” on everything", run() {
        if (chance(.5)) return { text: "Their auditor asked for evidence a month later. You didn’t have it. The customer moved a third of its orders to another supplier.", fx: { trust: -15, care: -8 }, lesson: ["Customer security requirements", "Claiming controls you don’t have turns a security gap into a trust and contract problem."] };
        return { text: "Nobody checked, this year. You know they will eventually.", fx: { morale: -3 }, lesson: ["Customer security requirements", "Claiming controls you don’t have turns a security gap into a trust and contract problem."] };
      } }
    ]
  });

  // Lena gets recruited: only while the original Lena is on the team.
  Object.assign(plant.events.find(e => e.id === "recruiter"), {
    run: undefined,
    available: S => { const p = team.member("lena"); return p && !p.away && !p.newHire && p.name === "Lena"; },
    intro: "A large automaker’s security team offered Lena a job: more pay, a bigger team, no 3 a.m. calls from the plant. She told you before deciding.",
    choices: [
      { label: "Fight for a retention raise", run() {
        if (S.budget < 15000) { leave(); return { text: "You couldn’t find the money in your budget. Lena took the job.", fx: { morale: -8 }, lesson: ["Retention", "Replacing a skilled analyst costs far more than keeping one, and takes months."] }; }
        S.budget -= 15000; team.burn("lena", -20);
        return { text: "You spent $15,000 of your budget on a retention raise and promised her a saner on-call rotation. She stayed.", fx: { trust: -1 }, lesson: ["Retention", "Replacing a skilled analyst costs far more than keeping one, and takes months."] }; } },
      { label: "Wish her well", run() { leave(); return { text: "Lena took the job. The team threw her a goodbye lunch, then went back to splitting her work.", fx: { morale: -8 }, lesson: ["Retention", "Replacing a skilled analyst costs far more than keeping one, and takes months."] }; } }
    ]
  });
  function leave() {
    const p = team.member("lena");
    if (p && !p.away) Object.assign(p, { away: 3, awayNote: "Position open", replacement: plant.replacement(p) });
  }

  /* ---------- Alert triage ---------- */
  const ALERTS = [
    { title: "PLC program download", source: "Plant network monitor", time: "02:10", answer: "escalate",
      log: "target     PLC-LINE3 (stamping press)\nfrom       ENG-WS-2 (engineering station)\nuser       plant_eng (shared account)\nchange     new program uploaded, 14 rungs modified\nticket     none",
      why: "A program change on a press with no work order, at 2 a.m., from a shared account. It might be a night-shift engineer fixing a fault. Escalate to the controls lead right away; don’t just block it, because cutting off a PLC mid-change can stop the press unsafely." },
    { title: "PLC program download", source: "Plant network monitor", time: "10:30", answer: "fp",
      log: "target     PLC-LINE1 (CNC cell)\nfrom       ENG-WS-1 (engineering station)\nuser       m.ortiz (controls engineer)\nchange     new program uploaded\nticket     MOC-221, approved yesterday",
      why: "A named controls engineer, the approved engineering station, during the day, with an approved change ticket. Legitimate." },
    { title: "Unknown device in a control cabinet", source: "Plant network monitor", time: "03:12", answer: "real",
      log: "device     Raspberry Pi (new MAC address)\nlocation   switch in line 4 control cabinet\nfirst seen 03:05\ntraffic    scanning the plant network\nticket     none",
      why: "An unknown computer in a control cabinet, appearing at 3 a.m. and scanning the network. Disable that switch port and go look at the cabinet." },
    { title: "Unknown device in a control cabinet", source: "Plant network monitor", time: "14:40", answer: "fp",
      log: "device     Raspberry Pi (new MAC address)\nlocation   switch in line 2 control cabinet\nfirst seen 14:20\ntraffic    sending sensor data to the historian\nticket     vibration sensor install, scheduled this week",
      why: "Same kind of device, but installed during a scheduled vibration-sensor project and only talking to the historian. Add it to the inventory." },
    { title: "Office computer writing to a PLC", source: "Plant network monitor", time: "11:52", answer: "real",
      log: "source     10.20.14.88 (office: purchasing)\ntarget     PLC-MOLD2\nprotocol   Modbus write\nregisters  temperature setpoints",
      why: "Nothing in purchasing should ever write to a molding machine’s temperature settings. That’s an attacker, or malware, on an office machine. Contain it immediately." },
    { title: "Large upload from the CAD server", source: "Data loss prevention", time: "18:05", answer: "escalate",
      log: "user       j.harlan (design engineer, resigned last week)\ndest       personal cloud storage\nsize       18 GB\nfiles      customer part drawings",
      why: "Likely insider data theft, which is a legal and HR matter as much as a security one. Escalate to HR and legal immediately and preserve the evidence." },
    { title: "Encoded PowerShell from Excel", source: "Endpoint protection", time: "09:14", answer: "real",
      log: "host       PURCH-WS-04\nparent     EXCEL.EXE\ncommand    powershell -nop -w hidden -enc JABjAD0AbgBlAHcA...",
      why: "Excel launching hidden, encoded PowerShell means a malicious spreadsheet. Isolate the machine." },
    { title: "Burst of failed logins", source: "Plant HMI", time: "06:02", answer: "fp",
      log: "account    line2_operator (shared)\nsource     HMI-LINE2\nfailures   300 in 4 minutes\nnote       password changed at the end of the last shift",
      why: "The line 2 screen retrying an old saved password after the shift change. Update it at the station; it isn’t an attack." },
    { title: "Regular calls to a new domain", source: "DNS", time: "01:00", answer: "real",
      log: "host       HISTORIAN-01 (plant data server)\ndomain     hallett-mes-sync.net\nregistered 3 days ago\npattern    every 5 minutes, all night",
      why: "A new domain dressed up to look like yours, contacted on a perfect timer from a plant server: malware checking in. Block it and isolate the historian." },
    { title: "New scheduled task on the ERP server", source: "Endpoint protection", time: "22:00", answer: "fp",
      log: "host       ERP-APP-01\ncreated by svc_backup\ntask       nightly export to backup server\nticket     CHG-1180, approved",
      why: "A backup job, created by the backup service account, with an approved change. Legitimate." },
    { title: "Impossible travel", source: "Identity provider", time: "08:15", answer: "fp",
      log: "user       d.cho (sales)\n07:40  sign-in  Detroit, MI\n08:15  sign-in  Hanover, Germany\ncalendar   trade show in Hanover this week\ndevice     managed laptop, compliant",
      why: "The sales rep is at a trade show in Germany, on a managed laptop. The Detroit sign-in was her phone syncing before its own location updated. A tuning candidate." },
    { title: "Impossible travel", source: "Identity provider", time: "10:02", answer: "real",
      log: "user       r.voss (purchasing manager)\n09:58  badge    entered the plant\n10:02  sign-in  Lagos, Nigeria  residential ISP\nuser agent python-requests/2.31",
      why: "She badged into the plant four minutes earlier, and the sign-in is from a script, not a browser. Her password is stolen. Revoke sessions and reset it." },

    /* ---------- More alerts, in matched pairs: one detail flips the answer ---------- */
    { title: "PLC switched to program mode", source: "Plant network monitor", time: "10:15", answer: "fp",
      log: "target     PLC-PRESS-1\nfrom       ENG-WS-1 (engineering station)\nuser       m.ortiz (controls engineer)\ncontext    spring shutdown; MOC-240 approved for a timer change",
      why: "A controls engineer changing a press program during the planned shutdown, with a management-of-change record. Legitimate." },
    { title: "PLC switched to program mode", source: "Plant network monitor", time: "13:40", answer: "real",
      log: "target     PLC-PRESS-1\nfrom       10.20.11.52 (office network: customer service)\naction     mode change to PROGRAM, then upload\ncontext    production running; no work order",
      why: "Nothing on the office network should ever change a running press’s PLC. An attacker or malware has reached the plant. Contain the office machine and get controls engineering on the floor." },
    { title: "USB device on an HMI", source: "Plant endpoint monitor", time: "07:30", answer: "fp",
      log: "host       HMI-LINE2\ndevice     USB drive, scanned at the kiosk 07:22 (clean)\nuser       line2 lead operator\npurpose    loading the new part program, work order WO-8812",
      why: "A drive scanned clean at the USB kiosk minutes earlier, used for a work order. That’s the process working." },
    { title: "USB device on an HMI", source: "Plant endpoint monitor", time: "22:10", answer: "real",
      log: "host       HMI-LINE4 (Windows XP)\ndevice     USB drive, never scanned\nevent      autorun launched setup.exe\ncontext    second shift; no work order",
      why: "An unscanned drive running a program automatically on an unpatchable HMI. Unplug it, isolate the HMI and check its neighbors." },
    { title: "Bulk export from the historian", source: "Historian", time: "15:00", answer: "fp",
      log: "user       q.hall (quality engineer)\nexported   12 months of line 3 temperature data\npurpose    customer quality report, request QR-311\nvolume     moderate, one CSV",
      why: "A quality engineer pulling process data for a documented customer request. Routine." },
    { title: "Bulk export from the historian", source: "Historian", time: "19:45", answer: "escalate",
      log: "user       p.dunn (process engineer, gave notice Monday)\nexported   every recipe and setpoint for all molding lines\ndestination personal cloud storage\nvolume     2 years of data",
      why: "A departing engineer exporting every recipe to personal storage could be trade-secret theft. It’s an HR and legal matter first: escalate and preserve the evidence." },
    { title: "Remote session into the plant", source: "Remote access gateway", time: "14:00", answer: "fp",
      log: "user       integrator: packaging line vendor\napproved   by r.ortega (maintenance supervisor), 13:55\nsession    recorded, 45 minutes, PKG-PLC-1 only\nticket     T-9021, conveyor fault",
      why: "An approved, recorded integrator session limited to the faulted line. That’s exactly how vendor access should work." },
    { title: "Remote session into the plant", source: "Remote access gateway", time: "02:10", answer: "real",
      log: "user       integrator: packaging line vendor\napproved   no one\nsource     country the vendor doesn’t operate in\nsession    browsing the engineering share and every PLC",
      why: "An unapproved session at 2 a.m. from an unusual country, roaming the whole plant. The vendor’s account is compromised. End it and disable the account." },
    { title: "Network scan from inside the plant", source: "Plant network monitor", time: "10:00", answer: "fp",
      log: "source     RAFAEL-LT (Rafael’s laptop)\ntool       passive asset discovery\nscope      plant VLANs\nticket     CHG-4410, quarterly asset inventory",
      why: "Rafael’s scheduled, ticketed asset inventory. Legitimate." },
    { title: "Network scan from inside the plant", source: "Plant network monitor", time: "23:30", answer: "real",
      log: "source     HMI-LINE4\npattern    probing every plant address on ports 445, 502 and 44818\nprocess    unknown, launched an hour ago",
      why: "An HMI scanning the plant for file shares and industrial protocols is infected and looking for its next target. Isolate it now." },
    { title: "Supplier bank details changed", source: "ERP", time: "11:20", answer: "real",
      log: "vendor     Midwest Steel Supply\nchange     remit-to bank account replaced\nby         ap.kgreene\nbasis      emailed request from the supplier’s address\ncallback   none recorded",
      why: "A bank change made from an email with no callback is how business email compromise steals six-figure payments. Freeze payments to that vendor until someone calls a known number." },
    { title: "Supplier bank details changed", source: "ERP", time: "11:20", answer: "fp",
      log: "vendor     Midwest Steel Supply\nchange     remit-to bank account replaced\nby         ap.kgreene\nbasis      bank letter on supplier letterhead\ncallback   confirmed with the supplier’s known contact, 10:55",
      why: "The same change, but verified by phone with a known contact first. That’s the control working." },
    { title: "Safety system bypass active", source: "Safety system log", time: "09:30", answer: "fp",
      log: "system     furnace burner management\nbypass     flame sensor 2, maintenance mode\npermit     safe work permit SWP-118, lockout applied\nexpires    11:30",
      why: "A permitted, time-limited bypass with lockout applied during maintenance. Legitimate, as long as it ends on time." },
    { title: "Safety system bypass active", source: "Safety system log", time: "01:50", answer: "escalate",
      log: "system     furnace burner management\nbypass     flame sensor 2\npermit     none found\nset by     shared night-shift account\nfurnace    running",
      why: "A safety bypass with no permit while the furnace runs is a safety emergency first. Escalate immediately to the shift supervisor and safety lead; don’t start with the network." },
    { title: "Outbound traffic from the MES server", source: "Firewall", time: "06:00", answer: "fp",
      log: "host       MES-APP-01\ndestination MES vendor’s license server\nschedule   daily at 06:00\nvolume     a few kilobytes",
      why: "The production system checking its license, as it does every morning. Expected." },
    { title: "Outbound traffic from the MES server", source: "Firewall", time: "03:15", answer: "real",
      log: "host       MES-APP-01\ndestination public paste site\nvolume     340 MB, compressed\nprocess    rar.exe, run by a service account",
      why: "Compressing data and uploading it to a paste site at 3 a.m. is data theft. Isolate the server and find the account that ran it." },
    { title: "HMI keeps rebooting", source: "Plant endpoint monitor", time: "22:05", answer: "fp",
      log: "host       HMI-LINE1\nevent      3 reboots\ncontext    patches installed during tonight’s planned shutdown window\nstatus     stable after the third reboot",
      why: "Patch reboots during the shutdown window. Normal, once it settles." },
    { title: "HMI keeps rebooting", source: "Plant endpoint monitor", time: "14:20", answer: "real",
      log: "hosts      HMI-LINE4, HMI-LINE5 (Windows XP)\nevent      repeated crashes and reboots\nnetwork    SMB connection attempts from an office PC just before each crash",
      why: "Unpatched HMIs crashing right after SMB connections from the office looks like a worm exploiting an old Windows flaw. Isolate the office PC and protect the remaining HMIs." },
    { title: "Door badge used after hours", source: "Badge system", time: "02:40", answer: "fp",
      log: "badge      maintenance tech, night shift\ndoor       maintenance shop entrance\nschedule   on the night maintenance roster",
      why: "A night-shift maintenance tech entering their own shop. Normal." },
    { title: "Door badge used after hours", source: "Badge system", time: "02:40", answer: "escalate",
      log: "badge      belongs to a machinist terminated last Friday\ndoor       side entrance near the tool crib\nstatus     badge never deactivated",
      why: "A fired employee’s badge opening a side door at night is a physical security issue. Escalate to the plant manager and security now, and deactivate the badge." },
    { title: "Mass check-out from the CAD vault", source: "CAD vault", time: "16:00", answer: "fp",
      log: "user       e.lopez (design engineer)\nchecked out 140 drawings\ncontext    engineering change order ECO-2291 for the bracket family\napproved   engineering manager",
      why: "An engineer checking out a drawing family for an approved change order. Routine." },
    { title: "Mass check-out from the CAD vault", source: "CAD vault", time: "23:10", answer: "real",
      log: "user       contractor.wbell (contract ended last month)\nchecked out 3,100 drawings, every customer\nsource     VPN, personal device\nchange order none",
      why: "An ex-contractor’s still-active account downloading every customer drawing at night. Disable it, preserve the logs and tell the owner: customers may need to know." },
    { title: "Supplier portal sign-in", source: "Supplier portal", time: "10:05", answer: "fp",
      log: "user       new account for Apex Fasteners\ncreated    by purchasing, ticket T-9050\nsource     supplier’s office, same city\naction     uploaded a quote",
      why: "A newly onboarded supplier uploading a quote from their office. Legitimate." },
    { title: "Supplier portal sign-in", source: "Supplier portal", time: "05:30", answer: "real",
      log: "user       buyer r.voss (purchasing manager)\nsource     residential ISP overseas\naction     changed payment terms for 6 suppliers\ncontext    she was badged into the plant 10 minutes later",
      why: "Someone overseas changing payment terms as the purchasing manager, while she’s walking into the plant. Her account is compromised. Revert the changes and reset her credentials." }
  ];
  plant.minigames = {
    schedule: { 1: "triage", 4: "triage", 7: "triage" },
    triage: {
      data: ALERTS, count: 4, // 12 alerts, 3 rounds: no repeats in a year
      intro: "Lena is buried. Help her clear the overnight alert queue: false positive, real threat, or escalate?",
      hint: S => S.tutorial && !S.seenTriage && (S.seenTriage = true) ? "<b>How triage works:</b> read the log details, not just the title. Two alerts with the same name can be completely different. <b>False positive</b> closes it, <b>real threat</b> starts containment, and <b>escalate</b> hands it to someone else to verify. On a plant floor, blocking the wrong thing can stop a machine, so escalating is sometimes the safe call. Each escalation costs Lena time and adds to her burnout." : "",
      good: "The queue is clear, and Lena turned two of the false positives into tuning rules.",
      bad: "The queue is clear, but some calls were wrong. Lena walked you through what she’d have done.",
      lesson: ["Alert triage", "Most alerts are noise. The skill is spotting what matters quickly, closing the rest with confidence, and knowing when a plant alert needs an engineer before an analyst acts."],
      reward(S, score, esc) {
        const gain = Math.round(score * 4); S.detect = clamp(S.detect + gain);
        team.burn("lena", esc * 2);
        return [`Detection rules +${gain}`].concat(esc ? [`Lena’s burnout +${esc * 2}`] : []);
      }
    }
  };

  /* ---------- Ransomware night wording ---------- */
  plant.finale = {
    title: "Ransomware night",
    times: ["11:48 PM", "12:02 AM", "12:15 AM", "12:29 AM", "12:41 AM", "12:54 AM", "1:04 AM", "1:12 AM"],
    intro: S => `During a thinly staffed stretch, the ${S.gang.name} gang turns its attention to ${ORG}. A skeleton crew is minding the plant, and they know it. They start with your weakest spot and keep going until something works.`,
    vectors: S => [
      { name: "a phishing email", p: 1 - (1 - sys.eff(S.filter)) * (1 - S.training / 100 * .8), hold: "The filter caught most copies, and the staff who saw it reported it.", fail: "A buyer opened a fake “purchase order” and entered her password on the page it led to." },
      { name: "the firewall", p: S.patch / 100, hold: "The firewall flaw they wanted was already patched.", fail: "They used a known firewall flaw. The fix had been out for weeks." },
      { name: "a stolen password", p: S.mfa ? .95 : .15, hold: "Multi-factor login asked for a code they didn’t have.", fail: "They logged in with an engineer’s password bought online. No second factor was required." },
      { name: "an integrator’s remote tool", p: S.gateway ? .95 : S.vendor >= 60 ? .85 : .3, hold: "The integrator connection they found only works through your approved gateway.", fail: "A machine builder’s always-on remote tool was still installed on a plant computer, with a password from 2017." },
      { name: "an old account", p: S.stale <= 3 ? .95 : .3, hold: "The forgotten accounts they hunted for were already disabled.", fail: `One of ${S.stale} accounts belonging to people who’d left still worked.` }
    ].concat(S.expanded ? [{ name: "line 5", p: S.done.line5 ? .9 : .2, hold: "Line 5 had been locked down after go-live.", fail: "Line 5’s robot controller still had its factory password, and the integrator’s laptop software was still installed." }] : []),
    zeroDay: { label: "They buy a zero-day.", fail: "With every door locked, they bought a brand-new flaw in the plant’s remote-access gateway. No patch exists yet." },
    luckyBlock: "It should have worked, but their tool crashed halfway through. <i>Lucky break.</i>",
    firstTry: "They got in on the first try, quietly.",
    decisionHint: "<b>Live decisions:</b> from here, you make the calls. There’s rarely a perfect answer. Broader containment is more certain but stops production; narrower containment is gentler but riskier. What you’ve built all year (detection, inventory, the plant boundary, backups, MDR) changes the odds.",
    beachhead: {
      clock: "1:20 AM", title: "The first machine",
      blocked: "Endpoint protection caught their tools the moment they ran and quarantined them. They lost their foothold before they had it.",
      lucky: "Their malware crashed on an outdated driver before it finished installing. The foothold is gone. That was too close.",
      failed: S => S.edr < 75 ? "Endpoint protection logged a warning but was still in alert-only mode on that machine. Their tools are running." : "Endpoint protection blocked one tool, but they disguised the next. They have a machine."
    },
    early: {
      clock: "1:40 AM", title: "The on-call phone buzzes",
      alert: S => S.mdr !== null && !S.mdrNoisy ? "The MDR provider calls: attacker tools are running on an engineering workstation, and the account is looking around both the office and plant networks." : "A detection rule fires: attacker tools are running on an engineering workstation, and the account is looking around both the office and plant networks.",
      options: [
        { id: "host", label: "Isolate that one workstation" },
        { id: "segment", label: "Cut the plant off from the office" },
        { id: "watch", label: "Watch them for an hour" }
      ],
      hostWin: "You isolated the workstation and disabled the account. A sweep confirmed they hadn’t reached anything else.",
      hostLose: "You isolated the workstation, but they had already moved to a second machine you didn’t know about.",
      segmentCare: -4,
      segmentCost: "Cutting the plant off from the office stopped the ERP feed, and the night shift worked from printed orders.",
      segmentWin: "It trapped them on the office side, away from the machines. Morning found a contained, boring mess.",
      segmentLose: "You cut the plant off, but they had already reached a server on the office side.",
      watchWin: "You watched them map the network, learned which accounts and tools they were using, then cut them all off at once. Textbook.",
      watchLose: "While you watched, they moved faster than expected and reached the servers."
    },
    contain: {
      clock: "3:10 AM", title: "They’re on the servers",
      alert: S => "An alert finally fires: backup snapshots are being deleted on the main servers, and someone is browsing the plant historian. Someone with admin rights is inside.",
      knownAlert: "They’re on the servers now, deleting backup snapshots. You know their accounts and tools from earlier tonight.",
      unseen: "Nobody is watching closely enough to notice them deleting backup snapshots. At 4:55 a.m., the encryption begins.",
      options: [
        { id: "plug", label: "Shut down the whole network" },
        { id: "targeted", label: "Targeted containment" },
        { id: "mdr", label: "Let the MDR team lead" }
      ],
      plugCare: -15,
      plugCost: "You shut down every network. The plant stopped for two days while each system was checked.",
      plugWin: "It worked. Nothing was encrypted.",
      plugLose: "Two servers were already encrypting before the cables came out.",
      targetedWin: "You disabled their accounts and isolated the servers they’d touched, one by one, without stopping the lines. Nothing was encrypted.",
      targetedLose: "You missed an account. They noticed what you were doing and started the encryption early.",
      mdrWin: "The MDR team isolated the affected servers within twenty minutes and walked Rafael through the rest.",
      mdrLose: "The MDR team couldn’t contain them fast enough."
    },
    encrypt: {
      clock: "5:30 AM", title: "The plant goes dark",
      body: S => `<p>The ERP, the scheduling system and the engineering file server are encrypted, and two HMIs on the plant floor show a ransom note from ${S.gang.name}. The morning shift arrives in an hour, and a customer’s rush order is due Friday.</p>`,
      safety: [{ id: "divert", label: "Keep the plant down until it’s clean" }, { id: "stay", label: "Restart lines on manual processes" }],
      divertCare: -10, divertText: "You kept the plant down while systems were checked, and told your customers why.",
      stayBadCare: -25, stayBad: "You restarted on manual processes. Without the scheduling system, a wrong temperature setting scrapped a full day of parts, and a press nearly ran without its interlock.",
      stayOkCare: -8, stayOk: "You restarted on manual processes. It was slow and messy, but the supervisors held it together.",
      restored: "Your backups were proven good. It took three days to restore the ERP and a week for everything else.",
      recoverClock: "9:00 AM", recoverTitle: "Recovery",
      noBackups: S => `<p>The backups are gone: snapshots deleted, the backup server encrypted too. The gang wants $1.8 million. Cyber insurance would cover most of it, after a $50,000 deductible from your budget.</p>`,
      recovery: [{ id: "pay", label: "Pay the ransom" }, { id: "rebuild", label: "Refuse and rebuild" }],
      deductible: 50000,
      paidWorks: "You paid. The decryptor was slow and buggy; the ERP came back in a week.",
      paidFails: "You paid. The decryptor failed on the ERP database, and you rebuilt it anyway.",
      rebuilt: "You refused. Rebuilding took three weeks of spreadsheets, missed shipments and very hard calls with customers."
    },
    lessons: {
      weakest: ["Weakest link", "Attackers look for your easiest way in, not your strongest defense."],
      assume: ["Assume breach", "Plan as if attackers will get in. Prevention buys time; detection, response and backups decide how bad it gets."],
      luck: ["Luck", "Sometimes things break your way. It isn’t a plan."],
      ransom: ["Paying the ransom", "Paying doesn’t guarantee recovery, funds criminals and marks you as a payer. Proven, protected backups are what let you refuse."]
    },
    results: {
      edr: { label: "Stopped on the first machine", bonus: 15, text: "By morning they’d moved on. You found the evidence in the logs over coffee.", fx: { trust: 6 }, lesson: ["Defense in depth", "When one layer fails, the next one can still stop the attack."] },
      luckyedr: { label: "Lucky break on the first machine", bonus: 8, text: "You found the crash logs the next morning and realized how close it was.", fx: { trust: 2 }, lesson: ["Defense in depth", "When one layer fails, the next one can still stop the attack."] },
      early: { label: "Contained one workstation", bonus: 15, text: "One workstation rebuilt, one account reset, and the lines never noticed.", fx: { trust: 5 }, lesson: ["Detection and response", "Catching an attacker on the first machine is the cheapest win there is."] },
      segment: { label: "Cut the plant off in time", bonus: 13, text: "One rough night shift on printed orders. The machines never saw the attackers.", fx: { trust: 4 }, lesson: ["Containment trade-offs", "Separating the plant from the office is blunt, but it protects the machines. Sometimes that’s the right price."] },
      watched: { label: "Watched, then evicted", bonus: 16, text: "Because you watched first, you got every foothold in one sweep.", fx: { trust: 6 }, lesson: ["Scoping before containing", "Cutting off attackers before you know their full footprint can leave footholds behind. Watching is powerful and risky."] },
      downtime: { label: "Shut down in time", bonus: 8, text: "Two days of stopped lines, but no ransomware, no ransom and no lost data.", fx: { trust: 2 }, lesson: ["Shutting down", "Shutting everything down is blunt but effective. Knowing how to stop and restart the plant safely is what makes it survivable."] },
      targeted: { label: "Targeted containment", bonus: 14, text: "Precise containment kept the lines running all night.", fx: { trust: 5 }, lesson: ["Detection and response", "Good detection and a well-mapped network let you contain precisely instead of stopping everything."] },
      mdrled: { label: "Contained by MDR", bonus: 12, text: "A few servers rebuilt and a long report from the MDR provider.", fx: { trust: 3 }, lesson: ["Detection and response", "A tuned MDR service brings round-the-clock expertise a small team can’t staff itself."] },
      restored: { label: "Encrypted, restored from backups", bonus: 4, text: "Painful, but you never had to consider paying.", fx: {}, lesson: ["Backups", "Proven, protected backups turn ransomware from a catastrophe into a terrible few weeks."] },
      paid: { label: "Paid the ransom", bonus: 0, text: "The owners have questions.", fx: {}, lesson: ["Backups", "Without proven, protected backups, every option is bad."] },
      rebuilt: { label: "Rebuilt from scratch", bonus: 0, text: "The owners have a lot of questions.", fx: {}, lesson: ["Backups", "Without proven, protected backups, every option is bad."] }
    }
  };

  mode.addSetting(plant);
})();
