/* ============================================================
   LUX FACE — math-core.js
   Версия: v23-professional
   Дата: 2026-09-01

   ЧИСТАЯ МАТЕМАТИКА.
   Никакого DOM.
   Никакого canvas.

   Архитектура:

   POINTS
      ↓
   geometry
      ↓
   metric values
      ↓
   tier / absolute points
      ↓
   pillar raw scores
      ↓
   pillar normalization 0..10
      ↓
   dynamic penalty factors
      ↓
   normalized post-penalty weights
      ↓
   TRUE_SCORE 0..10

   ВАЖНО:

   Professional formula использует 4 pillars:

     HARM = 32%
     MISC = 26%
     ANGU = 22%
     DIMO = 20%

   Но текущий интерфейс содержит только front-point metrics.
   Поэтому computeProfessionalScore() принимает уже готовые
   raw pillar scores.

   Нельзя молча превращать 26 существующих метрик в MISC/ANGU/DIMO:
   это было бы выдумыванием исходной формулы.
   ============================================================ */

import {
  METRIC_TABLE,
  TIER_THRESHOLDS,
  CATS,
  SYMMETRY_PAIRS,
  QUALITY_THRESHOLDS,
  LOOKSMAX_SCALE,
  NORMALIZATION,

  PILLAR_WEIGHTS,
  PILLAR_NORMALIZATION,
  PENALTY_FACTORS,
  HARM_METRICS
} from './config.js';


/* ============================================================
   1. БАЗОВЫЕ ЧИСЛОВЫЕ HELPERS
   ============================================================ */

export function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}


export function safeNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}


export function safeDivide(a, b, fallback = 0) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return fallback;
  }

  if (Math.abs(b) < 1e-12) {
    return fallback;
  }

  return a / b;
}


/* ============================================================
   2. ГЕОМЕТРИЯ
   ============================================================ */

export function dist(a, b) {
  if (!a || !b) return 0;

  var dx = a.x - b.x;
  var dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
}


/*
   Угол при вершине b.

   Возвращает 0..180°.
*/

export function angleAt(a, b, c) {
  if (!a || !b || !c) return 0;

  var v1x = a.x - b.x;
  var v1y = a.y - b.y;

  var v2x = c.x - b.x;
  var v2y = c.y - b.y;

  var len1 = Math.sqrt(v1x * v1x + v1y * v1y);
  var len2 = Math.sqrt(v2x * v2x + v2y * v2y);

  if (len1 < 1e-9 || len2 < 1e-9) {
    return 0;
  }

  var dot = v1x * v2x + v1y * v2y;

  var cosVal = dot / (len1 * len2);

  cosVal = clamp(cosVal, -1, 1);

  return Math.acos(cosVal) * 180 / Math.PI;
}


/*
   Подписанный угол линии относительно горизонтали.

   В image coordinates Y направлен вниз.

   Поэтому "положительный вверх" реализуем явно,
   а не полагаемся на случайный порядок точек.
*/

export function signedLineAngle(a, b) {
  if (!a || !b) return 0;

  var dx = b.x - a.x;
  var dy = a.y - b.y;

  if (Math.abs(dx) < 1e-9) {
    return dy >= 0 ? 90 : -90;
  }

  return Math.atan2(dy, dx) * 180 / Math.PI;
}


/*
   Средний абсолютный угол двух линий.

   Используется для метрик, где важна величина наклона,
   а не направление.
*/

export function averageAbsoluteAngle(a, b, c, d) {
  var first = Math.abs(signedLineAngle(a, b));
  var second = Math.abs(signedLineAngle(c, d));

  return (first + second) / 2;
}


/* ============================================================
   3. TIER SYSTEM — LEGACY COMPATIBILITY
   ============================================================

   Старый UI пока ожидает tierIndex.

   ВАЖНО:

   Professional formula не предполагает, что итоговый score
   строится через старую глобальную T1-T5 таблицу.

   Эта функция пока нужна интерфейсу и старым metric entries.
   ============================================================ */

export function getTierIndex(value, lo, hi) {
  if (!Number.isFinite(value)) {
    return TIER_THRESHOLDS.length - 1;
  }

  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return TIER_THRESHOLDS.length - 1;
  }

  if (hi < lo) {
    var temp = lo;
    lo = hi;
    hi = temp;
  }

  var center = (lo + hi) / 2;
  var halfRange = Math.max(
    Math.abs(hi - lo) / 2,
    1e-12
  );

  var deviation = Math.abs(value - center);

  for (var i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (deviation <= halfRange * TIER_THRESHOLDS[i]) {
      return i;
    }
  }

  return TIER_THRESHOLDS.length - 1;
}


export function tierName(idx) {
  var names = [
    "T1",
    "T2",
    "T3",
    "T4",
    "T5"
  ];

  if (idx >= 0 && idx < names.length) {
    return names[idx];
  }

  return "T?";
}


/* ============================================================
   4. LOOKSMAX LABEL — LEGACY UI
   ============================================================ */

export function looksmaxLabel(percent) {
  var value = clamp(percent, 0, 100);

  for (var i = 0; i < LOOKSMAX_SCALE.length; i++) {
    if (value >= LOOKSMAX_SCALE[i].min) {
      return LOOKSMAX_SCALE[i].label;
    }
  }

  return LOOKSMAX_SCALE[
    LOOKSMAX_SCALE.length - 1
  ].label;
}


