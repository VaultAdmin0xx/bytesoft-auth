const express = require('express');
const router = express.Router();

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

function listProjects(data) {
  if (!data.projects.length) {
    return 'You do not have any projects listed yet.';
  }

  return 'Here are your ' + data.projects.length + ' projects:\n' +
    data.projects.map((p, i) =>
      `${i + 1}. ${projectTitle(p)}${projectStatus(p) ? ' — ' + projectStatus(p) : ''}`
    ).join('\n');
}

function listMeetings(data) {
  if (!data.meetings.length) {
    return 'You do not have any meetings listed right now.';
  }

  return 'Here are your ' + data.meetings.length + ' meetings:\n' +
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

function leaveBalanceReply(data) {
  const balances = data.leaveBalances;
  const keys = Object.keys(balances);

  if (!keys.length) {
    return 'I could not find your leave balance in the dashboard data.';
  }

  return 'Your leave balance details:\n' + keys.map(key => {
    const value = balances[key];

    if (value && typeof value === 'object') {
      const amount =
        value.remaining ?? value.balance ?? value.days ?? value.total;
      return `${key}: ${amount ?? JSON.stringify(value)}`;
    }

    return `${key}: ${value}`;
  }).join('\n');
}

function leaveRequestsReply(data) {
  if (!data.leaveRequests.length) {
    return 'There are no leave requests listed in your dashboard data.';
  }

  return 'Here are your leave requests:\n' +
    data.leaveRequests.map((item, i) => {
      const type = item.type || item.leaveType || item.title || 'Leave';
      const status = item.status || 'Status not specified';
      const dates = item.startDate && item.endDate
        ? ` (${item.startDate} to ${item.endDate})`
        : '';

      return `${i + 1}. ${type}${dates} — ${status}`;
    }).join('\n');
}

router.post('/chat', requireAuth, (req, res) => {
  try {
    const original = String(req.body?.text || '').trim();

    if (!original) {
      return reply(res, 'Type a message and I will help you.');
    }

    const text = normalizeText(original);
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
        sections.push(listProjects(data));
        memory.lastTopic = 'projects';

        if (data.projects.length) {
          memory.lastProject = projectTitle(data.projects[0]);
        }
      }

      if (wantsMeetings) {
        sections.push(listMeetings(data));
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
          `You have ${data.projects.length} projects in total.`
        );
      }

      if (
        wantsMeetingCount ||
        (wantsGenericCount && wantsMeetings && !wantsProjects)
      ) {
        sections.push(
          `You have ${data.meetings.length} meetings in total.`
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
        sections.push(leaveBalanceReply(data));
      }

      if (wantsLeaveRequests) {
        sections.push(leaveRequestsReply(data));
      }

      if (sections.length) {
        return reply(res, sections.join('\n\n'));
      }
    }

    // GREETINGS

    if (/^(hi|hello|hey|good morning|good afternoon|good evening)$/.test(text)) {
      return reply(
        res,
        'Hey! 👋 I’m Byte. I can help with projects, meetings, leave, your profile, notifications, FAQs, and support. What would you like to do?'
      );
    }

    if (has(text, ['thank you', 'thanks', 'you are helpful'])) {
      return reply(res, 'You’re welcome! 😊 What would you like to do next?');
    }

    if (has(text, ['who are you', 'what are you', 'your name'])) {
      return reply(
        res,
        'I’m Byte, your dashboard assistant. I can answer questions using the dashboard data provided to me and help with supported dashboard actions.'
      );
    }

    if (has(text, ['what can you do', 'show commands', 'how can you help'])) {
      return reply(
        res,
        'You can ask me about projects, meetings, profile information, leave balances and requests. I can also open dashboard sections and help add or remove projects and meetings.'
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
        `You have ${data.projects.length} projects in your dashboard.`
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
        `You have ${data.meetings.length} meetings in your dashboard.`
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
      return reply(res, 'Opening your dashboard.', 'open_dashboard');
    }

    if (has(text, ['open notification', 'show notification', 'my alerts', 'notifications'])) {
      return reply(res, 'Opening your notifications.', 'open_notifications');
    }

    if (has(text, ['open faq', 'show faq', 'faq page', 'frequently asked'])) {
      return reply(res, 'Opening the FAQs.', 'open_faq');
    }

    if (has(text, ['open support', 'contact support', 'support page', 'help desk'])) {
      return reply(res, 'Opening the support section.', 'open_support');
    }

    if (has(text, ['open profile', 'view profile', 'show profile', 'my profile', 'profile page', 'edit profile'])) {
      return reply(res, 'Opening your profile.', 'open_profile');
    }

    if (has(text, ['apply for leave', 'request leave', 'take leave', 'leave application', 'open leave form'])) {
      return reply(res, 'Opening the leave request form.', 'open_leave_form');
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

      return reply(res, listProjects(data));
    }

    if (has(text, ['how many projects', 'project count', 'number of projects', 'count projects'])) {
      memory.lastTopic = 'projects';
      return reply(res, `You currently have ${data.projects.length} projects.`);
    }

    if (has(text, ['add project', 'create project', 'new project', 'start project'])) {
      const title = extractTitle(text, ['add', 'create', 'start'], 'project');

      if (!title || ['project', 'a project', 'new project'].includes(title)) {
        return reply(res, 'What should the project be called? Example: Add project Employee Portal.');
      }

      return reply(
        res,
        `Adding project "${title}".`,
        'create_project',
        { project: { title, details: 'not started' } }
      );
    }

    if (has(text, ['delete project', 'remove project'])) {
      const title = extractTitle(text, ['delete', 'remove'], 'project');

      if (!title || title === 'project') {
        return reply(res, 'Which project should I remove? Please include its title.');
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
        `Please confirm the removal of "${projectTitle(project)}".`,
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
          title: rename ? rename[2].trim() : projectTitle(project),
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
          time: match[2].trim(),
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

      return reply(res, listMeetings(data));
    }

    if (has(text, ['how many meetings', 'meeting count', 'number of meetings', 'count meetings'])) {
      memory.lastTopic = 'meetings';
      return reply(res, `You currently have ${data.meetings.length} meetings.`);
    }

    if (has(text, ['add meeting', 'create meeting', 'new meeting', 'schedule meeting'])) {
      const title = extractTitle(text, ['add', 'create', 'schedule'], 'meeting');

      if (!title || ['meeting', 'a meeting', 'new meeting'].includes(title)) {
        return reply(res, 'What should the meeting be called? Example: Add meeting Project Review.');
      }

      return reply(
        res,
        `Adding meeting "${title}".`,
        'create_meeting',
        { meeting: { title, time: '', details: '' } }
      );
    }

    if (has(text, ['delete meeting', 'remove meeting', 'cancel meeting'])) {
      const title = extractTitle(text, ['delete', 'remove', 'cancel'], 'meeting');

      if (!title || title === 'meeting') {
        return reply(res, 'Which meeting should I remove? Please include its title.');
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
        `Please confirm the removal of "${meetingTitle(meeting)}".`,
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
      return reply(res, leaveBalanceReply(data));
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

    return reply(
      res,
      `I didn't quite understand "${original}". You can ask me about projects, meetings, leave, your profile, or dashboard sections. You can also ask a follow-up question about the projects or meetings you just viewed.`
    );

  } catch (error) {
    console.error('Byte AI error:', error);

    return res.status(500).json({
      reply: 'Something went wrong while processing your message. Please try again.'
    });
  }
});

module.exports = router;