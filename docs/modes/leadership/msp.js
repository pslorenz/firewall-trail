/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Leadership setting: owner of a 25-person MSP.
 * The same Keystone Managed IT as practitioner mode, seen from the owner’s
 * chair. Alongside the security report, you watch the numbers MSP owners
 * actually run on: monthly recurring revenue, gross margin, client count and
 * churn, technician utilization, SLA attainment and security attach rate.
 * A private equity partner holds a stake and reviews every quarter.
 * The pull: margin and growth versus the shared stack that protects every
 * client, and the exceptions that keep big clients happy. */
(function () {
  const S = FT.S, { chance, clamp, money } = FT.util;
  const mode = FT.modes.leadership;
  const M = n => FT.ui.compact(n);

  /* ---------- Who owns Keystone this year (random, from the year’s seed) ---------- */
  const OWN = {
    owner: { label: "Your bank", short: "Bank", word: "your banker", title: "check-in with your banker", intro: "Over lunch, your banker reviews the quarter with you and asks:",
      who: "your bank", briefing: "<b>You own Keystone Managed IT outright:</b> 25 people, about 70 clients and $310,000 in monthly recurring revenue. No investors and no growth targets, but a $1 million line of credit with your personal guarantee on it.",
      note: "Owner-operated. A $1M line of credit, personally guaranteed." },
    minority: { label: "PE partner", short: "Partner", word: "your PE partner", title: "review with your PE partner", intro: "Your private equity partner, Hollis Capital, reviews the quarter. Their operating partner asks:",
      who: "Hollis Capital", briefing: "<b>You own Keystone Managed IT:</b> 25 people, about 70 clients, $310,000 in monthly recurring revenue, and a private equity partner, Hollis Capital, who bought a 40% stake last year and expects growth and margin.",
      note: "Hollis Capital holds a 40% stake." },
    platform: { label: "Platform owners", short: "Owners", word: "Apex", title: "review with Apex", intro: "Apex Platform Partners, your owners, review the quarter. Their operating partner asks:",
      who: "Apex Platform Partners", briefing: "<b>You run Keystone Managed IT for Apex Platform Partners,</b> the private-equity-backed roll-up that bought it two years ago: 25 people, about 70 clients, $310,000 in monthly recurring revenue, and a standing profitability plan with budgets 20% below what you’d like.",
      note: "Part of Apex Platform Partners. Profitability plan in effect." }
  };
  const own = () => OWN[S.own || "minority"];
  function ownerMeter(key) { const o = OWN[key]; mode.meters[0] = { key: "board", label: o.label, short: o.short }; }

  // Gross margin: busy techs make money, until they don't; bundled security pays better
  const margin = S => Math.round(36 + (S.util - 70) * .6 + S.attach * .1 + (S.stackSave || 0));

  const peLesson = ["Private equity and security", "Profitability programs often cut security first, because its value is invisible until an incident. Owners who can show security as revenue and risk reduction keep it funded."];

  // Owner-operated: a roll-up offers to buy you. Selling is your choice.
  function offerToBuy() {
    const sell = (cut, text, fx) => {
      S.own = "platform"; S.platform = true; S.noGrowthPressure = false; ownerMeter("platform");
      S.qMult = (S.qMult || 1) * cut; S.budget = Math.round(S.budget * cut); S.board = 55;
      S.cutNote = `Sold to Apex Platform Partners. Profitability plan in effect: budgets cut ${Math.round((1 - cut) * 100)}%.`;
      return { text, fx, lesson: ["Selling to a roll-up", "Selling brings liquidity and a new boss with a profitability plan. What you negotiate before signing, including security, is what survives after."] };
    };
    FT.screens.choiceEvent({
      id: "offer", title: "An offer to buy Keystone",
      intro: "Apex Platform Partners, a private-equity-backed MSP roll-up, offers to buy Keystone outright: a life-changing check, and you stay on as president. They’re clear that a profitability plan comes with it.",
      choices: [
        { label: "Sell", run: () => sell(.7, "You signed. The check cleared, your personal guarantee is gone, and Apex’s profitability plan cut your budgets 30% the next morning.", { lead: -6 }) },
        { label: "Sell, with security in the deal", run: () => {
          if (chance(.5)) return sell(.85, "You made a protected security budget a condition of the sale. Apex agreed, grudgingly. Budgets still dropped 15%, but Morgan’s team is written into the deal.", { lead: 8 });
          return { text: "Apex walked away rather than accept conditions. You’re still independent, with your banker watching closely.", fx: { board: -2 }, lesson: ["Selling to a roll-up", "Selling brings liquidity and a new boss with a profitability plan. What you negotiate before signing, including security, is what survives after."] };
        } },
        { label: "Stay independent", run: () => ({ text: "You turned it down. Your banker approved, and the team was relieved.", fx: { board: 3, lead: 4 }, lesson: ["Selling to a roll-up", "Staying independent keeps control, and keeps the risk personal."] }) }
      ]
    });
  }

  // Already a platform company: Apex mandates the platform's standard tools.
  function platformMandate() {
    FT.screens.choiceEvent({
      id: "mandate", title: "Apex mandates the platform stack",
      intro: "Apex wants every platform company on the same RMM, PSA and security tools within 90 days, to cut licensing costs. Your stack, and your security configuration, would be replaced mid-year.",
      choices: [
        { label: "Migrate fast, as ordered", run: () => { S.d.vendor = clamp(S.d.vendor - 15); S.d.detect = clamp(S.d.detect - 10); S.stackSave = (S.stackSave || 0) + 3; return { text: "You migrated in 60 days. Licensing costs dropped. Morgan spent months rebuilding the security settings that didn’t come across.", fx: { board: 5, lead: -8 }, lesson: peLesson }; } },
        { label: "Migrate in phases, with security review", run: () => ({ text: "You migrated client by client, reviewing each security configuration. Apex grumbled about the timeline.", fx: { board: -4, lead: 6 }, lesson: peLesson }) },
        { label: "Ask to keep your own stack", run: () => {
          if (chance(.5)) return { text: "You showed Apex your security results and attach rate. They let you keep your stack, for now.", fx: { board: -1, lead: 4 }, lesson: peLesson };
          S.d.vendor = clamp(S.d.vendor - 15); S.d.detect = clamp(S.d.detect - 10);
          return { text: "Apex said no, and you migrated in a rush anyway, now behind schedule.", fx: { board: -6, lead: -6 }, lesson: peLesson };
        } }
      ]
    });
  }

  mode.addSetting({
    id: "msp", letter: "K", name: "Keystone Managed IT", short: "MSP",
    summary: "A 25-person MSP with about 70 clients and a private equity partner. Margin and growth pull against the shared stack that protects every client.",
    chief: "Your operations manager",
    lead: { name: "Morgan Lee, your security lead", short: "Morgan" },
    boardLabel: "PE partner", boardShort: "Partner",
    get boardWord() { return own().word; },
    get boardTitle() { return own().title; },
    get boardIntro() { return own().intro; },
    missionLabel: "Client retention", missionShort: "Retention",
    trustLabel: "Reputation", trustShort: "Reputation",
    landmarks: ["Annual planning", "Price increase season", "Peer group conference", "Year-end"],
    quarterBudget: 650000, opsCost: 200000,
    margin,
    growth: { name: "Fund a sales push", cost: 250000, desc: "A sales rep and local marketing for new managed clients. More recurring revenue, and more work for your techs.", income: 60000, care: 2, done: "Funded a sales push. New clients are signing.",
      apply: S => { S.clients += 4; S.mrr += 18000; S.util = Math.min(98, S.util + 3); } },
    get briefing() { return own().briefing; },
    tips: [
      "This is Morgan’s security report. Notice the confidence line at the bottom: right now, it’s only partly reliable. It shows what Morgan can see across your stack and 70 clients, which is usually rosier than reality. An independent assessment makes next quarter’s report accurate.",
      "This is your business dashboard: the numbers your owners and lenders watch. Utilization drives margin, until techs burn out and SLAs slip. Security spending competes with sales and hiring. And the security bundle is both protection and revenue.",
      "Your inbox: decisions only you can make. Many are about exceptions, for big clients or for yourself. At an MSP, every exception is a soft spot in a stack that reaches every client.",
      "This is a crisis decision. When your own tools are the weapon, every choice affects dozens of clients at once. Preparation (a retainer, immutable backups, a security lead who trusts you) decides how many good options you have."
    ],
    askText: {
      mfa: { name: "Enforce MFA on every tool and every tech", desc: "RMM, PSA, vault, backup and remote access consoles, and every technician account." },
      backups: { name: "Immutable backups for every client", desc: "Backups that can’t be deleted, even with your own admin credentials, restore-tested quarterly." },
      mdr: { name: "24/7 SOC partner for the stack and clients", desc: "Outside analysts watching your tools and every client around the clock, tuned to tell your techs from attackers." },
      ir: { name: "Incident response retainer and a client crisis plan", desc: "Responders on call, and a rehearsed plan for notifying and supporting every client at once." }
    },
    rowLabels: { "Vendor access": "RMM and admin access", "Executive exceptions": "Exceptions (yours and clients’)" },
    skipDilemmas: ["boardemail"],
    customer: "regional bank", legacy: "the acquired MSP’s old on-premises RMM server, which still manages 12 clients", legacyShort: "Old RMM server",
    acquisition: "a retiring owner’s MSP with 18 clients", dataName: "every client’s credentials and data", regulator: "Your clients’ lawyers and two state attorneys general", public: "clients",
    crisisImpact: "Attackers used your own RMM to push ransomware to 23 clients overnight. Every phone line is lit.",
    ransom: 4500000,
    opsQuestion: "Your RMM is both the attackers’ weapon and your clients’ lifeline. <b>Do you shut it off for every client?</b>",
    opsSafe: "Shut it off everywhere", opsSafeText: "You shut off the RMM for all 70 clients. Support slowed to a crawl, but the attackers lost their weapon.",
    opsRisky: "Keep it on for unaffected clients", opsRiskyBad: "You kept it running for the unaffected clients. The attackers still had access, and pushed to 11 more before you finally pulled the plug.", opsRiskyOk: "You kept it running for unaffected clients, and the attackers didn’t come back.",
    deaths: {
      board: S => S.own === "owner" ? "Your bank called the line of credit you personally guaranteed. You sold the company to cover it." : `${own().who} replaced you as head of the company you built.`,
      ransomware: S => S.own === "owner" ? "Your MSP has died of ransomware, and your personal guarantee went with it." : `Your MSP has died of ransomware. ${own().who} replaced you.`,
      care: S => `Clients left in droves. ${S.own === "owner" ? "You sold what was left of the book to a competitor." : S.own === "platform" ? "Apex folded what was left into another platform company." : "Hollis Capital forced a sale of the book."}`,
      trust: S => `Your reputation in the local market collapsed. ${S.own === "owner" ? "You sold what was left of the book to a competitor." : S.own === "platform" ? "Apex folded what was left into another platform company." : "Hollis Capital forced a sale."}`
    },

    newState(state) {
      const r = FT.util.rand(), g = FT.rng.fork("ownership")();
      const o = g < 1 / 3 ? "owner" : g < 2 / 3 ? "minority" : "platform";
      ownerMeter(o);
      const extra = o === "owner" ? { board: 70, noGrowthPressure: true }
        : o === "platform" ? { board: 55, platform: true, qMult: (state.qMult || 1) * .8, budget: Math.round(state.budget * .8) } : {};
      return Object.assign({ own: o, midyearMonth: r < .5 ? 1 + Math.floor(FT.util.rand() * 2) : -1, platform: false, mrr: 310000, clients: 70, churned: 0, util: 80, sla: 92, attach: 35, stackSave: 0, liability: false, hiredQ: false, bundled: false, mrrStart: 310000 }, extra);
    },

    /* ---------- Mid-year: what happens depends on who owns Keystone ---------- */
    midyear() {
      if (S.own === "owner") return offerToBuy();
      if (S.own === "platform") return platformMandate();
      S.platform = true; S.own = "platform"; ownerMeter("platform"); S.cutNote = "Sold to Apex Platform Partners. Profitability plan in effect: budgets cut 30%.";
      S.qMult = (S.qMult || 1) * .7; S.budget = Math.round(S.budget * .7);
      S.board = Math.min(S.board, 50);
      const lesson = ["Private equity and security", "Profitability programs often cut security first, because its value is invisible until an incident. Owners who can show security as revenue and risk reduction keep it funded."];
      FT.screens.choiceEvent({
        id: "rollup", title: "Hollis sells to a roll-up",
        intro: "Hollis Capital sold its stake, plus a controlling share, to Apex Platform Partners, a private-equity-backed MSP roll-up. You stay on as president. Apex’s first move is a “profitability enhancement plan”: quarterly budgets are cut 30%, and they want EBITDA up by year-end. They want your plan by Friday.",
        choices: [
          { label: "Cut security spending", run() {
            S.d.patch = clamp(S.d.patch - 10); S.d.detect = clamp(S.d.detect - 10); S.vis = clamp(S.vis - 10);
            return { text: "You trimmed security tooling and froze the security team’s plans. Apex loved the slide. Morgan updated their résumé.", fx: { board: 6, lead: -18 }, lesson };
          } },
          { label: "Raise prices and push utilization", run() {
            S.util = Math.min(98, S.util + 6); S.mrr += 10000;
            return { text: "You raised prices 6% and pushed utilization up. The numbers improved; clients and techs both noticed.", fx: { board: 4, care: -5 }, lesson };
          } },
          { label: "Pitch security as the growth engine", run() {
            if (S.bundled || S.attach >= 60) return { text: "You showed Apex that the security bundle is your fastest-growing, highest-margin revenue. They doubled down on it instead of cutting it.", fx: { board: 5, lead: 8 }, lesson };
            return { text: "You pitched security as a growth engine, but with few clients on the security bundle, the numbers didn’t back you up. Apex was unconvinced.", fx: { board: -5, lead: 4 }, lesson };
          } }
        ]
      });
    },

    /* ---------- The numbers MSP owners watch ---------- */
    businessPanel(S) {
      const gm = margin(S), delta = S.mrr - S.mrrStart;
      const cell = (k, v, cls) => `<div><div class="bk">${k}</div><div class="bv ${cls || ""}">${v}</div></div>`;
      return `<div class="biz" aria-label="Business dashboard"><div class="biz-head">Business dashboard</div>
        ${cell("Monthly recurring revenue", M(S.mrr), delta > 0 ? "good" : delta < 0 ? "bad" : "")}
        ${cell("Change this year", (delta >= 0 ? "+" : "−") + M(Math.abs(delta)), delta > 0 ? "good" : delta < 0 ? "bad" : "")}
        ${cell("Gross margin", gm + "%", gm >= 50 ? "good" : gm < 42 ? "bad" : "")}
        ${cell("Clients", `${S.clients}${S.churned ? ` (${S.churned} lost)` : ""}`, S.churned ? "bad" : "")}
        ${cell("Tech utilization", S.util + "%", S.util > 85 ? "bad" : S.util < 70 ? "bad" : "good")}
        ${cell("SLA attainment", S.sla + "%", S.sla >= 90 ? "good" : S.sla < 85 ? "bad" : "")}
        ${cell("Security attach", S.attach + "%", S.attach >= 70 ? "good" : S.attach < 40 ? "bad" : "")}
        <div style="grid-column:1/-1" class="bk">${S.cutNote || own().note}</div></div>`;
    },

    /* Budget options beyond the standard ones */
    extraCards(S) {
      const list = [];
      if (!S.hiredQ) list.push({ id: "hire", name: "Hire two technicians", cost: 220000, desc: "Brings utilization down and SLAs up. Costs margin.",
        apply: S => { S.util = Math.max(62, S.util - 10); S.sla = Math.min(99, S.sla + 3); S.hiredQ = true; return "Hired two technicians. The service desk can breathe."; } });
      if (!S.bundled) list.push({ id: "bundle", name: "Launch a security bundle for every plan", cost: 150000, desc: "Package EDR, email security and backups into every agreement at renewal. Higher MRR and a stronger standard stack.",
        apply: S => { S.bundled = true; S.attach = Math.min(90, S.attach + 35); S.mrr += 18000; S.d.detect = clamp(S.d.detect + 10); return "Launched the security bundle. Clients will move onto it at renewal."; } });
      return list;
    },

    /* Quarter-end business dynamics */
    quarterEnd(S) {
      if (!S.hiredQ) S.util = Math.min(98, S.util + 2);
      S.hiredQ = false;
      if (S.util > 85) {
        S.sla = Math.max(70, S.sla - 4); S.care = clamp(S.care - 3);
        S.lead = clamp(S.lead - 5); // the security lead gets pulled onto tickets
        S.d.patch = clamp(S.d.patch - 6);
        S.leadNotice = (S.leadNotice ? S.leadNotice + " " : "") + "Techs are stretched past 85% utilization: tickets are slipping, and Morgan keeps getting pulled onto the service desk.";
      } else if (S.util < 78) S.sla = Math.min(99, S.sla + 2);
      // Unhappy clients leave
      const churnP = Math.max(0, (60 - S.care) / 100) + (S.sla < 88 ? .15 : 0);
      if (chance(churnP)) { S.clients--; S.churned++; S.mrr -= 4500; }
      if (S.care >= 60) S.mrr += 6000; // referrals from happy clients
      // Whoever owns Keystone watches the numbers differently
      const gm = margin(S);
      if (S.own === "owner") { if (S.budget < 0) S.board = clamp(S.board - 6); else if (gm < 40) S.board = clamp(S.board - 3); else if (gm >= 48) S.board = clamp(S.board + 1); }
      else if (S.own === "platform") { if (gm >= 52) S.board = clamp(S.board + 2); else if (gm < 45) S.board = clamp(S.board - 4); }
      else { if (gm >= 50) S.board = clamp(S.board + 2); else if (gm < 42) S.board = clamp(S.board - 3); }
    },

    crisisExtra(S, acc, story) {
      const lost = 3 + Math.floor(FT.util.rand() * 4);
      S.clients -= lost; S.churned += lost; S.mrr -= lost * 4500;
      story.push(`${lost} clients gave notice in the weeks that followed.`);
      if (S.liability) { acc.cash -= 500000; acc.board -= 8; story.push("The bank client invoked the unlimited liability clause you signed."); }
      if (S.own === "owner") { acc.board -= 6; story.push("Your banker called to ask about the line of credit you personally guaranteed."); }
    },

    /* ---------- Owner decisions ---------- */
    dilemmas: [
      { id: "bundlemandate", from: "Sales manager", title: "Make security mandatory?", text: () => "Your sales manager wants the security bundle to be mandatory for every client at renewal, with an 8% price increase. Some clients will push back.", options: [
        { label: "Make it mandatory", run: S => { S.attach = Math.min(95, S.attach + 25); S.mrr += 12000;
          if (chance(.35)) { S.clients -= 2; S.churned += 2; S.mrr -= 9000; return { text: "Most clients accepted. Two left rather than pay more. The ones who stayed are far better protected.", fx: { care: -4, lead: 8 } }; }
          return { text: "Every client accepted, a few grudgingly. Your standard stack now covers nearly everyone.", fx: { care: -1, lead: 8, board: 3 } }; } },
        { label: "Keep it optional", run: () => ({ text: "Security stays an add-on. About a third of clients buy it.", fx: { lead: -4 } }) }
      ] },
      { id: "squeeze", from: "Hollis Capital", title: "“Get utilization to 90%”", text: () => "Your PE partner wants technician utilization at 90% to hit this year’s margin target. “The best MSPs run hot.”", options: [
        { label: "Push utilization up", run: S => { S.util = Math.min(98, S.util + 8); return { text: "Margin looks great on paper. The service desk is quietly miserable, and Morgan is covering tickets.", fx: { board: 6, lead: -6 } }; } },
        { label: "Hold at a sustainable level", run: () => ({ text: "You pushed back with ticket data and turnover costs. Hollis wasn’t thrilled.", fx: { board: -3, lead: 4 } }) }
      ] },
      { id: "liability", from: "Sales manager", title: "Unlimited liability for a bank", text: () => "A regional bank will sign a large contract, but only if you accept unlimited liability for any breach that passes through your tools.", options: [
        { label: "Negotiate a liability cap", run: S => { if (chance(.5)) return { text: "They accepted a cap tied to fees. Deal signed.", fx: { board: 3 }, cashBack: 0 }; return { text: "They walked. Your insurance broker said that was the right call.", fx: { board: -2 } }; } },
        { label: "Sign it", run: S => { S.liability = true; S.clients++; S.mrr += 15000; return { text: "Signed. A big new logo, and a clause that could end the company.", fx: { board: 4 } }; } }
      ] },
      { id: "lawfirmmfa", from: "Account manager", title: "Your biggest client refuses MFA", text: () => "Hale & Ward LLP, your biggest client at $12,000 a month, refuses multi-factor login for its partners and says it will leave over it.", options: [
        { label: "Hold the line", run: S => { if (chance(.3)) { S.clients--; S.churned++; S.mrr -= 12000; return { text: "They left for a competitor who didn’t ask. It stung.", fx: { care: -4, lead: 8 } }; } return { text: "You met the managing partner in person. They grumbled, then enrolled.", fx: { lead: 8, trust: 2 } }; } },
        { label: "Grant the exception", run: S => { S.d.exceptions++; return { text: "They stay, without MFA. Morgan added it to the risk report in bold.", fx: { care: 2, lead: -6 } }; } }
      ] },
      { id: "platform", from: "Vendor", title: "One platform for everything", text: () => "A vendor offers RMM, PSA, backup and EDR in one platform for 25% less than your current tools. Your stack would depend on one company.", options: [
        { label: "Consolidate", run: S => { S.stackSave = 4; S.d.vendor = clamp(S.d.vendor - 10); return { text: "Margin improved and the techs like one console. If that vendor is ever breached, every tool you own goes with it.", fx: { board: 3 } }; } },
        { label: "Keep separate tools", run: () => ({ text: "You kept best-of-breed tools. Higher cost, less concentration risk.", fx: { lead: 3 } }) }
      ] }
    ],

    events: [
      { id: "peerbreach", title: "A competitor is breached", run(S) {
        if (S.d.mfa && (S.d.backups || S.d.mdr)) { S.clients += 2; S.mrr += 9000; return { text: "A competing MSP was hit through its RMM, and its clients went down for a week. Two of them called you, and your security story won them over.", fx: { trust: 4, care: 3 }, lesson: ["Security sells", "When a competitor is breached, MSPs with real controls win their clients."] }; }
        return { text: "A competing MSP was hit through its RMM. Your clients started asking whether it could happen to you, and you didn’t have a great answer.", fx: { care: -5, trust: -3 }, lesson: ["Security sells", "When a competitor is breached, MSPs with real controls win their clients."] };
      } },
      { id: "techsquit", title: "Two technicians quit", run(S) {
        if (S.util <= 85) return { text: "A competitor tried to poach your senior techs. They stayed: the workload is sane and they like the team.", fx: {}, lesson: ["Utilization has a ceiling", "Running techs hot improves margin until they burn out and leave, taking client knowledge with them."] };
        S.util = Math.min(98, S.util + 6); S.sla = Math.max(70, S.sla - 5);
        return { text: "Two senior techs quit for a competitor, worn out by months above 85% utilization. Tickets backed up, and clients noticed.", fx: { care: -6, board: -3 }, lesson: ["Utilization has a ceiling", "Running techs hot improves margin until they burn out and leave, taking client knowledge with them."] };
      } },
      { id: "clientsues", title: "A client threatens to sue", run(S) {
        if (S.d.detect + (S.d.mdr ? 25 : 0) >= 55) return { text: "Tri-County Fabrication was breached and blamed you. Your logs showed exactly what your techs did and didn’t do. Their lawyer dropped it.", fx: { trust: 2 }, lesson: ["Evidence protects the MSP", "Logs of what your techs and tools did are your best defense when a client blames you."] };
        return { text: "Tri-County Fabrication was breached and blamed you. You couldn’t prove otherwise, and settled.", fx: { cash: -120000, trust: -5, board: -4 }, lesson: ["Evidence protects the MSP", "Logs of what your techs and tools did are your best defense when a client blames you."] };
      } }
    ]
  });
})();
