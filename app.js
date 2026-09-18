/* ============================================================
 * app.js — движок Mini App (v2)
 *
 * Что нового по сравнению с v1:
 *   • Точки ставятся не тапом, а кнопкой «Поставить точку» —
 *     берётся то, что под прицелом в центре canvas.
 *   • Панорамирование: один палец тянет фото.
 *   • Pinch-zoom двумя пальцами + кнопки +/- /⟲.
 *   • Точки хранятся в координатах ИЗОБРАЖЕНИЯ (nx, ny ∈ [0..1]),
 *     поэтому при зуме/пане остаются приклеены к лицу.
 *   • При переходе к расчёту в metrics.js передаётся aspect
 *     = высота_изображения / ширина_изображения.
 *
 * Зависит от: points.js (POINTS, EXAMPLE_IMG),
 *             metrics.js (calculateMetrics через scoring.js).
 * ============================================================ */

(() => {
  'use strict';

  /* ==================== TELEGRAM WEBAPP ==================== */
  const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (typeof tg.setHeaderColor === 'function')     tg.setHeaderColor('#1a1a1a');
      if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor('#1a1a1a');
      if (typeof tg.enableClosingConfirmation === 'function') tg.enableClosingConfirmation();
    } catch (e) {
      console.warn('Telegram WebApp API недоступен:', e);
    }
  }

  /* ==================== DOM ХЕЛПЕРЫ ==================== */
  const $ = (id) => document.getElementById(id);

  const screens = {
    welcome: $('screen-welcome'),
    points:  $('screen-points'),
    result:  $('screen-result')
  };

  const els = {
    fileInput:         $('file-input'),
    canvas:            $('canvas'),
    crosshair:         $('crosshair'),
    hintBox:           $('hint-box'),
    exampleBox:        $('example-box'),
    exampleImg:        $('example-img'),
    exampleDot:        $('example-dot'),
    pointProgress:     $('point-progress'),
    pointInstruction:  $('point-instruction'),
    btnReset:          $('btn-reset'),
    btnUndo:           $('btn-undo'),
    btnPlace:          $('btn-place'),
    btnNext:           $('btn-next'),
    btnZoomIn:         $('btn-zoom-in'),
    btnZoomOut:        $('btn-zoom-out'),
    btnZoomReset:      $('btn-zoom-reset'),
    btnRestart:        $('btn-restart'),
    scoreValue:        $('score-value'),
    scoreLabel:        $('score-label'),
    categoryBreakdown: $('category-breakdown'),
    metricsBreakdown:  $('metrics-breakdown')
  };

  for (const [key, el] of Object.entries(els)) {
    if (!el) console.error(`app.js: не найден элемент #${key}`);
  }
  if (!els.canvas) {
    console.error('app.js: критическая ошибка — canvas не найден');
    return;
  }
  const ctx = els.canvas.getContext('2d');
  if (!ctx) {
    console.error('app.js: 2d-контекст недоступен');
    return;
  }

  /* ==================== КОНСТАНТЫ ==================== */
  const MIN_ZOOM     = 1.0;
  const MAX_ZOOM     = 6.0;
  const ZOOM_STEP    = 1.25;
  const HINT_FLASH_MS = 900;

  /* ==================== СОСТОЯНИЕ ==================== */
  const state = {
    image:       null,       // HTMLImageElement
    imageLoaded: false,
    points:      [],         // [{ id, nx, ny }] — nx, ny ∈ [0..1] от изображения
    currentIndex: 0,
    zoom:        1.0,
    panX:        0,
    panY:        0,
    dpr:         window.devicePixelRatio || 1,
    exampleOk:   false,
    hintFlashTimer: null
  };

  // Активные указатели: Map pointerId → { x, y } в client-координатах
  const pointers = new Map();
  const panStart   = { x: 0, y: 0, panX: 0, panY: 0 };
  const pinchStart = { dist: 0, zoom: 1, centerX: 0, centerY: 0, panX: 0, panY: 0 };

  /* ==================== ЭКРАНЫ ==================== */
  function showScreen(name) {
    for (const [key, screen] of Object.entries(screens)) {
      if (!screen) continue;
      screen.classList.toggle('active', key === name);
    }
    window.scrollTo(0, 0);
    if (tg && typeof tg.setHeaderColor === 'function') tg.setHeaderColor('#1a1a1a');
  }

  /* ==================== РАЗМЕРЫ CANVAS ==================== */
  function setupCanvas() {
    const wrap = els.canvas.parentElement;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      requestAnimationFrame(setupCanvas);
      return;
    }
    state.dpr = window.devicePixelRatio || 1;
    els.canvas.width  = Math.round(rect.width  * state.dpr);
    els.canvas.height = Math.round(rect.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    clampPan();
    draw();
  }

  /* ==================== ГЕОМЕТРИЯ ОТРИСОВКИ ====================
   * Возвращает:
   *   W, H        — размеры canvas в CSS-пикселях
   *   baseW/baseH — размеры contain-вписывания (zoom=1, pan=0)
   *   left, top   — позиция левого верхнего угла изображения
   *   dw, dh      — размеры изображения с учётом зума
   * ============================================================ */
  function getLayout() {
    const W = els.canvas.width  / state.dpr;
    const H = els.canvas.height / state.dpr;

    if (!state.imageLoaded || !state.image) {
      return { W, H, baseW: 0, baseH: 0, left: 0, top: 0, dw: 0, dh: 0 };
    }

    const iw = state.image.naturalWidth  || state.image.width;
    const ih = state.image.naturalHeight || state.image.height;
    const baseScale = Math.min(W / iw, H / ih);
    const baseW = iw * baseScale;
    const baseH = ih * baseScale;

    const dw = baseW * state.zoom;
    const dh = baseH * state.zoom;

    const left = (W - dw) / 2 + state.panX;
    const top  = (H - dh) / 2 + state.panY;

    return { W, H, baseW, baseH, left, top, dw, dh };
  }

  /* ==================== ОГРАНИЧЕНИЕ ПАНА ====================
   * Если изображение шире/выше canvas — не даём утащить его полностью
   * за пределы. Если уже — центрируем.
   * ======================================================== */
  function clampPan() {
    const { W, H, baseW, baseH } = getLayout();
    if (!baseW || !baseH) return;

    const dw = baseW * state.zoom;
    const dh = baseH * state.zoom;

    let panXmin, panXmax;
    if (dw <= W) {
      panXmin = panXmax = 0;
    } else {
      panXmin = -(dw - W) / 2;
      panXmax =  (dw - W) / 2;
    }
    state.panX = Math.max(panXmin, Math.min(panXmax, state.panX));

    let panYmin, panYmax;
    if (dh <= H) {
      panYmin = panYmax = 0;
    } else {
      panYmin = -(dh - H) / 2;
      panYmax =  (dh - H) / 2;
    }
    state.panY = Math.max(panYmin, Math.min(panYmax, state.panY));
  }

  /* ==================== РИСОВАНИЕ ==================== */
  function draw() {
    const { W, H, left, top, dw, dh } = getLayout();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (!state.imageLoaded || !state.image) {
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Загрузка изображения…', W / 2, H / 2);
      return;
    }

    ctx.drawImage(state.image, left, top, dw, dh);

    // Точки поверх
    const n = state.points.length;
    for (let i = 0; i < n; i++) {
      const p  = state.points[i];
      const px = left + p.nx * dw;
      const py = top  + p.ny * dh;
      const isLast = (i === n - 1);

      ctx.beginPath();
      ctx.arc(px, py, isLast ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? 'rgba(255, 59, 59, 0.30)' : 'rgba(46, 166, 255, 0.22)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, isLast ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? '#ff3b3b' : '#2ea6ff';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
  }

  /* ==================== ПАН / ЗУМ ==================== */
  function zoomBy(factor) {
    const oldZoom = state.zoom;
    let newZoom = oldZoom * factor;
    newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    if (Math.abs(newZoom - oldZoom) < 1e-6) return;
    state.zoom = newZoom;
    clampPan();
    draw();
  }

  function resetView() {
    state.zoom = 1.0;
    state.panX = 0;
    state.panY = 0;
    clampPan();
    draw();
  }

  /* ==================== РАССТАНОВКА ТОЧЕК ==================== */
  function placePoint(nx, ny) {
    if (state.currentIndex >= POINTS.length) return;
    const meta = POINTS[state.currentIndex];
    state.points.push({ id: meta.id, nx, ny });
    state.currentIndex++;

    if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.selectionChanged === 'function') {
      try { tg.HapticFeedback.selectionChanged(); } catch (_) {}
    }

    console.log(`[point ${state.currentIndex}/${POINTS.length}] ${meta.id} → img(${nx.toFixed(3)}, ${ny.toFixed(3)})`);
    updateUI();
    draw();
  }

  function placePointAtCrosshair() {
    if (!state.imageLoaded) return;
    if (state.currentIndex >= POINTS.length) return;

    const { W, H, left, top, dw, dh } = getLayout();
    if (!dw || !dh) return;

    const cx = W / 2;
    const cy = H / 2;
    const nx = (cx - left) / dw;
    const ny = (cy - top)  / dh;

    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) {
      flashHint('Наведи прицел на лицо');
      if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.notificationOccurred === 'function') {
        try { tg.HapticFeedback.notificationOccurred('error'); } catch (_) {}
      }
      return;
    }

    placePoint(nx, ny);
  }

  function undo() {
    if (state.points.length === 0) return;
    const removed = state.points.pop();
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    console.log(`[undo] снята ${removed.id}, осталось ${state.points.length}`);
    updateUI();
    draw();
  }

  function resetAll() {
    state.points = [];
    state.currentIndex = 0;
    console.log('[reset] все точки сброшены');
    updateUI();
    draw();
  }

  /* ==================== UI ==================== */
  function flashHint(msg) {
    if (!els.hintBox) return;
    const prev = els.hintBox.textContent;
    els.hintBox.textContent = msg;
    if (state.hintFlashTimer) clearTimeout(state.hintFlashTimer);
    state.hintFlashTimer = setTimeout(() => {
      state.hintFlashTimer = null;
      updateUI();
    }, HINT_FLASH_MS);
  }

  function updateUI() {
    const total = POINTS.length;
    const idx   = state.currentIndex;

    if (idx < total) {
      const meta = POINTS[idx];
      els.pointProgress.textContent   = `Точка ${idx + 1} из ${total}`;
      if (!state.hintFlashTimer) els.hintBox.textContent = meta.hint;
      els.pointInstruction.textContent = meta.instruction;
      els.exampleDot.style.display = '';

      if (state.exampleOk) {
        els.exampleDot.style.left = meta.exampleX + '%';
        els.exampleDot.style.top  = meta.exampleY + '%';
      }
    } else {
      els.pointProgress.textContent    = `Все точки (${total})`;
      if (!state.hintFlashTimer) els.hintBox.textContent = 'Готово! Жми «Далее»';
      els.pointInstruction.textContent = 'Все ' + total + ' точек расставлены. Проверь ещё раз и жми «Далее».';
      els.exampleDot.style.display = 'none';
    }

    els.btnUndo.disabled  = (idx === 0);
    els.btnPlace.disabled = (idx >= total);
    els.btnNext.disabled  = (idx < total);
  }

  /* ==================== ОБРАБОТЧИКИ: УКАЗАТЕЛИ ==================== */
  function onPointerDown(ev) {
    if (ev.isPrimary === false && !pointers.has(ev.pointerId) && pointers.size >= 2) return;

    try { els.canvas.setPointerCapture(ev.pointerId); } catch (_) {}

    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (pointers.size === 1) {
      const p = pointers.values().next().value;
      panStart.x    = p.x;
      panStart.y    = p.y;
      panStart.panX = state.panX;
      panStart.panY = state.panY;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart.dist    = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      pinchStart.zoom    = state.zoom;
      pinchStart.centerX = (a.x + b.x) / 2;
      pinchStart.centerY = (a.y + b.y) / 2;
      pinchStart.panX    = state.panX;
      pinchStart.panY    = state.panY;
    }
    ev.preventDefault();
  }

  function onPointerMove(ev) {
    if (!pointers.has(ev.pointerId)) return;
    ev.preventDefault();

    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (pointers.size === 1) {
      const p  = pointers.values().next().value;
      const dx = p.x - panStart.x;
      const dy = p.y - panStart.y;
      state.panX = panStart.panX + dx;
      state.panY = panStart.panY + dy;
      clampPan();
      draw();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist    = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const centerX = (a.x + b.x) / 2;
      const centerY = (a.y + b.y) / 2;

      const scale = dist / pinchStart.dist;
      let newZoom = pinchStart.zoom * scale;
      newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      state.zoom = newZoom;

      state.panX = pinchStart.panX + (centerX - pinchStart.centerX);
      state.panY = pinchStart.panY + (centerY - pinchStart.centerY);

      clampPan();
      draw();
    }
  }

  function onPointerUp(ev) {
    if (!pointers.has(ev.pointerId)) return;
    pointers.delete(ev.pointerId);

    // Если остался ровно 1 палец — перезапускаем пан относительно него
    if (pointers.size === 1) {
      const p = pointers.values().next().value;
      panStart.x    = p.x;
      panStart.y    = p.y;
      panStart.panX = state.panX;
      panStart.panY = state.panY;
    }

    try { els.canvas.releasePointerCapture(ev.pointerId); } catch (_) {}
  }

  els.canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  els.canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  els.canvas.addEventListener('pointerup',   onPointerUp);
  els.canvas.addEventListener('pointercancel', onPointerUp);
  els.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Свайпы страницы по canvas не должны скроллить
  els.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  els.canvas.addEventListener('touchmove',  (e) => e.preventDefault(), { passive: false });

  /* ==================== ОБРАБОТЧИКИ: КНОПКИ ==================== */
  els.btnUndo.addEventListener('click', (e) => { e.preventDefault(); undo(); });
  els.btnReset.addEventListener('click', (e) => {
    e.preventDefault();
    if (state.points.length === 0) return;
    if (window.confirm('Сбросить все точки?')) resetAll();
  });
  els.btnPlace.addEventListener('click', (e) => { e.preventDefault(); placePointAtCrosshair(); });
  els.btnNext.addEventListener('click', (e) => {
    e.preventDefault();
    if (state.currentIndex < POINTS.length) return;
    goToResult();
  });
  els.btnZoomIn.addEventListener('click',    (e) => { e.preventDefault(); zoomBy(ZOOM_STEP); });
  els.btnZoomOut.addEventListener('click',   (e) => { e.preventDefault(); zoomBy(1 / ZOOM_STEP); });
  els.btnZoomReset.addEventListener('click', (e) => { e.preventDefault(); resetView(); });

  els.btnRestart.addEventListener('click', (e) => {
    e.preventDefault();
    resetAll();
    resetView();
    state.image = null;
    state.imageLoaded = false;
    els.fileInput.value = '';
    els.exampleDot.style.display = '';
    showScreen('welcome');
  });

  /* ==================== ЗАГРУЗКА ФОТО ==================== */
  els.fileInput.addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    loadImage(file);
  });

  function loadImage(file) {
    if (!file.type || !file.type.startsWith('image/')) {
      alert('Нужен файл изображения');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      alert('Фото слишком большое (макс. 25 МБ).');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => alert('Ошибка чтения файла');
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => alert('Не удалось декодировать изображение');
      img.onload = () => {
        state.image       = img;
        state.imageLoaded = true;
        state.points      = [];
        state.currentIndex = 0;
        state.zoom = 1;
        state.panX = 0;
        state.panY = 0;

        showScreen('points');
        requestAnimationFrame(() => {
          setupCanvas();
          updateUI();
        });
        ensureExampleLoaded();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ==================== ПРИМЕР ==================== */
  function ensureExampleLoaded() {
    if (state.exampleOk) return;
    els.exampleImg.addEventListener('error', () => {
      state.exampleOk = false;
      els.exampleBox.style.display = 'none';
      console.warn('app.js: example.jpg не найден — блок с примером скрыт');
    }, { once: true });
    els.exampleImg.addEventListener('load', () => {
      state.exampleOk = true;
      els.exampleBox.style.display = '';
      const meta = POINTS[state.currentIndex];
      if (meta) {
        els.exampleDot.style.left = meta.exampleX + '%';
        els.exampleDot.style.top  = meta.exampleY + '%';
      }
    }, { once: true });
    els.exampleImg.src = EXAMPLE_IMG;
  }

  /* ==================== RESIZE / VISIBILITY ==================== */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (screens.points.classList.contains('active')) {
        setupCanvas();
      }
    }, 150);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && screens.points.classList.contains('active')) {
      setupCanvas();
    }
  });

  /* ==================== РАСЧЁТ И РЕЗУЛЬТАТ ==================== */
  function goToResult() {
    if (!state.imageLoaded || !state.image) {
      alert('Фото не загружено');
      return;
    }

    const pointsByID = {};
    for (const p of state.points) {
      pointsByID[p.id] = { x: p.nx, y: p.ny };
    }

    const missing = [];
    for (const meta of POINTS) {
      if (!pointsByID[meta.id]) missing.push(meta.id);
    }
    if (missing.length) {
      alert('Не хватает ' + missing.length + ' точек.');
      return;
    }

    // Точки хранятся в координатах изображения → aspect = H / W
    const iw = state.image.naturalWidth  || state.image.width;
    const ih = state.image.naturalHeight || state.image.height;
    const aspect = ih / iw;

    let result;
    try {
      if (typeof calculateScore !== 'function') {
        throw new Error('calculateScore не определена (проверь scoring.js)');
      }
      result = calculateScore(pointsByID, aspect);
    } catch (err) {
      console.error('app.js: ошибка расчёта:', err);
      alert('Ошибка расчёта: ' + err.message);
      return;
    }

    try {
      renderResult(result);
    } catch (err) {
      console.error('app.js: ошибка отрисовки результата:', err);
      alert('Ошибка отображения результата. Смотри консоль.');
      return;
    }

    showScreen('result');

    if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.notificationOccurred === 'function') {
      try { tg.HapticFeedback.notificationOccurred('success'); } catch (_) {}
    }
  }

  /* ==================== РЕНДЕР РЕЗУЛЬТАТА ==================== */
  const TIER_LABELS = {
    T1: 'T1 — Ключевые',
    T2: 'T2 — Важные',
    T3: 'T3 — Средние',
    T4: 'T4 — Второстепенные',
    T5: 'T5 — Дополнительные'
  };
  const TIER_COLORS = {
    T1: '#2ea6ff',
    T2: '#4cd964',
    T3: '#ffb84d',
    T4: '#ff9d5c',
    T5: '#ff5c5c'
  };

  function renderResult(result) {
    if (!result || typeof result.score !== 'number') {
      throw new Error('некорректный результат расчёта');
    }

    els.scoreValue.textContent = result.score.toFixed(1);
    els.scoreLabel.textContent = result.label || 'Гармония лица';

    els.categoryBreakdown.innerHTML = '';
    const tiers = result.tiers || {};
    for (const key of ['T1', 'T2', 'T3', 'T4', 'T5']) {
      if (typeof tiers[key] !== 'number') continue;
      const v = Math.max(0, Math.min(100, tiers[key]));
      const row = document.createElement('div');
      row.className = 'cat-row';
      row.innerHTML =
        '<div class="cat-row-top">' +
          '<span>' + (TIER_LABELS[key] || key) + '</span>' +
          '<span>' + v.toFixed(1) + '%</span>' +
        '</div>' +
        '<div class="cat-bar">' +
          '<div class="cat-bar-fill" style="width:' + v + '%;background:' + (TIER_COLORS[key] || '#888') + '"></div>' +
        '</div>';
      els.categoryBreakdown.appendChild(row);
    }

    els.metricsBreakdown.innerHTML = '';
    const metrics = Array.isArray(result.metrics) ? result.metrics : [];
    for (const m of metrics) {
      if (!m || !m.name) continue;
      const valStr = (typeof m.value === 'number' && isFinite(m.value))
        ? m.value.toFixed(3) : '—';
      const scoreStr = (typeof m.score === 'number' && isFinite(m.score))
        ? m.score.toFixed(0) + '%' : '—';

      const row = document.createElement('div');
      row.className = 'metric-row';
      row.innerHTML =
        '<span class="name">' + escapeHtml(m.name) +
          (m.tier ? '<span class="tier-tag">' + escapeHtml(String(m.tier)) + '</span>' : '') +
        '</span>' +
        '<span class="value">' + escapeHtml(valStr) + ' · ' + escapeHtml(scoreStr) + '</span>';
      els.metricsBreakdown.appendChild(row);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ==================== BACK BUTTON ==================== */
  function bindBackButton() {
    if (!tg || !tg.BackButton) return;
    try {
      tg.BackButton.onClick(() => {
        if (screens.points.classList.contains('active') ||
            screens.result.classList.contains('active')) {
          showScreen('welcome');
        } else {
          tg.close();
        }
      });
    } catch (e) {
      console.warn('BackButton недоступен:', e);
    }
  }

  /* ==================== INIT ==================== */
  function init() {
    console.log('app.js v2: старт');
    console.log('points.js: получено ' + (Array.isArray(POINTS) ? POINTS.length : 0) + ' точек');

    if (!Array.isArray(POINTS) || POINTS.length === 0) {
      console.error('app.js: POINTS пуст — проверь points.js');
      return;
    }

    bindBackButton();
    ensureExampleLoaded();
    updateUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
