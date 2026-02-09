const REPO = 'yuribeats/the-boards';
const FILE_PATH = 'data/pending-events.json';
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
    const { event, shortName, date, location, contact, site, image, imageExt, publishToNews } = req.body;
    if (!event || !date) return res.status(400).json({ error: 'Event name and date are required' });

    const now = new Date();
    const submittedStr = (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear();
    const id = Date.now().toString();

    const submission = {
      id,
      type: 'event',
      event: event || '',
      shortName: shortName || '',
      date: date || '',
      location: location || '',
      contact: contact || '',
      site: site || '',
      submitted: submittedStr,
      publishToNews: !!publishToNews
    };

    if (image && imageExt) {
      const ext = imageExt.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
      const filename = 'event_' + id + '.' + ext;
      const imgResp = await fetch(
        `https://api.github.com/repos/${REPO}/contents/data/images/${filename}`,
        {
          method: 'PUT',
          headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Add event image ' + filename, content: image, branch: BRANCH })
        }
      );
      if (imgResp.ok) submission.image = filename;
    }

    let pending = [];
    let sha = null;
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        pending = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        sha = data.sha;
      }
    } catch {}

    pending.push(submission);

    const putBody = {
      message: 'Add pending event submission',
      content: Buffer.from(JSON.stringify(pending, null, 2)).toString('base64'),
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
    if (!resp.ok) throw new Error('Failed to write pending-events.json');

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
