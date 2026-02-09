const REPO = 'yuribeats/the-boards';
const NEWS_PATH = 'data/news.json';
const BRANCH = 'main';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const password = req.headers['x-admin-password'];
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const { title, body } = req.body;
    if (!body) return res.status(400).json({ error: 'Post body is required' });

    const now = new Date();
    const dateStr = (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear();

    const post = {
      id: Date.now().toString(),
      title: title || '',
      body: body || '',
      date: dateStr
    };

    let posts = [];
    let sha = null;

    try {
      const resp = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${NEWS_PATH}?ref=${BRANCH}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        posts = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        sha = data.sha;
      }
    } catch {}

    posts.push(post);

    const putBody = {
      message: 'Add news post',
      content: Buffer.from(JSON.stringify(posts, null, 2)).toString('base64'),
      branch: BRANCH
    };
    if (sha) putBody.sha = sha;

    const resp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${NEWS_PATH}`,
      {
        method: 'PUT',
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody)
      }
    );
    if (!resp.ok) throw new Error('Failed to write news.json');

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
