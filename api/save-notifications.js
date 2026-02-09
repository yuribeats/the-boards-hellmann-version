const REPO = 'yuribeats/the-boards-hellmann-version';
const FILE_PATH = 'data/notifications.json';
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
    const { username, email, phone, vendors, news, events, comments, responses } = req.body;
    if (!username) return res.status(400).json({ error: 'username is required' });

    let all = {};
    let sha = null;
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        all = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        sha = data.sha;
      }
    } catch {}

    all[username] = {
      email: email || '',
      phone: phone || '',
      vendors: !!vendors,
      news: !!news,
      events: !!events,
      comments: !!comments,
      responses: !!responses
    };

    const putBody = {
      message: 'Update notification prefs for ' + username,
      content: Buffer.from(JSON.stringify(all, null, 2)).toString('base64'),
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
    if (!resp.ok) throw new Error('Failed to write notifications.json');

    return res.status(200).json({ success: true, prefs: all[username] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
