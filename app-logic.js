/* ============================================================
   LUX FACE BOT — app-logic.js
   Оркестратор: связывает редактор, математику и UI результата.
   Версия: v17-tier
   ============================================================ */

import { POINTS, METRIC_TABLE, CATS, CATW, AXES, METRIC_SEGMENTS, RESULT_CONFIG } from './config.js';
import {
  computeAllMetrics,
  computeThirds,
  computeAxes,
  computePSL,
  buildReportText,
  colorOf,
  tierName
} from './math-core.js';
import {
  initEditor,
  startWithImage,
  stopEditor,
  getPlacedPoints,
  playDoneSound,
  unlockAudio
} from './editor-engine.js';

/* ============================================================
   СОСТОЯНИЕ ПРИЛОЖЕНИЯ
   ============================================================ */

var appState = {
  img: null,
  result: null,
  showAllLines: false,
  previousScore: null
};

/* DOM-ссылки (устанавливаются через initApp) */
var ui = {
  homeScreen: null,
  editorScreen: null,
  resultScreen: null,
  fileInput: null,
  resultCanvas: null,
  resultCtx: null,
  metricList: null,
  allLinesBtn: null,
  sendBtn: null
};

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

export function initApp(domRefs) {
  ui.homeScreen = domRefs.homeScreen;
  ui.editorScreen = domRefs.editorScreen;
  ui.resultScreen = domRefs.resultScreen;
  ui.fileInput = domRefs.fileInput;
  ui.resultCanvas = domRefs.resultCanvas;
  ui.resultCtx = ui.resultCanvas.getContext('2d');
  ui.metricList = domRefs.metricList;
  ui.allLinesBtn = domRefs.allLinesBtn;
  ui.sendBtn = domRefs.sendBtn;

  /* Инициализация редактора */
  initEditor({
    canvas: domRefs.editorCanvas,
    guideCanvas: domRefs.guideCanvas,
    loupeCanvas: domRefs.loupeCanvas,
    nameEl: domRefs.pointName,
    descEl: domRefs.pointDesc,
    ringEl: domRefs.progressRing,
    placeBtn: domRefs.placeBtn,
    undoBtn: domRefs.undoBtn,
    restartBtn: domRefs.restartBtn,
    zinBtn: domRefs.zinBtn,
    zoutBtn: domRefs.zoutBtn
  });

  /* Колбэки редактора */
  import('./editor-engine.js').then(function(mod) {
    mod.setCallbacks({
      onAllPlaced: onAllPointsPlaced
    });
  });

  /* Загрузка фото */
  ui.fileInput.addEventListener('change', onFileSelected);

  /* Кнопка переключения линий */
  ui.allLinesBtn.addEventListener('click', toggleAllLines);

  /* Кнопка отправки */
  ui.sendBtn.addEventListener('click', sendToBot);

  /* Разблокировка звука при первом касании */
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });

  /* Загрузка предыдущего балла */
  try {
    var prev = localStorage.getItem('luxprev');
    if (prev !== null) {
      appState.previousScore = parseFloat(prev);
    }
  } catch (e) {}
}

/* ============================================================
   ЗАГРУЗКА ФОТО
   ============================================================ */

