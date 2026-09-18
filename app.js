/* ============================================================
 * app.js — движок Mini App
 * Управляет: загрузкой фото, canvas, расстановкой точек,
 * подсказками, примером в углу, переключением экранов,
 * вызовом расчёта и выводом результата.
 * Зависит от: points.js (POINTS, EXAMPLE_IMG),
 *             metrics.js (calculateScore собирается в scoring.js).
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
    hintBox:           $('hint-box'),
    exampleBox:        $('example-box'),
    exampleImg:        $('example-img'),
    exampleDot:        $('example-dot'),
    pointProgress:     $('point-progress'),
    pointInstruction:  $('point-instruction'),
    btnReset:          $('btn-reset'),
    btnUndo:           $('btn-undo'),
    btnNext:           $('btn-next'),
    btnRestart:        $('btn-restart'),
    scoreValue:        $('score-value'),
    scoreLabel:        $('score-label'),
    categoryBreakdown: $('category-breakdown'),
    metricsBreakdown:  $('metrics-breakdown')
  };

  // Валидация обязательных элементов — быстро ловим ошибки в разметке
  for (const [key, el] of Object.entries(els)) {
    if (!el) console.error(`app.js: не найден элемент #${key}`);
  }
  if (!els.canvas) {
    console.error('app.js: критическая ошибка — canvas не найден, движок не запущен');
    return;
  }

  const ctx = els.canvas.getContext('2d');
  if (!ctx) {
    console.error('app.js: не удалось получить 2d-контекст canvas');
    return;
  }

  /* ==================== СОСТОЯНИЕ ==================== */
  const state = {
    image:        null,      // HTMLImageElement
    imageLoaded:  false,
    imageRect:    null,      // { x, y, w, h } — куда именно нарисована картинка (в CSS-пикселях canvas)
    points:       [],        // [{ id, nx, ny }] — нормализованные координаты [0..1]
    currentIndex: 0,         // индекс следующей точки для установки
    dpr:          window.devicePixelRatio || 1,
    exampleOk:    false,     // загрузилась ли картинка-пример
    lastPointer:  0          // timestamp последнего pointerdown (антидубль)
  };

  /* ==================== ЭКРАНЫ ==================== */
  function showScreen(name) {
    for (const [key, screen] of Object.entries(screens)) {
      if (!screen) continue;
      screen.classList.toggle('active', key === name);
    }
    // Сброс скролла к верху
    window.scrollTo(0, 0);
    // Хедер-цвет для Telegram
    if (tg && typeof tg.setHeaderColor === 'function') {
      tg.setHeaderColor('#1a1a1a');
    }
  }

  /* ==================== CANVAS РАЗМЕРЫ ==================== */
  function setupCanvas() {
    const wrap = els.canvas.parentElement;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // Экран ещё не отрисован — попробуем позже
      requestAnimationFrame(setupCanvas);
      return;
    }

    state.dpr = window.devicePixelRatio || 1;
    els.canvas.width  = Math.round(rect.width  * state.dpr);
    els.canvas.height = Math.round(rect.height * state.dpr);

    // Рисуем в CSS-пикселях, dpr учитывается трансформацией
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    draw();
  }

  /* ==================== РИСОВАНИЕ ==================== */
  function draw() {
    const W = els.canvas.width  / state.dpr;
    const H = els.canvas.height / state.dpr;

    // Фон
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

    // Вписываем фото по принципу contain (полностью видно)
    const iw = state.image.naturalWidth  || state.image.width;
    const ih = state.image.naturalHeight || state.image.height;
    const scale = Math.min(W / iw, H / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    state.imageRect = { x: dx, y: dy, w: dw, h: dh };

    ctx.drawImage(state.image, dx, dy, dw, dh);

    // Отрисовка всех поставленных точек
    const n = state.points.length;
    for (let i = 0; i < n; i++) {
      const p  = state.points[i];
      const px = p.nx * W;
      const py = p.ny * H;
      const isLast = (i === n - 1);

      // Внешний ореол — чтобы точки были видны на любом фоне
      ctx.beginPath();
      ctx.arc(px, py, isLast ? 9 : 7, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? 'rgba(255, 59, 59, 0.25)' : 'rgba(46, 166, 255, 0.20)';
      ctx.fill();

      // Основной кружок
      ctx.beginPath();
      ctx.arc(px, py, isLast ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? '#ff3b3b' : '#2ea6ff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
  }

  /* ==================== КООРДИНАТЫ ==================== */
  function getCanvasCoords(ev) {
    const rect = els.canvas.getBoundingClientRect();
    const cx = ev.clientX - rect.left;
    const cy = ev.clientY - rect.top;
    return {
      x: cx,
      y: cy,
      nx: Math.max(0, Math.min(1, cx / rect.width)),
      ny: Math.max(0, Math.min(1, cy / rect.height))
    };
  }

  /* ==================== УПРАВЛЕНИЕ ТОЧКАМИ ==================== */
  function placePoint(nx, ny) {
    if (state.currentIndex >= POINTS.length) return;
    const meta = POINTS[state.currentIndex];
    state.points.push({ id: meta.id, nx, ny });
    state.currentIndex++;

    // Небольшая вибрация в Telegram (если поддерживается)
    if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.selectionChanged === 'function') {
      try { tg.HapticFeedback.selectionChanged(); } catch (_) {}
    }

    console.log(`[point ${state.currentIndex}/${POINTS.length}] ${meta.id} → (${nx.toFixed(3)}, ${ny.toFixed(3)})`);

    updateUI();
    draw();
  }

  function undo() {
    if (state.points.length === 0) return;
    const removed = state.points.pop();
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    console.log(`[undo] снята точка ${removed.id}, осталось ${state.points.length}`);
    updateUI();
    draw();
  }

  function reset() {
    state.points = [];
    state.currentIndex = 0;
    console.log('[reset] все точки сброшены');
    updateUI();
    draw();
  }

  /* ==================== ОБНОВЛЕНИЕ UI ==================== */
  function updateUI() {
    const total = POINTS.length;
    const idx   = state.currentIndex;

    if (idx < total) {
      const meta = POINTS[idx];
      els.pointProgress.textContent = `Точка ${idx + 1} из ${total}`;
      els.hintBox.textContent       = meta.hint;
      els.pointInstruction.textContent = meta.instruction;
      els.exampleDot.style.display = '';

      if (state.exampleOk) {
        els.exampleDot.style.left = meta.exampleX + '%';
        els.exampleDot.style.top  = meta.exampleY + '%';
      }
    } else {
      els.pointProgress.textContent = `Все точки расставлены (${total})`;
      els.hintBox.textContent       = 'Готово! Проверь точки и жми «Далее»';
      els.pointInstruction.textContent = 'Все ' + total + ' точек расставлены. Проверь ещё раз и жми «Далее».';
      els.exampleDot.style.display = 'none';
    }

    els.btnUndo.disabled = (idx === 0);
    els.btnNext.disabled = (idx < total);
  }

  /* ==================== ОБРАБОТЧИКИ ==================== */
  // Основной обработчик тапа: pointerdown работает и для мыши, и для пальца
  els.canvas.addEventListener('pointerdown', (ev) => {
    // Антидубль (некоторые браузеры шлют два события подряд)
    const now = Date.now();
    if (now - state.lastPointer < 40) return;
    state.lastPointer = now;

    // Игнорируем вторичные пальцы
    if (ev.isPrimary === false) return;

    ev.preventDefault();
    if (state.currentIndex >= POINTS.length) return;

    const { nx, ny } = getCanvasCoords(ev);
    placePoint(nx, ny);
  }, { passive: false });

  // Отключаем контекстное меню долгого тапа на canvas
  els.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Кнопки
  els.btnUndo.addEventListener('click', (e) => { e.preventDefault(); undo(); });
  els.btnReset.addEventListener('click', (e) => {
    e.preventDefault();
    if (state.points.length === 0) return;
    if (window.confirm('Сбросить все точки?')) reset();
  });
  els.btnNext.addEventListener('click', (e) => {
    e.preventDefault();
    if (state.currentIndex < POINTS.length) return;
    goToResult();
  });
  els.btnRestart.addEventListener('click', (e) => {
    e.preventDefault();
    reset();
    state.image = null;
    state.imageLoaded = false;
    state.imageRect = null;
    els.fileInput.value = '';
    els.exampleDot.style.display = '';
    showScreen('welcome');
  });

  // Загрузка файла
  els.fileInput.addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    loadImage(file);
  });

  /* ==================== ЗАГРУЗКА ИЗОБРАЖЕНИЯ ==================== */
  function loadImage(file) {
    if (!file.type || !file.type.startsWith('image/')) {
      alert('Нужен файл изображения');
      return;
    }
    // Ограничим размер, чтобы не сожрало память телефона
    if (file.size > 25 * 1024 * 1024) {
      alert('Фото слишком большое (макс. 25 МБ). Уменьши и попробуй снова.');
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => alert('Ошибка чтения файла');

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => alert('Не удалось декодировать изображение');
      img.onload = () => {
        // Сброс состояния под новый файл
        state.image       = img;
        state.imageLoaded = true;
        state.points      = [];
        state.currentIndex = 0;
        state.imageRect   = null;

        showScreen('points');

        // Ждём отрисовки экрана, потом считаем размеры canvas
        requestAnimationFrame(() => {
          setupCanvas();
          updateUI();
        });

        // Предзагрузка картинки-примера (если ещё не загружена)
        ensureExampleLoaded();
      };
      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  }

  /* ==================== ПРИМЕР В УГЛУ ==================== */
  function ensureExampleLoaded() {
    if (state.exampleOk) return;
    els.exampleImg.addEventListener('error', () => {
      // Тихо скрываем блок с примером, если картинки нет
      state.exampleOk = false;
      els.exampleBox.style.display = 'none';
      console.warn('app.js: example.jpg не найден — блок с примером скрыт');
    }, { once: true });
    els.exampleImg.addEventListener('load', () => {
      state.exampleOk = true;
      els.exampleBox.style.display = '';
      // сразу поставим точку по текущему шагу
      const meta = POINTS[state.currentIndex];
      if (meta) {
        els.exampleDot.style.left = meta.exampleX + '%';
        els.exampleDot.style.top  = meta.exampleY + '%';
      }
    }, { once: true });
    els.exampleImg.src = EXAMPLE_IMG;
  }

  /* ==================== RESIZE ==================== */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (screens.points.classList.contains('active')) {
        setupCanvas();
      }
    }, 150);
  });

  // При возврате видимости (свайп обратно в Mini App)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && screens.points.classList.contains('active')) {
      setupCanvas();
    }
  });

  /* ==================== ПЕРЕХОД К РЕЗУЛЬТАТУ ==================== */
  function goToResult() {
    // Собираем карту: id точки → { x, y } в нормализованных координатах
    const pointsByID = {};
    for (const p of state.points) {
      pointsByID[p.id] = { x: p.nx, y: p.ny };
    }

    // Проверяем, что все нужные точки есть
    const missing = [];
    for (const meta of POINTS) {
      if (!pointsByID[meta.id]) missing.push(meta.id);
    }
    if (missing.length) {
      console.warn('app.js: не хватает точек:', missing);
      alert('Не хватает ' + missing.length + ' точек. Поставь их и попробуй снова.');
      return;
    }

    let result;
    try {
      if (typeof calculateScore !== 'function') {
        throw new Error('calculateScore не определена (проверь scoring.js)');
      }
      result = calculateScore(pointsByID);
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

    // Итоговый балл
    els.scoreValue.textContent = result.score.toFixed(1);
    els.scoreLabel.textContent = result.label || 'Гармония лица';

    // Разбивка по категориям (T1..T5)
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

    // Список метрик
    els.metricsBreakdown.innerHTML = '';
    const metrics = Array.isArray(result.metrics) ? result.metrics : [];
    for (const m of metrics) {
      if (!m || !m.name) continue;
      const valStr = (typeof m.value === 'number' && isFinite(m.value))
        ? m.value.toFixed(3)
        : (m.value != null ? String(m.value) : '—');
      const scoreStr = (typeof m.score === 'number' && isFinite(m.score))
        ? m.score.toFixed(0) + '%'
        : '—';

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

  /* ==================== НАВИГАЦИЯ ЧЕРЕЗ TELEGRAM ==================== */
  function bindBackButton() {
    if (!tg || !tg.BackButton) return;
    try {
      tg.BackButton.onClick(() => {
        if (screens.points.classList.contains('active')) {
          showScreen('welcome');
        } else if (screens.result.classList.contains('active')) {
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
    console.log('app.js: старт');
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
