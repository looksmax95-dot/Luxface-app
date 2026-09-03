/* ============================================================
   LUX FACE — app-logic.js
   Версия: v23-professional

   ОТВЕТСТВЕННОСТЬ:
   - связывает UI
   - editor-engine
   - math-core
   - Telegram WebApp

   НЕ СЧИТАЕТ МАТЕМАТИКУ САМ.

   Поток:

   Фото
      ↓
   editor-engine
      ↓
   46 точек
      ↓
   math-core
      ↓
   metric result
      ↓
   UI
      ↓
   Telegram
   ============================================================ */

import {
  APP_VERSION,
  POINTS,
  CATS,
  AXES,
  METRIC_SEGMENTS,
  RESULT_CONFIG
} from './config.js';


import {
  computeAllMetrics,
  computeThirds,
  computeAxes,
  computePSL,
  buildReportText,
  colorOf,
  tierName,
  looksmaxLabel
} from './math-core.js';


import {
  initEditor,
  setCallbacks,
  startWithImage,
  stopEditor,
  getPlacedPoints,
  playDoneSound,
  unlockAudio
} from './editor-engine.js';


/* ============================================================
   1. APP STATE
   ============================================================ */

var appState = {

  img: null,

  result: null,

  showAllLines: false,

  previousScore: null,

  previousVersion: null

};


/* ============================================================
   2. DOM
   ============================================================ */

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
   3. STORAGE
   ============================================================

   Старый ключ "luxprev" больше НЕ используется.

   Иначе после изменения формулы приложение могло сравнивать:

      v20 score

   с

      v23 score

   что математически бессмысленно.
   ============================================================ */

var STORAGE_KEY =
  "luxprev_" + APP_VERSION;


var STORAGE_VERSION_KEY =
  "luxprev_version";


/* ============================================================
   4. INIT
   ============================================================ */

export function initApp(domRefs) {

  if (!domRefs) {
    throw new Error(
      "initApp requires domRefs"
    );
  }


  ui.homeScreen =
    domRefs.homeScreen;

  ui.editorScreen =
    domRefs.editorScreen;

  ui.resultScreen =
    domRefs.resultScreen;

  ui.fileInput =
    domRefs.fileInput;

  ui.resultCanvas =
    domRefs.resultCanvas;

  ui.resultCtx =
    ui.resultCanvas.getContext("2d");

  ui.metricList =
    domRefs.metricList;

  ui.allLinesBtn =
    domRefs.allLinesBtn;

  ui.sendBtn =
    domRefs.sendBtn;


  /* ==========================================================
     EDITOR
     ========================================================== */

  initEditor({

    canvas:
      domRefs.editorCanvas,

    guideCanvas:
      domRefs.guideCanvas,

    loupeCanvas:
      domRefs.loupeCanvas,

    nameEl:
      domRefs.pointName,

    descEl:
      domRefs.pointDesc,

    ringEl:
      domRefs.progressRing,

    placeBtn:
      domRefs.placeBtn,

    undoBtn:
      domRefs.undoBtn,

    restartBtn:
      domRefs.restartBtn,

    zinBtn:
      domRefs.zinBtn,

    zoutBtn:
      domRefs.zoutBtn

  });


  setCallbacks({

    onAllPlaced:
      onAllPointsPlaced

  });


  /* ==========================================================
     EVENTS
     ========================================================== */

  ui.fileInput.addEventListener(
    "change",
    onFileSelected
  );


  ui.allLinesBtn.addEventListener(
    "click",
    toggleAllLines
  );


  ui.sendBtn.addEventListener(
    "click",
    sendToBot
  );


  document.addEventListener(
    "pointerdown",
    unlockAudio,
    { once: true }
  );


  document.addEventListener(
    "touchstart",
    unlockAudio,
    { once: true }
  );


  /*
     Если размер result canvas изменился,
     перерисовываем изображение.
  */

  window.addEventListener(
    "resize",
    function() {

      if (!appState.result) {
        return;
      }

      renderResultCanvas(0);

    }
  );


  loadPreviousScore();

}


