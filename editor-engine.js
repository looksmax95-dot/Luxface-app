/* ============================================================
   LUX FACE BOT — editor-engine.js
   Редактор точек: canvas, лупа, guide, pan/pinch, zoom, undo.
   
   Принцип:
   - editor-engine НЕ знает о метриках;
   - координаты точек хранятся нормализованно 0..1;
   - все преобразования screen <-> image проходят через view;
   - один unified Pointer Events pipeline вместо смешивания
     pointer/touch событий;
   - zoom сохраняет выбранную пользователем область;
   ============================================================ */

import { POINTS, SCH, EDITOR_CONFIG } from './config.js';

/* ============================================================
   СОСТОЯНИЕ РЕДАКТОРА
   ============================================================ */

var state = {
  img: null,

  /*
   placed:
   [
     {
       id: "pointId",
       x: 0..1,
       y: 0..1
     }
   ]
  */
  placed: [],

  idx: 0,

  /*
   view:
   s  = масштаб
   ox = X-смещение изображения на экране
   oy = Y-смещение изображения на экране
  */
  view: {
    s: 1,
    ox: 0,
    oy: 0
  },

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

/* ============================================================
   DOM
   ============================================================ */

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

/* ============================================================
   GUIDE IMAGE
   ============================================================ */

var guideImg = new Image();
guideImg.src = 'guide.png';

/* ============================================================
   POINTER STATE
   ============================================================ */

var pointers = new Map();

var gesture = {
  mode: 'none',

  lastX: 0,
  lastY: 0,

  pinchDistance: 0,
  pinchCenterX: 0,
  pinchCenterY: 0
};

/* ============================================================
   INITIALIZATION
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

  /*
   * Запрещаем браузеру интерпретировать touch-жесты
   * поверх canvas как scroll/zoom страницы.
   *
   * Сам zoom/pan обрабатывается ниже через Pointer Events.
   */
  dom.canvas.style.touchAction = 'none';

  /* Кнопки */
  if (dom.placeBtn) {
    dom.placeBtn.addEventListener('click', placePoint);
  }

  if (dom.undoBtn) {
    dom.undoBtn.addEventListener('click', undoPoint);
  }

  if (dom.restartBtn) {
    dom.restartBtn.addEventListener('click', restartPoints);
  }

  if (dom.zinBtn) {
    dom.zinBtn.addEventListener('click', zoomIn);
  }

  if (dom.zoutBtn) {
    dom.zoutBtn.addEventListener('click', zoomOut);
  }

  /* Pointer Events */
  setupPointerHandlers();

  /* Resize */
  window.addEventListener('resize', onResize);
}

/* ============================================================
   CALLBACKS
   ============================================================ */

export function setCallbacks(cbs) {
  if (!cbs) return;

  if (cbs.onPointPlaced) {
    state.onPointPlaced = cbs.onPointPlaced;
  }

  if (cbs.onAllPlaced) {
    state.onAllPlaced = cbs.onAllPlaced;
  }

  if (cbs.onUndo) {
    state.onUndo = cbs.onUndo;
  }

  if (cbs.onRestart) {
    state.onRestart = cbs.onRestart;
  }
}

/* ============================================================
   START / STOP
   ============================================================ */

export function startWithImage(imgElement) {
  if (!imgElement) return;

  state.img = imgElement;
  state.placed = [];
  state.idx = 0;
  state.active = true;

  clearGestureState();

  resizeCanvas();
  fitImage();
  updatePointUI();

  playStartSound();

  if (!state.animId) {
    state.animId = requestAnimationFrame(renderLoop);
  }
}

export function stopEditor() {
  state.active = false;

  clearGestureState();

  if (state.animId) {
    cancelAnimationFrame(state.animId);
    state.animId = null;
  }
}

/* ============================================================
   POINT DATA
   ============================================================ */

export function getPlacedPoints() {
  var result = [];

  for (var i = 0; i < state.placed.length; i++) {
    var item = state.placed[i];

    /*
     * id хранится непосредственно в placed.
     * Это безопаснее, чем полагаться на текущий порядок POINTS.
     */
    result.push({
      id: item.id,
      x: item.x,
      y: item.y
    });
  }

  return result;
}

