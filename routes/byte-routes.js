const express = require('express');
const router = express.Router();
const hinglish = require('./byte-hinglish');   // flexible Hinglish brain (see that file to teach Byte more)

// =====================================================
// BYTE AI — FREE RULE-BASED ASSISTANT
// No OpenAI API, no API key, no paid API calls.
// =====================================================

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      reply: 'Please log in first to use Byte AI.'
    });
  }
  next();
}

function normalizeText(value = '') {
  const corrections = {
    projcts: 'projects',
    projct: 'project',
    prject: 'project',
    prjects: 'projects',
    projet: 'project',
    projets: 'projects',
    mtng: 'meeting',
    mtngs: 'meetings',
    mtg: 'meeting',
    mtgs: 'meetings',
    meetng: 'meeting',
    meetngs: 'meetings',
    profle: 'profile',
    proflie: 'profile',
    notif: 'notification',
    notifs: 'notifications',
    notifcations: 'notifications',
    notificaton: 'notification',
    notificatons: 'notifications',
    shw: 'show',
    opn: 'open',
    opne: 'open',
    vw: 'view',
    balnce: 'balance',
    leav: 'leave',
    aply: 'apply',
    aplly: 'apply',
    suport: 'support',
    suppport: 'support',
    wrkng: 'working',
    wht: 'what',
    cnt: 'count',
    creat: 'create',
    dlete: 'delete',
    remve: 'remove',
    abt: 'about',
    pls: 'please',
    thx: 'thanks'
  };

  return String(value)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => corrections[word] || word)
    .join(' ');
}

// =====================================================
// HINGLISH SUPPORT (Hindi written in English letters + English)
// Rewrites common Hinglish phrases into the English phrases the
// rules below already understand. Add more rules here any time.
// =====================================================
const NOUNS_WITH_MY = '(projects?|meetings?|profile)';
const NOUNS_PLAIN = '(dashboard|notifications?|faqs?|support|leave balance|leave requests?)';
const SHOW_VERBS = '(?:dikhao|dikha do|dikhado|dikha de|dikhana|dikha|batao|bata do|batado|bata de|dekho|dekhna hai|dekhna chahta hu|dekhna chahti hu)';
const OPEN_VERBS = '(?:kholo|khol do|kholdo|kholiye|kholna hai|open karo|open kardo|open kar do)';
const DO_SUFFIX = '(?:\\s+(?:karo|kardo|kar do|kijiye|kar de))?';