/* ============================================================
   5. МЕТРИКИ
   ============================================================ */

export var METRIC_FUNCTIONS = {

  /* ==========================================================
     EYES
     ========================================================== */

  "Eye separation": function(P, bizy, fh) {

    var ipd = dist(P.eyeRc, P.eyeLc);

    return safeDivide(
      ipd,
      Math.max(1, bizy),
      0
    );
  },


  /*
     Canthal tilt.

     В старом коде:

       atan2(y2-y1, abs(dx))

     давал неправильный знак при image coordinates.

     Теперь используем signedLineAngle().
  */

  "Canthal tilt": function(P, bizy, fh) {

    var rightAngle = signedLineAngle(
      P.eyeRo,
      P.eyeRi
    );

    var leftAngle = signedLineAngle(
      P.eyeLo,
      P.eyeLi
    );

    /*
       Для симметричных глаз направления левой и правой
       линии должны интерпретироваться одинаково.
    */

    return (
      rightAngle + leftAngle
    ) / 2;
  },


  "Eye spacing": function(P, bizy, fh) {

    var rightWidth = dist(
      P.eyeRo,
      P.eyeRi
    );

    var leftWidth = dist(
      P.eyeLo,
      P.eyeLi
    );

    var eyeWidth = (
      rightWidth +
      leftWidth
    ) / 2;

    var intercanthal = dist(
      P.eyeRi,
      P.eyeLi
    );

    return safeDivide(
      intercanthal,
      Math.max(1, eyeWidth),
      0
    );
  },


  "Eye aspect": function(P, bizy, fh) {

    var rightWidth = dist(
      P.eyeRo,
      P.eyeRi
    );

    var rightHeight = Math.max(
      1,
      dist(P.eyeRu, P.eyeRl)
    );

    var leftWidth = dist(
      P.eyeLo,
      P.eyeLi
    );

    var leftHeight = Math.max(
      1,
      dist(P.eyeLu, P.eyeLl)
    );

    var rightAspect =
      rightWidth / rightHeight;

    var leftAspect =
      leftWidth / leftHeight;

    return (
      rightAspect +
      leftAspect
    ) / 2;
  },


  "Eyebrow tilt": function(P, bizy, fh) {

    var rightTilt = signedLineAngle(
      P.browRi,
      P.browRo
    );

    var leftTilt = signedLineAngle(
      P.browLi,
      P.browLo
    );

    /*
       Усредняем абсолютную величину,
       потому что левая и правая бровь имеют
       зеркальную геометрию.
    */

    return (
      Math.abs(rightTilt) +
      Math.abs(leftTilt)
    ) / 2;
  },


  "Eyebrow setness": function(P, bizy, fh) {

    var rightEyeBrow = dist(
      P.eyeRc,
      P.browRp
    );

    var leftEyeBrow = dist(
      P.eyeLc,
      P.browLp
    );

    var eyeWidthRight = dist(
      P.eyeRo,
      P.eyeRi
    );

    var eyeWidthLeft = dist(
      P.eyeLo,
      P.eyeLi
    );

    /*
       Нормализуем расстояние до брови
       относительно ширины глаза.

       Это стабильнее, чем сравнивать расстояние
       с высотой глаза.
    */

    var right = safeDivide(
      rightEyeBrow,
      Math.max(1, eyeWidthRight),
      0
    );

    var left = safeDivide(
      leftEyeBrow,
      Math.max(1, eyeWidthLeft),
      0
    );

    return (right + left) / 2;
  },


  /*
     ВАЖНО:

     Это не настоящий 3D orbital vector.
     С текущими 2D точками его невозможно корректно
     вычислить как 3D-анатомический показатель.

     Поэтому оставляем только как 2D proxy.
  */

  "Orbital vector": function(P, bizy, fh) {

    var right = safeDivide(
      P.zygR.y - P.eyeRl.y,
      Math.max(1, fh),
      0
    );

    var left = safeDivide(
      P.zygL.y - P.eyeLl.y,
      Math.max(1, fh),
      0
    );

    return (
      (right + left) / 2
    ) * 10;
  },


  /* ==========================================================
     PROPORTIONS
     ========================================================== */

  "Upper third": function(P, bizy, fh) {

    return safeDivide(
      dist(P.hair, P.nas),
      Math.max(1, fh),
      0
    );
  },


  "Middle third": function(P, bizy, fh) {

    return safeDivide(
      dist(P.nas, P.sub),
      Math.max(1, fh),
      0
    );
  },


  "Lower third": function(P, bizy, fh) {

    return safeDivide(
      dist(P.sub, P.chin),
      Math.max(1, fh),
      0
    );
  },


  "FWHR": function(P, bizy, fh) {

    /*
       В проекте используется:

       bizygomatic width /
       nasion → upper-lip height

       Это конкретное определение проекта,
       а не универсальное определение FWHR.
    */

    var midfaceHeight = dist(
      P.nas,
      P.lt
    );

    return safeDivide(
      bizy,
      Math.max(1, midfaceHeight),
      0
    );
  },


  "Total face H/W": function(P, bizy, fh) {

    return safeDivide(
      fh,
      Math.max(1, bizy),
      0
    );
  },


  "Bitemporal": function(P, bizy, fh) {

    var temporalWidth = dist(
      P.tempR,
      P.tempL
    );

    return safeDivide(
      temporalWidth,
      Math.max(1, bizy),
      0
    );
  },


  /* ==========================================================
     JAW
     ========================================================== */

  "Bigonial/Bizygomatic": function(P, bizy, fh) {

    var gonialWidth = dist(
      P.gonR,
      P.gonL
    );

    return safeDivide(
      gonialWidth,
      Math.max(1, bizy),
      0
    );
  },


  /*
     Старый код фактически делал:

       zygW / bizy

     Но если zygR и zygL — сами точки,
     определяющие bizygomatic width,
     показатель почти всегда ≈1.

     Поэтому оставляем значение для совместимости,
     но явно помечаем его как proxy.
  */

  "Cheekbone setness": function(P, bizy, fh) {

    var zygWidth = dist(
      P.zygR,
      P.zygL
    );

    return safeDivide(
      zygWidth,
      Math.max(1, bizy),
      0
    );
  },


  "Jaw frontal angle": function(P, bizy, fh) {

    return angleAt(
      P.gonR,
      P.chin,
      P.gonL
    );
  },


  "Jawline def": function(P, bizy, fh) {

    var rightAngle = angleAt(
      P.gonR,
      P.jawMidR,
      P.jawLowR
    );

    var leftAngle = angleAt(
      P.gonL,
      P.jawMidL,
      P.jawLowL
    );

    return (
      rightAngle +
      leftAngle
    ) / 2;
  },


  "Temple/Jaw taper": function(P, bizy, fh) {

    var temporalWidth = dist(
      P.tempR,
      P.tempL
    );

    var gonialWidth = dist(
      P.gonR,
      P.gonL
    );

    return safeDivide(
      temporalWidth,
      Math.max(1, gonialWidth),
      0
    );
  },


  "Neck width %": function(P, bizy, fh) {

    var neckWidth = dist(
      P.neckR,
      P.neckL
    );

    var gonialWidth = dist(
      P.gonR,
      P.gonL
    );

    return safeDivide(
      neckWidth,
      Math.max(1, gonialWidth),
      0
    );
  },


  /* ==========================================================
     MOUTH
     ========================================================== */

  "Chin/Philtrum": function(P, bizy, fh) {

    var chinToLip = dist(
      P.lb,
      P.chin
    );

    var philtrum = dist(
      P.sub,
      P.lt
    );

    return safeDivide(
      chinToLip,
      Math.max(1, philtrum),
      0
    );
  },


  "Mouth/Nose": function(P, bizy, fh) {

    var mouthWidth = dist(
      P.mouR,
      P.mouL
    );

    var noseWidth = dist(
      P.noseR,
      P.noseL
    );

    return safeDivide(
      mouthWidth,
      Math.max(1, noseWidth),
      0
    );
  },


  "Lower/upper lip": function(P, bizy, fh) {

    var lowerLip = dist(
      P.st,
      P.lb
    );

    var upperLip = dist(
      P.lt,
      P.st
    );

    return safeDivide(
      lowerLip,
      Math.max(1, upperLip),
      0
    );
  },


  /* ==========================================================
     NOSE
     ========================================================== */

  "Nasal height/width": function(P, bizy, fh) {

    var noseWidth = dist(
      P.noseR,
      P.noseL
    );

    var noseHeight = dist(
      P.nas,
      P.ntip
    );

    return safeDivide(
      noseWidth,
      Math.max(1, noseHeight),
      0
    );
  },


  "Ipsilateral alar angle": function(P, bizy, fh) {

    var rightAngle = angleAt(
      P.noseR,
      P.ntip,
      P.nas
    );

    var leftAngle = angleAt(
      P.noseL,
      P.ntip,
      P.nas
    );

    return (
      rightAngle +
      leftAngle
    ) / 2;
  },


  "IAA-JFA deviation": function(P, bizy, fh) {

    var iaa = (
      angleAt(
        P.noseR,
        P.ntip,
        P.nas
      ) +
      angleAt(
        P.noseL,
        P.ntip,
        P.nas
      )
    ) / 2;

    var jfa = angleAt(
      P.gonR,
      P.chin,
      P.gonL
    );

    return iaa - jfa;
  },


  /* ==========================================================
     SYMMETRY
     ========================================================== */

  "Symmetry": function(P, bizy, fh) {

    return computeSymmetry(
      P,
      bizy,
      fh
    );
  }

};


