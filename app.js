/* ============================================================
 * app.js — движок Mini App (v3)
 *
 * Что нового по сравнению с v2:
 *   • Пример в углу рисуется через ExampleFace.draw() на canvas —
 *     точки гарантированно совпадают с ориентирами.
 *   • Клик по метрике на экране результата открывает модалку
 *     с визуализацией: фото пользователя + линии/углы между
 *     точками, идеал, значение, допуск, балл, описание.
 *
 * Зависит от: points.js, example-face.js, metrics.js, scoring.js.
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

  /* ==================== DOM ==================== */
  const $ = (id) => document.getElementById(id);

  const screens = {
    welcome: $('screen-welcome'),
    points:  $('screen-points'),
    result:  $('screen-result')
  };

  const els = {
    fileInput:         $('file-input'),
    canvas:            $('canvas'),
    hintBox:           $('hint-box'),
    exampleBox:        $('example-box'),
    exampleCanvas:     $('example-canvas'),
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
    metricsBreakdown:  $('metrics-breakdown'),
    modal:             $('metric-modal'),
    modalOverlay:      document.querySelector('#metric-modal .modal-overlay'),
    modalClose:        $('btn-modal-close'),
    modalTitle:        $('modal-title'),
    modalDesc:         $('modal-desc'),
    modalCanvas:       $('modal-canvas'),
    modalIdeal:        $('modal-ideal'),
    modalValue:        $('modal-value'),
    modalTolerance:    $('modal-tolerance'),
    modalScore:        $('modal-score'),
    modalScoreFill:    $('modal-score-fill')
  };

  for (const [key, el] of Object.entries(els)) {
    if (!el) console.error(`app.js: не найден элемент #${key}`);
  }
  if (!els.canvas || !els.exampleCanvas || !els.modalCanvas) {
    console.error('app.js: критическая ошибка — не найдены canvas');
    return;
  }

  const ctx          = els.canvas.getContext('2d');
  const exampleCtx   = els.exampleCanvas.getContext('2d');
  const modalCtx     = els.modalCanvas.getContext('2d');
  if (!ctx || !exampleCtx || !modalCtx) {
    console.error('app.js: 2d-контексты недоступны');
    return;
  }

  /* ==================== КОНСТАНТЫ ==================== */
  const MIN_ZOOM = 1.0;
  const MAX_ZOOM = 6.0;
  const ZOOM_STEP = 1.25;
  const HINT_FLASH_MS = 900;

  /* ==================== СОСТОЯНИЕ ==================== */
  const state = {
    image:       null,
    imageLoaded: false,
    points:      [],       // [{ id, nx, ny }] — координаты изображения
    currentIndex: 0,
    zoom:        1.0,
    panX:        0,
    panY:        0,
    dpr:         window.devicePixelRatio || 1,
    hintFlashTimer: null,
    lastResult:  null      // результат последнего расчёта (для модалки)
  };

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

  /* ==================== CANVAS: ГЛАВНЫЙ ==================== */
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

  function clampPan() {
    const { W, H, baseW, baseH } = getLayout();
    if (!baseW || !baseH) return;
    const dw = baseW * state.zoom;
    const dh = baseH * state.zoom;

    let panXmin, panXmax;
    if (dw <= W) { panXmin = panXmax = 0; }
    else { panXmin = -(dw - W) / 2; panXmax = (dw - W) / 2; }
    state.panX = Math.max(panXmin, Math.min(panXmax, state.panX));

    let panYmin, panYmax;
    if (dh <= H) { panYmin = panYmax = 0; }
    else { panYmin = -(dh - H) / 2; panYmax = (dh - H) / 2; }
    state.panY = Math.max(panYmin, Math.min(panYmax, state.panY));
  }

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

  /* ==================== CANVAS: ПРИМЕР ==================== */
  function drawExample() {
    if (!window.ExampleFace || typeof ExampleFace.draw !== 'function') {
      return;
    }
    const wrap = els.exampleBox;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    els.exampleCanvas.width  = Math.round(rect.width  * dpr);
    els.exampleCanvas.height = Math.round(rect.height * dpr);

    exampleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    exampleCtx.clearRect(0, 0, rect.width, rect.height);

    const currentId = (state.currentIndex < POINTS.length)
      ? POINTS[state.currentIndex].id
      : null;

    ExampleFace.draw(exampleCtx, rect.width, rect.height, {
      showPoints:  true,
      highlightId: currentId
    });
  }

  /* ==================== ЗУМ ==================== */
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

  /* ==================== ТОЧКИ ==================== */
  function placePoint(nx, ny) {
    if (state.currentIndex >= POINTS.length) return;
    const meta = POINTS[state.currentIndex];
    state.points.push({ id: meta.id, nx, ny });
    state.currentIndex++;

    if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.selectionChanged === 'function') {
      try { tg.HapticFeedback.selectionChanged(); } catch (_) {}
    }

    console.log(`[point ${state.currentIndex}/${POINTS.length}] ${meta.id}`);
    updateUI();
    draw();
    drawExample();
  }

  function placePointAtCrosshair() {
    if (!state.imageLoaded) return;
    if (state.currentIndex >= POINTS.length) return;

    const { W, H, left, top, dw, dh } = getLayout();
    if (!dw || !dh) return;

    const nx = (W / 2 - left) / dw;
    const ny = (H / 2 - top)  / dh;

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
    state.points.pop();
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    updateUI();
    draw();
    drawExample();
  }

  function resetAll() {
    state.points = [];
    state.currentIndex = 0;
    updateUI();
    draw();
    drawExample();
  }

  /* ==================== UI ==================== */
  function flashHint(msg) {
    if (!els.hintBox) return;
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
      els.pointProgress.textContent    = `Точка ${idx + 1} из ${total}`;
      if (!state.hintFlashTimer) els.hintBox.textContent = meta.hint;
      els.pointInstruction.textContent = meta.instruction;
    } else {
      els.pointProgress.textContent    = `Все точки (${total})`;
      if (!state.hintFlashTimer) els.hintBox.textContent = 'Готово! Жми «Далее»';
      els.pointInstruction.textContent = 'Все ' + total + ' точек расставлены. Проверь и жми «Далее».';
    }

    els.btnUndo.disabled  = (idx === 0);
    els.btnPlace.disabled = (idx >= total);
    els.btnNext.disabled  = (idx < total);
  }

  /* ==================== ОБРАБОТЧИКИ УКАЗАТЕЛЕЙ ==================== */
  function onPointerDown(ev) {
    if (ev.isPrimary === false && !pointers.has(ev.pointerId) && pointers.size >= 2) return;
    try { els.canvas.setPointerCapture(ev.pointerId); } catch (_) {}
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (pointers.size === 1) {
      const p = pointers.values().next().value;
      panStart.x = p.x; panStart.y = p.y;
      panStart.panX = state.panX; panStart.panY = state.panY;
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
      state.panX = panStart.panX + (p.x - panStart.x);
      state.panY = panStart.panY + (p.y - panStart.y);
      clampPan();
      draw();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist    = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const centerX = (a.x + b.x) / 2;
      const centerY = (a.y + b.y) / 2;
      let newZoom = pinchStart.zoom * (dist / pinchStart.dist);
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
    if (pointers.size === 1) {
      const p = pointers.values().next().value;
      panStart.x = p.x; panStart.y = p.y;
      panStart.panX = state.panX; panStart.panY = state.panY;
    }
    try { els.canvas.releasePointerCapture(ev.pointerId); } catch (_) {}
  }

  els.canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  els.canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  els.canvas.addEventListener('pointerup',   onPointerUp);
  els.canvas.addEventListener('pointercancel', onPointerUp);
  els.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  els.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  els.canvas.addEventListener('touchmove',  (e) => e.preventDefault(), { passive: false });

  /* ==================== КНОПКИ ==================== */
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
    state.lastResult = null;
    els.fileInput.value = '';
    showScreen('welcome');
  });

  /* ==================== ЗАГРУЗКА ==================== */
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
        state.image        = img;
        state.imageLoaded  = true;
        state.points       = [];
        state.currentIndex = 0;
        state.zoom = 1;
        state.panX = 0;
        state.panY = 0;

        showScreen('points');
        requestAnimationFrame(() => {
          setupCanvas();
          updateUI();
          drawExample();
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ==================== RESIZE ==================== */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (screens.points.classList.contains('active')) {
        setupCanvas();
        drawExample();
      }
    }, 150);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && screens.points.classList.contains('active')) {
      setupCanvas();
      drawExample();
    }
  });

  /* ==================== РАСЧЁТ ==================== */
  function goToResult() {
    if (!state.imageLoaded || !state.image) {
      alert('Фото не загружено');
      return;
    }
    const pointsByID = {};
    for (const p of state.points) pointsByID[p.id] = { x: p.nx, y: p.ny };

    const missing = [];
    for (const meta of POINTS) {
      if (!pointsByID[meta.id]) missing.push(meta.id);
    }
    if (missing.length) {
      alert('Не хватает ' + missing.length + ' точек.');
      return;
    }

    const iw = state.image.naturalWidth  || state.image.width;
    const ih = state.image.naturalHeight || state.image.height;
    const aspect = ih / iw;

    let result;
    try {
      if (typeof calculateScore !== 'function') throw new Error('scoring.js не загружен');
      result = calculateScore(pointsByID, aspect);
    } catch (err) {
      console.error('app.js: ошибка расчёта:', err);
      alert('Ошибка расчёта: ' + err.message);
      return;
    }

    state.lastResult = result;

    try { renderResult(result); }
    catch (err) {
      console.error('app.js: ошибка отрисовки:', err);
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
    T1: '#2ea6ff', T2: '#4cd964', T3: '#ffb84d', T4: '#ff9d5c', T5: '#ff5c5c'
  };

  function renderResult(result) {
    if (!result || typeof result.score !== 'number') throw new Error('некорректный результат');

    els.scoreValue.textContent = result.score.toFixed(1);
    els.scoreLabel.textContent = result.label || 'Гармония лица';

    // Категории
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

    // Метрики — кликабельные
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
      row.dataset.metricId = m.id;
      row.innerHTML =
        '<span class="name">' + escapeHtml(m.name) +
          (m.tier ? '<span class="tier-tag">' + escapeHtml(String(m.tier)) + '</span>' : '') +
        '</span>' +
        '<span class="value">' + escapeHtml(valStr) + ' · ' + escapeHtml(scoreStr) + '</span>';
      row.addEventListener('click', () => openMetricModal(m.id));
      els.metricsBreakdown.appendChild(row);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ==================== МОДАЛКА МЕТРИКИ ==================== */
  function openMetricModal(metricId) {
    if (!state.lastResult) return;
    const metric = state.lastResult.metrics.find((m) => m.id === metricId);
    if (!metric) return;

    // Заполняем текстовые поля
    els.modalTitle.textContent = metric.name;
    els.modalDesc.textContent  = metric.description || '';
    els.modalIdeal.textContent = (typeof metric.ideal === 'number' && isFinite(metric.ideal))
      ? metric.ideal.toFixed(3) : '—';
    els.modalValue.textContent = (typeof metric.value === 'number' && isFinite(metric.value))
      ? metric.value.toFixed(3) : '—';
    els.modalTolerance.textContent = (typeof metric.tolerance === 'number' && isFinite(metric.tolerance))
      ? '±' + metric.tolerance.toFixed(3) : '—';
    els.modalScore.textContent = (typeof metric.score === 'number' && isFinite(metric.score))
      ? metric.score.toFixed(1) + '%' : '—';

    const scorePct = Math.max(0, Math.min(100, metric.score || 0));
    els.modalScoreFill.style.width = scorePct + '%';
    els.modalScoreFill.style.background =
      scorePct >= 75 ? '#4cd964' :
      scorePct >= 50 ? '#ffb84d' :
      scorePct >= 25 ? '#ff9d5c' : '#ff5c5c';

    // Показываем модалку
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    // Рисуем визуализацию на следующем кадре (когда размеры canvas известны)
    requestAnimationFrame(() => {
      drawMetricVisualization(metric);
    });

    if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.selectionChanged === 'function') {
      try { tg.HapticFeedback.selectionChanged(); } catch (_) {}
    }
  }

  function closeMetricModal() {
    els.modal.hidden = true;
    document.body.style.overflow = '';
  }

  els.modalClose.addEventListener('click', (e) => { e.preventDefault(); closeMetricModal(); });
  els.modalOverlay.addEventListener('click', (e) => { e.preventDefault(); closeMetricModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.modal.hidden) closeMetricModal();
  });

  /* ==================== ВИЗУАЛИЗАЦИЯ МЕТРИКИ ==================== */
  function buildPointMap() {
    // Собираем точки в формате {id: {x, y}} с уже применённым aspect,
    // как в metrics.js, плюс виртуальные точки.
    if (!state.image || !state.points.length) return null;

    const iw = state.image.naturalWidth  || state.image.width;
    const ih = state.image.naturalHeight || state.image.height;
    const aspect = ih / iw;

    const P = {};
    for (const p of state.points) {
      P[p.id] = { x: p.nx, y: p.ny * aspect };
    }
    // Виртуальные
    if (P.mouth_left && P.mouth_right) {
      P._mouth_center = {
        x: (P.mouth_left.x + P.mouth_right.x) / 2,
        y: (P.mouth_left.y + P.mouth_right.y) / 2
      };
    }
    if (P.pupil_left && P.pupil_right) {
      P._mid_pupils = {
        x: (P.pupil_left.x + P.pupil_right.x) / 2,
        y: (P.pupil_left.y + P.pupil_right.y) / 2
      };
    }
    if (P.brow_left_peak && P.brow_right_peak) {
      P._brow_line = {
        x: (P.brow_left_peak.x + P.brow_right_peak.x) / 2,
        y: (P.brow_left_peak.y + P.brow_right_peak.y) / 2
      };
    }
    return P;
  }

  function drawMetricVisualization(metric) {
    const rect = els.modalCanvas.parentElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = window.devicePixelRatio || 1;
    els.modalCanvas.width  = Math.round(rect.width  * dpr);
    els.modalCanvas.height = Math.round(rect.height * dpr);
    modalCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    modalCtx.clearRect(0, 0, rect.width, rect.height);

    const W = rect.width;
    const H = rect.height;

    // Фон
    modalCtx.fillStyle = '#000';
    modalCtx.fillRect(0, 0, W, H);

    if (!state.image) {
      modalCtx.fillStyle = '#666';
      modalCtx.font = '13px sans-serif';
      modalCtx.textAlign = 'center';
      modalCtx.textBaseline = 'middle';
      modalCtx.fillText('Фото не загружено', W / 2, H / 2);
      return;
    }

    // Фото вписываем по contain, но с aspect изображения
    const iw = state.image.naturalWidth  || state.image.width;
    const ih = state.image.naturalHeight || state.image.height;
    const scale = Math.min(W / iw, H / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;

    modalCtx.drawImage(state.image, dx, dy, dw, dh);

    // Карта точек
    const P = buildPointMap();
    if (!P) return;

    // Проекция точки из системы [0..1]*aspect в пиксели canvas
    const project = (pt) => {
      if (!pt) return null;
      return {
        x: dx + pt.x * dw,
        y: dy + (pt.y / (ih / iw)) * dh
      };
    };

    // Рисуем визуализацию
    if (metric.visual) {
      drawVisual(metric.visual, P, project, '#ffd93b', 2);
    }

    // Подписываем участвующие точки маленькими синими маркерами
    const involvedIds = collectVisualPointIds(metric.visual);
    for (const id of involvedIds) {
      if (id.startsWith('_')) continue;
      const pt = P[id];
      if (!pt) continue;
      const scr = project(pt);
      if (!scr) continue;
      modalCtx.beginPath();
      modalCtx.arc(scr.x, scr.y, 3.5, 0, Math.PI * 2);
      modalCtx.fillStyle = '#2ea6ff';
      modalCtx.fill();
      modalCtx.lineWidth = 1.2;
      modalCtx.strokeStyle = '#fff';
      modalCtx.stroke();
    }
  }

  function collectVisualPointIds(visual, acc) {
    acc = acc || new Set();
    if (!visual) return acc;
    if (visual.type === 'line') {
      if (visual.from) acc.add(visual.from);
      if (visual.to)   acc.add(visual.to);
    } else if (visual.type === 'angle') {
      if (visual.vertex) acc.add(visual.vertex);
      if (visual.from)   acc.add(visual.from);
      if (visual.to)     acc.add(visual.to);
    } else if (visual.type === 'multi' && Array.isArray(visual.parts)) {
      for (const p of visual.parts) collectVisualPointIds(p, acc);
    }
    return acc;
  }

  function drawVisual(visual, P, project, color, width) {
    if (!visual) return;
    if (visual.type === 'line') {
      drawVisualLine(visual.from, visual.to, P, project, color, width);
    } else if (visual.type === 'angle') {
      drawVisualAngle(visual.vertex, visual.from, visual.to, P, project, color, width);
    } else if (visual.type === 'multi' && Array.isArray(visual.parts)) {
      for (const part of visual.parts) drawVisual(part, P, project, color, width);
    }
  }

  function drawVisualLine(fromId, toId, P, project, color, width) {
    const a = P[fromId];
    const b = P[toId];
    if (!a || !b) return;
    const sa = project(a);
    const sb = project(b);
    if (!sa || !sb) return;

    modalCtx.beginPath();
    modalCtx.moveTo(sa.x, sa.y);
    modalCtx.lineTo(sb.x, sb.y);
    modalCtx.strokeStyle = color;
    modalCtx.lineWidth = width;
    modalCtx.setLineDash([6, 4]);
    modalCtx.stroke();
    modalCtx.setLineDash([]);

    // Концы
    for (const s of [sa, sb]) {
      modalCtx.beginPath();
      modalCtx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
      modalCtx.fillStyle = color;
      modalCtx.fill();
    }
  }

  function drawVisualAngle(vertexId, fromId, toId, P, project, color, width) {
    const v = P[vertexId];
    const a = P[fromId];
    const b = P[toId];
    if (!v || !a || !b) return;
    const sv = project(v);
    const sa = project(a);
    const sb = project(b);
    if (!sv || !sa || !sb) return;

    // Лучи
    modalCtx.beginPath();
    modalCtx.moveTo(sv.x, sv.y);
    modalCtx.lineTo(sa.x, sa.y);
    modalCtx.moveTo(sv.x, sv.y);
    modalCtx.lineTo(sb.x, sb.y);
    modalCtx.strokeStyle = color;
    modalCtx.lineWidth = width;
    modalCtx.stroke();

    // Дуга
    const angA = Math.atan2(sa.y - sv.y, sa.x - sv.x);
    const angB = Math.atan2(sb.y - sv.y, sb.x - sv.x);
    let delta = angB - angA;
    while (delta >  Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    const radius = Math.min(30, Math.hypot(sa.x - sv.x, sa.y - sv.y) * 0.4);
    modalCtx.beginPath();
    modalCtx.arc(sv.x, sv.y, radius, angA, angA + delta, delta < 0);
    modalCtx.strokeStyle = color;
    modalCtx.lineWidth = width;
    modalCtx.stroke();

    // Вершина
    modalCtx.beginPath();
    modalCtx.arc(sv.x, sv.y, 3.5, 0, Math.PI * 2);
    modalCtx.fillStyle = color;
    modalCtx.fill();
  }

  /* ==================== BACK BUTTON ==================== */
  function bindBackButton() {
    if (!tg || !tg.BackButton) return;
    try {
      tg.BackButton.onClick(() => {
        if (!els.modal.hidden) { closeMetricModal(); return; }
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
    console.log('app.js v3: старт');
    console.log('points.js: точек =', (Array.isArray(POINTS) ? POINTS.length : 0));
    console.log('example-face.js:', !!window.ExampleFace);

    if (!Array.isArray(POINTS) || POINTS.length === 0) {
      console.error('app.js: POINTS пуст');
      return;
    }

    bindBackButton();
    updateUI();

    // Первый отрисовка примера — когда DOM готов и размеры известны
    requestAnimationFrame(() => drawExample());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