export function getPlacedCount() {
  return state.placed.length;
}

export function isComplete() {
  return state.placed.length >= POINTS.length;
}

/* ============================================================
   CANVAS / RESIZE
   ============================================================ */

function resizeCanvas() {
  if (!dom.canvas) return;

  state.dpr = window.devicePixelRatio || 1;

  state.cw = window.innerWidth;
  state.ch = window.innerHeight;

  dom.canvas.width = Math.max(1, Math.round(state.cw * state.dpr));
  dom.canvas.height = Math.max(1, Math.round(state.ch * state.dpr));

  dom.canvas.style.width = state.cw + 'px';
  dom.canvas.style.height = state.ch + 'px';
}

function onResize() {
  if (!state.active || !state.img) return;

  /*
   * Не делаем fitImage() автоматически:
   * пользовательский zoom/pan не должен внезапно сбрасываться
   * при повороте/изменении размера окна.
   *
   * Вместо этого сохраняем текущую точку изображения,
   * находившуюся в центре viewport.
   */
  var center = screenToImage(state.cw / 2, state.ch / 2);

  resizeCanvas();

  if (
    center &&
    Number.isFinite(center.x) &&
    Number.isFinite(center.y)
  ) {
    state.view.ox = state.cw / 2 - center.x * state.view.s;
    state.view.oy = state.ch / 2 - center.y * state.view.s;
  }

  clampView();
}

function fitImage() {
  if (!state.img || !state.img.width || !state.img.height) {
    return;
  }

  var EC = EDITOR_CONFIG;

  var fitScale = Math.min(
    state.cw / state.img.width,
    state.ch / state.img.height
  ) * 0.9;

  /*
   * Не допускаем нулевой/NaN scale.
   */
  if (!Number.isFinite(fitScale) || fitScale <= 0) {
    fitScale = 1;
  }

  state.view.s = Math.max(
    EC.minZoom,
    Math.min(EC.maxZoom, fitScale)
  );

  state.view.ox =
    (state.cw - state.img.width * state.view.s) / 2;

  state.view.oy =
    (state.ch - state.img.height * state.view.s) / 2;

  clampView();
}

/* ============================================================
   VIEW LIMITS
   ============================================================ */

function clampView() {
  if (!state.img) return;

  var EC = EDITOR_CONFIG;

  state.view.s = Math.max(
    EC.minZoom,
    Math.min(EC.maxZoom, state.view.s)
  );

  /*
   * Не запрещаем полностью выводить изображение за экран:
   * при сильном zoom это необходимо.
   *
   * Но оставляем разумный запас, чтобы изображение
   * нельзя было полностью потерять.
   */
  var iw = state.img.width * state.view.s;
  var ih = state.img.height * state.view.s;

  var margin = Math.min(state.cw, state.ch) * 0.5;

  var minOx = state.cw - iw - margin;
  var maxOx = margin;

  var minOy = state.ch - ih - margin;
  var maxOy = margin;

  if (iw <= state.cw) {
    var centeredX = (state.cw - iw) / 2;
    minOx = centeredX - margin;
    maxOx = centeredX + margin;
  }

  if (ih <= state.ch) {
    var centeredY = (state.ch - ih) / 2;
    minOy = centeredY - margin;
    maxOy = centeredY + margin;
  }

  state.view.ox = Math.max(
    minOx,
    Math.min(maxOx, state.view.ox)
  );

  state.view.oy = Math.max(
    minOy,
    Math.min(maxOy, state.view.oy)
  );
}

/* ============================================================
   COORDINATE TRANSFORMS
   ============================================================ */

/*
 * Screen coordinates -> image pixel coordinates.
 */
function screenToImage(sx, sy) {
  if (!state.img || !state.view.s) {
    return null;
  }

  return {
    x: (sx - state.view.ox) / state.view.s,
    y: (sy - state.view.oy) / state.view.s
  };
}

/*
 * Image normalized coordinates -> screen coordinates.
 */
function normalizedToScreen(nx, ny) {
  if (!state.img) {
    return null;
  }

  return {
    x:
      nx * state.img.width * state.view.s +
      state.view.ox,

    y:
      ny * state.img.height * state.view.s +
      state.view.oy
  };
}

