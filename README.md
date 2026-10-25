# The Firewall Trail

An Oregon Trail–style browser game about cybersecurity. Survive a year in security, from the help desk to the boardroom: spend limited time on defenses that wear off, deal with whatever the month throws at you, and make it through ransomware night.

**Modes**

**Student mode.** You're the new IT tech at a school district. A gentle, guided first month and plain-language lessons after every event.

**Practitioner mode.** You run security day to day. Pick the shape of the job, then the kind of organization, or let the game choose:

- **Mid-size organization** (a hospital, a manufacturer or a B2B software company): lead a three-person security team inside one organization. Assign work by specialty, manage burnout, run multi-month projects and triage alerts. Each setting has its own tension: patient care, production downtime or business speed.
- **Managed service provider (MSP):** the same team, but your RMM, admin access and credential vault reach every client at once. Client exceptions, a shared senior engineer, and sometimes a private equity buyout mid-year.
- **Small business:** no team at all. Choose the kind of business, or let the game choose: you're the office manager at a medical practice, the operations manager at a machine shop, or a developer at a startup who also handles IT, with a few hours a month and an MSP or contractor to lean on. Payment fraud, owners who want exemptions, and cheap fixes that matter most.

Every setting ends with ransomware night, where you make the calls live. Three difficulty levels and an optional guided first month.

**Leadership mode.** You're the CEO of a mid-size organization (the hospital, manufacturer or software company), or the owner of the MSP. Four quarters of budget decisions, inbox dilemmas and board meetings, seen only through your security lead's report, which is only as accurate as the visibility you pay for. MSP owners also watch the numbers MSPs run on (recurring revenue, margin, churn, utilization, SLA attainment and security attach) under an ownership that varies each year: owner-operated, a minority private equity partner, or already part of a roll-up. The year ends in a crisis you lead, then a reveal of what was really going on.

**Every year is different**

- **Yearly conditions:** two per year, good and bad, like a budget freeze, a hot job market, a ransomware wave or board backing.
- **Starting situations** (practitioner and leadership): a typical program, an inherited mess, a mature program, or a brand-new function.
- **Year codes:** every year has a code like `PHNT-K7F3Q`. Enter it on the title screen to play that exact year: same conditions, same starting point, same events in the same order. Good for comparing notes or running the same scenario in a workshop.
- **Achievements** across the modes, saved in your browser.
- **Year reports:** a printable summary of your year, with a timeline of every decision, that you can save as a PDF.
- **Feedback:** the feedback links open a GitHub issue pre-filled with your year code, mode and result, so any report can be replayed exactly.

## Playing it

The game lives in the `docs/` folder, which GitHub Pages serves directly. To play locally, open `docs/index.html` in any browser. It runs with no server and no internet connection (fonts fall back gracefully offline).

## How the code is organized

Plain HTML, CSS and JavaScript. No build step and no dependencies.

Everything below is inside `docs/`.

```
index.html               loads everything, in order
css/style.css            all styling, including dark mode
js/core.js               shared namespace (FT), game state, utilities
js/systems.js            shared security mechanics (tool effectiveness, filters, EDR, MDR)
js/ui.js                 shared drawing: trail, stats, status board, advisor
js/screens.js            the game loop: title, planning, events, end of month, ending
js/minigames.js          reusable minigames: inbox check, fake logins, passwords
js/finale.js             the ransomware night engine
js/years.js              yearly conditions, starting situations, year notice, achievements
js/share.js              decision log, GitHub feedback links, printable year report
js/picker.js             the grouped setting picker shared by practitioner and leadership
favicon.svg, apple-touch-icon.png, og-image.png   icon and link-preview image
js/main.js               starts the game
modes/student/mode.js        rules, actions, status board, tutorial, finale wording
modes/student/events.js      the monthly events
modes/student/minigames.js   minigame schedule and content
modes/practitioner/mode.js       team, projects, planning screen, change report
modes/practitioner/finale.js     ransomware night with live decisions
modes/practitioner/hospital.js        the hospital setting: tasks, status board, events, alerts, wording
modes/practitioner/manufacturing.js   the manufacturing setting, same structure
modes/practitioner/software.js        the B2B software setting, same structure
modes/practitioner/msp.js             the MSP setting: tier-zero tools, client roster, supply-chain finale
modes/practitioner/smallbiz.js        the small business setting: medical practice, machine shop or startup
modes/leadership/mode.js              leadership mode: quarters, the report, budget, inbox, board, crisis, reveal
modes/leadership/settings.js          the three organizations from the CEO’s chair
modes/leadership/msp.js               the MSP from the owner’s chair
```

The engine (`js/`) knows nothing about schools or hospitals. Each mode in `modes/` supplies its own wording, numbers, actions and events.

## Adding content

**A new event:** add an entry to a mode's `events.js`. An event has either `run()`, which returns an outcome, or `choices` (a list of `{label, run()}`) plus an `intro`. An outcome is:

```js
{ text: "What happened.", fx: { trust: -5, morale: -3, budget: -500 }, lesson: ["Term", "Plain-language explanation."] }
```

Events can read and change the game state `S` (for example `S.patch`, `S.mfa`, `S.training`).

**Minigame content:** add emails, login pages or password questions to the lists in a mode's `minigames.js`.

**A new practitioner setting:** copy `modes/practitioner/hospital.js`, change its `id` and content, and add it to `index.html` after `hospital.js`.

**A new mode:** copy `modes/student/` as a starting point, change the `id`, and add its scripts to `index.html`.

## License

GPL-3.0-or-later. See `LICENSE`.
