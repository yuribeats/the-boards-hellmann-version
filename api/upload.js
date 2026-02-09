const REPO = 'yuribeats/the-boards';
const GALLERY_PATH = 'data/gallery.json';
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
    const { image, imageExt, link } = req.body;
    if (!image || !imageExt) return res.status(400).json({ error: 'Image is required' });

    const id = Date.now().toString();
    const ext = imageExt.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
    const filename = 'gallery_' + id + '.' + ext;
    const imagePath = 'data/images/' + filename;

    const imgBody = JSON.stringify({
      message: 'Add gallery image ' + filename,
      content: image,
      branch: BRANCH
    });
    const imgResp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${imagePath}`,
      {
        method: 'PUT',
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: imgBody
      }
    );
    if (!imgResp.ok) throw new Error('Failed to upload image');

    let gallery = [];
    let sha = null;
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${GALLERY_PATH}?ref=${BRANCH}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        gallery = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        sha = data.sha;
      }
    } catch {}

    gallery.push({ id, image: filename, link: link || '' });

    const putBody = {
      message: 'Update gallery.json',
      content: Buffer.from(JSON.stringify(gallery, null, 2)).toString('base64'),
      branch: BRANCH
    };
    if (sha) putBody.sha = sha;

    const resp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${GALLERY_PATH}`,
      {
        method: 'PUT',
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody)
      }
    );
    if (!resp.ok) throw new Error('Failed to write gallery.json');

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