/* ============================================================
   5. LOAD PREVIOUS SCORE
   ============================================================ */

function loadPreviousScore() {

  try {

    var version =
      localStorage.getItem(
        STORAGE_VERSION_KEY
      );


    /*
       Никогда не сравниваем результаты разных версий.
    */

    if (version !== APP_VERSION) {

      appState.previousScore =
        null;

      appState.previousVersion =
        null;

      return;
    }


    var previous =
      localStorage.getItem(
        STORAGE_KEY
      );


    if (previous === null) {
      return;
    }


    var parsed =
      Number(previous);


    if (!Number.isFinite(parsed)) {
      return;
    }


    appState.previousScore =
      parsed;

    appState.previousVersion =
      APP_VERSION;


  } catch (error) {

    appState.previousScore =
      null;

    appState.previousVersion =
      null;
  }

}


/* ============================================================
   6. SAVE CURRENT SCORE
   ============================================================ */

function saveCurrentScore(score) {

  if (!Number.isFinite(score)) {
    return;
  }


  try {

    localStorage.setItem(
      STORAGE_KEY,
      score.toFixed(2)
    );


    localStorage.setItem(
      STORAGE_VERSION_KEY,
      APP_VERSION
    );

  } catch (error) {

    /*
       localStorage может быть недоступен
       в private/sandboxed environment.
    */

  }

}


/* ============================================================
   7. FILE SELECTION
   ============================================================ */

function onFileSelected(event) {

  var file =
    event &&
    event.target &&
    event.target.files
      ? event.target.files[0]
      : null;


  if (!file) {
    return;
  }


  /*
     Только изображения.
  */

  if (
    !file.type ||
    file.type.indexOf("image/") !== 0
  ) {

    return;
  }


  unlockAudio();


  var reader =
    new FileReader();


  reader.onload =
    function(loadEvent) {

      var img =
        new Image();


      img.onload =
        function() {

          appState.img =
            img;

          appState.result =
            null;


          ui.homeScreen.style.display =
            "none";


          ui.editorScreen.style.display =
            "block";


          ui.resultScreen.style.display =
            "none";


          startWithImage(img);

        };


      img.onerror =
        function() {

          appState.img =
            null;

        };


      img.src =
        loadEvent.target.result;

    };


  reader.onerror =
    function() {

    };


  reader.readAsDataURL(file);

}


/* ============================================================
   8. ALL POINTS PLACED
   ============================================================ */

function onAllPointsPlaced(
  placedPoints
) {

  if (!appState.img) {
    return;
  }


  if (
    !Array.isArray(placedPoints)
  ) {

    return;
  }


  stopEditor();

  playDoneSound();


  /* ==========================================================
     MATH CORE
     ========================================================== */

  var result;


  try {

    result =
      computeAllMetrics(

        placedPoints,

        appState.img.width,

        appState.img.height

      );

  } catch (error) {

    console.error(
      "LUX math error:",
      error
    );

    return;
  }


  appState.result =
    result;


  /*
     Сохраняем именно текущий score.
  */

  saveCurrentScore(
    getDisplayScore(result)
  );


  /* ==========================================================
     SCREEN
     ========================================================== */

  ui.editorScreen.style.display =
    "none";

  ui.resultScreen.style.display =
    "flex";


  appState.showAllLines =
    false;


  ui.allLinesBtn.textContent =
    "ВСЕ ЛИНИИ";


  renderResultCanvas(0);

  buildResultUI();

}


/* ============================================================
   9. DISPLAY SCORE
   ============================================================

   Сейчас:

     professional result → /10

   fallback:

     legacy front result → /100

   UI использует отдельный helper,
   чтобы не путать эти шкалы.
   ============================================================ */

function getDisplayScore(result) {

  if (
    result &&
    result.professional &&
    Number.isFinite(
      result.professional.trueScore
    )
  ) {

    return result.professional.trueScore;

  }


  if (
    result &&
    Number.isFinite(result.overall)
  ) {

    return result.overall;

  }


  return 0;
}


