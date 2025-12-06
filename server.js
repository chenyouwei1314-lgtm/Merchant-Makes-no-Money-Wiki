const express = require('express');       
const fs = require('fs');                 
const path = require('path');             

const app = express();
const PORT = 3000;

const PUBLIC_DIR = path.join(__dirname, 'docs');
app.use(express.static(PUBLIC_DIR));

/**
 * @param {string} html
 * @returns {string}
 */
function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getTitle(html, fallbackName) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : fallbackName;
}

function getH2Title(html, fallbackName) {
  const m = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i); 
  if (m) {
    return stripHtmlTags(m[1]).trim();
  }
  return getTitle(html, fallbackName);
}

function makeSnippet(text, keyword) {
  const lowerText = text.toLowerCase();
  const lowerKey = keyword.toLowerCase();

  const index = lowerText.indexOf(lowerKey);
  if (index === -1) {
    return (text.slice(0, 80) || '') + '...';
  }

  const start = Math.max(0, index - 50);                  
  const end = Math.min(text.length, index + 50);          
  let snippet = text.slice(start, end).trim();

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

app.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.json([]);
  }

  let results = [];

  try {
    const files = fs.readdirSync(PUBLIC_DIR);

    files.forEach((fileName) => {
      if (!fileName.toLowerCase().endsWith('.html')) return;

      const fullPath = path.join(PUBLIC_DIR, fileName);
      const html = fs.readFileSync(fullPath, 'utf8');

      const text = stripHtmlTags(html);
      const lowerText = text.toLowerCase();

      if (lowerText.includes(q.toLowerCase())) {
        const title = getH2Title(html, fileName.replace('.html', ''));
        const snippet = makeSnippet(text, q);

        results.push({
          url: '/' + encodeURI(fileName),  
          title,
          snippet
        });
      }
    });
  } catch (err) {
    console.error('搜尋時 server 端發生錯誤：', err);
    return res.status(500).json({ error: 'search failed' });
  }

  res.json(results);
});

app.listen(PORT, () => {
  console.log(`伺服器啟動： http://localhost:${PORT}/首頁.html`);
});