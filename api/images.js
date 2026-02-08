import { readdir } from 'fs/promises';
import { join } from 'path';

export default async function handler(req, res) {
  try {
    const dir = join(process.cwd(), 'images');
    const files = await readdir(dir);
    const images = files
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .sort((a, b) => b.localeCompare(a));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ images });
  } catch (err) {
    return res.status(200).json({ images: [] });
  }
}