/*
 * Screen coordinates -> normalized image coordinates.
 */
function screenToNormalized(sx, sy) {
  var imagePoint = screenToImage(sx, sy);

  if (!imagePoint || !state.img) {
    return null;
  }

  return {
    x: imagePoint.x / state.img.width,
    y: imagePoint.y / state.img.height
  };
}

/* ============================================================
   ZOOM
   ============================================================ */

function zoomIn() {
  zoomAt(
    state.cw / 2,
    state.ch / 2,
    EDITOR_CONFIG.zoomStep
  );
}

function zoomOut() {
  zoomAt(
    state.cw / 2,
    state.ch / 2,
    1 / EDITOR_CONFIG.zoomStep
  );
}

/*
 * Zoom относительно конкретной точки экрана.
 *
 * Ключевой момент:
 * точка изображения под курсором/центром пальцев
 * остаётся на том же месте после изменения масштаба.
 */
function zoomAt(screenX, screenY, factor) {
  if (!state.img) return;

  var EC = EDITOR_CONFIG;

  var oldScale = state.view.s;

  var newScale = oldScale * factor;

  newScale = Math.max(
    EC.minZoom,
    Math.min(EC.maxZoom, newScale)
  );

  if (!Number.isFinite(newScale) || newScale === oldScale) {
    return;
  }

  /*
   * Какая точка изображения сейчас находится под курсором?
   */
  var imagePoint = screenToImage(screenX, screenY);

  state.view.s = newScale;

  if (imagePoint) {
    state.view.ox =
      screenX - imagePoint.x * newScale;

    state.view.oy =
      screenY - imagePoint.y * newScale;
  }

  clampView();
}

/* ============================================================
   POINT PLACEMENT
   ============================================================ */

function placePoint() {
  if (!state.active || !state.img) return;
  if (state.idx >= POINTS.length) return;

  /*
   * Точка всегда ставится под центральным crosshair.
   */
  var normalized = screenToNormalized(
    state.cw / 2,
    state.ch / 2
  );

  if (!normalized) return;

  /*
   * В старой версии координаты за пределами фотографии
   * просто clamp-ились в 0..1.
   *
   * Это опасно: если пользователь панорамировал лицо так,
   * что crosshair оказался вне изображения, на самом деле
   * получалась ложная точка ровно на границе изображения.
   *
   * Теперь такая постановка блокируется.
   */
  if (
    normalized.x < 0 ||
    normalized.x > 1 ||
    normalized.y < 0 ||
    normalized.y > 1
  ) {
    triggerHaptic('warning');
    return;
  }

  var pointDef = POINTS[state.idx];

  var placedPoint = {
    id: pointDef[0],
    x: normalized.x,
    y: normalized.y
  };

  state.placed.push(placedPoint);
  state.idx++;

  triggerHaptic('light');
  playPlaceSound();

  if (state.onPointPlaced) {
    state.onPointPlaced(
      state.idx - 1,
      normalized.x,
      normalized.y
    );
  }

  if (state.idx >= POINTS.length) {
    if (state.onAllPlaced) {
      state.onAllPlaced(getPlacedPoints());
    }
  } else {
    updatePointUI();
  }
}

/* ============================================================
   UNDO
   ============================================================ */

function undoPoint() {
  if (state.idx <= 0 || state.placed.length <= 0) {
    return;
  }

  state.idx--;
  state.placed.pop();

  triggerHaptic('light');
  playUndoSound();

  updatePointUI();

  if (state.onUndo) {
    state.onUndo(state.idx);
  }
}

/* ============================================================
   RESTART
   ============================================================ */

function restartPoints() {
  state.placed = [];
  state.idx = 0;

  clearGestureState();

  triggerHaptic('medium');
  playUndoSound();

  if (state.img) {
    fitImage();
  }

  updatePointUI();

  if (state.onRestart) {
    state.onRestart();
  }
}

/* ============================================================
   POINT UI
   ============================================================ */

