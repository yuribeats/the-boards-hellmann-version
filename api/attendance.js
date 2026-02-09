const REPO = 'yuribeats/the-boards-hellmann-version';
const FILE_PATH = 'data/attendance.json';
const BRANCH = 'main';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const { eventId } = req.query;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    const resp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );

    if (!resp.ok) {
      return res.status(200).json({ attendees: [] });
    }

    const data = await resp.json();
    const attendance = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));

    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json({ attendees: attendance[eventId] || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
