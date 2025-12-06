const fs = require('fs');          
const path = require('path');      

const CONTENT_DIR = path.join(__dirname, 'docs');

const OUTPUT_FILE = path.join(CONTENT_DIR, 'search-index.json');

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

function buildIndex() {
  console.log('開始建立搜尋索引...');

  const files = fs.readdirSync(CONTENT_DIR);
  const index = [];

  files.forEach((fileName) => {
    if (!fileName.toLowerCase().endsWith('.html')) return;

    if (fileName === '搜尋結果.html') return;

    const fullPath = path.join(CONTENT_DIR, fileName);
    const html = fs.readFileSync(fullPath, 'utf8');

    const title = getH2Title(html, fileName.replace('.html', ''));
    const text = stripHtmlTags(html); 

    index.push({
      url: fileName,  
      title: title,
      content: text   
    });
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2), 'utf8');
  console.log(`索引建立完成，共 ${index.length} 筆，已寫入：${OUTPUT_FILE}`);
}

buildIndex();