/* ============================================================
   6. SYMMETRY
   ============================================================

   Старый алгоритм:

     1 - average deviation * 5

   был произвольным.

   Здесь:

   1. Строим центральную ось через центральные точки.
   2. Для каждой пары сравниваем горизонтальное расстояние
      до оси.
   3. Сравниваем вертикальные координаты.
   4. Нормализуем отдельно.
   5. Преобразуем среднюю ошибку в 0..1.

   Это всё ещё 2D proxy symmetry, а не полноценная
   3D facial symmetry analysis.
   ============================================================ */

export function computeSymmetry(P, bizy, fh) {

  if (!P || !Number.isFinite(bizy) || !Number.isFinite(fh)) {
    return 0;
  }

  if (bizy <= 0 || fh <= 0) {
    return 0;
  }

  var centerIds = [
    "hair",
    "nas",
    "sub",
    "chin"
  ];

  var centerX = 0;
  var centerCount = 0;

  for (var c = 0; c < centerIds.length; c++) {

    var cp = P[centerIds[c]];

    if (!cp) continue;

    centerX += cp.x;
    centerCount++;
  }

  if (centerCount === 0) {
    return 0;
  }

  centerX /= centerCount;

  var errors = [];

  for (
    var i = 0;
    i < SYMMETRY_PAIRS.length;
    i++
  ) {

    var pair = SYMMETRY_PAIRS[i];

    var right = P[pair[0]];
    var left = P[pair[1]];

    if (!right || !left) {
      continue;
    }

    var rightX = Math.abs(
      right.x - centerX
    );

    var leftX = Math.abs(
      left.x - centerX
    );

    var xError = Math.abs(
      rightX - leftX
    ) / bizy;

    var yError = Math.abs(
      right.y - left.y
    ) / fh;

    /*
       Horizontal and vertical error имеют разные масштабы,
       поэтому используем RMS внутри пары.
    */

    var pairError = Math.sqrt(
      (
        xError * xError +
        yError * yError
      ) / 2
    );

    errors.push(pairError);
  }

  if (errors.length === 0) {
    return 0;
  }

  var sum = 0;

  for (var j = 0; j < errors.length; j++) {
    sum += errors[j];
  }

  var meanError =
    sum / errors.length;

  /*
     Экспоненциальное преобразование:

       symmetry = exp(-k * error)

     Оно не создаёт искусственного жёсткого
     "100 → 0" порога.

     k = 8 выбран как scale parameter,
     а не как часть professional pillar formula.
  */

  var symmetry = Math.exp(
    -8 * meanError
  );

  return clamp(
    symmetry,
    0,
    1
  );
}


