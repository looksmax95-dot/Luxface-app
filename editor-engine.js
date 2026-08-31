/* ============================================================
   LUX FACE BOT — editor-engine.js
   Редактор точек: canvas, лупа, гайд, pan/pinch, зум, undo.
   Не знает о метриках. Только точки и взаимодействие.
   Версия: v17-tier
   ============================================================ */

import { POINTS, SCH, EDITOR_CONFIG } from './config.js';

/* ============================================================
   СОСТОЯНИЕ РЕДАКТОРА
   ============================================================ */

var state = {
  img: null,
  placed: [],
  idx: 0,
  view: { s: 1, ox: 0, oy: 0 },
  cw: 0,
  ch: 0,
  dpr: window.devicePixelRatio || 1,
  animId: null,
  active: false,
  onPointPlaced: null,
  onAllPlaced: null,
  onUndo: null,
  onRestart: null
};

/* Ссылки на DOM-элементы (устанавливаются через init) */
var dom = {
  canvas: null,
  ctx: null,
  guideCanvas: null,
  guideCtx: null,
  loupeCanvas: null,
  loupeCtx: null,
  nameEl: null,
  descEl: null,
  ringEl: null,
  placeBtn: null,
  undoBtn: null,
  restartBtn: null,
  zinBtn: null,
  zoutBtn: null
};

/* Изображение гайда */
var guideImg = new Image();
guideImg.src = 'guide.png';

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

export function initEditor(domRefs) {
  dom.canvas = domRefs.canvas;
  dom.ctx = dom.canvas.getContext('2d');
  dom.guideCanvas = domRefs.guideCanvas;
  dom.guideCtx = dom.guideCanvas.getContext('2d');
  dom.loupeCanvas = domRefs.loupeCanvas;
  dom.loupeCtx = dom.loupeCanvas.getContext('2d');
  dom.nameEl = domRefs.nameEl;
  dom.descEl = domRefs.descEl;
  dom.ringEl = domRefs.ringEl;
  dom.placeBtn = domRefs.placeBtn;
  dom.undoBtn = domRefs.undoBtn;
  dom.restartBtn = domRefs.restartBtn;
  dom.zinBtn = domRefs.zinBtn;
  dom.zoutBtn = domRefs.zoutBtn;

  /* Привязка кнопок */
  dom.placeBtn.addEventListener('click', placePoint);
  dom.undoBtn.addEventListener('click', undoPoint);
  dom.restartBtn.addEventListener('click', restartPoints);
  dom.zinBtn.addEventListener('click', zoomIn);
  dom.zoutBtn.addEventListener('click', zoomOut);

  /* Pan/pinch на canvas */
  setupTouchHandlers();

  /* Ресайз */
  window.addEventListener('resize', onResize);
}

/* Установка колбэков */
export function setCallbacks(cbs) {
  if (cbs.onPointPlaced) state.onPointPlaced = cbs.onPointPlaced;
  if (cbs.onAllPlaced) state.onAllPlaced = cbs.onAllPlaced;
  if (cbs.onUndo) state.onUndo = cbs.onUndo;
  if (cbs.onRestart) state.onRestart = cbs.onRestart;
}

/* Загрузка изображения и старт редактора */
export function startWithImage(imgElement) {
  state.img = imgElement;
  state.placed = [];
  state.idx = 0;
  state.active = true;

  resizeCanvas();
  fitImage();
  updatePointUI();
  playStartSound();

  if (!state.animId) {
    state.animId = requestAnimationFrame(renderLoop);
  }
}

/* Остановка редактора */
export function stopEditor() {
  state.active = false;
  if (state.animId) {
    cancelAnimationFrame(state.animId);
    state.animId = null;
  }
}

/* Получить текущие размещённые точки */
export function getPlacedPoints() {
  var result = [];
  for (var i = 0; i < state.placed.length; i++) {
    result.push({
      id: POINTS[i][0],
      x: state.placed[i].x,
      y: state.placed[i].y
    });
  }
  return result;
}

