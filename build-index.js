// build-index.js
// 用 Node 把 public 資料夾裡的 .html 掃一遍，產生 search-index.json

const fs = require('fs');          // 檔案系統模組
const path = require('path');      // 處理路徑用

// 🔧 你的網頁所在資料夾（這裡假設都在 public 底下）
const CONTENT_DIR = path.join(__dirname, 'docs');

// 🔧 輸出的索引檔案（放在 public 裡，之後前端會用 fetch 讀這個）
const OUTPUT_FILE = path.join(CONTENT_DIR, 'search-index.json');

// 把 HTML 內的標籤去掉，只留純文字
function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// 從 HTML 抓 <title>，抓不到就用備用名稱（通常是檔名）
function getTitle(html, fallbackName) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : fallbackName;
}

// 從 HTML 抓第一個 <h2> 當「頁面標題」，抓不到就退回 <title> 或檔名
function getH2Title(html, fallbackName) {
  const m = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (m) {
    // m[1] 可能裡面還有 <span> 之類，所以再 strip 一次
    return stripHtmlTags(m[1]).trim();
  }
  return getTitle(html, fallbackName);
}

// 主程式：建立索引
function buildIndex() {
  console.log('開始建立搜尋索引...');

  const files = fs.readdirSync(CONTENT_DIR);
  const index = [];

  files.forEach((fileName) => {
    // 只處理 .html 檔
    if (!fileName.toLowerCase().endsWith('.html')) return;

    // 可以選擇略過某些檔案（例如 搜尋結果頁本身）
    if (fileName === '搜尋結果.html') return;

    const fullPath = path.join(CONTENT_DIR, fileName);
    const html = fs.readFileSync(fullPath, 'utf8');

    const title = getH2Title(html, fileName.replace('.html', ''));
    const text = stripHtmlTags(html); // 整頁純文字

    index.push({
      url: fileName,  // 之後前端會用相對路徑開，例如 '手部戰技.html'
      title: title,
      content: text   // 用來搜尋、做摘要
    });
  });

  // 寫出 JSON 檔
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2), 'utf8');
  console.log(`索引建立完成，共 ${index.length} 筆，已寫入：${OUTPUT_FILE}`);
}

// 執行
buildIndex();