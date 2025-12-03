// 引入內建與第三方模組
const express = require('express');       // 網頁伺服器框架
const fs = require('fs');                 // 讀檔案用
const path = require('path');             // 處理路徑用

const app = express();
const PORT = 3000;

// 指定靜態檔案資料夾 (HTML / CSS / 圖片 全部從 public 讀)
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

/**
 * 簡單把 HTML 裡的標籤去掉，只留文字
 * @param {string} html
 * @returns {string}
 */
function stripHtmlTags(html) {
  // 用正則把 <...> 全部換成空白
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * 從 HTML 內容中抓 <title>，找不到就用備用名稱
 */
function getTitle(html, fallbackName) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : fallbackName;
}

/**
 * 做一小段關鍵字附近的摘要
 */
function makeSnippet(text, keyword) {
  const lowerText = text.toLowerCase();
  const lowerKey = keyword.toLowerCase();

  const index = lowerText.indexOf(lowerKey);
  if (index === -1) {
    // 找不到就回傳前 80 個字
    return (text.slice(0, 80) || '') + '...';
  }

  const start = Math.max(0, index - 40);                  // 前面多抓一些字
  const end = Math.min(text.length, index + 40);          // 後面多抓一些字
  let snippet = text.slice(start, end).trim();

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

/**
 * /search API：?q=關鍵字
 * 回傳 JSON 陣列：[{ url, title, snippet }, ...]
 */
app.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    // 沒輸入東西就回空陣列
    return res.json([]);
  }

  // 讀取 public 資料夾所有檔案
  const files = fs.readdirSync(PUBLIC_DIR);

  const results = [];

  files.forEach((fileName) => {
    // 只搜 .html 檔
    if (!fileName.toLowerCase().endsWith('.html')) return;

    const fullPath = path.join(PUBLIC_DIR, fileName);
    const html = fs.readFileSync(fullPath, 'utf8');

    const text = stripHtmlTags(html);
    const lowerText = text.toLowerCase();

    if (lowerText.includes(q.toLowerCase())) {
      const title = getH2Title(html, fileName.replace('.html', ''));
      // 從 HTML 內容抓第一個 <h2> 當標題，抓不到就退回原本的 <title> 或檔名
    function getH2Title(html, fallbackName) {
      const m = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i); // 抓第一個 <h2> ... </h2>
      if (m) {return stripHtmlTags(m[1]).trim();}
      return getTitle(html, fallbackName);}
    const snippet = makeSnippet(text, q);

      results.push({
        url: '/' + encodeURI(fileName),   // 網址：例如 /首頁.html
        title,
        snippet
      });
    }
  });

  res.json(results);
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`伺服器啟動： http://localhost:${PORT}/首頁.html`);
});
