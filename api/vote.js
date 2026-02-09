const REPO = 'yuribeats/the-boards-hellmann-version';
const FILE_PATH = 'data/votes.json';
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
    const { newsId, username, optionIndex } = req.body;
    if (!newsId || !username || optionIndex === undefined) return res.status(400).json({ error: 'newsId, username, and optionIndex are required' });

    let votes = {};
    let sha = null;
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        votes = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        sha = data.sha;
      }
    } catch {}

    if (!votes[newsId]) votes[newsId] = {};

    for (const key of Object.keys(votes[newsId])) {
      votes[newsId][key] = votes[newsId][key].filter(n => n !== username);
    }

    const idx = String(optionIndex);
    if (!votes[newsId][idx]) votes[newsId][idx] = [];
    votes[newsId][idx].push(username);

    const putBody = {
      message: 'Vote on news ' + newsId,
      content: Buffer.from(JSON.stringify(votes, null, 2)).toString('base64'),
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
    if (!resp.ok) throw new Error('Failed to write votes.json');

    return res.status(200).json({ success: true, votes: votes[newsId] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