/* ============================================================
   7. PHOTO QUALITY
   ============================================================ */

export function computeQuality(
  P,
  imgWidth,
  imgHeight,
  bizy,
  fh
) {

  var QT = QUALITY_THRESHOLDS;

  var conf = 100;

  var warns = [];


  /* ---------- FACE SIZE ---------- */

  var faceFrac = safeDivide(
    fh,
    Math.max(1, imgHeight),
    0
  );

  if (faceFrac < QT.minFaceFrac) {

    conf -= QT.faceFracPenalty;

    warns.push("лицо мелкое");
  }


  /* ---------- ROLL ---------- */

  var roll = 0;

  if (P.eyeRc && P.eyeLc) {

    roll = Math.abs(
      signedLineAngle(
        P.eyeRc,
        P.eyeLc
      )
    );
  }

  if (roll > QT.maxRoll) {

    conf -= Math.min(
      25,
      (
        roll -
        QT.maxRoll
      ) *
      QT.rollPenaltyPerDeg
    );

    warns.push(
      "наклон " +
      roll.toFixed(0) +
      "°"
    );
  }


  /* ---------- YAW ---------- */

  var cx = 0;
  var count = 0;

  var centerIds = [
    "hair",
    "chin",
    "nas",
    "sub"
  ];

  for (
    var i = 0;
    i < centerIds.length;
    i++
  ) {

    var point = P[centerIds[i]];

    if (!point) continue;

    cx += point.x;
    count++;
  }

  if (count > 0) {
    cx /= count;
  }

  var yaw = 0;

  if (P.eyeRc && P.eyeLc) {

    yaw =
      Math.abs(
        Math.abs(
          cx - P.eyeRc.x
        ) -
        Math.abs(
          P.eyeLc.x - cx
        )
      ) /
      Math.max(1, bizy) *
      90;
  }

  if (yaw > QT.maxYaw) {

    conf -= Math.min(
      25,
      (
        yaw -
        QT.maxYaw
      ) *
      QT.yawPenaltyPerDeg
    );

    warns.push(
      "поворот ~" +
      yaw.toFixed(0) +
      "°"
    );
  }


  /* ---------- PITCH ---------- */

  var pitch = 0;

  if (
    P.hair &&
    P.nas &&
    P.sub &&
    P.chin
  ) {

    var upper = dist(
      P.hair,
      P.nas
    );

    var lower = dist(
      P.sub,
      P.chin
    );

    pitch =
      Math.abs(
        lower - upper
      ) /
      Math.max(1, fh) *
      60;
  }

  if (pitch > QT.maxPitch) {

    conf -= Math.min(
      20,
      (
        pitch -
        QT.maxPitch
      ) *
      QT.pitchPenaltyPerDeg
    );

    warns.push(
      "ракурс сверху/снизу"
    );
  }


  var finalConf = clamp(
    conf,
    QT.minConfidence,
    QT.maxConfidence
  );


  return {

    conf: finalConf,

    roll: roll,

    yaw: yaw,

    pitch: pitch,

    warns: warns,

    faceFrac: faceFrac

  };
}


/* ============================================================
   8. PROFESSIONAL PILLAR NORMALIZATION
   ============================================================ */

