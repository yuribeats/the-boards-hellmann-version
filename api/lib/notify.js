const REPO = 'yuribeats/the-boards-hellmann-version';
const BRANCH = 'main';
const NOTIF_PATH = 'data/notifications.json';

export async function sendNotifications({ type, actor, title, body, token }) {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM_EMAIL;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!resendKey && !twilioSid) return;

    const resp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${NOTIF_PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!resp.ok) return;

    const data = await resp.json();
    const prefs = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));

    const message = title + (body ? ' — ' + body : '');

    const sends = [];

    for (const [user, p] of Object.entries(prefs)) {
      if (user === actor) continue;
      if (!p[type]) continue;

      if (p.email && resendKey && resendFrom) {
        sends.push(
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: resendFrom,
              to: p.email,
              subject: 'The Boards — ' + title,
              text: message
            })
          }).catch(() => {})
        );
      }

      if (p.phone && twilioSid && twilioAuth && twilioPhone) {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const params = new URLSearchParams({ To: p.phone, From: twilioPhone, Body: message });
        sends.push(
          fetch(twilioUrl, {
            method: 'POST',
            headers: {
              Authorization: 'Basic ' + Buffer.from(twilioSid + ':' + twilioAuth).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
          }).catch(() => {})
        );
      }
    }

    await Promise.allSettled(sends);
  } catch {}
}
