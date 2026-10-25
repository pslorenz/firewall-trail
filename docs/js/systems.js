/* SPDX-License-Identifier: GPL-3.0-or-later */
/* systems.js: security mechanics shared by every mode.
 * Modes decide what the numbers mean in their world; these functions decide
 * how well a defense performs. */
(function () {
  const S = FT.S, { chance } = FT.util;

  // Well-configured tools punch above their weight; half-configured ones
  // underperform. Tools are rated 0–100; null means "not owned".
  function eff(v) { return v === null || v === undefined ? 0 : v >= 75 ? v / 100 * .95 : v / 100 * .6; }

  const notes = {
    edr: ["Endpoint detection and response (EDR)", "Software on each computer that spots and blocks malicious behavior, like a program suddenly encrypting files. It only works well once it’s tuned to what’s normal for your machines."],
    mdr: ["Managed detection and response (MDR)", "A team that watches your systems around the clock and jumps in when an attacker gets past your defenses. Its value depends heavily on how well it’s set up for your environment."]
  };

  function filterCatch() {
    if (S.filter === null) return { caught: false, note: "" };
    if (chance(eff(S.filter))) return { caught: true };
    return { caught: false, note: S.filter < 60 ? " The email filter was mostly on default settings and let it through." : " It slipped past the email filter. No tool catches everything." };
  }
  function edrCatch() { return S.edr !== null && chance(eff(S.edr)); }
  function mdrCatch() { return S.mdr !== null && chance(S.mdr / 100); }
  function backupsGood() { return S.backupTested && S.backupAge <= 2; }

  FT.sys = { eff, notes, filterCatch, edrCatch, mdrCatch, backupsGood };
})();
