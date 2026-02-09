const REPO = 'yuribeats/the-boards';
const PENDING_PATH = 'data/pending.json';
const APPROVED_PATH = 'data/approved.json';
const PENDING_NEWS_PATH = 'data/pending-news.json';
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
    const { id, action, type } = req.body;
    if (!id || !action) return res.status(400).json({ error: 'id and action required' });
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'action must be approve or reject' });
    }

    const isNews = type === 'news';
    const pendingPath = isNews ? PENDING_NEWS_PATH : PENDING_PATH;

    let pendingFile;
    try {
      pendingFile = await getFile(token, pendingPath);
    } catch {
      return res.status(404).json({ error: 'Pending file not found' });
    }
    const pending = JSON.parse(pendingFile.content);
    const idx = pending.findIndex(s => s.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Submission not found' });

    const submission = pending[idx];
    pending.splice(idx, 1);

    if (action === 'approve') {
      if (isNews) {
        const newsFile = await getFile(token, NEWS_PATH).catch(() => ({ content: '[]', sha: null }));
        const news = JSON.parse(newsFile.content);
        news.push({ id: submission.id, title: submission.title || '', body: submission.body || '', date: submission.date || '', image: submission.image || '' });
        await putFile(token, NEWS_PATH, news, newsFile.sha, 'Update news.json');
      } else {
        const approvedFile = await getFile(token, APPROVED_PATH);
        const approved = JSON.parse(approvedFile.content);
        approved.push(submission);
        await putFile(token, APPROVED_PATH, approved, approvedFile.sha, 'Update approved.json');
      }
    }

    await putFile(token, pendingPath, pending, pendingFile.sha, isNews ? 'Update pending-news.json' : 'Update pending.json');

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getFile(token, path) {
  const resp = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`,
    { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
  );
  if (!resp.ok) throw new Error('Failed to read ' + path);
  const data = await resp.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { content, sha: data.sha };
}

async function putFile(token, path, data, sha, message) {
  const body = JSON.stringify({
    message,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
    sha,
    branch: BRANCH
  });
  const resp = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body
    }
  );
  if (!resp.ok) throw new Error('Failed to write ' + path);
}