export function normalizePillar(
  rawScore,
  pillar
) {

  var config =
    PILLAR_NORMALIZATION[pillar];

  if (!config) {
    throw new Error(
      "Unknown pillar: " +
      pillar
    );
  }

  var max =
    config.max;

  var worst =
    config.worst;

  if (
    !Number.isFinite(rawScore) ||
    !Number.isFinite(max) ||
    !Number.isFinite(worst)
  ) {

    return {
      raw: rawScore,
      percent: 0,
      score10: 0
    };
  }

  var range =
    max - worst;

  if (range <= 0) {

    return {
      raw: rawScore,
      percent: 0,
      score10: 0
    };
  }

  /*
     Exact source formula:

     ((raw - worst) /
      (max - worst)) * 100

     then /10.
  */

  var percent =
    (
      (rawScore - worst) /
      range
    ) * 100;

  /*
     A score outside the theoretical raw range
     is clipped to the 0..10 output domain.
  */

  var score10 =
    clamp(
      percent / 10,
      0,
      10
    );

  return {

    raw: rawScore,

    percent: clamp(
      percent,
      0,
      100
    ),

    score10: score10

  };
}


/* ============================================================
   9. DYNAMIC PENALTY FACTOR
   ============================================================ */

export function getPenaltyFactor(
  score10
) {

  var score =
    clamp(
      safeNumber(score10, 0),
      0,
      10
    );

  /*
     Важно:

     Таблица читается сверху вниз.

     Первый threshold, который удовлетворяет
     score >= min, используется.

     Это буквально соответствует правилу
     "highest single threshold condition".
  */

  for (
    var i = 0;
    i < PENALTY_FACTORS.length;
    i++
  ) {

    var row =
      PENALTY_FACTORS[i];

    if (score >= row.min) {
      return row.factor;
    }
  }

  return 3.85;
}


/* ============================================================
   10. PROFESSIONAL SCORE
   ============================================================

   Вход:

     {
       HARM: raw score,
       MISC: raw score,
       ANGU: raw score,
       DIMO: raw score
     }

   Пример:

     computeProfessionalScore({
       HARM: 250,
       MISC: 600,
       ANGU: 110,
       DIMO: 90
     });

   Этапы:

     raw
       ↓
     pillar 0..10
       ↓
     penalty factor
       ↓
     score × baseWeight × penaltyFactor
       ↓
     normalize weights
       ↓
     TRUE_SCORE
   ============================================================ */

export function computeProfessionalScore(
  rawPillars
) {

  if (!rawPillars) {
    throw new Error(
      "computeProfessionalScore requires rawPillars"
    );
  }


  var names = [
    "HARM",
    "MISC",
    "ANGU",
    "DIMO"
  ];


  var pillars = {};

  var totalPenalized =
    0;


  /* ==========================================================
     STEP 1 + 2 + 3
     Normalize + assign penalty + contribution
     ========================================================== */

  for (
    var i = 0;
    i < names.length;
    i++
  ) {

    var name = names[i];

    var raw =
      Number(rawPillars[name]);


    var normalized =
      normalizePillar(
        raw,
        name
      );


    var score10 =
      normalized.score10;


    var baseWeight =
      PILLAR_WEIGHTS[name];


    var penaltyFactor =
      getPenaltyFactor(
        score10
      );


    var penalizedContribution =
      score10 *
      baseWeight *
      penaltyFactor;


    pillars[name] = {

      raw: raw,

      percent:
        normalized.percent,

      score10:
        score10,

      baseWeight:
        baseWeight,

      penaltyFactor:
        penaltyFactor,

      penalizedContribution:
        penalizedContribution,

      weight:
        0

    };


    totalPenalized +=
      penalizedContribution;
  }


  /* ==========================================================
     STEP 4
     NORMALIZED POST-PENALTY WEIGHTS
     ========================================================== */

  if (
    !Number.isFinite(totalPenalized) ||
    totalPenalized <= 0
  ) {

    /*
       This should never happen for valid scores,
       but returning equal weights is safer than NaN.
    */

    for (
      var e = 0;
      e < names.length;
      e++
    ) {

      pillars[names[e]].weight =
        0.25;
    }

  } else {

    for (
      var w = 0;
      w < names.length;
      w++
    ) {

      var pillarName =
        names[w];

      pillars[pillarName].weight =
        pillars[pillarName]
          .penalizedContribution /
        totalPenalized;
    }
  }


  /* ==========================================================
     STEP 5
     TRUE SCORE
     ========================================================== */

  var trueScore = 0;

  for (
    var s = 0;
    s < names.length;
    s++
  ) {

    var p =
      pillars[names[s]];

    trueScore +=
      p.score10 *
      p.weight;
  }


  trueScore =
    clamp(
      trueScore,
      0,
      10
    );


  /*
     Check that weights really sum to 1.
  */

  var weightSum = 0;

  for (
    var q = 0;
    q < names.length;
    q++
  ) {

    weightSum +=
      pillars[names[q]].weight;
  }


  return {

    pillars: pillars,

    totalPenalized:
      totalPenalized,

    weightSum:
      weightSum,

    trueScore:
      trueScore,

    scaleLabel:
      professionalScaleLabel(
        trueScore
      )

  };
}


/* ============================================================
   11. PROFESSIONAL SCALE LABEL
   ============================================================ */

export function professionalScaleLabel(
  score10
) {

  var score =
    clamp(
      score10,
      0,
      10
    );


  if (score >= 9) {
    return "Near perfect";
  }

  if (score >= 8) {
    return "Extremely attractive";
  }

  if (score >= 7) {
    return "Very attractive";
  }

  if (score >= 6) {
    return "Noticeably attractive";
  }

  if (score >= 5) {
    return "Slightly above average";
  }

  if (score >= 4) {
    return "Below average";
  }

  if (score >= 3) {
    return "Very unattractive";
  }

  if (score >= 2) {
    return "Extremely unattractive";
  }

  return "Unbelievably unattractive";
}


