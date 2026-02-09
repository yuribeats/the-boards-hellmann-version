import { sendNotifications } from './lib/notify.js';

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
    const { service, name, author, site, phone, email, neighborhood, description, image, imageExt } = req.body;
    if (!service || !name) return res.status(400).json({ error: 'Service and name are required' });

    const now = new Date();
    const dateUploaded = (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear();
    const id = Date.now().toString();

    const submission = {
      id,
      service: service || '',
      name: name || '',
      author: author || '',
      site: site || '',
      phone: phone || '',
      email: email || '',
      'date uploaded': dateUploaded,
      neighborhood: neighborhood || '',
      description: description || ''
    };

    if (image && imageExt) {
      const ext = imageExt.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
      const imageFilename = id + '.' + ext;
      const imagePath = 'data/images/' + imageFilename;
      await putImage(token, imagePath, image);
      submission.image = imageFilename;
    }

    let approved = [];
    let sha = null;
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        approved = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        sha = data.sha;
      }
    } catch {}

    approved.push(submission);

    const putBody = {
      message: 'Add listing: ' + name,
      content: Buffer.from(JSON.stringify(approved, null, 2)).toString('base64'),
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
    if (!resp.ok) throw new Error('Failed to write approved.json');

    sendNotifications({ type: 'vendors', actor: author, title: name, body: service, token }).catch(() => {});

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function putImage(token, path, base64Content) {
  const body = JSON.stringify({
    message: 'Add image ' + path,
    content: base64Content,
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
  if (!resp.ok) throw new Error('Failed to upload image');
}
