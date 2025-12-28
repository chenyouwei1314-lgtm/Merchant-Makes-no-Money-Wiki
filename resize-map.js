import sharp from "sharp";           // 圖片處理套件
import fs from "fs";                 // 檔案系統（檢查檔案是否存在、建立資料夾）
import path from "path";             // 路徑處理（跨平台）
import { fileURLToPath } from "url"; // 把 import.meta.url 轉成實體路徑

// ---- 1) 求出「專案根目錄」(以本檔案所在位置為基準) ----
const __filename = fileURLToPath(import.meta.url);     // 目前這支檔案的實體路徑
const __dirname = path.dirname(__filename);            // 目前這支檔案所在資料夾
const ROOT = __dirname;                                // 你把 resize-map.js 放在 repo root 時，ROOT 就是專案根目錄

// ---- 2) 設定原圖與輸出位置 ----
// 你可以把原圖放在 tools-src/world-map.png
const input = path.join(ROOT, "tools-src", "world-map.png"); // 原圖位置
const output = path.join(ROOT, "docs", "world-map.png");     // 輸出給網頁用（地區.html 用到的 world-map.png）

async function run() {
  // ✅ 檢查原圖存在
  if (!fs.existsSync(input)) {
    console.error("❌ 找不到原圖：", input);
    console.error("👉 請確認原圖是否放在：tools-src/world-map.png");
    return;
  }

  // ✅ 確保輸出資料夾 docs 存在
  fs.mkdirSync(path.dirname(output), { recursive: true });

  // ✅ 產生最大 500x500（不放大，只縮小）
  await sharp(input)
    .resize(2500, null,{
      fit: "inside",            // 等比例縮放，讓圖片「完整塞進 500x500 內」
      withoutEnlargement: true  // 如果原圖比 500x500 還小，不要硬放大
    })
    .toFile(output);

  console.log("✅ 產生完成：", output);
}

run();
