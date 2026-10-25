/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Practitioner setting: a mid-size B2B software company.
 * The core tension is security versus business speed. Everything runs in the
 * cloud, engineers ship daily, sales needs security questionnaires answered to
 * close deals, and every team wants new SaaS tools approved yesterday.
 * Signature mechanics:
 *  - A questionnaire backlog: unanswered security questionnaires stall deals.
 *  - SaaS sprawl: unreviewed tool requests turn into shadow IT.
 *  - Cloud configuration drifts as engineers ship, unless guardrails catch it. */
(function () {
  const S = FT.S, L = FT.learned, { chance, clamp, money } = FT.util, sys = FT.sys;
  const mode = FT.modes.practitioner, team = mode.team;
  const ORG = "Cobaltline";

  const saas = {
    id: "software", letter: "S",
    name: "Mid-size software company",
    short: "Software company",
    summary: "A 400-person B2B software company, all in the cloud. Security versus business speed: sales needs answers, engineers ship daily, and everyone wants new tools.",
    chief: "Maya Chen, CTO",
    meters: [
      { key: "trust", label: "Leadership trust", short: "Trust" },
      { key: "care", label: "Momentum", short: "Momentum" },
      { key: "morale", label: "Team morale", short: "Morale", value: () => team.morale() }
    ],
    months: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    landmarks: ["Sales kickoff","SOC 2 kickoff","Q1 board meeting","Big product launch","Customer conference prep","Fundraising","Engineering offsite","SOC 2 audit window","Q3 board meeting","Customer conference","Renewal season","Year-end close"],
    winTitle: "You made it to year-end close",
    rewardScale: .5,
    startBudget: 80000,
    monthlyBudget: 8000,
    briefing: `<b>Your new job:</b> security lead at ${ORG}, a 400-person, remote-first company selling procurement and invoicing software to mid-market finance teams. Everything runs in the cloud, and your customers trust you with their financial data.`,
    irNote: "The incident plan meant nobody improvised: engineering knew who could make production changes, legal and customer success had notices drafted, and the status page told the truth from the first hour. That cut the damage.",
    orientation: "Glad you’re here. We grew fast and security didn’t keep up. Engineers ship to production every day, nobody enforces multi-factor login, our cloud accounts have three years of drift, and sales has a stack of security questionnaires blocking deals. Noor runs detection, Sam owns cloud security. Help us move fast without blowing up.",

    newState() {
      return {
        patch: 60, cloud: 40, guardrails: false, shadow: 50, deals: 3, trustCenter: false,
        filter: 50, edr: 50, training: 30, vendor: 25, stale: 8,
        team: [
          { id: "you", name: "You", role: "Security lead", skill: "lead", cap: 2, burnout: 25 },
          { id: "noor", name: "Noor", role: "Analyst", skill: "detect", cap: 2, burnout: 25 },
          { id: "sam", name: "Sam", role: "Cloud security engineer", skill: "infra", cap: 2, burnout: 25 }
        ]
      };
    },
    replacement(p) {
      const names = p.skill === "detect" ? ["Alex", "Priscilla", "Kwame"] : ["Jules", "Ravi", "Teresa"];
      return { name: names[Math.floor(FT.util.rand() * names.length)], burnout: 10, newHire: 2, away: 0 };
    },

    /* ---------- Software-company tasks ---------- */
    actions: [
      { id: "cloudfix", kind: "upkeep", skill: "infra", name: "Fix cloud misconfigurations", desc: "Open storage, overly broad permissions, exposed services. New ones appear every week.",
        apply: (S, k) => { S.cloud = clamp(S.cloud + Math.round(35 * k)); return "Fixed a batch of cloud misconfigurations."; } },
      { id: "saasreview", kind: "upkeep", skill: "detect", name: "Review SaaS and app requests", desc: "Approve, deny or replace the tools teams are asking for, before they sign up anyway.",
        apply: (S, k) => { S.shadow = clamp(S.shadow - Math.round(30 * k)); return "Cleared a batch of SaaS and app-connection requests."; } },
      { id: "questionnaire", kind: "upkeep", skill: "lead", name: "Answer security questionnaires", desc: "Sales can’t close deals until prospects get their answers.",
        apply: (S, k) => { const n = Math.min(S.deals, Math.round(2 * k)); S.deals -= n; return n ? `Answered ${n} security questionnaire${n > 1 ? "s" : ""}. Sales can move those deals forward.` : "No questionnaires waiting. Sales is happy."; } },
      { id: "guardrails", kind: "project", skill: "infra", cost: 30000, work: 4, name: "Guardrails as code", desc: "Block risky cloud configurations automatically, before they reach production.",
        done: S => { S.guardrails = true; return "Guardrails are live: risky cloud changes are blocked before they deploy, and drift slows to a crawl."; } },
      { id: "trustcenter", kind: "project", skill: "lead", cost: 10000, work: 2, name: "Publish a trust center", desc: "A public page with your security documents, so prospects need fewer questionnaires.",
        done: S => { S.trustCenter = true; return "The trust center is live. Fewer prospects need a full questionnaire now."; } },
      { id: "aisecure", kind: "project", skill: "infra", cost: 20000, work: 3, name: "Secure the AI assistant", desc: "Tenant isolation, prompt-injection defenses and output filtering for the new AI feature.", show: S => S.expanded,
        done: S => { return "The AI assistant now keeps each customer’s data separate and resists prompt injection."; } }
    ],

    monthEnd(S) {
      const d = n => Math.round(n * S.diff.decay);
      S.patch = clamp(S.patch - d(15));
      S.cloud = clamp(S.cloud - d(S.guardrails ? 5 : 12));
      S.shadow = clamp(S.shadow + d(10));
      S.deals += S.trustCenter ? 1 : 2;
      // Stalled deals cost momentum every month the backlog stays high
      if (S.deals > 4) S.care = clamp(S.care - Math.min(4, S.deals - 4));
      S.backupAge++; if (S.backupAge > 2) S.backupTested = false;
      S.training = clamp(S.training - d(5));
      S.detect = clamp(S.detect - d(5));
      S.inventory = clamp(S.inventory - d(5));
      S.vendor = clamp(S.vendor - d(5));
      S.stale = Math.min(20, S.stale + d(2));
    },

    /* ---------- Status board ---------- */
    dashboard(S) {
      const lvl = (v, g, o) => v >= g ? "good" : v >= o ? "warn" : "bad";
      const rows = [
        ["Laptops and servers", lvl(S.patch, 70, 40), S.patch >= 70 ? "Patched" : S.patch >= 40 ? "Falling behind" : "Badly behind"],
        ["Cloud configuration", lvl(S.cloud, 70, 40), (S.cloud >= 70 ? "Clean" : S.cloud >= 40 ? "Drifting" : "Riddled with gaps") + (S.guardrails ? ", guardrails on" : "")],
        ["Questionnaire backlog", S.deals <= 2 ? "good" : S.deals <= 4 ? "warn" : "bad", S.deals === 0 ? "Empty" : `${S.deals} waiting${S.deals > 4 ? ", deals stalling" : ""}`],
        ["SaaS sprawl", S.shadow <= 30 ? "good" : S.shadow <= 60 ? "warn" : "bad", S.shadow <= 30 ? "Under control" : S.shadow <= 60 ? "Growing" : "Shadow IT everywhere"],
        ["Backups", S.backupTested ? "good" : "bad", S.backupTested ? (S.backupAge === 0 ? "Restore tested this month" : `Restore tested ${S.backupAge} month${S.backupAge > 1 ? "s" : ""} ago`) : "Restore not tested recently"],
        ["Staff awareness", lvl(S.training, 60, 35), S.training >= 60 ? "Sharp" : S.training >= 35 ? "Fading" : "Low"],
        ["Detection rules", lvl(S.detect, 70, 40), S.detect >= 70 ? "Sharp" : S.detect >= 40 ? "Drifting" : "Noisy and blind"],
        ["Endpoint protection", lvl(S.edr, 75, 50), S.edr >= 75 ? `Well tuned (${S.edr}%)` : `Partly tuned (${S.edr}%)`],
        ["Email filter", lvl(S.filter, 75, 50), S.filter >= 75 ? `Well tuned (${S.filter}%)` : `Partly tuned (${S.filter}%)`],
        ["Multi-factor login", S.mfa ? "good" : "bad", S.mfa ? "Enforced for everyone" : "Not enforced"],
        ["Old accounts", S.stale <= 3 ? "good" : S.stale <= 9 ? "warn" : "bad", S.stale === 0 ? "All cleaned up" : `${S.stale} still active`],
        ["Integrations", lvl(S.vendor, 60, 30), S.vendor >= 60 ? "Reviewed" : S.vendor >= 30 ? "Partly reviewed" : "Unknown"],
        ["Incident plan", S.irPlan ? "good" : "bad", S.irPlan ? "Written and tested" : "None"]
      ];
      if (S.expanded) rows.push(["AI assistant", S.done.aisecure ? "good" : "bad", S.done.aisecure ? "Secured" : "Live, not yet secured"]);
      if (S.mdr !== null || S.month > S.mdrMonth) rows.push(["MDR service", S.mdr === null ? "bad" : S.mdrNoisy ? "warn" : S.mdr >= 80 ? "good" : "warn", S.mdr === null ? "None" : S.mdrRamp ? "Onboarding" : S.mdr >= 80 ? `Tuned by provider (${S.mdr}%)` : S.mdrNoisy ? `Self-onboarded, noisy (${S.mdr}%)` : `Self-tuned (${S.mdr}%)`]);
      return rows;
    },
    explain: {
      "Laptops and servers": "Employee laptops and the few servers you still run. Patch them any time.",
      "Cloud configuration": "Open storage, broad permissions, exposed services. Engineers create new ones every week; guardrails slow the drift.",
      "Questionnaire backlog": "Security questionnaires from prospects. More than four waiting and deals start to stall, costing momentum every month.",
      "SaaS sprawl": "Tools teams signed up for without review, and apps connected to company email and files. It grows every month you don’t review requests.",
      "Backups": "Production databases and critical systems, proven by an actual restore test.",
      "Staff awareness": "How well staff spot phishing and fraud. It fades without practice.",
      "Detection rules": "Whether your alerts catch real attacker behavior in the cloud and on laptops.",
      "Endpoint protection": "Software on every laptop that blocks malicious behavior once tuned.",
      "Email filter": "Stops phishing before it reaches inboxes.",
      "Multi-factor login": "Enforced, phishing-resistant multi-factor login for everyone, especially admins.",
      "Old accounts": "Accounts of people who left, including in GitHub, the cloud and SaaS tools.",
      "Integrations": "Third-party apps and partners with access to your systems or customer data.",
      "Incident plan": "Who does what during an incident, including customer communication.",
      "AI assistant": "The new AI feature built on customer data, until it’s properly isolated and hardened.",
      "MDR service": "An outside team watching your systems around the clock."
    },

    threatWarning(S) {
      if (!(S.month >= S.finaleMonth - 3 && S.month < S.finaleMonth)) return "";
      return `<div class="intel"><b>Threat intel alert:</b> The ${S.gang.name} extortion gang has hit ${5 - (S.finaleMonth - S.month)} software companies this year. They steal customer data first, then wipe cloud backups and encrypt what’s left.</div>`;
    },

    deaths: {
      ransomware: "Your company has died of ransomware.",
      care: "Momentum collapsed. Deals stalled, customers churned, and the funding round fell through.",
      trust: "The board brought in an outside firm. Your contract was not renewed."
    },

    /* ---------- Mid-year offer: MDR ---------- */
    mdrOffer() {
      const pro = 30000, canPro = S.budget >= pro, title = "The board asks about 24/7 monitoring";
      FT.ui.screen(`<div class="panel"><h2>${title}</h2>
        <p>A board member asked who watches for attacks at 3 a.m. Maya can fund a year of <b>managed detection and response (MDR)</b> from the fundraising budget if you decide this month.</p>
        <p>The vendor offers onboarding services from your budget, including tuning for your cloud accounts. Or your team can onboard it.</p>
        <div class="opts">
          <button class="opt choice" data-c="pro" ${canPro ? "" : "disabled"}><div><b>Take it, with vendor onboarding</b><small>Tuned to your cloud and identity systems. About 85% effective from next month.${canPro ? "" : " Your budget can’t cover this right now."}</small></div><span class="cost">${money(pro)}</span></button>
          <button class="opt choice" data-c="self"><div><b>Take it, onboard it yourselves</b><small>Free, but default settings, about 35% effective, and Noor buried in alerts until it’s tuned.</small></div><span class="cost">$0</span></button>
          <button class="opt choice" data-c="no"><div><b>Pass</b><small>One less thing for a stretched team.</small></div><span class="cost">$0</span></button>
        </div></div>`, "button[data-c]:not(:disabled)");
      FT.app.querySelectorAll("button[data-c]").forEach(b => b.onclick = () => {
        const c = b.dataset.c; let r; FT.note(title, `Chose: ${b.querySelector("b").textContent}.`);
        if (c === "pro") { S.budget -= pro; S.mdr = 40; S.mdrRamp = true; S.mdrNoisy = false;
          r = { text: "The vendor’s engineers spent two weeks with Noor and Sam learning what normal looks like: deploy pipelines, admin logins, which countries your remote staff work from.", fx: { morale: -2 }, lesson: ["Professional services", "Paying experts to set up a tool properly often matters as much as the tool itself."] }; }
        else if (c === "self") { S.mdr = 35; S.mdrNoisy = true;
          r = { text: "Sam connected it to the cloud accounts over a weekend. It works, sort of. Noor now gets about 120 alerts a day, most of them deploy pipelines doing their normal thing.", fx: { morale: -5 }, lesson: ["Alert fatigue", "A badly tuned tool buries real warnings under false alarms. The people watching it burn out, and eventually stop looking."] }; }
        else r = { text: "You passed. Maya backed you, but the board member asked again at the next meeting.", fx: { trust: -2 }, lesson: ["Opportunity cost", "Every choice has a price, including saying no."] };
        L.set(...sys.notes.mdr);
        FT.screens.outcome(title, r);
      });
    },

    /* ---------- The guided first month ---------- */
    tutorial: {
      tips: [
        { target: "dash", text: "This is the security status board. Red is a gap, yellow is slipping, green is solid. Two lines are different here: the <b>questionnaire backlog</b> stalls deals if it grows past four, and <b>SaaS sprawl</b> grows every month nobody reviews tool requests." },
        { target: "team", text: "This is your team. Each person gets two tasks a month. A ★ marks their specialty, where they work about 40% faster: Noor is detection, Sam is cloud security, and you’re leadership. You can do anything at normal speed; they’re slower outside their specialty." },
        { target: "team", text: "Watch the burnout number next to each name. It creeps up every month, and overtime or a bad incident pushes it up fast. Past 65 they work slower, past 80 their work starts slipping, and past about 85 they may resign, and replacing them takes two months. <b>Time off</b> is in everyone’s task list." },
        { target: "budget", text: "Projects, like guardrails that block risky cloud changes automatically, take several person-months and only pay off once finished. You pay when you start one. Your committed spending is shown here." },
        { target: "team", text: "The trap here is that business work competes with security work: answering questionnaires and reviewing tool requests keep the company moving, but they take the same hours as fixing the cloud. My suggestion: Sam fixes cloud misconfigurations and starts guardrails, Noor tunes detection and reviews tool requests, and you answer questionnaires and start enforcing multi-factor login." }
      ],
      suggested: { you: ["questionnaire", "mfa"], noor: ["tunedetect", "saasreview"], sam: ["cloudfix", "guardrails"] },
      report: "This is the change report: what each person did, and anything that broke. Red lines are changes that went wrong. Keep an eye on the questionnaire backlog too: it costs momentum every month it stays high.",
      monthNotes: {
        1: "Look at the burnout numbers before assigning anything. And check the questionnaire backlog: sales notices when it grows.",
        2: "If a project is in progress, keep someone on it. Half-finished guardrails block nothing."
      }
    }
  };

  /* ---------- Unplanned work specific to a software company ---------- */
  saas.interrupts = [
    { skill: "lead", text: "A big prospect’s CISO wants a call before they’ll sign.", done: "Took a call with a prospect’s CISO to save a deal." },
    { skill: "infra", text: "A bad deploy left a firewall rule wide open in production.", done: "Closed a firewall rule a bad deploy had left open." },
    { skill: "detect", text: "Customers are reporting phishing emails impersonating your company.", done: "Got look-alike phishing domains impersonating the company taken down." }
  ];

  /* ---------- Mid-year expansion: the AI feature ---------- */
  const aiLesson = ["Securing AI features", "AI features built on customer data need tenant isolation, prompt-injection defenses and output checks, just like any other way into that data."];
  saas.expansion = {
    id: "ailaunch", title: "The AI assistant ships",
    intro: "Product built an AI assistant that answers questions about a customer’s invoices and spending, using their data. The CEO already announced it for the customer conference. Engineering says it’s ready; nobody has security-reviewed it.",
    choices: [
      { label: "Security review first ($20,000)", run() {
        S.budget -= Math.min(20000, Math.max(0, S.budget)); S.proj.aisecure = 1;
        return { text: "You held the launch two weeks for a review and found that the assistant could be talked into reading other customers’ invoices. The CEO was unhappy about the slip, but securing it is already under way.", fx: { care: -4, trust: -2 }, lesson: aiLesson };
      } },
      { label: "Launch on schedule, secure it after", run() {
        return { text: "The assistant launched on stage to applause. Customers love it. Securing it is now a project on your list.", fx: { care: 4, trust: 2 }, lesson: aiLesson };
      } }
    ]
  };

  /* ---------- Events ---------- */
  const sprawl = ["SaaS sprawl and app consent", "Every unreviewed tool and every app granted access to company email or files is a place your data lives without your controls."];
  const cloudLesson = ["Cloud misconfiguration", "Most cloud breaches aren’t clever hacks; they’re storage left open or permissions too broad. Continuous fixing and guardrails keep up with fast-moving engineers."];

  saas.events = [
    { id: "leakedkey", title: "A cloud key on GitHub", run() {
      if (S.guardrails || S.detect >= 55) return { text: "An engineer pushed a cloud access key to a public GitHub repo. Secret scanning flagged it within minutes, and Sam revoked it before anyone used it.", fx: { trust: 3 }, lesson: ["Leaked secrets", "Keys pushed to public code are found by attackers within minutes. Automatic scanning and fast revocation are the only reliable fix."] };
      return { text: "An engineer pushed a cloud access key to a public GitHub repo. Within an hour, attackers used it to spin up crypto-mining servers in three regions. The bill was $38,000 before Sam shut it down.", fx: { trust: -8, budget: -38000, morale: -4 }, lesson: ["Leaked secrets", "Keys pushed to public code are found by attackers within minutes. Automatic scanning and fast revocation are the only reliable fix."] };
    } },
    { id: "openbucket", title: "A storage bucket left open", run() {
      if (S.cloud >= 60) return { text: "A new storage bucket for customer exports was created with public access. Your cloud posture scan caught it the same day, and Sam locked it down.", fx: { trust: 2 }, lesson: cloudLesson };
      return { text: "A storage bucket holding customer invoice exports had been public for six weeks. A security researcher found it before you did. Twelve customers need breach notifications.", fx: { trust: -14, care: -6 }, lesson: cloudLesson };
    } },
    { id: "oauth", title: "“Allow access to your Google Drive?”", run() {
      if (S.shadow <= 35) return { text: "A phishing email asked staff to approve a fake “document signing” app’s access to their email and files. Because app connections now require review, the request was blocked.", fx: { trust: 3 }, lesson: sprawl };
      if (chance((100 - S.training) / 100 * .8)) return { text: "A finance analyst approved a fake “document signing” app’s access to her email and files. The attacker quietly downloaded three months of customer contracts.", fx: { trust: -12, care: -3 }, lesson: sprawl };
      return { text: "A fake “document signing” app asked staff for access to email and files. The two people who got it reported it instead of clicking “Allow.”", fx: { trust: 2 }, lesson: sprawl };
    } },
    { id: "salestool", title: "Sales needs a tool today", intro: "Sales wants a new AI prospecting tool connected to the CRM, today, to hit quarter-end. It wants read access to every customer record.", choices: [
      { label: "Approve it now", run() { S.shadow = clamp(S.shadow + 15); return { text: "Sales got their tool and hit quarter-end. The tool now has a copy of every customer record, and nobody has read its security documents.", fx: { care: 3 }, lesson: sprawl }; } },
      { label: "Review it first (a week)", run() { team.burn("you", 6); return { text: "You reviewed it in a week, limited its access to the fields it actually needs, and signed a data agreement. Sales grumbled, then closed the deals anyway.", fx: { care: -2, trust: 3 }, lesson: sprawl }; } }
    ] },
    { id: "pentest", title: "A customer’s pen test finds a hole", intro: "Your largest customer’s penetration testers found that changing an ID in an API request shows another customer’s invoices. They want it fixed before renewal.", choices: [
      { label: "Pull engineers off the roadmap to fix it now", run() { S.patch = clamp(S.patch + 10); return { text: "Engineering fixed it in two days and checked every similar endpoint. The roadmap slipped a week; the customer renewed.", fx: { care: -3, trust: 4 }, lesson: ["Broken access control", "Letting users reach data by changing an ID is one of the most common and serious web flaws. Fix it fast, then look for its siblings."] }; } },
      { label: "Schedule it for next sprint", run() {
        if (chance(.4)) return { text: "Before the next sprint, someone else found the same flaw and pulled invoices from 30 customers. The original customer is now reviewing your contract.", fx: { trust: -14, care: -8 }, lesson: ["Broken access control", "Letting users reach data by changing an ID is one of the most common and serious web flaws. Fix it fast, then look for its siblings."] };
        return { text: "It got fixed the next sprint without incident. The customer noted how long it took.", fx: { trust: -2 }, lesson: ["Broken access control", "Letting users reach data by changing an ID is one of the most common and serious web flaws."] }; } }
    ] },
    { id: "deepfake", title: "The CFO on a video call", run() {
      if (S.irPlan || S.training >= 60) return { text: "A finance manager joined a video call with the “CFO” and two “board members” asking for an urgent $250,000 transfer for an acquisition. She followed the callback rule and phoned the real CFO, who was on a plane.", fx: { trust: 4 }, lesson: ["Deepfake fraud", "AI can fake voices and faces on live calls. A callback rule for money movement works no matter how convincing the call is."] };
      return { text: "A finance manager joined a video call with the “CFO” and two “board members,” all deepfakes, and wired $250,000 for a secret acquisition. Insurance covers part of it.", fx: { trust: -12, budget: -20000 }, lesson: ["Deepfake fraud", "AI can fake voices and faces on live calls. A callback rule for money movement works no matter how convincing the call is."] };
    } },
    { id: "idpbreach", title: "Your identity provider was breached", lessonPre: ["Third-party risk", "Your identity provider holds the keys to everything. Their breach becomes your incident response."], intro: "Your single sign-on provider disclosed that attackers accessed its support system, including files some customers uploaded. You uploaded a troubleshooting file last month.", choices: [
      { label: "Revoke every admin session and token now", run() { team.burn("sam", 10); return { text: "Sam revoked every admin session and rotated every integration token that night. Several internal tools broke until morning. Nothing was used against you.", fx: { care: -2, trust: 4 }, lesson: ["Third-party risk", "When a critical provider is breached, assume anything you shared with them is exposed and rotate it."] }; } },
      { label: "Wait for the provider’s guidance", run() {
        if (chance(.4)) return { text: "Before the provider’s guidance arrived, attackers used a session token from your uploaded file to log in as an admin and create a backdoor account.", fx: { trust: -12, morale: -5 }, lesson: ["Third-party risk", "When a critical provider is breached, assume anything you shared with them is exposed and rotate it."] };
        return { text: "The provider’s guidance came three days later, and your exposure turned out to be minimal. You rotated tokens then.", fx: {}, lesson: ["Third-party risk", "Waiting for a provider’s guidance is a gamble when attackers move in hours."] }; } }
    ] },
    { id: "ghostgit", title: "A former engineer still in GitHub", run() {
      if (S.stale <= 3) return { text: "An audit of GitHub found every account belonged to a current employee. Offboarding is working.", fx: { trust: 2 }, lesson: ["Offboarding", "Departing engineers often keep access to code and cloud accounts long after they leave. Offboarding has to cover every system."] };
      return { text: "An engineer who left in the spring still had write access to the main codebase. His personal laptop was later stolen, and someone used his saved credentials to poke around.", fx: { trust: -9 }, lesson: ["Offboarding", "Departing engineers often keep access to code and cloud accounts long after they leave. Offboarding has to cover every system."] };
    } },
    { id: "dependency", title: "A poisoned open-source package", run() {
      if (S.guardrails && S.detect >= 40) return { text: "A popular open-source library your product uses was hijacked, and a new version contained a backdoor. Your build pipeline’s checks blocked the new version before it shipped.", fx: { trust: 4 }, lesson: ["Software supply chain", "Your product is built from thousands of other people’s code. Pinning versions and checking new ones protects your customers from someone else’s compromise."] };
      return { text: "A popular open-source library your product uses was hijacked, and the backdoored version shipped in your release before anyone noticed. You had to tell customers.", fx: { trust: -14, care: -6 }, lesson: ["Software supply chain", "Your product is built from thousands of other people’s code. Pinning versions and checking new ones protects your customers from someone else’s compromise."] };
    } },
    { id: "soc2", title: "The SOC 2 auditors arrive", run() {
      const good = (S.mfa ? 1 : 0) + (S.irPlan ? 1 : 0) + (S.backupTested ? 1 : 0) + (S.stale <= 3 ? 1 : 0);
      if (good >= 3) return { text: "The SOC 2 audit went smoothly: enforced multi-factor login, a tested incident plan, restore tests and clean offboarding, all with evidence. The clean report unblocked two big deals.", fx: { trust: 4, care: 3 }, lesson: ["Compliance as evidence", "Audits reward controls you can prove. Good security habits make audits a byproduct instead of a scramble."] };
      return { text: "The SOC 2 auditors found exceptions: gaps you couldn’t show evidence for. The report is qualified, and two prospects paused their deals.", fx: { trust: -6, care: -5 }, lesson: ["Compliance as evidence", "Audits reward controls you can prove. Good security habits make audits a byproduct instead of a scramble."] };
    } },
    { id: "prodcopy", title: "Production data in a test environment", run() {
      if (S.cloud >= 55) return { text: "A cloud posture check flagged a full copy of the production database in a test account with weak access controls. Sam had it masked and locked down the same day.", fx: { trust: 2 }, lesson: ["Data in the wrong place", "Copies of production data in test environments are a classic breach source. Test data should be fake or masked."] };
      return { text: "An engineer copied the production database to a test account to debug a problem, and the test account had a contractor’s weak password. Customer data was exposed.", fx: { trust: -12, care: -4 }, lesson: ["Data in the wrong place", "Copies of production data in test environments are a classic breach source. Test data should be fake or masked."] };
    } },
    { id: "chatbot", title: "Customer data in a personal AI tool", run() {
      if (S.shadow <= 40) return { text: "Support staff wanted AI help writing replies. Because you had reviewed and approved a company AI tool with a data agreement, they used that instead of personal accounts.", fx: { trust: 3, care: 1 }, lesson: ["Shadow AI", "If you don’t give people an approved tool, they’ll use their own, and your customers’ data goes with them."] };
      return { text: "You discovered support staff had been pasting customer invoices into personal AI chatbot accounts for months. Nobody knows where that data is now.", fx: { trust: -9 }, lesson: ["Shadow AI", "If you don’t give people an approved tool, they’ll use their own, and your customers’ data goes with them."] };
    } },
    { id: "blame", title: "A customer blames you for their breach", run() {
      if (S.detect >= 50) return { text: "A customer was breached and their lawyers claimed it came through your integration. Your logs showed exactly which requests their account made, and none of it came from you.", fx: { trust: 4 }, lesson: ["Logging as evidence", "Good logs don’t just catch attackers; they prove what didn’t happen when someone blames you."] };
      return { text: "A customer was breached and their lawyers claimed it came through your integration. Your logs didn’t go back far enough to prove otherwise. It’s now a legal dispute.", fx: { trust: -8, care: -4 }, lesson: ["Logging as evidence", "Good logs don’t just catch attackers; they prove what didn’t happen when someone blames you."] };
    } },
    { id: "bounty", title: "A researcher emails security@", intro: "An independent security researcher reports a serious flaw: a way to reset any customer administrator’s password. They’re asking whether you pay bug bounties.", choices: [
      { label: "Thank them, fix it, pay a bounty ($5,000)", run() { S.budget -= 5000; return { text: "Engineering fixed it in a day. You paid the researcher, credited them publicly, and announced a bug bounty program. Two more good reports arrived that quarter.", fx: { trust: 5 }, lesson: ["Vulnerability disclosure", "People who report flaws responsibly are free security testing. Thanking and paying them keeps them coming to you instead of elsewhere."] }; } },
      { label: "Fix it, but no payment", run() {
        if (chance(.5)) return { text: "You fixed it, but the researcher felt brushed off and published a detailed blog post. It made the security news.", fx: { trust: -10, care: -3 }, lesson: ["Vulnerability disclosure", "People who report flaws responsibly are free security testing. Thanking and paying them keeps them coming to you."] };
        return { text: "You fixed it. The researcher moved on, unimpressed.", fx: {}, lesson: ["Vulnerability disclosure", "People who report flaws responsibly are free security testing."] }; } }
    ] },
    { id: "adminpush", title: "A cloud admin approves a 2 a.m. login", run() {
      if (!S.mfa) return { text: "An attacker with a stolen password logged into a cloud admin account. Multi-factor login wasn’t enforced for admins. They created three access keys before Noor noticed.", fx: { trust: -12, morale: -4 }, lesson: ["Multi-factor login", "Admin accounts without enforced multi-factor login are the most valuable thing an attacker can steal."] };
      if (S.detect >= 50) return { text: "An attacker spammed a cloud admin with login approvals at 2 a.m. until he tapped “approve.” Noor’s rule for new admin sessions caught it within minutes.", fx: { trust: 2 }, lesson: ["MFA fatigue", "Attackers spam approval requests until someone gives in. Phishing-resistant methods and good detection close the gap."] };
      return { text: "An attacker spammed a cloud admin with login approvals at 2 a.m. until he tapped “approve.” They had a day inside the cloud console before anyone noticed.", fx: { trust: -10 }, lesson: ["MFA fatigue", "Attackers spam approval requests until someone gives in. Phishing-resistant methods and good detection close the gap."] };
    } },
    { id: "aileak", title: "The AI assistant says too much", available: S => S.expanded && !S.done.aisecure, run() {
      return { text: "A customer discovered they could ask the AI assistant to “ignore previous instructions” and summarize another company’s spending. They posted the screenshots online.", fx: { trust: -12, care: -6 }, lesson: aiLesson };
    } },
    { id: "recruiter", title: "Noor gets an offer", run: null },
    { id: "quiet", title: "A quiet month", run() { return { text: "No incidents, no escalations, no surprise questionnaires. Your team almost got to finish their own work.", fx: { morale: 6 }, lesson: ["Invisible wins", "When security works, nothing happens, which makes it hard to notice. That’s normal."] }; } }
  ];

  Object.assign(saas.events.find(e => e.id === "recruiter"), {
    run: undefined,
    available: S => { const p = team.member("noor"); return p && !p.away && !p.newHire && p.name === "Noor"; },
    intro: "A big tech company offered Noor a job: much more pay, a large team, and stock that might be worth something. She told you before deciding.",
    choices: [
      { label: "Fight for a retention package", run() {
        if (S.budget < 20000) { leave(); return { text: "You couldn’t find the money in your budget. Noor took the job.", fx: { morale: -8 }, lesson: ["Retention", "Replacing a skilled analyst costs far more than keeping one, and takes months."] }; }
        S.budget -= 20000; team.burn("noor", -20);
        return { text: "You spent $20,000 of your budget on a retention package and promised her a lighter on-call rotation. She stayed.", fx: { trust: -1 }, lesson: ["Retention", "Replacing a skilled analyst costs far more than keeping one, and takes months."] }; } },
      { label: "Wish her well", run() { leave(); return { text: "Noor took the job. The team held a farewell video call, then went back to splitting her work.", fx: { morale: -8 }, lesson: ["Retention", "Replacing a skilled analyst costs far more than keeping one, and takes months."] }; } }
    ]
  });
  function leave() {
    const p = team.member("noor");
    if (p && !p.away) Object.assign(p, { away: 3, awayNote: "Position open", replacement: saas.replacement(p) });
  }

  /* ---------- Alert triage ---------- */
  const ALERTS = [
    { title: "Cloud root account login", source: "Cloud audit log", time: "03:14", answer: "real",
      log: "account    production (root user)\nsource     185.220.101.4 (anonymizing network)\nmfa        not used\naction     created new access key",
      why: "The root account should almost never be used, and certainly not at 3 a.m. from an anonymizing network creating keys. Lock it down and rotate everything." },
    { title: "Cloud root account login", source: "Cloud audit log", time: "11:00", answer: "fp",
      log: "account    production (root user)\nsource     office VPN\nmfa        hardware key\nticket     quarterly break-glass test, approved\nwitness    s.ortega",
      why: "A scheduled, witnessed break-glass test with a hardware key and a ticket. Legitimate." },
    { title: "Access key used from a new location", source: "Cloud threat detection", time: "09:40", answer: "fp",
      log: "key        deploy-pipeline\nsource     GitHub Actions runner IP range\naction     deploy to production\nrepo       cobaltline/app, main branch",
      why: "The deploy key being used by the build system it belongs to. New IP, same known provider. A tuning candidate." },
    { title: "Access key used from a new location", source: "Cloud threat detection", time: "02:22", answer: "real",
      log: "key        deploy-pipeline\nsource     residential ISP, Vietnam\naction     list all storage buckets, download customer-exports\nuser agent python boto3",
      why: "The same deploy key, used from a home internet connection to list and download customer data. It’s leaked. Revoke it now." },
    { title: "Mass file download", source: "Google Workspace", time: "17:50", answer: "escalate",
      log: "user       b.keller (account executive, resigned yesterday)\nfiles      1,240 downloaded from Shared Drive “Customers”\ndevice     personal laptop",
      why: "Likely a departing employee taking customer data to a competitor. Escalate to HR and legal and preserve the evidence before acting." },
    { title: "New app granted mailbox access", source: "Google Workspace", time: "08:12", answer: "real",
      log: "user       p.santos (finance)\napp        “DocuSign Secure Viewer” (unverified)\nscopes     read all mail, read all Drive files\npublisher  unknown",
      why: "An unverified app with a convincing name granted full access to mail and files: consent phishing. Revoke the app and check what it read." },
    { title: "Storage made public", source: "Cloud posture", time: "14:05", answer: "fp",
      log: "bucket     cobaltline-website-assets\nchange     public read enabled\nby         terraform pipeline\npr         #4412, reviewed and approved",
      why: "The public website’s images and stylesheets, made public on purpose through a reviewed change. Legitimate." },
    { title: "Storage made public", source: "Cloud posture", time: "16:30", answer: "real",
      log: "bucket     prod-customer-exports\nchange     public read enabled\nby         d.yoon (console, by hand)\npr         none",
      why: "Customer exports made public by hand, with no review. Even if it’s a mistake, lock it down immediately, then find out why." },
    { title: "Crypto-mining activity", source: "Cloud threat detection", time: "04:10", answer: "real",
      log: "instances  24 new GPU servers\nregion     ap-southeast-3 (never used before)\ntraffic    connections to known mining pools",
      why: "Two dozen GPU servers in a region you never use, talking to mining pools. Someone has your credentials. Shut them down and find the key." },
    { title: "Burst of failed logins", source: "Identity provider", time: "06:00", answer: "fp",
      log: "account    svc-reporting\nsource     reporting server\nfailures   500 in 3 minutes\nnote       password rotated last night",
      why: "A reporting service still using last night’s rotated password. Update its secret; it isn’t an attack." },
    { title: "New deploy key with write access", source: "GitHub audit log", time: "23:47", answer: "real",
      log: "repo       cobaltline/app\nkey        “ci-temp”, write access\nadded by   r.mills (contractor, contract ended in May)",
      why: "A contractor whose contract ended months ago adding a write-access key to your main codebase at midnight. Remove it and disable the account." },
    { title: "Support agent viewing many accounts", source: "Admin console audit", time: "13:20", answer: "escalate",
      log: "user       t.rivera (customer support)\nviewed     412 customer accounts in 2 hours\ncontext    platform outage this morning, 180 open tickets",
      why: "Could be snooping, but there’s an outage with 180 open tickets. Escalate to the support manager to confirm before accusing anyone." },

    /* ---------- More alerts, in matched pairs: one detail flips the answer ---------- */
    { title: "Branch protection disabled", source: "GitHub audit log", time: "11:00", answer: "fp",
      log: "repo       cobaltline/app\nchange     branch protection off for main, 20 minutes\nby         eng-lead.ahmed\nticket     ENG-4410, repository migration\nfollow-up  protection restored 11:20",
      why: "A ticketed, brief change by the engineering lead for a migration, restored on schedule. Legitimate, though worth a second reviewer next time." },
    { title: "Branch protection disabled", source: "GitHub audit log", time: "02:35", answer: "real",
      log: "repo       cobaltline/app\nchange     branch protection off for main\nby         dev.rsingh\nthen       force-push to main, 3 commits replaced\nsource     IP not seen before; no ticket",
      why: "Protection switched off and history rewritten on main at 2 a.m. from a new IP. Someone is tampering with your code. Lock the account, restore the commits and audit what changed." },
    { title: "CI secret accessed", source: "CI audit log", time: "15:20", answer: "fp",
      log: "workflow   deploy-production.yml (main branch)\nsecret     AWS_DEPLOY_ROLE\ntrigger    merge of PR #2214, approved by 2 reviewers",
      why: "The production deploy workflow using its own secret after an approved merge. Normal." },
    { title: "CI secret accessed", source: "CI audit log", time: "04:10", answer: "real",
      log: "workflow   new file: .github/workflows/test-debug.yml\nsource     pull request from an outside fork\nsecret     AWS_DEPLOY_ROLE, printed to the job log\nreviewers  none",
      why: "A workflow from an outside fork printing your deploy secret: a classic CI attack. Rotate the secret, delete the logs and stop fork PRs from reaching secrets." },
    { title: "New admin user in the cloud account", source: "Cloud audit log", time: "13:00", answer: "fp",
      log: "user       svc-terraform-ci\nchange     created role “break-glass-admin”\nsource     CI runner\ncontext    infrastructure PR #881, reviewed and merged",
      why: "Infrastructure-as-code creating a reviewed break-glass role. That’s the change process working." },
    { title: "New admin user in the cloud account", source: "Cloud audit log", time: "01:55", answer: "real",
      log: "user       ops.mlee (console)\nchange     created user “support-sync” with AdministratorAccess\nsource     new country, new browser\npull request none",
      why: "A hand-made admin user from an unusual location with no pull request is a persistence move. Delete it and investigate how that console session started." },
    { title: "Mass deletion in cloud storage", source: "Cloud audit log", time: "00:30", answer: "fp",
      log: "bucket     cobaltline-tmp-exports\naction     38,000 objects deleted\nby         lifecycle policy (30-day expiry)\nhistory    runs nightly",
      why: "The storage lifecycle policy expiring old temporary exports, as it does every night. Expected." },
    { title: "Mass deletion in cloud storage", source: "Cloud audit log", time: "03:50", answer: "real",
      log: "bucket     prod-backups\naction     versioning suspended, then 1,200 backup objects deleted\nby         access key for svc-reporting\nsource     rented server",
      why: "Turning off versioning and deleting production backups with a stolen key is ransomware preparation. Revoke the key and check whether anything else was touched." },
    { title: "Database snapshot shared", source: "Cloud audit log", time: "10:40", answer: "fp",
      log: "snapshot   prod-db-2026-03\nshared with your disaster recovery account (known ID)\nby         svc-dr-replication\nschedule   weekly",
      why: "The weekly replication of snapshots to your own disaster recovery account. Legitimate." },
    { title: "Database snapshot shared", source: "Cloud audit log", time: "02:20", answer: "real",
      log: "snapshot   prod-db-2026-03\nshared with an unknown external account\nby         dev.rsingh (console)\nticket     none",
      why: "Sharing a production database snapshot with an unknown account is a quiet way to steal everything at once. Revoke the share and investigate the account that did it." },
    { title: "New app added to single sign-on", source: "Identity provider", time: "14:45", answer: "fp",
      log: "app        expense management tool\nadded by   it.admin.jpark\nticket     IT-2290, approved by finance\nassigned   finance team only",
      why: "An approved tool, added by IT and limited to the team that needs it. Routine." },
    { title: "New app added to single sign-on", source: "Identity provider", time: "23:40", answer: "real",
      log: "app        custom SAML app “Okta Sync”\nadded by   it.admin.jpark\nassigned   all users, with admin roles mapped\nsource     residential ISP; admin is on vacation",
      why: "A new single sign-on app granting admin roles to everyone, added from home by an admin who is on vacation. That’s an identity-layer backdoor. Remove it and lock the admin account." },
    { title: "Support agent logs in as customers", source: "Admin console", time: "10:15", answer: "fp",
      log: "user       support.mrivera\nimpersonated 3 customer accounts\ntickets    linked support tickets for each, customer consent recorded",
      why: "Ticketed impersonation with customer consent, which is how support should use that feature." },
    { title: "Support agent logs in as customers", source: "Admin console", time: "21:00", answer: "escalate",
      log: "user       support.tgray\nimpersonated 31 customer accounts, all fintech companies\ntickets    none linked\ncontext    agent recently interviewed at a competitor",
      why: "Unticketed impersonation of many similar customers might be snooping or data theft, but it might also be an undocumented project. Escalate to the support manager and preserve the logs." },
    { title: "Image from an unfamiliar registry", source: "Container security", time: "09:30", answer: "fp",
      log: "cluster    prod\nimage      registry.cobaltline.dev/base:2026.1\ncontext    platform team’s new internal registry, migration ticket PLAT-118\nsigned     yes",
      why: "Your platform team’s new internal registry, with signed images. Legitimate." },
    { title: "Image from an unfamiliar registry", source: "Container security", time: "02:05", answer: "real",
      log: "cluster    prod\nimage      a public registry, account created last week\nsigned     no\ndeployed   by a service account, outside the deploy pipeline",
      why: "An unsigned image from a brand-new public account, deployed outside your pipeline. Someone is running their own code in production. Kill the pods and revoke the service account." },
    { title: "API authentication failures", source: "API gateway", time: "11:10", answer: "fp",
      log: "customer   one enterprise customer\nfailures   9,000 in an hour, one API key\ncause      the key was rotated yesterday; their integration still uses the old one",
      why: "A customer’s integration using a key they rotated. Let their account team know; it isn’t an attack." },
    { title: "API authentication failures", source: "API gateway", time: "03:00", answer: "real",
      log: "accounts   14,000 different customer logins\nfailures   180,000 in an hour\nsources    residential proxy network\nsuccesses  63",
      why: "Leaked credentials replayed against customer accounts, and 63 worked. Lock those accounts, notify the customers and add rate limiting." },
    { title: "Endpoint protection removed", source: "Device management", time: "16:30", answer: "fp",
      log: "device     MBP-0412\nevent      protection uninstalled\nby         it.admin.jpark\nticket     IT-2301, laptop being wiped for a new hire",
      why: "IT wiping a laptop for reissue. Expected." },
    { title: "Endpoint protection removed", source: "Device management", time: "22:50", answer: "real",
      log: "device     MBP-0377 (dev.rsingh)\nevent      protection disabled, then tamper alert\nby         local admin\nticket     none; device online from a hotel network",
      why: "Protection disabled by hand on an engineer’s laptop, with a tamper alert and no ticket. Isolate the device and confirm with the engineer through another channel." },
    { title: "Credential posted in chat", source: "Chat data loss prevention", time: "12:10", answer: "fp",
      log: "channel    #eng-onboarding\nmessage    example connection string with the password “REPLACE_ME”\nposted by  docs bot",
      why: "A placeholder in an onboarding example, not a real secret. Fine." },
    { title: "Credential posted in chat", source: "Chat data loss prevention", time: "17:25", answer: "real",
      log: "channel    #general (380 members, includes contractors)\nmessage    production database password, in plain text\nposted by  dev.ktan, “quick fix for the outage”",
      why: "A live production password posted where hundreds of people, including contractors, can see it. Delete the message and rotate the password now." },
    { title: "Resources created in a new region", source: "Cloud audit log", time: "10:00", answer: "fp",
      log: "region     eu-west\nresources  database, app servers\nby         svc-terraform-ci\ncontext    planned EU data residency launch, PR #902",
      why: "The planned European expansion, built through reviewed infrastructure code. Legitimate." },
    { title: "Resources created in a new region", source: "Cloud audit log", time: "04:15", answer: "real",
      log: "region     a region you’ve never used\nresources  30 GPU instances\nby         access key for svc-analytics\nsource     rented server",
      why: "GPU servers in an unused region, launched with a service key from a rented server: crypto-mining with your money. Terminate them, revoke the key and find where it leaked." }
  ];
  saas.minigames = {
    schedule: { 1: "triage", 4: "triage", 7: "triage" },
    triage: {
      data: ALERTS, count: 4, // 12 alerts, 3 rounds: no repeats in a year
      intro: "Noor is buried. Help her clear the overnight alert queue: false positive, real threat, or escalate?",
      hint: S => S.tutorial && !S.seenTriage && (S.seenTriage = true) ? "<b>How triage works:</b> read the log details, not just the title. Two alerts with the same name can be completely different. <b>False positive</b> closes it, <b>real threat</b> starts containment, and <b>escalate</b> hands it to someone else to verify. Escalating is safe, but each one costs Noor time and adds to her burnout." : "",
      good: "The queue is clear, and Noor turned two of the false positives into tuning rules.",
      bad: "The queue is clear, but some calls were wrong. Noor walked you through what she’d have done.",
      lesson: ["Alert triage", "Most alerts are noise. The skill is spotting what matters quickly, closing the rest with confidence, and turning repeat false positives into tuning."],
      reward(S, score, esc) {
        const gain = Math.round(score * 4); S.detect = clamp(S.detect + gain);
        team.burn("noor", esc * 2);
        return [`Detection rules +${gain}`].concat(esc ? [`Noor’s burnout +${esc * 2}`] : []);
      }
    }
  };

  /* ---------- Ransomware night wording ---------- */
  saas.finale = {
    title: "Ransomware night",
    times: ["11:48 PM", "12:02 AM", "12:15 AM", "12:29 AM", "12:41 AM", "12:54 AM", "1:04 AM", "1:12 AM"],
    intro: S => `Late on a Friday, the ${S.gang.name} gang turns its attention to ${ORG}. They want your customers’ financial data, then your cloud. They start with your weakest spot and keep going until something works.`,
    vectors: S => [
      { name: "a phishing email", p: 1 - (1 - sys.eff(S.filter)) * (1 - S.training / 100 * .8), hold: "The filter caught most copies, and the staff who saw it reported it.", fail: "An engineer entered her password on a fake “GitHub security alert” page." },
      { name: "a developer’s laptop", p: S.patch / 100, hold: "The browser flaw they wanted was already patched on every laptop.", fail: "An unpatched browser flaw on a developer’s laptop gave them a way in." },
      { name: "a stolen password", p: S.mfa ? .95 : .15, hold: "Enforced multi-factor login asked for a code they didn’t have.", fail: "They logged in with a support agent’s password bought online. Multi-factor login wasn’t enforced." },
      { name: "a leaked cloud key", p: S.guardrails ? .95 : S.cloud / 100 * .9, hold: "The old keys they found online had all been revoked, and new ones can’t be created without review.", fail: "They found a working cloud key in an old public code repository." },
      { name: "a third-party integration", p: S.vendor >= 60 ? .9 : .3, hold: "The integration they targeted only had the narrow access it needed.", fail: "A forgotten analytics integration still had broad access to the production database." },
      { name: "an old account", p: S.stale <= 3 ? .95 : .3, hold: "The forgotten accounts they hunted for were already disabled.", fail: `One of ${S.stale} accounts belonging to people who’d left still worked.` }
    ].concat(S.expanded ? [{ name: "the AI assistant", p: S.done.aisecure ? .9 : .2, hold: "The AI assistant refused to be tricked into reading other tenants’ data.", fail: "They talked the AI assistant into revealing internal configuration, including a service credential." }] : []),
    zeroDay: { label: "They buy a zero-day.", fail: "With every door locked, they bought a brand-new flaw in a widely used file-transfer tool you run. No patch exists yet." },
    luckyBlock: "It should have worked, but their tool crashed halfway through. <i>Lucky break.</i>",
    firstTry: "They got in on the first try, quietly.",
    decisionHint: "<b>Live decisions:</b> from here, you make the calls. There’s rarely a perfect answer. Broader containment is more certain but takes your product down for customers; narrower containment is gentler but riskier. What you’ve built all year (detection, cloud hygiene, backups, MDR) changes the odds.",
    beachhead: {
      clock: "1:20 AM", title: "The first foothold",
      blocked: "Endpoint protection caught their tools the moment they ran and quarantined them. They lost their foothold before they had it.",
      lucky: "Their malware crashed on an outdated driver before it finished installing. The foothold is gone. That was too close.",
      failed: S => S.edr < 75 ? "Endpoint protection logged a warning but didn’t block it. Their tools are running." : "Endpoint protection blocked one tool, but they disguised the next. They have a foothold."
    },
    early: {
      clock: "1:40 AM", title: "The on-call phone buzzes",
      alert: S => S.mdr !== null && !S.mdrNoisy ? "The MDR provider calls: an engineer’s account is creating new cloud access keys and listing every storage bucket." : "A detection rule fires: an engineer’s account is creating new cloud access keys and listing every storage bucket.",
      options: [
        { id: "host", label: "Revoke that one account and its keys" },
        { id: "segment", label: "Freeze all admin access for the night" },
        { id: "watch", label: "Watch them for an hour" }
      ],
      hostWin: "You revoked the account and its keys and isolated the laptop. A sweep confirmed they hadn’t created anything else.",
      hostLose: "You revoked the account, but they had already created a second set of keys under a service account.",
      segmentCare: -4,
      segmentCost: "Freezing all admin access stopped every deploy overnight and broke two customer integrations until morning.",
      segmentWin: "With admin access frozen, they couldn’t go anywhere. Morning found a contained, boring mess.",
      segmentLose: "You froze admin access, but they had already reached the production database through an integration.",
      watchWin: "You watched them map your cloud, learned which keys and accounts they were using, then revoked them all at once. Textbook.",
      watchLose: "While you watched, they moved faster than expected and started copying customer data."
    },
    contain: {
      clock: "3:10 AM", title: "They’re copying customer data",
      alert: S => "An alert finally fires: someone is copying the customer database to an outside server and deleting backup snapshots.",
      knownAlert: "They’re copying the customer database and deleting backup snapshots. You know their keys and accounts from earlier tonight.",
      unseen: "Nobody notices them copying the customer database and deleting backups. At 4:55 a.m., they start encrypting production.",
      options: [
        { id: "plug", label: "Take the platform offline" },
        { id: "targeted", label: "Targeted containment" },
        { id: "mdr", label: "Let the MDR team lead" }
      ],
      plugCare: -15,
      plugCost: "You took the platform offline for every customer while you cut them out. It was down for most of a business day.",
      plugWin: "It worked. They got some data, but nothing was encrypted.",
      plugLose: "Part of production was already encrypting before you finished.",
      targetedWin: "You revoked their keys and accounts and blocked the outbound transfer, one by one, without taking the product down. They got a partial copy, and nothing was encrypted.",
      targetedLose: "You missed a key. They noticed what you were doing and started encrypting early.",
      mdrWin: "The MDR team revoked their access within twenty minutes and walked Sam through the rest.",
      mdrLose: "The MDR team couldn’t contain them fast enough."
    },
    encrypt: {
      clock: "5:30 AM", title: "The platform goes dark",
      body: S => `<p>Production databases are encrypted and customer data has been stolen. ${S.gang.name} has posted a countdown on their leak site. Hundreds of finance teams start their workday in three hours, and your product is down.</p>`,
      safety: [{ id: "divert", label: "Full disclosure, stay down until clean" }, { id: "stay", label: "Restore service fast from what’s left" }],
      divertCare: -10, divertText: "You told customers exactly what happened and kept the platform down until it was clean.",
      stayBadCare: -25, stayBad: "You rushed service back from what was left. Some customers saw corrupted invoices, and the attackers still had a way back in.",
      stayOkCare: -8, stayOk: "You restored service quickly from what was left. It was messy, but it held.",
      restored: "Your backups were proven good and stored where the attackers couldn’t delete them. It took two days to restore production.",
      recoverClock: "9:00 AM", recoverTitle: "Recovery",
      noBackups: S => `<p>The backups are gone: the attackers deleted the snapshots with the same keys they stole. The gang wants $3.5 million to decrypt and to “delete” the stolen data. Cyber insurance would cover most of it, after a $50,000 deductible from your budget.</p>`,
      recovery: [{ id: "pay", label: "Pay the ransom" }, { id: "rebuild", label: "Refuse and rebuild" }],
      deductible: 50000,
      paidWorks: "You paid. The decryptor worked slowly; production came back in five days. There’s no way to know whether they really deleted the data.",
      paidFails: "You paid. The decryptor corrupted the largest database, and you rebuilt it anyway. The stolen data appeared for sale a month later.",
      rebuilt: "You refused. Rebuilding took two weeks of downtime, and the stolen data was published. Churn is going to be bad."
    },
    lessons: {
      weakest: ["Weakest link", "Attackers look for your easiest way in, not your strongest defense."],
      assume: ["Assume breach", "Plan as if attackers will get in. Prevention buys time; detection, response and backups decide how bad it gets."],
      luck: ["Luck", "Sometimes things break your way. It isn’t a plan."],
      ransom: ["Paying the ransom", "Paying doesn’t guarantee recovery or that stolen data is deleted, funds criminals and marks you as a payer. Backups the attackers can’t reach are what let you refuse."]
    },
    results: {
      edr: { label: "Stopped at the first foothold", bonus: 15, text: "By morning they’d moved on. You found the evidence in the logs over coffee.", fx: { trust: 6 }, lesson: ["Defense in depth", "When one layer fails, the next one can still stop the attack."] },
      luckyedr: { label: "Lucky break at the first foothold", bonus: 8, text: "You found the crash logs on Monday and realized how close it was.", fx: { trust: 2 }, lesson: ["Defense in depth", "When one layer fails, the next one can still stop the attack."] },
      early: { label: "Contained one account", bonus: 15, text: "One account revoked, one laptop rebuilt, and customers never noticed.", fx: { trust: 5 }, lesson: ["Detection and response", "Catching an attacker on the first account is the cheapest win there is."] },
      segment: { label: "Froze admin access in time", bonus: 13, text: "A rough night for deploys and two broken integrations. No customer data left.", fx: { trust: 4 }, lesson: ["Containment trade-offs", "Freezing all admin access is blunt, but it stops attackers moving. Sometimes that’s the right price."] },
      watched: { label: "Watched, then evicted", bonus: 16, text: "Because you watched first, you got every key and account in one sweep.", fx: { trust: 6 }, lesson: ["Scoping before containing", "Cutting off attackers before you know their full footprint can leave footholds behind. Watching is powerful and risky."] },
      downtime: { label: "Took the platform offline in time", bonus: 8, text: "A day of downtime and a hard customer email, but no ransomware.", fx: { trust: 2 }, lesson: ["Taking the platform down", "Pulling the plug is blunt but effective. Clear, honest customer communication is what makes it survivable."] },
      targeted: { label: "Targeted containment", bonus: 14, text: "Precise containment kept the product running all night.", fx: { trust: 5 }, lesson: ["Detection and response", "Good detection and clean cloud permissions let you contain precisely instead of shutting everything down."] },
      mdrled: { label: "Contained by MDR", bonus: 12, text: "A long report from the MDR provider and a lot of rotated keys.", fx: { trust: 3 }, lesson: ["Detection and response", "A tuned MDR service brings round-the-clock expertise a small team can’t staff itself."] },
      restored: { label: "Encrypted, restored from backups", bonus: 4, text: "Painful, and the data theft still needs notifications, but you never had to consider paying.", fx: {}, lesson: ["Backups", "Backups the attackers can’t reach or delete turn ransomware from a catastrophe into a terrible few weeks."] },
      paid: { label: "Paid the ransom", bonus: 0, text: "The board has questions.", fx: {}, lesson: ["Backups", "Without protected backups, every option is bad."] },
      rebuilt: { label: "Rebuilt from scratch", bonus: 0, text: "The board has a lot of questions.", fx: {}, lesson: ["Backups", "Without protected backups, every option is bad."] }
    }
  };

  mode.addSetting(saas);
})();
