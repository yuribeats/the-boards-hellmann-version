import { sendNotifications } from './lib/notify.js';

const REPO = 'yuribeats/the-boards-hellmann-version';
const FILE_PATH = 'data/comments.json';
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
    const { newsId, username, text } = req.body;
    if (!newsId || !username || !text) return res.status(400).json({ error: 'newsId, username, and text are required' });

    let comments = {};
    let sha = null;
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        comments = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        sha = data.sha;
      }
    } catch {}

    if (!comments[newsId]) comments[newsId] = [];

    const now = new Date();
    const dateStr = (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear();

    comments[newsId].push({ name: username, text, date: dateStr });

    const putBody = {
      message: 'Add comment on news ' + newsId,
      content: Buffer.from(JSON.stringify(comments, null, 2)).toString('base64'),
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
    if (!resp.ok) throw new Error('Failed to write comments.json');

    sendNotifications({ type: 'comments', actor: username, title: username + ' commented', body: text.slice(0, 100), token }).catch(() => {});

    const participants = new Set();
    for (const c of comments[newsId]) {
      if (c.name && c.name !== username) participants.add(c.name);
    }
    try {
      const nr = await fetch(
        `https://api.github.com/repos/${REPO}/contents/data/news.json?ref=${BRANCH}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (nr.ok) {
        const nd = await nr.json();
        const newsList = JSON.parse(Buffer.from(nd.content, 'base64').toString('utf8'));
        const post = newsList.find(n => String(n.id) === String(newsId));
        if (post && post.author && post.author !== username) participants.add(post.author);
      }
    } catch {}
    if (participants.size > 0) {
      sendNotifications({ type: 'responses', actor: username, title: username + ' replied', body: text.slice(0, 100), token, onlyUsers: Array.from(participants) }).catch(() => {});
    }

    return res.status(200).json({ success: true, comments: comments[newsId] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
