# Automated checks

The game needs no build step, but it has a lot of moving parts: three modes, eight settings, dozens of events and a branching ransomware night. These checks play the game in a headless browser to catch the mistakes that are easy to make when adding content.

## Running them

You need [Node.js](https://nodejs.org/) 18 or later.

```sh
npm install                        # once: installs Playwright
npx playwright install chromium    # once: downloads the browser it drives
npm test                           # a quick run, about 10 seconds
npm test -- --full                 # a longer run, about 30 seconds
npm test -- --seed 12345           # repeat a run exactly
```

Each run prints its seed. If something fails, rerun with that seed to reproduce it. Set `VERBOSE=1` to see details for passing checks too. The command exits with code 1 on any failure, so it can run in CI.

No Node? Open the game, paste `tests/checks.js` into the browser console, and run `await FTChecks.run()`.

## What they check

- **Full years:** every mode, setting and kind of small business is played start to finish by a "monkey" that clicks random buttons, on every difficulty, with and without the tutorial. It fails on any script error, on a year that never ends, or on broken text on screen (`undefined`, `NaN`, `[object Object]`).
- **Year codes:** the same code and the same choices must give the same year, and codes must round-trip with the mode's rules version.
- **Events:** every practitioner event runs in many random situations and returns readable text.
- **Ransomware night:** hundreds of practitioner and student nights in random situations must all reach a known ending, with readable text, and never offer to pay a sanctioned gang.
- **Leadership crisis:** hundreds of Q4 crises in random situations must reach an ending, never offer to pay a sanctioned group, and deny the insurance claim exactly when the application was false.
- **Hardening paths:** every practitioner and student status row that isn't already green must list a task that improves it. Rows that are information rather than controls (like the plant's shutdown calendar) are listed in the setting's `infoRows`.

## When you change the rules

If a change makes an existing year code play out differently, bump that mode's `rulesVersion` in its `mode.js`. New codes then end in the new version number, and older codes still load but say they may play differently.
