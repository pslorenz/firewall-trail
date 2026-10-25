/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Student mode minigame content: which months they run, and their data. */
(function () {
/* ---------- Phishing minigame ---------- */
const EMAILS=[
 {name:"IT Help Desk",addr:"helpdesk@mapIevalley-schools.co",subj:"Password expires in 2 hours",body:"Your password expires today. {link} or lose access to all your files.",link:{text:"Keep my password",url:"mapIevalley-schools.co/verify-account"},phish:true,clue:"The name says IT Help Desk, but anyone can type any name. The address uses “mapIevalley” with a capital I and ends in .co. The link goes to the same fake site."},
 {name:"Anita Patel",addr:"apatel@maplevalley-schools.org",subj:"Field trip permission slips",body:"Attached is the list of students still missing slips for Friday’s museum trip. Can you print a few extra?",phish:false,clue:"Real district address, an ordinary request, no link and no pressure. Legit."},
 {name:"Dr. Holloway (Superintendent)",addr:"supt.maplevalley@gmail.com",subj:"Quick favor, are you at your desk?",body:"I need you to handle something confidential right away. Don’t call, I’m in meetings all afternoon.",phish:true,clue:"No link at all, so the sender address is the only technical clue: a personal Gmail, not the district domain. Urgency, secrecy and “don’t call” are the other giveaways."},
 {name:"Google Classroom",addr:"no-reply@classroom.google.com",subj:"New assignment: Chapter 4 review",body:"Mr. Diaz posted a new assignment in Biology 2. {link}",link:{text:"Open assignment",url:"classroom.google.com/c/NjQ2/a/review"},phish:false,clue:"Real Google address, and the link goes to classroom.google.com. A routine notification. Legit."},
 {name:"DocuSign",addr:"docs@secure-docusign-verify.net",subj:"You have 1 document to sign",body:"A contract is waiting for your signature. {link} using your school email and password.",link:{text:"Review document",url:"secure-docusign-verify.net/login"},phish:true,clue:"“secure” and “verify” are words scammers love to add. DocuSign’s real domain is docusign.net, and it never asks for your school password."},
 {name:"Maple Valley PTA",addr:"pta@maplevalley-schools.org",subj:"Bake sale volunteers needed",body:"Sign up on the sheet in the front office if you can help on Saturday. Thank you!",phish:false,clue:"District address, and it asks you to do something in person, not click or log in. Legit."},
 {name:"Amazon",addr:"order-update@amaz0n-support.com",subj:"Your order of 30 iPads has shipped",body:"Didn’t place this order? {link} immediately to cancel and get a refund.",link:{text:"Contact refunds",url:"amaz0n-support.com/refund-center"},phish:true,clue:"“amaz0n” uses a zero. The scary surprise order is designed to make you panic and click before you think."},
 {name:"James Diaz",addr:"jdiaz@maplevalley-schools.org",subj:"Shared file: Updated salary schedule",body:"Hi all, sharing the updated salary schedule before it goes to the board. {link}",link:{text:"Open in OneDrive",url:"onedrive-share.mv-files-secure.com/s/salary"},phish:true,clue:"Tricky one. The sender address is real because Mr. Diaz’s account was hacked. The link gives it away: it goes to a strange domain, and the district uses Google, not OneDrive. A real address doesn’t guarantee a safe email."},
 {name:"Maple Valley Payroll",addr:"payroll@maplevalley-schools.org",subj:"Your October pay stub is ready",body:"Your pay stub is available in the staff portal. {link}",link:{text:"View pay stub",url:"maplevalley-schools.org/hr/paystubs"},phish:false,clue:"Both the sender and the link use the real district domain, and payroll sends this every month. Legit. (If you’re ever unsure, go to the portal yourself instead of clicking.)"},
 {name:"Coach Brooks",addr:"tbrooks@maplevalley-schools.org",subj:"Gym schedule change",body:"Basketball practice moves to the auxiliary gym next week.",phish:false,clue:"Internal sender, ordinary information, no links or requests. Legit."}
];

/* ---------- Fake login minigame ---------- */
const LOGINS=[
 {url:"login.maplevalley-schools.org",secure:true,title:"Maple Valley Schools",sub:"Staff and student sign-in",fields:["School email","Password"],fake:false,clue:"The real district domain is maplevalley-schools.org, and here it sits right before the first slash. Safe."},
 {url:"maplevalley-schools.login-portal.net",secure:true,title:"Maple Valley Schools",sub:"Staff sign-in",fields:["School email","Password"],fake:true,clue:"Read the domain from the right: the real site here is login-portal.net. “maplevalley-schools” is just a label the attacker stuck in front."},
 {url:"maplevalley-schoo1s.org/signin",secure:true,title:"Maple Valley Schools",sub:"Your session expired. Sign in again.",fields:["School email","Password"],fake:true,clue:"“schoo1s” uses the number 1 instead of an l. And notice the padlock: fake sites get padlocks too. It only means the connection is encrypted, not that the site is honest."},
 {url:"accounts.google.com/signin",secure:true,title:"Sign in with Google",sub:"to continue to Maple Valley Classroom",fields:["Email or phone"],fake:false,clue:"accounts.google.com is Google’s real sign-in page, and the district uses Google for classes. Safe."},
 {url:"docs.google.com/forms/d/1xQ…/viewform",secure:true,title:"Staff Password Verification",sub:"IT requires all staff to confirm credentials by Friday.",fields:["School email","Current password"],fake:true,clue:"It’s a real Google domain, but anyone can make a Google Form. IT will never ask you to type your password into a form."},
 {url:"maplevalley-schools.org.account-verify.co",secure:false,title:"Maple Valley Schools",sub:"Verify your account to avoid suspension",fields:["School email","Password","Phone PIN"],fake:true,clue:"The actual domain is account-verify.co at the very end. Plus “Not secure,” a threat about suspension, and a request for an extra PIN."},
 {url:"maplevalley-schools.org/library/login",secure:true,title:"Maple Valley Library",sub:"Sign in to renew your books",fields:["Student ID","Password"],fake:false,clue:"Still the real district domain. The part after the slash is just a page on that site. Safe."},
 {url:"http://192.168.44.17/maplevalley",secure:false,title:"Maple Valley Schools",sub:"Wi-Fi access: sign in to continue",fields:["School email","Password"],fake:true,clue:"A bare number instead of a name, no encryption, and a “Wi-Fi login” asking for your school password. That’s a classic fake hotspot trick."}
];

/* ---------- Password minigame ---------- */
const PASSWORDS=[
 {q:"A teacher needs a new school password. Which is strongest?",opts:["Summer2026!","Maple#Valley1","copper-violin-harbor-mitten"],ans:2,why:"Long, random words beat short passwords stuffed with symbols. “Summer2026!” meets most complexity rules, but it’s one of the first things attackers try."},
 {q:"Which password would be easiest for an attacker to guess?",opts:["Mustang1987","k7#Qm2!vXp","river-tulip-ember-glass"],ans:0,why:"Coach Brooks posts photos of his 1987 Mustang online. Personal details like pets, cars and birthdays are the first things attackers guess."},
 {q:"Which is the safest choice for the gradebook login?",opts:["A strong passphrase you also use for Netflix","A strong, unique passphrase saved in a password manager","Your school password with a 2 added at the end"],ans:1,why:"Reuse is the real danger. If Netflix leaks, attackers try that password everywhere. A password manager makes unique passwords painless."},
 {q:"Which is strongest?",opts:["Hunter2Hunter2Hunter2","Tr0ub4dor&3","lantern-fossil-quiet-mango-drum"],ans:2,why:"Repeating a short pattern adds little, and swapping letters for numbers is a trick guessing tools already know. Five random words is long and unpredictable."},
 {q:"Which login is best protected?",opts:["A 20-character passphrase","An 8-character password plus a code from a phone app","A 12-character password changed every month"],ans:1,why:"A long passphrase is good, but multi-factor login protects you even after a password leaks. Forced monthly changes mostly lead to Password1, Password2, Password3."},
 {q:"Which is the best passphrase?",opts:["maplevalleyschools","to-be-or-not-to-be","waffle-glacier-pencil-orbit"],ans:2,why:"Famous quotes and your organization’s name are on attackers’ guessing lists. Passphrase words should be random, not meaningful."},
 {q:"Which of these is safe to share with the IT help desk when you call?",opts:["Your password, so they can test your login","The code from your multi-factor app","Your username and what’s going wrong"],ans:2,why:"Real IT staff never need your password or your login codes. Anyone asking for them, even someone who sounds official, is running a scam."},
 {q:"A site says your password was in a data breach. What should you do first?",opts:["Change it on that site and anywhere else you used it","Wait to see if anything bad happens","Add an exclamation point to the end"],ans:0,why:"Attackers try leaked passwords on other sites within hours. Change it everywhere you reused it, then stop reusing it."}
];


  FT.modes.student.minigames = {
    // month index → minigame (0 = September)
    schedule: { 1: "inbox", 7: "inbox", 3: "login", 9: "login", 5: "password", 10: "password" },
    inbox: {
      data: EMAILS,
      intro: "Ms. Reyes forwarded you some emails staff reported. Phish or legit?",
      good: "You used this as a mini lesson for the staff meeting. Awareness went up.",
      bad: "Tricky ones. Ms. Reyes walked you through the clues, and you shared them with staff.",
      lesson: ["Spotting phishing", "The name on an email can say anything. Tap it to see the real address, check where links actually go, and remember a real address can still come from a hacked account."]
    },
    login: {
      data: LOGINS,
      intro: "Staff sent you links that asked them to sign in. Check each page before anyone types a password.",
      crest: l => l.title.startsWith("Sign in with Google") ? "G" : "MV",
      good: "You turned these into a one-page “check the address” guide for staff. People started using it.",
      bad: "Ms. Reyes went over the tricks with you, and you sent staff a reminder to check addresses before signing in.",
      lesson: ["Fake login pages", "Read the web address right before the first slash. A padlock only means the connection is encrypted, and a familiar name elsewhere in the address can be a disguise."]
    },
    password: {
      data: PASSWORDS,
      intro: "Staff keep asking you about passwords. Answer their questions.",
      good: "You turned your answers into a one-page password guide for the staff lounge.",
      bad: "Ms. Reyes helped you sort out the tricky ones, and you shared the answers at the next staff meeting.",
      lesson: ["Strong passwords", "Length and randomness beat clever symbols. Never reuse passwords, avoid personal details, and use a password manager plus multi-factor login."]
    }
  };
})();