/* ============================================================
   10. IS PROFESSIONAL RESULT?
   ============================================================ */

function hasProfessionalResult(result) {

  return !!(
    result &&
    result.professional &&
    Number.isFinite(
      result.professional.trueScore
    )
  );

}


/* ============================================================
   11. RESULT CANVAS FIT
   ============================================================ */

function fitResultCanvas() {

  var canvas =
    ui.resultCanvas;


  var w =
    canvas.clientWidth;


  var h =
    canvas.clientHeight;


  /*
     Иногда canvas ещё не получил layout size.
  */

  if (w <= 0) {
    w = 320;
  }

  if (h <= 0) {
    h = 320;
  }


  var dpr =
    window.devicePixelRatio || 1;


  canvas.width =
    Math.round(w * dpr);

  canvas.height =
    Math.round(h * dpr);


  var image =
    appState.img;


  var s =
    Math.min(

      w / image.width,

      h / image.height

    );


  return {

    w: w,

    h: h,

    s: s,

    ox:
      (w - image.width * s) / 2,

    oy:
      (h - image.height * s) / 2,

    dpr: dpr

  };

}


/* ============================================================
   12. BASE IMAGE
   ============================================================ */

function drawBaseImage(fit) {

  var ctx =
    ui.resultCtx;


  ctx.setTransform(
    fit.dpr,
    0,
    0,
    fit.dpr,
    0,
    0
  );


  ctx.clearRect(
    0,
    0,
    fit.w,
    fit.h
  );


  ctx.save();


  ctx.translate(
    fit.ox,
    fit.oy
  );


  ctx.scale(
    fit.s,
    fit.s
  );


  ctx.drawImage(
    appState.img,
    0,
    0
  );


  ctx.restore();

}


/* ============================================================
   13. DRAW METRIC
   ============================================================ */

function drawMetricSegments(
  fit,
  metric,
  lineWidth,
  withShadow
) {

  var ctx =
    ui.resultCtx;


  var c =
    colorOf(
      metric.score
    );


  var segments =
    METRIC_SEGMENTS[
      metric.name
    ] || [];


  var P =
    appState.result.PTS;


  ctx.strokeStyle =
    c;


  ctx.lineWidth =
    lineWidth;


  if (withShadow) {

    ctx.shadowColor =
      c;

    ctx.shadowBlur =
      6;

  }


  for (
    var i = 0;
    i < segments.length;
    i++
  ) {

    var segment =
      segments[i];


    var a =
      P[segment[0]];


    var b =
      P[segment[1]];


    if (!a || !b) {
      continue;
    }


    var ax =
      a.x * fit.s +
      fit.ox;


    var ay =
      a.y * fit.s +
      fit.oy;


    var bx =
      b.x * fit.s +
      fit.ox;


    var by =
      b.y * fit.s +
      fit.oy;


    ctx.beginPath();


    ctx.moveTo(
      ax,
      ay
    );


    ctx.lineTo(
      bx,
      by
    );


    ctx.stroke();


    /*
       Endpoints.
    */

    ctx.fillStyle =
      c;


    ctx.beginPath();


    ctx.arc(
      ax,
      ay,
      3,
      0,
      Math.PI * 2
    );


    ctx.fill();


    ctx.beginPath();


    ctx.arc(
      bx,
      by,
      3,
      0,
      Math.PI * 2
    );


    ctx.fill();

  }


  ctx.shadowBlur =
    0;

}


/* ============================================================
   14. RESULT CANVAS
   ============================================================ */