function onFileSelected(e) {
  var file = e.target.files[0];
  if (!file) return;

  unlockAudio();

  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      appState.img = img;
      ui.homeScreen.style.display = 'none';
      ui.editorScreen.style.display = 'block';
      startWithImage(img);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

/* ============================================================
   ЗАВЕРШЕНИЕ РАССТАНОВКИ ТОЧЕК
   ============================================================ */

function onAllPointsPlaced(placedPoints) {
  stopEditor();
  playDoneSound();

  /* Расчёт всех метрик */
  appState.result = computeAllMetrics(
    placedPoints,
    appState.img.width,
    appState.img.height
  );

  /* Сохранение балла */
  try {
    localStorage.setItem('luxprev', appState.result.overall.toFixed(1));
  } catch (e) {}

  /* Переключение на экран результатов */
  ui.editorScreen.style.display = 'none';
  ui.resultScreen.style.display = 'flex';

  /* Отрисовка результата */
  appState.showAllLines = false;
  ui.allLinesBtn.textContent = 'ВСЕ ЛИНИИ';
  renderResultCanvas(0);
  buildResultUI();
}

/* ============================================================
   ОТРИСОВКА CANVAS РЕЗУЛЬТАТА
   ============================================================ */

function fitResultCanvas() {
  var w = ui.resultCanvas.clientWidth;
  var h = ui.resultCanvas.clientHeight;
  var dpr = window.devicePixelRatio || 1;
  ui.resultCanvas.width = w * dpr;
  ui.resultCanvas.height = h * dpr;

  var s = Math.min(w / appState.img.width, h / appState.img.height);
  return {
    w: w,
    h: h,
    s: s,
    ox: (w - appState.img.width * s) / 2,
    oy: (h - appState.img.height * s) / 2,
    dpr: dpr
  };
}

function drawBaseImage(fit) {
  var rctx = ui.resultCtx;
  rctx.setTransform(fit.dpr, 0, 0, fit.dpr, 0, 0);
  rctx.clearRect(0, 0, fit.w, fit.h);
  rctx.save();
  rctx.translate(fit.ox, fit.oy);
  rctx.scale(fit.s, fit.s);
  rctx.drawImage(appState.img, 0, 0);
  rctx.restore();
}

function drawMetricSegments(fit, metric, lineWidth, withShadow) {
  var rctx = ui.resultCtx;
  var c = colorOf(metric.score);
  var segments = METRIC_SEGMENTS[metric.name] || [];
  var PTS = appState.result.PTS;

  rctx.strokeStyle = c;
  rctx.lineWidth = lineWidth;
  if (withShadow) {
    rctx.shadowColor = c;
    rctx.shadowBlur = 6;
  }

  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    var a = PTS[seg[0]];
    var b = PTS[seg[1]];
    if (!a || !b) continue;

    rctx.beginPath();
    rctx.moveTo(a.x * fit.s + fit.ox, a.y * fit.s + fit.oy);
    rctx.lineTo(b.x * fit.s + fit.ox, b.y * fit.s + fit.oy);
    rctx.stroke();

    /* Точки на концах сегмента */
    rctx.fillStyle = c;
    rctx.beginPath();
    rctx.arc(a.x * fit.s + fit.ox, a.y * fit.s + fit.oy, 3, 0, Math.PI * 2);
    rctx.fill();
    rctx.beginPath();
    rctx.arc(b.x * fit.s + fit.ox, b.y * fit.s + fit.oy, 3, 0, Math.PI * 2);
    rctx.fill();
  }
  rctx.shadowBlur = 0;
}

function renderResultCanvas(metricIndex) {
  var fit = fitResultCanvas();
  drawBaseImage(fit);

  if (appState.showAllLines) {
    /* Все линии */
    var metrics = appState.result.metrics;
    for (var i = 0; i < metrics.length; i++) {
      drawMetricSegments(fit, metrics[i], 1.2, false);
    }
    ui.resultCtx.fillStyle = '#fff';
    ui.resultCtx.font = '700 14px sans-serif';
    ui.resultCtx.fillText('Все измерения', 10, 20);
  } else {
    /* Одна метрика */
    if (metricIndex >= 0 && metricIndex < appState.result.metrics.length) {
      var m = appState.result.metrics[metricIndex];
      drawMetricSegments(fit, m, 2.5, true);
      ui.resultCtx.fillStyle = colorOf(m.score);
      ui.resultCtx.font = '700 14px sans-serif';
      ui.resultCtx.fillText(m.name + ' · ' + Math.round(m.score) + '/100', 10, 20);
    }
  }
}

/* ============================================================
   ПЕРЕКЛЮЧЕНИЕ ЛИНИЙ
   ============================================================ */

