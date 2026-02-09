const REPO = 'yuribeats/the-boards-hellmann-version';
const FILE_PATH = 'data/events.json';
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
    const { id, event, shortName, date, endDate, startTime, endTime, location, contact, site, repeatWeekly, repeatMonthly, repeatYearly } = req.body;
    if (!id) return res.status(400).json({ error: 'Event ID is required' });

    let events = [];
    let sha = null;
    const resp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (resp.ok) {
      const data = await resp.json();
      events = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      sha = data.sha;
    } else {
      return res.status(404).json({ error: 'Events not found' });
    }

    const idx = events.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Event not found' });

    if (event !== undefined) events[idx].event = event;
    if (shortName !== undefined) events[idx].shortName = shortName;
    if (date !== undefined) events[idx].date = date;
    if (endDate !== undefined) events[idx].endDate = endDate;
    if (startTime !== undefined) events[idx].startTime = startTime;
    if (endTime !== undefined) events[idx].endTime = endTime;
    if (location !== undefined) events[idx].location = location;
    if (contact !== undefined) events[idx].contact = contact;
    if (site !== undefined) events[idx].site = site;
    if (repeatWeekly !== undefined) events[idx].repeatWeekly = !!repeatWeekly;
    if (repeatMonthly !== undefined) events[idx].repeatMonthly = !!repeatMonthly;
    if (repeatYearly !== undefined) events[idx].repeatYearly = !!repeatYearly;

    const putBody = {
      message: 'Edit event: ' + (events[idx].event || id),
      content: Buffer.from(JSON.stringify(events, null, 2)).toString('base64'),
      branch: BRANCH
    };
    if (sha) putBody.sha = sha;

    const writeResp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
      {
        method: 'PUT',
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody)
      }
    );
    if (!writeResp.ok) throw new Error('Failed to write events.json');

    return res.status(200).json({ success: true, event: events[idx] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