function renderResultCanvas(
  metricIndex
) {

  if (
    !appState.img ||
    !appState.result
  ) {

    return;
  }


  var fit =
    fitResultCanvas();


  drawBaseImage(fit);


  var metrics =
    appState.result.metrics ||
    [];


  if (
    appState.showAllLines
  ) {

    for (
      var i = 0;
      i < metrics.length;
      i++
    ) {

      drawMetricSegments(
        fit,
        metrics[i],
        1.2,
        false
      );

    }


    ui.resultCtx.fillStyle =
      "#fff";


    ui.resultCtx.font =
      "700 14px sans-serif";


    ui.resultCtx.fillText(
      "Все измерения",
      10,
      20
    );


    return;
  }


  if (
    metricIndex >= 0 &&
    metricIndex < metrics.length
  ) {

    var metric =
      metrics[metricIndex];


    drawMetricSegments(
      fit,
      metric,
      2.5,
      true
    );


    ui.resultCtx.fillStyle =
      colorOf(metric.score);


    ui.resultCtx.font =
      "700 14px sans-serif";


    ui.resultCtx.fillText(

      metric.name +
      " · " +
      Math.round(
        metric.score
      ) +
      "/100",

      10,
      20

    );

  }

}


/* ============================================================
   15. TOGGLE LINES
   ============================================================ */

function toggleAllLines() {

  appState.showAllLines =
    !appState.showAllLines;


  ui.allLinesBtn.textContent =
    appState.showAllLines
      ? "ОДНА"
      : "ВСЕ ЛИНИИ";


  renderResultCanvas(0);

  triggerHaptic();

}


/* ============================================================
   16. HAPTIC
   ============================================================ */

function triggerHaptic() {

  var TG =
    window.Telegram &&
    window.Telegram.WebApp;


  if (
    TG &&
    TG.HapticFeedback
  ) {

    try {

      TG.HapticFeedback
        .impactOccurred(
          "light"
        );

    } catch (error) {

    }

  }

}


/* ============================================================
   17. HTML ESCAPE
   ============================================================

   Раньше имена из config вставлялись в innerHTML напрямую.

   Сейчас конфигурация локальная, но всё равно безопаснее
   экранировать текст перед вставкой.
   ============================================================ */