const HINGLISH_RULES = [
  [/\b(?:kaise ho|kese ho|kaisa hai|kaisi ho|kya haal hai|kya haal chaal|kya hal hai|how r u)\b/g, 'how are you'],
  [/\b(?:tum|aap)\s+(?:kya kya|kya)\s+(?:kar sakte ho|kar sakti ho|kar sakte hain|karte ho)\b|\bkya kar sakte ho\b|\bkya kar sakta hai\b/g, 'what can you do'],
  [/\b(?:tum|aap)\s+kaun\s+ho\b|\btumhara naam kya hai\b|\baapka naam kya hai\b|\btera naam kya hai\b/g, 'who are you'],
  [/\b(?:shukriya|dhanyavad|dhanyawad|thanku|thank u|thnx)\b/g, 'thank you'],
  [/\b(?:namaste|namaskar|ram ram|sat sri akal|salaam|salam)\b/g, 'hello'],
  [/\bmain kaun hu+n?\b|\bmein kaun hu+n?\b/g, 'who am i'],
  [/\bmer[aei]\s+(naam|name|email|phone|role|location)\s+(?:kya hai|kya h|batao|bata do)\b/g,
    (m, k) => 'my ' + (k === 'naam' ? 'name' : k)],
  [new RegExp('\\b(?:mere|meri|mera|apne|apna)?\\s*' + NOUNS_WITH_MY + '\\s+(?:ko\\s+)?' + SHOW_VERBS + '\\b', 'g'),
    (m, n) => 'show my ' + n],
  [new RegExp('\\b(?:mere|meri|mera|apne|apna)?\\s*' + NOUNS_PLAIN + '\\s+(?:ko\\s+)?' + SHOW_VERBS + '\\b', 'g'),
    (m, n) => 'show ' + n],
  [new RegExp('\\b' + NOUNS_WITH_MY + '\\s+(?:ko\\s+)?' + OPEN_VERBS + '\\b', 'g'), (m, n) => 'open ' + n],
  [new RegExp('\\b' + NOUNS_PLAIN + '\\s+(?:ko\\s+)?' + OPEN_VERBS + '\\b', 'g'), (m, n) => 'open ' + n],
  [/\b(?:mere paas|mere|meri)?\s*(?:kitne|kitni|kitna)\s+(projects?|meetings?)\b/g, (m, n) => 'how many ' + n],
  [/\b(projects?|meetings?)\s+(?:kitne|kitni)\s+(?:hain|hai|he|h)\b/g, (m, n) => 'how many ' + n],
  [/\b(meetings?)\s+(?:kab|kitne baje)\b/g, 'show my meetings'],
  [/\b(?:mera|meri|mere)?\s*(?:chh?utt?i|leave)\s+(?:kitni|kitne)\s+(?:bachi|bache|baki|baaki|bacha)\s*(?:hui|hue)?\s*(?:hai|hain|h)?\b/g, 'leave balance'],
  [/\b(?:chh?utt?i|leave)\s+(?:apply|request)\s*(?:karo|kardo|kar do|karna hai)?\b|\b(?:chh?utt?i|leave)\s+(?:lena hai|leni hai|chahiye|lena chahta hu|lena chahti hu)\b|\bmujhe\s+(?:chh?utt?i|leave)\s+(?:chahiye|leni hai|lena hai)\b|\b(?:meri|mujhe)\s+(?:chh?utt?i|leave)\s+(?:lagao|laga do|apply kar do|apply karo|book karo)\b|\b(?:chh?utt?i|leave)\s+(?:lagao|laga do|book karo)\b/g, 'apply for leave'],
  [/\b(?:chh?utt?i|leave)\s+(?:ki\s+)?(?:requests?|status)\b/g, 'leave requests'],
  [/\b(review|in progress|progress|not started)\s+(?:mein|me|m)\s+(?:kaun\s?sa|kaun\s?se|kon\s?sa|kon\s?se|konsa|konse)\s+project\b/g,
    (m, st) => 'which project is in ' + (st === 'progress' ? 'in progress' : st).replace('in in', 'in')],
  [new RegExp('\\b(?:naya|nayi|ek naya|ek nayi)\\s+(project|meeting)\\s+(?:add|create|banao|bana do|jodo|jod do)' + DO_SUFFIX + '\\s*(.*)$', 'g'),
    (m, n, rest) => ('add ' + n + ' ' + rest).trim()],
  [new RegExp('\\b(.+?)\\s+(?:naam ka|naam se|naam wala|naam ki)\\s+(project|meeting)\\s+(?:add|create|banao|bana do|jodo|jod do)' + DO_SUFFIX + '$', 'g'),
    (m, title, n) => 'add ' + n + ' ' + title],
  [new RegExp('\\b(project|meeting)\\s+(.+?)\\s+(?:ko\\s+)?(?:delete|remove|hatao|hata do|hatado|mita do|mitao|cancel)' + DO_SUFFIX + '$', 'g'),
    (m, n, title) => 'delete ' + n + ' ' + title],
  [/\b(.+?)\s+(project|meeting)\s+(?:ko\s+)?(?:hatao|hata do|hatado|mita do|mitao|delete karo|remove karo|cancel karo)$/g,
    (m, title, n) => 'delete ' + n + ' ' + title],
  [/\b(?:projects?|project)\s+(?:dikhao|dikha do|dikhado|batao|list karo|show karo)\b/g, 'show my projects'],
  [/\b(?:meetings?|meeting)\s+(?:dikhao|dikha do|dikhado|batao|list karo|show karo)\b/g, 'show my meetings'],
  [/\b(?:naya|nayi)?\s*(?:project|meeting)\s+(?:add|create|banao|bana do|jodo|jod do)\b/g, (m, n) => 'add ' + (m.includes('meeting') ? 'meeting' : 'project')],
  [/\b(?:project|meeting)\s+(.+?)\s+(?:delete karo|remove karo|hatao|hata do|mita do)\b/g, (m, title, n) => 'delete ' + (m.includes('meeting') ? 'meeting ' : 'project ') + title],
  [/\b(?:faq|faqs)\s+(?:kholo|khol do|open karo)\b/g, 'open faq'],
  [/\b(?:support)\s+(?:kholo|khol do|open karo)\b/g, 'open support'],
  [/\bpassword\s+(?:bhul|bhool)\s*(?:gaya|gayi|gya|gyi)?\b/g, 'forgot password'],
  [/\bsupport\s+(?:se baat|se contact|chahiye|se help)\b|\bsupport team se\b/g, 'open support'],
  [/\b(?:mujhe\s+)?(?:madad|help)\s+(?:chahiye|karo|kardo|kar do|kijiye)\b|\bmeri\s+(?:madad|help)\s+karo\b/g, 'how can you help'],
  [/\blog\s?out\s+(?:karo|kardo|kar do)\b|\bbahar nikalo\b/g, 'logout']
];

// Words that show the user is writing Hinglish (used to reply in Hinglish too).
const HINGLISH_MARKERS = [
  'hai', 'hain', 'kya', 'kaise', 'kese', 'karo', 'kardo', 'kar', 'mera', 'meri', 'mere', 'mujhe', 'dikhao', 'batao',
  'kholo', 'chahiye', 'kitne', 'kitni', 'naya', 'nayi', 'hatao', 'chutti', 'chhutti', 'shukriya', 'dhanyavad',
  'namaste', 'tum', 'aap', 'aapka', 'tumhara', 'nahi', 'haan', 'kaun', 'kab', 'madad', 'bhul', 'bhool', 'baaki',
  'bachi', 'wala', 'naam', 'mein', 'liye', 'sakte', 'sakta', 'dikha', 'bata', 'jodo', 'banao'
];