/* ============================================================
   12. HARM METRIC HELPERS
   ============================================================

   Professional HARM metrics в config.js хранят абсолютные
   tier points.

   Эта функция превращает tier index в points.

   Здесь нет дополнительного weight multiplication.
   ============================================================ */

export function harmTierPoints(
  metric,
  tierIndex
) {

  if (!metric || !Array.isArray(metric.tiers)) {
    return 0;
  }

  var index = clamp(
    Math.floor(tierIndex),
    0,
    metric.tiers.length - 1
  );

  return metric.tiers[index];
}


/* ============================================================
   13. GENERIC HARM RAW SCORE
   ============================================================

   metrics:

     [
       {
         id: "jawWidth",
         tier: 0
       },
       ...
     ]

   Возвращает сумму absolute points.

   ВАЖНО:

   Здесь нет normalization.
   HARM normalization происходит отдельно через
   normalizePillar(raw, "HARM").
   ============================================================ */

export function computeHarmRaw(
  tierAssignments
) {

  if (!Array.isArray(tierAssignments)) {
    return 0;
  }

  var raw = 0;

  for (
    var i = 0;
    i < tierAssignments.length;
    i++
  ) {

    var assignment =
      tierAssignments[i];

    if (!assignment) continue;


    var metric = null;

    for (
      var m = 0;
      m < HARM_METRICS.length;
      m++
    ) {

      if (
        HARM_METRICS[m].id ===
        assignment.id
      ) {

        metric =
          HARM_METRICS[m];

        break;
      }
    }


    if (!metric) continue;


    raw +=
      harmTierPoints(
        metric,
        assignment.tier
      );
  }

  return raw;
}


/* ============================================================
   14. COMPUTE ALL FRONT METRICS
   ============================================================

   Этот интерфейс оставлен совместимым с текущим app-logic.js.

   Он пока НЕ подменяет четыре pillars фальшивой агрегацией.

   Результат содержит:

     metrics
     catScores
     overallLegacy
     professional
     quality
     symmetry
     geometry

   После обновления app-logic.js UI будет брать
   professional.trueScore вместо legacy overall.
   ============================================================ */

export function computeAllMetrics(
  placedPoints,
  imgWidth,
  imgHeight
) {

  if (!Array.isArray(placedPoints)) {
    throw new Error(
      "placedPoints must be an array"
    );
  }

  if (
    !Number.isFinite(imgWidth) ||
    !Number.isFinite(imgHeight) ||
    imgWidth <= 0 ||
    imgHeight <= 0
  ) {

    throw new Error(
      "Invalid image dimensions"
    );
  }


  /* ==========================================================
     STEP 1
     NORMALIZED → PIXELS
     ========================================================== */

  var P = {};

  for (
    var i = 0;
    i < placedPoints.length;
    i++
  ) {

    var point =
      placedPoints[i];

    if (!point || !point.id) {
      continue;
    }

    P[point.id] = {

      x:
        clamp(
          Number(point.x),
          0,
          1
        ) * imgWidth,

      y:
        clamp(
          Number(point.y),
          0,
          1
        ) * imgHeight

    };
  }


  /* ==========================================================
     STEP 2
     BASE GEOMETRY
     ========================================================== */

  var bizy =
    dist(
      P.bizR,
      P.bizL
    );

  var fh =
    dist(
      P.hair,
      P.chin
    );


  /* ==========================================================
     STEP 3
     METRICS
     ========================================================== */

  var metrics = [];


  /*
     Legacy category totals are retained ONLY for UI breakdown.
     They do not feed professional TRUE_SCORE.
  */

  var catSum = {};
  var catMax = {};

  for (
    var c0 = 0;
    c0 < CATS.length;
    c0++
  ) {

    catSum[CATS[c0]] = 0;
    catMax[CATS[c0]] = 0;
  }


  var totalSum = 0;
  var maxSum = 0;


  for (
    var m = 0;
    m < METRIC_TABLE.length;
    m++
  ) {

    var mt =
      METRIC_TABLE[m];

    var fn =
      METRIC_FUNCTIONS[
        mt.name
      ];


    var value = 0;

    if (typeof fn === "function") {

      try {

        value =
          fn(
            P,
            bizy,
            fh
          );

      } catch (error) {

        value = 0;
      }
    }


    value =
      safeNumber(
        value,
        0
      );


    var tierIndex =
      getTierIndex(
        value,
        mt.lo,
        mt.hi
      );


    var points =
      Array.isArray(mt.pts)
        ? safeNumber(
            mt.pts[
              Math.min(
                tierIndex,
                mt.pts.length - 1
              )
            ],
            0
          )
        : 0;


    var maxPoints =
      Array.isArray(mt.pts)
        ? safeNumber(
            mt.pts[0],
            0
          )
        : 0;


    totalSum +=
      points;

    maxSum +=
      maxPoints;


    if (
      catSum[mt.cat] !== undefined
    ) {

      catSum[mt.cat] +=
        points;

      catMax[mt.cat] +=
        maxPoints;
    }


    /*
       Display score.

       Negative absolute points are allowed by
       the professional-like metric table, but the UI
       score is constrained to 0..100.
    */

    var displayScore =
      maxPoints > 0
        ? (
            points /
            maxPoints
          ) * 100
        : 0;


    displayScore =
      clamp(
        displayScore,
        0,
        100
      );


    metrics.push({

      name:
        mt.name,

      cat:
        mt.cat,

      value:
        value,

      unit:
        mt.u || "",

      lo:
        mt.lo,

      hi:
        mt.hi,

      tierIndex:
        tierIndex,

      points:
        points,

      maxPoints:
        maxPoints,

      score:
        displayScore,

      weight:
        mt.w || 0

    });
  }


  /* ==========================================================
     STEP 4
     LEGACY CATEGORY DISPLAY SCORES
     ========================================================== */

  var catScores = {};

  for (
    var c = 0;
    c < CATS.length;
    c++
  ) {

    var category =
      CATS[c];

    var score =
      catMax[category] > 0
        ? (
            catSum[category] /
            catMax[category]
          ) * 100
        : 0;


    catScores[category] =
      clamp(
        score,
        0,
        100
      );
  }


  /* ==========================================================
     STEP 5
     LEGACY RAW PERCENT
     ========================================================== */

  var rawPercent =
    maxSum > 0
      ? (
          totalSum /
          maxSum
        ) * 100
      : 0;


  /*
     НЕ называем это professional overall.

     Это legacyFrontPercent.
  */

  var legacyFrontPercent =
    clamp(
      rawPercent,
      0,
      100
    );


  /* ==========================================================
     STEP 6
     QUALITY
     ========================================================== */

  var symmetry =
    computeSymmetry(
      P,
      bizy,
      fh
    );


  var quality =
    computeQuality(
      P,
      imgWidth,
      imgHeight,
      bizy,
      fh
    );


  /* ==========================================================
     STEP 7
     RETURN
     ========================================================== */

  return {

    /*
       Пока UI не переведён:
       overall сохраняем как legacy value.

       В следующем app-logic.js эта строка будет
       переключена на professional.trueScore.
    */

    overall:
      legacyFrontPercent,

    overallScale:
      "legacy-0-100",

    label:
      looksmaxLabel(
        legacyFrontPercent
      ),


    /* Legacy data */

    rawSum:
      totalSum,

    maxSum:
      maxSum,

    rawPercent:
      rawPercent,

    penalty:
      0,

    spread:
      0,

    catScores:
      catScores,

    metrics:
      metrics,


    /* Geometry */

    symmetry:
      symmetry,

    bizy:
      bizy,

    fh:
      fh,

    PTS:
      P,


    /* Quality */

    quality:
      quality,


    /*
       Professional engine пока не получает
       все четыре raw pillar scores.
    */

    professional:
      null

  };
}


