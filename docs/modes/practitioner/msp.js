/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Practitioner setting: a 25-person managed service provider (MSP).
 * The core lesson is blast radius. The most dangerous systems are the shared
 * ones that touch every client: the RMM, admin access into client tenants,
 * and the credential vault (tier zero), plus the PSA, backup, EDR and remote
 * access consoles (tier one). Clients generate injects, but the team's real
 * job is protecting the machinery that reaches all of them at once.
 * Signature mechanics:
 *  - Tier-zero health: RMM hardening, admin access, the credential vault.
 *  - The client standard: every exception granted to keep a client happy
 *    weakens the standard stack.
 *  - A shared senior engineer, regularly pulled onto client projects. */
(function () {
  const S = FT.S, L = FT.learned, { chance, clamp, money, pick } = FT.util, sys = FT.sys;
  const mode = FT.modes.practitioner, team = mode.team;
  const ORG = "Keystone Managed IT";
  const CLIENTS = {
    dental: "Brightside Dental", law: "Hale & Ward LLP", fab: "Tri-County Fabrication",
    cpa: "Meridian Accounting", food: "Harbor Food Bank", startup: "Lumen Labs"
  };
  const addException = name => { S.exceptions = S.exceptions || []; if (!S.exceptions.includes(name)) S.exceptions.push(name); S.standard = clamp(S.standard - 12); };

  const msp = {
    id: "msp", letter: "K",
    name: "Managed service provider",
    short: "MSP",
    summary: "A 25-person MSP with about 70 clients. Your shared tools touch every client at once, so one mistake has a huge blast radius.",
    chief: "Rob Keane, owner",
    meters: [
      { key: "trust", label: "Owner trust", short: "Trust" },
      { key: "care", label: "Client health", short: "Clients" },
      { key: "morale", label: "Team morale", short: "Morale", value: () => team.morale() }
    ],
    months: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    landmarks: ["Annual planning","Insurance renewal","Quarterly reviews","New tool rollout","Big client onboarding","Price increase","Hiring season","Peer group conference","Quarterly reviews","Budget season","Holiday change freeze","Year-end"],
    winTitle: "You made it to year-end",
    startBudget: 70000,
    monthlyBudget: 7000,
    rewardScale: .7,
    mdrNote: ["SOC partner", "An outside security operations center watching your stack and every client around the clock. Tuned to your tools, it can tell your own technicians from attackers; untuned, it buries you in alerts."],
    briefing: `<b>Your new job:</b> security lead at ${ORG}: 25 people, about 70 clients and 2,500 endpoints, from dental offices to a small manufacturer. Your RMM, admin access and credential vault reach every one of them.`,
    irNote: "The incident plan meant nobody improvised: the owner knew which clients to call first, contracts were already pulled, and the client notification template was ready. That cut the damage.",
    orientation: "Glad you’re here. You know how this goes: our tools reach every client, and attackers know it too. Our RMM has never been properly hardened, techs share admin access into client tenants, and the password vault hasn’t been audited in years. Mateo is our other security person. Kris is our senior engineer for systems, networks and automation, but he’s shared with the service desk, so client projects will keep pulling him away.",

    newState() {
      // In about half of years, a private equity roll-up buys the MSP mid-year
      const r = FT.util.rand(), slot = [6, 7, 8][Math.floor(FT.util.rand() * 3)];
      return {
        midyearMonth: r < .5 ? slot : -1, platform: false,
        rmm: 35, adminAccess: 30, vault: 40, standard: 50, pam: false, immutable: false,
        exceptions: [CLIENTS.law], filter: 50, edr: 55, training: 35, vendor: 30, stale: 10, patch: 45,
        team: [
          { id: "you", name: "You", role: "Security lead", skill: "lead", cap: 2, burnout: 25 },
          { id: "mateo", name: "Mateo", role: "Security analyst", skill: "detect", cap: 2, burnout: 25 },
          { id: "kris", name: "Kris", role: "Senior engineer (shared)", skill: "infra", cap: 2, burnout: 35 }
        ]
      };
    },
    replacement(p) {
      const names = p.skill === "detect" ? ["Avery", "Nadia", "Sol"] : ["Dmitri", "Joy", "Theo"];
      return { name: pick(names), burnout: 10, newHire: 2, away: 0 };
    },
    // Kris is shared with the service desk: client work regularly pulls him away
    extraInterrupts(S) {
      if (!chance(S.platform ? .55 : .35)) return [];
      const jobs = [
        ["A client’s firewall replacement ran over, and Kris is finishing it.", "Finished a client firewall replacement that ran over."],
        ["The service desk escalated a client’s broken VPN to Kris.", "Fixed a client’s broken VPN for the service desk."],
        ["Sales promised a new client a server migration this month.", "Ran a server migration that sales promised a new client."],
        ["A client’s email migration hit a snag only Kris understands.", "Untangled a client’s stalled email migration."]
      ];
      const j = pick(jobs);
      return [{ who: "kris", text: `Client work: ${j[0]}`, done: j[1] }];
    },

    /* ---------- Mid-year: a private equity roll-up buys Keystone ---------- */
    midyear() {
      // If another big moment lands this month, postpone a month (or skip it if there's no room)
      if (S.month === S.mdrMonth || S.month === S.expandMonth || S.month >= S.finaleMonth) {
        S.midyearMonth = S.month + 1 < S.finaleMonth ? S.month + 1 : -1;
        return FT.screens.runEvent();
      }
      S.platform = true;
      S.budget = Math.round(S.budget * .6); S.budgetMult = (S.budgetMult || 1) * .6;
      S.trust = clamp(Math.min(S.trust, 50));
      const lesson = ["Private equity and security", "Profitability programs often cut security first, because its value is invisible until an incident. Making that value visible, in numbers, is part of the job."];
      FT.screens.choiceEvent({
        id: "buyout", title: "Keystone is sold",
        intro: "Rob sold Keystone to Apex Platform Partners, a private-equity-backed MSP roll-up. The new VP of operations announced a “profitability enhancement program”: your budget is cut 40% for the rest of the year, techs will carry more billable work, and you must find more savings. Either the SOC partner and in-progress security projects go, or one security role does.",
        choices: [
          { label: "Cut the tools and projects", run() {
            const lostProj = Object.keys(S.proj).length;
            S.mdr = null; S.mdrNoisy = false; S.mdrRamp = false; S.proj = {};
            return { text: `You cancelled the SOC partner${lostProj ? ` and shelved ${lostProj} in-progress project${lostProj > 1 ? "s" : ""}, losing the work already done` : ""}. The new leadership noted your cooperation.`, fx: { trust: 3, morale: -4 }, lesson };
          } },
          { label: "Eliminate Mateo’s position", run() {
            const p = team.member("mateo");
            if (p && !p.away) Object.assign(p, { away: 99, awayNote: "Position eliminated", replacement: null });
            return { text: "Mateo’s position was eliminated. He took it gracefully; the rest of the team didn’t. You now cover detection with two people, one of whom is shared with the service desk.", fx: { trust: 5, morale: -12 }, lesson };
          } },
          { label: "Push back with a risk briefing", run() {
            team.burn("you", 10);
            if (chance(.5)) { S.budgetMult = S.budgetMult / .6 * .8; return { text: "You walked the new VP through what one breach would cost across 70 clients, in dollars. They softened the cut to 20% and kept the team intact, for now.", fx: { trust: 2 }, lesson }; }
            S.mdr = null; S.mdrNoisy = false; S.mdrRamp = false; S.proj = {};
            return { text: "The new VP listened politely, then cut the SOC partner and your projects anyway. You’re now marked as “not a team player.”", fx: { trust: -6, morale: -4 }, lesson };
          } }
        ]
      });
    },

    /* ---------- MSP tasks ---------- */
    actions: [
      { id: "rmm", kind: "upkeep", skill: "infra", name: "Harden the RMM", desc: "MFA and IP limits on the console, script approval, tamper protection on agents.",
        apply: (S, k) => { S.rmm = clamp(S.rmm + Math.round(30 * k)); return "Hardened the RMM: tightened console access and script approval."; } },
      { id: "admins", kind: "upkeep", skill: "detect", name: "Audit admin access to client tenants", desc: "Who on your team can administer which clients, and do they still need it?",
        apply: (S, k) => { S.adminAccess = clamp(S.adminAccess + Math.round(30 * k)); return "Audited admin access across client tenants and removed what nobody needed."; } },
      { id: "vault", kind: "upkeep", skill: "infra", name: "Audit and rotate the credential vault", desc: "Find stale client passwords, rotate shared ones, check who can see what.",
        apply: (S, k) => { S.vault = clamp(S.vault + Math.round(30 * k)); return "Audited the credential vault and rotated a batch of shared client passwords."; } },
      { id: "standardize", kind: "upkeep", skill: "lead", name: "Bring a client onto the standard stack", desc: "Talk a holdout client into the standard security stack.",
        apply: (S, k) => { S.standard = clamp(S.standard + Math.round(15 * k)); if (S.exceptions && S.exceptions.length && chance(.5 * k)) { const c = S.exceptions.shift(); return `${c} agreed to the standard security stack. One less exception.`; } return "Moved another client onto the standard security stack."; } },
      { id: "pam", kind: "project", skill: "infra", cost: 30000, work: 4, name: "Just-in-time admin access", desc: "No standing admin rights into client tenants; techs request access per task.",
        done: S => { S.pam = true; S.adminAccess = Math.max(S.adminAccess, 75); return "Just-in-time admin access is live. Nobody holds standing admin rights into client tenants anymore."; } },
      { id: "immutable", kind: "project", skill: "infra", cost: 25000, work: 3, name: "Immutable backups for every client", desc: "Backups that can’t be deleted, even with your own admin credentials.",
        done: S => { S.immutable = true; return "Every client’s backups are now immutable: not even your own admin accounts can delete them."; } },
      { id: "migrate", kind: "project", skill: "infra", cost: 20000, work: 4, name: "Migrate the acquired clients", desc: "Move the acquired MSP’s clients onto your stack and retire their old tools.", show: S => S.expanded,
        done: S => { S.stale = Math.max(0, S.stale - 5); return "The acquired clients are fully migrated, and the old MSP’s tools are switched off."; } }
    ],

    monthEnd(S) {
      const d = n => Math.round(n * S.diff.decay);
      S.patch = clamp(S.patch - d(15));
      S.rmm = clamp(S.rmm - d(8));
      S.adminAccess = clamp(S.adminAccess - d(S.pam ? 3 : 10));
      S.vault = clamp(S.vault - d(6));
      S.standard = clamp(S.standard - d(4));
      S.backupAge++; if (S.backupAge > 2) S.backupTested = false;
      S.training = clamp(S.training - d(5));
      S.detect = clamp(S.detect - d(5));
      S.inventory = clamp(S.inventory - d(5));
      S.vendor = clamp(S.vendor - d(5));
      S.stale = Math.min(20, S.stale + d(3));
      // A neglected tier zero quietly costs client confidence every month
      const weak = [S.rmm, S.adminAccess, S.vault].filter(v => v < 40).length;
      if (weak >= 2) { S.care = clamp(S.care - weak); S.trust = clamp(S.trust - 1); }
    },

    /* ---------- Status board: the shared stack first ---------- */
    dashboard(S) {
      const lvl = (v, g, o) => v >= g ? "good" : v >= o ? "warn" : "bad";
      const rows = [
        ["RMM hardening", lvl(S.rmm, 70, 40), S.rmm >= 70 ? "Locked down" : S.rmm >= 40 ? "Partly hardened" : "Wide open"],
        ["Admin access to clients", lvl(S.adminAccess, 70, 40), (S.adminAccess >= 70 ? "Least privilege" : S.adminAccess >= 40 ? "Some standing access" : "Everyone is admin everywhere") + (S.pam ? ", just-in-time" : "")],
        ["Credential vault", lvl(S.vault, 70, 40), S.vault >= 70 ? "Audited" : S.vault >= 40 ? "Getting stale" : "Years of old passwords"],
        ["Client standard", lvl(S.standard, 70, 40), `${S.standard >= 70 ? "Most clients" : S.standard >= 40 ? "About half" : "Few clients"} on the standard stack`],
        ["Client exceptions", !(S.exceptions || []).length ? "good" : S.exceptions.length <= 1 ? "warn" : "bad", (S.exceptions || []).length ? S.exceptions.join(", ") : "None"],
        ["Client backups", S.backupTested ? "good" : "bad", (S.backupTested ? (S.backupAge === 0 ? "Restore tested this month" : `Restore tested ${S.backupAge} month${S.backupAge > 1 ? "s" : ""} ago`) : "Restore not tested recently") + (S.immutable ? ", immutable" : "")],
        ["Patching", lvl(S.patch, 70, 40), S.patch >= 70 ? "Current" : S.patch >= 40 ? "Falling behind" : "Badly behind"],
        ["Detection rules", lvl(S.detect, 70, 40), S.detect >= 70 ? "Watching tool activity" : S.detect >= 40 ? "Drifting" : "Blind to tech activity"],
        ["Endpoint protection", lvl(S.edr, 75, 50), S.edr >= 75 ? `Well tuned (${S.edr}%)` : `Partly tuned (${S.edr}%)`],
        ["Multi-factor login", S.mfa ? "good" : "bad", S.mfa ? "On every tool" : "Not on every tool"],
        ["Offboarding", S.stale <= 3 ? "good" : S.stale <= 9 ? "warn" : "bad", S.stale === 0 ? "Clean" : `${S.stale} stale accounts (techs and old clients)`],
        ["Incident plan", S.irPlan ? "good" : "bad", S.irPlan ? "Written and tested" : "None"]
      ];
      if (S.expanded) rows.push(["Acquired clients", S.done.migrate ? "good" : "bad", S.done.migrate ? "Migrated" : "Still on the old MSP’s tools"]);
      if (S.mdr !== null || S.month > S.mdrMonth) rows.push(["SOC partner", S.mdr === null ? "bad" : S.mdrNoisy ? "warn" : S.mdr >= 80 ? "good" : "warn", S.mdr === null ? "None" : S.mdrRamp ? "Onboarding" : S.mdr >= 80 ? `Tuned to your stack (${S.mdr}%)` : S.mdrNoisy ? `Default settings, noisy (${S.mdr}%)` : `Self-tuned (${S.mdr}%)`]);
      return rows;
    },
    explain: {
      "RMM hardening": "Tier zero. The RMM can run anything on every client machine. MFA, IP limits, script approval and tamper protection decide whether an attacker can use it.",
      "Admin access to clients": "Tier zero. How much standing admin access your techs hold in client tenants. Least privilege and just-in-time access shrink the blast radius.",
      "Credential vault": "Tier zero. The documentation platform holding every client’s passwords. Audit who can see what and rotate what’s stale.",
      "Client standard": "How many clients run your standard security stack. Exceptions creep in every month.",
      "Client exceptions": "Clients granted exceptions to the standard stack, usually to keep them happy.",
      "Client backups": "Proven by restore tests. Immutable backups can’t be deleted even with your own admin credentials.",
      "Patching": "Your own systems and clients’ endpoints.",
      "Detection rules": "Whether you’d notice unusual activity by your own tools and technicians.",
      "Endpoint protection": "The EDR you deploy to client endpoints, managed from one console.",
      "Multi-factor login": "On every tool: RMM, PSA, vault, backup and remote access consoles.",
      "Offboarding": "Accounts for departed technicians, and your access into clients who left.",
      "Incident plan": "Who calls which clients, what contracts say, and how to shut down shared tools safely.",
      "Acquired clients": "Clients from the MSP you bought, still on its old, unknown tools.",
      "SOC partner": "An outside security operations center watching your stack and clients around the clock."
    },

    threatWarning(S) {
      if (!(S.month >= S.finaleMonth - 3 && S.month < S.finaleMonth)) return "";
      return `<div class="intel"><b>MSP peer group alert:</b> The ${S.gang.name} gang has compromised ${5 - (S.finaleMonth - S.month)} MSPs this year. They go after RMM and admin access, then push ransomware to every client at once.</div>`;
    },

    deaths: {
      ransomware: "Your MSP has died of ransomware. Clients are leaving, and the owner is selling what’s left of the book.",
      care: "Clients are leaving in droves. The owner is selling the book of business.",
      trust: "The owner brought in an outside security firm. Your contract was not renewed."
    },

    /* ---------- Mid-year offer: a SOC partner ---------- */
    mdrOffer() {
      const pro = 25000, canPro = S.budget >= pro, title = "A SOC partner";
      FT.ui.screen(`<div class="panel"><h2>${title}</h2>
        <p>Your distributor is offering a year of a <b>24/7 security operations center (SOC) partner</b> at cost, covering your stack and every client, if you sign this month. It also gives you a new service to sell.</p>
        <p>Their onboarding team will tune it to your tools and clients for a fee from your budget. Or your team can onboard it.</p>
        <div class="opts">
          <button class="opt choice" data-c="pro" ${canPro ? "" : "disabled"}><div><b>Sign, with partner onboarding</b><small>Tuned to your RMM, PSA and clients. About 85% effective from next month.${canPro ? "" : " Your budget can’t cover this right now."}</small></div><span class="cost">${money(pro)}</span></button>
          <button class="opt choice" data-c="self"><div><b>Sign, onboard it yourselves</b><small>Free, but default settings, about 35% effective, and Mateo buried in alerts from 70 clients until it’s tuned.</small></div><span class="cost">$0</span></button>
          <button class="opt choice" data-c="no"><div><b>Pass</b><small>One less thing for a stretched team.</small></div><span class="cost">$0</span></button>
        </div></div>`, "button[data-c]:not(:disabled)");
      FT.app.querySelectorAll("button[data-c]").forEach(b => b.onclick = () => {
        const c = b.dataset.c; let r; FT.note(title, `Chose: ${b.querySelector("b").textContent}.`);
        if (c === "pro") { S.budget -= pro; S.mdr = 40; S.mdrRamp = true; S.mdrNoisy = false;
          r = { text: "The partner’s team spent two weeks with Mateo learning your stack: which RMM scripts run when, which techs work which clients, what normal looks like at 70 different businesses.", fx: { morale: -2 }, lesson: ["Professional services", "Paying experts to set up a tool properly often matters as much as the tool itself."] }; }
        else if (c === "self") { S.mdr = 35; S.mdrNoisy = true;
          r = { text: "Kris connected it to every client over a weekend. It works, sort of. Mateo now gets about 200 alerts a day, most of them your own RMM doing its normal job.", fx: { morale: -5 }, lesson: ["Alert fatigue", "A badly tuned tool buries real warnings under false alarms, and at an MSP, your own tools look exactly like attackers."] }; }
        else r = { text: "You passed. Rob shrugged; it was one less thing to sell.", fx: { trust: -2 }, lesson: ["Opportunity cost", "Every choice has a price, including saying no."] };
        L.set(...msp.mdrNote);
        FT.screens.outcome(title, r);
      });
    },

    /* ---------- The guided first month ---------- */
    tutorial: {
      tips: [
        { target: "dash", text: "This is the security status board. The top three lines are tier zero: the RMM, admin access into client tenants, and the credential vault. Each of them reaches every client at once. That’s the blast radius, and it’s what attackers who target MSPs are after." },
        { target: "team", text: "This is your team. Each person gets two tasks a month. A ★ marks their specialty: Mateo is detection, Kris is systems and automation, and you’re leadership. Kris is shared with the service desk, so client projects will often take one of his slots before you get to plan." },
        { target: "team", text: "Watch the burnout number next to each name. It creeps up every month, and overtime or a bad incident pushes it up fast. Past 65 they work slower, past 80 their work starts slipping, and past about 85 they may resign, and replacing them takes two months. <b>Time off</b> is in everyone’s task list." },
        { target: "budget", text: "Projects like just-in-time admin access take several person-months and only pay off once finished. You pay when you start one. Your committed spending is shown here." },
        { target: "team", text: "Client requests will keep pulling you toward individual clients. Resist it when you can: the shared stack protects all 70 at once. My suggestion: Kris hardens the RMM and audits the vault, Mateo audits admin access and tunes detection, and you start enforcing MFA on every tool and bring a holdout client onto the standard stack." }
      ],
      suggested: { you: ["mfa", "standardize"], mateo: ["admins", "tunedetect"], kris: ["rmm", "vault"] },
      report: "This is the change report: what each person did, and anything that broke. At an MSP, a bad change can hit every client at once, so it’s worth reading every month.",
      monthNotes: {
        1: "Look at the burnout numbers before assigning anything, especially Kris’s. He’s carrying client work too.",
        2: "If a project is in progress, keep someone on it. Half-finished just-in-time access still leaves standing admin rights."
      }
    }
  };

  /* ---------- Unplanned work specific to an MSP ---------- */
  msp.interrupts = [
    { skill: "lead", text: "A client’s cyber insurer wants evidence of your controls by Friday.", done: "Sent a client’s insurer evidence of your security controls." },
    { skill: "detect", text: "A client forwarded 40 suspicious emails and wants answers today.", done: "Triaged 40 suspicious emails a client forwarded." },
    { skill: "lead", text: "A prospect wants a security review call before they’ll sign.", done: "Took a prospect’s security review call to help close the deal." }
  ];

  /* ---------- Mid-year expansion: buying a smaller MSP ---------- */
  const rollup = ["Acquiring an MSP", "When you buy an MSP, you inherit its tools, its access into every client, and its old technicians’ accounts. Until you migrate, all of that is your attack surface."];
  msp.expansion = {
    id: "acquire", title: "Rob buys a smaller MSP",
    intro: "Rob is buying a retiring owner’s MSP: 18 clients, its own RMM, its own password vault, and three technicians who aren’t staying. The clients transfer next week.",
    choices: [
      { label: "Lock down their tools first ($20,000)", run() {
        S.budget -= Math.min(20000, Math.max(0, S.budget)); S.proj.migrate = 1; S.stale += 4;
        return { text: "Before the transfer, Kris disabled the departing techs’ accounts, reset the old RMM’s admin credentials and put it behind MFA. Rob grumbled about the delay. Migrating the clients is already under way.", fx: { trust: -2 }, lesson: rollup };
      } },
      { label: "Transfer now, migrate later", run() {
        S.stale += 10; S.vendor = clamp(S.vendor - 15);
        return { text: "The clients transferred on schedule, and Rob was thrilled. Their old RMM is still running, with three departed techs’ accounts still active. Migrating is now a project on your list.", fx: { trust: 3 }, lesson: rollup };
      } }
    ]
  };

  /* ---------- Events ---------- */
  const blast = ["Blast radius", "At an MSP, a compromised tool or technician account reaches every client at once. Protecting the shared stack protects all of them."];
  msp.events = [
    { id: "techphish", title: "A technician’s account is phished", run() {
      if (S.mfa && S.adminAccess >= 50) return { text: "A help desk tech entered his password on a fake RMM login page. Multi-factor login stopped the attacker, and his access into clients was limited anyway.", fx: { trust: 2 }, lesson: blast };
      if (S.mfa) return { text: "A help desk tech entered his password on a fake RMM login page. Multi-factor login stopped the attacker this time, but Mateo noticed that account had admin rights in 60 client tenants.", fx: { morale: -2 }, lesson: blast };
      return { text: `A help desk tech entered his password on a fake RMM login page. Within the hour, the attacker used it to run a script on machines at ${CLIENTS.dental} and ${CLIENTS.cpa}. You caught it before encryption, barely.`, fx: { trust: -15, care: -14, morale: -6 }, lesson: blast };
    } },
    { id: "lawmfa", title: "The law firm wants an exception", intro: `${CLIENTS.law}’s managing partner refuses multi-factor login for the partners. “We bill by the minute.” They’re one of your biggest clients.`, choices: [
      { label: "Hold the line", run() {
        if (chance(.3)) return { text: "They threatened to leave, and Rob had to smooth it over personally. They stayed, grudgingly, with MFA on.", fx: { care: -3, trust: -2 }, lesson: ["The standard stack", "Exceptions granted to keep clients happy are where breaches start. Holding the line protects them, and you."] };
        return { text: "You walked the partners through phone sign-in in person. Two weeks later, nobody remembered complaining.", fx: { trust: 2 }, lesson: ["The standard stack", "Exceptions granted to keep clients happy are where breaches start. Holding the line protects them, and you."] }; } },
      { label: "Grant the exception", run() { addException(CLIENTS.law); return { text: "Granted. The partners are happy, and their accounts are now the softest target in your client base.", fx: { care: 2 }, lesson: ["The standard stack", "Exceptions granted to keep clients happy are where breaches start."] }; } }
    ] },
    { id: "rmmzero", title: "An RMM zero-day", intro: "Your RMM vendor disclosed a flaw attackers are already using against MSPs. The fix is out tomorrow. Until then, the advice is to shut the RMM down.", choices: [
      { label: "Shut the RMM down until it’s patched", run() { S.rmm = clamp(S.rmm + 15); return { text: "You shut it down for 30 hours. The service desk worked through remote sessions and phone calls, and clients noticed slower support.", fx: { care: -5 }, lesson: ["Tier-zero tools", "When the tool that reaches every client is being exploited, a day of slow support is cheap."] }; } },
      { label: "Keep it running", run() {
        if (S.rmm < 60 && chance(.6)) return { text: `Attackers used the flaw that night and pushed ransomware to two clients, ${CLIENTS.fab} and ${CLIENTS.food}, before you pulled the plug.`, fx: { care: -18, trust: -12, morale: -6 }, lesson: ["Tier-zero tools", "When the tool that reaches every client is being exploited, a day of slow support is cheap."] };
        return { text: "Nobody hit you before the patch. Your RMM’s IP restrictions probably helped.", fx: {}, lesson: ["Tier-zero tools", "Leaving an exploited tier-zero tool running is a gamble with every client at once."] }; } }
    ] },
    { id: "departedtech", title: "A technician leaves angry", run() {
      if (S.stale <= 3) return { text: "A technician quit after a pay dispute. His access to the RMM, the vault and every client tenant was disabled before he reached the parking lot.", fx: { trust: 2 }, lesson: ["Offboarding at an MSP", "A departing tech can hold keys to every client. Offboarding has to cover every tool and every tenant, immediately."] };
      return { text: "A technician quit after a pay dispute. A week later, he logged into the credential vault from home and exported client passwords. Several clients had to be told.", fx: { trust: -14, care: -8 }, lesson: ["Offboarding at an MSP", "A departing tech can hold keys to every client. Offboarding has to cover every tool and every tenant, immediately."] };
    } },
    { id: "exclient", title: "A former client is breached", run() {
      if (S.stale <= 5) return { text: "A client who left last spring was breached. Their new MSP asked whether your old admin account was involved. It had been removed the day they left.", fx: { trust: 2 }, lesson: ["Offboarding clients", "When a client leaves, every account, agent and connection you had into them has to go too."] };
      return { text: "A client who left last spring was breached, through an admin account you never removed. Their lawyers are now talking to Rob.", fx: { trust: -10, care: -4 }, lesson: ["Offboarding clients", "When a client leaves, every account, agent and connection you had into them has to go too."] };
    } },
    { id: "startup", title: "A new client arrives with a mess", intro: `${CLIENTS.startup}, a fast-growing startup, just signed. They have 40 laptops with no management, shared admin passwords and three cloud accounts nobody owns. They want onboarding done this week.`, choices: [
      { label: "Onboard them onto the standard stack", run() { team.burn("you", 8); team.burn("kris", 6); S.standard = clamp(S.standard + 5);
        return { text: "It took three weeks instead of one, and the founder complained loudly. But they’re on the standard stack from day one.", fx: { care: -2 }, lesson: ["Onboarding to the standard", "Onboarding is the cheapest moment to get a client onto your standard. It never gets easier later."] }; } },
      { label: "Onboard them as they are, fix it later", run() { addException(CLIENTS.startup);
        return { text: "Onboarded in a week. The founder is delighted, and you now support 40 unmanaged laptops with shared admin passwords.", fx: { care: 3 }, lesson: ["Onboarding to the standard", "Onboarding is the cheapest moment to get a client onto your standard. It never gets easier later."] }; } }
    ] },
    { id: "docbreach", title: "Your documentation platform was breached", lessonPre: ["Third-party risk", "Your documentation platform holds every client’s passwords. Its breach is everyone’s breach."], intro: "Your documentation platform vendor disclosed a breach. They say client vaults were encrypted, but they aren’t sure about older records.", choices: [
      { label: "Rotate every client credential now", run() { team.burn("kris", 12); team.burn("mateo", 10); S.vault = clamp(S.vault + 25);
        return { text: "The team spent ten brutal days rotating thousands of client passwords and keys. Nothing was used against you.", fx: { care: -2, trust: 4 }, lesson: ["Third-party risk", "When the vault holding every client’s keys is breached, rotate everything. It’s miserable, and it’s right."] }; } },
      { label: "Wait for the vendor’s findings", run() {
        if (S.vault < 60 || chance(.35)) return { text: "Before the vendor finished investigating, attackers used an old firewall password from your vault to get into a client.", fx: { trust: -12, care: -8 }, lesson: ["Third-party risk", "When the vault holding every client’s keys is breached, rotate everything."] };
        return { text: "The vendor confirmed old records were safe. You rotated the most critical credentials anyway.", fx: {}, lesson: ["Third-party risk", "Waiting on a vendor’s investigation is a gamble with every client’s keys."] }; } }
    ] },
    { id: "taxfreeze", title: "Tax season freeze", intro: `${CLIENTS.cpa} insists on no changes, including patches, from February through April 15. Their tax software vendor says updates “might break things.”`, choices: [
      { label: "Agree, with compensating controls", run() { team.burn("mateo", 6); return { text: "You agreed to defer patches but added extra monitoring on their systems until April. Mateo watched them closely.", fx: { care: 2 }, lesson: ["Compensating controls", "When you can’t patch, watch harder and limit exposure until you can."] }; } },
      { label: "Patch anyway", run() {
        if (chance(.35)) return { text: "A patch broke their tax software in the middle of March. The firm lost two days and is now shopping for a new MSP.", fx: { care: -10, trust: -4 }, lesson: ["Client context", "Security changes that ignore a client’s business calendar can cost you the client."] };
        return { text: "The patches went in without trouble. The partners never noticed.", fx: { care: -1 }, lesson: ["Client context", "Security changes that ignore a client’s business calendar can cost you the client."] }; } }
    ] },
    { id: "mspinsurance", title: "Your own cyber insurance renewal", run() {
      const good = (S.mfa ? 1 : 0) + (S.irPlan ? 1 : 0) + (S.backupTested ? 1 : 0) + (S.rmm >= 60 ? 1 : 0);
      if (good >= 3) return { text: "The insurer’s MSP questionnaire asked about MFA on every tool, RMM hardening, tested backups and an incident plan. You had evidence for all of it. The premium went down.", fx: { trust: 5, budget: 5000 }, lesson: ["Insurers know MSPs", "Insurers ask MSPs pointed questions about tier-zero tools, because MSP breaches are so expensive."] };
      return { text: "The insurer’s MSP questionnaire asked about MFA on every tool, RMM hardening, tested backups and an incident plan. You had gaps. The premium nearly doubled, and RMM-related claims are now excluded.", fx: { trust: -8, budget: -10000 }, lesson: ["Insurers know MSPs", "Insurers ask MSPs pointed questions about tier-zero tools, because MSP breaches are so expensive."] };
    } },
    { id: "blamelogs", title: "“Your tech did this”", run() {
      if (S.detect >= 50) return { text: `${CLIENTS.fab}’s owner blamed one of your techs for deleting a shared drive. Your logs of technician activity showed it was their own office manager.`, fx: { trust: 4 }, lesson: ["Logging tech activity", "Recording what your own technicians do protects clients from bad techs, and protects your techs from false blame."] };
      return { text: `${CLIENTS.fab}’s owner blamed one of your techs for deleting a shared drive. You didn’t have logs to show otherwise, so you ate the cost of recovery.`, fx: { trust: -6, care: -4, budget: -5000 }, lesson: ["Logging tech activity", "Recording what your own technicians do protects clients from bad techs, and protects your techs from false blame."] };
    } },
    { id: "badscript", title: "A script goes to everyone", run() {
      if (S.rmm >= 60) return { text: "A tech’s new cleanup script had a bug that deleted user profiles. Script approval caught it in the test group, on two of your own machines.", fx: { trust: 2 }, lesson: ["Change control for tools", "Anything your RMM can do to one machine, it can do to every client. Test groups and approval are your brakes."] };
      return { text: "A tech pushed a buggy cleanup script to every client at 10 a.m. It deleted user profiles on 300 machines across 11 clients.", fx: { care: -15, trust: -8, morale: -6 }, lesson: ["Change control for tools", "Anything your RMM can do to one machine, it can do to every client. Test groups and approval are your brakes."] };
    } },
    { id: "foodbank", title: "The food bank can’t afford security", intro: `${CLIENTS.food} lost a grant and can’t pay for the security add-ons anymore. They want to drop to basic support.`, choices: [
      { label: "Keep them protected at cost ($6,000)", run() { S.budget -= 6000; return { text: "You covered the gap from your budget. Rob mentioned it at the next leadership meeting, but the food bank stayed protected.", fx: { care: 3, trust: -1 }, lesson: ["Security for small clients", "The clients least able to pay for security are often the ones who can least survive a breach."] }; } },
      { label: "Let them drop to basic", run() { addException(CLIENTS.food); return { text: "They dropped to basic support. Their endpoints and email are now unprotected.", fx: {}, lesson: ["Security for small clients", "The clients least able to pay for security are often the ones who can least survive a breach."] }; } }
    ] },
    { id: "fakesupport", title: "Someone pretending to be you", run() {
      if (S.training >= 55) return { text: `Callers claiming to be from ${ORG} asked ${CLIENTS.dental}’s staff to install a “support tool.” Staff had been briefed in your client newsletter and hung up.`, fx: { trust: 3 }, lesson: ["MSP impersonation", "Attackers impersonate MSPs to get remote access. Teach clients how you’ll really contact them."] };
      return { text: `Callers claiming to be from ${ORG} talked ${CLIENTS.dental}’s front desk into installing a remote-access tool. The attackers spent a day in their patient records.`, fx: { care: -8, trust: -6 }, lesson: ["MSP impersonation", "Attackers impersonate MSPs to get remote access. Teach clients how you’ll really contact them."] };
    } },
    { id: "clientransom", title: "Ransomware at one client", run() {
      if (S.edr >= 70 && S.standard >= 50) return { text: `A ${CLIENTS.dental} employee opened a malicious attachment. Endpoint protection stopped the ransomware on the first machine.`, fx: { trust: 2 }, lesson: ["The standard stack pays", "When every client runs the same well-tuned protection, one client’s mistake stays small."] };
      if (sys.backupsGood()) return { text: `Ransomware hit ${CLIENTS.dental}. Their backups had just been restore-tested, so they were seeing patients again in a day.`, fx: { care: -4, morale: -3 }, lesson: ["Backups", "Proven backups turn a client’s ransomware from a business-ending event into a bad day."] };
      return { text: `Ransomware hit ${CLIENTS.dental}. Their backups hadn’t been tested, and two days of appointments were lost.`, fx: { care: -10, trust: -5, morale: -4 }, lesson: ["Backups", "Proven backups turn a client’s ransomware from a business-ending event into a bad day."] };
    } },
    { id: "oldrmm", title: "The acquired MSP’s old RMM", available: S => S.expanded && !S.done.migrate, run() {
      return { text: "Attackers found the acquired MSP’s old RMM exposed to the internet with a departed tech’s password. They pushed a script to four of the acquired clients before Kris shut it down.", fx: { care: -10, trust: -8 }, lesson: rollup };
    } },
    { id: "recruiter", title: "Mateo gets an offer", run: null },
    { id: "quiet", title: "A quiet month", run() { return { text: "No client fires, no escalations, no surprise questionnaires. Your team almost got to finish their own work.", fx: { morale: 6 }, lesson: ["Invisible wins", "When security works, nothing happens, which makes it hard to notice. That’s normal."] }; } }
  ];

  Object.assign(msp.events.find(e => e.id === "recruiter"), {
    run: undefined,
    available: S => { const p = team.member("mateo"); return p && !p.away && !p.newHire && p.name === "Mateo"; },
    intro: "A large security provider offered Mateo a job: more pay, a bigger team, and no client phone calls. He told you before deciding.",
    choices: [
      { label: "Fight for a retention raise", run() {
        if (S.budget < 15000) { leave(); return { text: "You couldn’t find the money in your budget. Mateo took the job.", fx: { morale: -8 }, lesson: ["Retention", "Replacing a skilled analyst costs far more than keeping one, and takes months."] }; }
        S.budget -= 15000; team.burn("mateo", -20);
        return { text: "You spent $15,000 of your budget on a retention raise and got Rob to agree to a saner on-call rotation. He stayed.", fx: { trust: -1 }, lesson: ["Retention", "Replacing a skilled analyst costs far more than keeping one, and takes months."] }; } },
      { label: "Wish him well", run() { leave(); return { text: "Mateo took the job. The team threw him a goodbye lunch, then went back to splitting his work.", fx: { morale: -8 }, lesson: ["Retention", "Replacing a skilled analyst costs far more than keeping one, and takes months."] }; } }
    ]
  });
  function leave() {
    const p = team.member("mateo");
    if (p && !p.away) Object.assign(p, { away: 3, awayNote: "Position open", replacement: msp.replacement(p) });
  }

  /* ---------- Alert triage ---------- */
  const ALERTS = [
    { title: "Script pushed to many clients", source: "RMM audit log", time: "02:14", answer: "real",
      log: "account    tech.jlee\nscript     new, unsigned (\"cleanup.ps1\")\ntargets    1,180 endpoints across 34 clients\nticket     none\nsource IP  residential ISP, not the office",
      why: "An unsigned new script to a third of your clients at 2 a.m., from a home connection, with no ticket. That’s an attacker using a tech’s account. Kill the job, disable the account, lock the RMM." },
    { title: "Script pushed to many clients", source: "RMM audit log", time: "22:00", answer: "fp",
      log: "account    svc-patching\nscript     monthly patch run (signed, approved)\ntargets    2,400 endpoints, all clients\nticket     CHG-2210, approved Monday\nschedule   same window every month",
      why: "The scheduled monthly patch run, signed, approved and in its usual window. Legitimate." },
    { title: "Global admin created in client tenants", source: "Cloud admin audit", time: "03:40", answer: "real",
      log: "action     new global admin “support-admin2”\ntenants    5 clients\nvia        your partner admin relationship\nby         tech.mpatel\nsource     VPN exit node, Eastern Europe",
      why: "New top-level admins in five client tenants, created through your own partner access from an anonymizing network. That’s your access being used against your clients. Revoke it now." },
    { title: "New admin in a client tenant", source: "Cloud admin audit", time: "10:20", answer: "fp",
      log: "action     temporary admin role granted\ntenant     Meridian Accounting\nby         just-in-time request, tech.kris\nticket     T-55102, approved\nexpires    in 4 hours",
      why: "A just-in-time admin request with a ticket and an expiry. That’s how it’s supposed to work." },
    { title: "Vault export", source: "Documentation platform", time: "03:05", answer: "real",
      log: "user       tech.rdiaz\naction     exported all client passwords (CSV)\nentries    6,412\nsource     personal laptop\nnote       resignation submitted yesterday",
      why: "A departing tech exporting every client password at 3 a.m. to a personal laptop. Disable the account, start rotating, and loop in leadership." },
    { title: "RMM agents removed at a client", source: "RMM", time: "16:45", answer: "escalate",
      log: "client     Lumen Labs\nevent      agent uninstalled on 22 of 40 endpoints\nby         local admin accounts on each machine\nnote       client’s contract renewal is next month",
      why: "Could be an attacker removing your visibility, or the client quietly moving to another MSP. Escalate to the account manager and the client before acting." },
    { title: "Backup jobs deleted", source: "Backup console", time: "01:30", answer: "real",
      log: "action     retention changed to 0 days, jobs deleted\nclients    12\nby         admin console account “backup-admin”\nsource     unrecognized IP",
      why: "Deleting backups across many clients is what ransomware crews do right before encrypting. Lock the backup console and start incident response." },
    { title: "Burst of failed logins", source: "PSA", time: "08:02", answer: "fp",
      log: "account    help desk kiosk\nfailures   250 in 3 minutes\nsource     office kiosk\nnote       PSA password rotated last night",
      why: "The help desk kiosk retrying last night’s rotated password. Update it; it isn’t an attack." },
    { title: "Mailbox forwarding rule", source: "Client email security", time: "09:12", answer: "real",
      log: "client     Hale & Ward LLP\nmailbox    partner.ward\nrule       forward all mail containing “invoice” or “wire” to an outside address\ncreated    from a new device, 06:40",
      why: "A hidden forwarding rule for invoices and wires: a classic business email compromise in progress at your client. Remove the rule, reset the account, and warn their finance team." },
    { title: "Endpoint protection disabled", source: "EDR console", time: "14:10", answer: "fp",
      log: "client     Tri-County Fabrication\nhost       CNC-PROG-02\nchange     protection paused 1 hour\nby         tech.kris\nticket     T-55188, CNC software install",
      why: "A named engineer pausing protection briefly for a ticketed software install. Fine, as long as it comes back on." },
    { title: "Remote session by an unknown tech", source: "Remote access", time: "19:30", answer: "real",
      log: "client     Brightside Dental\ntechnician “support_mike” (not on your staff list)\nsession    started from a shared invite link\nduration   45 minutes, still active",
      why: "Nobody named support_mike works for you. Someone got a session link, maybe from the fake support callers. End the session and check what they touched." },
    { title: "Unusual vault access", source: "Documentation platform", time: "11:15", answer: "escalate",
      log: "user       tech.jsmith (help desk)\nviewed     credentials for 28 clients in 20 minutes\ncontext    major internet provider outage, 30 open tickets",
      why: "It could be snooping or theft, but there’s an outage and 30 open tickets. Escalate to the service manager to confirm before treating it as an attack." },

    /* ---------- More alerts, in matched pairs: one detail flips the answer ---------- */
    { title: "PSA API token used from a new location", source: "PSA audit log", time: "14:20", answer: "fp",
      log: "token      api-crm-sync\nsource     vendor IP range (your new CRM provider)\naction     read companies and contacts\nvolume     70 companies, 410 contacts\nticket     CHG-3307, CRM integration, approved",
      why: "Your newly approved CRM integration doing its first sync, from the vendor’s published address range. Legitimate. Note it so the next sync doesn’t page anyone." },
    { title: "PSA API token used from a new location", source: "PSA audit log", time: "02:47", answer: "real",
      log: "token      api-reporting (created 2021, owner left)\nsource     cloud VPS, rented by the hour\naction     export all tickets, contacts and attachments\nvolume     41,800 tickets\nticket     none",
      why: "An old, ownerless token bulk-exporting every ticket from a rented server at 3 a.m. Tickets hold client network details and passwords people pasted in. Revoke it and assume the data is gone." },
    { title: "MFA removed from a technician account", source: "Identity provider", time: "11:05", answer: "fp",
      log: "account    tech.jnoor\naction     MFA methods reset\nby         svc.manager (service manager)\nticket     T-56010, phone replaced\nfollow-up  new phone enrolled 11:22, same office IP",
      why: "A ticketed reset by the service manager for a replaced phone, re-enrolled within minutes from the office. Legitimate." },
    { title: "MFA removed from a technician account", source: "Identity provider", time: "17:52", answer: "real",
      log: "account    tech.bwalsh\naction     MFA methods reset\nby         helpdesk.tier1, after a phone call\nticket     none\nfollow-up  new device enrolled 17:58 from a mobile carrier IP in another state;\n           RMM console login 18:03",
      why: "A tech’s MFA reset after a phone call, with no ticket, then a new device from another state and straight into the RMM. Help desk social engineering. Lock the account and the RMM session now." },
    { title: "Remote access tool installed at a client", source: "EDR console", time: "10:40", answer: "fp",
      log: "client     Meridian Accounting\nhost       ACCT-WS-03\nsoftware   tax software vendor’s support tool\ninstalled  by the client’s office manager\nticket     T-56044, client approved vendor support session",
      why: "The client’s own tax software vendor, installed by the client with a ticket on file. Legitimate, but make sure it’s removed when the session ends." },
    { title: "Remote access tool installed at a client", source: "EDR console", time: "03:15", answer: "real",
      log: "client     Meridian Accounting\nhosts      9 of 11 workstations\nsoftware   remote access tool not in your stack\ninstalled  silently, via a scheduled task\nticket     none",
      why: "A remote access tool you don’t use, pushed silently to nearly every machine at 3 a.m. Attackers love legitimate remote tools because they blend in. Isolate the hosts and find how it was pushed." },
    { title: "Backup job failures", source: "Backup console", time: "06:30", answer: "fp",
      log: "client     Harbor Food Bank\njobs       3 of 3 failed overnight\nreason     target device unreachable\ncontext    utility power outage at the food bank, 22:00 to 05:40\nnote       client emailed about the outage last night",
      why: "One client’s backup target was offline during a known power outage. Rerun the jobs and confirm, but it isn’t an attack." },
    { title: "Backup encryption settings changed", source: "Backup console", time: "01:12", answer: "real",
      log: "action     encryption key replaced, retention set to 1 day\nclients    9\nby         console account “backup-admin”\nsource     IP not seen before\nmfa        not required for this account",
      why: "Replacing backup encryption keys and cutting retention across clients makes your backups useless to you. It’s ransomware groundwork. Lock the console and restore the settings." },
    { title: "Client firewall rule change", source: "Firewall manager", time: "21:00", answer: "fp",
      log: "client     Tri-County Fabrication\nchange     new rule: CNC vendor IP to CNC-PC-02, port 443\nby         tech.kris\nwindow     approved maintenance window\nticket     CHG-3312",
      why: "Kris adding a narrow, ticketed rule for the CNC vendor during a maintenance window. Legitimate." },
    { title: "Client firewall rule change", source: "Firewall manager", time: "01:04", answer: "real",
      log: "client     Brightside Dental\nchange     port forward: internet to FRONTDESK-01, port 3389 (RDP)\nby         local admin account on the firewall\nticket     none",
      why: "Remote Desktop opened to the internet at 1 a.m. by a local account, with no ticket. That’s how ransomware crews get in, or how they make sure they can come back. Remove it and investigate." },
    { title: "App granted access to client mailboxes", source: "Client email security", time: "13:30", answer: "fp",
      log: "client     Lumen Labs\napp        email signature manager (verified publisher)\nconsent    via the admin consent workflow\napproved   by the client’s IT contact, ticket T-56101\nscopes     read user profiles, manage signatures",
      why: "A verified app, approved through the proper admin workflow with a ticket and narrow permissions. Legitimate." },
    { title: "App granted access to client mailboxes", source: "Client email security", time: "09:48", answer: "real",
      log: "client     Harbor Food Bank\nuser       executive director\napp        “Secure Doc Viewer” (unverified publisher)\nscopes     read and send all mail, read all files\nconsented  by the user, after clicking an emailed link",
      why: "An unverified app with full mail and file access, approved from a link in an email. Consent phishing. Revoke the app, check what it accessed, and block user consent." },
    { title: "Impossible travel for a technician", source: "Identity provider", time: "08:40", answer: "fp",
      log: "user       tech.ralvarez\n08:05      sign-in, office\n08:40      sign-in, Denver (company VPN exit)\ncalendar   onsite client visit, travelling with a company laptop\ndevice     managed, compliant",
      why: "The tech is travelling for a client visit on a managed laptop, and the VPN exits in Denver. A tuning candidate, not an attack." },
    { title: "Impossible travel for a technician", source: "Credential vault", time: "10:16", answer: "real",
      log: "user       tech.mpatel\n09:58      badged into the office\n10:16      vault sign-in from a residential ISP overseas\naction     viewed credentials for 14 clients\nuser agent script, not a browser",
      why: "He’s in the building, while a script logs into the vault as him from overseas and pulls 14 clients’ credentials. Stolen session or password. Kill the sessions, then start rotating." },
    { title: "Large transfer from a client file server", source: "Client firewall", time: "19:10", answer: "escalate",
      log: "client     Tri-County Fabrication\nhost       FILE-01\ndestination new cloud storage account (owner’s email)\nvolume     310 GB over 6 hours, ongoing\nnote       owner mentioned “moving the CAD archive” on a call last week",
      why: "Possibly the owner migrating his own archive, possibly not. Don’t block a client’s data mid-transfer on a guess. Escalate to the account manager to confirm with the owner directly." },
    { title: "Large transfer from a client file server", source: "Client EDR", time: "02:22", answer: "real",
      log: "client     Meridian Accounting\nhost       FILE-01\nprocess    rclone.exe, copied from a temp folder\ndestination anonymous file-sharing service\nvolume     48 GB in 40 minutes",
      why: "A file-sync tool run from a temp folder at 2 a.m., copying client tax files to an anonymous sharing service. Data theft before encryption. Isolate the server now." },
    { title: "EDR exclusion added", source: "EDR console", time: "15:35", answer: "fp",
      log: "client     Brightside Dental\nexclusion  C:\\Program Files\\DentalImaging\\ (vendor-documented)\nscope      one client policy\nby         tech.jnoor\nticket     T-56133, imaging software crashes",
      why: "A narrow, vendor-documented exclusion for one client’s imaging software, with a ticket. Legitimate, though worth reviewing in a few months." },
    { title: "EDR exclusion added", source: "EDR console", time: "03:41", answer: "real",
      log: "exclusion  C:\\ProgramData\\* and C:\\Users\\Public\\*\nscope      global policy, all clients\nby         tech.bwalsh\nsource     IP not seen before\nticket     none",
      why: "Wildcard exclusions for the folders malware uses most, pushed to every client at 3 a.m. Someone is blinding your EDR before deploying something. Revert it and lock that account." },
    { title: "Admin group change at a client", source: "Client directory", time: "16:05", answer: "escalate",
      log: "client     Lumen Labs (co-managed)\nchange     new member of Domain Admins: j.ortiz\nby         the client’s internal IT person\nticket     none on your side",
      why: "At a co-managed client, their own IT person may add admins without telling you. It’s probably fine, but it’s a new admin you didn’t approve. Escalate to the client contact to confirm." },
    { title: "Admin group change at a client", source: "Client directory", time: "02:58", answer: "real",
      log: "clients    Hale & Ward LLP, Meridian Accounting\nchange     new member of Domain Admins: svc_update\nby         your RMM, running a script\nscript     created 40 minutes earlier, unsigned\nticket     none",
      why: "Your own RMM creating domain admins at two clients with a brand-new unsigned script. That’s your stack being used against your clients. Stop the RMM job and remove the accounts." },
    { title: "Urgent account reset request", source: "PSA", time: "09:15", answer: "fp",
      log: "client     Meridian Accounting\nrequest    password reset\nsubmitted  through the client portal, signed in\ndevice     known workstation, office IP\nrequester  the user themself",
      why: "A reset requested by the signed-in user from a known device at the client’s office. Routine." },
    { title: "Urgent account reset request", source: "PSA", time: "18:40", answer: "escalate",
      log: "client     Lumen Labs\nrequest    reset MFA and password for the CEO, urgently\ncaller     says she’s the CEO, travelling, phone lost\ncallback   the number given differs from the directory\npressure   “I’m about to board, just do it”",
      why: "Urgency, a lost phone, and a callback number that doesn’t match: classic help desk impersonation. Don’t reset. Escalate and verify through the directory number or another known contact." },
    { title: "New domain contacted from many endpoints", source: "DNS filtering", time: "10:00", answer: "fp",
      log: "domain     status.keystonemanaged-it.com\nregistered last week by Keystone\nclients    all, 2,400 endpoints\ncontext    new client status page announced in Monday’s newsletter",
      why: "It’s your own new status page, linked from the client newsletter. Add it to the allow list." },
    { title: "New domain contacted from many endpoints", source: "DNS filtering", time: "03:30", answer: "real",
      log: "domain     cdn-rmm-telemetry.net (registered 4 days ago)\nclients    3, 14 endpoints\npattern    every 60 seconds, all night\ncommon     all 14 run the same RMM agent version",
      why: "A brand-new domain dressed up as RMM telemetry, contacted on a timer from three clients that share an agent version. Possibly a tampered agent or update. Block it and investigate the agent." }
  ];
  msp.minigames = {
    schedule: { 1: "triage", 4: "triage", 7: "triage" },
    triage: {
      data: ALERTS, count: 4,
      intro: "Mateo is buried. Help him clear the overnight alert queue: false positive, real threat, or escalate?",
      hint: S => S.tutorial && !S.seenTriage && (S.seenTriage = true) ? "<b>How triage works:</b> read the log details, not just the title. At an MSP, your own tools and technicians generate most alerts, so the same alert can be routine or a disaster. <b>False positive</b> closes it, <b>real threat</b> starts containment, and <b>escalate</b> hands it to someone else to verify. Each escalation costs Mateo time and adds to his burnout." : "",
      good: "The queue is clear, and Mateo turned two of the false positives into tuning rules.",
      bad: "The queue is clear, but some calls were wrong. Mateo walked you through what he’d have done.",
      lesson: ["Alert triage at an MSP", "Your own tools look exactly like attackers. The skill is knowing what normal looks like for your techs and scripts, and spotting when it isn’t."],
      reward(S, score, esc) {
        const gain = Math.round(score * 4); S.detect = clamp(S.detect + gain);
        team.burn("mateo", esc * 2);
        return [`Detection rules +${gain}`].concat(esc ? [`Mateo’s burnout +${esc * 2}`] : []);
      }
    }
  };

  /* ---------- Ransomware night: the supply-chain attack ---------- */
  msp.finale = {
    title: "Ransomware night",
    times: ["11:48 PM", "12:02 AM", "12:15 AM", "12:29 AM", "12:41 AM", "12:54 AM", "1:04 AM", "1:12 AM"],
    intro: S => `Late on a Friday before a holiday weekend, the ${S.gang.name} gang turns its attention to ${ORG}. They don’t want you. They want your 70 clients, and your tools are the way in. They start with your weakest spot and keep going until something works.`,
    vectors: S => [
      { name: "phishing a technician", p: 1 - (1 - sys.eff(S.filter)) * (1 - S.training / 100 * .8), hold: "The tech they targeted reported the fake RMM login page.", fail: "A tech entered his password on a convincing fake RMM login page." },
      { name: "the RMM itself", p: (S.rmm / 100) * .9 + (S.patch >= 60 ? .05 : 0), hold: "The RMM console only accepts logins from your office, with MFA.", fail: "Your RMM console was reachable from the internet, with a flaw the vendor patched last month." },
      { name: "a stolen tech password", p: S.mfa ? .95 : .15, hold: "Multi-factor login on every tool asked for a code they didn’t have.", fail: "They bought a former intern’s password online, and it still worked on the PSA. No second factor was required." },
      { name: "the credential vault", p: S.vault >= 60 ? .9 : .3, hold: "The vault account they targeted had been rotated and locked to the office.", fail: "A vault account with access to every client’s passwords had never been rotated." },
      { name: "a departed technician’s account", p: S.stale <= 3 ? .95 : .3, hold: "The departed techs’ accounts were all disabled.", fail: `One of ${S.stale} stale accounts, belonging to a tech who left in the spring, still had admin access.` },
      { name: "a client with an exception", p: (S.exceptions || []).length ? .25 : .9, hold: "Every client was on the standard stack, with no soft spots to start from.", fail: `They started at ${(S.exceptions || [CLIENTS.law])[0]}, the client with an exception to your standard, and worked back to your tools.` }
    ].concat(S.expanded ? [{ name: "the acquired MSP’s old tools", p: S.done.migrate ? .9 : .2, hold: "The acquired MSP’s old tools had been switched off.", fail: "The acquired MSP’s old RMM was still running, with a departed tech’s password." }] : []),
    zeroDay: { label: "They buy a zero-day.", fail: "With every door locked, they bought a brand-new flaw in your remote access tool. No patch exists yet." },
    luckyBlock: "It should have worked, but their tool crashed halfway through. <i>Lucky break.</i>",
    firstTry: "They got in on the first try, quietly.",
    decisionHint: "<b>Live decisions:</b> from here, you make the calls, and every call affects 70 clients at once. Shutting off shared tools stops the attackers but leaves every client without support; narrower moves are gentler but riskier. What you’ve built all year changes the odds.",
    beachhead: {
      clock: "1:20 AM", title: "Inside your stack",
      blocked: "Endpoint protection on your own admin workstation caught their tools the moment they ran. They lost their foothold before they had it.",
      lucky: "Their malware crashed on an outdated driver before it finished installing. The foothold is gone. That was too close.",
      failed: S => S.edr < 75 ? "Endpoint protection logged a warning but didn’t block it. They have a foothold inside your stack." : "Endpoint protection blocked one tool, but they disguised the next. They have a foothold inside your stack."
    },
    early: {
      clock: "1:40 AM", title: "The on-call phone buzzes",
      alert: S => S.mdr !== null && !S.mdrNoisy ? "The SOC partner calls: a technician account is logged into the RMM from an unknown location and is building a script." : "A detection rule fires: a technician account is logged into the RMM from an unknown location and is building a script.",
      options: [
        { id: "host", label: "Disable that technician account" },
        { id: "segment", label: "Shut off the RMM for every client" },
        { id: "watch", label: "Watch them for an hour" }
      ],
      hostWin: "You disabled the account and killed its sessions. A sweep confirmed they hadn’t reached anything else.",
      hostLose: "You disabled the account, but they had already created a second admin login in the RMM.",
      segmentCare: -4,
      segmentCost: "Shutting off the RMM left every client without remote support through the holiday weekend.",
      segmentWin: "With the RMM off, they had nothing to push through. Monday brought a lot of tickets and no ransomware.",
      segmentLose: "You shut off the RMM, but they had already reached the backup console.",
      watchWin: "You watched them stage their script, learned every account and access path they had, then cut them all off at once. Textbook.",
      watchLose: "While you watched, they finished the script and scheduled it."
    },
    contain: {
      clock: "3:10 AM", title: "A script is scheduled for every client",
      alert: S => "An alert finally fires: an RMM job targeting every client endpoint is scheduled for 4:00 a.m., and backup retention is being set to zero.",
      knownAlert: "Their RMM job targeting every client is scheduled for 4:00 a.m. You know their accounts from earlier tonight.",
      unseen: "Nobody notices the RMM job scheduled for every client. At 4:00 a.m., it runs.",
      options: [
        { id: "plug", label: "Shut down every shared tool" },
        { id: "targeted", label: "Kill the job and their accounts" },
        { id: "mdr", label: "Let the SOC partner lead" }
      ],
      plugCare: -15,
      plugCost: "You shut down the RMM, remote access, the vault and the backup console for every client. Support went dark for two days.",
      plugWin: "It worked. The script never ran.",
      plugLose: "The job had already started on some clients before everything was down.",
      targetedWin: "You cancelled the job, disabled their accounts and locked the backup console, without shutting down client support. The script never ran.",
      targetedLose: "You missed a second scheduled job. It ran at 4:00 a.m.",
      mdrWin: "The SOC partner cancelled the job and locked the accounts within minutes, then walked Kris through the rest.",
      mdrLose: "The SOC partner couldn’t stop the job in time."
    },
    encrypt: {
      clock: "5:30 AM", title: "Your clients go dark",
      body: S => `<p>Ransomware ran on endpoints at 23 of your clients, from ${CLIENTS.dental} to ${CLIENTS.fab}. The ${S.gang.name} gang has posted your MSP’s name on its leak site. Clients start calling at 7.</p>`,
      safety: [{ id: "divert", label: "Call every client and triage by impact" }, { id: "stay", label: "Fix the loudest clients first" }],
      divertCare: -10, divertText: "You called every affected client before they called you, and worked in order of impact: the dental practice’s patients and the manufacturer’s payroll first.",
      stayBadCare: -25, stayBad: "You worked whoever called loudest. The quiet clients, including the food bank, waited four days, and found out what happened from the news.",
      stayOkCare: -8, stayOk: "You worked whoever called loudest. It was chaos, but the team kept up.",
      restored: "Client backups were proven good and immutable, so the attackers couldn’t delete them. Every client was restored within a week.",
      recoverClock: "9:00 AM", recoverTitle: "Recovery",
      noBackups: S => `<p>Many client backups are gone: the attackers deleted them through your own backup console. The gang wants $4.5 million to decrypt all 23 clients. Your insurance would cover part of it, after a $50,000 deductible from your budget.</p>`,
      recovery: [{ id: "pay", label: "Pay the ransom" }, { id: "rebuild", label: "Refuse and rebuild" }],
      deductible: 50000,
      paidWorks: "You paid. The decryptor worked slowly across 23 clients over two weeks. Several are leaving anyway.",
      paidFails: "You paid. The decryptor failed on half the clients, and you rebuilt them by hand anyway.",
      rebuilt: "You refused. Rebuilding 23 clients took a month of round-the-clock work. A third of them are leaving."
    },
    lessons: {
      weakest: ["Weakest link", "Attackers look for your easiest way in. At an MSP, that’s often a client exception or a forgotten account."],
      assume: ["Assume breach", "Plan as if attackers will get into your stack. Prevention buys time; detection, response and immutable backups decide how many clients get hurt."],
      luck: ["Luck", "Sometimes things break your way. It isn’t a plan."],
      ransom: ["Paying the ransom", "Paying doesn’t guarantee recovery, funds criminals and marks you as a payer. Immutable backups the attackers can’t delete are what let you refuse."]
    },
    results: {
      edr: { label: "Stopped at the first foothold", bonus: 15, text: "By morning they’d moved on. Your clients never knew.", fx: { trust: 6 }, lesson: ["Defense in depth", "When one layer fails, the next one can still stop the attack."] },
      luckyedr: { label: "Lucky break at the first foothold", bonus: 8, text: "You found the crash logs after the holiday and realized how close it was.", fx: { trust: 2 }, lesson: ["Defense in depth", "When one layer fails, the next one can still stop the attack."] },
      early: { label: "Contained one account", bonus: 15, text: "One account disabled, one long night, and 70 clients who never knew.", fx: { trust: 5 }, lesson: ["Detection and response", "Catching attackers in your own tools before they act is the cheapest win an MSP can get."] },
      segment: { label: "Shut off the RMM in time", bonus: 13, text: "A weekend without remote support and a pile of Monday tickets. No ransomware.", fx: { trust: 4 }, lesson: ["Containment trade-offs", "Turning off the tool that reaches every client is blunt, but it removes the attacker’s best weapon."] },
      watched: { label: "Watched, then evicted", bonus: 16, text: "Because you watched first, you closed every access path in one sweep.", fx: { trust: 6 }, lesson: ["Scoping before containing", "Cutting off attackers before you know their full footprint can leave access behind. Watching is powerful and risky."] },
      downtime: { label: "Shut down every tool in time", bonus: 8, text: "Two days of no support, angry calls, and no ransomware.", fx: { trust: 2 }, lesson: ["Shutting down shared tools", "Turning off every shared tool is blunt but effective. A rehearsed plan for supporting clients without them makes it survivable."] },
      targeted: { label: "Targeted containment", bonus: 14, text: "Precise containment kept client support running all weekend.", fx: { trust: 5 }, lesson: ["Detection and response", "Knowing your own stack well lets you contain precisely instead of shutting everything down."] },
      mdrled: { label: "Contained by the SOC partner", bonus: 12, text: "A long report from the SOC partner and a lot of rotated credentials.", fx: { trust: 3 }, lesson: ["Detection and response", "A tuned SOC partner brings round-the-clock expertise a small MSP can’t staff itself."] },
      restored: { label: "Encrypted, restored from backups", bonus: 4, text: "A brutal week, but every client came back without paying.", fx: {}, lesson: ["Immutable backups", "Backups that even your own admin accounts can’t delete are what save an MSP from a supply-chain attack."] },
      paid: { label: "Paid the ransom", bonus: 0, text: "Rob has questions. So do 23 clients.", fx: {}, lesson: ["Immutable backups", "Without backups the attackers can’t delete, every option is bad."] },
      rebuilt: { label: "Rebuilt from scratch", bonus: 0, text: "Rob has a lot of questions. So do 23 clients.", fx: {}, lesson: ["Immutable backups", "Without backups the attackers can’t delete, every option is bad."] }
    }
  };

  // Immutable backups count as proven for the finale's restore check
  const origBackups = sys.backupsGood;
  sys.backupsGood = () => origBackups() || (FT.mode === mode && mode.setting.id === "msp" && S.immutable && S.backupAge <= 3);

  mode.addSetting(msp);
})();
