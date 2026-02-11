import { sendNotifications } from './lib/notify.js';

const REPO = 'yuribeats/the-boards-hellmann-version';
const FILE_PATH = 'data/attendance.json';
const BRANCH = 'main';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const { eventId, username, attending, withKids, attendAll } = req.body;
    if (!eventId || !username) return res.status(400).json({ error: 'eventId and username are required' });

    let attendance = {};
    let sha = null;
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        attendance = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        sha = data.sha;
      }
    } catch {}

    if (!attendance[eventId]) attendance[eventId] = [];

    const list = attendance[eventId];
    const idx = list.findIndex(a => a.name === username);

    if (attending) {
      if (idx >= 0) {
        list[idx].withKids = !!withKids;
        list[idx].attendAll = !!attendAll;
      } else {
        list.push({ name: username, withKids: !!withKids, attendAll: !!attendAll });
      }
    } else {
      if (idx >= 0) list.splice(idx, 1);
    }

    const putBody = {
      message: 'Update attendance for event ' + eventId,
      content: Buffer.from(JSON.stringify(attendance, null, 2)).toString('base64'),
      branch: BRANCH
    };
    if (sha) putBody.sha = sha;

    const resp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
      {
        method: 'PUT',
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody)
      }
    );
    if (!resp.ok) throw new Error('Failed to write attendance.json');

    let eventName = 'an event';
    try {
      const er = await fetch(
        `https://api.github.com/repos/${REPO}/contents/data/events.json?ref=${BRANCH}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (er.ok) {
        const ed = await er.json();
        const eventsList = JSON.parse(Buffer.from(ed.content, 'base64').toString('utf8'));
        const ev = eventsList.find(e => String(e.id) === String(eventId));
        if (ev && ev.event) eventName = ev.event;
      }
    } catch {}
    sendNotifications({ type: 'responses', actor: username, title: username + (attending ? ' is attending ' : ' is not attending ') + eventName, body: '', token }).catch(() => {});

    return res.status(200).json({ success: true, attendees: attendance[eventId] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