function toggleAllLines() {
  appState.showAllLines = !appState.showAllLines;
  if (appState.showAllLines) {
    ui.allLinesBtn.textContent = 'ОДНА';
    renderResultCanvas(0);
  } else {
    ui.allLinesBtn.textContent = 'ВСЕ ЛИНИИ';
    renderResultCanvas(0);
  }
  triggerHaptic();
}

function triggerHaptic() {
  var TG = window.Telegram && window.Telegram.WebApp;
  if (TG && TG.HapticFeedback) {
    TG.HapticFeedback.impactOccurred('light');
  }
}

/* ============================================================
   ПОСТРОЕНИЕ UI РЕЗУЛЬТАТА
   ============================================================ */

function buildResultUI() {
  var R = appState.result;
  var RC = RESULT_CONFIG;
  var thirds = computeThirds(R.PTS);
  var axes = computeAxes(R.metrics, AXES);
  var psl = computePSL(R.overall);

  /* Delta с предыдущим */
  var deltaHtml = '';
  if (appState.previousScore !== null && !isNaN(appState.previousScore)) {
    var d = R.overall - appState.previousScore;
    deltaHtml = '<div class="brow"><span>Previous</span><span>' +
      appState.previousScore.toFixed(1) + '</span></div>' +
      '<div class="brow"><span>Current</span><span>' +
      R.overall.toFixed(1) + ' (' + (d >= 0 ? '+' : '') + d.toFixed(1) +
      ')</span></div>';
  }

  /* Сортировка метрик по скору */
  var sorted = R.metrics.slice().sort(function(a, b) { return b.score - a.score; });
  var strong = sorted.slice(0, RC.strongCount);
  var weak = sorted.slice(-RC.weakCount).reverse();

  /* Заголовок */
  var html = '<h1 style="padding:4px 0 0">' + R.overall.toFixed(1) + ' / 100</h1>';
  html += '<div class="sub">Attractiveness ' + R.overall.toFixed(1) +
    ' · Confidence ' + Math.round(R.quality.conf) +
    '% (не влияет на балл) · PSL ' + psl.toFixed(1) + '/8</div>';
  html += '<div class="sub">Thirds ' +
    Math.round(thirds[0]) + '/' +
    Math.round(thirds[1]) + '/' +
    Math.round(thirds[2]) + '%</div>';

  /* Предупреждения качества */
  if (R.quality.warns.length > 0) {
    html += '<div class="sub" style="color:var(--warn)">⚠️ Точность снижена: ' +
      R.quality.warns.join(', ') + '</div>';
  }

  /* Профили (4 оси) */
  html += '<div class="card2"><div class="sub" style="margin-bottom:6px">PROFILES</div>';
  var axisNames = Object.keys(axes);
  for (var a = 0; a < axisNames.length; a++) {
    var axName = axisNames[a];
    var axScore = axes[axName];
    html += '<div class="brow"><span>' + axName +
      '</span><span style="color:' + colorOf(axScore) +
      ';font-weight:800">' + Math.round(axScore) + '</span></div>';
  }
  html += '</div>';

  /* Сильные/слабые стороны + дельта */
  html += '<div class="card2">' + deltaHtml;
  html += '<div class="brow"><span>💪</span><span>' +
    strong.map(function(m) { return m.name; }).join(', ') + '</span></div>';
  html += '<div class="brow"><span>⚠️</span><span>' +
    weak.map(function(m) { return m.name; }).join(', ') + '</span></div>';
  html += '</div>';

  /* Breakdown по категориям */
  html += '<div class="card2"><div class="sub" style="margin-bottom:6px">BREAKDOWN</div>';
  for (var c = 0; c < CATS.length; c++) {
    var catName = CATS[c];
    var catScore = R.catScores[catName];
    html += '<div class="brow"><span>' + catName +
      '</span><span style="color:' + colorOf(catScore) +
      ';font-weight:800">' + Math.round(catScore) + '</span></div>';
  }
  html += '</div>';

  /* Детальные метрики по категориям */
  for (var ci = 0; ci < CATS.length; ci++) {
    var cat = CATS[ci];
    var catMetrics = R.metrics.filter(function(m) { return m.cat === cat; });
    if (catMetrics.length === 0) continue;

    html += '<h2 class="cat">' + cat + '</h2>';

    for (var mi = 0; mi < catMetrics.length; mi++) {
      var met = catMetrics[mi];
      var center = ((met.lo + met.hi) / 2).toFixed(2);
      var tName = tierName(met.tierIndex);
      var chipColor = colorOf(met.score);
      var delay = (mi * RC.animationDelayStep).toFixed(2);

      /* Gauge bar */
      var gaugeData = computeGauge(met.value, met.lo, met.hi);

      html += '<div class="mrow" data-metric="' + met.name +
        '" style="animation-delay:' + delay + 's">' +
        '<div class="mhead"><span>' + met.name + ' [' + tName + ']</span>' +
        '<span class="chip" style="background:' + chipColor + '22;color:' + chipColor + '">' +
        Math.round(met.score) + '</span></div>' +
        '<div class="gauge" style="background:' + gaugeData.grad + '">' +
        '<i style="left:' + gaugeData.pos + '%"></i></div>' +
        '<div class="sub">' + met.value.toFixed(2) + met.u +
        ' · оптимум ~' + center + '</div></div>';
    }
  }

  ui.metricList.innerHTML = html;

  /* Привязка кликов по метрикам */
  var rows = ui.metricList.querySelectorAll('.mrow');
  for (var r = 0; r < rows.length; r++) {
    rows[r].addEventListener('click', function() {
      var mName = this.getAttribute('data-metric');
      var idx = -1;
      for (var k = 0; k < R.metrics.length; k++) {
        if (R.metrics[k].name === mName) { idx = k; break; }
      }
      if (idx >= 0) {
        appState.showAllLines = false;
        ui.allLinesBtn.textContent = 'ВСЕ ЛИНИИ';
        renderResultCanvas(idx);
        triggerHaptic();
      }
    });
  }
}

