/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Student mode events. Each month one is drawn at random from this list
 * (except those marked deck:false, which are scheduled or retired).
 *
 * An event either has run(), which returns an outcome, or choices: a list of
 * {label, run()} with an intro. An outcome looks like:
 *   { text, fx: { trust, morale, budget }, lesson: [term, explanation] }
 * Events read and change the game state S directly. */
(function () {
  const S = FT.S, L = FT.learned, { chance, clamp } = FT.util, sys = FT.sys;

FT.modes.student.events = [
 {id:"mailbox",title:"“Your mailbox is full”",run(){
   const f=sys.filterCatch();
   if(f.caught) return {text:"A fake “mailbox full” email was sent to every staff member. Your email filter recognized the look-alike domain and quarantined all 214 copies. Nobody ever saw it.",fx:{trust:3},lesson:["Email filtering","A well-tuned filter stops many phishing emails before people see them, which means fewer chances for a click."]};
   const clicked=chance((100-S.training)/100*.85);
   if(!clicked) return {text:"A fake “mailbox full” email hit every staff inbox."+(f.note||"")+" Three teachers forwarded it to you instead of clicking. Nice.",fx:{trust:4},lesson:["Phishing","Fake messages that trick people into giving up passwords. Training makes people pause and report instead of clicking."]};
   if(S.mfa) return {text:(f.note?f.note.trim()+" ":"")+"The vice principal has clicked the link and typed in her password. But when the attacker tried to log in, multi-factor asked for a code they didn’t have.",fx:{trust:-3},lesson:["Multi-factor authentication","A second proof of identity, like a phone code. A stolen password alone isn’t enough to get in."]};
   return {text:(f.note?f.note.trim()+" ":"")+"The vice principal has clicked the link. The attacker used her account to email every parent a fake “lunch fee” payment link.",fx:{trust:-18,morale:-10},lesson:["Phishing","Fake messages that trick people into giving up passwords. One compromised account can be used to fool everyone who trusts it."]};
 }},
 {id:"ransom",deck:false,title:"Ransomware in the front office",run(){
   const foothold=chance((100-S.patch)/100);
   if(!foothold) return {text:"Ransomware tried to spread through an old Windows bug, but your machines were already patched. It went nowhere.",fx:{trust:3},lesson:["Patching","Updates close known holes. Most attacks use bugs that already have a fix available."]};
   if(S.backupTested&&S.backupAge<=2) return {text:"Ransomware locked every computer in the front office. Because you’d recently tested your backups, you wiped and restored everything by Thursday.",fx:{trust:-5,morale:-10},lesson:["Backups","A backup only counts if you’ve proven you can restore from it. Tested backups turn a disaster into a bad week."]};
   return {text:"Ransomware locked the front office, attendance records and the cafeteria system. The backups hadn’t been tested in months. Half of them were empty.",fx:{trust:-30,morale:-20,budget:-3000},lesson:["Backups","A backup only counts if you’ve proven you can restore from it. Untested backups often fail exactly when you need them."]};
 }},
 {id:"printer",title:"The library printer is acting strange",run(){
   if(S.patch>=50) return {text:"Someone scanned the network looking for an old printer bug. Your printers were updated, so the scan found nothing.",fx:{trust:2},lesson:["Attack surface","Every connected device, even a printer, is a possible way in. Printers need updates too."]};
   return {text:"An attacker used an unpatched printer bug. Every printer in the district printed 400 pages of memes during the board meeting.",fx:{trust:-10,budget:-300,morale:-5},lesson:["Attack surface","Every connected device, even a printer, is a possible way in. Printers need updates too."]};
 }},
 {id:"credstuff",title:"Password reuse",run(){
   if(S.mfa) return {text:"A coach’s password leaked from a fantasy-football site. He used the same one at school. Attackers tried it, but multi-factor stopped them cold.",fx:{trust:2},lesson:["Credential stuffing","Attackers try passwords leaked from one site on other sites. Multi-factor login makes those stolen passwords useless."]};
   return {text:"A coach’s password leaked from a fantasy-football site. He used the same one at school. Attackers logged in and changed student grades.",fx:{trust:-15,morale:-8},lesson:["Credential stuffing","Attackers try passwords leaked from one site on other sites. Unique passwords and multi-factor login are the fix."]};
 }},
 {id:"rogue",title:"Mystery device on the network",run(){
   if(S.inventory>=50) return {text:"Your device list flagged something new: a tiny computer taped under a desk in the robotics lab. A student was testing a project. You had a good talk.",fx:{trust:3},lesson:["Asset inventory","You can’t protect what you don’t know you have. A device list makes strange things stand out."]};
   if(sys.mdrCatch()){L.set(...sys.notes.mdr);return {text:"A tiny computer appeared under a desk in the robotics lab and started recording network traffic. Your MDR provider flagged the strange traffic within a day and walked you to it.",fx:{trust:-2},lesson:["Asset inventory","You can’t protect what you don’t know you have. MDR caught this one, but a device list would have made it stand out on day one."]};}
   return {text:"For weeks, a tiny computer under a desk in the robotics lab quietly recorded network traffic. Nobody noticed because nobody knew what “normal” looked like.",fx:{trust:-10,morale:-5},lesson:["Asset inventory","You can’t protect what you don’t know you have. A device list makes strange things stand out."]};
 }},
 {id:"vendor",title:"The gradebook company got hacked",choices:[
   {label:"Tell families today",run(){return {text:"You and the principal sent a clear letter: what happened, what data was involved, what you’re doing. Parents were upset, but they appreciated hearing it from you first.",fx:{trust:-5},lesson:["Breach disclosure","When data is exposed, telling people quickly and honestly protects trust. Many places also have laws requiring it."]}}},
   {label:"Wait until you know more",run(){return {text:"A local news site broke the story before you said anything. Parents were angrier about the silence than about the breach.",fx:{trust:-20,morale:-5},lesson:["Breach disclosure","When data is exposed, telling people quickly and honestly protects trust. Silence usually makes it worse."]}}}
 ],intro:"The online gradebook your district uses announced a breach. Student names and grades may be exposed. It wasn’t your system, but it’s your students’ data.",lessonPre:["Third-party risk","Your data lives with vendors too. Their security problems become yours."]},
 {id:"laptop",title:"A teacher left a laptop on the bus",run(){
   if(S.inventory>=50) return {text:"Because the laptop was on your device list with remote management, you locked and wiped it within the hour.",fx:{trust:2},lesson:["Device management","Tracking and managing devices lets you lock or erase a lost one before anyone reads the data."]};
   return {text:"The laptop wasn’t tracked or encrypted, and it had a spreadsheet of student health records on the desktop.",fx:{trust:-14,morale:-5},lesson:["Device management","Tracking and managing devices lets you lock or erase a lost one before anyone reads the data."]};
 }},
 {id:"giftcard",title:"The principal needs gift cards, urgently",run(){
   const fooled=chance((100-S.training)/100*.7);
   if(!fooled) return {text:"The front office got a text “from the principal” asking for $500 in gift cards. They called her to check. She was in the cafeteria and had sent nothing."+(S.filter!==null?" (Note: the email filter can’t help here. This came by text message.)":""),fx:{trust:3},lesson:["Social engineering","Scammers pretend to be bosses and create urgency. Verifying through a different channel, like a phone call, stops them."]};
   return {text:"The front office bought $500 in gift cards for a “principal” who turned out to be a scammer with a spoofed number."+(S.filter!==null?" The email filter never saw it, because it came by text message.":""),fx:{trust:-6,budget:-500},lesson:["Social engineering","Scammers pretend to be bosses and create urgency. Verifying through a different channel, like a phone call, stops them."]};
 }},
 {id:"zeroday",title:"Emergency browser update",choices:[
   {label:"Patch this weekend",run(){S.patch=clamp(S.patch+30);return {text:"You spent Saturday pushing the update to 900 Chromebooks. Tired, but every machine was protected by Monday.",fx:{morale:-15,trust:4},lesson:["Zero-day","A bug attackers are already using before most people have the fix. Speed matters more than usual."]}}},
   {label:"Wait until Monday",run(){
     if(chance(.5)) return {text:"Attackers used the bug Sunday night through a sketchy ad on a homework site. Twenty Chromebooks got infected.",fx:{trust:-15,morale:-5},lesson:["Zero-day","A bug attackers are already using before most people have the fix. Speed matters more than usual."]};
     return {text:"You got lucky. Nobody targeted the district over the weekend, and Monday’s update went smoothly.",fx:{morale:5},lesson:["Zero-day","A bug attackers are already using before most people have the fix. Waiting is a gamble."]};
   }}
 ],intro:"Your browser vendor just released an urgent fix. Attackers are already using the bug in the wild. It’s Friday at 4:30."},
 {id:"usb",title:"A USB stick in the parking lot",run(){
   const plugged=chance((100-S.training)/100*.8);
   if(!plugged) return {text:"A staff member found a USB stick labeled “Salaries 2026” and brought it straight to you instead of plugging it in.",fx:{trust:3},lesson:["Baiting","Attackers leave infected USB drives where curiosity will win. Unknown drives go to IT, not into a computer."]};
   if(sys.edrCatch()){L.set(...sys.notes.edr);return {text:"Someone plugged in a USB stick labeled “Salaries 2026.” It tried to install a remote-control program, but endpoint protection recognized the behavior and blocked it.",fx:{trust:-1},lesson:["Baiting","Attackers leave infected USB drives where curiosity will win. EDR saved you this time, but unknown drives should go to IT."]};}
   return {text:"Someone plugged in a USB stick labeled “Salaries 2026.” It installed a program that let an attacker see the screen.",fx:{trust:-10,morale:-5},lesson:["Baiting","Attackers leave infected USB drives where curiosity will win. Unknown drives go to IT, not into a computer."]};
 }},
 {id:"remote",title:"Snow days: everyone learns from home",choices:[
   {label:"Let students use any device",run(){S.inventory=clamp(S.inventory-30);return {text:"Classes started on time, but now hundreds of unknown personal devices connect to school systems.",fx:{trust:5,morale:-5},lesson:["BYOD risk","“Bring your own device” is convenient, but you can’t update or check devices you don’t control."]}}},
   {label:"Send home managed laptops",run(){return {text:"It took two days and $2,000 in shipping and spares, but every student is on a device you can update and protect.",fx:{trust:5,budget:-2000,morale:-5},lesson:["BYOD risk","“Bring your own device” is convenient, but you can’t update or check devices you don’t control."]}}}
 ],intro:"A big storm closes schools for a week. The superintendent wants remote classes running tomorrow."},
 {id:"invoice",title:"An overdue invoice",run(){
   const f=sys.filterCatch();
   if(f.caught) return {text:"An email with an “overdue invoice” attachment targeted the business office. The filter opened the file in a safe test area, saw it try to download malware, and blocked it.",fx:{trust:3},lesson:["Malicious attachments","Files like fake invoices can install malware when opened. Filters can test attachments before they reach people."]};
   const opened=chance((100-S.training)/100*.8);
   if(!opened) return {text:"An “overdue invoice” attachment reached the business office."+(f.note||"")+" The bookkeeper didn’t recognize the vendor and reported it instead of opening it.",fx:{trust:3},lesson:["Malicious attachments","Files like fake invoices can install malware when opened. Unexpected attachments are worth a second look."]};
   const caught=S.patch>=60;
   if(!caught&&sys.edrCatch()){L.set(...sys.notes.edr);return {text:"The bookkeeper opened an “overdue invoice” attachment."+(f.note||"")+" The malware tried to run, but endpoint protection blocked it and quarantined the file.",fx:{trust:-1},lesson:sys.notes.edr};}
   if(!caught&&sys.mdrCatch()){L.set(...sys.notes.mdr);return {text:"The bookkeeper opened an “overdue invoice” attachment."+(f.note||"")+" Malware started copying files, but your MDR provider spotted it within minutes and cut the laptop off the network.",fx:{trust:-3,morale:-3},lesson:sys.notes.mdr};}
   return {text:"The bookkeeper opened an “overdue invoice” attachment."+(f.note||"")+(caught?" It tried to exploit an old bug, but her laptop was up to date, so it failed.":" It installed malware that started copying files from the business office share."),fx:caught?{trust:-2}:{trust:-14,morale:-8},lesson:["Malicious attachments","Files like fake invoices can install malware when opened. Layers help: filters, training and patching each catch different things."]};
 }},
 {id:"ghost",title:"A login from a teacher who retired",run(){
   if(S.stale<=2) return {text:"Someone tried to sign in to the account of Mr. Lindqvist, who retired in June. You’d already disabled it during your account cleanup, so the attempt went nowhere.",fx:{trust:3},lesson:["Account offboarding","When people leave, their accounts should be shut off. Unused accounts are easy targets because nobody notices strange activity."]};
   if(sys.mdrCatch()){L.set(...sys.notes.mdr);return {text:"An attacker logged into the account of Mr. Lindqvist, who retired in June. Your MDR provider noticed a dormant account suddenly active at 3 a.m. and locked it within the hour.",fx:{trust:-3},lesson:["Account offboarding","When people leave, their accounts should be shut off. Detection helped here, but cleanup would have stopped it outright."]};}
   return {text:`An attacker logged into the account of Mr. Lindqvist, who retired in June. It was one of ${S.stale} old accounts still active. Nobody noticed for three weeks because nobody was using it.`,fx:{trust:-12,morale:-6},lesson:["Account offboarding","When people leave, their accounts should be shut off. Unused accounts are easy targets because nobody notices strange activity."]};
 }},
 {id:"firstweek",deck:false,title:"A call to the help desk",intro:"It’s your first week. A stressed caller says she’s Mrs. Alvarez, a third-grade teacher, locked out right before class. She asks you to reset her password and read the new one to her over the phone.",choices:[
   {label:"Call her back at the directory number",run(){return {text:"The number in the staff directory rang her classroom. The real Mrs. Alvarez had no idea what you were talking about. Whoever called you was trying to get into her account.",fx:{trust:5},lesson:["Verify through another channel","When someone asks for access over the phone, hang up and call back on a number you already trust. Real people don’t mind. Scammers disappear."]}}},
   {label:"Reset it now, she sounds stressed",run(){return {text:"You read the new password aloud. An hour later the real Mrs. Alvarez called, locked out again, because someone had already changed it and emailed her class’s parents. You caught it quickly, but it was embarrassing.",fx:{trust:-6,morale:-4},lesson:["Verify through another channel","When someone asks for access over the phone, hang up and call back on a number you already trust. Real people don’t mind. Scammers disappear."]}}}
 ]},
 {id:"qr",title:"New lunch payment posters",run(){
   const fooled=chance((100-S.training)/100*.75);
   if(!fooled) return {text:"Someone stuck QR-code stickers over the real ones on the cafeteria payment posters. A parent noticed the page asked for her card number twice and called the office. You pulled the stickers by lunch.",fx:{trust:3},lesson:["QR code scams","A QR code hides where it goes. Check the web address that appears before you enter anything, especially payment details."]};
   return {text:"Fake QR stickers on the cafeteria posters sent 30 parents to a look-alike payment page. Their card numbers were stolen before anyone noticed.",fx:{trust:-12,morale:-5},lesson:["QR code scams","A QR code hides where it goes. Check the web address that appears before you enter anything, especially payment details."]};
 }},
 {id:"deepfake",title:"The superintendent calls the business office",run(){
   if(S.irPlan) return {text:"The business manager got a call in the superintendent’s exact voice asking to wire $18,000 to a new bus company. Your incident plan says payment changes need a callback, so she called the superintendent’s cell. He was at a football game and had made no such call.",fx:{trust:4},lesson:["Voice deepfakes","AI can copy a voice from a few seconds of audio. Rules that require a callback for money requests work no matter how real the voice sounds."]};
   const fooled=chance((100-S.training)/100*.7+.1);
   if(!fooled) return {text:"A call in the superintendent’s voice asked the business office to wire $18,000 to a new bus company. Something felt off, so the business manager hung up and called him directly. It was a fake.",fx:{trust:3},lesson:["Voice deepfakes","AI can copy a voice from a few seconds of audio. Calling back on a known number beats trusting what you hear."]};
   return {text:"A call in the superintendent’s exact voice convinced the business office to wire $18,000 to a “new bus company.” The real superintendent had never called. The money is gone.",fx:{trust:-12,budget:-1500,morale:-6},lesson:["Voice deepfakes","AI can copy a voice from a few seconds of audio. Rules that require a callback for money requests stop this, however real the voice sounds."]};
 }},
 {id:"smartboards",title:"New smart boards arrive",choices:[
   {label:"Change the default passwords now",run(){return {text:"You spent two long evenings logging into 60 smart boards and changing the default admin password on each one. Tedious, but done.",fx:{morale:-8,trust:2},lesson:["Default passwords","Devices often ship with the same admin password on every unit, and those passwords are published online. Change them before the device goes live."]}}},
   {label:"Do it over the summer",run(){
     if(chance(.6)) return {text:"During the spring assembly, someone logged into the gym’s smart board with its factory password and displayed memes for 20 minutes in front of the whole school.",fx:{trust:-10,morale:-4},lesson:["Default passwords","Devices often ship with the same admin password on every unit, and those passwords are published online. Change them before the device goes live."]};
     return {text:"Nothing happened this time. You’re still not sure whether that was good planning or good luck.",fx:{},lesson:["Default passwords","Devices often ship with the same admin password on every unit, and those passwords are published online. Waiting is a gamble."]};
   }}
 ],intro:"Sixty new smart boards are installed in classrooms. Each one has the same factory admin password, and it’s printed in the manual that’s posted online."},
 {id:"studentbug",title:"A student finds a hole",choices:[
   {label:"Thank her and fix it",run(){S.patch=clamp(S.patch+10);return {text:"You fixed the bug, thanked her publicly, and invited her to help test the new portal. Two more students reported issues that spring instead of exploiting them.",fx:{trust:6},lesson:["Responsible disclosure","When people report security problems safely, thank them and fix it. Punishing reporters teaches everyone to stay quiet."]}}},
   {label:"Suspend her for hacking",run(){return {text:"She was suspended. The story spread, parents were split, and nobody reported a problem to IT for the rest of the year.",fx:{trust:-8,morale:-3},lesson:["Responsible disclosure","When people report security problems safely, thank them and fix it. Punishing reporters teaches everyone to stay quiet."]}}}
 ],intro:"A tenth-grader emails you: she noticed she could see other students’ grades by changing one number in the portal’s web address. She didn’t change anything, and she’s nervous about telling you."},
 {id:"publicdrive",title:"A shared folder, shared too widely",run(){
   if(S.training>=50) return {text:"A special-education teacher noticed a warning that her folder of student plans was set to “anyone with the link.” Thanks to training, she knew what it meant and fixed it herself.",fx:{trust:3},lesson:["Sharing settings","“Anyone with the link” means anyone. Sensitive files should be shared only with specific people."]};
   return {text:"A folder of student learning plans had been set to “anyone with the link” for months. A parent found it through a search engine.",fx:{trust:-12,morale:-5},lesson:["Sharing settings","“Anyone with the link” means anyone. Sensitive files should be shared only with specific people."]};
 }},
 {id:"extension",title:"A free AI homework helper",run(){
   if(S.edr!==null&&S.edr>=50) return {text:"A dozen teachers installed a free “AI grading assistant” browser extension. Endpoint protection flagged it for sending every page they viewed to an unknown server, and you removed it district-wide.",fx:{trust:2},lesson:["Browser extensions","Extensions can often read everything on every page you visit. Free ones sometimes make money by collecting that data."]};
   if(S.inventory>=50) return {text:"Your device inventory showed a new browser extension spreading across teacher laptops. You checked it: it was sending every page they viewed to an unknown server. You removed it before much leaked.",fx:{trust:1},lesson:["Browser extensions","Extensions can often read everything on every page you visit. Free ones sometimes make money by collecting that data."]};
   return {text:"A free “AI grading assistant” extension spread through the staff. It quietly sent every page teachers viewed, including the gradebook, to an unknown server for months.",fx:{trust:-9,morale:-4},lesson:["Browser extensions","Extensions can often read everything on every page you visit. Free ones sometimes make money by collecting that data."]};
 }},
 {id:"flood",title:"A pipe bursts above the server room",run(){
   if(S.backupTested&&S.backupAge<=2) return {text:"Water poured onto two servers overnight. Annoying, but your backups were recent and tested, so you had everything running on spare hardware by noon.",fx:{morale:-5},lesson:["Availability","Security isn’t only about attackers. Keeping systems running through floods, fires and outages matters too, and backups are how you do it."]};
   return {text:"Water poured onto two servers overnight. The backups hadn’t been tested, and the newest working copy was from last spring. The cafeteria and library systems lost months of records.",fx:{trust:-10,morale:-8,budget:-1500},lesson:["Availability","Security isn’t only about attackers. Keeping systems running through floods, fires and outages matters too, and backups are how you do it."]};
 }},
 {id:"eviltwin",title:"Free Wi-Fi at the football game",run(){
   const fooled=chance((100-S.training)/100*.7);
   if(!fooled) return {text:"Someone set up a hotspot called “MapleValley-Guest” at the stadium. Staff who’d been through training noticed the real network has a different name and stayed off it.",fx:{trust:2},lesson:["Evil twin Wi-Fi","Attackers create hotspots with convincing names to capture what you type. Use known networks, and be wary of any sign-in page that asks for your school password."]};
   if(S.mfa) return {text:"A fake “MapleValley-Guest” hotspot at the stadium captured several staff passwords. Multi-factor login kept the attackers out of the accounts.",fx:{trust:-2},lesson:["Evil twin Wi-Fi","Attackers create hotspots with convincing names to capture what you type. Multi-factor login limits the damage."]};
   return {text:"A fake “MapleValley-Guest” hotspot at the stadium captured several staff passwords. Two accounts were used to send scam emails the next morning.",fx:{trust:-10,morale:-4},lesson:["Evil twin Wi-Fi","Attackers create hotspots with convincing names to capture what you type. Use known networks, and be wary of any sign-in page that asks for your school password."]};
 }},
 {id:"stickynote",title:"The password under the keyboard",choices:[
   {label:"Buy a password manager ($800)",run(){S.budget-=800;S.training=clamp(S.training+5);return {text:"You set up a district password manager and moved the shared passwords into it. The office staff were relieved: fewer things to remember.",fx:{trust:4,morale:-3},lesson:["Password managers","People write passwords down because they have too many to remember. A password manager fixes the real problem."]}}},
   {label:"Send a stern reminder email",run(){
     if(chance(.5)) return {text:"The sticky note disappeared for two weeks, then came back. A visiting contractor photographed it.",fx:{trust:-7},lesson:["Password managers","People write passwords down because they have too many to remember. Reminders don’t fix that. A password manager does."]};
     return {text:"The note disappeared. For now.",fx:{},lesson:["Password managers","People write passwords down because they have too many to remember. Reminders rarely fix that. A password manager does."]};
   }}
 ],intro:"While fixing a printer, you find the admin password for the student records system on a sticky note under the front-office keyboard."},
 {id:"quiet",title:"A quiet month",run(){return {text:"Nothing broke. Nobody clicked anything. You almost don’t trust it.",fx:{morale:5},lesson:["Invisible wins","When security works, nothing happens, which makes it hard to notice. That’s normal."]}}}
];
})();
