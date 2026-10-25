/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Practitioner setting: a small business.
 * At this size there's no security team. Security is one of several hats worn
 * by whoever “does IT,” with an outside helper doing hands-on work under a
 * contract. So the mechanics change:
 *  - Time, not a team: you get a few tasks a month, and keeping the lights on
 *    eats most of them. Your helper has contracted hours you can top up with
 *    money instead of burnout.
 *  - Buy and switch on, rather than build: built-in security features,
 *    managed endpoint protection, a payment verification rule, insurance.
 *  - Payment fraud leads the threats, and a bad ransomware event can end the
 *    business.
 * The kind of business (medical practice, machine shop, SaaS startup) is drawn
 * from the year’s seed, and decides who you are and who helps you. */
(function () {
  const S = FT.S, L = FT.learned, { chance, clamp, money, pick } = FT.util, sys = FT.sys;
  const mode = FT.modes.practitioner, team = mode.team;

  /* ---------- The three kinds of small business ---------- */
  const KINDS = {
    medical: {
      org: "Lakeside Family Medicine", seat: "Office manager", owner: "Dr. Ruth Albers", ownerShort: "Dr. Albers",
      helper: "TechWise IT", helperRole: "Your MSP, on a basic contract",
      mission: "Practice running", missionShort: "Practice", trustLabel: "Dr. Albers’s trust",
      people: "22 people, two physicians and a busy front desk", customers: "patients", work: "seeing patients",
      briefing: "<b>Your job:</b> office manager at Lakeside Family Medicine, 22 people and two physicians. You handle scheduling, billing, HR and, somehow, IT. TechWise IT, your MSP, does the hands-on work a few hours a month.",
      orientation: "Thanks for taking this on. I need to see patients, not worry about computers. Our insurer is asking questions I can’t answer, the front desk shares a login, and I’m not sure what TechWise actually does for us. Just keep us running and keep us out of the news.",
      down: "The practice closed for good. Your patients went to the hospital group across town.",
      closeLabel: "Close the practice until it’s clean", stayLabel: "See patients on paper",
      chores: [["The front desk printer is jammed again, and the doctors need it now.", "Fixed the front desk printer, again."], ["A new nurse starts Monday and needs accounts for everything.", "Set up accounts for a new nurse."], ["The patient portal is rejecting logins, and phones are ringing.", "Sorted out patient portal logins with the vendor."], ["Dr. Albers’s laptop is “acting weird” before her afternoon clinic.", "Calmed down Dr. Albers’s laptop before clinic."]]
    },
    shop: {
      org: "Ridgeline Machine & Tool", seat: "Operations manager", owner: "Walt Brennan", ownerShort: "Walt",
      helper: "Gus", helperRole: "Part-time IT contractor",
      mission: "Production", missionShort: "Production", trustLabel: "Walt’s trust",
      people: "45 people, two shifts and a dozen CNC machines", customers: "customers", work: "running the shop",
      briefing: "<b>Your job:</b> operations manager at Ridgeline Machine & Tool, a 45-person job shop. You run scheduling, purchasing and, because nobody else will, IT. Gus, a part-time contractor, comes in a few hours a month.",
      orientation: "You know computers better than I do, so IT’s yours. Gus knows the CNC machines and the network, but he’s only here a few hours a month. Our biggest customer just sent a security questionnaire, and I don’t know what half of it means. Keep the machines running.",
      down: "Ridgeline closed its doors. Walt sold the machines at auction.",
      closeLabel: "Shut the shop down until it’s clean", stayLabel: "Keep running on paper travelers",
      chores: [["The shop floor PC lost its network drive again.", "Reconnected the shop floor PC’s network drive."], ["A new machinist starts Monday and needs a login and a badge.", "Set up a new machinist’s login and badge."], ["Purchasing can’t open a supplier’s spreadsheet.", "Got purchasing into a supplier’s spreadsheet."], ["Walt wants the conference room TV working for a customer visit.", "Fixed the conference room TV before a customer visit."]]
    },
    saas: {
      org: "Fernway", seat: "Developer, and the person who does IT", owner: "Jess Morales", ownerShort: "Jess",
      helper: "An hourly contractor", helperRole: "Security and IT contractor, billed hourly",
      mission: "Customers", missionShort: "Customers", trustLabel: "Jess’s trust",
      people: "12 people, a product with 300 paying customers, and no IT department", customers: "customers", work: "shipping the product",
      briefing: "<b>Your job:</b> senior developer at Fernway, a 12-person software startup, and by default the person who handles IT and security. Jess, the founder, can fund an hourly contractor for a few tasks a month.",
      orientation: "You’re the most security-minded person we have, so it’s yours, on top of your actual job. We need SOC 2-ish answers for customers, everybody is admin on everything, and our cloud account was set up in a hurry. Don’t slow the product down.",
      down: "Fernway ran out of runway. The customers went to a competitor.",
      closeLabel: "Take the product offline until it’s clean", stayLabel: "Restore service fast",
      chores: [["A customer escalation needs a code fix today.", "Shipped a code fix for a customer escalation."], ["A new hire needs a laptop, accounts and access to everything.", "Set up a new hire’s laptop and accounts."], ["The build pipeline broke, and nobody else knows why.", "Fixed the build pipeline."], ["Jess needs a demo environment for an investor meeting.", "Built a demo environment for an investor meeting."]]
    }
  };
  const K = () => KINDS[S.kind || "medical"];
  function setMeters(kind) {
    const k = KINDS[kind];
    mode.meters = [
      { key: "trust", label: k.trustLabel, short: "Trust" },
      { key: "care", label: k.mission, short: k.missionShort },
      { key: "morale", label: "Your bandwidth", short: "Bandwidth", value: () => team.morale() }
    ];
  }

  const smb = {
    id: "smallbiz",
    // Each kind of business has its own code letter; "B" (older codes) means a random kind
    get letter() { return { medical: "C", shop: "J", saas: "U" }[S.kind] || "B"; },
    codeLetters: { C: "medical", J: "shop", U: "saas", B: null },
    kindOptions: [
      ["medical", "Medical practice", "Lakeside Family Medicine. You’re the office manager; the owner is the lead physician. An MSP handles the hands-on work."],
      ["shop", "Machine shop", "Ridgeline Machine & Tool. You’re the operations manager; the owner runs the shop. A part-time IT contractor helps a few hours a month."],
      ["saas", "Software startup", "Fernway, a 12-person startup. You’re a developer who also handles IT; the owner is the founder. An hourly contractor helps."]
    ],
    name: "Small business",
    short: "Small business",
    summary: "A medical practice, a machine shop or a software startup. No security team: just you, a few hours a month, and some outside help.",
    replaceBase: true,
    noGenericInterrupts: true,
    hideSkills: true,
    excludeConditions: ["leave", "jobs"],
    startBudget: 12000, monthlyBudget: 1500, vendorHourCost: 1500,
    rewardScale: .8,
    months: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    landmarks: ["New year, new passwords","Tax season","Busy season","Insurance renewal","Spring cleanup","Summer hours","Vacation coverage","Back to busy","Budget talks","Holiday orders","Year-end crunch","The holidays"],
    winTitle: "You made it through the year",
    get chief() { return K().owner; },
    get orientation() { return K().orientation; },
    get briefing() { return K().briefing; },
    irNote: "The one-page plan meant nobody panicked: you knew who to call, the insurer’s breach line was on the list, and the owner knew what to tell customers. That cut the damage.",
    mdrNote: ["Managed detection", "Outside analysts watching your computers around the clock. For a small business, it’s often the only way to have anyone watching at all."],

    newState() {
      // The chosen kind, if the player picked the small business and a kind; otherwise random from the seed
      const pref = mode.pendingKind || "random";
      const g = FT.rng.fork("smallbiz-kind")();
      const kind = KINDS[pref] ? pref : g < 1 / 3 ? "medical" : g < 2 / 3 ? "shop" : "saas";
      setMeters(kind);
      const k = KINDS[kind];
      return {
        kind, notices: [k.briefing],
        builtin: 30, payRule: false, admins: 25, insured: false, immutable: false,
        patch: 40, backupAge: 6, backupTested: false, training: 25, detect: 15, edr: 30, filter: 40, vendor: 25, stale: 6, inventory: 20, mfa: false, irPlan: false,
        team: [
          { id: "you", name: "You", role: k.seat, skill: "lead", cap: 3, burnout: 30 },
          { id: "helper", name: k.helper, role: k.helperRole, skill: "infra", cap: 1, burnout: 0, vendor: true }
        ]
      };
    },
    replacement: p => ({ name: p.name, burnout: 10, newHire: 0, away: 0 }),

    // Keeping the lights on: most months, IT chores eat some of your time
    extraInterrupts(S) {
      const out = [], k = K();
      const n = chance(.75) ? (chance(.3) ? 2 : 1) : 0;
      const chores = FT.util.shuffle(k.chores.slice());
      for (let i = 0; i < n; i++) out.push({ who: "you", text: `Keeping things running: ${chores[i][0]}`, done: chores[i][1] });
      return out;
    },

    /* ---------- What a small business can actually do ---------- */
    actions: [
      { id: "builtin", kind: "upkeep", skill: "lead", name: "Turn on built-in security features", desc: "The protections already included in your email and office software, mostly switched off.",
        apply: (S, k) => { S.builtin = clamp(S.builtin + Math.round(30 * k)); S.filter = clamp(S.filter + Math.round(10 * k)); return "Switched on more of the security features you already pay for."; } },
      { id: "patch", kind: "upkeep", skill: "infra", name: "Update computers and devices", desc: "Windows, browsers, the router and the firewall.",
        apply: (S, k) => { S.patch = clamp(S.patch + Math.round(40 * k)); return "Updated computers, browsers and the network gear."; } },
      { id: "backup", kind: "upkeep", skill: "infra", name: "Check the backups actually restore", desc: "Restore a real file, not just check that a backup ran.",
        apply: S => { S.backupAge = 0; S.backupTested = true; return "Restored a test file from backup. It worked."; } },
      { id: "scams", kind: "upkeep", skill: "lead", name: "Talk to staff about scams", desc: "Ten minutes at the staff meeting: fake invoices, gift cards, fake logins.",
        apply: (S, k) => { S.training = clamp(S.training + Math.round(25 * k)); return "Walked staff through the latest scams at the staff meeting."; } },
      { id: "accounts", kind: "upkeep", skill: "lead", name: "Clean up old accounts and shared passwords", desc: "People who left, shared logins, the password on the sticky note.",
        apply: S => { const n = S.stale; S.stale = 0; return n ? `Closed ${n} old accounts and changed the shared passwords.` : "Checked for old accounts. All clean."; } },
      { id: "admins", kind: "upkeep", skill: "infra", name: "Take away everyday admin rights", desc: "Staff shouldn’t be able to install anything on their computers.",
        apply: (S, k) => { S.admins = clamp(S.admins + Math.round(30 * k)); return "Removed admin rights from everyday accounts."; } },
      { id: "contract", kind: "upkeep", skill: "lead", name: "Review what your outside help covers", desc: "What’s in the contract, what costs extra, and who does what in an emergency.",
        apply: (S, k) => { S.vendor = clamp(S.vendor + Math.round(35 * k)); return "Sat down with your outside help and wrote down who does what."; } },
      { id: "mfa", kind: "project", skill: "lead", cost: 0, work: 2, name: "Turn on MFA for email and banking", desc: "A phone prompt on every email account and the bank. Expect complaints.",
        done: S => { S.mfa = true; return "Multi-factor login is on for every email account and the bank."; } },
      { id: "payrule", kind: "project", skill: "lead", cost: 0, work: 1, name: "Set up a payment verification rule", desc: "Any change to bank details gets a phone call to a known number, every time.",
        done: S => { S.payRule = true; return "The payment verification rule is in place, and the bookkeeper knows it’s not optional."; } },
      { id: "edr", kind: "project", skill: "infra", cost: 3000, work: 1, name: "Add managed endpoint protection", desc: "Proper protection on every computer, watched by your outside help. Plus a monthly fee.",
        done: S => { S.edr = Math.max(S.edr, 80); S.detect = clamp(S.detect + 20); S.monthlyFees = (S.monthlyFees || 0) + 300; return "Managed endpoint protection is on every computer. It adds $300 a month."; } },
      { id: "cloudbackup", kind: "project", skill: "infra", cost: 2500, work: 1, name: "Set up cloud backups that can’t be deleted", desc: "Immutable backups, off-site, out of reach of ransomware.",
        done: S => { S.immutable = true; S.backupTested = true; S.backupAge = 0; return "Immutable cloud backups are running, and the first restore test passed."; } },
      { id: "irplan", kind: "project", skill: "lead", cost: 0, work: 1, name: "Write a one-page incident plan", desc: "Who to call, in what order, and what to tell customers.",
        done: S => { S.irPlan = true; return "The one-page incident plan is printed and taped inside the supply closet."; } },
      { id: "insure", kind: "project", skill: "lead", cost: 4000, work: 1, name: "Get cyber insurance", desc: "Covers incident costs and comes with a breach hotline. Insurers will ask about MFA and backups.", show: S => !S.insured,
        done: S => { S.insured = true; return "Cyber insurance is in place, with a breach hotline number on the incident plan."; } }
    ],

    monthEnd(S) {
      const d = n => Math.round(n * S.diff.decay);
      S.patch = clamp(S.patch - d(15));
      S.builtin = clamp(S.builtin - d(4));
      S.admins = clamp(S.admins - d(5));
      S.backupAge++; if (S.backupAge > 2 && !S.immutable) S.backupTested = false;
      S.training = clamp(S.training - d(6));
      S.vendor = clamp(S.vendor - d(4));
      S.stale = Math.min(12, S.stale + d(1));
      S.budget -= S.monthlyFees || 0;
    },

    dashboard(S) {
      const lvl = (v, g, o) => v >= g ? "good" : v >= o ? "warn" : "bad";
      return [
        ["Built-in security", lvl(S.builtin, 70, 40), S.builtin >= 70 ? "Switched on" : S.builtin >= 40 ? "Partly on" : "Mostly off"],
        ["MFA on email and bank", S.mfa ? "good" : "bad", S.mfa ? "On" : "Off"],
        ["Payment verification", S.payRule ? "good" : "bad", S.payRule ? "Callback rule in place" : "None"],
        ["Updates", lvl(S.patch, 70, 40), S.patch >= 70 ? "Current" : S.patch >= 40 ? "Falling behind" : "Badly behind"],
        ["Backups", S.backupTested ? "good" : "bad", (S.backupTested ? (S.immutable ? "Immutable, cloud" : `Restore tested ${S.backupAge === 0 ? "this month" : `${S.backupAge} month${S.backupAge > 1 ? "s" : ""} ago`}`) : "Not tested recently")],
        ["Endpoint protection", lvl(S.edr, 75, 50), S.edr >= 75 ? "Managed" : "Basic antivirus"],
        ["Staff scam awareness", lvl(S.training, 60, 35), S.training >= 60 ? "Sharp" : S.training >= 35 ? "Fading" : "Low"],
        ["Admin rights", lvl(S.admins, 70, 40), S.admins >= 70 ? "Restricted" : S.admins >= 40 ? "Mostly restricted" : "Everyone is admin"],
        ["Old accounts", S.stale <= 1 ? "good" : S.stale <= 4 ? "warn" : "bad", S.stale === 0 ? "All cleaned up" : `${S.stale} still active`],
        ["Outside help", lvl(S.vendor, 60, 30), S.vendor >= 60 ? "Clear on who does what" : S.vendor >= 30 ? "Mostly clear" : "Unclear"],
        ["Incident plan", S.irPlan ? "good" : "bad", S.irPlan ? "One page, printed" : "None"],
        ["Cyber insurance", S.insured ? "good" : "bad", S.insured ? "In place" : "None"]
      ];
    },
    explain: {
      "Built-in security": "Protections already included in your email and office software, like blocking risky sign-ins and suspicious attachments. Often switched off by default.",
      "MFA on email and bank": "A phone prompt on top of the password. The single most effective thing a small business can do.",
      "Payment verification": "A rule that any change to bank details gets a phone call to a known number. It stops the most expensive small-business fraud.",
      "Updates": "Windows, browsers, the router and the firewall.",
      "Backups": "Only proven by an actual restore. Immutable cloud backups can’t be deleted by ransomware.",
      "Endpoint protection": "Basic antivirus versus managed protection someone is actually watching.",
      "Staff scam awareness": "How well staff spot fake invoices, gift card requests and fake logins. It fades without reminders.",
      "Admin rights": "Whether everyday accounts can install software. Most malware needs admin rights.",
      "Old accounts": "Accounts of people who left, and shared passwords everyone knows.",
      "Outside help": "Whether you know what your MSP or contractor covers, what costs extra, and who acts in an emergency.",
      "Incident plan": "One page: who to call first, in what order, and what to tell people.",
      "Cyber insurance": "Covers incident costs and usually comes with a breach hotline. Insurers increasingly require MFA, backups and endpoint protection."
    },

    threatWarning(S) {
      if (!(S.month >= S.finaleMonth - 3 && S.month < S.finaleMonth)) return "";
      return `<div class="intel"><b>Heads up from your insurer’s newsletter:</b> The ${S.gang.name} ransomware gang has hit ${5 - (S.finaleMonth - S.month)} small businesses in your area this year, mostly through stolen email passwords and unpatched remote access.</div>`;
    },
    get deaths() {
      return { ransomware: "Your business has died of ransomware.", care: K().down, trust: `${K().ownerShort} decided someone else should handle IT. You’re back to your old job, and the business is worse off.` };
    },

    /* ---------- Mid-year offer: managed detection ---------- */
    mdrOffer() {
      const k = K(), fee = 4000, can = S.budget >= fee, title = "An offer for 24/7 monitoring";
      FT.ui.screen(`<div class="panel"><h2>${title}</h2>
        <p>${k.helper === "Gus" ? "Gus" : k.helper} suggests adding <b>managed detection</b>: outside analysts watching your computers around the clock, for a setup fee and a monthly charge.</p>
        <div class="opts">
          <button class="opt choice" data-c="pro" ${can ? "" : "disabled"}><div><b>Add it, with proper setup</b><small>Tuned to your business. About 85% effective from next month, plus $250 a month.${can ? "" : " You can’t afford the setup fee right now."}</small></div><span class="cost">${money(fee)}</span></button>
          <button class="opt choice" data-c="self"><div><b>Add the basic version</b><small>No setup fee, but default settings, about 35% effective, and a stream of confusing alert emails to you.</small></div><span class="cost">$0</span></button>
          <button class="opt choice" data-c="no"><div><b>Not this year</b><small>One less bill.</small></div><span class="cost">$0</span></button>
        </div></div>`, "button[data-c]:not(:disabled)");
      FT.app.querySelectorAll("button[data-c]").forEach(b => b.onclick = () => {
        const c = b.dataset.c; let r; FT.note(title, `Chose: ${b.querySelector("b").textContent}.`);
        if (c === "pro") { S.budget -= fee; S.mdr = 40; S.mdrRamp = true; S.mdrNoisy = false; S.monthlyFees = (S.monthlyFees || 0) + 250;
          r = { text: "They spent a week learning what normal looks like for your business. Someone is watching now, which is more than most small businesses can say.", fx: { morale: -2 }, lesson: smb.mdrNote }; }
        else if (c === "self") { S.mdr = 35; S.mdrNoisy = true;
          r = { text: "It works, sort of. You now get a dozen alert emails a week, and you don’t understand most of them.", fx: { morale: -4 }, lesson: ["Alert fatigue", "Alerts nobody understands get ignored. A tool is only as good as the person reading its output."] }; }
        else r = { text: "Not this year. The owner was relieved about the bill.", fx: {}, lesson: ["Opportunity cost", "Every choice has a price, including saying no."] };
        FT.screens.outcome(title, r);
      });
    },

    /* ---------- The guided first month ---------- */
    tutorial: {
      tips: [
        { target: "dash", text: "This is the security status board. At a small business, the biggest wins are cheap: switching on security features you already pay for, multi-factor login on email and the bank, and a rule that any change to bank details gets a phone call." },
        { target: "team", text: "This is your time: three tasks a month, before IT chores eat some of them. Your outside help has a contracted hour or two, and you can buy more with money instead of your own sanity. ★ marks who’s faster at what." },
        { target: "team", text: "Watch your bandwidth. Past 65 you work slower, past 80 your work starts slipping, and past 100 you’re done. <b>Time off</b> is in your task list. Nobody else is going to cover for you." },
        { target: "budget", text: "Money is tight. Some fixes are free and just take your time; others are services with a setup cost and sometimes a monthly fee. Your committed spending is shown here." },
        { target: "team", text: "My suggestion for month one: turn on the built-in security features, start multi-factor login, and set up the payment verification rule. Have your outside help update the computers." }
      ],
      suggested: { you: ["builtin", "mfa", "payrule"], helper: ["patch"] },
      report: "This is the change report: what got done this month, including the IT chores that ate your time. At a small business, that list is usually longer than the security one.",
      monthNotes: { 1: "Keep an eye on your bandwidth. At this size, the person most likely to burn out is you." }
    }
  };

  /* ---------- Events ---------- */
  const bec = ["Payment fraud", "Fake bank-detail changes are the most expensive attack most small businesses ever face. A phone call to a known number stops it every time."];
  smb.events = [
    { id: "invoice", title: "An invoice with new bank details", run() {
      if (S.payRule) { S.wireStopped = true; } if (S.payRule) return { text: "An email from a regular supplier asked to send this month’s $38,000 payment to a new bank account. The bookkeeper called the supplier’s known number, as the rule says. The supplier’s email had been hacked.", fx: { trust: 4 }, lesson: bec };
      if (chance(S.training / 130)) return { text: "An email from a regular supplier asked to send this month’s $38,000 payment to a new bank account. Something felt off to the bookkeeper, and she called to check. It was fraud.", fx: { trust: 3 }, lesson: bec };
      return { text: "An email from a regular supplier asked to send this month’s $38,000 payment to a new bank account. The bookkeeper updated it and paid. The supplier’s email had been hacked, and the money is gone.", fx: { trust: -14, care: -6, budget: -6000 }, lesson: bec };
    } },
    { id: "owneremail", title: "The owner’s email is hacked", run() {
      if (S.mfa) return { text: `${K().ownerShort} entered a password on a fake sign-in page. Multi-factor login stopped the attacker cold.`, fx: { trust: 3 }, lesson: ["Multi-factor login", "For a small business, MFA on email is the single most effective control there is."] };
      return { text: `${K().ownerShort} entered a password on a fake sign-in page. The attacker read two months of email and sent fake invoices to ${K().customers}.`, fx: { trust: -10, care: -8 }, lesson: ["Multi-factor login", "For a small business, MFA on email is the single most effective control there is."] };
    } },
    { id: "laptopcar", title: "A laptop stolen from a car", run() {
      if (S.builtin >= 60) return { text: "A laptop was stolen from an employee’s car. Disk encryption was switched on with the built-in features, so it was just a lost laptop.", fx: {}, lesson: ["Encryption", "Encryption is usually built in and free. It turns a stolen laptop from a breach into an inconvenience."] };
      return { text: `A laptop was stolen from an employee’s car. It wasn’t encrypted, and it had ${K().customers}’ information on it. You’re sending notification letters.`, fx: { trust: -10, budget: -2000 }, lesson: ["Encryption", "Encryption is usually built in and free. It turns a stolen laptop from a breach into an inconvenience."] };
    } },
    { id: "exemployee", title: "A former employee logs in", run() {
      if (S.stale <= 1) return { text: "Someone tried to log in with a former employee’s account. It had already been closed.", fx: { trust: 2 }, lesson: ["Offboarding", "When someone leaves, close their accounts the same day, and change the passwords they knew."] };
      return { text: "A former employee, still annoyed about leaving, logged in with an account nobody closed and deleted a year of shared files.", fx: { trust: -8, care: -6 }, lesson: ["Offboarding", "When someone leaves, close their accounts the same day, and change the passwords they knew."] };
    } },
    { id: "insurance", title: "The insurance renewal questionnaire", run() {
      const good = (S.mfa ? 1 : 0) + (S.backupTested ? 1 : 0) + (S.edr >= 75 ? 1 : 0);
      if (good >= 2) return { text: "The insurance renewal asked about MFA, backups and endpoint protection. You could honestly say yes to most of it, and the premium held steady.", fx: { trust: 4 }, lesson: ["Insurers set the bar", "For many small businesses, the insurance questionnaire is the security program. It’s a decent checklist."] };
      return { text: "The insurance renewal asked about MFA, backups and endpoint protection. You couldn’t say yes to much. The premium jumped, and ransomware coverage was cut in half.", fx: { trust: -6, budget: -2000 }, lesson: ["Insurers set the bar", "For many small businesses, the insurance questionnaire is the security program. It’s a decent checklist."] };
    } },
    { id: "notcovered", title: "“That’s not in your contract”", run() {
      if (S.vendor >= 50) return { text: `A server failed. ${K().helper} handled it under the contract, because you’d already clarified exactly what was covered.`, fx: { trust: 2 }, lesson: ["Know your contract", "Know what your outside help covers before the emergency, not during it."] };
      return { text: `A server failed, and ${K().helper} said recovery wasn’t in the contract. The emergency rate was eye-watering, and the business was down for two days while you argued.`, fx: { care: -6, budget: -3000, trust: -3 }, lesson: ["Know your contract", "Know what your outside help covers before the emergency, not during it."] };
    } },
    { id: "giftcards", title: "The owner needs gift cards", run() {
      if (S.training >= 45) return { text: `A text “from ${K().ownerShort}” asked the front desk to buy $1,500 in gift cards for a client. They called to check. It was a scam.`, fx: { trust: 2 }, lesson: ["Gift card scams", "Urgent requests for gift cards from the boss are always worth a phone call."] };
      return { text: `A text “from ${K().ownerShort}” asked the front desk to buy $1,500 in gift cards for a client. They did.`, fx: { trust: -4, budget: -1500 }, lesson: ["Gift card scams", "Urgent requests for gift cards from the boss are always worth a phone call."] };
    } },
    { id: "adminmalware", title: "A “free PDF converter”", run() {
      if (S.admins >= 60 || S.edr >= 75) return { text: "An employee tried to install a “free PDF converter” that was really malware. Without admin rights, it couldn’t install.", fx: { trust: 1 }, lesson: ["Admin rights", "Most malware needs admin rights to install. Taking them away from everyday accounts blocks it, for free."] };
      return { text: "An employee installed a “free PDF converter” that was really malware. It stole saved browser passwords, including the bank login.", fx: { trust: -8, care: -4 }, lesson: ["Admin rights", "Most malware needs admin rights to install. Taking them away from everyday accounts blocks it, for free."] };
    } },
    { id: "ownermfa", title: "The owner wants out of MFA", get intro() { return `${K().ownerShort} finds the multi-factor prompts annoying and asks you to turn them off for the owner’s account. “I’m careful.”`; }, choices: [] },
    { id: "remote", title: "The remote-access tool from years ago", run() {
      if (S.patch >= 60) return { text: "An old remote-access tool that a previous IT person installed turned up exposed to the internet. Because the computer was patched, the known flaw didn’t work, and you uninstalled it.", fx: { trust: 2 }, lesson: ["Forgotten remote access", "Old remote-access tools left by past helpers are a classic way into small businesses."] };
      return { text: "Attackers got in through an old remote-access tool a previous IT person had installed, and poked around for a week. You found out when the bank called about a suspicious transfer.", fx: { trust: -10, care: -5 }, lesson: ["Forgotten remote access", "Old remote-access tools left by past helpers are a classic way into small businesses."] };
    } },
    { id: "quiet", title: "A quiet month", run() { return { text: "No fires. You finally cleared your inbox, and it felt amazing.", fx: { morale: 8 }, lesson: ["Invisible wins", "When security works, nothing happens, which makes it hard to notice. That’s normal."] }; } },
    // Medical practice
    { id: "fax", title: "Records faxed to the wrong number", available: S => S.kind === "medical", run() {
      if (S.training >= 50) return { text: "A records request almost went to a mistyped fax number. The front desk caught it on the confirmation screen, because you’d talked about it at the staff meeting.", fx: { trust: 2 }, lesson: ["Privacy mistakes", "Most medical privacy breaches are mistakes, not hackers: a wrong fax number, a misaddressed email."] };
      return { text: "Twelve pages of patient records were faxed to a wrong number, which turned out to be a car dealership. That’s a reportable privacy breach.", fx: { trust: -8, budget: -1000 }, lesson: ["Privacy mistakes", "Most medical privacy breaches are mistakes, not hackers: a wrong fax number, a misaddressed email."] };
    } },
    { id: "ehrdown", title: "The EHR vendor goes down", available: S => S.kind === "medical", run() {
      if (S.irPlan) return { text: "The cloud EHR vendor had a full-day outage. Your one-page plan included downtime forms, so the practice kept seeing patients on paper.", fx: { care: -2 }, lesson: ["Plan for outages", "Your vendors will go down. A printed plan for working without them keeps the doors open."] };
      return { text: "The cloud EHR vendor had a full-day outage, and nobody knew what to do. The practice cancelled the afternoon’s patients.", fx: { care: -8, trust: -3 }, lesson: ["Plan for outages", "Your vendors will go down. A printed plan for working without them keeps the doors open."] };
    } },
    // Machine shop
    { id: "cncwin7", title: "The CNC programming PC", available: S => S.kind === "shop", intro: "The PC that sends programs to the CNC machines runs Windows 7, and the machine vendor says it can’t be upgraded. It’s on the same network as the office computers.", choices: [
      { label: "Have Gus put it on its own network", run() { S.budget -= 1500; return { text: "Gus spent an afternoon putting the CNC PC behind its own small firewall ($1,500). It can talk to the machines and nothing else.", fx: { trust: 2 }, lesson: ["Isolating what you can’t patch", "Old shop-floor computers often can’t be updated. Separating them from everything else protects them anyway."] }; } },
      { label: "Leave it; it’s worked for years", run() {
        if (chance(.4)) return { text: "Ransomware from an office computer spread to the CNC PC. The machines stood idle for four days while Gus rebuilt it.", fx: { care: -12, trust: -5 }, lesson: ["Isolating what you can’t patch", "Old shop-floor computers often can’t be updated. Separating them from everything else protects them anyway."] };
        return { text: "Nothing happened this time. It’s still sitting on the office network, though.", fx: {}, lesson: ["Isolating what you can’t patch", "Old shop-floor computers often can’t be updated. Separating them from everything else protects them anyway."] }; } }
    ] },
    { id: "gusaway", title: "Gus is on vacation", available: S => S.kind === "shop", run() {
      if (S.vendor >= 50) return { text: "The network went down while Gus was on a fishing trip. You had his documentation and a backup contact, so it was back up in an hour.", fx: {}, lesson: ["Single points of failure", "When one person holds all the knowledge, write it down and know who else to call."] };
      return { text: "The network went down while Gus was on a fishing trip with no cell service. Nobody else knew the passwords. The shop lost a day and a half.", fx: { care: -8, trust: -3 }, lesson: ["Single points of failure", "When one person holds all the knowledge, write it down and know who else to call."] };
    } },
    // Software startup
    { id: "apikey", title: "A key in the code", available: S => S.kind === "saas", run() {
      if (S.builtin >= 60) return { text: "A developer pushed a cloud access key to a public code repository. The secret scanning you’d switched on caught it in minutes, and you revoked it.", fx: { trust: 2 }, lesson: ["Leaked secrets", "Keys pushed to public code are found by attackers within minutes. Free scanning tools catch them first."] };
      return { text: "A developer pushed a cloud access key to a public code repository. Attackers used it to run crypto-mining servers for a weekend. The bill was $9,000.", fx: { trust: -6, budget: -9000 }, lesson: ["Leaked secrets", "Keys pushed to public code are found by attackers within minutes. Free scanning tools catch them first."] };
    } },
    { id: "bigdeal", title: "A big customer’s security questionnaire", available: S => S.kind === "saas", run() {
      const good = (S.mfa ? 1 : 0) + (S.irPlan ? 1 : 0) + (S.backupTested ? 1 : 0) + (S.admins >= 60 ? 1 : 0);
      if (good >= 3) return { text: "Your biggest prospect sent a 200-question security questionnaire. You had honest answers for the important parts, and they signed.", fx: { care: 8, trust: 4 }, lesson: ["Security closes deals", "For a small software company, being able to answer a security questionnaire honestly is a sales asset."] };
      return { text: "Your biggest prospect sent a 200-question security questionnaire. Too many answers were “not yet.” They went with a competitor.", fx: { care: -6, trust: -4 }, lesson: ["Security closes deals", "For a small software company, being able to answer a security questionnaire honestly is a sales asset."] };
    } }
  ];

  // The owner wants an exemption: built per business at play time
  Object.assign(smb.events.find(e => e.id === "ownermfa"), {
    available: S => S.mfa,
    choices: [
      { label: "Keep it on, and explain why", run() { return { text: `You showed ${K().ownerShort} how the phone prompt works with one tap. Grumbling, then acceptance.`, fx: { trust: -2 }, lesson: ["Owners follow the rules too", "The owner’s account is the most valuable one in a small business. Exempting it makes it the easiest target."] }; } },
      { label: "Turn it off for the owner", run() { S.ownerExempt = true; return { text: `Done. ${K().ownerShort} is happier, and the most valuable account in the business is now the least protected.`, fx: { trust: 3 }, lesson: ["Owners follow the rules too", "The owner’s account is the most valuable one in a small business. Exempting it makes it the easiest target."] }; } }
    ]
  });

  /* ---------- Minigame: the inbox, small-business edition ---------- */
  const EMAILS = [
    { name: "Quickbooks", addr: "billing@quickbooks-payments-notice.com", subj: "Your payment failed", body: "We couldn’t process your subscription. {link} within 24 hours to avoid losing access.", link: { text: "Update payment", url: "quickbooks-payments-notice.com/update" }, phish: true, clue: "The sender and link use a look-alike domain, not the real company’s. Payment-failure scares are a favorite lure." },
    { name: "Microsoft 365", addr: "no-reply@m365-securealert.net", subj: "Unusual sign-in to your account", body: "We detected a sign-in from a new location. {link} to keep your account safe.", link: { text: "Review activity", url: "m365-securealert.net/verify" }, phish: true, clue: "Microsoft doesn’t send from “m365-securealert.net.” Fake security alerts are among the most common phishing emails." },
    { name: "Your bank", addr: "alerts@yourbank.com", subj: "Monthly statement available", body: "Your statement is ready. Log in to online banking to view it.", phish: false, clue: "No link, no urgency, and it asks you to go to online banking yourself. That’s how legitimate banks write." },
    { name: "Supplier (accounts)", addr: "accounts@trusted-supplier.com", subj: "Updated remittance details", body: "Please note our bank details have changed. Use the attached details for all future payments.", phish: true, clue: "It may even come from the supplier’s real address if they’ve been hacked. Bank-detail changes always get a phone call to a number you already have." },
    { name: "Shipping notice", addr: "tracking@ups.com", subj: "Your package is on the way", body: "Your order shipped today. {link}", link: { text: "Track package", url: "ups.com/track?num=1Z999" }, phish: false, clue: "Real sender domain, and the link goes to the real site. Still, typing the tracking number into the site yourself is a good habit." },
    { name: "DocuSign", addr: "dse@docusign.net", subj: "Please sign: Office lease renewal", body: "Your landlord sent you a document to sign. {link}", link: { text: "Review document", url: "docusign.net/signing/abc123" }, phish: false, clue: "The real DocuSign domain, and you were expecting a lease renewal. Legitimate, though it’s worth checking with the landlord if you weren’t expecting it." },
    { name: "IT Support", addr: "support@helpdesk-staffportal.com", subj: "Mailbox storage full", body: "Your mailbox is 98% full. {link} to increase storage.", link: { text: "Increase storage", url: "helpdesk-staffportal.com/login" }, phish: true, clue: "Your outside help doesn’t email from “helpdesk-staffportal.com,” and mailbox-full scares are classic credential phishing." },
    { name: "The owner", addr: "owner.business@gmail.com", subj: "Are you at your desk?", body: "I need a quick favor. I’m in meetings, so just reply here.", phish: true, clue: "A personal Gmail address claiming to be the owner, asking for a “favor” by email only. It’s the opening of a gift card scam." },
    { name: "Payroll provider", addr: "notices@gusto.com", subj: "Payroll processed", body: "Payroll for this period has been processed. No action needed.", phish: false, clue: "Expected, from the real provider, and asks for nothing. Legitimate." },
    { name: "Domain renewal", addr: "renewals@domain-registry-services.org", subj: "FINAL NOTICE: your domain expires today", body: "Your website and email will stop working. {link} now.", link: { text: "Renew domain", url: "domain-registry-services.org/pay" }, phish: true, clue: "“Final notice” scare tactics, and not your actual registrar. Fake domain-renewal invoices target small businesses constantly." },
    { name: "Zoom", addr: "no-reply@zoom.us", subj: "Meeting invitation: Quarterly review", body: "You’re invited to a meeting. {link}", link: { text: "Join meeting", url: "zoom.us/j/123456789" }, phish: false, clue: "Real Zoom domain and a real Zoom link. Legitimate, if you know about the meeting." },
    { name: "Voicemail", addr: "voicemail@office-phone-system.co", subj: "New voicemail (0:43)", body: "You have a new voicemail. {link} to listen.", link: { text: "Play message", url: "office-phone-system.co/login" }, phish: true, clue: "A voicemail that needs you to log in is a common trick. Your phone system doesn’t live at that address." },

    /* ---------- More emails. Entries with a kind only appear for that kind of business. ---------- */
    { name: "Amazon Business", addr: "orders@amazn-business-support.com", subj: "Order #114-2938: $1,249.99 confirmed", body: "Didn’t place this order? {link} within 24 hours.", link: { text: "Cancel order", url: "amazn-business-support.com/cancel" }, phish: true, clue: "“amazn” is a look-alike, and the surprise order is designed to make you click in a panic. Check orders by signing in to Amazon directly." },
    { name: "Microsoft", addr: "microsoft-noreply@microsoft.com", subj: "Your invoice for Microsoft 365 Business", body: "Your monthly invoice is available in the admin center. No action is needed if your payment method is current.", phish: false, clue: "The real Microsoft domain, an expected bill, and it sends you to the admin center rather than a link. Legitimate." },
    { name: "eFax", addr: "messages@efax-securedelivery.net", subj: "You have a new fax (3 pages)", body: "A fax was received for your number. {link}", link: { text: "View fax", url: "efax-securedelivery.net/view" }, phish: true, clue: "Fake fax and voicemail notices are classic lures. Faxes come to your actual fax system, not through a sign-in page on an odd domain." },
    { name: "Google Workspace", addr: "payments-noreply@google.com", subj: "Your Google Workspace invoice", body: "Your invoice is ready. View it in the Admin console.", phish: false, clue: "Real Google domain, expected invoice, and no login link. Legitimate." },
    { name: "A coworker", addr: "j.martin@yourbusiness.com", subj: "Shared: Updated pay schedule", body: "Hi, I shared the updated pay schedule with you. {link}", link: { text: "Open document", url: "sharepoint-docsview.com/login" }, phish: true, clue: "The coworker’s address is real, because their account was hacked. The link gives it away: it isn’t your file-sharing service. When in doubt, ask them in person." },
    { name: "The owner", addr: "owner.office@outlook.com", subj: "Need W-2s today", body: "Can you send me copies of everyone’s W-2s as PDFs? Accountant needs them before 3.", phish: true, clue: "A personal address asking for every employee’s tax forms is a well-known W-2 scam. Confirm in person before sending anyone’s personal data." },
    { name: "Your bank", addr: "fraud-alerts@yourbank.com", subj: "Did you make this purchase?", body: "We noticed an unusual charge. Please call the number on the back of your card to confirm.", phish: false, clue: "No link, and it tells you to call the number on your card, not one in the email. That’s how real bank fraud alerts work." },
    { name: "An employee", addr: "dana.reyes.home@gmail.com", subj: "Direct deposit change", body: "I switched banks. Please update my direct deposit to the new account below before Friday’s payroll.", phish: true, clue: "Payroll diversion: a personal address claiming to be an employee. Confirm any direct deposit change with the employee in person or by a known phone number." },
    { name: "Intuit QuickBooks", addr: "quickbooks@notification.intuit.com", subj: "Payment received", body: "You received a payment of $2,480.00 from a customer. View it in QuickBooks.", phish: false, clue: "The real Intuit domain, a routine notice, and no link to sign in. Legitimate." },
    { name: "Web hosting", addr: "billing@websitehost-renewals.info", subj: "Your website will be suspended", body: "Your hosting payment failed. {link} to avoid losing your site and email.", link: { text: "Update billing", url: "websitehost-renewals.info/pay" }, phish: true, clue: "Not your actual host, and it uses fear of losing your site. Check billing by signing in to your real hosting account." },
    { name: "LinkedIn", addr: "messages-noreply@linkedin.com", subj: "You appeared in 9 searches this week", body: "See who’s looking at your profile on LinkedIn.", phish: false, clue: "The real LinkedIn domain and a routine notice. Legitimate, though it’s safer to open the app than to click through." },
    { name: "Accounts receivable", addr: "ar@unknown-vendor-billing.com", subj: "Invoice 8841 overdue: final notice", body: "Payment is 30 days overdue. Please pay immediately to avoid collections. Invoice attached.", phish: true, clue: "An overdue invoice from a vendor you’ve never used, with an attachment and a threat. Check with whoever handles purchasing before opening anything." },
    { kind: "medical", name: "Medicare Compliance", addr: "audit@cms-compliance-review.org", subj: "Notice of billing audit", body: "Your practice has been selected for a billing audit. {link} within 5 days.", link: { text: "Submit records", url: "cms-compliance-review.org/portal" }, phish: true, clue: "Government agencies don’t send audit notices from look-alike domains with a 5-day deadline and a sign-in link. Verify through your billing contact or official channels." },
    { kind: "medical", name: "Your EHR vendor", addr: "status@yourehrvendor.com", subj: "Scheduled maintenance Sunday 1 to 3 a.m.", body: "The EHR will be unavailable during maintenance. Please plan to use downtime procedures.", phish: false, clue: "Expected, from the vendor’s real domain, with no link or request. Legitimate, and a good reminder to check your downtime forms." },
    { kind: "medical", name: "Patient portal", addr: "no-reply@patientportal-messages.com", subj: "A patient sent you a secure message", body: "You have a new secure message. {link}", link: { text: "Read message", url: "patientportal-messages.com/signin" }, phish: true, clue: "Your portal sends notices from its own domain, and staff read messages inside the EHR. A sign-in link on an unfamiliar domain is credential phishing." },
    { kind: "medical", name: "Regional Lab Services", addr: "results@regionallabservices.com", subj: "Results ready for 6 patients", body: "New results are available in your lab interface. No action needed if your interface is working.", phish: false, clue: "Your actual lab partner, notifying you without a link or attachment. Legitimate." },
    { kind: "shop", name: "Purchasing (customer)", addr: "buyer@precision-auto-partss.com", subj: "New PO 55120: urgent", body: "Please review the attached purchase order and enable editing to see the pricing.", phish: true, clue: "“partss” is a look-alike of your customer’s domain, and “enable editing” is how malicious Office documents get you to run them." },
    { kind: "shop", name: "Midwest Steel Supply", addr: "sales@midweststeelsupply.com", subj: "Price update for next quarter", body: "Our pricing for cold-rolled sheet changes on the first of the month. Call your rep with any questions.", phish: false, clue: "Your real supplier, informational, with no link, attachment or payment request. Legitimate." },
    { kind: "shop", name: "Freight carrier", addr: "invoices@freight-billing-center.com", subj: "Freight invoice: delivery exception fee", body: "An exception fee was added to your shipment. {link} to release the load.", link: { text: "Pay fee", url: "freight-billing-center.com/pay" }, phish: true, clue: "Not your carrier’s domain, and it holds your shipment hostage for a fee. Call your carrier using the number on your account." },
    { kind: "shop", name: "Customer portal", addr: "drawings@customerportal.precisionauto.com", subj: "Drawing revision C released for part 4410", body: "A new drawing revision is available in the supplier portal.", phish: false, clue: "Your customer’s real portal domain, telling you to check the portal yourself. Legitimate." },
    { kind: "saas", name: "GitHub", addr: "security@github-alerts.io", subj: "Security alert: suspicious login to your account", body: "We blocked a sign-in attempt on your account. {link}", link: { text: "Secure account", url: "github-alerts.io/session" }, phish: true, clue: "GitHub doesn’t send from “github-alerts.io.” Fake security alerts target developers precisely because their accounts are valuable." },
    { kind: "saas", name: "AWS", addr: "aws-billing@amazon.com", subj: "AWS billing alert: you’ve exceeded your threshold", body: "Your estimated charges this month exceed the alert threshold you set. Review costs in the billing console.", phish: false, clue: "A billing alarm you set up, from Amazon’s real domain, pointing you to the console. Legitimate, and worth checking right away." },
    { kind: "saas", name: "Stripe", addr: "support@stripe-payouts.net", subj: "Your payout failed", body: "We couldn’t send your payout. {link} to keep payouts flowing.", link: { text: "Confirm details", url: "stripe-payouts.net/verify" }, phish: true, clue: "Not Stripe’s domain, and it asks for bank details. Sign in to the real dashboard yourself to check payouts." },
    { kind: "saas", name: "GitHub (Dependabot)", addr: "notifications@github.com", subj: "[fernway/app] Bump express from 4.18.2 to 4.19.2", body: "Dependabot opened a pull request to update a dependency. {link}", link: { text: "View pull request", url: "github.com/fernway/app/pull/417" }, phish: false, clue: "The real GitHub notification address, linking to your own repository on github.com. Legitimate." }
  ];
  smb.minigames = {
    schedule: { 1: "inbox", 5: "inbox", 9: "inbox" },
    inbox: {
      // General emails, plus the ones for this kind of business
      get data() { return EMAILS.filter(e => !e.kind || e.kind === S.kind); },
      intro: "Staff forwarded you some emails they weren’t sure about. Phish or legit?",
      good: "You shared the tricky ones at the next staff meeting. People started forwarding more suspicious emails, which is exactly what you want.",
      bad: "Some of those were tricky. You looked up the clues and shared them at the next staff meeting.",
      lesson: ["Spotting phishing", "Check the real sender address and where links go. Bank-detail changes and gift card requests always get a phone call."]
    }
  };

  /* ---------- Ransomware night ---------- */
  smb.finale = {
    title: "Ransomware night",
    times: ["11:48 PM", "12:02 AM", "12:15 AM", "12:29 AM", "12:41 AM", "12:54 AM", "1:04 AM", "1:12 AM"],
    intro: S => `Late on a Saturday, the ${S.gang.name} gang turns its attention to ${K().org}. Small businesses are easy money: thin defenses, nobody watching at night. They start with your weakest spot and keep going until something works.`,
    vectors: S => [
      { name: "a phishing email", p: 1 - (1 - sys.eff(S.filter)) * (1 - S.training / 100 * .8), hold: "The email filter caught most copies, and the one person who saw it forwarded it to you.", fail: "Someone entered their email password on a fake sign-in page." },
      { name: "a stolen email password", p: S.mfa && !S.ownerExempt ? .95 : S.mfa ? .5 : .15, hold: "Multi-factor login asked for a code they didn’t have.", fail: S.ownerExempt ? "They went straight for the owner’s account, the one exempted from multi-factor login." : "A password from an old data breach still worked. There was no second factor." },
      { name: "old remote access", p: S.patch / 100, hold: "The old remote-access software they looked for was patched or gone.", fail: "An old, unpatched remote-access tool was still open to the internet." },
      { name: "an old account", p: S.stale <= 1 ? .95 : .3, hold: "The former employees’ accounts were closed.", fail: "A former employee’s account still worked, with the same password as always." }
    ],
    zeroDay: { label: "They buy a zero-day.", fail: "With every door locked, they used a brand-new flaw in your firewall. No patch exists yet." },
    luckyBlock: "It should have worked, but their tool crashed halfway through. <i>Lucky break.</i>",
    firstTry: "They got in on the first try, and nobody was watching.",
    decisionHint: "<b>Live decisions:</b> it’s your phone that rings, and you make the calls. There’s rarely a perfect answer, and at this size, each one decides whether the business opens on Monday.",
    beachhead: {
      clock: "1:20 AM", title: "The first computer",
      blocked: "Endpoint protection caught their tools the moment they ran. They lost their foothold before they had it.",
      lucky: "Their malware crashed before it finished installing. The foothold is gone. That was too close.",
      failed: S => S.edr < 75 ? "Basic antivirus didn’t recognize their tools. They have a computer." : "Endpoint protection blocked one tool, but they disguised the next. They have a computer."
    },
    early: {
      clock: "1:40 AM", title: "Your phone buzzes",
      alert: S => S.mdr !== null && !S.mdrNoisy ? "The monitoring service calls: someone is running attacker tools on the front office computer." : `An alert email from ${K().helper === "Gus" ? "Gus’s" : "your"} monitoring: someone is running attacker tools on the front office computer.`,
      options: [
        { id: "host", label: "Have that computer unplugged" },
        { id: "segment", label: "Shut down the whole network" },
        { id: "watch", label: "Wait until morning" }
      ],
      hostWin: "You called your outside help, who disabled the account and pulled that computer off the network. A check in the morning showed nothing else was touched.",
      hostLose: "You got that computer unplugged, but they had already reached the file server.",
      segmentCare: -4,
      segmentCost: "With the network down, Monday started late and messy.",
      segmentWin: "With the network off, they had nowhere to go. Monday brought confusion and no ransomware.",
      segmentLose: "You shut down the network, but they had already started on the file server.",
      watchWin: "You waited, and they didn’t do much overnight. In the morning, your outside help cleaned it up. You were lucky.",
      watchLose: "While you slept, they moved to the file server and the backups."
    },
    contain: {
      clock: "3:10 AM", title: "They’re on the file server",
      alert: S => "An alert finally gets through: backups on the file server are being deleted.",
      knownAlert: "They’re on the file server now, deleting backups.",
      unseen: "Nobody is watching at 3 a.m. At 4:55, the encryption begins.",
      options: [
        { id: "plug", label: "Unplug everything" },
        { id: "targeted", label: "Ask your outside help to contain it" },
        { id: "mdr", label: "Let the monitoring service handle it" }
      ],
      plugCare: -15,
      plugCost: "You drove in and unplugged everything. The business was offline for two days while it was checked.",
      plugWin: "It worked. Nothing was encrypted.",
      plugLose: "The file server was already encrypting before you got there.",
      targetedWin: "Your outside help locked the accounts and isolated the server remotely. Nothing was encrypted.",
      targetedLose: "Your outside help couldn’t get in fast enough. The encryption started.",
      mdrWin: "The monitoring service isolated the server within minutes.",
      mdrLose: "The monitoring service couldn’t stop it in time."
    },
    encrypt: {
      clock: "6:30 AM", title: "Everything is locked",
      body: S => `<p>Every computer and the file server show a ransom note from ${S.gang.name}. ${K().work[0].toUpperCase() + K().work.slice(1)} starts in two hours.</p>`,
      get safety() { return [{ id: "divert", label: K().closeLabel }, { id: "stay", label: K().stayLabel }]; },
      divertCare: -10, divertText: "You closed while everything was cleaned and restored, and told people why.",
      stayBadCare: -25, stayBad: "You tried to keep going without computers. Records got lost, orders got mixed up, and people noticed.",
      stayOkCare: -8, stayOk: "You kept going on paper. It was chaotic, but it held.",
      restored: "Your backups were safe from the attackers. It took four days to restore everything.",
      recoverClock: "10:00 AM", recoverTitle: "Recovery",
      noBackups: S => `<p>The backups are gone: deleted before the encryption. The gang wants $250,000.${S.insured ? " Your insurer’s breach hotline is on the line; the policy covers most of it after a $10,000 deductible." : " You don’t have cyber insurance."}</p>`,
      recovery: [{ id: "pay", label: "Pay the ransom" }, { id: "rebuild", label: "Refuse and rebuild" }],
      get deductible() { return S.insured ? 10000 : 60000; },
      paidWorks: "You paid. The decryption tool worked, slowly. The business reopened after a week.",
      paidFails: "You paid. The decryption tool only recovered some of the files.",
      rebuilt: "You refused. Rebuilding from scratch took three weeks, and some records were gone for good."
    },
    lessons: {
      weakest: ["Weakest link", "Attackers look for your easiest way in, not your strongest defense."],
      assume: ["Assume breach", "Plan as if attackers will get in. At a small business, backups they can’t delete and someone to call are what decide whether you reopen."],
      luck: ["Luck", "Sometimes things break your way. It isn’t a plan."],
      ransom: ["Paying the ransom", "Paying doesn’t guarantee recovery and funds criminals. Backups the attackers can’t reach are what let you refuse."]
    },
    results: {
      edr: { label: "Stopped on the first computer", bonus: 15, text: "By Monday it was just a log entry.", fx: { trust: 6 }, lesson: ["Defense in depth", "When one layer fails, the next one can still stop the attack."] },
      luckyedr: { label: "Lucky break on the first computer", bonus: 8, text: "You realized on Monday how close it was.", fx: { trust: 2 }, lesson: ["Defense in depth", "When one layer fails, the next one can still stop the attack."] },
      early: { label: "Unplugged in time", bonus: 15, text: "One computer rebuilt, and the business barely noticed.", fx: { trust: 5 }, lesson: ["Fast response", "Knowing who to call at 2 a.m., and having them answer, is most of incident response at a small business."] },
      segment: { label: "Shut down the network in time", bonus: 13, text: "A slow, confusing Monday. No ransomware.", fx: { trust: 4 }, lesson: ["Containment trade-offs", "Shutting everything down is blunt, but at a small business, it’s often the right call."] },
      watched: { label: "Waited, and got lucky", bonus: 10, text: "Waiting until morning worked this time. It usually doesn’t.", fx: { trust: 2 }, lesson: ["Waiting is a gamble", "Attackers work nights and weekends because nobody’s watching."] },
      downtime: { label: "Unplugged everything in time", bonus: 8, text: "Two days offline, but no ransomware and no ransom.", fx: { trust: 2 }, lesson: ["Pulling the plug", "Unplugging is crude but effective, and it buys time to call for help."] },
      targeted: { label: "Contained by your outside help", bonus: 14, text: "Your outside help earned their fee this month.", fx: { trust: 5 }, lesson: ["Know who to call", "A clear arrangement with your outside help, made before the emergency, pays off at 3 a.m."] },
      mdrled: { label: "Contained by the monitoring service", bonus: 12, text: "The monitoring service paid for itself in one night.", fx: { trust: 3 }, lesson: ["Someone watching", "For a small business, a monitoring service is often the only way to have anyone watching at night."] },
      restored: { label: "Encrypted, restored from backups", bonus: 4, text: "A brutal week, but you never had to consider paying.", fx: {}, lesson: ["Backups", "Backups the attackers can’t delete are what let a small business survive ransomware."] },
      paid: { label: "Paid the ransom", bonus: 0, text: "The business survived. Barely.", fx: {}, lesson: ["Backups", "Without protected backups, every option is bad."] },
      rebuilt: { label: "Rebuilt from scratch", bonus: 0, text: "The business survived. Barely.", fx: {}, lesson: ["Backups", "Without protected backups, every option is bad."] }
    }
  };

  // Immutable backups count as proven at the small business too
  const orig = sys.backupsGood;
  sys.backupsGood = () => orig() || (FT.mode === mode && mode.setting.id === "smallbiz" && S.immutable);

  mode.addSetting(smb);
})();