/* ============================================================
   GAUGE BAR (визуализация положения значения в диапазоне)
   ============================================================ */

function computeGauge(value, lo, hi) {
  var sigma = (hi - lo) / 2;
  var k = RESULT_CONFIG.gaugeSigmaMultiplier;
  var rangeLeft = lo - k * sigma;
  var rangeRight = hi + k * sigma;
  var pos = Math.max(0, Math.min(1, (value - rangeLeft) / (rangeRight - rangeLeft)));

  var greenStart = ((lo - rangeLeft) / (rangeRight - rangeLeft)) * 100;
  var greenEnd = ((hi - rangeLeft) / (rangeRight - rangeLeft)) * 100;

  var grad = 'linear-gradient(90deg,var(--bad) 0%,var(--warn) ' +
    (greenStart * 0.5).toFixed(1) + '%,var(--ok) ' +
    greenStart.toFixed(1) + '%,var(--ok) ' +
    greenEnd.toFixed(1) + '%,var(--warn) ' +
    (100 - (100 - greenEnd) * 0.5).toFixed(1) + '%,var(--bad) 100%)';

  return {
    pos: (pos * 100).toFixed(1),
    grad: grad
  };
}

/* ============================================================
   ОТПРАВКА БОТУ
   ============================================================ */

function sendToBot() {
  if (!appState.result) return;

  var reportText = buildReportText(appState.result);
  var payload = JSON.stringify({
    t: 'lux',
    text: reportText,
    overall: appState.result.overall,
    confidence: appState.result.quality.conf,
    version: 'v17-tier'
  });

  var TG = window.Telegram && window.Telegram.WebApp;
  if (TG) {
    TG.sendData(payload);
    TG.close();
  }
      }