function isHinglish(rawNormalized) {
  const words = rawNormalized.split(' ');
  return words.some(w => HINGLISH_MARKERS.includes(w));
}

function applyHinglish(text) {
  let out = text;
  for (const [pattern, replacement] of HINGLISH_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s+/g, ' ').trim();
}

function has(text, phrases) {
  return phrases.some(phrase => text.includes(phrase));
}

function reply(res, message, action, extra = {}) {
  const result = { reply: message, ...extra };
  if (action) result.action = action;
  return res.json(result);
}

function getDashboard(req) {
  const d = req.body?.dashboard || {};

  return {
    user: d.user || {},
    profile: d.profile || {},
    projects: Array.isArray(d.projects) ? d.projects : [],
    meetings: Array.isArray(d.meetings) ? d.meetings : [],
    leaveBalances: d.leaveBalances || {},
    leaveRequests: Array.isArray(d.leaveRequests)
      ? d.leaveRequests
      : [],
    currentDate: d.currentDate || ''
  };
}

function projectTitle(item) {
  return String(item.title || item.name || 'Untitled project');
}

function meetingTitle(item) {
  return String(item.title || item.name || 'Untitled meeting');
}

function projectStatus(item) {
  return String(item.details || item.status || '').trim();
}

function meetingTime(item) {
  return String(item.time || item.date || '').trim();
}

function plural(n, one, many) {
  return n === 1 ? one : many;
}

// The rules work on lowercase text, so titles come out lowercase.
// This puts back the capital letters the user typed (or title-cases it).
function restoreCase(title, original) {
  const clean = String(title || '').trim();
  if (!clean) return clean;
  const idx = String(original).toLowerCase().indexOf(clean.toLowerCase());
  if (idx >= 0) return String(original).substr(idx, clean.length);
  return clean.replace(/\b[a-z]/g, c => c.toUpperCase());
}

function listProjects(data, hi = false) {
  if (!data.projects.length) {
    return hi ? 'Abhi aapke paas koi project nahi hai.' : 'You do not have any projects listed yet.';
  }

  return (hi ? 'Ye hain aapke ' + data.projects.length + ' projects:\n' : 'Here are your ' + data.projects.length + ' ' + plural(data.projects.length, 'project', 'projects') + ':\n') +
    data.projects.map((p, i) =>
      `${i + 1}. ${projectTitle(p)}${projectStatus(p) ? ' — ' + projectStatus(p) : ''}`
    ).join('\n');
}

function listMeetings(data, hi = false) {
  if (!data.meetings.length) {
    return hi ? 'Abhi aapke paas koi meeting nahi hai.' : 'You do not have any meetings listed right now.';
  }

  return (hi ? 'Ye hain aapki ' + data.meetings.length + ' meetings:\n' : 'Here are your ' + data.meetings.length + ' ' + plural(data.meetings.length, 'meeting', 'meetings') + ':\n') +
    data.meetings.map((m, i) =>
      `${i + 1}. ${meetingTitle(m)}${meetingTime(m) ? ' — ' + meetingTime(m) : ''}`
    ).join('\n');
}

function extractTitle(text, verbs, noun) {
  const verbPattern = verbs.join('|');
  const pattern = new RegExp(
    `\\b(?:${verbPattern})\\s+(?:(?:a|an|the|new|my)\\s+)*(?:${noun}\\s+)?(.+)$`,
    'i'
  );

  const match = text.match(pattern);
  if (!match) return '';

  return match[1]
    .replace(/\bplease\b/g, '')
    .replace(/\bfor me\b/g, '')
    .replace(/\bto my list\b/g, '')
    .replace(/^[\s:,-]+|[\s,.-]+$/g, '')
    .trim();
}

function findExact(items, title, getTitle) {
  const target = title.toLowerCase().trim();
  return items.find(item =>
    getTitle(item).toLowerCase().trim() === target
  );
}

function profileReply(text, data) {
  const u = data.user;
  const p = data.profile;

  const fields = {
    name: p.name || u.name || u.username,
    email: p.email || u.email,
    phone: p.phone || u.phone,
    role: p.role || u.role,
    location: p.location || u.location,
    about: p.about || u.about
  };

  let key = null;

  if (has(text, ['who am i', 'my name', 'my username'])) {
    key = 'name';
  } else if (text.includes('email')) {
    key = 'email';
  } else if (has(text, ['phone', 'mobile number', 'contact number'])) {
    key = 'phone';
  } else if (has(text, ['my role', 'my job', 'my position'])) {
    key = 'role';
  } else if (text.includes('location')) {
    key = 'location';
  } else if (has(text, ['about me', 'my bio'])) {
    key = 'about';
  }

  if (!key) return null;

  if (fields[key]) {
    const labels = {
      name: 'Your name',
      email: 'Your email',
      phone: 'Your phone number',
      role: 'Your role',
      location: 'Your location',
      about: 'About you'
    };

    return `${labels[key]}: ${fields[key]}`;
  }

  return `I couldn't find your ${key} in the dashboard profile data.`;
}