function updatePointUI() {
  if (!dom.nameEl || !dom.descEl || !dom.ringEl) {
    return;
  }

  if (state.idx >= POINTS.length) {
    return;
  }

  var p = POINTS[state.idx];

  dom.nameEl.textContent =
    (state.idx + 1) +
    "/" +
    POINTS.length +
    " · " +
    p[1];

  dom.descEl.textContent = p[2];

  var progress =
    POINTS.length > 0
      ? state.idx / POINTS.length
      : 0;

  var circumference = 125.6;

  dom.ringEl.style.strokeDashoffset =
    circumference * (1 - progress);
}

/* ============================================================
   RENDER LOOP
   ============================================================ */

function renderLoop(ts) {
  if (!state.active) {
    state.animId = null;
    return;
  }

  drawEditor(ts);
  drawGuide(ts);
  drawLoupe();

  state.animId =
    requestAnimationFrame(renderLoop);
}

/* ============================================================
   EDITOR RENDER
   ============================================================ */

function drawEditor(ts) {
  if (!state.img || !dom.ctx) return;

  var t = (ts || 0) / 1000;

  var ctx = dom.ctx;
  var dpr = state.dpr;

  var cw = state.cw;
  var ch = state.ch;

  var EC = EDITOR_CONFIG;

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  ctx.clearRect(
    0,
    0,
    cw,
    ch
  );

  /* ==========================================================
     IMAGE
     ========================================================== */

  ctx.save();

  ctx.translate(
    state.view.ox,
    state.view.oy
  );

  ctx.scale(
    state.view.s,
    state.view.s
  );

  ctx.drawImage(
    state.img,
    0,
    0
  );

  ctx.restore();

  /* ==========================================================
     PLACED POINTS
     ========================================================== */

  for (var i = 0; i < state.placed.length; i++) {
    var p = state.placed[i];

    var screen = normalizedToScreen(
      p.x,
      p.y
    );

    if (!screen) continue;

    var sx = screen.x;
    var sy = screen.y;

    ctx.fillStyle = '#3ddc84';

    ctx.beginPath();

    ctx.arc(
      sx,
      sy,
      EC.pointRadius,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';

    ctx.fillText(
      (i + 1).toString(),
      sx + 6,
      sy - 6
    );
  }

  /* ==========================================================
     CROSSHAIR
     ========================================================== */

  var pulse =
    EC.crosshairSize +
    Math.sin(t * EC.pulseSpeed) *
    EC.pulseAmplitude;

  var cx = cw / 2;
  var cy = ch / 2;

  ctx.strokeStyle = '#3ddc84';
  ctx.lineWidth = 1.5;

  ctx.shadowColor = '#3ddc84';
  ctx.shadowBlur = pulse;

  ctx.beginPath();

  ctx.moveTo(
    cx - EC.crosshairSize,
    cy
  );

  ctx.lineTo(
    cx + EC.crosshairSize,
    cy
  );

  ctx.moveTo(
    cx,
    cy - EC.crosshairSize
  );

  ctx.lineTo(
    cx,
    cy + EC.crosshairSize
  );

  ctx.stroke();

  ctx.shadowBlur = 0;
}

/* ============================================================
   GUIDE
   ============================================================ */

function drawGuide(ts) {
  if (!dom.guideCtx) return;

  var t = (ts || 0) / 1000;

  var gctx = dom.guideCtx;

  var gw = EDITOR_CONFIG.guideWidth;
  var gh = EDITOR_CONFIG.guideHeight;

  var EC = EDITOR_CONFIG;

  gctx.clearRect(
    0,
    0,
    gw,
    gh
  );

  /* ==========================================================
     GUIDE IMAGE
     ========================================================== */

  if (
    guideImg.complete &&
    guideImg.naturalWidth > 0
  ) {
    gctx.globalAlpha = 0.22;

    gctx.drawImage(
      guideImg,
      0,
      0,
      gw,
      gh
    );

    gctx.globalAlpha = 1.0;
  }

  /* ==========================================================
     VECTOR GUIDE
     ========================================================== */

  gctx.strokeStyle = '#5a6a8a';
  gctx.lineWidth = 1.2;

  /* Face oval */

  var faceCx =
    (SCH.bizR.x + SCH.bizL.x) /
    2 *
    gw;

  var faceCy =
    (SCH.hair.y + SCH.chin.y) /
    2 *
    gh;

  var faceRx =
    (SCH.bizL.x - SCH.bizR.x) /
    2 *
    gw;

  var faceRy =
    (SCH.chin.y - SCH.hair.y) /
    2 *
    gh;

  gctx.beginPath();

  gctx.ellipse(
    faceCx,
    faceCy,
    Math.abs(faceRx),
    Math.abs(faceRy),
    0,
    0,
    Math.PI * 2
  );

  gctx.stroke();

  /* Eyes */

  drawGuideEye(
    gctx,
    'eyeRo',
    'eyeRi',
    'eyeRu',
    'eyeRl',
    gw,
    gh
  );

  drawGuideEye(
    gctx,
    'eyeLo',
    'eyeLi',
    'eyeLu',
    'eyeLl',
    gw,
    gh
  );

  /* Brows */

  drawGuideBrow(
    gctx,
    'browRi',
    'browRp',
    'browRo',
    gw,
    gh
  );

  drawGuideBrow(
    gctx,
    'browLi',
    'browLp',
    'browLo',
    gw,
    gh
  );

  /* Nose */

  gctx.beginPath();

  gctx.moveTo(
    SCH.nas.x * gw,
    SCH.nas.y * gh
  );

  gctx.lineTo(
    SCH.ntip.x * gw,
    SCH.ntip.y * gh
  );

  gctx.stroke();

  /* Mouth */

  gctx.beginPath();

  gctx.moveTo(
    SCH.mouR.x * gw,
    SCH.mouR.y * gh
  );

  gctx.quadraticCurveTo(
    SCH.st.x * gw,
    SCH.st.y * gh,
    SCH.mouL.x * gw,
    SCH.mouL.y * gh
  );

  gctx.stroke();

  /* Jaw */

  gctx.beginPath();

  gctx.moveTo(
    SCH.gonR.x * gw,
    SCH.gonR.y * gh
  );

  gctx.quadraticCurveTo(
    SCH.chin.x * gw,
    (SCH.chin.y + 0.02) * gh,
    SCH.gonL.x * gw,
    SCH.gonL.y * gh
  );

  gctx.stroke();

  /* ==========================================================
     CURRENT POINT
     ========================================================== */

  if (state.idx < POINTS.length) {
    var currentId =
      POINTS[state.idx][0];

    var g = SCH[currentId];

    if (g) {
      var pulseR =
        EC.guidePulseBase +
        Math.sin(t * EC.pulseSpeed) *
        EC.guidePulseAmp;

      gctx.fillStyle = '#ff5c7a';

      gctx.beginPath();

      gctx.arc(
        g.x * gw,
        g.y * gh,
        2.5,
        0,
        Math.PI * 2
      );

      gctx.fill();

      gctx.globalAlpha = 0.5;
      gctx.strokeStyle = '#ff5c7a';

      gctx.beginPath();

      gctx.arc(
        g.x * gw,
        g.y * gh,
        pulseR + 3,
        0,
        Math.PI * 2
      );

      gctx.stroke();

      gctx.globalAlpha = 1.0;
    }
  }
}

/* ============================================================
   GUIDE EYE
   ============================================================ */

function drawGuideEye(
  gctx,
  outerId,
  innerId,
  upperId,
  lowerId,
  gw,
  gh
) {
  if (
    !SCH[outerId] ||
    !SCH[innerId] ||
    !SCH[upperId] ||
    !SCH[lowerId]
  ) {
    return;
  }

  var ex =
    (SCH[outerId].x + SCH[innerId].x) /
    2 *
    gw;

  var ey =
    (SCH[upperId].y + SCH[lowerId].y) /
    2 *
    gh;

  var erx =
    Math.abs(
      SCH[innerId].x -
      SCH[outerId].x
    ) /
    2 *
    gw;

  var ery =
    Math.abs(
      SCH[lowerId].y -
      SCH[upperId].y
    ) /
    2 *
    gh;

  gctx.beginPath();

  gctx.ellipse(
    ex,
    ey,
    Math.max(1, erx),
    Math.max(1, ery),
    0,
    0,
    Math.PI * 2
  );

  gctx.stroke();
}

/* ============================================================
   GUIDE BROW
   ============================================================ */

function drawGuideBrow(
  gctx,
  innerId,
  peakId,
  outerId,
  gw,
  gh
) {
  if (
    !SCH[innerId] ||
    !SCH[peakId] ||
    !SCH[outerId]
  ) {
    return;
  }

  gctx.beginPath();

  gctx.moveTo(
    SCH[innerId].x * gw,
    SCH[innerId].y * gh
  );

  gctx.quadraticCurveTo(
    SCH[peakId].x * gw,
    SCH[peakId].y * gh,
    SCH[outerId].x * gw,
    SCH[outerId].y * gh
  );

  gctx.stroke();
}

/* ============================================================
   LOUPE
   ============================================================ */

function drawLoupe() {
  if (
    !state.img ||
    !dom.loupeCtx
  ) {
    return;
  }

  var lctx = dom.loupeCtx;

  var L =
    EDITOR_CONFIG.loupeSize;

  var EC =
    EDITOR_CONFIG;

  lctx.setTransform(
    1,
    0,
    0,
    1,
    0,
    0
  );

  lctx.clearRect(
    0,
    0,
    L,
    L
  );

  /*
   * Точка под центральным crosshair.
   */
  var imagePoint =
    screenToImage(
      state.cw / 2,
      state.ch / 2
    );

  if (!imagePoint) return;

  /*
   * Loupe scale:
   * L / (ширина изображения * коэффициент)
   */
  var scale =
    L /
    (
      state.img.width *
      EC.loupeZoomFactor
    );

  lctx.save();

  lctx.translate(
    L / 2,
    L / 2
  );

  lctx.scale(
    scale,
    scale
  );

  lctx.translate(
    -imagePoint.x,
    -imagePoint.y
  );

  lctx.drawImage(
    state.img,
    0,
    0
  );

  lctx.restore();

  /* Crosshair */

  lctx.strokeStyle = '#3ddc84';
  lctx.lineWidth = 1;

  lctx.beginPath();

  lctx.moveTo(
    L / 2 - 8,
    L / 2
  );

  lctx.lineTo(
    L / 2 + 8,
    L / 2
  );

  lctx.moveTo(
    L / 2,
    L / 2 - 8
  );

  lctx.lineTo(
    L / 2,
    L / 2 + 8
  );

  lctx.stroke();
}

/* ============================================================
   POINTER / PAN / PINCH
   ============================================================ */

function setupPointerHandlers() {
  var canvas = dom.canvas;

  if (!canvas) return;

  canvas.addEventListener(
    'pointerdown',
    onPointerDown
  );

  canvas.addEventListener(
    'pointermove',
    onPointerMove
  );

  canvas.addEventListener(
    'pointerup',
    onPointerUp
  );

  canvas.addEventListener(
    'pointercancel',
    onPointerUp
  );

  canvas.addEventListener(
    'pointerleave',
    onPointerLeave
  );

  canvas.addEventListener(
    'wheel',
    onWheel,
    {
      passive: false
    }
  );

  /*
   * На случай потери фокуса.
   */
  window.addEventListener(
    'blur',
    clearGestureState
  );
}

/* ============================================================
   POINTER DOWN
   ============================================================ */

function onPointerDown(e) {
  if (!state.active) return;

  /*
   * Левый mouse button.
   * Для touch/pen e.button может быть -1/0 в зависимости
   * от браузера.
   */
  if (
    e.pointerType === 'mouse' &&
    e.button !== 0
  ) {
    return;
  }

  pointers.set(
    e.pointerId,
    {
      x: e.clientX,
      y: e.clientY,
      type: e.pointerType
    }
  );

  try {
    dom.canvas.setPointerCapture(
      e.pointerId
    );
  } catch (err) {}

  var count = pointers.size;

  if (count === 1) {
    var p = pointers.get(e.pointerId);

    gesture.mode = 'pan';

    gesture.lastX = p.x;
    gesture.lastY = p.y;

    gesture.pinchDistance = 0;

    return;
  }

  if (count >= 2) {
    gesture.mode = 'pinch';

    updatePinchState();
  }
}

/* ============================================================
   POINTER MOVE
   ============================================================ */

function onPointerMove(e) {
  if (!state.active) return;
  if (!pointers.has(e.pointerId)) return;

  var pointer = pointers.get(
    e.pointerId
  );

  pointer.x = e.clientX;
  pointer.y = e.clientY;

  if (pointers.size === 1) {
    /*
     * Обычный pan.
     */
    if (gesture.mode !== 'pan') {
      gesture.mode = 'pan';

      gesture.lastX = pointer.x;
      gesture.lastY = pointer.y;

      return;
    }

    var dx =
      pointer.x -
      gesture.lastX;

    var dy =
      pointer.y -
      gesture.lastY;

    /*
     * Маленькие движения не должны превращаться
     * в какие-либо другие действия.
     */
    if (
      Number.isFinite(dx) &&
      Number.isFinite(dy)
    ) {
      state.view.ox += dx;
      state.view.oy += dy;

      clampView();
    }

    gesture.lastX = pointer.x;
    gesture.lastY = pointer.y;

    return;
  }

  if (pointers.size >= 2) {
    /*
     * Pinch.
     */
    if (gesture.mode !== 'pinch') {
      gesture.mode = 'pinch';
      updatePinchState();
      return;
    }

    updatePinchZoom();
  }
}

/* ============================================================
   POINTER UP
   ============================================================ */

function onPointerUp(e) {
  pointers.delete(e.pointerId);

  try {
    dom.canvas.releasePointerCapture(
      e.pointerId
    );
  } catch (err) {}

  if (pointers.size === 0) {
    clearGestureState();
    return;
  }

  if (pointers.size === 1) {
    /*
     * После окончания pinch продолжаем обычный pan
     * без резкого скачка координат.
     */
    var remaining =
      pointers.values().next().value;

    gesture.mode = 'pan';

    gesture.lastX = remaining.x;
    gesture.lastY = remaining.y;

    gesture.pinchDistance = 0;

    return;
  }

  if (pointers.size >= 2) {
    updatePinchState();
  }
}

/* ============================================================
   POINTER LEAVE
   ============================================================ */

function onPointerLeave(e) {
  /*
   * Ничего не сбрасываем, если pointer capture активен.
   * Это важно для pan, когда палец/мышь временно выходит
   * за пределы canvas.
   */
  if (
    dom.canvas.hasPointerCapture &&
    dom.canvas.hasPointerCapture(e.pointerId)
  ) {
    return;
  }
}

/* ============================================================
   PINCH STATE
   ============================================================ */

function getTwoPointers() {
  var values = Array.from(
    pointers.values()
  );

  if (values.length < 2) {
    return null;
  }

  return [
    values[0],
    values[1]
  ];
}

function calculatePinchData() {
  var pair = getTwoPointers();

  if (!pair) return null;

  var p1 = pair[0];
  var p2 = pair[1];

  var dx =
    p2.x - p1.x;

  var dy =
    p2.y - p1.y;

  var distance =
    Math.hypot(dx, dy);

  var centerX =
    (p1.x + p2.x) / 2;

  var centerY =
    (p1.y + p2.y) / 2;

  return {
    distance: distance,
    centerX: centerX,
    centerY: centerY
  };
}

function updatePinchState() {
  var data =
    calculatePinchData();

  if (!data) {
    gesture.pinchDistance = 0;
    return;
  }

  gesture.pinchDistance =
    data.distance;

  gesture.pinchCenterX =
    data.centerX;

  gesture.pinchCenterY =
    data.centerY;
}

/* ============================================================
   PINCH ZOOM
   ============================================================ */

function updatePinchZoom() {
  var data =
    calculatePinchData();

  if (!data) return;

  if (
    gesture.pinchDistance <= 0 ||
    !Number.isFinite(
      gesture.pinchDistance
    )
  ) {
    updatePinchState();
    return;
  }

  var ratio =
    data.distance /
    gesture.pinchDistance;

  /*
   * Защита от NaN/Infinity и экстремального скачка.
   */
  if (
    !Number.isFinite(ratio) ||
    ratio <= 0
  ) {
    updatePinchState();
    return;
  }

  /*
   * Ограничиваем один шаг.
   * Это защищает от скачка при потере нескольких touch frames.
   */
  ratio = Math.max(
    0.85,
    Math.min(1.18, ratio)
  );

  /*
   * Важная деталь:
   * zoom идёт относительно центра двух пальцев,
   * поэтому лицо не "убегает" из-под пальцев.
   */
  zoomAt(
    data.centerX,
    data.centerY,
    ratio
  );

  /*
   * После zoom запоминаем уже новое расстояние.
   */
  gesture.pinchDistance =
    data.distance;

  gesture.pinchCenterX =
    data.centerX;

  gesture.pinchCenterY =
    data.centerY;
}

/* ============================================================
   WHEEL ZOOM
   ============================================================ */

function onWheel(e) {
  if (!state.active) return;

  e.preventDefault();

  var factor =
    e.deltaY < 0
      ? 1.1
      : 1 / 1.1;

  zoomAt(
    e.clientX,
    e.clientY,
    factor
  );
}

/* ============================================================
   GESTURE RESET
   ============================================================ */

function clearGestureState() {
  pointers.clear();

  gesture.mode = 'none';

  gesture.lastX = 0;
  gesture.lastY = 0;

  gesture.pinchDistance = 0;
  gesture.pinchCenterX = 0;
  gesture.pinchCenterY = 0;
}

/* ============================================================
   HAPTIC
   ============================================================ */

function triggerHaptic(type) {
  var TG =
    window.Telegram &&
    window.Telegram.WebApp;

  if (
    TG &&
    TG.HapticFeedback
  ) {
    try {
      TG.HapticFeedback.impactOccurred(
        type || 'light'
      );
    } catch (err) {}
  }
}

/* ============================================================
   AUDIO
   ============================================================ */

var audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    var AC =
      window.AudioContext ||
      window.webkitAudioContext;

    if (AC) {
      try {
        audioCtx = new AC();
      } catch (err) {
        audioCtx = null;
      }
    }
  }

  return audioCtx;
}

