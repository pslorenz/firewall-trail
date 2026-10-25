/*
 * The Firewall Trail
 * Copyright (C) 2026 Steven Lorenz (pslorenz)
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details. You should have received a copy of the GNU General Public
 * License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/* core.js: the shared namespace, game state and small utilities.
 * Everything lives on window.FT so plain <script> tags work, including
 * when index.html is opened straight from disk with no web server. */
window.FT = (function () {
  // One stable state object. It is reset in place for each new game, so
  // content files can safely keep a reference to it (const S = FT.S).
  const S = {};
  // Concepts the player has run into, shown on the end screen.
  const learned = new Map();

  /* ---------- Seeded randomness and year codes ----------
   * Every game has a seed. All randomness comes from it, so a year code
   * recreates the same year. Randomness is split into streams: setup
   * (conditions, deck order), one per month, and one per deck. That way a
   * player's choices in March don't change what happens in April. */
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
  const rng = {
    seed: null, gen: Math.random,
    newSeed() { let s = ""; for (let i = 0; i < 5; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; },
    begin(seed) { rng.seed = seed || rng.newSeed(); rng.stream("setup"); },
    stream(tag) { rng.gen = mulberry(hash(rng.seed + "|" + tag)); },
    random() { return rng.gen(); },
    // A separate generator for one-off uses, so it doesn't disturb the current stream
    fork(tag) { return mulberry(hash((rng.seed || "x") + "|" + tag)); },
    // Codes look like PHNT-K7F3Q: prefix letters from the mode, then the seed
    code(prefix) { return `${prefix}-${rng.seed}`; },
    parse(code) {
      const m = String(code || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").match(/^([A-Z]{1,4})-?([A-Z2-9]{5})$/);
      return m ? { prefix: m[1], seed: m[2] } : null;
    },
    ALPHA
  };

  const util = {
    rand: () => rng.random(),
    shuffle(a, gen) { const r = gen || rng.random; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    clamp(v) { return Math.max(0, Math.min(100, v)); },
    chance(p) { return rng.random() < p; },
    pick(a) { return a[Math.floor(rng.random() * a.length)]; },
    money(n) { return (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString(); },
    // A roll with a small luck adder: sometimes things just break your way.
    // "lucky" is true when only the luck made it succeed.
    roll(p) { const luck = rng.random() * .1, r = rng.random(); return { ok: r < p + luck, lucky: r >= p && r < p + luck }; },
    // Draw n items without repeats within a game, like dealing from a deck.
    // Only when every item has been used does the deck reshuffle.
    draw(key, items, n) {
      const k = "_deck_" + key;
      let deck = S[k] || [];
      if (deck.length < n) { S[k + "_n"] = (S[k + "_n"] || 0) + 1; deck = deck.concat(util.shuffle(items.map((_, i) => i).filter(i => !deck.includes(i)), rng.fork(k + S[k + "_n"]))); }
      const out = deck.splice(0, n);
      S[k] = deck;
      return out.map(i => items[i]);
    }
  };

  function reset(fresh) {
    for (const k of Object.keys(S)) delete S[k];
    Object.assign(S, fresh);
    learned.clear();
  }

  return {
    S, learned, util, reset, rng,
    modes: {},        // registered game modes, by id
    modeOrder: [],    // order they appear on the title screen
    mode: null,       // the mode being played
    app: null,        // the #app element
    register(mode) { FT.modes[mode.id] = mode; FT.modeOrder.push(mode.id); }
  };
})();
