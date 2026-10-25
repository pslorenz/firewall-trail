/* SPDX-License-Identifier: GPL-3.0-or-later */
/* picker.js: the grouped setting picker shared by practitioner and leadership.
 *
 * The top row offers the shapes of the job (a mid-size organization, an MSP,
 * a small business) plus Random. A group with several settings, or a setting
 * with several kinds, reveals a second picker underneath.
 *
 * A mode provides:
 *   mode.groups: [{ id, label, desc, members: [settingId, ...], subLegend, subRandomDesc }]
 *   mode.allSettings(): its settings by id
 *   mode.prefs.group, mode.prefs.sub[groupId]
 * A setting with kinds provides kindOptions: [[id, label, desc], ...].
 *
 * Every world keeps its own code letter, so year codes don't depend on the menu. */
(function () {
  // The second-level options for a group: its member settings, or a single setting's kinds
  function subOptions(mode, g) {
    const all = mode.allSettings();
    if (g.members.length > 1) return g.members.map(id => [id, all[id].short, all[id].summary]);
    const st = all[g.members[0]];
    return st.kindOptions || null;
  }
  // Every playable world, for top-level Random: each setting, or each kind of a setting
  function worlds(mode) {
    const all = mode.allSettings(), out = [];
    for (const g of mode.groups) for (const id of g.members) {
      if (all[id].kindOptions) for (const [k] of all[id].kindOptions) out.push({ setting: id, kind: k });
      else out.push({ setting: id, kind: null });
    }
    return out;
  }
  const groupOf = (mode, settingId) => mode.groups.find(g => g.members.includes(settingId));

  const picker = {
    html(mode) {
      const p = mode.prefs, sel = p.group || "random";
      const top = [["random", "Random", mode.randomDesc]].concat(mode.groups.map(g => [g.id, g.label, g.desc]));
      const subs = mode.groups.map(g => {
        const opts = subOptions(mode, g);
        if (!opts) return "";
        const cur = (p.sub && p.sub[g.id]) || "random", all = [["random", "Random", g.subRandomDesc]].concat(opts);
        return `<fieldset class="seg kindpick" data-for="${g.id}" ${sel === g.id ? "" : "hidden"}><legend>${g.subLegend}</legend>
          <div class="seg-row">${all.map(([k, l]) => `<label class="seg-opt"><input type="radio" name="sub-${g.id}" value="${k}" ${cur === k ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
          <p class="hint" id="subdesc-${g.id}">${(all.find(o => o[0] === cur) || all[0])[2]}</p></fieldset>`;
      }).join("");
      return `<fieldset class="seg"><legend>Setting</legend>
        <div class="seg-row">${top.map(([k, l]) => `<label class="seg-opt"><input type="radio" name="group" value="${k}" ${sel === k ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
        <p class="hint" id="groupdesc">${(top.find(t => t[0] === sel) || top[0])[2]}</p></fieldset>${subs}`;
    },
    bind(mode, root) {
      const top = [["random", "Random", mode.randomDesc]].concat(mode.groups.map(g => [g.id, g.label, g.desc]));
      root.querySelectorAll('input[name="group"]').forEach(r => r.onchange = () => {
        mode.prefs.group = r.value;
        root.querySelector("#groupdesc").textContent = top.find(t => t[0] === r.value)[2];
        root.querySelectorAll(".kindpick").forEach(f => f.hidden = f.dataset.for !== r.value);
      });
      for (const g of mode.groups) {
        const opts = subOptions(mode, g);
        if (!opts) continue;
        const all = [["random", "Random", g.subRandomDesc]].concat(opts);
        root.querySelectorAll(`input[name="sub-${g.id}"]`).forEach(r => r.onchange = () => {
          mode.prefs.sub = mode.prefs.sub || {};
          mode.prefs.sub[g.id] = r.value;
          root.querySelector(`#subdesc-${g.id}`).textContent = all.find(o => o[0] === r.value)[2];
        });
      }
    },
    // Decide this year's setting (and kind), without touching the setup stream
    resolve(mode) {
      const p = mode.prefs, g = mode.groups.find(x => x.id === p.group);
      const gen = FT.rng.fork("setting");
      if (!g) { const w = worlds(mode); return w[Math.floor(gen() * w.length)]; }
      const sub = (p.sub && p.sub[g.id]) || "random";
      if (g.members.length > 1) return { setting: g.members.includes(sub) ? sub : g.members[Math.floor(gen() * g.members.length)], kind: null };
      const st = mode.allSettings()[g.members[0]];
      return { setting: st.id, kind: st.kindOptions && st.kindOptions.some(k => k[0] === sub) ? sub : null };
    },
    // Set the picker to a specific setting (and kind), e.g. from a year code
    select(mode, settingId, kind) {
      const g = groupOf(mode, settingId);
      if (!g) return false;
      mode.prefs.group = g.id;
      mode.prefs.sub = mode.prefs.sub || {};
      mode.prefs.sub[g.id] = g.members.length > 1 ? settingId : (kind || "random");
      return true;
    }
  };
  FT.picker = picker;
})();
