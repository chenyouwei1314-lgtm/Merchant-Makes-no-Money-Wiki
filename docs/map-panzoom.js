// map-panzoom.js
(() => {
  // ===== 取得 DOM 元素 =====
  const viewport = document.getElementById("map-viewport"); // 顯示窗口（固定大小、裁切用）
  const world = document.getElementById("map-world");       // 世界層（會 translate + scale）
  const img = document.getElementById("map-image");         // 地圖圖片（高解析建議）

  if (!viewport || !world || !img) return;

  // ===== viewport / image 尺寸 =====
  let vw = 0, vh = 0; // viewport 寬高
  let iw = 0, ih = 0; // image 原始寬高（naturalWidth/Height）

  // ===== 變換參數（核心三個）=====
  let offsetX = 0;    // 平移 X（px）
  let offsetY = 0;    // 平移 Y（px）
  let scale = 1;      // 縮放倍率

  // ===== 縮放限制 =====
  let minScale = 1;          // 最小縮放：cover（永遠不露底）
  const maxScale = 8;        // 最大縮放：你要避免放太大可調整

  // ===== 拖曳狀態（滑鼠/單指）=====
  let isDragging = false;
  let lastX = 0, lastY = 0;

  // ===== 慣性（inertia）=====
  let vx = 0, vy = 0;        // 速度（px/ms）
  let lastMoveTime = 0;      // 上一次 move 的時間戳（ms）
  let inertiaRAF = 0;        // 慣性動畫 rAF id

  // ===== Pinch（雙指縮放）=====
  let isPinching = false;    // 是否處於雙指縮放
  let pinchStartDist = 0;    // 雙指起始距離
  let pinchStartScale = 1;   // 雙指起始倍率
  let pinchCenterX = 0;      // 雙指中心（viewport 座標）
  let pinchCenterY = 0;

  // ===== rAF 合併更新（避免每次事件都重排）=====
  let rafPending = false;

  // ===== 小工具：夾值 =====
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // ===== 計算 cover 的最小縮放（不露黑底）=====
  function computeMinScale() {
    const scaleX = vw / iw;           // 要覆蓋寬度需要的倍率
    const scaleY = vh / ih;           // 要覆蓋高度需要的倍率
    return Math.max(scaleX, scaleY);  // cover：取較大者，確保至少填滿
  }

  // ===== 計算平移邊界（避免拖出空白）=====
  function getBounds() {
    const w = iw * scale; // 目前圖片顯示寬
    const h = ih * scale; // 目前圖片顯示高

    // 若圖片比 viewport 還小（理論上 minScale 已避免，但保險），就置中
    const minX = w <= vw ? (vw - w) / 2 : vw - w;
    const maxX = w <= vw ? (vw - w) / 2 : 0;

    const minY = h <= vh ? (vh - h) / 2 : vh - h;
    const maxY = h <= vh ? (vh - h) / 2 : 0;

    return { minX, maxX, minY, maxY };
  }

  // ===== 套用 transform（真正更新畫面）=====
  function applyTransform() {
    rafPending = false;

    // 先限制縮放範圍（4️⃣）
    scale = clamp(scale, minScale, maxScale);

    // 再限制平移範圍（避免露底）
    const { minX, maxX, minY, maxY } = getBounds();
    offsetX = clamp(offsetX, minX, maxX);
    offsetY = clamp(offsetY, minY, maxY);

    // 使用 translate3d 走 GPU 合成層，拖曳更順
    world.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`;
  }

  // ===== requestAnimationFrame 合併更新 =====
  function requestApply() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(applyTransform);
  }

  // ===== 停止慣性 =====
  function stopInertia() {
    if (inertiaRAF) cancelAnimationFrame(inertiaRAF);
    inertiaRAF = 0;
    vx = 0; vy = 0;
  }

  // ===== 啟動慣性（3️⃣）=====
  function startInertia() {
    // 如果速度很小，就不啟動
    const speed = Math.hypot(vx, vy);
    if (speed < 0.02) return; // px/ms 門檻（可調）

    stopInertia();

    let lastT = performance.now();

    // 摩擦係數（越小滑越久；越大停得越快）
    const friction = 0.92;

    function step(now) {
      const dt = now - lastT; // ms
      lastT = now;

      // 位置 += 速度 * dt
      offsetX += vx * dt;
      offsetY += vy * dt;

      // 每幀衰減速度（模擬摩擦）
      vx *= Math.pow(friction, dt / 16.7);
      vy *= Math.pow(friction, dt / 16.7);

      requestApply();

      // 速度低於門檻就停
      if (Math.hypot(vx, vy) < 0.02) {
        stopInertia();
        return;
      }

      inertiaRAF = requestAnimationFrame(step);
    }

    inertiaRAF = requestAnimationFrame(step);
  }

  // ===== 更新速度（給慣性用）=====
  function updateVelocity(dx, dy) {
    const now = performance.now();
    const dt = now - lastMoveTime;
    lastMoveTime = now;

    if (dt <= 0) return;

    // px/ms（用最近的移動估算速度）
    const newVx = dx / dt;
    const newVy = dy / dt;

    // 做一點點平滑（避免抖動）
    vx = vx * 0.7 + newVx * 0.3;
    vy = vy * 0.7 + newVy * 0.3;
  }

  // ===== 初始化視角（cover + 你原先的桌機/手機行為）=====
  function recalcInitialView() {
    const rect = viewport.getBoundingClientRect();
    vw = rect.width;
    vh = rect.height;

    // 重新計算 minScale（4️⃣）
    minScale = computeMinScale();

    const mobile = window.innerWidth < 720;

    // 初始倍率：桌機 cover；手機可先放大一點看左上角
    scale = mobile ? (minScale * 2) : minScale;

    // 初始位置
    if (mobile) {
      offsetX = 0;
      offsetY = 0;
    } else {
      offsetX = 0;
      offsetY = (vh - ih * scale) / 2;
    }

    requestApply();
  }

  // ===== 滾輪縮放（1️⃣ 已包含，保留）=====
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();

    // 滾輪縮放時，停止慣性（避免衝突）
    stopInertia();

    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; // viewport 內座標
    const mouseY = e.clientY - rect.top;

    const prevScale = scale;

    // 縮放速度：想更快/更慢改 0.0012
    const zoomFactor = Math.exp(-e.deltaY * 0.0012);

    // 先更新 scale，再 clamp 到 [minScale, maxScale]（4️⃣）
    scale = clamp(scale * zoomFactor, minScale, maxScale);

    const actualFactor = scale / prevScale;

    // 以滑鼠位置為中心縮放（1️⃣）
    offsetX = mouseX - (mouseX - offsetX) * actualFactor;
    offsetY = mouseY - (mouseY - offsetY) * actualFactor;

    requestApply();
  }, { passive: false });

  // ===== 滑鼠拖曳（1:1 + 慣性）=====
  viewport.addEventListener("mousedown", (e) => {
    // 開始拖曳前停止慣性
    stopInertia();

    isDragging = true;
    isPinching = false;
    viewport.classList.add("dragging");

    lastX = e.clientX;
    lastY = e.clientY;

    // 重置速度估算
    vx = 0; vy = 0;
    lastMoveTime = performance.now();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    // 1:1 跟手
    offsetX += dx;
    offsetY += dy;

    // 更新慣性速度
    updateVelocity(dx, dy);

    requestApply();
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;

    isDragging = false;
    viewport.classList.remove("dragging");

    // 放手後啟動慣性（3️⃣）
    startInertia();
  });

  // ===== 觸控：單指拖曳 + 雙指 pinch（2️⃣）=====
  function getTouchDist(t1, t2) {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.hypot(dx, dy);
  }

  function getTouchCenterInViewport(t1, t2) {
    const rect = viewport.getBoundingClientRect();
    const cx = (t1.clientX + t2.clientX) / 2 - rect.left;
    const cy = (t1.clientY + t2.clientY) / 2 - rect.top;
    return { cx, cy };
  }

  viewport.addEventListener("touchstart", (e) => {
    // 有任何觸控開始時，都先停慣性
    stopInertia();

    if (e.touches.length === 1) {
      // 單指：拖曳
      isDragging = true;
      isPinching = false;
      viewport.classList.add("dragging");

      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;

      vx = 0; vy = 0;
      lastMoveTime = performance.now();
      return;
    }

    if (e.touches.length === 2) {
      // 雙指：pinch zoom（2️⃣）
      isDragging = false;
      isPinching = true;
      viewport.classList.remove("dragging");

      const t1 = e.touches[0];
      const t2 = e.touches[1];

      pinchStartDist = getTouchDist(t1, t2);
      pinchStartScale = scale;

      const { cx, cy } = getTouchCenterInViewport(t1, t2);
      pinchCenterX = cx;
      pinchCenterY = cy;
    }
  }, { passive: true });

  viewport.addEventListener("touchmove", (e) => {
    if (isPinching && e.touches.length === 2) {
      // 雙指縮放：以雙指中心為縮放中心（2️⃣）
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const dist = getTouchDist(t1, t2);
      if (pinchStartDist <= 0) return;

      const prevScale = scale;

      // 新倍率 = 起始倍率 * (目前距離 / 起始距離)
      scale = pinchStartScale * (dist / pinchStartDist);

      // clamp 到 [minScale, maxScale]（4️⃣）
      scale = clamp(scale, minScale, maxScale);

      const actualFactor = scale / prevScale;

      // 以 pinch 中心為縮放中心（類似滑鼠中心縮放）
      offsetX = pinchCenterX - (pinchCenterX - offsetX) * actualFactor;
      offsetY = pinchCenterY - (pinchCenterY - offsetY) * actualFactor;

      requestApply();
      return;
    }

    if (isDragging && e.touches.length === 1) {
      // 單指拖曳（1:1 + 慣性速度）
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;

      const dx = x - lastX;
      const dy = y - lastY;

      lastX = x;
      lastY = y;

      offsetX += dx;
      offsetY += dy;

      updateVelocity(dx, dy);
      requestApply();
    }
  }, { passive: true });

  viewport.addEventListener("touchend", (e) => {
    // 雙指結束後，若剩下一指，不自動接拖曳（避免跳動），等下一次 touchstart 再開始
    if (isPinching && e.touches.length < 2) {
      isPinching = false;
    }

    // 單指拖曳放手 → 慣性（3️⃣）
    if (isDragging && e.touches.length === 0) {
      isDragging = false;
      viewport.classList.remove("dragging");
      startInertia();
    }
  });

  // ===== Init：等圖片載入後取得 naturalWidth/Height =====
  function initWhenReady() {
    iw = img.naturalWidth;
    ih = img.naturalHeight;
    if (!iw || !ih) return;

    recalcInitialView();
  }

  if (img.complete) initWhenReady();
  else img.addEventListener("load", initWhenReady);

  // ===== 視窗 resize：重算 minScale（4️⃣）並重置視角 =====
  window.addEventListener("resize", () => {
    if (!ih) return;
    stopInertia();
    recalcInitialView();
  });
})();

