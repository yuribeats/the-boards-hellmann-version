const REPO = 'yuribeats/the-boards-hellmann-version';
const FILE_PATH = 'data/approved.json';
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
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const resp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!resp.ok) throw new Error('Failed to read approved.json');

    const data = await resp.json();
    let approved = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    const sha = data.sha;

    const before = approved.length;
    approved = approved.filter(e => e.id !== id);
    if (approved.length === before) return res.status(404).json({ error: 'Vendor not found' });

    const putBody = {
      message: 'Delete vendor: ' + id,
      content: Buffer.from(JSON.stringify(approved, null, 2)).toString('base64'),
      branch: BRANCH,
      sha
    };

    const writeResp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
      {
        method: 'PUT',
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody)
      }
    );
    if (!writeResp.ok) throw new Error('Failed to write approved.json');

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