const MONTHLY_PAID_LEAVE_QUOTA = 2;   // keep in sync with dashboard.html

function currentMonthKey(data) {
  return /^\d{4}-\d{2}/.test(data.currentDate || '')
    ? data.currentDate.slice(0, 7)
    : new Date().toISOString().slice(0, 7);
}

function leaveBalanceReply(data, hi = false) {
  const key = currentMonthKey(data);
  const stored = Number(data.leaveBalances[key]);
  const remaining = Number.isFinite(stored) ? stored : MONTHLY_PAID_LEAVE_QUOTA;
  const days = n => Number(n.toFixed(1));
  if (hi) {
    return `Is mahine aapki ${days(remaining)} paid leave bachi hai (kul ${MONTHLY_PAID_LEAVE_QUOTA} milti hain). 🗓️ Leave lagani ho to bolo "leave apply karo".`;
  }
  return `You have ${days(remaining)} paid leave day${remaining === 1 ? '' : 's'} left this month (out of ${MONTHLY_PAID_LEAVE_QUOTA}). 🗓️ Say "apply for leave" to request one.`;
}

function leaveTakenReply(data, hi = false) {
  const value = r => (r.type === 'half' ? 0.5 : 1);
  const approved = data.leaveRequests.filter(r => r.status === 'approved');
  const pending = data.leaveRequests.filter(r => r.status === 'pending').length;
  const total = Number(approved.reduce((sum, r) => sum + value(r), 0).toFixed(1));
  if (hi) {
    return `Aapne ab tak ${total} din ki chhutti li hai (approved).` + (pending ? ` ${pending} request abhi pending hai.` : '');
  }
  return `You have taken ${total} day${total === 1 ? '' : 's'} of approved leave so far.` + (pending ? ` ${pending} request${pending === 1 ? ' is' : 's are'} still pending.` : '');
}

function leaveRequestsReply(data) {
  if (!data.leaveRequests.length) {
    return 'There are no leave requests listed in your dashboard data.';
  }

  return 'Here are your leave requests:\n' +
    data.leaveRequests.map((item, i) => {
      const type = item.type === 'half' ? 'Half day' : item.type === 'full' ? 'Full day' : (item.type || item.leaveType || item.title || 'Leave');
      const status = item.status || 'Status not specified';
      const date = item.date || (item.startDate && item.endDate ? `${item.startDate} to ${item.endDate}` : '');

      return `${i + 1}. ${date ? date + ' — ' : ''}${type} — ${status}`;
    }).join('\n');
}

