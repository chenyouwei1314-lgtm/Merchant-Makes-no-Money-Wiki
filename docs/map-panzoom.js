(() => {
  const viewport = document.getElementById("map-viewport");
  const world = document.getElementById("map-world");
  const img = document.getElementById("map-image");

  if (!viewport || !world || !img) return;

  let vw = 0, vh = 0;          // viewport 寬高
  let iw = 0, ih = 0;          // 圖片原始寬高（naturalWidth/Height）

  let offsetX = 0;             // 平移 X
  let offsetY = 0;             // 平移 Y
  let scale = 1;               // 當前縮放

  let minScale = 1;            // 最小縮放（永遠 cover viewport，不露出黑底）
  const maxScale = 8;          // 最大縮放（可自行調整）

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  let rafPending = false;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // 計算「不露底」的最小縮放：一定取較大的（cover）
  function computeMinScale() {
    const scaleX = vw / iw;
    const scaleY = vh / ih;
    return Math.max(scaleX, scaleY);
  }

  function getBounds() {
    const w = iw * scale;
    const h = ih * scale;

    // 由於 minScale 會保證 w>=vw 且 h>=vh，正常情況下不會進入置中分支
    const minX = w <= vw ? (vw - w) / 2 : vw - w;
    const maxX = w <= vw ? (vw - w) / 2 : 0;

    const minY = h <= vh ? (vh - h) / 2 : vh - h;
    const maxY = h <= vh ? (vh - h) / 2 : 0;

    return { minX, maxX, minY, maxY };
  }

  function applyTransform() {
    rafPending = false;

    // 永遠先夾住縮放，避免縮太小露出黑底
    scale = clamp(scale, minScale, maxScale);

    // 夾住平移範圍
    const { minX, maxX, minY, maxY } = getBounds();
    offsetX = clamp(offsetX, minX, maxX);
    offsetY = clamp(offsetY, minY, maxY);

    world.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`;
  }

  function requestApply() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(applyTransform);
  }

  function recalcInitialView() {
    const rect = viewport.getBoundingClientRect();
    vw = rect.width;
    vh = rect.height;

    // 重新計算 minScale（cover，確保不露底）
    minScale = computeMinScale();

    const mobile = window.innerWidth < 720;

    // 初始縮放：
    // - 桌機：直接 cover（不露黑底）
    // - 手機：一開始看「左上角四分之一」=> 在 cover 的基礎上再放大 2 倍
    scale = mobile ? (minScale * 2) : minScale;

    // 初始位置
    if (mobile) {
      // 左上角（對齊到左上）
      offsetX = 0;
      offsetY = 0;
    } else {
      // 桌機：靠左 + 垂直置中
      offsetX = 0;
      offsetY = (vh - ih * scale) / 2;
    }

    requestApply();
  }

  // --- Drag (mouse) ---
  viewport.addEventListener("mousedown", (e) => {
    isDragging = true;
    viewport.classList.add("dragging");
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    // 1:1 跟手（滑鼠移多少就移多少）
    offsetX += dx;
    offsetY += dy;

    requestApply();
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    viewport.classList.remove("dragging");
  });

  // --- Drag (touch) ---
  viewport.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    isDragging = true;
    viewport.classList.add("dragging");
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  }, { passive: true });

  viewport.addEventListener("touchmove", (e) => {
    if (!isDragging || e.touches.length !== 1) return;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x;
    lastY = y;

    offsetX += dx;
    offsetY += dy;

    requestApply();
  }, { passive: true });

  window.addEventListener("touchend", () => {
    if (!isDragging) return;
    isDragging = false;
    viewport.classList.remove("dragging");
  });

  // --- Wheel zoom (cursor-centered) ---
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();

    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const prevScale = scale;

    // 滾輪縮放倍率（想更快/更慢就改 0.0012）
    const zoomFactor = Math.exp(-e.deltaY * 0.0012);

    // 先更新 scale，再夾到 [minScale, maxScale]（避免縮到露黑底）
    scale = clamp(scale * zoomFactor, minScale, maxScale);

    const actualFactor = scale / prevScale;

    // 以滑鼠所在點為中心縮放
    offsetX = mouseX - (mouseX - offsetX) * actualFactor;
    offsetY = mouseY - (mouseY - offsetY) * actualFactor;

    requestApply();
  }, { passive: false });

  // --- Init ---
  function initWhenReady() {
    iw = img.naturalWidth;
    ih = img.naturalHeight;
    if (!iw || !ih) return;

    recalcInitialView();
  }

  if (img.complete) initWhenReady();
  else img.addEventListener("load", initWhenReady);

  window.addEventListener("resize", () => {
    if (!ih) return;
    recalcInitialView();
  });
})();