/* Получить количество размещённых точек */
export function getPlacedCount() {
  return state.placed.length;
}

/* Проверка: все ли точки размещены */
export function isComplete() {
  return state.placed.length >= POINTS.length;
}

/* ============================================================
   CANVAS И RESIZE
   ============================================================ */

function resizeCanvas() {
  state.cw = window.innerWidth;
  state.ch = window.innerHeight;
  dom.canvas.width = state.cw * state.dpr;
  dom.canvas.height = state.ch * state.dpr;
  dom.canvas.style.width = state.cw + 'px';
  dom.canvas.style.height = state.ch + 'px';
}

function onResize() {
  if (!state.active) return;
  resizeCanvas();
  fitImage();
}

function fitImage() {
  if (!state.img) return;
  var EC = EDITOR_CONFIG;
  state.view.s = Math.min(state.cw / state.img.width, state.ch / state.img.height) * 0.9;
  state.view.ox = (state.cw - state.img.width * state.view.s) / 2;
  state.view.oy = (state.ch - state.img.height * state.view.s) / 2;
}

/* ============================================================
   ЗУМ
   ============================================================ */

function zoomIn() {
  var EC = EDITOR_CONFIG;
  state.view.s = Math.min(EC.maxZoom, state.view.s * EC.zoomStep);
}

function zoomOut() {
  var EC = EDITOR_CONFIG;
  state.view.s = Math.max(EC.minZoom, state.view.s / EC.zoomStep);
}

/* ============================================================
   РАССТАНОВКА ТОЧЕК
   ============================================================ */

function placePoint() {
  if (state.idx >= POINTS.length) return;

  /* Координаты центра экрана → нормализованные координаты изображения */
  var wx = ((state.cw / 2) - state.view.ox) / state.view.s;
  var wy = ((state.ch / 2) - state.view.oy) / state.view.s;
  var nx = wx / state.img.width;
  var ny = wy / state.img.height;

  /* Валидация границ [0..1] */
  nx = Math.max(0, Math.min(1, nx));
  ny = Math.max(0, Math.min(1, ny));

  state.placed.push({ x: nx, y: ny });
  state.idx++;

  triggerHaptic();
  playPlaceSound();

  if (state.onPointPlaced) {
    state.onPointPlaced(state.idx - 1, nx, ny);
  }

  if (state.idx >= POINTS.length) {
    if (state.onAllPlaced) {
      state.onAllPlaced(getPlacedPoints());
    }
  } else {
    updatePointUI();
  }
}

function undoPoint() {
  if (state.idx <= 0) return;
  state.idx--;
  state.placed.pop();

  triggerHaptic();
  playUndoSound();
  updatePointUI();

  if (state.onUndo) {
    state.onUndo(state.idx);
  }
}

function restartPoints() {
  state.placed = [];
  state.idx = 0;

  triggerHaptic();
  playUndoSound();
  fitImage();
  updatePointUI();

  if (state.onRestart) {
    state.onRestart();
  }
}

/* ============================================================
   UI ОБНОВЛЕНИЕ
   ============================================================ */

function updatePointUI() {
  if (state.idx >= POINTS.length) return;
  var p = POINTS[state.idx];
  dom.nameEl.textContent = (state.idx + 1) + "/" + POINTS.length + " · " + p[1];
  dom.descEl.textContent = p[2];

  /* Прогресс-кольцо */
  var progress = state.idx / POINTS.length;
  var circumference = 125.6;
  dom.ringEl.style.strokeDashoffset = circumference * (1 - progress);
}

/* ============================================================
   РЕНДЕР-ЦИКЛ
   ============================================================ */

function renderLoop(ts) {
  if (!state.active) {
    state.animId = null;
    return;
  }
  drawEditor(ts);
  drawGuide(ts);
  drawLoupe();
  state.animId = requestAnimationFrame(renderLoop);
}

/* ============================================================
   ОТРИСОВКА РЕДАКТОРА
   ============================================================ */