router.post('/chat', requireAuth, (req, res) => {
  try {
    const original = String(req.body?.text || '').trim();

    if (!original) {
      return reply(res, 'Type a message and I will help you. / Kuch likhiye, main madad karunga.');
    }

    const normalized = hinglish.fixSpelling(normalizeText(original));
    const hi = isHinglish(normalized) || hinglish.looksHinglish(normalized);          // user wrote Hinglish -> reply in Hinglish
    let text = applyHinglish(normalized);     // Hinglish phrases rewritten to English rules
    // Catch common conversational Hinglish requests that vary in word order.
    if (/\b(chh?utt?i|leave)\b/.test(normalized) && /\b(lagao|laga do|apply|request|leni|lena|chahiye|book)\b/.test(normalized)) {
      text = 'apply for leave';
    } else if (/\b(projects?|project)\b/.test(normalized) && /\b(dikhao|dikha|dikhado|batao|list karo|show karo)\b/.test(normalized)) {
      text = 'show my projects';
    } else if (/\b(meetings?|meeting)\b/.test(normalized) && /\b(dikhao|dikha|dikhado|batao|list karo|show karo)\b/.test(normalized)) {
      text = 'show my meetings';
    }
    const t = (en, hin) => (hi ? hin : en);
    const data = getDashboard(req);

    // Conversation memory
    if (!req.session.byteMemory) {
      req.session.byteMemory = {
        lastTopic: null,
        lastProject: null,
        lastMeeting: null
      };
    }

    const memory = req.session.byteMemory;

    // ---- Hinglish brain: actions, flexible phrases, questions about one item, small talk ----
    const act = hinglish.action(normalized, data);
    if (act) {
      return res.json({ action: act.action, ...act.payload, reply: hi ? act.replyHi : act.replyEn });
    }

    const smart = hinglish.rewrite(normalized);
    if (smart === 'leave taken') {
      return reply(res, leaveTakenReply(data, hi));
    }
    if (smart) {
      text = smart;
    } else {
      const about = hinglish.answerAbout(normalized, data, hi);
      if (about) return reply(res, about);
      const talk = hinglish.smallTalk(normalized, hi);
      if (talk) return reply(res, talk);
    }

    // MULTI-REQUEST HANDLER

    const wantsProjects = has(text, [
      'show my projects', 'show projects', 'list projects',
      'list my projects', 'my projects', 'all projects',
      'what projects', 'view projects', 'working on right now',
      'what am i working on'
    ]);

    const wantsMeetings = has(text, [
      'show my meetings', 'show meetings', 'list meetings',
      'list my meetings', 'my meetings', 'all meetings',
      'upcoming meetings', 'view meetings', 'meeting schedule'
    ]);

    const wantsProjectCount = has(text, [
      'how many projects', 'project count',
      'number of projects', 'count projects'
    ]);

    const wantsMeetingCount = has(text, [
      'how many meetings', 'meeting count',
      'number of meetings', 'count meetings'
    ]);

    const wantsGenericCount = has(text, [
      'how many do i have', 'how many are there',
      'how many in total', 'what is the total'
    ]);

    const wantsReview = has(text, [
      'which one is in review', 'which project is in review',
      'what is in review', 'projects in review'
    ]);

    const wantsInProgress = has(text, [
      'which one is in progress', 'which project is in progress',
      'what is in progress', 'projects in progress'
    ]);

    const wantsNotStarted = has(text, [
      'which one is not started', 'what is not started',
      'projects not started'
    ]);

    const wantsLeaveBalance = has(text, [
      'leave balance', 'leaves left', 'remaining leave',
      'leave days left', 'leave quota'
    ]);

    const wantsLeaveRequests = has(text, [
      'pending leave', 'leave requests', 'my leave request',
      'leave status', 'leave application status'
    ]);

    const projectStatusRequested =
      wantsReview || wantsInProgress || wantsNotStarted;

    const multiRequestCount = [
      wantsProjects,
      wantsMeetings,
      wantsProjectCount,
      wantsMeetingCount,
      projectStatusRequested,
      wantsLeaveBalance,
      wantsLeaveRequests
    ].filter(Boolean).length;

    if (
      multiRequestCount >= 2 ||
      (wantsGenericCount && (wantsProjects || wantsMeetings))
    ) {
      const sections = [];

      if (wantsProjects) {
        sections.push(listProjects(data, hi));
        memory.lastTopic = 'projects';

        if (data.projects.length) {
          memory.lastProject = projectTitle(data.projects[0]);
        }
      }

      if (wantsMeetings) {
        sections.push(listMeetings(data, hi));
        memory.lastTopic = 'meetings';

        if (data.meetings.length) {
          memory.lastMeeting = meetingTitle(data.meetings[0]);
        }
      }

      if (
        wantsProjectCount ||
        (wantsGenericCount && wantsProjects && !wantsMeetings)
      ) {
        sections.push(
          t(`You have ${data.projects.length} projects in total.`, `Aapke paas kul ${data.projects.length} projects hain.`)
        );
      }

      if (
        wantsMeetingCount ||
        (wantsGenericCount && wantsMeetings && !wantsProjects)
      ) {
        sections.push(
          t(`You have ${data.meetings.length} meetings in total.`, `Aapke paas kul ${data.meetings.length} meetings hain.`)
        );
      }

      if (projectStatusRequested) {
        const requestedStatus = wantsReview
          ? 'review'
          : wantsInProgress
            ? 'in progress'
            : 'not started';

        const matches = data.projects.filter(project =>
          projectStatus(project).toLowerCase().includes(requestedStatus)
        );

        sections.push(
          matches.length
            ? `Projects with status "${requestedStatus}":\n` +
              matches.map(project =>
                `• ${projectTitle(project)} — ${projectStatus(project)}`
              ).join('\n')
            : `I couldn't find any projects with status "${requestedStatus}".`
        );
      }

      if (wantsLeaveBalance) {
        sections.push(leaveBalanceReply(data, hi));
      }

      if (wantsLeaveRequests) {
        sections.push(leaveRequestsReply(data));
      }

      if (sections.length) {
        return reply(res, sections.join('\n\n'));
      }
    }

    // SINGLE STATUS QUESTION (e.g. "which project is in review")

    if (projectStatusRequested && multiRequestCount === 1) {
      const requestedStatus = wantsReview ? 'review' : wantsInProgress ? 'in progress' : 'not started';
      const matches = data.projects.filter(p =>
        projectStatus(p).toLowerCase().includes(requestedStatus)
      );
      memory.lastTopic = 'projects';
      if (matches.length) memory.lastProject = projectTitle(matches[0]);

      return reply(
        res,
        matches.length
          ? matches.map(p => `${projectTitle(p)} \u2014 ${projectStatus(p)}`).join('\n')
          : t(`I couldn\u2019t find any projects with status \"${requestedStatus}\".`, `Status \"${requestedStatus}\" wala koi project nahi mila.`)
      );
    }

    // GREETINGS AND SMALL TALK
    // Byte keeps the first reply short. It only lists what it can do
    // when the user asks ("what can you do").

    if (/^(hi+|hello+|hey+|hlo|helo|good morning|good afternoon|good evening|good night)( byte)?$/.test(text)) {
      return reply(
        res,
        t('Hi! 👋 How\u2019s it going?', 'Hi! 👋 Kaisa chal raha hai?')
      );
    }

    if (/\b(how are you|how is it going|hows it going|how are things|whats up|wassup)\b|^sup$/.test(text)) {
      return reply(
        res,
        t(
          'I\u2019m doing great, thanks for asking! 😊 How about you?',
          'Main badhiya hoon, poochne ke liye shukriya! 😊 Aap batao, aap kaise ho?'
        )
      );
    }

    if (/^(i am |im |i m )?(good|fine|great|doing good|doing great|all good|ok|okay|theek|theek hu|theek hoon|badhiya|mast|accha|achha)( thanks| thank you)?$/.test(text)) {
      return reply(
        res,
        t('Glad to hear that! 😊 What can I do for you?', 'Sunkar accha laga! 😊 Main aapki kya madad kar sakta hoon?')
      );
    }

    if (has(text, ['thank you', 'thanks', 'you are helpful'])) {
      return reply(res, t('You\u2019re welcome! 😊 What would you like to do next?', 'Koi baat nahi! 😊 Ab aap kya karna chahenge?'));
    }

    if (has(text, ['who are you', 'what are you', 'your name'])) {
      return reply(
        res,
        t(
          'I\u2019m Byte, your dashboard assistant. I answer using your dashboard data and can help with supported dashboard actions.',
          'Main Byte hoon, aapka dashboard assistant. Main aapke dashboard ke data se jawab deta hoon aur kuch dashboard kaam mein madad kar sakta hoon.'
        )
      );
    }

    if (has(text, ['what can you do', 'show commands', 'how can you help', 'what do you do', 'help me'])) {
      return reply(
        res,
        t(
          'Here\u2019s what I can do:\n\u2022 Show your projects, meetings, profile and leave details\n\u2022 Add, rename or remove projects and meetings\n\u2022 Reschedule meetings and update project status\n\u2022 Open Notifications, FAQs, Support and the leave form\n\nYou can also write to me in Hinglish!',
          'Main ye sab kar sakta hoon:\n\u2022 Aapke projects, meetings, profile aur leave ki details dikhana\n\u2022 Projects aur meetings add, rename ya remove karna\n\u2022 Meeting reschedule karna aur project ka status badalna\n\u2022 Notifications, FAQs, Support aur leave form kholna\n\nAap mujhse Hinglish mein bhi baat kar sakte ho!'
        )
      );
    }

    // FOLLOW-UP QUESTIONS

    if (
      memory.lastTopic === 'projects' &&
      has(text, [
        'which one is in review',
        'which project is in review',
        'what is in review',
        'which one is in progress',
        'which project is in progress',
        'what is in progress',
        'which one is not started',
        'what is not started'
      ])
    ) {
      const status = text.includes('review')
        ? 'review'
        : text.includes('in progress')
          ? 'in progress'
          : 'not started';

      const matches = data.projects.filter(p =>
        projectStatus(p).toLowerCase().includes(status)
      );

      if (!matches.length) {
        return reply(res, `I couldn't find a project with status "${status}".`);
      }

      memory.lastProject = projectTitle(matches[0]);

      return reply(
        res,
        matches.map(p => `${projectTitle(p)} — ${projectStatus(p)}`).join('\n')
      );
    }

    if (
      memory.lastTopic === 'projects' &&
      has(text, [
        'how many do i have',
        'how many are there',
        'how many of them',
        'count them',
        'their count'
      ])
    ) {
      return reply(
        res,
        t(`You have ${data.projects.length} projects in your dashboard.`, `Aapke dashboard mein ${data.projects.length} projects hain.`)
      );
    }

    if (
      memory.lastTopic === 'meetings' &&
      has(text, [
        'how many do i have',
        'how many are there',
        'how many of them',
        'count them',
        'their count'
      ])
    ) {
      return reply(
        res,
        t(`You have ${data.meetings.length} meetings in your dashboard.`, `Aapke dashboard mein ${data.meetings.length} meetings hain.`)
      );
    }

    if (
      memory.lastProject &&
      has(text, ['tell me more', 'its status', 'that project status'])
    ) {
      const p = findExact(data.projects, memory.lastProject, projectTitle);

      if (p) {
        return reply(
          res,
          `${projectTitle(p)}${projectStatus(p) ? ' is ' + projectStatus(p) : ' has no status listed'}.`
        );
      }
    }

    if (
      memory.lastMeeting &&
      has(text, ['what time', 'when is it', 'its time', 'meeting time'])
    ) {
      const m = findExact(data.meetings, memory.lastMeeting, meetingTitle);

      if (m) {
        return reply(
          res,
          meetingTime(m)
            ? `${meetingTitle(m)} is scheduled for ${meetingTime(m)}.`
            : `No time is listed for ${meetingTitle(m)} yet.`
        );
      }
    }

    // NAVIGATION

    if (has(text, ['open dashboard', 'go to dashboard', 'show dashboard', 'open home'])) {
      return reply(res, t('Opening your dashboard.', 'Aapka dashboard khol raha hoon.'), 'open_dashboard');
    }

    if (has(text, ['open notification', 'show notification', 'my alerts', 'notifications'])) {
      return reply(res, t('Opening your notifications.', 'Aapke notifications khol raha hoon.'), 'open_notifications');
    }

    if (has(text, ['open faq', 'show faq', 'faq page', 'frequently asked'])) {
      return reply(res, t('Opening the FAQs.', 'FAQs khol raha hoon.'), 'open_faq');
    }

    if (has(text, ['open support', 'contact support', 'support page', 'help desk'])) {
      return reply(res, t('Opening the Support section.', 'Support section khol raha hoon.'), 'open_support');
    }

    if (has(text, ['open profile', 'view profile', 'show profile', 'my profile', 'profile page', 'edit profile'])) {
      return reply(res, t('Opening your profile.', 'Aapki profile khol raha hoon.'), 'open_profile');
    }

    if (has(text, ['apply for leave', 'request leave', 'take leave', 'leave application', 'open leave form'])) {
      return reply(res, t('Opening the leave request form.', 'Leave request form khol raha hoon.'), 'open_leave_form');
    }

    // PROJECT QUESTIONS

    if (has(text, [
      'show my projects',
      'show projects',
      'list projects',
      'list my projects',
      'my projects',
      'all projects',
      'what projects',
      'what am i working on',
      'working on right now',
      'view projects'
    ])) {
      memory.lastTopic = 'projects';

      if (data.projects.length) {
        memory.lastProject = projectTitle(data.projects[0]);
      }

      return reply(res, listProjects(data, hi));
    }

    if (has(text, ['how many projects', 'project count', 'number of projects', 'count projects'])) {
      memory.lastTopic = 'projects';
      return reply(res, t(`You currently have ${data.projects.length} projects.`, `Abhi aapke paas ${data.projects.length} projects hain.`));
    }

    if (has(text, ['add project', 'create project', 'new project', 'start project'])) {
      const title = restoreCase(extractTitle(text, ['add', 'create', 'start'], 'project'), original);

      if (!title || ['project', 'a project', 'new project'].includes(title)) {
        return reply(res, t('What should the project be called? Example: Add project Employee Portal.', 'Project ka naam kya rakhna hai? Example: Add project Employee Portal.'));
      }

      return reply(
        res,
        t(`Adding project "${title}".`, `Project "${title}" add kar raha hoon.`),
        'create_project',
        { project: { title, details: 'not started' } }
      );
    }

    if (has(text, ['delete project', 'remove project'])) {
      const title = extractTitle(text, ['delete', 'remove'], 'project');

      if (!title || title === 'project') {
        return reply(res, t('Which project should I remove? Please include its title.', 'Kaun sa project hatana hai? Please uska title bhi likhiye.'));
      }

      const project = findExact(data.projects, title, projectTitle);

      if (!project) {
        return reply(
          res,
          `I couldn't find a project named "${title}". Ask me to show your projects to check the exact title.`
        );
      }

      return reply(
        res,
        t(`Please confirm the removal of "${projectTitle(project)}".`, `Please "${projectTitle(project)}" ko hatane ki confirmation dijiye.`),
        'delete_project',
        { title: projectTitle(project) }
      );
    }

    // UPDATE PROJECT: RENAME OR CHANGE STATUS

    if (/^(change|update|rename|edit)\b/i.test(text)) {
      const rename = text.match(/^rename\s+(.+?)\s+to\s+(.+)$/i);

      const status = text.match(
        /^(?:change|update|set)\s+(.+?)\s+(?:status\s+)?to\s+(in progress|not started|review|completed|done)$/i
      );

      if (rename || status) {
        const oldTitle = (rename ? rename[1] : status[1])
          .replace(/^project\s+/i, '')
          .replace(/\s+status$/i, '')
          .trim();

        const project = data.projects.find(
          p => projectTitle(p).toLowerCase() === oldTitle.toLowerCase()
        );

        if (!project) {
          return reply(res, `I couldn't find project "${oldTitle}".`);
        }

        return res.json({
          action: 'update_project',
          oldTitle: projectTitle(project),
          title: rename ? restoreCase(rename[2].trim(), original) : projectTitle(project),
          details: status ? status[2].toLowerCase() : projectStatus(project),
          reply: 'Updating your project.'
        });
      }
    }

    // RESCHEDULE MEETING

    if (/^(reschedule|change|update|move)\b/i.test(text)) {
      const match = text.match(
        /^(?:reschedule|change|update|move)\s+(.+?)\s+to\s+(.+)$/i
      );

      if (match) {
        const oldTitle = match[1]
          .replace(/^meeting\s+/i, '')
          .trim();

        const meeting = data.meetings.find(
          m => meetingTitle(m).toLowerCase() === oldTitle.toLowerCase()
        );

        if (!meeting) {
          return reply(res, `I couldn't find meeting "${oldTitle}".`);
        }

        return res.json({
          action: 'update_meeting',
          oldTitle: meetingTitle(meeting),
          time: restoreCase(match[2].trim(), original),
          reply: 'Updating your meeting time.'
        });
      }
    }

    if (text === 'open project form' || text === 'create project form') {
      return reply(res, 'Opening the project form.', 'open_project_form');
    }

    // MEETING QUESTIONS AND ACTIONS

    if (has(text, [
      'show my meetings',
      'show meetings',
      'list meetings',
      'list my meetings',
      'my meetings',
      'all meetings',
      'upcoming meetings',
      'view meetings',
      'meeting schedule'
    ])) {
      memory.lastTopic = 'meetings';

      if (data.meetings.length) {
        memory.lastMeeting = meetingTitle(data.meetings[0]);
      }

      return reply(res, listMeetings(data, hi));
    }

    if (has(text, ['how many meetings', 'meeting count', 'number of meetings', 'count meetings'])) {
      memory.lastTopic = 'meetings';
      return reply(res, t(`You currently have ${data.meetings.length} meetings.`, `Abhi aapke paas ${data.meetings.length} meetings hain.`));
    }

    if (has(text, ['add meeting', 'create meeting', 'new meeting', 'schedule meeting'])) {
      const title = restoreCase(extractTitle(text, ['add', 'create', 'schedule'], 'meeting'), original);

      if (!title || ['meeting', 'a meeting', 'new meeting'].includes(title)) {
        return reply(res, t('What should the meeting be called? Example: Add meeting Project Review.', 'Meeting ka naam kya rakhna hai? Example: Add meeting Project Review.'));
      }

      return reply(
        res,
        t(`Adding meeting "${title}".`, `Meeting "${title}" add kar raha hoon.`),
        'create_meeting',
        { meeting: { title, time: '', details: '' } }
      );
    }

    if (has(text, ['delete meeting', 'remove meeting', 'cancel meeting'])) {
      const title = extractTitle(text, ['delete', 'remove', 'cancel'], 'meeting');

      if (!title || title === 'meeting') {
        return reply(res, t('Which meeting should I remove? Please include its title.', 'Kaun si meeting hatani hai? Please uska title bhi likhiye.'));
      }

      const meeting = findExact(data.meetings, title, meetingTitle);

      if (!meeting) {
        return reply(
          res,
          `I couldn't find a meeting named "${title}". Ask me to show your meetings to check the exact title.`
        );
      }

      return reply(
        res,
        t(`Please confirm the removal of "${meetingTitle(meeting)}".`, `Please "${meetingTitle(meeting)}" ko hatane ki confirmation dijiye.`),
        'delete_meeting',
        { title: meetingTitle(meeting) }
      );
    }

    if (text === 'open meeting form' || text === 'create meeting form') {
      return reply(res, 'Opening the meeting form.', 'open_meeting_form');
    }

    // PROFILE QUESTIONS

    const profileMessage = profileReply(text, data);

    if (profileMessage) {
      return reply(res, profileMessage);
    }

    // LEAVE BALANCE AND REQUESTS

    if (has(text, [
      'leave balance',
      'leaves left',
      'remaining leave',
      'leave days left',
      'leave quota'
    ])) {
      return reply(res, leaveBalanceReply(data, hi));
    }

    if (has(text, [
      'pending leave',
      'leave requests',
      'my leave request',
      'leave status',
      'leave application status'
    ])) {
      return reply(res, leaveRequestsReply(data));
    }

    // ACCOUNT AND SECURITY

    if (has(text, ['logout', 'log out', 'sign out'])) {
      return reply(res, 'Use the dashboard Logout button to sign out securely.');
    }

    if (has(text, ['change password', 'forgot password', 'reset password'])) {
      return reply(
        res,
        'Use the password options on your login or account page, if available. I cannot change your password directly.'
      );
    }

    // HELPFUL FALLBACK

    hinglish.logUnknown(original);   // saved to byte-unknown.log so you can teach Byte later
    return reply(res, hinglish.clarify(normalized, hi) || hinglish.smartFallback(original, hi));

  } catch (error) {
    console.error('Byte AI error:', error);

    return res.status(500).json({
      reply: 'Something went wrong while processing your message. Please try again.'
    });
  }
});

module.exports = router;