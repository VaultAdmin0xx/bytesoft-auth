// routes/byte-hinglish.js — Hinglish brain for Byte (no paid API, no AI key).
//
// What it adds on top of byte-routes.js:
//   1. Spelling-tolerant word matching ("kitni / kitnii / kitne", "chutti / chhuti / chuttiyan"...)
//   2. Word-order-free intents  ("meri kitni leaves bachi hai" = "leave kitni bachi hai")
//   3. Real actions in Hinglish (delete / change status / reschedule) using the user's own titles
//   4. Natural small talk (mood, jokes, time, motivation, bye ...) in Hinglish + English
//   5. Smart "I didn't understand" replies + a log of unknown phrases so you can teach Byte more
//
// HOW TO TEACH BYTE MORE (the easy way):
//   - New words for the same meaning  -> add them to the word lists in the "WORD LISTS" section.
//   - New chit-chat                   -> add a line to the SMALL_TALK list at the bottom.
//   - See what users typed that Byte did not understand -> open byte-unknown.log

'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Spelling tolerance: "skeleton" of a word = lowercase, no 'h', repeated letters collapsed.
//   kitni / kitnii / kitnni  -> kitni      chutti / chhuti -> cuti      dikhao / dikhaao / dikao -> dikao
// Both the user's words and our word lists go through this, so spelling variants match.
// ---------------------------------------------------------------------------
const sk = w => String(w).replace(/h/g, '').replace(/(.)\1+/g, '$1');
const S = (...words) => new Set(words.map(sk));
const toks = n => String(n).split(' ').filter(Boolean).map(sk);

// ---------------------------------------------------------------------------
// WORD LISTS  (add more words here any time)
// ---------------------------------------------------------------------------
const LEAVE   = S('leave', 'leaves', 'chutti', 'chuttiyan', 'holiday', 'holidays', 'pto');
const QTY     = S('kitni', 'kitne', 'kitna', 'bachi', 'bache', 'bacha', 'baki', 'baaki', 'remaining', 'left', 'balance', 'quota', 'available', 'bachhi');
const APPLY   = S('apply', 'lagao', 'laga', 'lena', 'leni', 'lene', 'chahiye', 'book', 'request', 'maangna', 'mangna', 'lunga', 'lungi');
const PROJECT = S('project', 'projects', 'prject', 'prjct');
const MEETING = S('meeting', 'meetings', 'meet', 'mitting', 'miting', 'mtg');
const COUNT   = S('kitne', 'kitni', 'kitna', 'count', 'total', 'ginti', 'many', 'number', 'kul');
const ADD     = S('add', 'create', 'naya', 'nayi', 'banao', 'bana', 'jodo', 'jod', 'jodna', 'new');
const DEL     = S('delete', 'remove', 'hatao', 'hata', 'mita', 'mitao', 'cancel', 'nikalo', 'nikal', 'htao');
const CHANGE  = S('change', 'update', 'rename', 'edit', 'badlo', 'badal', 'badalna', 'reschedule', 'shift', 'move', 'postpone', 'prepone');
const OPENV   = S('kholo', 'khol', 'open', 'jao', 'chalo', 'kholiye', 'kholna', 'dikhao', 'dikha', 'dekho', 'dekhna', 'show', 'view');
const FAQ     = S('faq', 'faqs', 'sawal', 'sawaal', 'questions');
const SUPPORT = S('support', 'helpdesk');
const NOTIF   = S('notification', 'notifications', 'alert', 'alerts', 'suchna', 'soochna');
const PROFILE = S('profile', 'profil');
const HOME    = S('dashboard', 'home');
const SHOWQ   = S('dikhao', 'dikha', 'dikhado', 'dikhaiye', 'batao', 'bata', 'bataiye', 'btao', 'dekho', 'dekhna', 'show', 'list', 'view', 'kab', 'schedule', 'kaun', 'kya', 'konse', 'kaunse');

const STATUS_WORDS = [
  [/\b(?:not started|shuru nahi|start nahi|abhi shuru nahi)\b/, 'not started'],
  [/\b(?:in progress|progress|chalu|chal raha|chal rha)\b/, 'in progress'],
  [/\breview\b/, 'review'],
  [/\b(?:done|complete|completed|finish|finished|khatam|pura|puri|ho gay[ae]|ho gya|hogaya)\b/, 'done']
];
const CHANGE_VERB_RE = /\b(?:daalo|dalo|daal do|dal do|kar do|kardo|karo|kr do|badlo|badal|mark|set|move|shift|rakho|rakh do|bana do|banao|update|change|ho gay[ae]|ho gya|hogaya)\b/;
const DAY_RE = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|kal|aaj|parso|today|tomorrow)\b/;

