// build-index.js
// 功能：掃描資料夾內所有 .html，自動產生 search-index.json（給你的 搜尋結果.html 使用）

const fs = require("fs");              // 讀寫檔案用
const path = require("path");          // 處理路徑用

// 你網站檔案放的資料夾（通常就是專案根目錄）
// 若你把 html 放在 docs/ 或某個資料夾，改成那個資料夾即可
const ROOT_DIR = __dirname;

// 要忽略的檔案（不想被搜尋索引收錄）
const IGNORE = new Set([
  "搜尋結果.html",      // 搜尋結果頁通常不需要被索引
]);

// 把 HTML 粗略轉成純文字（避免把 script/css 也塞進索引）
function htmlToText(html) {
  // 1) 移除 script 與 style 區塊（避免索引把 JS/CSS 收進去）
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");

  // 2) 把所有標籤移除
  html = html.replace(/<[^>]+>/g, " ");

  // 3) 把多餘空白壓縮
  html = html.replace(/\s+/g, " ").trim();

  return html;
}

// 從 HTML 抓 <title> 文字（若抓不到就用檔名）
function extractTitle(html, fallbackName) {
  const m = html.match(/<title>(.*?)<\/title>/i);
  return m ? m[1].trim() : fallbackName;
}

function build() {
  // 讀取資料夾所有檔案
  const files = fs.readdirSync(ROOT_DIR);

  // 篩出 .html，並排除 IGNORE
  const htmlFiles = files.filter(f => f.endsWith(".html") && !IGNORE.has(f));

  const index = [];

  for (const file of htmlFiles) {
    const filePath = path.join(ROOT_DIR, file);               // 組成完整路徑
    const html = fs.readFileSync(filePath, "utf-8");          // 讀 HTML 文字

    const title = extractTitle(html, file);                   // 抓標題
    const content = htmlToText(html);                         // 轉純文字內容

    index.push({
      url: file,                                              // 連結網址（同資料夾就用檔名）
      title,
      content
    });
  }

  // 輸出成 search-index.json（美化縮排 2 格）
  const outPath = path.join(ROOT_DIR, "search-index.json");
  fs.writeFileSync(outPath, JSON.stringify(index, null, 2), "utf-8");

  console.log(`✅ 已更新 search-index.json，共 ${index.length} 筆`);
}

build();