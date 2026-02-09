const REPO = 'yuribeats/the-boards';
const NEWS_PATH = 'data/news.json';
const BRANCH = 'main';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(200).json({ posts: [] });

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${NEWS_PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!resp.ok) return res.status(200).json({ posts: [] });
    const data = await resp.json();
    const posts = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    posts.sort((a, b) => Number(b.id) - Number(a.id));
    return res.status(200).json({ posts });
  } catch {
    return res.status(200).json({ posts: [] });
  }
}