/* ============================================================
   15. CONVERT EXISTING HARM ASSIGNMENTS
   ============================================================ */

export function buildProfessionalFromRaw(
  rawHarm,
  rawMisc,
  rawAngu,
  rawDimo
) {

  return computeProfessionalScore({

    HARM:
      rawHarm,

    MISC:
      rawMisc,

    ANGU:
      rawAngu,

    DIMO:
      rawDimo

  });
}


/* ============================================================
   16. THIRD PROPORTIONS
   ============================================================ */

export function computeThirds(P) {

  if (
    !P ||
    !P.hair ||
    !P.nas ||
    !P.sub ||
    !P.chin
  ) {

    return [
      33.3,
      33.3,
      33.4
    ];
  }


  var upper =
    dist(
      P.hair,
      P.nas
    );

  var middle =
    dist(
      P.nas,
      P.sub
    );

  var lower =
    dist(
      P.sub,
      P.chin
    );


  var total =
    upper +
    middle +
    lower;


  if (total < 1e-9) {

    return [
      33.3,
      33.3,
      33.4
    ];
  }


  return [

    upper /
      total *
      100,

    middle /
      total *
      100,

    lower /
      total *
      100

  ];
}


/* ============================================================
   17. AXES — UI ONLY
   ============================================================ */

export function computeAxes(
  metrics,
  AXES_CONFIG
) {

  var result = {};

  if (
    !Array.isArray(metrics) ||
    !AXES_CONFIG
  ) {

    return result;
  }


  var names =
    Object.keys(
      AXES_CONFIG
    );


  for (
    var a = 0;
    a < names.length;
    a++
  ) {

    var axisName =
      names[a];

    var metricNames =
      AXES_CONFIG[
        axisName
      ];


    var scores = [];


    for (
      var mi = 0;
      mi < metricNames.length;
      mi++
    ) {

      var target =
        metricNames[mi];


      for (
        var ni = 0;
        ni < metrics.length;
        ni++
      ) {

        if (
          metrics[ni].name ===
          target
        ) {

          scores.push(
            clamp(
              metrics[ni].score,
              0,
              100
            )
          );

          break;
        }
      }
    }


    if (scores.length === 0) {

      result[axisName] = 0;

      continue;
    }


    var sum = 0;

    for (
      var s = 0;
      s < scores.length;
      s++
    ) {

      sum +=
        scores[s];
    }


    result[axisName] =
      sum /
      scores.length;
  }


  return result;
}


