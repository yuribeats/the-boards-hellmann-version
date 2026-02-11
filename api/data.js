const REPO = 'yuribeats/the-boards-hellmann-version';
const APPROVED_PATH = 'data/approved.json';
const BRANCH = 'main';

export default async function handler(req, res) {
  const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8g_eKM5vTHw_lfM5LGOKDGzJ3pYPq40J3XoY4es7RPF5e_BVCEkJ75jbaKxQiPMX9iL2Kd78mPT_P/pub?output=csv';

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch sheet');
    const csv = await response.text();

    const lines = parseCSV(csv);

    let headerRow = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].filter(c => c.trim() !== '').length >= 2) {
        headerRow = i;
        break;
      }
    }
    if (headerRow === -1) {
      return res.status(200).json({ lastUpdated: '', columns: [], rows: [] });
    }

    const columns = lines[headerRow].map(h => h.trim().toLowerCase()).filter(h => h !== '');
    let lastUpdated = '';
    const rows = [];

    for (let i = headerRow + 1; i < lines.length; i++) {
      const cols = lines[i];
      if (cols.length < 2 || cols.every(c => c.trim() === '')) continue;

      const row = {};
      for (let j = 0; j < columns.length; j++) {
        row[columns[j]] = (cols[j] || '').trim();
      }

      const dateVal = row['date uploaded'] || row['date'] || '';
      if (dateVal && isMoreRecent(dateVal, lastUpdated)) {
        lastUpdated = dateVal;
      }

      rows.push(row);
    }

    if (!columns.includes('author')) columns.push('author');
    const approved = await loadApproved();
    for (const item of approved) {
      const row = {};
      for (const col of columns) {
        row[col] = item[col] || '';
      }
      if (item.id) row.id = item.id;
      if (item.image) row.image = item.image;
      if (item.description) row.description = item.description;
      const dateVal = row['date uploaded'] || row['date'] || '';
      if (dateVal && isMoreRecent(dateVal, lastUpdated)) {
        lastUpdated = dateVal;
      }
      rows.push(row);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ lastUpdated, columns, rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function loadApproved() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [];
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${APPROVED_PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  } catch {
    return [];
  }
}

function parseCSV(text) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        current.push(field);
        field = '';
        if (current.some(c => c.trim() !== '')) rows.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  current.push(field);
  if (current.some(c => c.trim() !== '')) rows.push(current);

  return rows;
}

function isMoreRecent(dateA, dateB) {
  if (!dateB) return true;
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a.getTime())) return false;
  if (isNaN(b.getTime())) return true;
  return a > b;
}
