/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (32 метрики, без нейросетей)
   МОДУЛЬ 8/8: js/app.js
   ---------------------------------------------------------------------
   Роутер экранов + оркестрация всего пайплайна:
     welcome -> upload -> mark (34 точки, 7 этапов) -> review -> results
   Обязанности:
     • TG SDK: ready/expand/цвета/BackButton (вне TG — деградирует тихо);
     • загрузка фото (камера/галерея) + даунскейл до 1600px по большей стороне;
     • разметка: порядок из FM.points.ORDER, авто-зум zoomHint, undo,
       HUD (этап/точка/зум), постановка точки в центр прицела;
     • обзор: линии+подписи, валидация FM.points.validate, тап по маркеру
       = перестановка точки (режим editing);
     • результаты: FM.metrics.computeAll -> FM.scoring.scoreAll ->
       FM.results.render; последний итог в localStorage.
   Зависимости: FM.points, FM.photo, FM.metrics, FM.scoring, FM.results.
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = global.FM;
  const $ = function (id) { return document.getElementById(id); };

  /* ---------------- состояние ---------------- */
  let screen = 'welcome';
  let img = null;                 /* Image или Canvas после даунскейла */
  let markVp = null, reviewVp = null;
  let points = {};                /* {id: {x,y}} в координатах изображения */
  let orderIndex = 0;             /* индекс следующей точки в ORDER */
  let editing = null;             /* id точки при перестановке из обзора */
  let markTimer = null;           /* тикер HUD зума */

  const tg = (global.Telegram && global.Telegram.WebApp) ? global.Telegram.WebApp : null;

  const TITLES = {
    welcome: 'FaceMetrics',
    upload: 'Фото для разметки',
    mark: 'Разметка лица',
    review: 'Обзор разметки',
    results: 'Результаты'
  };

  /* ---------------- роутер ---------------- */
  function show(id) {
    screen = id;
    stopMarkTimer();
    const screens = document.querySelectorAll('.screen');
    for (let i = 0; i < screens.length; i++) {
      screens[i].classList.toggle('active', screens[i].id === 'scr' + cap(id));
    }
    $('hdrTitle').textContent = TITLES[id] || 'FaceMetrics';
    $('btnBack').hidden = (id === 'welcome');
    if (tg) {
      try { id === 'welcome' ? tg.BackButton.hide() : tg.BackButton.show(); } catch (e) {}
    }
    if (id === 'mark') startMarkTimer();
    if (id === 'welcome') paintHdrRight();
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function goBack() {
    if (screen === 'upload') show('welcome');
    else if (screen === 'mark') {
      if (editing) { editing = null; goReview(); } else show('upload');
    }
    else if (screen === 'review') { editing = null; enterMark(); }
    else if (screen === 'results') show('review');
    else if (tg) { try { tg.close(); } catch (e) {} }
  }

  /* ---------------- TG SDK ---------------- */
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor('#0f1115');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#0f1115');
      tg.BackButton.onClick(goBack);
    } catch (e) { /* вне TG или старая версия — не критично */ }
  }

  /* ---------------- загрузка фото ---------------- */
  function scaleDown(source, maxDim) {
    const w = source.naturalWidth || source.width;
    const h = source.naturalHeight || source.height;
    const k = Math.max(w, h);
    if (k <= maxDim) return source;
    const s = maxDim / k;
    const c = document.createElement('canvas');
    c.width = Math.round(w * s);
    c.height = Math.round(h * s);
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    return c;
  }

  function loadFile(file) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) return;
    showLoader(true);
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = function () {
      URL.revokeObjectURL(url);
      img = scaleDown(im, 1600);
      if (markVp) { markVp.destroy(); markVp = null; }
      if (reviewVp) { reviewVp.destroy(); reviewVp = null; }
      points = {};
      orderIndex = 0;
      editing = null;
      showLoader(false);
      enterMark();
    };
    im.onerror = function () {
      URL.revokeObjectURL(url);
      showLoader(false);
      alert('Не удалось прочитать изображение. Попробуй другой файл.');
    };
    im.src = url;
  }
  function showLoader(on) { $('loader').hidden = !on; }

  /* ---------------- разметка ---------------- */
  function currentId() { return editing || FM.points.ORDER[orderIndex]; }

  function enterMark() {
    show('mark');
    if (!markVp) {
      markVp = FM.photo.create($('markCanvas'), img);
      markVp.setPoints(points);
    }
    markVp.setReview(false);
    markVp.resize();
    refreshMarkPoint();
  }

  function refreshMarkPoint() {
    const id = currentId();
    const P = FM.points.POINTS[id];
    const st = FM.points.stageOf(id);
    $('hudStageTitle').textContent = editing
      ? 'Перестановка точки'
      : 'Этап ' + st.id + '/' + FM.points.totalStages + ' · ' + st.title;
    $('hudProgress').textContent = editing
      ? id
      : 'точка ' + (FM.points.indexInStage(id) + 1) + '/' + st.points.length;
    $('cardPointName').textContent = P.name;
    $('cardPointGuide').textContent = P.guide;
    $('btnUndo').textContent = editing ? '✕' : '↺';
    markVp.setActive(id);
    markVp.zoomHint(P.zoom);
    updateZoomHud();
  }

  function updateZoomHud() {
    if (markVp) $('hudZoom').textContent = 'зум ×' + markVp.zoomLevel().toFixed(1);
  }
  function startMarkTimer() {
    stopMarkTimer();
    markTimer = setInterval(updateZoomHud, 250);
  }
  function stopMarkTimer() {
    if (markTimer) { clearInterval(markTimer); markTimer = null; }
  }

  function placePoint() {
    const id = currentId();
    points[id] = markVp.crosshairImagePoint();
    markVp.redraw();
    if (editing) { editing = null; goReview(); return; }
    orderIndex++;
    if (orderIndex >= FM.points.ORDER.length) { goReview(); }
    else { refreshMarkPoint(); }
  }

  function undoPoint() {
    if (editing) { editing = null; goReview(); return; }
    if (orderIndex <= 0) return;
    orderIndex--;
    delete points[FM.points.ORDER[orderIndex]];
    markVp.redraw();
    refreshMarkPoint();
  }

  /* ---------------- обзор ---------------- */
  function goReview() {
    show('review');
    if (!reviewVp) {
      reviewVp = FM.photo.create($('reviewCanvas'), img);
      reviewVp.setPoints(points);
    }
    reviewVp.setReview(true);
    reviewVp.setActive(null);
    reviewVp.resize();
    $('reviewCount').textContent = Object.keys(points).length + '/' + FM.points.total;

    const warns = FM.points.validate(points);
    const box = $('reviewWarns');
    box.hidden = !warns.length;
    box.innerHTML = warns.map(function (w) {
      return '<div class="warn-item">⚠ ' + w.msg + '</div>';
    }).join('');
  }

  function reviewTap(e) {
    if (!reviewVp) return;
    const r = $('reviewCanvas').getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bestD = 28;                       /* радиус попадания, px */
    const ids = Object.keys(points);
    for (let i = 0; i < ids.length; i++) {
      const s = reviewVp.imageToScreen(points[ids[i]]);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) { bestD = d; best = ids[i]; }
    }
    if (best) {
      editing = best;
      enterMark();
    }
  }

  /* ---------------- результаты ---------------- */
  function goResults() {
    const raw = FM.metrics.computeAll(points);
    const scored = FM.scoring.scoreAll(raw);
    show('results');
    FM.results.render($('resultsBox'), scored, { onRetry: restartMark });
    if (scored.overall) {
      try {
        localStorage.setItem('fmLast', JSON.stringify({
          of10: scored.overall.of10,
          tier: scored.overall.tier,
          date: new Date().toISOString().slice(0, 10)
        }));
      } catch (e) { /* приватный режим — пропускаем */ }
    }
  }

  function restartMark() {
    points = {};
    orderIndex = 0;
    editing = null;
    if (markVp) { markVp.setPoints(points); }
    enterMark();
  }

  function paintHdrRight() {
    let txt = '';
    try {
      const last = JSON.parse(localStorage.getItem('fmLast') || 'null');
      if (last) txt = 'прошлый: ' + last.of10.toFixed(1) + '/10 (' + last.tier + ')';
    } catch (e) {}
    $('hdrRight').textContent = txt;
  }

  /* ---------------- события UI ---------------- */
  function wire() {
    $('btnStart').addEventListener('click', function () { show('upload'); });
    $('btnCamera').addEventListener('click', function () { $('inputCam').click(); });
    $('btnGallery').addEventListener('click', function () { $('inputGal').click(); });
    $('inputCam').addEventListener('change', function (e) {
      loadFile(e.target.files && e.target.files[0]); e.target.value = '';
    });
    $('inputGal').addEventListener('change', function (e) {
      loadFile(e.target.files && e.target.files[0]); e.target.value = '';
    });

    $('btnZoomIn').addEventListener('click', function () { markVp && markVp.zoomBy(1.25); updateZoomHud(); });
    $('btnZoomOut').addEventListener('click', function () { markVp && markVp.zoomBy(0.8); updateZoomHud(); });
    $('btnPlace').addEventListener('click', placePoint);
    $('btnUndo').addEventListener('click', undoPoint);

    $('reviewCanvas').addEventListener('click', reviewTap);
    $('btnReviewRedo').addEventListener('click', restartMark);
    $('btnReviewResults').addEventListener('click', goResults);

    $('btnBack').addEventListener('click', goBack);

    const onResize = function () {
      if (markVp && screen === 'mark') markVp.resize();
      if (reviewVp && screen === 'review') reviewVp.resize();
    };
    global.addEventListener('resize', onResize);
    global.addEventListener('orientationchange', onResize);
  }

  wire();
  show('welcome');
})(typeof window !== 'undefined' ? window : this);
