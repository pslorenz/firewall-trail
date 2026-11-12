/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Practitioner ransomware night: assume breach, then make the calls live.
 *   1. Probing: they try every way in, weakest first; a zero-day if all hold.
 *   2. Beachhead: endpoint protection may stop them on the first machine.
 *   3. Early detection (detection rules, MDR, noise from failed attempts)
 *      gives you a first decision: contain narrowly, broadly, or watch.
 *   4. If they reach the servers, a second decision: pull the plug, try
 *      targeted containment, or let the MDR team lead.
 *   5. If encryption happens: a patient-safety decision, then recovery.
 * The first time anyone notices, the incident plan matters: with one, the
 * response is organized and fast; without one, you improvise how the team
 * talks and who gets called, and the attackers may be listening.
 * Phishing with multi-factor login: a skilled crew relays the prompt through
 * a fake page, so only phishing-resistant sign-in (security keys, passkeys)
 * really closes that door.
 * Backups need two things to save the night: a recent restore test (they
 * work) and immutability (attackers can't delete them first). Tested but
 * deletable backups may be wiped; immutable but untested ones restore slowly.
 * Access left over from earlier incidents (S.lingering) is tried first.
 * Whenever data leaves, how much depends on how long they went unseen, and a
 * leak-site decision follows: notify now, wait for forensics, or pay.
 * All wording comes from the setting's finale config (mode.setting.finale).
 * Effects accumulate across the night and land together at the end. */
(function () {
  const S = FT.S, L = FT.learned, { chance, roll, clamp } = FT.util, ui = FT.ui, sys = FT.sys;
  const mode = FT.modes.practitioner;
  const odds = p => Math.max(.05, Math.min(.95, p));

  /* Default wording for the phishing changes and the first hour. A setting can
   * override any of it with finale.phish or finale.firstHour. */
  const PHISH = {
    relay: "The multi-factor prompt that followed was real: the fake page was relaying the sign-in to the real site, and it kept the session that came back.",
    strongHold: "Someone typed a password into the fake page, but their security key refused to sign in to a look-alike site. The password alone got them nothing.",
    downgrade: "That account still allowed an older phone-prompt sign-in as a fallback, and the fake page used it.",
    lessonRelay: ["Session theft", "Some phishing pages pass your sign-in through to the real site, multi-factor prompt and all, and keep the session that comes back. Phone codes and prompts can be relayed; security keys and passkeys only work on the real site."],
    lessonStrong: ["Phishing-resistant sign-in", "Security keys and passkeys are tied to the real website, so a look-alike page can’t use them, no matter how convincing it is or what someone types."]
  };
  /* Default backup wording; a setting can override any of it in finale.encrypt */
  const BACKUPS = {
    wipedTested: "Your restore test proved the backups worked. It couldn’t prove they’d survive an attacker with admin access, and ransomware crews go after backups first.",
    survivedTested: "They went looking for the backups, but ran out of time before they found the backup server. The backups could have been deleted; tonight they weren’t.",
    restoredSlow: "The backups survived, because nobody could delete them. But nobody had restored from them in months either: the first attempts failed on missing encryption keys and steps nobody remembered, and recovery took twice as long as it should have.",
    sanctioned: S => `Before anyone could start negotiating, counsel checked the ${S.gang.name} gang against the US Treasury’s sanctions list. It’s on it. Paying could be illegal, and the insurer won’t cover it, so paying is off the table.`,
    sanctionsLesson: ["Sanctioned gangs", "Paying a ransom to a group on a sanctions list can be illegal, whatever the circumstances, and insurers won’t cover it. Check before you count on paying."],
    lesson: ["Tested versus protected", "A restore test proves backups work. Immutability proves attackers can’t delete them first. Ransomware crews go after backups before anything else, so you need both."]
  };
  /* Default wording for the leak site; a setting overrides it with finale.leak.
   * data: what was taken. people: who must be told. rule: how they were told.
   * cost: notification cost per level of theft. payCost: paying for "deletion". */
  const LEAK = {
    title: "The leak site", clock: "Two days later",
    data: S => "customer and employee records", people: S => "everyone affected", rule: S => "",
    cost: S => 20000, payCost: S => 100000,
    lots: (S, d) => `The ${S.gang.name} gang posts your name on its leak site with a countdown and a sample of ${d}. They copied a lot before anyone noticed.`,
    some: (S, d) => `The ${S.gang.name} gang posts your name on its leak site with a smaller sample of ${d}. They got some out before you shut them down.`,
    dwell: x => `Forensics shows the copying started long before tonight, through ${x.what} from ${x.month}.`,
    later: S => `Two days later, the ${S.gang.name} gang posted samples on its leak site.`,
    restoredNote: "Your backups got your systems back. They can’t get your data back.",
    tip: "<b>Data theft:</b> notifying right away costs trust now but less later. Waiting for forensics is careful, but the gang may publish first. Paying for “deletion” buys a promise nobody can check, and you still have to notify.",
    options: [
      { id: "notify", label: "Notify everyone affected now" },
      { id: "wait", label: "Wait for forensics to confirm what was taken" },
      { id: "pay", label: "Pay them to “delete” it" }
    ],
    notifyText: (S, who, rule) => `You notified ${who} right away${rule}. It was a hard week of letters, calls and questions, but nobody heard it from the gang first.`,
    waitWin: (S, who) => `Forensics confirmed what was taken, and you notified ${who} before the deadline. Careful, and this time it held.`,
    waitLose: (S, who) => `The gang published the data while forensics was still running. ${who[0].toUpperCase() + who.slice(1)} heard about it from the news before they heard it from you.`,
    payWorks: (S, who) => `You paid. The gang took the post down and sent a “proof of deletion.” There’s no way to know what it’s worth, and you still had to notify ${who}.`,
    payFails: (S, who) => `You paid, and the data turned up for sale on another forum a month later anyway. You still had to notify ${who}.`,
    lessonTheft: ["Data theft", "Most ransomware crews copy data before they encrypt. Backups get your systems back; they can’t get your data back or stop the extortion."],
    lessonPay: ["Paying for deletion", "Criminals can’t prove they deleted anything. Paying doesn’t remove the duty to notify, and the data often resurfaces anyway."],
    lessonClock: ["Notification clocks", "Breach laws set a deadline, but the gang sets the real one. Being the first to tell people matters."]
  };
  const FIRST_HOUR = {
    title: "The first hour",
    tip: "<b>The first hour:</b> an incident plan settles who does what, how the team talks and who gets called. Without one, you decide it live, and every option here has a cost.",
    planLabel: "The plan takes over",
    planText: S => "You open the incident plan. Everyone moves to the backup group chat on personal phones, someone calls the insurer’s breach hotline, and outside responders join the call within the hour. Nobody spends the night deciding who does what.",
    planUnseen: "Nobody saw them coming, but at the first sign of trouble the plan’s call tree had outside responders and the insurer on the phone within the hour.",
    question: S => "There’s no incident plan. Who does what, how you talk to each other and who gets called are all being decided right now, at the worst possible moment.",
    hasInsurer: S => true,
    options: [
      { id: "usual", label: "Coordinate over work email and chat" },
      { id: "phones", label: "Move everyone to personal phones" },
      { id: "insurer", label: "Call the insurer’s breach hotline first" }
    ],
    usualText: "Everyone piled into the usual work chat. It was fast.",
    overheardText: "The attackers were reading that chat the whole time and moved every time someone announced a step.",
    phonesText: "You moved everyone to a group text on personal phones. It took a while to find everyone’s number.",
    insurerText: "You called the insurer’s breach hotline before anything else. Intake took an hour, but responders and a breach lawyer were assigned before dawn.",
    recoveryText: "Without outside responders engaged from the first hour, it would have taken longer.",
    lessonPlan: ["Incident plan", "A tested plan settles who does what, how the team talks and who gets called before the worst night, so the first hour goes to the attackers instead of to logistics."],
    lessonOob: ["Out-of-band communication", "During an incident, assume attackers can read your email and chat. Move the response to a channel they can’t see."]
  };

  mode.scheduled = [
    { when: S => S.month === S.mdrMonth, run: () => mode.setting.mdrOffer() },
    { when: S => mode.setting.midyear && S.month === S.midyearMonth, run: () => mode.setting.midyear() },
    { when: S => S.month === S.expandMonth && mode.setting.expansion, run: () => { S.expanded = true; FT.screens.choiceEvent(mode.setting.expansion); } },
    { when: S => S.month === S.finaleMonth, run: () => run(mode.setting.finale) }
  ];

  function run(cfg) {
    S.finale = true;
    const acc = { trust: 0, care: 0, morale: -10, budget: 0 };
    const story = [];      // what happened, shown in the final summary
    let intel = false;     // watching the attackers taught you their moves
    let coord = null;      // how the response is coordinated: plan, usual, phones, insurer or none
    let speed = 0;         // added to containment odds: organized responses move faster
    let recovery = false;  // outside responders already engaged, which shortens recovery
    const P = Object.assign({}, PHISH, cfg.phish || {});
    const BK = Object.assign({}, BACKUPS, cfg.encrypt || {});
    const FH = Object.assign({}, FIRST_HOUR, cfg.firstHour || {});
    const LK = Object.assign({}, LEAK, cfg.leak || {});
    // Access left over from earlier in the year: no need to break in at all
    const cap = s => s[0].toUpperCase() + s.slice(1);
    const linger = (S.lingering || []).map(x => ({ name: `the access from ${x.month}`, kind: "lingering", src: x, p: .1,
      hold: "It had stopped working: a routine password change cleared it without anyone noticing.",
      fail: `They didn’t need to break in. ${cap(x.what)}, left over from ${x.month}, still worked.` }));
    if (linger.length) L.set(...mode.dwellLesson);
    const vectors = cfg.vectors(S).map(phishAdjust).concat(linger).sort((a, b) => a.p - b.p);
    L.set(...cfg.lessons.weakest); L.set(...cfg.lessons.assume);

    const log = []; let blocked = 0, anyLucky = false, entry = null;
    for (const v of vectors) {
      const r = roll(v.p);
      if (r.ok) { blocked++; if (r.lucky) anyLucky = true; log.push({ v, ok: true, lucky: r.lucky }); }
      else { entry = v; log.push({ v, ok: false }); break; }
    }
    if (!entry) { entry = Object.assign({ zeroDay: true }, cfg.zeroDay); log.push({ v: entry, ok: false }); }
    const dwell = entry.kind === "lingering" ? entry.src : null; // they were already inside
    if (S.mfa && log.some(l => l.v.kind === "phish")) L.set(...(strongPhish() ? P.lessonStrong : P.lessonRelay));

    /* Phishing against a skilled crew. A phone prompt stops some kits, but a
     * relay page passes it straight through. Security keys and passkeys only
     * sign in to the real site, so they hold unless a weaker fallback is left on. */
    function strongPhish() { return !!(S.mfaStrong && !S.ownerExempt); }
    function phishAdjust(v) {
      if (v.kind !== "phish" || !S.mfa) return v;
      // Only covered accounts get the benefit, so the effect scales with coverage
      const cov = S.mfaCover / 100;
      if (strongPhish()) return Object.assign({}, v, { p: 1 - (1 - v.p) * (1 - .85 * cov), hold: P.strongHold, fail: `${v.fail} ${P.downgrade}` });
      return Object.assign({}, v, { p: 1 - (1 - v.p) * (1 - .3 * cov), fail: `${v.fail} ${P.relay}` });
    }

    /* The first time anyone notices: does a plan run the response, or do you improvise? */
    function firstHour(clock, next) {
      if (coord) return next();
      L.set(...FH.lessonPlan);
      if (S.irPlan) {
        coord = "plan"; speed = .1; recovery = true;
        return narrate(clock, FH.title, FH.planLabel, true, FH.planText(S), next);
      }
      const opts = FH.options.filter(o => o.id !== "insurer" || FH.hasInsurer(S));
      const tip = S.tutorial ? FT.ui.advisor(`<p>${FH.tip}</p>`, "tut") : "";
      decide(clock, FH.title, `${tip}<p>${FH.question(S)}</p>`, opts, d => {
        coord = d;
        if (d === "usual") {
          story.push(FH.usualText);
          if (chance(.5)) { speed = -.2; story.push(FH.overheardText); L.set(...FH.lessonOob); }
        } else if (d === "phones") {
          speed = -.05; acc.morale -= 3; story.push(FH.phonesText); L.set(...FH.lessonOob);
        } else {
          speed = -.1; recovery = true; acc.trust += 2; story.push(FH.insurerText);
        }
        next();
      }, true);
    }

    function page(inner, buttons) {
      ui.screen(`<div class="panel finale">${inner}
        <div class="row">${buttons || `<button class="btn" id="n">Continue</button>`}</div></div>`, buttons ? "button[data-d]" : "#n");
    }
    function decide(clock, title, html, options, onPick, noHint) {
      // The containment hint belongs on the first containment decision, not the first-hour question
      const hint = !noHint && S.tutorial && !S.seenDecision && cfg.decisionHint ? ui.advisor(`<p>${cfg.decisionHint}</p>`, "tut") : "";
      if (!noHint) S.seenDecision = true;
      page(`<div class="clock">${clock}</div><h2>${title}</h2>${html}${hint}<p><b>What do you do?</b></p>`,
        options.map((o, i) => `<button class="btn ${i ? "ghost" : ""}" data-d="${o.id}">${o.label}</button>`).join(""));
      FT.app.querySelectorAll("button[data-d]").forEach(b => b.onclick = () => { FT.note(title, `Chose: ${b.textContent}.`); onPick(b.dataset.d); });
    }
    function narrate(clock, title, label, good, text, next) {
      page(`<div class="clock">${clock}</div><h2>${title}</h2><p class="stage ${good ? "ok" : "no"}">${label}</p><p>${text}</p>`);
      document.getElementById("n").onclick = next;
    }

    /* 1. Probing */
    const items = log.map((l, i) => `<li class="${l.ok ? "ok" : "no"}"><span class="t">${cfg.times[Math.min(i, cfg.times.length - 1)]}</span><div><b>${l.v.zeroDay ? cfg.zeroDay.label : `They try ${l.v.name}.`}</b> ${l.ok ? (l.lucky ? cfg.luckyBlock : l.v.hold) : l.v.fail}</div></li>`).join("");
    page(`<h2>${cfg.title}</h2><p>${cfg.intro(S)}</p><ol class="log">${items}</ol>
      <p class="stage no">A foothold</p><p>${blocked ? `Your defenses turned them away ${blocked} time${blocked > 1 ? "s" : ""}. Every failed attempt left traces in your logs.` : cfg.firstTry}</p>`);
    document.getElementById("n").onclick = beachhead;

    /* 2. Beachhead */
    function beachhead() {
      const b = cfg.beachhead, r = roll(sys.eff(S.edr) * S.diff.edr); // skilled crews often get past a single tool
      if (S.edr) L.set(...sys.notes.edr);
      if (r.ok) { if (r.lucky) anyLucky = true; return narrate(b.clock, b.title, r.lucky ? "Lucky break" : "Blocked on the first machine", true, r.lucky ? b.lucky : b.blocked, () => finish(r.lucky ? "luckyedr" : "edr")); }
      const early = S.diff.detect + .05 + S.detect / 220 + (S.mdr !== null ? (S.mdrNoisy ? S.mdr / 400 : S.mdr / 200) : 0) + .05 * blocked;
      narrate(b.clock, b.title, "They take control", false, b.failed(S), () => chance(Math.min(.95, early)) ? earlyDecision() : late(false));
    }

    /* 3. Early detection: first decision */
    function earlyDecision() {
      const e = cfg.early;
      firstHour(e.clock, () => decide(e.clock, e.title, `<p>${e.alert(S)}</p>`, e.options, d => {
        if (d === "host") {
          if (chance(odds(.45 + S.inventory / 250 + speed))) { story.push(e.hostWin); return finish("early"); }
          return narrate(e.clock, e.title, "Too late", false, e.hostLose, () => late(true));
        }
        if (d === "segment") {
          acc.care += e.segmentCare; story.push(e.segmentCost);
          if (chance(odds(.85 + speed))) { story.push(e.segmentWin); return finish("segment"); }
          return narrate(e.clock, e.title, "They slipped out", false, e.segmentLose, () => late(true));
        }
        // watch them
        intel = true;
        if (chance(odds(.6 + speed))) { story.push(e.watchWin); return finish("watched"); }
        return narrate(e.clock, e.title, "They moved first", false, e.watchLose, () => late(true));
      }));
    }

    /* 4. Late detection: second decision */
    function late(known) {
      const c = cfg.contain;
      const p = known ? 1 : S.diff.detect + .05 + S.detect / 260 + (S.mdr !== null ? (S.mdrNoisy ? S.mdr / 500 : S.mdr / 220) : 0) + .04 * blocked;
      if (!chance(Math.min(.95, p))) return narrate(c.clock, c.title, "Nobody is watching", false, c.unseen, encrypt);
      const opts = c.options.filter(o => o.id !== "mdr" || S.mdr !== null);
      firstHour(c.clock, () => decide(c.clock, c.title, `<p>${known ? c.knownAlert : c.alert(S)}</p>`, opts, d => {
        if (d === "plug") {
          acc.care += c.plugCare; acc.trust -= 4; story.push(c.plugCost);
          if (chance(odds(.9 + speed / 2))) { story.push(c.plugWin); return finish("downtime"); }
          return narrate(c.clock, c.title, "Not fast enough", false, c.plugLose, encrypt);
        }
        if (d === "targeted") {
          const p2 = .3 + S.detect / 200 + S.inventory / 400 + (intel ? .2 : 0) + speed;
          if (chance(Math.min(.9, odds(p2)))) { acc.care -= 2; story.push(c.targetedWin); return finish("targeted"); }
          return narrate(c.clock, c.title, "Missed one", false, c.targetedLose, encrypt);
        }
        const p3 = (S.mdrNoisy ? .45 : S.mdr / 100 * .9) + speed / 2;
        if (chance(odds(p3))) { acc.care -= 4; L.set(...(mode.setting.mdrNote || sys.notes.mdr)); story.push(c.mdrWin); return finish("mdrled"); }
        return narrate(c.clock, c.title, "Not fast enough", false, c.mdrLose, encrypt);
      }));
    }

    /* 5. Encryption: patient safety, then recovery */
    function encrypt() {
      const en = cfg.encrypt;
      // Nobody noticed in time. A plan still gets responders moving at first light.
      if (!coord) { coord = S.irPlan ? "plan" : "none"; if (S.irPlan) { recovery = true; story.push(typeof FH.planUnseen === "function" ? FH.planUnseen(S) : FH.planUnseen); L.set(...FH.lessonPlan); } }
      decide(en.clock, en.title, en.body(S), en.safety, d => {
        if (d === "divert") { acc.care += en.divertCare; acc.trust -= 4; story.push(en.divertText); }
        else if (chance(.5)) { acc.care += en.stayBadCare; story.push(en.stayBad); }
        else { acc.care += en.stayOkCare; story.push(en.stayOk); }
        recover();
      });
    }
    function recover() {
      const en = cfg.encrypt;
      const tested = S.backupTested && S.backupAge <= 2, immutable = !!S.immutable;
      L.set(...BK.lesson);
      let wiped = false;
      if (tested && !immutable) {
        // Crews hunt for backups first. Deletable backups often don't make it.
        wiped = chance(Math.min(.9, .6 * S.diff.harm));
        if (!wiped) story.push(BK.survivedTested);
      }
      if (tested && !wiped) { acc.trust -= recovery ? 6 : 10; acc.care -= recovery ? 5 : 8; story.push(en.restored); return finish("restored"); }
      if (immutable) { acc.trust -= recovery ? 10 : 14; acc.care -= recovery ? 11 : 14; story.push(BK.restoredSlow); return finish("restored"); }
      // A sanctioned gang can't legally be paid: the choice narrows to rebuilding
      const banned = S.gang.sanctioned;
      if (banned) L.set(...BK.sanctionsLesson);
      const options = banned ? en.recovery.filter(o => o.id !== "pay").map(o => Object.assign({}, o, { label: "Rebuild from scratch" })) : en.recovery;
      decide(en.recoverClock, en.recoverTitle, (wiped ? `<p>${BK.wipedTested}</p>` : "") + en.noBackups(S) + (banned ? `<p><b>${BK.sanctioned(S)}</b></p>` : ""), options, d => {
        L.set(...cfg.lessons.ransom);
        if (d === "pay") {
          const works = chance(.6);
          acc.trust -= (works ? 25 : 35) - (recovery ? 5 : 0); acc.care -= (works ? 8 : 18) - (recovery ? 4 : 0); acc.budget -= en.deductible;
          story.push(works ? en.paidWorks : en.paidFails);
          return finish("paid");
        }
        acc.trust -= recovery ? 25 : 30; acc.care -= recovery ? 20 : 25; story.push(banned ? en.rebuilt.replace(/^You refused\.\s*/, "") : en.rebuilt);
        finish("rebuilt");
      });
    }

    /* Data theft: how much left depends on how long they went unseen */
    function leakLevel(key) {
      let lvl = 0;
      if (["restored", "paid", "rebuilt"].includes(key)) lvl = S.detect >= 60 ? 1 : 2; // big transfers out get noticed
      else if (["downtime", "targeted", "mdrled"].includes(key)) lvl = chance(odds(.6 - S.detect / 250 - S.inventory / 500)) ? 1 : 0;
      if (dwell) lvl = Math.min(2, lvl + 1); // weeks of quiet access before tonight
      return lvl;
    }
    const after = []; // what happens after the night, told after the night's result
    function leak(key, lvl, next) {
      L.set(...LK.lessonTheft);
      const story = after; story.push(LK.later(S));
      const d = LK.data(S), who = LK.people(S), cost = LK.cost(S) * lvl;
      const intro = (lvl > 1 ? LK.lots(S, d) : LK.some(S, d)) + (dwell ? " " + LK.dwell(dwell) : "") + (key === "restored" ? " " + LK.restoredNote : "");
      const banned = S.gang.sanctioned;
      const tip = S.tutorial ? FT.ui.advisor(`<p>${LK.tip}</p>`, "tut") : "";
      decide(LK.clock, LK.title, `${tip}<p>${intro}</p>${banned ? `<p>Paying them isn’t an option: the ${S.gang.name} gang is on the sanctions list.</p>` : ""}`, banned ? LK.options.filter(o => o.id !== "pay") : LK.options, c => {
        if (c === "notify") { acc.trust -= 3 * lvl; acc.budget -= cost; story.push(LK.notifyText(S, who, LK.rule(S))); }
        else if (c === "wait") {
          acc.budget -= cost;
          if (chance(lvl > 1 ? .35 : .55)) { acc.trust -= 2 * lvl; story.push(LK.waitWin(S, who)); }
          else { acc.trust -= 8 * lvl; acc.care -= 3 * lvl; story.push(LK.waitLose(S, who)); L.set(...LK.lessonClock); }
        } else {
          acc.budget -= cost + LK.payCost(S); L.set(...LK.lessonPay);
          if (chance(.5)) { acc.trust -= 4 * lvl; story.push(LK.payWorks(S, who)); }
          else { acc.trust -= 10 * lvl; story.push(LK.payFails(S, who)); }
        }
        next();
      }, true);
    }

    function finish(key) {
      if (recovery && ["restored", "paid", "rebuilt"].includes(key)) story.push(FH.recoveryText);
      const lvl = leakLevel(key);
      if (lvl) return leak(key, lvl, () => conclude(key));
      conclude(key);
    }
    function conclude(key) {
      S.finaleResult = key;
      const res = cfg.results[key];
      if (anyLucky) L.set(...cfg.lessons.luck);
      const fx = {};
      for (const k in acc) if (acc[k]) fx[k] = acc[k];
      if (res.fx) for (const k in res.fx) fx[k] = (fx[k] || 0) + res.fx[k];
      FT.screens.outcome(cfg.title, { text: story.concat(res.text, after).join(" "), fx, lesson: res.lesson });
    }
  }
})();
