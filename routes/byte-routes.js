const express = require('express');

const router = express.Router();

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  return res.status(401).json({
    error: 'Not authenticated'
  });
}

router.post('/chat', requireAuth, async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();

    if (!text) {
      return res.status(400).json({
        error: 'Message is empty.'
      });
    }

    const lower = text.toLowerCase();

    const dashboard = req.body?.dashboard || {};
    const user = dashboard.user || {};
    const profile = dashboard.profile || {};
    const projects = Array.isArray(dashboard.projects)
      ? dashboard.projects
      : [];
    const meetings = Array.isArray(dashboard.meetings)
      ? dashboard.meetings
      : [];
    const leaveBalances = dashboard.leaveBalances || {};
    const leaveRequests = Array.isArray(dashboard.leaveRequests)
      ? dashboard.leaveRequests
      : [];

    // =========================================================
    // DASHBOARD
    // =========================================================

    if (
      lower === 'open dashboard' ||
      lower === 'show dashboard' ||
      lower.includes('dashboard overview') ||
      lower === 'home'
    ) {
      return res.json({
        action: 'open_dashboard',
        reply: 'Opening your dashboard.'
      });
    }

    // =========================================================
    // NOTIFICATIONS
    // =========================================================

    if (
      lower.includes('open notification') ||
      lower.includes('show notification') ||
      lower.includes('notifications') ||
      lower.includes('notification bell') ||
      lower === 'bell'
    ) {
      return res.json({
        action: 'open_notifications',
        reply: 'Opening your notifications.'
      });
    }

    // =========================================================
    // FAQ
    // =========================================================

    if (
      lower.includes('open faq') ||
      lower.includes('show faq') ||
      lower.includes('faq') ||
      lower.includes('frequently asked')
    ) {
      return res.json({
        action: 'open_faq',
        reply: 'Opening the FAQ section.'
      });
    }

    // =========================================================
    // SUPPORT
    // =========================================================

    if (
      lower.includes('open support') ||
      lower.includes('contact support') ||
      lower.includes('help desk') ||
      lower === 'support'
    ) {
      return res.json({
        action: 'open_support',
        reply: 'Opening support.'
      });
    }

    // =========================================================
    // PROFILE
    // =========================================================

    if (
      lower.includes('open profile') ||
      lower.includes('view profile') ||
      lower.includes('show profile')
    ) {
      return res.json({
        action: 'open_profile',
        reply: 'Opening your profile.'
      });
    }

    if (
      lower.includes('my profile') ||
      lower.includes('my details') ||
      lower.includes('my information') ||
      lower.includes('who am i')
    ) {
      const name = user.name || user.username || 'User';

      let reply = `Name: ${name}`;

      if (profile.email) {
        reply += `\nEmail: ${profile.email}`;
      }

      if (profile.phone) {
        reply += `\nPhone: ${profile.phone}`;
      }

      if (profile.role) {
        reply += `\nRole: ${profile.role}`;
      }

      if (profile.location) {
        reply += `\nLocation: ${profile.location}`;
      }

      if (profile.about) {
        reply += `\nAbout: ${profile.about}`;
      }

      return res.json({ reply });
    }

    // =========================================================
    // PROJECT COUNT / LIST
    // =========================================================

    if (
      lower === 'projects' ||
      lower.includes('how many projects') ||
      lower.includes('project count') ||
      lower.includes('number of projects')
    ) {
      return res.json({
        reply: `You currently have ${projects.length} project${projects.length === 1 ? '' : 's'}.`
      });
    }

    if (
      lower.includes('show projects') ||
      lower.includes('list projects') ||
      lower.includes('my projects')
    ) {
      if (!projects.length) {
        return res.json({
          reply: 'You currently have no projects.'
        });
      }

      const list = projects
        .map((p, i) => {
          return `${i + 1}. ${p.title} — ${p.details || 'no status'}`;
        })
        .join('\n');

      return res.json({
        reply: `Your projects:\n${list}`
      });
    }

    // =========================================================
    // CREATE PROJECT
    // =========================================================

    if (
      lower.includes('add project') ||
      lower.includes('create project') ||
      lower.includes('new project')
    ) {
      const title = text
        .replace(/add project/i, '')
        .replace(/create project/i, '')
        .replace(/new project/i, '')
        .replace(/called/i, '')
        .trim();

      if (!title) {
        return res.json({
          action: 'open_project_form',
          reply: 'Opening the Add Project form.'
        });
      }

      return res.json({
        action: 'create_project',
        project: {
          title,
          details: 'not started'
        },
        reply: `I can add the project "${title}".`
      });
    }

    // =========================================================
    // DELETE PROJECT
    // =========================================================

    if (
      lower.includes('delete project') ||
      lower.includes('remove project')
    ) {
      const title = text
        .replace(/delete project/i, '')
        .replace(/remove project/i, '')
        .trim();

      if (!title) {
        return res.json({
          reply: 'Which project should I delete?'
        });
      }

      return res.json({
        action: 'delete_project',
        title,
        reply: `I found the project "${title}".`
      });
    }

    // =========================================================
    // MEETING COUNT / LIST
    // =========================================================

    if (
      lower === 'meetings' ||
      lower.includes('how many meetings') ||
      lower.includes('meeting count') ||
      lower.includes('number of meetings')
    ) {
      return res.json({
        reply: `You currently have ${meetings.length} meeting${meetings.length === 1 ? '' : 's'}.`
      });
    }

    if (
      lower.includes('show meetings') ||
      lower.includes('list meetings') ||
      lower.includes('my meetings') ||
      lower.includes('my schedule')
    ) {
      if (!meetings.length) {
        return res.json({
          reply: 'You currently have no meetings.'
        });
      }

      const list = meetings
        .map((m, i) => {
          return `${i + 1}. ${m.title} — ${m.time || 'time not set'}`;
        })
        .join('\n');

      return res.json({
        reply: `Your meetings:\n${list}`
      });
    }

    // =========================================================
    // CREATE MEETING
    // =========================================================

    if (
      lower.includes('add meeting') ||
      lower.includes('create meeting') ||
      lower.includes('new meeting')
    ) {
      const title = text
        .replace(/add meeting/i, '')
        .replace(/create meeting/i, '')
        .replace(/new meeting/i, '')
        .replace(/called/i, '')
        .trim();

      if (!title) {
        return res.json({
          action: 'open_meeting_form',
          reply: 'Opening the Add Meeting form.'
        });
      }

      return res.json({
        action: 'create_meeting',
        meeting: {
          title,
          time: '',
          details: ''
        },
        reply: `I can add the meeting "${title}".`
      });
    }

    // =========================================================
    // DELETE MEETING
    // =========================================================

    if (
      lower.includes('delete meeting') ||
      lower.includes('remove meeting')
    ) {
      const title = text
        .replace(/delete meeting/i, '')
        .replace(/remove meeting/i, '')
        .trim();

      if (!title) {
        return res.json({
          reply: 'Which meeting should I delete?'
        });
      }

      return res.json({
        action: 'delete_meeting',
        title,
        reply: `I found the meeting "${title}".`
      });
    }

    // =========================================================
    // LEAVE BALANCE
    // =========================================================

    if (
      lower.includes('leave balance') ||
      lower.includes('leave remaining') ||
      lower.includes('how much leave') ||
      lower.includes('how many leaves') ||
      lower.includes('leaves left') ||
      lower.includes('remaining leave')
    ) {
      const keys = Object.keys(leaveBalances).sort();

      if (!keys.length) {
        return res.json({
          reply: 'You have no leave balance recorded yet.'
        });
      }

      const latestKey = keys[keys.length - 1];
      const remaining = Number(leaveBalances[latestKey] || 0);

      return res.json({
        reply: `You have ${remaining} paid leave${remaining === 1 ? '' : 's'} remaining.`
      });
    }

    // =========================================================
    // PENDING LEAVE
    // =========================================================

    if (
      lower.includes('pending leave') ||
      lower.includes('leave requests') ||
      lower.includes('leave request status')
    ) {
      const pending = leaveRequests.filter(
        r => r.status === 'pending'
      );

      if (!pending.length) {
        return res.json({
          reply: 'You have no pending leave requests.'
        });
      }

      const list = pending
        .map(
          (r, i) =>
            `${i + 1}. ${r.date} — ${r.type === 'half' ? 'Half day' : 'Full day'}`
        )
        .join('\n');

      return res.json({
        reply:
          `You have ${pending.length} pending leave request${pending.length === 1 ? '' : 's'}:\n${list}`
      });
    }

    // =========================================================
    // APPLY FOR LEAVE
    // =========================================================

    if (
      (lower.includes('apply') ||
        lower.includes('request') ||
        lower.includes('take')) &&
      (
        lower.includes('leave') ||
        lower.includes('half day') ||
        lower.includes('half-day')
      )
    ) {
      return res.json({
        action: 'open_leave_form',
        reply: 'I opened the Apply Leave form for you.'
      });
    }

    // =========================================================
    // LOGOUT
    // =========================================================

    if (
      lower.includes('log out') ||
      lower.includes('logout') ||
      lower.includes('sign out')
    ) {
      return res.json({
        reply: 'Use the Log out button in the top-right corner.'
      });
    }

    // =========================================================
    // SECURITY
    // =========================================================

    if (
      lower.includes('secure') ||
      lower.includes('security')
    ) {
      return res.json({
        reply:
          'Dashboard security depends on authentication, session handling, authorization and HTTPS configuration.'
      });
    }

    // =========================================================
    // GREETINGS
    // =========================================================

    if (
      lower === 'hi' ||
      lower === 'hello' ||
      lower === 'hey' ||
      lower.includes('good morning') ||
      lower.includes('good afternoon') ||
      lower.includes('good evening')
    ) {
      return res.json({
        reply:
          `Hi ${user.name || user.username || 'there'}! I'm Byte. I can help with your dashboard, projects, meetings, profile, notifications, FAQs, support and leave.`
      });
    }

    // =========================================================
    // DEFAULT
    // =========================================================

    return res.json({
      reply:
        'I can help with your dashboard, projects, meetings, profile, notifications, FAQs, support and leave requests.'
    });

  } catch (err) {
    console.error('Byte error:', err);

    return res.status(500).json({
      error: 'Byte could not process the request.'
    });
  }
});

module.exports = router;