export function unlockAudio() {
  var a = ensureAudio();

  if (
    a &&
    a.state === 'suspended'
  ) {
    try {
      var promise = a.resume();

      if (
        promise &&
        typeof promise.catch === 'function'
      ) {
        promise.catch(function() {});
      }
    } catch (err) {}
  }
}

function playTone(
  freq,
  duration,
  volume
) {
  var a = ensureAudio();

  if (!a) return;

  function go() {
    try {
      var osc =
        a.createOscillator();

      var gain =
        a.createGain();

      osc.type = 'sine';

      osc.frequency.value =
        freq;

      var v =
        Number.isFinite(volume)
          ? volume
          : 0.15;

      /*
       * Не допускаем отрицательную громкость.
       */
      v = Math.max(
        0.0001,
        Math.min(1, v)
      );

      gain.gain.setValueAtTime(
        v,
        a.currentTime
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        a.currentTime + duration
      );

      osc.connect(gain);
      gain.connect(a.destination);

      osc.start();

      osc.stop(
        a.currentTime + duration
      );
    } catch (err) {}
  }

  if (a.state === 'running') {
    go();
    return;
  }

  try {
    var promise = a.resume();

    if (
      promise &&
      typeof promise.then === 'function'
    ) {
      promise
        .then(go)
        .catch(function() {});
    }
  } catch (err) {}
}

function playPlaceSound() {
  playTone(
    880,
    0.08
  );
}

function playUndoSound() {
  playTone(
    320,
    0.09
  );
}

function playStartSound() {
  playTone(
    660,
    0.06,
    0.1
  );
}

/* ============================================================
   DONE SOUND
   ============================================================ */

export function playDoneSound() {
  var notes = [
    523,
    659,
    784,
    1046
  ];

  for (
    var i = 0;
    i < notes.length;
    i++
  ) {
    (function(freq, delay) {
      setTimeout(
        function() {
          playTone(
            freq,
            0.14
          );
        },
        delay
      );
    })(
      notes[i],
      i * 90
    );
  }
}

/* ============================================================
   AUDIO EXPORT
   ============================================================ */

export {
  ensureAudio
};
