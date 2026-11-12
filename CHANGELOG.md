# Changelog

## Version 2

Year codes now end in a rules version (`PHNT-K7F3Q-2`). Codes from version 1 still load, with a note that the year may play out differently.

**Practitioner mode**

- **Ransomware night got more realistic.**
  - **Data theft:** crews steal data before encrypting, so a leak-site decision follows: notify, wait for forensics, or pay for “deletion.”
  - **The first hour:** an incident plan now matters on the night itself.
  - **Sanctioned gangs:** about one gang in four is on a sanctions list, which takes paying off the table.
- **Backups need two things:** a recent restore test and immutability. Tested but deletable backups can be wiped.
- **Multi-factor login:** coverage drifts after rollout, a skilled crew can relay a phone prompt through a fake page, and phishing-resistant sign-in is a new project.
- **Leftover access:** attackers who got in earlier in the year can leave a way back in, found by threat hunts and detection.
- **Phishing training** now levels off: some people will always click.
- **Every status row lists the tasks that improve it,** and every control has a way to improve it, including new asset inventory rows and late MDR purchases.
- **New tutorial notes** later in the year.
- **Fixed:** with a negative budget, free tasks couldn't be assigned.

**Student mode**

- Offline backup copies, multi-factor gaps for new staff, passkeys, real-time phishing, leftover access with an incident cleanup task, a leak-site decision about telling families, and sanctioned gangs. All of these are visible on the status board and explained as they happen.
- “Improve it with” hints and new tutorial notes.
- **Fixed:** with a negative budget, free tasks couldn't be picked.

**Leadership mode**

- **Investigations:** after a smaller incident, you decide whether to pay for a full investigation. Closing it early can leave attackers a way back in.
- **Insurance applications:** you can claim multi-factor login on the application for a cheaper premium. If it isn't true when the crisis hits, the claim is denied.
- **Sanctioned groups:** paying the ransom can be off the table.
- **The crisis has uncertainty:** good calls usually work but not always, and attackers can come back during recovery.

**Behind the scenes**

- Automated checks (`npm test`) play every mode start to finish and stress-test each mode's ending.

## Version 1

The original release: student, practitioner and leadership modes, eight settings, yearly conditions, starting situations, achievements, year reports and year codes. Year codes without a version number at the end come from this version.