// Words that mean "the user writes Hinglish" (so Byte answers in Hinglish too).
const HINGLISH_WORDS = new Set((
  'hai hain kya kaise kaisa kese kaisi karo kar kro kardo mera meri mere mujhe mujhko mai hun hoon hu tum aap aapka aapki ' +
  'tumhara tera tere teri nahi nhi haan han kaun kab kahan kyun kyu madad bhi aur ko ka ki ke se mein pe par liye sakte sakta ' +
  'sakti dikhao dikha batao bata kholo chahiye kitne kitni kitna naya nayi hatao chutti chhutti shukriya dhanyavad namaste ' +
  'accha achha acha theek thik badhiya mast bachi bache abhi aaj kal wala wali naam jodo banao yaar bhai apna apni lagao lena ' +
  'raha rahi rahe gaya gayi hua hui tha thi kuch sab sabhi bahut bohot zyada thoda bilkul sirf toh bekar faltu mazaak udaas ' +
  'pareshan thak bore sunao mausam barish subah shaam raat dopahar kitna baje samay tarikh din'
).split(' '));

function looksHinglish(n) {
  return String(n).split(' ').some(w => HINGLISH_WORDS.has(w));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const normTitle = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const titleOf = it => String((it && (it.title || it.name)) || '');
const statusOf = it => String((it && (it.details || it.status)) || '').trim();
const timeOf = it => String((it && (it.time || it.date)) || '').trim();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Find the item whose title appears in the user's sentence (longest title wins).
function findByTitle(items, n) {
  const hay = ' ' + n + ' ';
  let best = null;
  for (const it of items || []) {
    const title = normTitle(titleOf(it));
    if (title.length >= 3 && hay.includes(' ' + title + ' ')) {
      if (!best || title.length > best.len) best = { item: it, title, len: title.length };
    }
  }
  return best;
}

function fmtTime(rest) {
  let s = ' ' + rest + ' ';
  s = s.replace(/\b(subah|savere)\s+(\d{1,2})(?:\s(\d{2}))?\s*(?:baje)?\b/g, (m, p, h, mi) => ` ${h}:${mi || '00'} AM `);
  s = s.replace(/\b(dopahar|shaam|sham|raat)\s+(\d{1,2})(?:\s(\d{2}))?\s*(?:baje)?\b/g, (m, p, h, mi) => ` ${h}:${mi || '00'} PM `);
  s = s.replace(/\b(\d{1,2})\s(\d{2})\s*(am|pm)\b/g, '$1:$2 $3');
  s = s.replace(/\b(\d{1,2})\s*(am|pm)\b/g, '$1 $2');
  s = s.replace(/\bbaje\b/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s.split(' ').map(w => /^(am|pm)$/.test(w) ? w.toUpperCase() : (/^\d/.test(w) ? w : cap(w))).join(' ');
}

const FILLER_RE = /\b(?:meeting|meetings|ko|ka|ki|ke|time|ab|pe|par|per|se|mein|me|shift|move|reschedule|badlo|badal|badalna|do|kar|karo|kardo|kr|rakho|rakh|postpone|prepone|change|update|please|plz|kindly|byte|bhai|yaar|to|hai|hain|set|daalo|dalo|daal|dal)\b/g;

// ---------------------------------------------------------------------------
// ACTIONS in Hinglish (delete / change status / reschedule) — uses the user's real titles
// Returns { action, payload, replyEn, replyHi } or null
// ---------------------------------------------------------------------------
function action(n, data) {
  const t = toks(n);
  const any = set => t.some(w => set.has(w));
  let proj = findByTitle(data.projects, n);
  let meet = findByTitle(data.meetings, n);
  if (!proj && !meet) return null;

  const hasM = any(MEETING), hasP = any(PROJECT);
  if (proj && meet) {
    if (hasM && !hasP) proj = null;
    else if (hasP && !hasM) meet = null;
    else return null; // ambiguous -> let the normal rules ask
  }

  // 1) delete
  if (any(DEL)) {
    if (proj) {
      const title = titleOf(proj.item);
      return { action: 'delete_project', payload: { title },
        replyEn: `Please confirm the removal of "${title}".`, replyHi: `Please "${title}" ko hatane ki confirmation dijiye.` };
    }
    const title = titleOf(meet.item);
    return { action: 'delete_meeting', payload: { title },
      replyEn: `Please confirm the removal of "${title}".`, replyHi: `Please "${title}" ko hatane ki confirmation dijiye.` };
  }

  // 2) change project status ("website redesign ko review mein daalo", "mobile app beta done kar do")
  if (proj && !hasM && CHANGE_VERB_RE.test(n)) {
    const found = STATUS_WORDS.find(([re]) => re.test(n.replace(proj.title, ' ')));
    if (found) {
      const title = titleOf(proj.item), status = found[1];
      return { action: 'update_project', payload: { oldTitle: title, title, details: status },
        replyEn: `Done! "${title}" is now marked as ${status}.`,
        replyHi: `Ho gaya! "${title}" ab "${status}" mein hai.` };
    }
  }

  // 3) reschedule meeting ("team standup ko friday 3 pm pe shift karo")
  if (meet && !hasP && (any(CHANGE) || CHANGE_VERB_RE.test(n))) {
    const rest = n.replace(meet.title, ' ').replace(FILLER_RE, ' ').replace(/\s+/g, ' ').trim();
    if (rest && (/\d/.test(rest) || DAY_RE.test(rest))) {
      const time = fmtTime(rest), title = titleOf(meet.item);
      return { action: 'update_meeting', payload: { oldTitle: title, time },
        replyEn: `Done! "${title}" is moved to ${time}.`, replyHi: `Ho gaya! "${title}" ab ${time} par hai.` };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Questions about ONE item ("client review kab hai", "website redesign ka status")
// ---------------------------------------------------------------------------
function answerAbout(n, data, hi) {
  const t = toks(n);
  const any = set => t.some(w => set.has(w));
  if (any(ADD) || any(DEL) || any(CHANGE)) return null;
  const meet = findByTitle(data.meetings, n);
  const proj = findByTitle(data.projects, n);
  if (meet && proj) return null;

  if (meet && /\b(?:kab|when|time|timing|kitne baje|schedule|samay|kis din|kaunse din)\b/.test(n)) {
    const title = titleOf(meet.item), time = timeOf(meet.item);
    if (!time) return hi ? `"${title}" ka abhi koi time set nahi hai.` : `No time is set for "${title}" yet.`;
    return hi ? `"${title}" ${time} ko hai. 🗓️` : `"${title}" is scheduled for ${time}. 🗓️`;
  }
  if (proj && /\b(?:status|kaisa|kaise|kahan tak|progress|stage|chal raha|kya hai|kya haal|how is|update)\b/.test(n)) {
    const title = titleOf(proj.item), st = statusOf(proj.item);
    if (!st) return hi ? `"${title}" ka abhi koi status set nahi hai.` : `"${title}" has no status yet.`;
    return hi ? `"${title}" abhi "${st}" mein hai.` : `"${title}" is currently "${st}".`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// REWRITE: turn flexible Hinglish into the simple English phrase byte-routes.js already understands.
// Returns a string or null (null = leave it to the old rules).
// ---------------------------------------------------------------------------
function rewrite(n) {
  const t = toks(n);
  const any = set => t.some(w => set.has(w));
  const isLeave = any(LEAVE), isProj = any(PROJECT), isMeet = any(MEETING);
  const doing = any(ADD) || any(DEL) || any(CHANGE);

  // ---- add with the title written after the verb: "project add karo Employee Portal" ----
  let m = n.match(/^(?:ek\s+)?(?:naya\s+|nayi\s+)?(project|meeting)\s+(?:add|create|banao|bana do|jodo|jod do)\s*(?:karo|kardo|kar do|kijiye)?\s*(?:ka naam|ke naam|naam|named)?\s*(.*)$/);
  if (m) return ('add ' + m[1] + ' ' + m[2]).trim();
  // "Employee Portal project add karo" / "Client Call meeting banao"
  m = n.match(/^(.+?)\s+(project|meeting)\s+(?:add|create|banao|bana do|jodo|jod do)(?:\s+(?:karo|kardo|kar do|kijiye))?$/);
  if (m && !/^(?:ek|naya|nayi|ek naya|ek nayi|mera|meri|mere|apna|apni|ye|yeh)$/.test(m[1])) return 'add ' + m[2] + ' ' + m[1];

  // ---- leave ----
  if (isLeave) {
    const taken = /\b(?:li|le li|liya|liye hain|use ki|use kar li|kharch|taken|le chuka|le chuki|le chuke|lagayi|lagai)\b/.test(n);
    const statusish = /\b(?:pending|approved|approve|reject|rejected|status|history|requests|manzoor|kya hua|hua kya)\b/.test(n);
    const applyStrong = /\b(?:lagao|laga do|lena|leni|lene|chahiye|apply|book|maangna|mangna|lunga|lungi)\b/.test(n);
    if (any(QTY) && taken) return 'leave taken';
    if (statusish && !applyStrong) return 'leave requests';
    if (any(QTY) && !/\bkitne baje\b/.test(n)) return 'leave balance';
    if (applyStrong || /\brequest\b/.test(n)) return 'apply for leave';
    return null;
  }

  // ---- projects / meetings (questions, counts, lists) ----
  if (!doing && (isProj || isMeet)) {
    // "kaun sa project review mein hai" / "kaunse projects progress mein hain"
    if (/\breview\b/.test(n)) return 'which project is in review';
    if (/\b(?:in progress|progress|chalu|chal raha)\b/.test(n)) return 'which project is in progress';
    if (/\b(?:not started|shuru nahi)\b/.test(n)) return 'projects not started';
    if (/\b(?:done|completed)\b/.test(n)) return null;
    const parts = [];
    if (any(COUNT)) {
      if (isProj) parts.push('how many projects');
      if (isMeet) parts.push('how many meetings');
    } else {
      if (isProj) parts.push('show my projects');
      if (isMeet) parts.push('show my meetings');
    }
    return parts.join(' ');
  }

  // ---- navigation ----
  if (any(OPENV) || any(SHOWQ)) {
    if (any(FAQ)) return 'open faq';
    if (any(SUPPORT)) return 'open support';
    if (any(NOTIF)) return 'open notifications';
    if (any(PROFILE) && !/\b(?:email|phone|number|role|location|naam|name)\b/.test(n)) return 'open profile';
    if (any(HOME)) return 'open dashboard';
  }
  if (any(FAQ) && n.split(' ').length <= 3) return 'open faq';
  if (any(NOTIF) && n.split(' ').length <= 3) return 'open notifications';

  // ---- profile questions: "mera phone number kya hai", "meri job kya hai", "mere baare mein batao" ----
  if (/\b(?:mera|meri|mere)\s+(?:phone|mobile|contact)(?:\s+number)?\b/.test(n)) return 'my phone';
  if (/\b(?:mera|meri)\s+(?:role|job|kaam|position|post|designation)\b/.test(n)) return 'my role';
  if (/\b(?:main|mai|mein)\s+kahan\s+(?:rehta|rehti|rahta|rahti)\b|\bmera\s+(?:location|shehar|city|sheher)\b/.test(n)) return 'my location';
  if (/\bmere baare mein\b|\bmere bare mein\b/.test(n)) return 'about me';
  if (/\bmera\s+email\b|\bmeri\s+email\b|\bmera\s+mail\b/.test(n)) return 'my email';
  return null;
}

// ---------------------------------------------------------------------------
// SMALL TALK — Byte talks like a friendly colleague
// ---------------------------------------------------------------------------
const nowIST = () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

const JOKES_HI = [
  'Programmer se pucha: "Dinner mein kya khaoge?" Bola: "Bug aur chai." ☕🐛',
  'Boss: "Kal tak ready hona chahiye." Developer: "Kal kab? Kal toh hamesha kal hi rehta hai!" 😆',
  'Computer ko thand kyun lagti hai? Kyunki uski Windows khuli rehti hai! 🪟😂',
  'Meeting ka sabse accha hissa kaunsa hota hai? Jab woh khatam hoti hai! 😅',
  'Teacher: "Code kaise likhte ho?" Student: "Copy, paste aur dua karke!" 🙏💻',
  'Kal raat ko code chala gaya... aaj subah chal bhi gaya. Pata nahi kaise, par touch mat karo! 😄'
];
const JOKES_EN = [
  'Why do programmers prefer dark mode? Because light attracts bugs. 🐛',
  'Why did the developer go broke? He used up all his cache. 💸',
  'There are 10 kinds of people: those who understand binary and those who don\'t. 😄',
  'A SQL query walks into a bar, walks up to two tables and asks: "Can I join you?" 🍻'
];
const MOTIVATION_HI = [
  'Chhote chhote kadam bhi manzil tak pahunchate hain. Aaj ek kaam aage badha do! 💪',
  'Perfect hone ka wait mat karo — shuru karo, sudharte raho. 🚀',
  'Jo aaj ka kaam aaj nipta leta hai, uski shaam sukoon se guzarti hai. 🌇',
  'Mushkil din bhi guzar jaate hain. Tum bas ek task par focus karo. ✨'
];
const MOTIVATION_EN = [
  'Small steps still get you to the finish line. Move one task forward today! 💪',
  'Don\'t wait to be perfect — start, then keep improving. 🚀',
  'Focus on one task at a time. That is how big projects get done. ✨'
];

// [regex on normalized text, handler(hi, match, n, original)]
const SMALL_TALK = [
  // safety first: someone in distress
  [/\b(?:suicide|khudkushi|marna chahta|marna chahti|marna hai|mujhe marna|mar jaun|mar jaunga|mar jaungi|mar jana|mar jaana|mar jau|jeena nahi|jeene ka mann nahi|jeene ka man nahi|zindagi khatam|zindagi se thak|khud ko khatam|apni jaan|jaan de dunga|jaan de dungi|jaan dena|end my life|kill myself|want to die|dont want to live)\b/, hi => hi
    ? 'Mujhe sunkar bahut dukh hua ki aap aisa mehsoos kar rahe ho. 💙 Aap akele nahi ho. Please abhi kisi bharose ke insaan — dost, family — se baat karo. Madad ke liye Tele-MANAS ko 14416 par call kar sakte ho (free, 24x7). Agar turant khatra hai to 112 dial karo.'
    : 'I\'m really sorry you\'re feeling this way. 💙 You are not alone. Please talk to someone you trust right now. In India you can call Tele-MANAS at 14416 (free, 24x7), and if you are in immediate danger call 112.'],

  [/^(?:good morning|gm|suprabhat|subah bakhair)(?: byte| bhai| yaar)?$/, hi => hi
    ? 'Good morning! ☀️ Aaj ka din productive banate hain. Pehle meetings dekhein?' : 'Good morning! ☀️ Let\'s make today productive. Shall I show your meetings?'],
  [/^(?:good afternoon|good noon)(?: byte)?$/, hi => hi ? 'Good afternoon! 🌤️ Kaam kaisa chal raha hai?' : 'Good afternoon! 🌤️ How is work going?'],
  [/^(?:good evening)(?: byte)?$/, hi => hi ? 'Good evening! 🌆 Din kaisa raha?' : 'Good evening! 🌆 How was your day?'],
  [/\b(?:good night|gn|shubh ratri|shabba khair)\b/, hi => hi ? 'Shubh ratri! 🌙 Acchi neend lena, kal milte hain.' : 'Good night! 🌙 Sleep well, see you tomorrow.'],
  [/^(?:bye|byee+|good ?bye|alvida|tata|ta ta|cya|see you|phir milte hain|chalta hu|chalta hun|chalti hu|ok bye|bye bye|chalo bye)(?: byte| bhai)?$/, hi => hi ? 'Phir milte hain! 👋 Apna khayal rakhna.' : 'See you soon! 👋 Take care.'],

  [/\b(?:kaise ho|kese ho|kaisa hai|kaisi ho|kya haal|how are you|how r u)\b/, hi => hi
    ? pick(['Main ekdum badhiya hoon! 😊 Aap batao, din kaisa ja raha hai?', 'Mast hoon, aapke dashboard par nazar rakh raha hoon 😄 Aap kaise ho?', 'Badhiya! Aapse baat karke aur accha lag raha hai. Aap kaise ho?'])
    : pick(['I\'m doing great! 😊 How is your day going?', 'All good here, keeping an eye on your dashboard 😄 How about you?'])],
  [/\b(?:kya kar (?:rahe|raha|rahi|rha) ho|kya chal raha|wyd|what are you doing)\b/, hi => hi
    ? 'Bas aapke projects aur meetings par nazar rakh raha hoon 👀 Aap batao, kuch karna hai?' : 'Just keeping an eye on your projects and meetings 👀 What would you like to do?'],
  [/\b(?:main|mai|mein)?\s*(?:bhi\s+)?(?:badhiya|badiya|mast|theek|thik|achha|accha|acha|bindaas|ekdum mast)\s*(?:hu|hun|hoon)\b/, hi => hi
    ? pick(['Sunkar accha laga! 😊 Ab bataiye, kya karna hai?', 'Wah, badhiya! 😄 Kaam shuru karein?']) : 'Glad to hear that! 😊 What shall we do?'],

  [/\b(?:bore ho raha|bore ho rahi|boring|bore)\b/, hi => hi
    ? 'Chalo thoda mood badalte hain! 😄 Ek joke sunoge? Bolo "joke sunao". Ya projects ka status update kar lein?' : 'Let\'s fix that! 😄 Say "tell me a joke", or shall we update a project status?'],
  [/\b(?:mood (?:kharab|off|theek nahi)|udaas|dukhi|sad|tension|stress|pareshan|thak (?:gaya|gayi|gya|gyi)|thaka|thak gaya)\b/, hi => hi
    ? 'Arre, sun kar bura laga. 🫂 Thoda paani piyo aur 5 minute ka break le lo. Main yahin hoon — chaho to kaam ka bojh halka karne mein madad kar sakta hoon.'
    : 'Sorry to hear that. 🫂 Grab some water and take a short break. I\'m here — I can help lighten your workload if you like.'],

  [/\b(?:joke|jokes|mazak|mazaak|hasao|hasa do|funny|chutkula|chutkule)\b/, hi => hi ? pick(JOKES_HI) : pick(JOKES_EN)],
  [/\b(?:motivat\w*|inspire|himmat|josh|quote|suvichar)\b/, hi => hi ? pick(MOTIVATION_HI) : pick(MOTIVATION_EN)],

  [/\b(?:time kya|kitne baje hain|abhi kitne baje|samay kya|what time is it|current time|aaj (?:ki )?(?:date|tarikh|tareekh)|aaj kaun ?sa din|aaj kya din|today date|date kya|kya tarikh|what is the date|today s date)\b/, hi => hi
    ? `Abhi ka samay: ${nowIST()} 🕒` : `Right now it is ${nowIST()} 🕒`],
  [/\b(?:mausam|weather|barish|baarish)\b/, hi => hi
    ? 'Mausam ka live data mere paas nahi hai ☁️ — par main aapke projects, meetings aur leave mein madad kar sakta hoon!' : 'I don\'t have live weather data ☁️ — but I can help with your projects, meetings and leave!'],

  [/\b(?:tumhe|tujhe|aapko)\s+(?:kisne|kis ne)\s+(?:banaya|banaye)|\bwho (?:made|created|built) you\b|\bkisne banaya\b|\btumhara creator\b/, hi => hi
    ? 'Mujhe ByteSoft team ne banaya hai taaki aapka kaam aasaan ho! 🚀' : 'I was built by the ByteSoft team to make your work easier! 🚀'],
  [/\b(?:tum|aap)\s+(?:ai|robot|bot|insaan|human|real)\b|\bare you (?:a )?(?:bot|robot|human|ai|real)\b|\bkya tum (?:ai|robot|insaan) ho\b/, hi => hi
    ? 'Main Byte hoon, ek software assistant — insaan nahi 😄 Par main aapke dashboard ko achhe se samajhta hoon aur Hinglish mein baat kar sakta hoon.'
    : 'I\'m Byte, a software assistant — not a human 😄 But I understand your dashboard well and can chat in Hinglish too.'],
  [/\b(?:hindi|hinglish)\b/, hi => hi
    ? 'Haan ji! Main Hinglish samajhta hoon — bas normal baat karo. Jaise: "meri kitni leaves bachi hain", "client review kab hai", ya "naya project add karo". 😊'
    : 'Yes! I understand Hinglish too — just talk normally. Try: "meri kitni leaves bachi hain" or "client review kab hai". 😊'],

  [/\b(?:tum|aap)\s+(?:bahut\s+|kaafi\s+|bohot\s+)?(?:accha|achha|acha|smart|best|great|awesome|mast|helpful)\b|\bwell done\b|\bshabash\b|\bgood job\b|\bsahi hai\b/, hi => hi
    ? pick(['Shukriya! 😊 Aap bhi kamaal ho.', 'Dhanyavad! 🙌 Aur kuch madad chahiye?']) : pick(['Thank you! 😊', 'Thanks! 🙌 Anything else I can help with?'])],
  [/^(?:nice|awesome|great|mast|badhiya|zabardast|shandar|wah|waah|superb|cool)(?: byte| bhai| yaar)?$/, hi => hi ? 'Shukriya! 😊 Aur kuch karna hai?' : 'Thanks! 😊 Anything else?'],
  [/\b(?:bekar|bekaar|faltu|bakwas|useless|stupid|dumb|kuch nahi aata|samajh nahi aata)\b/, hi => hi
    ? 'Sorry! 🙏 Main seekh raha hoon. Seedha likho, jaise "meri leaves kitni bachi hain" ya "projects dikhao" — main poori koshish karunga.'
    : 'Sorry about that! 🙏 I\'m still learning. Try asking plainly, like "show my projects" or "leave balance".'],
  [/\b(?:i love you|love you|luv u|pyar karta|pyaar karta)\b/, hi => hi
    ? 'Aww, shukriya! 😊 Main aapka dashboard dost hoon. Chalo kuch kaam nipta lete hain?' : 'Aww, thank you! 😊 I\'m your dashboard buddy. Shall we get some work done?'],
  [/^(?:ok|okay|k|theek hai|thik hai|theek|thik|accha|achha|acha|hmm+|haan|han|ji|ji haan|chalo|done)(?: byte| bhai| yaar| ji)?$/, hi => hi
    ? pick(['Ji! 😊 Aur kuch madad chahiye?', 'Theek hai! Bataiye aage kya karna hai.']) : pick(['Sure! 😊 Anything else?', 'Alright! What\'s next?'])]
];

function smallTalk(n, hi) {
  for (const [re, fn] of SMALL_TALK) {
    if (re.test(n)) return fn(hi, n.match(re), n);
  }
  const nm = n.match(/^(?:mera naam|my name is)\s+([a-z]+)(?:\s+(?:hai|h))?$/);
  if (nm && !/^(?:kya|batao|bata)$/.test(nm[1])) {
    return hi ? `Aapse milkar accha laga, ${cap(nm[1])}! 😊 Main aapki kya madad kar sakta hoon?` : `Nice to meet you, ${cap(nm[1])}! 😊 How can I help?`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// When Byte is unsure
// ---------------------------------------------------------------------------
function clarify(n, hi) {
  const t = toks(n);
  const any = set => t.some(w => set.has(w));
  if (any(LEAVE)) return hi
    ? 'Leave ke baare mein kya karna hai? 😊 Balance dekhna hai ("meri leaves kitni bachi hain"), leave lagani hai ("leave apply karo") ya requests ka status ("leave requests dikhao")?'
    : 'What would you like to do about leave? 😊 Check balance, apply for leave, or see your requests?';
  return null;
}

const EXAMPLES_HI = ['"projects dikhao"', '"meri kitni leaves bachi hain"', '"client review kab hai"', '"naya meeting add karo"', '"leave apply karo"', '"koi joke sunao"'];
const EXAMPLES_EN = ['"show my projects"', '"how many leaves do I have left"', '"when is my next meeting"', '"add project Employee Portal"', '"apply for leave"', '"tell me a joke"'];

function smartFallback(original, hi) {
  const ex = (hi ? EXAMPLES_HI : EXAMPLES_EN).slice().sort(() => Math.random() - 0.5).slice(0, 3).join(', ');
  return hi
    ? `Hmm, "${original}" mujhe poori tarah samajh nahi aaya 🤔 Aap aise try kar sakte ho: ${ex}. Ya "tum kya kar sakte ho" likho.`
    : `Hmm, I didn't quite get "${original}" 🤔 You could try: ${ex}. Or say "what can you do".`;
}

// Keep a private list of phrases Byte did not understand, so you can teach it later.
const LOG_FILE = path.join(__dirname, '..', 'byte-unknown.log');
function logUnknown(original) {
  try {
    const text = String(original).replace(/\s+/g, ' ').slice(0, 200);
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 200 * 1024) return;
    fs.appendFile(LOG_FILE, new Date().toISOString() + '\t' + text + '\n', () => {});
  } catch { /* never break the chat because of logging */ }
}

module.exports = { looksHinglish, action, answerAbout, rewrite, smallTalk, clarify, smartFallback, logUnknown };