function drawEditor(ts) {
  var t = (ts || 0) / 1000;
  var ctx = dom.ctx;
  var dpr = state.dpr;
  var cw = state.cw;
  var ch = state.ch;
  var EC = EDITOR_CONFIG;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);

  /* Рисуем изображение с учётом зума и панорамирования */
  ctx.save();
  ctx.translate(state.view.ox, state.view.oy);
  ctx.scale(state.view.s, state.view.s);
  ctx.drawImage(state.img, 0, 0);
  ctx.restore();

  /* Рисуем размещённые точки */
  for (var i = 0; i < state.placed.length; i++) {
    var p = state.placed[i];
    var sx = p.x * state.img.width * state.view.s + state.view.ox;
    var sy = p.y * state.img.height * state.view.s + state.view.oy;

    ctx.fillStyle = '#3ddc84';
    ctx.beginPath();
    ctx.arc(sx, sy, EC.pointRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText((i + 1).toString(), sx + 6, sy - 6);
  }

  /* Перекрестие в центре экрана (куда будет поставлена следующая точка) */
  var pulse = EC.crosshairSize + Math.sin(t * EC.pulseSpeed) * EC.pulseAmplitude;
  ctx.strokeStyle = '#3ddc84';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#3ddc84';
  ctx.shadowBlur = pulse;

  var cx = cw / 2;
  var cy = ch / 2;
  ctx.beginPath();
  ctx.moveTo(cx - EC.crosshairSize, cy);
  ctx.lineTo(cx + EC.crosshairSize, cy);
  ctx.moveTo(cx, cy - EC.crosshairSize);
  ctx.lineTo(cx, cy + EC.crosshairSize);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/* ============================================================
   ОТРИСОВКА ГАЙДА (ВЕКТОРНОГО)
   ============================================================ */

function drawGuide(ts) {
  var t = (ts || 0) / 1000;
  var gctx = dom.guideCtx;
  var gw = EDITOR_CONFIG.guideWidth;
  var gh = EDITOR_CONFIG.guideHeight;
  var EC = EDITOR_CONFIG;

  gctx.clearRect(0, 0, gw, gh);

  /* Бледная подложка из guide.png */
  if (guideImg.complete && guideImg.naturalWidth > 0) {
    gctx.globalAlpha = 0.22;
    gctx.drawImage(guideImg, 0, 0, gw, gh);
    gctx.globalAlpha = 1.0;
  }

  /* Векторные линии схемы */
  gctx.strokeStyle = '#5a6a8a';
  gctx.lineWidth = 1.2;

  /* Овал лица */
  var faceCx = (SCH.bizR.x + SCH.bizL.x) / 2 * gw;
  var faceCy = (SCH.hair.y + SCH.chin.y) / 2 * gh;
  var faceRx = (SCH.bizL.x - SCH.bizR.x) / 2 * gw;
  var faceRy = (SCH.chin.y - SCH.hair.y) / 2 * gh;
  gctx.beginPath();
  gctx.ellipse(faceCx, faceCy, faceRx, faceRy, 0, 0, Math.PI * 2);
  gctx.stroke();

  /* Правый глаз */
  drawGuideEye(gctx, 'eyeRo', 'eyeRi', 'eyeRu', 'eyeRl', gw, gh);
  /* Левый глаз */
  drawGuideEye(gctx, 'eyeLo', 'eyeLi', 'eyeLu', 'eyeLl', gw, gh);

  /* Правая бровь */
  drawGuideBrow(gctx, 'browRi', 'browRp', 'browRo', gw, gh);
  /* Левая бровь */
  drawGuideBrow(gctx, 'browLi', 'browLp', 'browLo', gw, gh);

  /* Нос */
  gctx.beginPath();
  gctx.moveTo(SCH.nas.x * gw, SCH.nas.y * gh);
  gctx.lineTo(SCH.ntip.x * gw, SCH.ntip.y * gh);
  gctx.stroke();

  /* Рот */
  gctx.beginPath();
  gctx.moveTo(SCH.mouR.x * gw, SCH.mouR.y * gh);
  gctx.quadraticCurveTo(SCH.st.x * gw, SCH.st.y * gh, SCH.mouL.x * gw, SCH.mouL.y * gh);
  gctx.stroke();

  /* Челюсть */
  gctx.beginPath();
  gctx.moveTo(SCH.gonR.x * gw, SCH.gonR.y * gh);
  gctx.quadraticCurveTo(SCH.chin.x * gw, (SCH.chin.y + 0.02) * gh, SCH.gonL.x * gw, SCH.gonL.y * gh);
  gctx.stroke();

  /* Пульсирующая точка текущей позиции */
  if (state.idx < POINTS.length) {
    var currentId = POINTS[state.idx][0];
    var g = SCH[currentId];
    if (g) {
      var pulseR = EC.guidePulseBase + Math.sin(t * EC.pulseSpeed) * EC.guidePulseAmp;

      gctx.fillStyle = '#ff5c7a';
      gctx.beginPath();
      gctx.arc(g.x * gw, g.y * gh, 2.5, 0, Math.PI * 2);
      gctx.fill();

      gctx.globalAlpha = 0.5;
      gctx.strokeStyle = '#ff5c7a';
      gctx.beginPath();
      gctx.arc(g.x * gw, g.y * gh, pulseR + 3, 0, Math.PI * 2);
      gctx.stroke();
      gctx.globalAlpha = 1.0;
    }
  }
}

function drawGuideEye(gctx, outerId, innerId, upperId, lowerId, gw, gh) {
  var ex = (SCH[outerId].x + SCH[innerId].x) / 2 * gw;
  var ey = (SCH[upperId].y + SCH[lowerId].y) / 2 * gh;
  var erx = Math.abs(SCH[innerId].x - SCH[outerId].x) / 2 * gw;
  var ery = Math.abs(SCH[lowerId].y - SCH[upperId].y) / 2 * gh;
  gctx.beginPath();
  gctx.ellipse(ex, ey, Math.max(1, erx), Math.max(1, ery), 0, 0, Math.PI * 2);
  gctx.stroke();
}

function drawGuideBrow(gctx, innerId, peakId, outerId, gw, gh) {
  gctx.beginPath();
  gctx.moveTo(SCH[innerId].x * gw, SCH[innerId].y * gh);
  gctx.quadraticCurveTo(SCH[peakId].x * gw, SCH[peakId].y * gh, SCH[outerId].x * gw, SCH[outerId].y * gh);
  gctx.stroke();
}

/* ============================================================
   ЛУПА
   ============================================================ */

function drawLoupe() {
  var lctx = dom.loupeCtx;
  var L = EDITOR_CONFIG.loupeSize;
  var EC = EDITOR_CONFIG;

  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.clearRect(0, 0, L, L);

  /* Координаты центра экрана в пространстве изображения */
  var wx = ((state.cw / 2) - state.view.ox) / state.view.s;
  var wy = ((state.ch / 2) - state.view.oy) / state.view.s;
  var scale = L / (state.img.width * EC.loupeZoomFactor);

  lctx.save();
  lctx.translate(L / 2, L / 2);
  lctx.scale(scale, scale);
  lctx.translate(-wx, -wy);
  lctx.drawImage(state.img, 0, 0);
  lctx.restore();

  /* Перекрестие в лупе */
  lctx.strokeStyle = '#3ddc84';
  lctx.lineWidth = 1;
  lctx.beginPath();
  lctx.moveTo(L / 2 - 8, L / 2);
  lctx.lineTo(L / 2 + 8, L / 2);
  lctx.moveTo(L / 2, L / 2 - 8);
  lctx.lineTo(L / 2, L / 2 + 8);
  lctx.stroke();
}

/* ============================================================
   PAN / PINCH / TOUCH HANDLERS
   ============================================================ */

function setupTouchHandlers() {
  var canvas = dom.canvas;
  var lastPointerX = 0;
  var lastPointerY = 0;
  var isDragging = false;
  var lastPinchDist = 0;

  canvas.addEventListener('pointerdown', function(e) {
    if (e.pointerType === 'touch' || e.button === 0) {
      isDragging = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener('pointermove', function(e) {
    if (!isDragging) return;

    /* Панорамирование */
    var dx = e.clientX - lastPointerX;
    var dy = e.clientY - lastPointerY;
    state.view.ox += dx;
    state.view.oy += dy;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  });

  canvas.addEventListener('pointerup', function(e) {
    isDragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  });

  canvas.addEventListener('pointercancel', function(e) {
    isDragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  });

  /* Pinch-to-zoom для тач-устройств */
  var touches = {};

  canvas.addEventListener('touchstart', function(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      touches[t.identifier] = { x: t.clientX, y: t.clientY };
    }
    var keys = Object.keys(touches);
    if (keys.length === 2) {
      var t1 = touches[keys[0]];
      var t2 = touches[keys[1]];
      lastPinchDist = Math.hypot(t2.x - t1.x, t2.y - t1.y);
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', function(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      touches[t.identifier] = { x: t.clientX, y: t.clientY };
    }
    var keys = Object.keys(touches);
    if (keys.length === 2) {
      var t1 = touches[keys[0]];
      var t2 = touches[keys[1]];
      var pinchDist = Math.hypot(t2.x - t1.x, t2.y - t1.y);
      if (lastPinchDist > 0) {
        var ratio = pinchDist / lastPinchDist;
        var EC = EDITOR_CONFIG;
        state.view.s = Math.max(EC.minZoom, Math.min(EC.maxZoom, state.view.s * ratio));
      }
      lastPinchDist = pinchDist;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', function(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      delete touches[e.changedTouches[i].identifier];
    }
    if (Object.keys(touches).length < 2) {
      lastPinchDist = 0;
    }
  }, { passive: true });

  /* Wheel zoom для десктопа */
  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    var EC = EDITOR_CONFIG;
    if (e.deltaY < 0) {
      state.view.s = Math.min(EC.maxZoom, state.view.s * 1.1);
    } else {
      state.view.s = Math.max(EC.minZoom, state.view.s / 1.1);
    }
  }, { passive: false });

  /* Blur — сброс состояния при потере фокуса */
  canvas.addEventListener('blur', function() {
    isDragging = false;
    lastPinchDist = 0;
  });
}

/* ============================================================
   ЗВУКИ И ТАКТИЛЬНАЯ ОТДАЧА
   ============================================================ */

function triggerHaptic() {
  var TG = window.Telegram && window.Telegram.WebApp;
  if (TG && TG.HapticFeedback) {
    TG.HapticFeedback.impactOccurred('light');
  }
}

/* WebAudio API — звуки разблокируются через pointerdown */
var audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}

export function unlockAudio() {
  var a = ensureAudio();
  if (a && a.state === 'suspended') {
    a.resume();
  }
}

function playTone(freq, duration, volume) {
  var a = ensureAudio();
  if (!a) return;
  function go() {
    try {
      var osc = a.createOscillator();
      var gain = a.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume || 0.15, a.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + duration);
      osc.connect(gain);
      gain.connect(a.destination);
      osc.start();
      osc.stop(a.currentTime + duration);
    } catch (err) {}
  }
  if (a.state === 'running') {
    go();
  } else {
    a.resume().then(go);
  }
}

function playPlaceSound() {
  playTone(880, 0.08);
}

function playUndoSound() {
  playTone(320, 0.09);
}

function playStartSound() {
  playTone(660, 0.06, 0.1);
}

export function playDoneSound() {
  var notes = [523, 659, 784, 1046];
  for (var i = 0; i < notes.length; i++) {
    (function(freq, delay) {
      setTimeout(function() { playTone(freq, 0.14); }, delay);
    })(notes[i], i * 90);
  }
}

/* Экспорт unlockAudio для использования в app-logic.js */
export { ensureAudio };
