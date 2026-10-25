/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Leadership mode settings: the same three organizations as practitioner
 * mode, seen from the CEO's chair. Each supplies names, money, wording, a
 * couple of its own inbox decisions and events, and its crisis details. */
(function () {
  const S = FT.S, { chance, clamp } = FT.util;
  const mode = FT.modes.leadership;

  /* ---------- Riverside Regional Medical Center ---------- */
  mode.addSetting({
    id: "hospital", letter: "H", name: "Riverside Regional Medical Center", short: "Hospital",
    summary: "A 320-bed regional hospital. Every security decision is also a patient-safety decision.",
    chief: "Your chief of staff",
    lead: { name: "Grace Osei, your CISO", short: "Grace" },
    missionLabel: "Patient care", missionShort: "Care", trustLabel: "Community trust",
    landmarks: ["New fiscal year", "Flu season", "Accreditation year", "Budget season"],
    quarterBudget: 800000, opsCost: 250000,
    growth: { name: "Expand the cardiology service line", cost: 500000, desc: "New cath lab hours and two cardiologists. Better care, and more revenue every quarter after.", income: 150000, care: 6, done: "Funded the cardiology expansion." },
    briefing: "<b>You’re the new CEO</b> of Riverside Regional Medical Center: 320 beds, 2,400 staff, thin margins, and a community that depends on you.",
    tips: [
      "This is Grace’s security report. Notice the confidence line at the bottom: right now, the report is only partly reliable. It shows what Grace can see and what people tell her, which is usually rosier than reality. Paying for an independent assessment makes next quarter’s report accurate.",
      "Every dollar competes. Funding the security team keeps things from slipping; Grace’s requests fix specific gaps; the cardiology expansion grows the hospital and pleases the board. You can’t do it all. Underfunding security doesn’t hurt right away, and that’s the trap.",
      "Your inbox: decisions only you can make. Several will test whether the rules apply to you, too. Staff notice.",
      "This is a crisis decision. There’s rarely a perfect answer, but preparation (a retainer, insurance, tested backups, an honest relationship with your security lead) decides how many good options you have."
    ],
    customer: "health insurer", legacy: "the old Windows 7 MRI console, which can’t be patched", legacyShort: "Unpatchable MRI console",
    acquisition: "Lakeview Outpatient Clinic", dataName: "patient records", regulator: "The state health department", public: "patients",
    crisisImpact: "The EHR, imaging, lab and pharmacy systems are down, and the emergency department is filling up.",
    ransom: 2400000,
    opsQuestion: "Ambulances are on their way and clinicians are on paper. <b>Do you divert ambulances to other hospitals?</b>",
    opsSafe: "Go on diversion", opsSafeText: "You went on diversion, so serious cases went to other hospitals while staff worked on paper.",
    opsRisky: "Stay open on paper", opsRiskyBad: "You stayed open. A stroke patient’s scan was delayed for over an hour. The family has hired a lawyer.", opsRiskyOk: "You stayed open on paper. The downtime drills held.",
    deaths: { care: "Patient care collapsed. The state has opened an investigation, and the board has asked for your resignation.", trust: "The community has lost faith in Riverside. The board has asked for your resignation." },
    dilemmas: [
      { id: "logout", from: "Chief medical officer", title: "Doctors want auto-logout removed", text: () => "The chief medical officer says the 10-minute auto-logout on clinical workstations wastes physician time and asks you to switch it off.", options: [
        { label: "Fund tap-badge login instead ($150k)", run: S => { S.budget -= 150000; return { text: "Tap-badge login made logging back in take two seconds. The doctors were happy and the workstations stayed protected.", fx: { care: 3, lead: 6 } }; } },
        { label: "Switch auto-logout off", run: S => { S.d.exceptions++; return { text: "Done. Physicians are happier. Unattended workstations now stay logged in to the EHR all shift.", fx: { care: 2, lead: -6 } }; } }
      ] },
      { id: "devices", from: "Biomed vendor", title: "The pump vendor’s demand", text: () => "The infusion pump vendor says they’ll only support the pumps if they keep permanent remote access and you don’t put the pumps on a separate network.", options: [
        { label: "Negotiate supervised access", run: () => ({ text: "It took two months of negotiation, but the vendor agreed to supervised, on-demand access.", fx: { lead: 6, care: -1 } }) },
        { label: "Agree to their terms", run: S => { S.d.vendor = clamp(S.d.vendor - 20); return { text: "Agreed. The vendor has permanent access to devices connected to patients.", fx: {} }; } }
      ] }
    ],
    events: [
      { id: "celebrity", title: "A celebrity in the ED", run(S) {
        if (S.d.detect + (S.d.mdr ? 25 : 0) >= 55) return { text: "A local news anchor was treated in the ED. Monitoring flagged staff snooping in her chart within an hour, and the privacy office handled it quietly.", fx: { trust: 1 }, lesson: ["Monitoring protects reputations", "Detecting inappropriate access quickly turns a scandal into a staff matter."] };
        return { text: "A local news anchor was treated in the ED. Details of her visit appeared online, and an audit found 23 staff had opened her chart.", fx: { trust: -10, board: -5 }, lesson: ["Monitoring protects reputations", "Detecting inappropriate access quickly turns a scandal into a staff matter."] };
      } }
    ]
  });

  /* ---------- Hallett Precision Components ---------- */
  mode.addSetting({
    id: "manufacturing", letter: "M", name: "Hallett Precision Components", short: "Manufacturer",
    summary: "A 650-person, family-owned parts maker. Every hour of downtime costs money, and the owners watch every dollar.",
    chief: "Your chief of staff",
    lead: { name: "Tom Brandt, your IT and security manager", short: "Tom" },
    missionLabel: "Production", missionShort: "Production", trustLabel: "Customer trust",
    landmarks: ["Annual planning", "Peak orders", "Summer shutdown", "Year-end rush"],
    quarterBudget: 720000, opsCost: 220000,
    growth: { name: "Buy two new CNC machining centers", cost: 450000, desc: "More capacity for the big automotive contract, and more revenue every quarter after.", income: 140000, care: 6, done: "Bought two new CNC machining centers." },
    briefing: "<b>You’re the new CEO</b> of Hallett Precision Components: one plant, three shifts, 650 people, a family board, and customers who expect parts on time.",
    tips: [
      "This is Tom’s security report. Notice the confidence line at the bottom: right now, it’s only partly reliable. It shows what Tom can see and what people tell him, which is usually rosier than reality. Paying for an independent assessment makes next quarter’s report accurate.",
      "Every dollar competes. Funding the security team keeps things from slipping; Tom’s requests fix specific gaps; new machines grow the business and please the owners. You can’t do it all. Underfunding security doesn’t hurt right away, and that’s the trap.",
      "Your inbox: decisions only you can make. Several will test whether the rules apply to you, too. The plant notices.",
      "This is a crisis decision. There’s rarely a perfect answer, but preparation (a retainer, insurance, tested backups, an honest relationship with your security lead) decides how many good options you have."
    ],
    customer: "automotive", legacy: "the molding line’s Windows XP control screen, which can’t be upgraded without replacing the cabinet", legacyShort: "Windows XP control screen",
    acquisition: "a small machining shop across town", dataName: "customer part drawings", regulator: "Your largest customer’s auditors", public: "customers",
    crisisImpact: "The ERP, scheduling and engineering systems are encrypted, and two screens on the plant floor show a ransom note.",
    ransom: 1800000,
    opsQuestion: "The morning shift arrives in an hour, and a rush order is due Friday. <b>Do you keep the plant down until systems are clean?</b>",
    opsSafe: "Keep the plant down", opsSafeText: "You kept the plant down while systems were checked, and told customers why.",
    opsRisky: "Restart on manual processes", opsRiskyBad: "You restarted on manual processes. A wrong setting scrapped a day of parts, and a press nearly ran without its safety interlock.", opsRiskyOk: "You restarted on manual processes. It was slow and messy, but it held.",
    deaths: { care: "Production collapsed. Your biggest customer moved its orders, and the owners asked for your resignation.", trust: "Customers have lost faith in Hallett. The owners asked for your resignation." },
    dilemmas: [
      { id: "integrator", from: "Plant manager", title: "Permanent remote access for the integrator", text: () => "The plant manager wants the packaging-line integrator to have permanent remote access, so they can fix breakdowns faster.", options: [
        { label: "Fund a supervised gateway ($100k)", run: S => { S.budget -= 100000; S.d.vendor = clamp(S.d.vendor + 20); return { text: "The integrator now connects through a logged gateway, approved per session. Fixes take five minutes longer.", fx: { lead: 6 } }; } },
        { label: "Give them permanent access", run: S => { S.d.vendor = clamp(S.d.vendor - 20); return { text: "Done. Breakdowns get fixed faster, and an outside company has an always-open door into your plant.", fx: { care: 2 } }; } }
      ] },
      { id: "owners", from: "Board (family owners)", title: "The owners’ shared password", text: () => "The family owners share one login for the financial system and want to keep it that way. “We trust each other.”", options: [
        { label: "Give each owner their own login", run: () => ({ text: "Each owner got their own login with multi-factor. There was a family argument about it, which you survived.", fx: { board: -2, lead: 6 } }) },
        { label: "Leave it", run: S => { S.d.exceptions++; return { text: "Left as is. The most powerful account in the company is a shared password on a sticky note.", fx: { board: 2 } }; } }
      ] }
    ],
    events: [
      { id: "suppbec", title: "A supplier’s new bank account", run(S) {
        if (S.d.exceptions === 0 && (S.d.mfa || S.d.irPlan)) return { text: "A supplier’s hacked email asked accounts payable to send a $480,000 payment to a new bank account. AP called the supplier to confirm, as policy requires. Fraud stopped.", fx: { trust: 1 }, lesson: ["Payment fraud", "A callback rule for bank changes stops the most expensive fraud in manufacturing."] };
        return { text: "A supplier’s hacked email asked accounts payable to send a $480,000 payment to a new bank account. They did. Insurance covers a fraction.", fx: { cash: -350000, board: -8 }, lesson: ["Payment fraud", "A callback rule for bank changes stops the most expensive fraud in manufacturing."] };
      } }
    ]
  });

  /* ---------- Cobaltline ---------- */
  mode.addSetting({
    id: "software", letter: "S", name: "Cobaltline", short: "Software company",
    summary: "A 400-person B2B software company, venture-backed and growing fast. Customers trust you with their financial data.",
    chief: "Your chief of staff",
    lead: { name: "Leah Kim, your head of security", short: "Leah" },
    missionLabel: "Growth", missionShort: "Growth", trustLabel: "Customer trust",
    landmarks: ["Sales kickoff", "Fundraising", "Customer conference", "Year-end close"],
    quarterBudget: 880000, opsCost: 250000,
    growth: { name: "Hire four more account executives", cost: 550000, desc: "Faster revenue growth, and a better story for the next funding round.", income: 170000, care: 7, done: "Hired four more account executives." },
    briefing: "<b>You’re the CEO</b> of Cobaltline: 400 people, remote-first, venture-backed, and selling procurement software to finance teams who trust you with their data.",
    tips: [
      "This is Leah’s security report. Notice the confidence line at the bottom: right now, it’s only partly reliable. It shows what Leah can see and what people tell her, which is usually rosier than reality. Paying for an independent assessment makes next quarter’s report accurate.",
      "Every dollar competes. Funding the security team keeps things from slipping; Leah’s requests fix specific gaps; new sales hires grow revenue and please investors. You can’t do it all. Underfunding security doesn’t hurt right away, and that’s the trap.",
      "Your inbox: decisions only you can make. Several will test whether the rules apply to you, too. Everyone notices.",
      "This is a crisis decision. There’s rarely a perfect answer, but preparation (a retainer, insurance, tested backups, an honest relationship with your security lead) decides how many good options you have."
    ],
    customer: "bank", legacy: "an old file-transfer server that a few large customers still depend on", legacyShort: "Legacy file-transfer server",
    acquisition: "a small analytics startup", dataName: "customers’ financial records", regulator: "Your enterprise customers’ legal teams", public: "customers",
    crisisImpact: "Production is encrypted, customer data has been stolen, and the gang has posted a countdown on its leak site.",
    ransom: 3500000,
    opsQuestion: "Hundreds of customers start work in three hours, and your product is down. <b>Do you keep it down until it’s clean?</b>",
    opsSafe: "Stay down until clean", opsSafeText: "You kept the platform down until it was clean and told customers exactly why.",
    opsRisky: "Restore service fast", opsRiskyBad: "You rushed service back. Some customers saw corrupted invoices, and the attackers still had a way in.", opsRiskyOk: "You restored service quickly. It was messy, but it held.",
    deaths: { care: "Growth collapsed. The funding round fell through, and the board asked for your resignation.", trust: "Customers have lost faith in Cobaltline. The board asked for your resignation." },
    dilemmas: [
      { id: "soc2claim", from: "VP of sales", title: "“Just say we’re SOC 2 certified”", text: () => "Your VP of sales wants to tell a big prospect that you’re SOC 2 certified. The audit isn’t finished, but “it basically is.”", options: [
        { label: "Tell the truth: in progress", run: () => ({ text: "The prospect appreciated the honesty and signed with a clause to share the report when it’s done.", fx: { trust: 2, care: -1 } }) },
        { label: "Let sales say it", run: S => { S.falseAttest = true; return { text: "The deal closed. There’s now a contract that says something untrue.", fx: { care: 4 } }; } }
      ] },
      { id: "investor", from: "Lead investor", title: "Your investor wants admin access", text: () => "Your lead investor’s operating partner wants admin access to your production dashboards to “help with metrics.”", options: [
        { label: "Offer a read-only report", run: () => ({ text: "You set up a read-only metrics report. The investor was mildly annoyed, then forgot about it.", fx: { board: -1, lead: 4 } }) },
        { label: "Give them admin access", run: S => { S.d.exceptions++; return { text: "Done. An outside partner with a personal laptop now has admin access to production systems.", fx: { board: 3, lead: -6 } }; } }
      ] }
    ],
    events: [
      { id: "cloudbill", title: "A $38,000 surprise bill", run(S) {
        if (S.d.detect + (S.d.mdr ? 25 : 0) >= 55) return { text: "An engineer leaked a cloud key on GitHub. Monitoring caught it within minutes, and Leah’s team revoked it.", fx: {}, lesson: ["Fast detection limits damage", "Leaked keys are found by attackers within minutes. Only fast detection beats that."] };
        return { text: "An engineer leaked a cloud key on GitHub. Attackers used it to run crypto-mining servers for a week before anyone noticed.", fx: { cash: -38000, board: -4 }, lesson: ["Fast detection limits damage", "Leaked keys are found by attackers within minutes. Only fast detection beats that."] };
      } }
    ]
  });
})();
