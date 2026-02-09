const REPO = 'yuribeats/the-boards-hellmann-version';
const FILE_PATH = 'data/news.json';
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
    const { author, title, body, image, imageExt } = req.body;
    if (!body) return res.status(400).json({ error: 'Body is required' });

    const now = new Date();
    const dateStr = (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear();
    const id = Date.now().toString();

    const submission = {
      id,
      source: 'community',
      author: author || '',
      title: title || '',
      body: body || '',
      date: dateStr
    };

    if (image && imageExt) {
      const ext = imageExt.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
      const filename = 'news_' + id + '.' + ext;
      const imgResp = await fetch(
        `https://api.github.com/repos/${REPO}/contents/data/images/${filename}`,
        {
          method: 'PUT',
          headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Add news image ' + filename, content: image, branch: BRANCH })
        }
      );
      if (imgResp.ok) submission.image = filename;
    }

    let news = [];
    let sha = null;
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        news = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        sha = data.sha;
      }
    } catch {}

    news.push(submission);

    const putBody = {
      message: 'Add news: ' + (title || 'untitled'),
      content: Buffer.from(JSON.stringify(news, null, 2)).toString('base64'),
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
    if (!resp.ok) throw new Error('Failed to write news.json');

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