function escapeHtml(value) {

  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* ============================================================
   18. RESULT UI
   ============================================================ */

function buildResultUI() {

  var R =
    appState.result;


  if (!R) {
    return;
  }


  var RC =
    RESULT_CONFIG;


  var thirds =
    computeThirds(
      R.PTS
    );


  var axes =
    computeAxes(
      R.metrics,
      AXES
    );


  var professional =
    hasProfessionalResult(
      R
    );


  var html = "";


  /* ==========================================================
     SCORE HEADER
     ========================================================== */

  if (professional) {

    var trueScore =
      R.professional.trueScore;


    var label =
      R.professional.scaleLabel;


    var psl =
      computePSL(
        trueScore
      );


    html +=
      '<h1 style="padding:4px 0 0">' +

      trueScore.toFixed(2) +

      ' / 10 ' +

      '<span style="font-size:16px">[' +

      escapeHtml(label) +

      ']</span></h1>';


    html +=
      '<div class="sub">PSL ' +

      psl.toFixed(2) +

      '/10 · Confidence ' +

      Math.round(
        R.quality.conf
      ) +

      '% (не влияет на балл)</div>';


  } else {

    /*
       Временный fallback.

       Не называем этот результат professional.
    */

    var legacyScore =
      Number(R.overall) || 0;


    html +=
      '<h1 style="padding:4px 0 0">' +

      legacyScore.toFixed(1) +

      ' / 100 ' +

      '<span style="font-size:16px">[' +

      escapeHtml(
        R.label ||
        looksmaxLabel(
          legacyScore
        )
      ) +

      ']</span></h1>';


    html +=
      '<div class="sub">LEGACY FRONT SCORE · Confidence ' +

      Math.round(
        R.quality.conf
      ) +

      '% (не влияет на балл)</div>';

  }


  /* ==========================================================
     VERSION
     ========================================================== */

  html +=
    '<div class="sub">Engine ' +
    escapeHtml(APP_VERSION) +
    '</div>';


  /* ==========================================================
     DELTA
     ========================================================== */

  var currentScore =
    getDisplayScore(R);


  var deltaHtml =
    "";


  if (
    appState.previousScore !== null &&
    Number.isFinite(
      appState.previousScore
    )
  ) {

    var delta =
      currentScore -
      appState.previousScore;


    deltaHtml =
      '<div class="brow">' +

      '<span>Previous</span>' +

      '<span>' +

      appState.previousScore
        .toFixed(2) +

      '</span></div>' +

      '<div class="brow">' +

      '<span>Current</span>' +

      '<span>' +

      currentScore.toFixed(2) +

      ' (' +

      (
        delta >= 0
          ? "+"
          : ""
      ) +

      delta.toFixed(2) +

      ')</span></div>';

  }


  /* ==========================================================
     THIRD
     ========================================================== */

  html +=
    '<div class="sub">Thirds ' +

    Math.round(thirds[0]) +

    '/' +

    Math.round(thirds[1]) +

    '/' +

    Math.round(thirds[2]) +

    '%</div>';


  /* ==========================================================
     QUALITY WARNINGS
     ========================================================== */

  if (
    R.quality &&
    R.quality.warns &&
    R.quality.warns.length > 0
  ) {

    html +=
      '<div class="sub" style="color:var(--warn)">⚠️ ' +

      'Точность снижена: ' +

      escapeHtml(
        R.quality.warns.join(", ")
      ) +

      '</div>';

  }


  /* ==========================================================
     PROFESSIONAL PILLARS
     ========================================================== */

  if (professional) {

    html +=
      '<div class="card2">' +

      '<div class="sub" style="margin-bottom:6px">' +

      'PROFESSIONAL PILLARS' +

      '</div>';


    var pillarNames = [
      "HARM",
      "MISC",
      "ANGU",
      "DIMO"
    ];


    for (
      var pi = 0;
      pi < pillarNames.length;
      pi++
    ) {

      var pillarName =
        pillarNames[pi];


      var pillar =
        R.professional
          .pillars[
            pillarName
          ];


      if (!pillar) {
        continue;
      }


      html +=

        '<div class="brow">' +

        '<span>' +

        pillarName +

        '</span>' +

        '<span style="font-weight:800">' +

        pillar.score10
          .toFixed(2) +

        '/10' +

        '</span>' +

        '</div>';


      html +=

        '<div class="sub">' +

        'weight ' +

        pillar.weight
          .toFixed(4) +

        ' · penalty ×' +

        pillar.penaltyFactor
          .toFixed(2) +

        '</div>';

    }


    html +=
      '</div>';

  }


  /* ==========================================================
     LEGACY RAW DATA
     ========================================================== */

  if (!professional) {

    html +=

      '<div class="card2">' +

      '<div class="sub">' +

      'Legacy front metrics only. ' +

      'Professional 4-pillar score will be shown ' +

      'after all four pillars are connected.' +

      '</div>' +

      '</div>';

  }


  /* ==========================================================
     PROFILES
     ========================================================== */

  html +=
    '<div class="card2">' +

    '<div class="sub" style="margin-bottom:6px">' +

    'PROFILES' +

    '</div>';


  var axisNames =
    Object.keys(axes);


  for (
    var a = 0;
    a < axisNames.length;
    a++
  ) {

    var axisName =
      axisNames[a];


    var axisScore =
      axes[axisName];


    html +=

      '<div class="brow">' +

      '<span>' +

      escapeHtml(axisName) +

      '</span>' +

      '<span style="color:' +

      colorOf(axisScore) +

      ';font-weight:800">' +

      Math.round(axisScore) +

      '</span>' +

      '</div>';

  }


  html +=
    '</div>';


  /* ==========================================================
     STRONG / WEAK
     ========================================================== */

  var sorted =
    R.metrics
      .slice()
      .sort(
        function(a, b) {
          return b.score - a.score;
        }
      );


  var strong =
    sorted.slice(
      0,
      RC.strongCount
    );


  var weak =
    sorted
      .slice(
        -RC.weakCount
      )
      .reverse();


  html +=
    '<div class="card2">' +

    deltaHtml;


  html +=
    '<div class="brow">' +

    '<span>💪</span>' +

    '<span>' +

    strong
      .map(
        function(m) {
          return escapeHtml(
            m.name
          );
        }
      )
      .join(", ") +

    '</span>' +

    '</div>';


  html +=
    '<div class="brow">' +

    '<span>⚠️</span>' +

    '<span>' +

    weak
      .map(
        function(m) {
          return escapeHtml(
            m.name
          );
        }
      )
      .join(", ") +

    '</span>' +

    '</div>';


  html +=
    '</div>';


  /* ==========================================================
     LEGACY CATEGORY BREAKDOWN
     ========================================================== */

  html +=
    '<div class="card2">' +

    '<div class="sub" style="margin-bottom:6px">' +

    'BREAKDOWN' +

    '</div>';


  for (
    var c = 0;
    c < CATS.length;
    c++
  ) {

    var catName =
      CATS[c];


    var catScore =
      R.catScores[
        catName
      ];


    if (
      !Number.isFinite(
        catScore
      )
    ) {

      catScore = 0;

    }


    html +=

      '<div class="brow">' +

      '<span>' +

      escapeHtml(catName) +

      '</span>' +

      '<span style="color:' +

      colorOf(catScore) +

      ';font-weight:800">' +

      Math.round(catScore) +

      '</span>' +

      '</div>';

  }


  html +=
    '</div>';


  /* ==========================================================
     METRIC LIST
     ========================================================== */

  for (
    var ci = 0;
    ci < CATS.length;
    ci++
  ) {

    var category =
      CATS[ci];


    var categoryMetrics =
      R.metrics.filter(
        function(metric) {
          return metric.cat === category;
        }
      );


    if (
      categoryMetrics.length === 0
    ) {

      continue;

    }


    html +=
      '<h2 class="cat">' +

      escapeHtml(category) +

      '</h2>';


    for (
      var mi = 0;
      mi < categoryMetrics.length;
      mi++
    ) {

      var metric =
        categoryMetrics[mi];


      var tier =
        tierName(
          metric.tierIndex
        );


      var chipColor =
        colorOf(
          metric.score
        );


      var delay =
        (
          mi *
          RC.animationDelayStep
        ).toFixed(2);


      var sign =
        metric.points >= 0
          ? "+"
          : "";


      var gauge =
        computeGauge(
          metric.value,
          metric.lo,
          metric.hi
        );


      html +=

        '<div class="mrow" ' +

        'data-metric="' +

        escapeHtml(
          metric.name
        ) +

        '" ' +

        'style="animation-delay:' +

        delay +

        's">' +


        '<div class="mhead">' +

        '<span>' +

        escapeHtml(
          metric.name
        ) +

        ' [' +

        tier +

        ']</span>' +


        '<span class="chip" ' +

        'style="background:' +

        chipColor +

        '22;color:' +

        chipColor +

        '">' +

        sign +

        metric.points
          .toFixed(1) +

        '</span>' +

        '</div>' +


        '<div class="gauge" ' +

        'style="background:' +

        gauge.grad +

        '">' +

        '<i style="left:' +

        gauge.pos +

        '%"></i>' +

        '</div>' +


        '<div class="sub">' +

        metric.value
          .toFixed(2) +

        escapeHtml(
          metric.unit
        ) +

        ' · идеал ' +

        escapeHtml(
          metric.lo
        ) +

        '–' +

        escapeHtml(
          metric.hi
        ) +

        '</div>' +


        '</div>';

    }

  }


  ui.metricList.innerHTML =
    html;


  /* ==========================================================
     METRIC CLICK EVENTS
     ========================================================== */

  var rows =
    ui.metricList
      .querySelectorAll(
        ".mrow"
      );


  for (
    var r = 0;
    r < rows.length;
    r++
  ) {

    rows[r].addEventListener(
      "click",
      onMetricClick
    );

  }

}


/* ============================================================
   19. METRIC CLICK
   ============================================================ */

function onMetricClick() {

  var metricName =
    this.getAttribute(
      "data-metric"
    );


  if (!metricName) {
    return;
  }


  var metrics =
    appState.result &&
    appState.result.metrics
      ? appState.result.metrics
      : [];


  var index = -1;


  for (
    var i = 0;
    i < metrics.length;
    i++
  ) {

    if (
      metrics[i].name ===
      metricName
    ) {

      index = i;

      break;

    }

  }


  if (index < 0) {
    return;
  }


  appState.showAllLines =
    false;


  ui.allLinesBtn.textContent =
    "ВСЕ ЛИНИИ";


  renderResultCanvas(
    index
  );


  triggerHaptic();

}


/* ============================================================
   20. GAUGE
   ============================================================ */

function computeGauge(
  value,
  lo,
  hi
) {

  var low =
    Number(lo);


  var high =
    Number(hi);


  var current =
    Number(value);


  if (
    !Number.isFinite(low) ||
    !Number.isFinite(high) ||
    !Number.isFinite(current) ||
    high <= low
  ) {

    return {

      pos: "50.0",

      grad:
        "linear-gradient(90deg,var(--bad) 0%,var(--bad) 100%)"

    };

  }


  var sigma =
    Math.abs(
      high - low
    ) / 2;


  var k =
    RESULT_CONFIG
      .gaugeSigmaMultiplier;


  var rangeLeft =
    low -
    k * sigma;


  var rangeRight =
    high +
    k * sigma;


  var total =
    rangeRight -
    rangeLeft;


  if (total <= 0) {

    return {

      pos: "50.0",

      grad:
        "linear-gradient(90deg,var(--bad) 0%,var(--bad) 100%)"

    };

  }


  var position =
    (
      current -
      rangeLeft
    ) / total;


  position =
    Math.max(
      0,
      Math.min(
        1,
        position
      )
    );


  var greenStart =
    (
      (low - rangeLeft) /
      total
    ) * 100;


  var greenEnd =
    (
      (high - rangeLeft) /
      total
    ) * 100;


  var yellowLeft =
    greenStart * 0.5;


  var yellowRight =
    100 -
    (
      (100 - greenEnd) *
      0.5
    );


  var gradient =

    "linear-gradient(90deg," +

    "var(--bad) 0%," +

    "var(--warn) " +

    yellowLeft.toFixed(1) +

    "%," +

    "var(--ok) " +

    greenStart.toFixed(1) +

    "%," +

    "var(--ok) " +

    greenEnd.toFixed(1) +

    "%," +

    "var(--warn) " +

    yellowRight.toFixed(1) +

    "%," +

    "var(--bad) 100%)";


  return {

    pos:
      (
        position * 100
      ).toFixed(1),

    grad:
      gradient

  };

}


/* ============================================================
   21. SEND TO BOT
   ============================================================ */

function sendToBot() {

  var result =
    appState.result;


  if (!result) {
    return;
  }


  var reportText =
    buildReportText(
      result
    );


  var professional =
    hasProfessionalResult(
      result
    );


  var score =
    getDisplayScore(
      result
    );


  var label =
    professional

      ? result.professional.scaleLabel

      : (
          result.label ||
          looksmaxLabel(
            result.overall
          )
        );


  var payload = {

    t: "lux",

    text:
      reportText,

    overall:
      score,

    label:
      label,

    confidence:
      result.quality
        ? result.quality.conf
        : 0,

    version:
      APP_VERSION,

    scoreScale:
      professional
        ? "0-10"
        : "legacy-0-100"

  };


  var TG =
    window.Telegram &&
    window.Telegram.WebApp;


  if (!TG) {
    return;
  }


  try {

    TG.sendData(
      JSON.stringify(
        payload
      )
    );


    TG.close();

  } catch (error) {

    console.error(
      "Telegram sendData error:",
      error
    );

  }

}


/* ============================================================
   END
   ============================================================ */
