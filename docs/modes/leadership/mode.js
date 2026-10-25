/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Leadership mode: you are the CEO.
 *
 * You never touch a firewall. You decide money, priorities and exceptions,
 * and you only see security through your security lead's report, which is
 * only as accurate as the visibility you pay for. The year is four quarters:
 *   board meeting (from Q2) → budget → two inbox decisions → something happens.
 * Q4 ends in a crisis you manage from the CEO's chair. The end screen shows
 * what your reports said next to what was really true.
 *
 * Hidden state (S.d): the real defenses. Visible: board confidence, the
 * organization's mission, public trust, and cash. Settings (settings.js)
 * supply names, numbers and setting-specific decisions. */
(function () {
  const S = FT.S, L = FT.learned, { clamp, chance, pick, shuffle, money } = FT.util, ui = FT.ui;
  const settings = {};
  const M = n => ui.compact(n);

  /* ---------- Real posture, and what the report says ---------- */
  // Each row: [label, actual level 0-2 (0 bad, 1 warn, 2 good), explanation]
  function actual(S) {
    const d = S.d, lvl = (v, g, o) => v >= g ? 2 : v >= o ? 1 : 0;
    return [
      ["Multi-factor login", d.mfa ? 2 : 0, d.mfa ? "Enforced for everyone." : "Not enforced."],
      ["Backups", d.backups ? 2 : d.backupsOld ? 1 : 0, d.backups ? "Recently restore-tested and protected." : d.backupsOld ? "Exist, but haven’t been tested lately." : "Untested and reachable by attackers."],
      ["Patching", lvl(d.patch, 70, 40), d.patch >= 70 ? "Current." : d.patch >= 40 ? "Falling behind." : "Badly behind."],
      ["Detection and monitoring", lvl(d.detect + (d.mdr ? 25 : 0), 70, 40), d.mdr ? "Watched around the clock." : d.detect >= 40 ? "Business hours only." : "Mostly blind."],
      ["Incident response", d.irPlan ? 2 : 0, d.irPlan ? "Plan tested, outside responders on retainer." : "No tested plan, no retainer."],
      ["Vendor access", lvl(d.vendor, 60, 30), d.vendor >= 60 ? "Reviewed." : d.vendor >= 30 ? "Partly reviewed." : "Unknown."],
      ["Executive exceptions", d.exceptions === 0 ? 2 : d.exceptions === 1 ? 1 : 0, d.exceptions === 0 ? "None." : `${d.exceptions} granted.`]
    ];
  }
  // The report: each row is accurate with probability = visibility; otherwise
  // it’s one step rosier than reality. Generated once per quarter.
  function makeReport(S) {
    const acc = S.vis / 100, assessed = S.assessed;
    S.report = actual(S).map(([k, a]) => [k, assessed || a === 2 || chance(acc) ? a : Math.min(2, a + 1)]);
    S.assessed = false;
  }
  const WORD = ["Red", "Yellow", "Green"], CLS = ["bad", "warn", "good"];
  function reportHTML(S) {
    const st = mode.setting;
    const conf = S.vis >= 75 ? "high" : S.vis >= 45 ? "moderate" : "low";
    return `<div class="dash" aria-label="Security report"><div class="dash-head">${S.leadGone ? "Security report (no security lead)" : `Report from ${st.lead.name}`}</div>
      ${S.report.map(([k, v]) => `<div class="drow"><span class="dk">${(st.rowLabels || {})[k] || k}</span><span class="dv ${CLS[v]}"><i aria-hidden="true"></i>${WORD[v]}</span></div>`).join("")}
      <div class="drow" style="grid-column:1/-1"><span class="dk">How much to trust this report</span><span class="dv ${S.vis >= 75 ? "good" : S.vis >= 45 ? "warn" : "bad"}"><i aria-hidden="true"></i>${conf[0].toUpperCase() + conf.slice(1)} confidence</span></div></div>`;
  }

  /* ---------- Budget cards ---------- */
  // The security lead’s requests unlock one per quarter and stay until funded.
  const ASKS = [
    { id: "mfa", q: 0, name: "Enforce multi-factor login everywhere", cost: 300000, desc: "Phones or security keys for every account, including executives.", apply: S => { S.d.mfa = true; } },
    { id: "backups", q: 1, name: "Rebuild and test the backups", cost: 250000, desc: "Backups attackers can’t delete, restore-tested every quarter.", apply: S => { S.d.backups = true; S.d.backupsOld = true; } },
    { id: "mdr", q: 2, name: "24/7 monitoring service (MDR)", cost: 350000, desc: "Outside analysts watching around the clock, tuned to your systems.", apply: S => { S.d.mdr = true; S.d.detect = clamp(S.d.detect + 20); } },
    { id: "ir", q: 3, name: "Incident response retainer and exercise", cost: 150000, desc: "Outside responders on call, and a crisis exercise with your leadership team.", apply: S => { S.d.irPlan = true; } }
  ];
  function cards(S) {
    const st = mode.setting, list = [];
    list.push({ id: "ops", kind: "sec", name: `Fully fund the security team`, cost: st.opsCost, desc: "Keeps patching, monitoring and backups from slipping this quarter, and keeps your security lead from burning out." });
    for (const a of ASKS) if (a.q <= S.month && !S.funded[a.id]) { const o = (st.askText || {})[a.id] || {}; list.push(Object.assign({ kind: "ask" }, a, { name: o.name || a.name, desc: `Requested by ${st.lead.short}${a.q < S.month ? " (still waiting)" : ""}. ${o.desc || a.desc}` })); }
    if (st.extraCards) for (const c of st.extraCards(S)) list.push(Object.assign({ kind: "extra" }, c));
    list.push({ id: "assess", kind: "vis", name: "Independent security assessment", cost: 120000, desc: "Outside experts check what’s really true. Next quarter’s report will be accurate." });
    if (!S.insured) list.push({ id: "insure", kind: "ins", name: "Buy cyber insurance for the year", cost: Math.round((S.d.mfa ? 150000 : 300000) * (S.insMult || 1)), desc: S.d.mfa ? "Covers incident costs and gives you a panel of responders and lawyers." : "Insurers charge double without enforced multi-factor login. Covers incident costs and provides responders." });
    list.push({ id: "growth", kind: "growth", name: st.growth.name, cost: st.growth.cost, desc: st.growth.desc });
    return list;
  }

  /* ---------- Inbox dilemmas ----------
   * Each has a from, text, and options [{label, run(S) → {text, fx}}].
   * fx can include board, care, trust, cash, and lead (security lead morale). */
  const accept = (S, name, desc) => { S.accepted.push({ name, desc, quarter: S.month }); };
  const DILEMMAS = [
    { id: "ceomfa", first: true, from: "IT", title: "Your phone needs multi-factor login", text: S => `IT is enrolling everyone in multi-factor login${S.d.mfa ? "" : " where it exists"}, including you. Your assistant says it will slow you down on the road and asks whether you want an exemption.`, options: [
      { label: "Enroll like everyone else", run: S => ({ text: "You enrolled, and mentioned it at the all-hands. Adoption across the company jumped that week.", fx: { lead: 8, trust: 1 } }) },
      { label: "Take the exemption", run: S => { S.d.exceptions++; return { text: "Granted. You’re now the most valuable account in the company with the weakest protection, and staff noticed.", fx: { lead: -8 } }; } }
    ] },
    { id: "boardemail", from: "Board chair", title: "Board documents by personal email", text: () => "The board chair finds the secure board portal clumsy and asks that board packets just be emailed to directors’ personal accounts.", options: [
      { label: "Keep the portal, offer training", run: () => ({ text: "You kept the portal and had IT walk each director through it. Mild grumbling, then acceptance.", fx: { board: -2, lead: 4 } }) },
      { label: "Email them to personal accounts", run: S => { S.d.exceptions++; return { text: "Board packets, including acquisition plans and financials, now sit in seven personal inboxes.", fx: { board: 3, lead: -6 } }; } }
    ] },
    { id: "cutsec", from: "CFO", title: "Cut one security position", text: () => "The CFO wants to cut one open security position to hit this year’s margin target. “Nothing has happened so far,” she points out.", options: [
      { label: "Keep the position", run: () => ({ text: "You kept it. The CFO found the margin elsewhere, grudgingly.", fx: { board: -2, lead: 6 } }) },
      { label: "Cut it", run: S => { S.budget += 150000; S.cutHeadcount = true; return { text: "You cut it. The margin target looks better, and the security team is one person thinner for the rest of the year.", fx: { board: 3, lead: -15 } }; } }
    ] },
    { id: "attest", from: "Legal", title: "Sign the security attestation", text: S => `A major ${mode.setting.customer} contract requires you to sign that “multi-factor login is enforced for all users.” ${S.d.mfa ? "It is." : "It isn’t, yet."} The deal closes Friday.`, options: [
      { label: "Sign only what’s true", run: S => S.d.mfa ? { text: "You signed. It was true.", fx: { care: 3, board: 2 } } : { text: "You told them the truth and offered a dated plan. They signed with a 90-day condition.", fx: { care: 1, trust: 2 } } },
      { label: "Sign it anyway", run: S => { if (!S.d.mfa) { S.falseAttest = true; return { text: "You signed. The deal closed. There is now a contract with your signature on a false statement.", fx: { care: 4, board: 2 } }; } return { text: "You signed. It was true.", fx: { care: 3, board: 2 } }; } }
    ] },
    { id: "legacy", from: "Security lead", title: "Sign a risk acceptance", text: S => `${mode.setting.lead.short} asks you to decide on ${mode.setting.legacy}. Fixing it properly costs $200,000. Otherwise, someone senior has to formally accept the risk.`, options: [
      { label: "Fund the fix ($200k)", run: S => { S.budget -= 200000; S.d.patch = clamp(S.d.patch + 15); return { text: "Funded. It will take a quarter, but the risk is going away.", fx: { lead: 8 } }; } },
      { label: "Sign the risk acceptance", run: S => { accept(S, mode.setting.legacyShort, mode.setting.legacy); return { text: "You signed. It’s now on the risk register, with your name next to it.", fx: { lead: -3 } }; } }
    ] },
    { id: "boardline", from: "Security lead", title: "A seat at the board meeting", text: S => `${mode.setting.lead.short} asks to present to the board directly once a quarter, instead of through you.`, options: [
      { label: "Yes, every quarter", run: S => { S.vis = clamp(S.vis + 15); return { text: "The first presentation was blunt. The board asked better questions than ever, and your reports got more honest.", fx: { lead: 12, board: 2 } }; } },
      { label: "No, it comes through me", run: S => ({ text: "Reports stay filtered through you. Your security lead accepted it, but stopped pushing hard on bad news.", fx: { lead: -8 }, vis: -10 }) }
    ] },
    { id: "phishtest", from: "Security lead", title: "You failed the phishing test", text: () => "The quarterly phishing simulation went out. You clicked it and entered your password. Only the security team knows.", options: [
      { label: "Tell the company, with a laugh", run: () => ({ text: "You opened the all-hands with it. Reporting rates for suspicious emails doubled the next month.", fx: { trust: 2, lead: 8 } }) },
      { label: "Ask them to keep it quiet", run: S => ({ text: "They kept it quiet. Your security lead noted that executives seem to be exempt from consequences.", fx: { lead: -10 } }) }
    ] },
    { id: "acq", from: "Corporate development", title: "Skip security diligence?", text: S => `You can close the purchase of ${mode.setting.acquisition} this quarter if you skip the security due diligence. Doing it adds six weeks and $100,000.`, options: [
      { label: "Do the diligence ($100k)", run: S => { S.budget -= 100000; return { text: "The diligence found an active compromise inside the target. You negotiated $400,000 off the price and cleaned it up before connecting.", fx: { board: 3, lead: 6 }, cashBack: 400000 }; } },
      { label: "Skip it and close now", run: S => { S.d.vendor = clamp(S.d.vendor - 25); S.d.patch = clamp(S.d.patch - 10); accept(S, "Unvetted acquisition", `the newly acquired ${mode.setting.acquisition}`); return { text: "Closed on time. Its network joins yours next month, unexamined.", fx: { board: 3 } }; } }
    ] },
    { id: "raise", from: "Security lead", title: "The security team is exhausted", text: S => `${mode.setting.lead.short} says two people on the team are interviewing elsewhere and asks for $120,000 in retention bonuses.`, options: [
      { label: "Approve the bonuses", run: S => { S.budget -= 120000; return { text: "Approved. Both stayed, and the team’s mood lifted.", fx: { lead: 15 } }; } },
      { label: "Decline", run: S => { S.d.detect = clamp(S.d.detect - 15); return { text: "Declined. One of them left, and monitoring got thinner for the rest of the year.", fx: { lead: -12 } }; } }
    ] },
    { id: "discount", from: "Procurement", title: "A big discount, with strings", text: S => `A vendor offers 30% off a major contract if you skip their security review and sign this week. They’ll have access to ${mode.setting.dataName}.`, options: [
      { label: "Review first, lose the discount", run: () => ({ text: "The review took three weeks and found they store data unencrypted. They fixed it before signing.", fx: { lead: 4 } }) },
      { label: "Take the discount", run: S => { S.budget += 150000; S.d.vendor = clamp(S.d.vendor - 20); return { text: "You saved $150,000. A vendor nobody has reviewed now has access to your most sensitive data.", fx: {} }; } }
    ] }
  ];

  /* ---------- Board questions, one per meeting ---------- */
  const BOARD_QS = [
    { q: "Could the ransomware attacks in the news happen to us?", options: [
      { label: "No, we’re in good shape", run: S => { S.claimedSafe = true; return { text: "The board relaxed. They’ll remember you said it.", fx: { board: 4 } }; } },
      { label: "Yes. Here are our gaps and plan", run: () => ({ text: "Sobering, but the board appreciated the honesty and asked to see progress each quarter.", fx: { board: 1, lead: 6 } }) }
    ] },
    { q: "Should we be spending more or less on security?", options: [
      { label: "More, and here’s why", run: S => { S.vis = clamp(S.vis + 10); return { text: "The board approved a modest increase, and asked for clearer metrics in return.", fx: { board: -1, lead: 8 }, cash: 150000 }; } },
      { label: "Hold steady", run: () => ({ text: "The board nodded and moved on.", fx: {} }) },
      { label: "Less; nothing has happened", run: S => ({ text: "The board liked the savings. Your security lead did not.", fx: { board: 3, lead: -12 }, cash: 150000 }) }
    ] },
    { q: "If we’re breached, who is accountable?", options: [
      { label: "I am", run: () => ({ text: "The board noted it. So did the rest of the leadership team.", fx: { board: 3, lead: 5 } }) },
      { label: "Our security lead", run: () => ({ text: "The board noted it. So did your security lead.", fx: { board: -1, lead: -15 } }) }
    ] }
  ];

  /* ---------- Quarterly events ----------
   * Outcomes depend on the real defenses (S.d), not the report. */
  const EVENTS = [
    { id: "whaling", title: "An email from you, to finance", run(S) {
      const bad = chance(S.d.exceptions ? .6 : S.d.mfa ? .15 : .3);
      if (!bad) return { text: "Finance received an urgent email “from you” asking for a $280,000 wire. They followed the callback rule and called you. You hadn’t sent it.", fx: { trust: 1 }, lesson: ["Executive impersonation", "Executives are the most impersonated people in any company. Callback rules, and executives following the same controls as everyone else, stop it."] };
      return { text: "Finance received an urgent email from your real account asking for a $280,000 wire, and sent it. Attackers had been reading your email for weeks." + (S.d.exceptions ? " Your exemptions made your account the easiest one to take." : ""), fx: { cash: -280000, board: -8, trust: -3 }, lesson: ["Executive impersonation", "Executives are the most impersonated people in any company. Callback rules, and executives following the same controls as everyone else, stop it."] };
    } },
    { id: "vendorbreach", title: "A vendor leaks your data", run(S) {
      if (S.d.vendor >= 55) return { text: `A vendor holding ${mode.setting.dataName} was breached. Because your team had limited what they could access, very little of yours was exposed.`, fx: { trust: -1 }, lesson: ["Third-party risk", "Your data lives with vendors. Reviewing and limiting their access decides how much of it leaks when they’re breached."] };
      return { text: `A vendor holding ${mode.setting.dataName} was breached, and they had far more of your data than anyone realized. You’re sending breach notices.`, fx: { trust: -10, board: -6, cash: -150000 }, lesson: ["Third-party risk", "Your data lives with vendors. Reviewing and limiting their access decides how much of it leaks when they’re breached."] };
    } },
    { id: "caughtearly", title: "Attackers on one server", run(S) {
      const score = S.d.detect + (S.d.mdr ? 30 : 0);
      if (chance(score / 110)) return { text: "Your security team caught attackers on one server within an hour and contained them. Most of your company never knew. That’s what good looks like.", fx: { board: 2, lead: 6 }, lesson: ["Detection pays quietly", "Most security wins are invisible. Funding detection means problems end as a footnote instead of a headline."] };
      return { text: "Attackers had been on one of your servers for four months. You found out when a security researcher emailed to say your data was for sale.", fx: { trust: -10, board: -8, cash: -200000 }, lesson: ["Detection pays quietly", "Without monitoring, the first sign of a breach is often someone outside telling you."] };
    } },
    { id: "laptop", title: "Your laptop, stolen", run(S) {
      if (S.d.exceptions === 0) return { text: "Your laptop was stolen from a car at a conference. It was encrypted and managed like everyone else’s, so IT wiped it remotely. A non-event.", fx: {}, lesson: ["Executives follow the rules too", "Executive devices hold the most sensitive data. Exempting them from controls makes them the best target."] };
      return { text: "Your laptop was stolen from a car at a conference. Thanks to your exemptions, it had admin rights, no remote wipe, and saved passwords. The board packet on it reached a competitor.", fx: { board: -10, trust: -4 }, lesson: ["Executives follow the rules too", "Executive devices hold the most sensitive data. Exempting them from controls makes them the best target."] };
    } },
    { id: "audit", title: "The regulator asks for evidence", run(S) {
      const good = (S.d.mfa ? 1 : 0) + (S.d.backups ? 1 : 0) + (S.d.irPlan ? 1 : 0);
      if (good >= 2) return { text: `${mode.setting.regulator} asked for evidence of your security controls. Your team produced it in a week. Closed with no findings.`, fx: { board: 3 }, lesson: ["Evidence, not intentions", "Regulators and auditors want proof. Funded, working controls produce it as a byproduct."] };
      return { text: `${mode.setting.regulator} asked for evidence of your security controls. There wasn’t much. You’re now under a formal corrective plan.`, fx: { board: -8, trust: -4, cash: -100000 }, lesson: ["Evidence, not intentions", "Regulators and auditors want proof. Funded, working controls produce it as a byproduct."] };
    } },
    { id: "patchgap", title: "A known flaw, exploited", run(S) {
      if (S.d.patch >= 60) return { text: "A widely exploited flaw hit companies across your industry this quarter. Your systems were already patched.", fx: { board: 2 }, lesson: ["Maintenance is security", "Most breaches use flaws with fixes already available. Funding the unglamorous work of patching keeps you off the list."] };
      return { text: "A widely exploited flaw hit companies across your industry this quarter, including you. Systems were down for three days.", fx: { care: -8, board: -6 }, lesson: ["Maintenance is security", "Most breaches use flaws with fixes already available. Funding the unglamorous work of patching keeps you off the list."] };
    } }
  ];

  /* ---------- Yearly conditions: two per year ---------- */
  const CONDITIONS = [
    { id: "tight", name: "A tight year", good: false, excludes: ["strong"], desc: "Revenue is soft. Every quarter’s budget is 15% smaller.", apply: S => { S.qMult = .85; S.budget = Math.round(S.budget * .85); } },
    { id: "activist", name: "An activist board", good: false, excludes: ["honeymoon"], desc: "A new investor on the board wants results now. Board confidence starts lower.", apply: S => { S.board = 55; } },
    { id: "insurance", name: "A hard insurance market", good: false, desc: "Cyber insurance costs 50% more this year.", apply: S => { S.insMult = 1.5; } },
    { id: "wave", name: "Ransomware wave", good: false, desc: "Attacks on your industry are surging. A crisis is harder to contain.", apply: S => { S.crisisPenalty = 10; } },
    { id: "regulators", name: "Regulators are watching", good: false, desc: "Regulators are cracking down on late breach notification.", apply: S => { S.regStrict = true; } },
    { id: "strong", name: "A strong year", good: true, excludes: ["tight"], desc: "Business is good. Extra revenue arrives every quarter.", apply: S => { S.income = 100000; } },
    { id: "honeymoon", name: "Honeymoon period", good: true, excludes: ["activist"], desc: "The board is delighted with its new CEO. Confidence starts high.", apply: S => { S.board = 75; } }
  ];

  /* ---------- Starting situations ---------- */
  const STARTS = [
    { id: "typical", letter: "T", short: "Typical", name: "A typical company", desc: "Security has been funded unevenly. Some things work.", apply: S => {} },
    { id: "mess", letter: "M", short: "After a breach", name: "The aftermath of a breach", desc: "Last year’s breach still hangs over the company. Everyone is wary, and extra money was set aside for security.", apply: S => {
      S.board = 55; S.trust = 55; S.vis = 30; S.d.patch = 30; S.d.detect = 25; S.budget += 250000; } },
    { id: "mature", letter: "A", short: "Mature program", name: "A mature security program", desc: "Security was invested in well before this year: multi-factor login, tested backups and a retainer are in place. Everyone thinks the job is done, so the budget was trimmed.", apply: S => {
      Object.assign(S.d, { mfa: true, backups: true, irPlan: true, patch: 70, detect: 60 }); S.funded.mfa = S.funded.backups = S.funded.ir = true; S.vis = 65; S.qMult = (S.qMult || 1) * .85; S.budget = Math.round(S.budget * .85); } },
    { id: "fresh", letter: "F", short: "New security lead", name: "A brand-new security lead", desc: "You just hired your first real security lead. They’re energetic, but they can’t see much yet, and there’s a lot to build.", apply: S => {
      S.lead = 85; S.vis = 25; S.d.detect = 20; S.d.patch = 35; } }
  ];

  /* ---------- Achievements ---------- */
  const ACHIEVEMENTS = [
    { id: "ld-survive", name: "Still employed", desc: "Finish a year as CEO.", test: (S, c) => !c.lossMsg },
    { id: "ld-a", name: "Contract extended", desc: "Earn an A as CEO.", test: (S, c) => c.grade === "A" },
    { id: "ld-honest", name: "Straight shooter", desc: "Finish a year with no exemptions, no false attestations and no false reassurances to the board.", test: (S, c) => !c.lossMsg && S.d.exceptions === 0 && !S.falseAttest && !S.claimedSafe },
    { id: "ld-accurate", name: "No surprises", desc: "End the year with a security report that was completely accurate.", test: S => { const t = actual(S), last = S.reportHistory[S.reportHistory.length - 1] || []; return last.length && t.every(([, a], i) => last[i][1] === a); } },
    { id: "ld-contained", name: "The crisis that wasn’t", desc: "Have your team contain the attack before it becomes a crisis.", test: S => S.finaleResult === "contained" },
    { id: "ld-ciso", name: "Kept your security lead", desc: "Finish a year with your security lead still there and still motivated.", test: (S, c) => !c.lossMsg && !S.leadGone && S.lead >= 60 },
    { id: "ld-msp", name: "Owner’s A", desc: "Earn an A as owner of the MSP.", test: (S, c) => c.grade === "A" && S.settingId === "msp" },
    { id: "ld-healthy", name: "A healthy MSP", desc: "As MSP owner, finish the year with gross margin of 50% or more and SLA attainment of 90% or more.", test: (S, c) => !c.lossMsg && S.settingId === "msp" && FT.modes.leadership.setting.margin(S) >= 50 && S.sla >= 90 },
    { id: "ld-all", name: "Three companies, three A’s", desc: "Earn an A as CEO of the hospital, the manufacturer and the software company.", test: (S, c, data) => FT.ach.allSettingsA(data, "leadership", ["hospital", "manufacturing", "software"]) }
  ];

  /* ---------- The mode ---------- */
  const mode = {
    id: "leadership",
    name: "Leadership mode",
    blurb: "You’re the CEO. You never touch a firewall, but every decision about money, priorities and exceptions decides how the security team’s year goes.",
    intro: `
      <p>You’re the <b>CEO</b> of a hospital, a manufacturer or a software company, or the <b>owner</b> of a managed service provider. Your security lead works for you. You decide what gets funded, which risks to accept, and which exceptions to grant, including your own.</p>
      <p>The year is four quarters. Each one brings a board meeting, a budget decision, two decisions in your inbox, and whatever happens next. Q4 ends in a crisis you’ll have to lead.</p>
      <p>You only see security through your security lead’s report, and that report is only as accurate as the visibility you pay for. At the end, you’ll see what was really going on.</p>`,
    startLabel: "Take the job",
    againLabel: "Play another year",
    winTitle: "You made it through the year",
    advisor: { name: "What this teaches" },
    months: ["Q1", "Q2", "Q3", "Q4"],
    periodLabel: "Quarter",
    landmarks: ["First quarter", "Second quarter", "Third quarter", "Fourth quarter"],
    meters: [
      { key: "board", label: "Board confidence", short: "Board" },
      { key: "care", label: "Mission", short: "Mission" },
      { key: "trust", label: "Public trust", short: "Trust" }
    ],
    prefs: { group: "random", sub: {}, tutorial: true, start: "random" },
    /* The setting picker: the shapes of the business, with industries underneath */
    randomDesc: "You’ll find out which company you lead on day one.",
    groups: [
      { id: "midsize", label: "Mid-size organization", members: ["hospital", "manufacturing", "software"], subLegend: "Kind of organization",
        desc: "You’re the CEO of a mid-size organization: a regional hospital, a manufacturer or a B2B software company.",
        subRandomDesc: "You’ll find out which organization you lead on day one." },
      { id: "msp", label: "MSP", members: ["msp"],
        desc: "You own a 25-person managed service provider, with about 70 clients and an ownership structure that varies each year." }
    ],
    allSettings: () => settings,
    codeLetter: "L",
    codePrefix: S => "L" + mode.setting.letter + STARTS.find(x => x.id === S.startInfo.id).letter,
    loadCode(prefix) {
      if (prefix.length !== 3) return false;
      const st = Object.values(settings).find(x => x.letter === prefix[1]), start = STARTS.find(x => x.letter === prefix[2]);
      if (!st || !start) return false;
      mode.prefs.start = start.id;
      return FT.picker.select(mode, st.id, null);
    },
    conditions: CONDITIONS, starts: STARTS, achievements: ACHIEVEMENTS,

    addSetting(st) { settings[st.id] = st; if (!mode.setting) mode.useSetting(st.id); },
    useSetting(id) {
      const st = mode.setting = settings[id];
      mode.meters = [
        { key: "board", label: st.boardLabel || "Board", short: st.boardShort || "Board" },
        { key: "care", label: st.missionLabel, short: st.missionShort },
        { key: "trust", label: st.trustLabel, short: st.trustShort || "Trust" }
      ];
      mode.landmarks = st.landmarks;
      mode.events = EVENTS.concat(st.events || []);
    },

    introOptions() {
      const p = mode.prefs;
      return `${FT.picker.html(mode)}
        ${FT.years.startOptions(STARTS, p.start)}
        <label class="ot tutopt"><input type="checkbox" id="tutorial" ${p.tutorial ? "checked" : ""}> Show the guided first quarter</label>`;
    },
    bindIntroOptions(root) {
      FT.picker.bind(mode, root);
      root.querySelector("#tutorial").onchange = e => { mode.prefs.tutorial = e.target.checked; };
      FT.years.bindStartOptions(root, STARTS, v => { mode.prefs.start = v; });
    },

    newState() {
      const ids = Object.keys(settings);
      mode.useSetting(FT.picker.resolve(mode).setting);
      const st = mode.setting;
      const deck = shuffle(DILEMMAS.filter(x => !x.first && !(st.skipDilemmas || []).includes(x.id)).concat(st.dilemmas || []).map(x => x.id));
      const state = {
        settingId: st.id, board: 65, care: 75, trust: 70, budget: st.quarterBudget,
        lead: 65, leadGone: false, vis: 40, assessed: false, insured: false,
        d: { mfa: false, backups: false, backupsOld: true, patch: 45, detect: 35, mdr: false, irPlan: false, vendor: 30, exceptions: 0 },
        funded: {}, accepted: [], claimedSafe: false, falseAttest: false, cutHeadcount: false,
        income: 0, growthQuarters: 0, dilemmaDeck: deck, boardQs: shuffle(BOARD_QS.slice()),
        tutorial: mode.prefs.tutorial, reportHistory: [], finaleResult: null
      };
      if (st.newState) Object.assign(state, st.newState(state));
      FT.years.applyStart(state, FT.years.pickStart(STARTS, mode.prefs.start));
      FT.years.applyConditions(state, FT.years.pickConditions(CONDITIONS, 2));
      state.budget = Math.round(state.budget / 1000) * 1000;
      return state;
    },

    applyFx(S, fx) {
      for (const k of ["board", "care", "trust"]) if (fx[k]) S[k] = clamp(S[k] + fx[k]);
      // "cash" in an outcome is money; the engine applies it as budget
      if (fx.cash) { fx.budget = (fx.budget || 0) + fx.cash; delete fx.cash; }
      if (fx.lead) leadChange(fx.lead);
    },
    dashboard: () => [],

    /* ---------- One quarter ---------- */
    plan() {
      if (S.month > 0 && !S.boardDone) return boardMeeting();
      S.boardDone = false;
      makeReport(S);
      S.reportHistory.push(S.report.map(r => r.slice()));
      budget();
    },

    monthEnd(S) {
      const d = S.d;
      // Without a funded team, things slip. With one, they improve.
      const ops = S.fundedOps;
      const slip = (S.leadGone ? 2 : 1) * (S.cutHeadcount ? 1.3 : 1);
      d.patch = clamp(d.patch + (ops ? 12 : -Math.round(18 * slip)));
      d.detect = clamp(d.detect + (ops ? 6 : -Math.round(12 * slip)));
      d.vendor = clamp(d.vendor + (ops ? 5 : -8));
      if (!ops) { d.backups = false; leadChange(-15); } else leadChange(4);
      if (d.backups) d.backupsOld = true;
      S.vis = clamp(S.vis - 8 + (S.leadGone ? -20 : 0));
      // Budgets don't roll over: unspent money returns to the bottom line (the
      // board likes that, a little); overspending carries forward as a deficit.
      const left = S.budget;
      if (left > 0) S.board = clamp(S.board + Math.min(4, Math.floor(left / 250000)));
      S.budget = Math.round(mode.setting.quarterBudget * (S.qMult || 1)) + S.income + Math.min(0, left);
      if (mode.setting.quarterEnd) mode.setting.quarterEnd(S);
      if (!S.grewThisQuarter && !S.noGrowthPressure) S.board = clamp(S.board - 4);
      S.fundedOps = false; S.grewThisQuarter = false;
      // A demoralized security lead resigns
      if (!S.leadGone && S.lead < 20) {
        S.leadGone = true; S.board = clamp(S.board - 8);
        S.leadNotice = `${mode.setting.lead.name} resigned, and the board wants to know why. Nobody is running security now, and your reports will get much less reliable.`;
        L.set("Your security lead is a control", "A security lead who is ignored, underfunded or blamed eventually leaves, and takes your visibility with them.");
      }
    },

    lossCheck(S) {
      // Settings can give loss messages as text or as a function of the state
      const D = k => { const v = mode.setting.deaths && mode.setting.deaths[k]; return typeof v === "function" ? v(S) : v; };
      if (S.board <= 0 && S.finale) return D("ransomware") || "Your tenure has died of ransomware. The board has asked for your resignation.";
      if (S.board <= 0) return D("board") || "The board has asked for your resignation.";
      if (S.care <= 0) return D("care");
      if (S.trust <= 0) return D("trust");
      return null;
    },

    grade(S, lossMsg) {
      const fr = S.finaleResult ? FINALE_RESULTS[S.finaleResult] : null;
      const score = S.board * .4 + S.care * .3 + S.trust * .3 + (fr ? fr.bonus : 0);
      const grade = lossMsg ? "F" : score >= 68 ? "A" : score >= 56 ? "B" : score >= 44 ? "C" : "D";
      const notes = { A: "The board extended your contract.", B: "A solid year. Some hard lessons, no disasters.", C: "You survived. The board has notes.", D: "A rough year. The board is watching closely.", F: "The board ends the conversation." };
      return { grade, note: notes[grade], details: `<p class="hint">${mode.setting.name}. Final board confidence ${S.board}, ${mode.meters[1].label.toLowerCase()} ${S.care}, ${mode.meters[2].label.toLowerCase()} ${S.trust}, cash ${money(S.budget)}</p>` +
        (fr ? `<p class="hint">The crisis: <b>${fr.label}</b>${fr.bonus ? ` (+${fr.bonus} to your grade)` : ""}</p>` : "") + revealHTML(S) };
    }
  };

  function leadChange(n) { if (!S.leadGone) S.lead = clamp(S.lead + n); }

  /* ---------- Screens ---------- */
  function panel(html, focus) { ui.screen(`<div class="panel">${html}</div>`, focus); }
  function tip(text) { return S.tutorial && S.month === 0 ? ui.advisor(`<p><b>${mode.setting.chief}:</b> ${text}</p>`, "tut") : ""; }

  function boardMeeting() {
    const q = S.boardQs[(S.month - 1) % S.boardQs.length], st = mode.setting;
    const accepted = S.accepted.length ? `<p class="hint">Your risk register: ${S.accepted.map(a => `<b>${a.name}</b> (accepted in Q${a.quarter + 1})`).join(", ")}.</p>` : "";
    panel(`<h2>Q${S.month + 1} ${st.boardTitle || "board meeting"}</h2>
      ${S.leadNotice ? `<div class="notice">${S.leadNotice}</div>` : ""}
      ${st.businessPanel ? st.businessPanel(S) : ""}
      <p>${st.boardIntro || "The board reviews last quarter. One director asks:"}</p>
      <p class="pq"><b>“${q.q}”</b></p>${accepted}
      <div class="row">${q.options.map((o, i) => `<button class="btn ${i ? "ghost" : ""}" data-i="${i}">${o.label}</button>`).join("")}</div>`, "button[data-i]");
    S.leadNotice = null;
    FT.app.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => {
      FT.note(`${st.boardTitle || "Board meeting"}: “${q.q}”`, `Answered: ${q.options[+b.dataset.i].label}.`);
      const r = q.options[+b.dataset.i].run(S);
      if (r.cash) S.budget += r.cash;
      S.boardDone = true;
      result(`Q${S.month + 1} ${st.boardTitle || "board meeting"}`, r, () => mode.plan());
    });
  }

  function result(title, r, next) {
    const fx = Object.assign({}, r.fx || {});
    if (r.cashBack) fx.cash = (fx.cash || 0) + r.cashBack;
    if (r.vis) S.vis = clamp(S.vis + r.vis);
    const d = FT.screens.applyFx(fx);
    const leadNote = r.fx && r.fx.lead ? `<p class="hint">${mode.setting.lead.short}’s morale ${r.fx.lead > 0 ? "rose" : "fell"}.</p>` : "";
    panel(`<h2>${title}</h2><p>${r.text}</p>${d.length ? `<div class="delta">${d.join("  ")}</div>` : ""}${leadNote}
      <div class="row"><button class="btn" id="n">Continue</button></div>`, "#n");
    document.getElementById("n").onclick = () => { if (FT.screens.checkLoss()) return; next(); };
  }

  function budget() {
    const st = mode.setting, list = cards(S), picked = new Set();
    function draw() {
      const spent = [...picked].reduce((t, id) => t + list.find(c => c.id === id).cost, 0), left = S.budget - spent;
      const html = list.map(c => {
        const on = picked.has(c.id), blocked = !on && c.cost > left;
        return `<label class="opt ${on ? "on" : ""} ${blocked ? "off" : ""}"><input type="checkbox" data-id="${c.id}" ${on ? "checked" : ""} ${blocked ? "disabled" : ""}>
          <div><b>${c.name}</b><small>${c.desc}</small></div><span class="cost">${M(c.cost)}</span></label>`;
      }).join("");
      FT.app.innerHTML = ui.header() + `<div class="panel"><h2>Q${S.month + 1}: ${mode.landmarks[S.month]}</h2>
        ${S.month === 0 ? `<div class="notice">${st.briefing}</div>${FT.years.notice()}` : ""}
        ${tip(st.tips[0])}
        ${S.leadGone ? `<div class="notice">There is no security lead. Nobody is asking you for anything, which is not the same as nothing being wrong.</div>` : ""}
        <div class="${S.tutorial && S.month === 0 ? "spot" : ""}">${reportHTML(S)}</div>
        ${st.businessPanel ? st.businessPanel(S) : ""}
        ${tip(st.tips[1])}
        <h3 class="grp">Where does the money go this quarter?</h3>
        <p class="hint grp-note">${M(S.budget)} available this quarter. Unspent money returns to the bottom line, which ${st.boardWord || "the board"} likes a little.</p>
        <div class="opts">${html}</div>
        <p class="hint">Remaining after these choices: ${M(left)}</p>
        <div class="row"><button class="btn" id="next">Approve the budget</button></div></div>`;
      FT.app.querySelectorAll("input[data-id]").forEach(cb => cb.onchange = () => { cb.checked ? picked.add(cb.dataset.id) : picked.delete(cb.dataset.id); draw(); const a = FT.app.querySelector(`input[data-id="${cb.dataset.id}"]`); a && a.focus(); });
      document.getElementById("next").onclick = () => {
        const lines = [];
        const askIntroduced = ASKS.find(a => a.q === S.month);
        for (const id of picked) {
          const c = list.find(x => x.id === id); S.budget -= c.cost;
          if (id === "ops") { S.fundedOps = true; lines.push("Funded the security team for the quarter."); }
          else if (c.kind === "ask") { c.apply(S); S.funded[id] = true; leadChange(10); lines.push(`Funded: ${c.name.toLowerCase()}.`); }
          else if (id === "assess") { S.assessed = true; S.vis = clamp(S.vis + 30); lines.push("Commissioned an independent assessment. Its findings arrive next quarter."); }
          else if (id === "insure") { S.insured = true; lines.push("Bought cyber insurance for the year."); }
          else if (c.kind === "extra") { lines.push(c.apply(S)); }
          else if (id === "growth") { S.grewThisQuarter = true; S.income += st.growth.income; S.care = clamp(S.care + st.growth.care); S.board = clamp(S.board + 4); if (st.growth.apply) st.growth.apply(S); lines.push(st.growth.done); }
        }
        if (askIntroduced && !S.funded[askIntroduced.id] && !S.leadGone) { leadChange(-8); lines.push(`Declined for now: ${askIntroduced.name.toLowerCase()}. ${st.lead.short} was disappointed.`); }
        if (!picked.has("ops") && !S.leadGone) lines.push(`The security team was not fully funded this quarter. ${st.lead.short} warned that things will slip.`);
        if (!lines.length) lines.push("You held onto the cash.");
        FT.note("Budget", picked.size ? `Funded: ${[...picked].map(id => list.find(c => c.id === id).name.toLowerCase()).join("; ")}.` : "Funded nothing.");
        panel(`<h2>Budget approved</h2><ul class="report">${lines.map(l => `<li>${l}</li>`).join("")}</ul>
          <div class="row"><button class="btn" id="n">Open your inbox</button></div>`, "#n");
        document.getElementById("n").onclick = () => inbox(0);
      };
    }
    draw();
  }

  function inbox(i) {
    if (i >= 2) return FT.screens.runEvent();
    const st = mode.setting;
    const all = DILEMMAS.concat(st.dilemmas || []);
    const nextId = S.month === 0 && i === 0 ? null : S.dilemmaDeck.shift(); // draw once, outside the search
    const dl = nextId === null ? DILEMMAS.find(x => x.first) : all.find(x => x.id === nextId);
    panel(`<h2>Inbox: ${dl.title}</h2>
      <p class="hint">From: ${dl.from === "Security lead" ? st.lead.name : dl.from}</p>
      ${i === 0 ? tip(st.tips[2]) : ""}
      <p>${dl.text(S)}</p>
      <div class="row">${dl.options.map((o, k) => `<button class="btn ${k ? "ghost" : ""}" data-i="${k}">${o.label}</button>`).join("")}</div>`, "button[data-i]");
    FT.app.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => { FT.note(dl.title, `Chose: ${dl.options[+b.dataset.i].label}.`); result(`Inbox: ${dl.title}`, dl.options[+b.dataset.i].run(S), () => inbox(i + 1)); });
  }

  /* ---------- Scheduled: accepted risks coming due, and the crisis ---------- */
  mode.scheduled = [
    { when: S => S.month === 3, run: () => crisis() },
    { when: S => mode.setting.midyear && S.month === S.midyearMonth, run: () => mode.setting.midyear() },
    { when: S => S.accepted.some(a => a.quarter < S.month && !a.done) && chance(.5), run: () => {
      const a = S.accepted.find(x => x.quarter < S.month && !x.done); a.done = true;
      FT.screens.outcome("The risk you signed", { text: `Attackers got in through ${a.desc}, the risk you formally accepted in Q${a.quarter + 1}. The board asked who signed the acceptance. It was you.`, fx: { board: -12, trust: -6, care: -6 }, lesson: ["Risk acceptance is a decision", "Accepting a risk is legitimate, but it’s a bet with your name on it. It should be rare, time-limited and revisited."] });
    } }
  ];

  /* ---------- The crisis ---------- */
  const FINALE_RESULTS = {
    contained: { label: "Contained before it became a crisis", bonus: 12 },
    led: { label: "Led well through a serious attack", bonus: 8 },
    survived: { label: "Survived a serious attack", bonus: 3 },
    bad: { label: "A crisis made worse", bonus: 0 }
  };
  function crisis() {
    S.finale = true;
    const st = mode.setting, d = S.d;
    const strength = -(S.crisisPenalty || 0) + (d.mfa ? 25 : 0) + d.patch * .2 + (d.detect + (d.mdr ? 30 : 0)) * .3 + (d.vendor * .1) - d.exceptions * 8 - S.accepted.filter(a => !a.done).length * 8;
    const caller = S.leadGone ? "The IT director calls, sounding panicked" : `${st.lead.short} calls`;
    const acc = { board: 0, care: 0, trust: 0, cash: 0 }, story = [];
    let score = 0;
    L.set("Leading a crisis", "In a cyber crisis, the CEO’s job is the business decisions: who to call, what to say, when to disclose, and whether to pay. Preparation decides how many good options you have.");

    // Caught early?
    if (!S.leadGone && chance(Math.max(.03, Math.min(.6, (strength - 40) / 80)))) {
      const r = { text: `At 6:10 on a Saturday morning, ${caller}. Attackers got into one system overnight, but the team caught them within the hour and contained them. Nothing was encrypted, and the evidence suggests no data left. The only decision for you: whether to tell customers about an attack that didn’t succeed.`, fx: {} };
      return decide("6:10 a.m., Saturday", r.text, [
        { label: "Tell them, briefly and plainly", run: () => { acc.trust += 3; acc.board += 4; story.push("You sent a short, plain note. Several customers thanked you for it."); return finish("contained"); } },
        { label: "Say nothing; nothing was lost", run: () => { acc.board += 2; story.push("You stayed quiet. It was a defensible call, since nothing was lost."); return finish("contained"); } }
      ]);
    }

    // A full-blown attack hurts no matter how well it's handled; decisions decide how much more
    acc.care -= 10; acc.trust -= 8; acc.board -= 8;
    // ...and hits much harder with no plan, no insurance and no proven backups
    if (!d.irPlan && !S.insured) { acc.board -= 8; acc.trust -= 4; }
    if (!d.backups) { acc.care -= 6; acc.trust -= 4; }
    step1();
    function step1() {
      decide("6:10 a.m., Saturday", `${caller}: ransomware. ${st.crisisImpact} A ransom note demands ${M(st.ransom)}.${S.leadGone ? " Nobody internal really knows what to do." : ""}<br><br><b>Who do you call first?</b>`, [
        { label: "Outside lawyers and incident responders", run: () => {
          if (S.d.irPlan || S.insured) { score += 2; story.push(S.d.irPlan ? "Your retainer had responders and lawyers working within two hours." : "Your insurer’s panel had responders and lawyers working within hours."); }
          else { score += 1; acc.cash -= 400000; story.push("With no retainer or insurance, it took two days and $400,000 in rush fees to get responders and lawyers engaged."); }
          step2();
        } },
        { label: "Let the internal team handle it quietly", run: () => { score -= 1; acc.trust -= 4; story.push(S.leadGone ? "With no security lead, the internal team flailed for days." : "The internal team did their best, but they were overwhelmed and evidence was lost."); step2(); } },
        { label: "Call the insurance company", run: () => {
          if (S.insured) { score += 2; story.push("Your insurer connected you with responders and lawyers within hours, and started the claim."); }
          else { score -= 1; story.push("You don’t have cyber insurance. That call cost you an hour."); }
          step2();
        } }
      ]);
    }
    function step2() {
      decide("8:30 a.m.", `${st.opsQuestion}`, [
        { label: st.opsSafe, run: () => { acc.care -= 10; score += 1; story.push(st.opsSafeText); step3(); } },
        { label: st.opsRisky, run: () => { if (chance(.5)) { acc.care -= 25; score -= 1; story.push(st.opsRiskyBad); } else { acc.care -= 6; story.push(st.opsRiskyOk); } step3(); } }
      ]);
    }
    function step3() {
      decide("Sunday", `The responders confirm attackers copied ${st.dataName} before encrypting. Forensics will take weeks. <b>What do you tell ${st.public}?</b>`, [
        { label: "Notify now with what we know", run: () => { acc.trust -= 6; score += 1; story.push("You notified quickly and updated as you learned more. People were angry, but they heard it from you."); step4(); } },
        { label: "Wait until forensics finish", run: () => { acc.trust -= S.regStrict ? 20 : 14; acc.board -= S.regStrict ? 8 : 4; score -= 1; story.push(`A reporter broke the story before you said anything, and ${st.regulator} asked why notification was late.`); step4(); } }
      ]);
    }
    function step4() {
      const believesGood = S.report.find(r => r[0] === "Backups")[1] === 2;
      const reallyGood = d.backups;
      decide("Monday", `${S.leadGone ? "The IT director" : st.lead.short} ${believesGood ? "believes the backups are good" : "isn’t confident in the backups"}.${S.falseAttest ? " Also, legal flags the attestation you signed: you certified multi-factor login that wasn’t enforced." : ""} <b>Do you pay the ransom?</b>`, [
        { label: "Refuse and restore", run: () => {
          if (reallyGood) { acc.care -= 5; score += 1; story.push("The backups were good. Restoring took a week."); }
          else { acc.care -= 25; acc.trust -= 8; score -= 1; story.push(believesGood ? "The backups were not good, whatever the report said. Rebuilding took four weeks." : "Without good backups, rebuilding took four weeks."); }
          step5();
        } },
        { label: "Pay the ransom", run: () => {
          acc.cash -= S.insured ? 250000 : st.ransom; acc.board -= S.insured ? 6 : 14; score -= 1;
          story.push(`You paid${S.insured ? " (insurance covered most of it)" : ""}. The decryptor was slow, and the stolen data appeared for sale anyway.`);
          L.set("Paying the ransom", "Paying doesn’t guarantee recovery or that stolen data is deleted, funds criminals and marks you as a payer.");
          step5();
        } }
      ]);
    }
    function step5() {
      decide("Tuesday", "The press is calling. <b>What do you say?</b>", [
        { label: "A CEO statement: what happened, what we’re doing", run: () => { acc.trust += 4; score += 1; story.push("You fronted it yourself. Coverage was rough but fair."); conclude(); } },
        { label: "“No evidence any data was accessed”", run: () => { acc.trust -= 12; acc.board -= 6; score -= 1; story.push("That statement was false, and the stolen data being sold online proved it within a week."); conclude(); } }
      ]);
    }
    function conclude() {
      if (S.claimedSafe) { acc.board -= 10; story.push("The board reminded you that you told them you were in good shape."); }
      if (S.falseAttest) { acc.board -= 6; acc.trust -= 4; story.push("Legal is now dealing with the false attestation you signed."); }
      if (st.crisisExtra) st.crisisExtra(S, acc, story);
      const key = score >= 3 ? "led" : score >= 0 ? "survived" : "bad";
      if (key === "bad") { acc.board -= 15; acc.trust -= 8; story.push("By the end of the week, the board was discussing leadership changes."); }
      finish(key);
    }
    function decide(clock, text, options) {
      ui.screen(`<div class="panel finale"><div class="clock">${clock}</div><h2>The crisis</h2><p>${text}</p>
        ${S.tutorial && !S.seenDecision ? ui.advisor(`<p><b>${st.chief}:</b> ${st.tips[3]}</p>`, "tut") : ""}
        <div class="row">${options.map((o, i) => `<button class="btn ${i ? "ghost" : ""}" data-d="${i}">${o.label}</button>`).join("")}</div></div>`, "button[data-d]");
      S.seenDecision = true;
      FT.app.querySelectorAll("button[data-d]").forEach(b => b.onclick = () => { FT.note(`Crisis, ${clock}`, `Chose: ${options[+b.dataset.d].label}.`); options[+b.dataset.d].run(); });
    }
    function finish(key) {
      S.finaleResult = key;
      const fx = {};
      for (const k in acc) if (acc[k]) fx[k] = acc[k];
      if (key === "contained") { fx.board = (fx.board || 0) + 4; }
      FT.screens.outcome("The crisis", { text: story.join(" "), fx, lesson: key === "contained" ? ["Preparation is invisible until it isn’t", "A crisis that never happens is the best outcome there is, and it’s bought with the boring investments made months earlier."] : ["Leading a crisis", "In a cyber crisis, the CEO’s job is the business decisions: who to call, what to say, when to disclose, and whether to pay. Preparation decides how many good options you have."] });
    }
  }

  /* ---------- The reveal: what the reports said versus reality ---------- */
  function revealHTML(S) {
    const truth = actual(S), last = S.reportHistory[S.reportHistory.length - 1] || [];
    const rows = truth.map(([k, a, why], i) => {
      const said = last[i] ? last[i][1] : a;
      return `<tr><td>${k}</td><td class="${CLS[said]}">${WORD[said]}</td><td class="${CLS[a]}">${WORD[a]}</td><td>${why}</td></tr>`;
    }).join("");
    const misses = truth.filter(([, a], i) => last[i] && last[i][1] !== a).length;
    return `<h2 style="margin-top:1.25rem;font-size:1.8rem">What was really going on</h2>
      <p>${misses ? `Your last report was wrong about ${misses} thing${misses > 1 ? "s" : ""}, always in the hopeful direction.` : "Your last report was accurate. You paid for that."}</p>
      <div style="overflow-x:auto"><table class="reveal"><thead><tr><th>Area</th><th>Report said</th><th>Reality</th><th>Why</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${S.accepted.length ? `<p class="hint">Risks you signed for: ${S.accepted.map(a => a.name).join(", ")}.</p>` : ""}`;
  }

  FT.register(mode);
})();
