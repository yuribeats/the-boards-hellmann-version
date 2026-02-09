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
    const { id, name, service, phone, email, site, neighborhood, description } = req.body;
    if (!name || !service) return res.status(400).json({ error: 'Name and service are required' });

    let approved = [];
    let sha = null;
    const resp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (resp.ok) {
      const data = await resp.json();
      approved = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      sha = data.sha;
    }

    let idx = -1;
    if (id) idx = approved.findIndex(e => e.id === id);

    if (idx >= 0) {
      if (name !== undefined) approved[idx].name = name;
      if (service !== undefined) approved[idx].service = service;
      if (phone !== undefined) approved[idx].phone = phone;
      if (email !== undefined) approved[idx].email = email;
      if (site !== undefined) approved[idx].site = site;
      if (neighborhood !== undefined) approved[idx].neighborhood = neighborhood;
      if (description !== undefined) approved[idx].description = description;
    } else {
      const now = new Date();
      const dateUploaded = (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear();
      const entry = {
        id: Date.now().toString(),
        service: service || '',
        name: name || '',
        author: '',
        site: site || '',
        phone: phone || '',
        email: email || '',
        'date uploaded': dateUploaded,
        neighborhood: neighborhood || '',
        description: description || ''
      };
      approved.push(entry);
      idx = approved.length - 1;
    }

    const putBody = {
      message: 'Edit vendor: ' + (approved[idx].name || id),
      content: Buffer.from(JSON.stringify(approved, null, 2)).toString('base64'),
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
    if (!writeResp.ok) throw new Error('Failed to write approved.json');

    return res.status(200).json({ success: true, vendor: approved[idx] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