/* ============================================================
   18. PSL
   ============================================================

   Professional formula is 0..10.

   Поэтому PSL теперь не:

      overall / 12.5

   а напрямую соответствует TRUE_SCORE.

   Для legacy 0..100 UI вызывающий код может передать
   процент через computePSLFromPercent().
   ============================================================ */

export function computePSL(score10) {

  return clamp(
    Number(score10),
    0,
    10
  );
}


export function computePSLFromPercent(
  percent
) {

  return clamp(
    Number(percent) / 10,
    0,
    10
  );
}


/* ============================================================
   19. COLORS
   ============================================================ */

export function colorOf(score) {

  var value =
    clamp(
      Number(score),
      0,
      100
    );


  if (value >= 80) {
    return "#3ddc84";
  }

  if (value >= 50) {
    return "#ffd166";
  }

  return "#ff5c7a";
}


/* ============================================================
   20. REPORT
   ============================================================ */

export function buildReportText(
  result
) {

  var lines = [];


  /*
     Если результат уже содержит professional score,
     используем его.
  */

  if (
    result &&
    result.professional
  ) {

    var pro =
      result.professional;


    lines.push(
      "📊 LUX PRO v23"
    );

    lines.push(
      "TRUE SCORE: " +
      pro.trueScore.toFixed(2) +
      "/10"
    );

    lines.push(
      "Rating: " +
      pro.scaleLabel
    );

    lines.push("");


    var names = [
      "HARM",
      "MISC",
      "ANGU",
      "DIMO"
    ];


    for (
      var i = 0;
      i < names.length;
      i++
    ) {

      var name =
        names[i];

      var p =
        pro.pillars[name];


      lines.push(
        name +
        ": " +
        p.score10.toFixed(2) +
        "/10"
      );
    }


    lines.push("");

    lines.push(
      "Post-penalty weights:"
    );


    for (
      var w = 0;
      w < names.length;
      w++
    ) {

      var wn =
        names[w];

      lines.push(
        wn +
        ": " +
        pro.pillars[wn]
          .weight
          .toFixed(4)
      );
    }


    lines.push("");

    lines.push(
      "Confidence: " +
      Math.round(
        result.quality.conf
      ) +
      "%"
    );


    if (
      result.quality.warns.length > 0
    ) {

      lines.push(
        "⚠️ " +
        result.quality.warns.join(
          ", "
        )
      );
    }


    return lines.join("\n");
  }


  /*
     Legacy fallback.
  */

  lines.push(
    "📊 LUX PRO v23"
  );

  lines.push(
    "Front metrics: " +
    result.overall.toFixed(1) +
    "/100"
  );

  lines.push(
    "Legacy front score — professional score not initialized"
  );

  lines.push(
    "Confidence: " +
    Math.round(
      result.quality.conf
    ) +
    "%"
  );


  lines.push("");

  lines.push(
    "--- Детали ---"
  );


  for (
    var m = 0;
    m < result.metrics.length;
    m++
  ) {

    var met =
      result.metrics[m];

    var sign =
      met.points >= 0
        ? "+"
        : "";


    lines.push(

      "• " +
      met.name +
      ": " +
      met.value.toFixed(2) +
      met.unit +
      " | " +
      sign +
      met.points.toFixed(2) +
      " pts [" +
      tierName(
        met.tierIndex
      ) +
      "]"

    );
  }


  if (
    result.quality.warns.length > 0
  ) {

    lines.push("");

    lines.push(
      "⚠️ " +
      result.quality.warns.join(
        ", "
      )
    );
  }


  return lines.join("\n");
}


/* ============================================================
   21. PROFESSIONAL DEBUG REPORT
   ============================================================

   Полезно для проверки формулы.

   Показывает все промежуточные значения.
   ============================================================ */

export function professionalDebug(
  rawPillars
) {

  var result =
    computeProfessionalScore(
      rawPillars
    );


  var names = [
    "HARM",
    "MISC",
    "ANGU",
    "DIMO"
  ];


  var output = [];


  output.push(
    "=== PROFESSIONAL SCORE DEBUG ==="
  );


  for (
    var i = 0;
    i < names.length;
    i++
  ) {

    var name =
      names[i];

    var p =
      result.pillars[name];


    output.push(
      name + ":"
    );

    output.push(
      "  raw = " +
      p.raw.toFixed(4)
    );

    output.push(
      "  normalized = " +
      p.score10.toFixed(4) +
      "/10"
    );

    output.push(
      "  baseWeight = " +
      p.baseWeight.toFixed(4)
    );

    output.push(
      "  penaltyFactor = " +
      p.penaltyFactor.toFixed(4)
    );

    output.push(
      "  penalized = " +
      p.penalizedContribution
        .toFixed(4)
    );

    output.push(
      "  finalWeight = " +
      p.weight.toFixed(4)
    );
  }


  output.push("");

  output.push(
    "Total penalized = " +
    result.totalPenalized
      .toFixed(4)
  );

  output.push(
    "Weight sum = " +
    result.weightSum
      .toFixed(4)
  );

  output.push(
    "TRUE_SCORE = " +
    result.trueScore
      .toFixed(4) +
    "/10"
  );

  output.push(
    "Label = " +
    result.scaleLabel
  );


  return output.join("\n");
}


/* ============================================================
   END OF math-core.js
   ============================================================ */
