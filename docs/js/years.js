/* SPDX-License-Identifier: GPL-3.0-or-later */
/* years.js: what makes each year different, and what players unlock.
 *
 * Conditions: each mode lists possible yearly conditions
 *   { id, name, desc, good, apply(S, gen) }
 * Two are drawn per year from the seed, so a year code recreates them.
 *
 * Starting situations: each mode can offer { id, letter, name, desc, apply(S) }.
 *
 * Achievements: each mode lists { id, name, desc, test(S, ctx) }, where ctx has
 * {lossMsg, grade, mode}. Unlocks are saved in this browser only. */
(function () {
  const S = FT.S, rng = FT.rng;

  const years = {
    // Draw n conditions using their own stream, so other choices don't affect them
    pickConditions(list, n) {
      const gen = rng.fork("conditions");
      const pool = FT.util.shuffle(list.slice(), gen);
      const out = [];
      for (const c of pool) {
        if (out.length >= n) break;
        if (out.some(o => (o.excludes || []).includes(c.id) || (c.excludes || []).includes(o.id))) continue;
        out.push(c);
      }
      return out;
    },
    // Apply to a new game's state object (before it becomes FT.S)
    applyConditions(state, list) {
      const gen = rng.fork("condition-effects");
      state.conditions = list.map(c => ({ id: c.id, name: c.name, desc: c.desc, good: c.good }));
      for (const c of list) c.apply(state, gen);
    },
    // Resolve a starting situation preference ("random" or an id)
    pickStart(starts, pref) {
      if (pref && pref !== "random" && starts.find(s => s.id === pref)) return starts.find(s => s.id === pref);
      const gen = rng.fork("start");
      return starts[Math.floor(gen() * starts.length)];
    },
    applyStart(state, st) { state.startInfo = { id: st.id, name: st.name, desc: st.desc }; st.apply(state); },
    // Shared intro control for choosing a starting situation
    startOptions(starts, pref) {
      const opts = [["random", "Random"]].concat(starts.map(s => [s.id, s.short]));
      const desc = id => id === "random" ? "You’ll find out what you’ve inherited on day one." : starts.find(s => s.id === id).desc;
      return `<fieldset class="seg"><legend>Starting situation</legend>
        <div class="seg-row">${opts.map(([k, l]) => `<label class="seg-opt"><input type="radio" name="start" value="${k}" ${pref === k ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
        <p class="hint" id="startdesc">${desc(pref)}</p></fieldset>`;
    },
    bindStartOptions(root, starts, onChange) {
      root.querySelectorAll('input[name="start"]').forEach(r => r.onchange = () => { onChange(r.value); root.querySelector("#startdesc").textContent = r.value === "random" ? "You’ll find out what you’ve inherited on day one." : starts.find(s => s.id === r.value).desc; });
    },
    has(id) { return (S.conditions || []).some(c => c.id === id); },

    // The box shown at the start of the year
    notice() {
      const conds = (S.conditions || []).map(c => `<li><b class="${c.good ? "cgood" : "cbad"}">${c.name}.</b> ${c.desc}</li>`).join("");
      return `<div class="notice yearnote">
        ${S.startInfo ? `<p><b>Starting situation: ${S.startInfo.name}.</b> ${S.startInfo.desc}</p>` : ""}
        ${conds ? `<p><b>This year’s conditions:</b></p><ul>${conds}</ul>` : ""}
        <p class="hint">Year code <b class="code">${S.code}</b>. Share it, and anyone can play this same year.</p></div>`;
    },
    summary() {
      const parts = [];
      if (S.startInfo) parts.push(`started with ${S.startInfo.name.toLowerCase()}`);
      if ((S.conditions || []).length) parts.push(`conditions: ${S.conditions.map(c => c.name.toLowerCase()).join(", ")}`);
      return `<p class="hint">Year code <b class="code">${S.code}</b>${parts.length ? `; ${parts.join("; ")}` : ""}.</p>`;
    }
  };

  /* ---------- Achievements ---------- */
  const KEY = "firewall-trail-progress";
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage unavailable: progress just isn't kept */ } }

  const GLOBAL = [
    { id: "all-modes", name: "Every seat at the table", desc: "Finish a year in student, practitioner and leadership mode.", test: (S, ctx, data) => ["student", "practitioner", "leadership"].every(m => data.finished && data.finished[m]) }
  ];

  const ach = {
    all() {
      const list = [];
      for (const id of FT.modeOrder) for (const a of FT.modes[id].achievements || []) list.push(Object.assign({ mode: FT.modes[id].name }, a));
      return list.concat(GLOBAL.map(a => Object.assign({ mode: "Any mode" }, a)));
    },
    unlocked() { return load().unlocked || {}; },
    // Record the finished game and return newly unlocked achievements
    check(mode, ctx) {
      const data = load();
      data.unlocked = data.unlocked || {}; data.finished = data.finished || {}; data.aGrades = data.aGrades || {};
      if (!ctx.lossMsg) data.finished[mode.id] = true;
      if (ctx.grade === "A") data.aGrades[`${mode.id}:${S.settingId || "-"}`] = true;
      const fresh = [];
      for (const a of (mode.achievements || []).concat(GLOBAL)) {
        if (data.unlocked[a.id]) continue;
        let ok = false;
        try { ok = a.test(S, ctx, data); } catch (e) { ok = false; }
        if (ok) { data.unlocked[a.id] = new Date().toISOString().slice(0, 10); fresh.push(a); }
      }
      save(data);
      return fresh;
    },
    // A in every setting of a mode
    allSettingsA(data, modeId, ids) { return ids.every(id => data.aGrades && data.aGrades[`${modeId}:${id}`]); },
    screen() {
      const got = ach.unlocked(), list = ach.all();
      const rows = list.map(a => `<li class="${got[a.id] ? "got" : ""}"><b>${got[a.id] ? "✓ " : ""}${a.name}</b> <span class="hint">(${a.mode})</span><br><small>${a.desc}</small></li>`).join("");
      FT.app.innerHTML = `<div style="padding-top:2rem"><h1 style="font-size:clamp(2.4rem,8vw,4rem)">Achievements</h1>
        <p>${Object.keys(got).filter(k => list.some(a => a.id === k)).length} of ${list.length} unlocked. Progress is saved in this browser only.</p>
        <div class="panel"><ul class="achlist">${rows}</ul>
        <div class="row"><button class="btn" id="back">Back</button></div></div></div>`;
      const b = document.getElementById("back"); b.focus(); b.onclick = () => FT.screens.title();
    }
  };

  FT.years = years;
  FT.ach = ach;
})();
