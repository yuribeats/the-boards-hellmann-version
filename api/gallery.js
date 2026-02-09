const REPO = 'yuribeats/the-boards';
const GALLERY_PATH = 'data/gallery.json';
const BRANCH = 'main';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(200).json({ images: [] });

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${GALLERY_PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!resp.ok) return res.status(200).json({ images: [] });
    const data = await resp.json();
    const images = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    return res.status(200).json({ images });
  } catch {
    return res.status(200).json({ images: [] });
  }
}
