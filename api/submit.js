const REPO = 'yuribeats/the-boards';
const FILE_PATH = 'data/pending.json';
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
    const { service, name, site, phone, email, neighborhood, description, image, imageExt } = req.body;
    if (!service || !name) return res.status(400).json({ error: 'Service and name are required' });

    const now = new Date();
    const dateUploaded = (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear();
    const id = Date.now().toString();

    const submission = {
      id,
      service: service || '',
      name: name || '',
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

    const { content, sha } = await getFile(token);
    const pending = JSON.parse(content);
    pending.push(submission);
    await putFile(token, pending, sha);

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getFile(token) {
  const resp = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
    { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
  );
  if (!resp.ok) throw new Error('Failed to read pending.json');
  const data = await resp.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { content, sha: data.sha };
}

async function putFile(token, data, sha) {
  const body = JSON.stringify({
    message: 'Update pending.json',
    content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
    sha,
    branch: BRANCH
  });
  const resp = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
    {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body
    }
  );
  if (!resp.ok) throw new Error('Failed to write pending.json');
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
