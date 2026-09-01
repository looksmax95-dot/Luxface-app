/* ============================================================
   LUX FACE BOT — math-core.js
   Архитектура A: tier → абсолютные баллы → сумма → штраф
   Версия: v19-A (на основе Looksmax.org HARM формулы)
   ============================================================ */

import {
  METRIC_TABLE,
  CATW,
  CATS,
  SYMMETRY_PAIRS,
  QUALITY_THRESHOLDS
} from './config.js';

/* ============================================================
   БАЗОВЫЕ ГЕОМЕТРИЧЕСКИЕ ФУНКЦИИ
   ============================================================ */

export function dist(a, b) {
  var dx = a.x - b.x;
  var dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleAt(a, b, c) {
  var v1x = a.x - b.x;
  var v1y = a.y - b.y;
  var v2x = c.x - b.x;
  var v2y = c.y - b.y;
  var len1 = Math.sqrt(v1x * v1x + v1y * v1y);
  var len2 = Math.sqrt(v2x * v2x + v2y * v2y);
  if (len1 < 1e-9 || len2 < 1e-9) return 0;
  var dot = v1x * v2x + v1y * v2y;
  var cosVal = dot / (len1 * len2);
  cosVal = Math.max(-1, Math.min(1, cosVal));
  return Math.acos(cosVal) * 180 / Math.PI;
}

/* ============================================================
   TIER-СИСТЕМА: 5 ТИРОВ (T1-T5)
   Определение тира по значению метрики
   ============================================================ */

/*
   T1 = идеал (внутри [lo, hi])
   T2 = близкое отклонение (до 0.5 × halfRange за пределы)
   T3 = умеренное отклонение (до 1.5 × halfRange)
   T4 = сильное отклонение (до 3.0 × halfRange)
   T5 = экстремум (всё остальное)
*/
export function getTierIndex(value, lo, hi) {
  var center = (lo + hi) / 2;
  var halfRange = (hi - lo) / 2;
  if (halfRange < 1e-12) halfRange = 1e-12;
  var deviation = Math.abs(value - center);
  
  if (deviation <= halfRange) return 0;           // T1
  if (deviation <= halfRange * 1.5) return 1;     // T2
  if (deviation <= halfRange * 2.5) return 2;     // T3
  if (deviation <= halfRange * 4.0) return 3;     // T4
  return 4;                                        // T5
}

export function tierName(idx) {
  var n = ["T1", "T2", "T3", "T4", "T5"];
  return (idx >= 0 && idx < n.length) ? n[idx] : "T?";
}

/* ============================================================
   АБСОЛЮТНЫЕ БАЛЛЫ ЗА КАЖДЫЙ TIER (вес встроен)
   Паттерн: T2=T1×0.9, T3=T1×0.5, T4=T1×0.3, T5=-T1×0.9 (приблизительно)
   Веса распределены на основе Looksmax.org + расширение до 28 метрик
   ============================================================ */

var TIER_POINTS = {
  /* 👁 ГЛАЗА (сумма T1 ≈ 69.85) */
  "Eye separation":      [12.20, 10.98,  6.10,  3.66, -10.98],
  "Canthal tilt":        [12.35, 11.12,  6.18,  3.71,  -3.71],
  "Eye spacing":         [ 8.00,  7.20,  4.00,  2.40,  -7.20],
  "Eye aspect":          [18.30, 16.47,  9.15,  5.49,  -5.49],
  "Eyebrow tilt":        [ 5.00,  4.50,  2.50,  1.50,  -4.50],
  "Eyebrow setness":     [ 8.00,  7.20,  4.00,  2.40,  -2.40],
  "Orbital vector":      [ 6.00,  5.40,  3.00,  1.80,  -5.40],

  /* 📐 ПРОПОРЦИИ (сумма T1 ≈ 66.30) */
  "Upper third":         [10.00,  9.00,  5.00,  3.00,  -9.00],
  "FWHR":                [18.30, 16.47,  9.15,  5.49, -16.47],
  "Total face H/W":      [10.00,  9.00,  5.00,  3.00,  -9.00],
  "Middle third":        [10.00,  9.00,  5.00,  3.00,  -9.00],
  "Lower third":         [10.00,  9.00,  5.00,  3.00,  -9.00],
  "Bitemporal":          [ 4.00,  3.60,  2.00,  1.20,  -3.60],
  "Lower third proportion":[4.00, 3.60, 2.00,  1.20,  -3.60],

  /* 🦴 ЧЕЛЮСТЬ (сумма T1 ≈ 70.59) */
  "Cheekbone setness":   [15.00, 13.50,  7.50,  4.50, -13.50],
  "Jaw frontal angle":   [15.00, 13.50,  7.50,  4.50, -13.50],
  "Bigonial/Bizygomatic":[20.59, 18.53, 10.29,  6.18, -18.53],
  "Jawline def":         [ 8.00,  7.20,  4.00,  2.40,  -7.20],
  "Temple/Jaw taper":    [ 6.00,  5.40,  3.00,  1.80,  -5.40],
  "Neck width %":        [ 6.00,  5.40,  3.00,  1.80,  -5.40],

  /* 👄 РОТ (сумма T1 ≈ 32.81) */
  "Chin/Philtrum":       [12.96, 11.67,  6.48,  3.89,  -1.95],
  "Mouth/Nose":          [12.35, 11.12,  6.18,  3.71,  -3.71],
  "Lower/upper lip":     [ 7.50,  6.75,  3.75,  2.25,  -6.75],

  /* 👃 НОС (сумма T1 ≈ 24.50) */
  "Midface ratio":       [10.00,  9.00,  5.00,  3.00,  -9.00],
  "Nasal height/width":  [ 5.00,  4.50,  2.50,  1.50,  -4.50],
  "Ipsilateral alar angle":[2.50, 2.25, 1.25, 0.75,  -2.25],
  "IAA-JFA deviation":   [ 7.00,  6.30,  3.50,  2.10,  -6.30],

  /* 🪞 СИММЕТРИЯ (сумма T1 = 20.00) */
  "Symmetry":            [20.00, 18.00, 10.00,  6.00, -18.00]
};

/* Максимально возможная сумма (все T1) */
var MAX_POSSIBLE_SUM = 0;
var metricNames = Object.keys(TIER_POINTS);
for (var i = 0; i < metricNames.length; i++) {
  MAX_POSSIBLE_SUM += TIER_POINTS[metricNames[i]][0];
}

/* ============================================================
   ФУНКЦИИ РАСЧЁТА КАЖДОЙ МЕТРИКИ ИЗ 46 ТОЧЕК
   ============================================================ */

export var METRIC_FUNCTIONS = {
  "Eye separation": function(PTS, bizy, fh) {
    return dist(PTS.eyeRc, PTS.eyeLc) / Math.max(1, bizy);
  },
  "Canthal tilt": function(PTS, bizy, fh) {
    var r = Math.atan2(PTS.eyeRi.y - PTS.eyeRo.y, Math.abs(PTS.eyeRo.x - PTS.eyeRi.x)) * 180 / Math.PI;
    var l = Math.atan2(PTS.eyeLi.y - PTS.eyeLo.y, Math.abs(PTS.eyeLo.x - PTS.eyeLi.x)) * 180 / Math.PI;
    return (r + l) / 2;
  },
  "Eye spacing": function(PTS, bizy, fh) {
    var eyeW = (dist(PTS.eyeRo, PTS.eyeRi) + dist(PTS.eyeLo, PTS.eyeLi)) / 2;
    return dist(PTS.eyeRi, PTS.eyeLi) / Math.max(1, eyeW);
  },
  "Eye aspect": function(PTS, bizy, fh) {
    var rw = dist(PTS.eyeRo, PTS.eyeRi);
    var rh = Math.max(1, dist(PTS.eyeRu, PTS.eyeRl));
    var lw = dist(PTS.eyeLo, PTS.eyeLi);
    var lh = Math.max(1, dist(PTS.eyeLu, PTS.eyeLl));
    return ((rw / rh) + (lw / lh)) / 2;
  },
  "Eyebrow tilt": function(PTS, bizy, fh) {
    var r = Math.atan2(PTS.browRi.y - PTS.browRp.y, Math.abs(PTS.browRo.x - PTS.browRi.x)) * 180 / Math.PI;
    var l = Math.atan2(PTS.browLi.y - PTS.browLp.y, Math.abs(PTS.browLo.x - PTS.browLi.x)) * 180 / Math.PI;
    return (r + l) / 2;
  },
  "Eyebrow setness": function(PTS, bizy, fh) {
    var eyeH = (dist(PTS.eyeRu, PTS.eyeRl) + dist(PTS.eyeLu, PTS.eyeLl)) / 2;
    var bd = (Math.abs(PTS.eyeRu.y - PTS.browRp.y) + Math.abs(PTS.eyeLu.y - PTS.browLp.y)) / 2;
    return bd / Math.max(1, eyeH);
  },
  "Orbital vector": function(PTS, bizy, fh) {
    var rv = (PTS.zygR.y - PTS.eyeRl.y) / Math.max(1, fh) * 10;
    var lv = (PTS.zygL.y - PTS.eyeLl.y) / Math.max(1, fh) * 10;
    return (rv + lv) / 2;
  },
  "Upper third": function(PTS, bizy, fh) {
    return dist(PTS.hair, PTS.nas) / Math.max(1, fh);
  },
  "FWHR": function(PTS, bizy, fh) {
    return bizy / Math.max(1, dist(PTS.nas, PTS.lt));
  },
  "Total face H/W": function(PTS, bizy, fh) {
    return fh / Math.max(1, bizy);
  },
  "Middle third": function(PTS, bizy, fh) {
    return dist(PTS.nas, PTS.sub) / Math.max(1, fh);
  },
  "Lower third": function(PTS, bizy, fh) {
    return dist(PTS.sub, PTS.chin) / Math.max(1, fh);
  },
  "Bitemporal": function(PTS, bizy, fh) {
    return dist(PTS.tempR, PTS.tempL) / Math.max(1, bizy);
  },
  "Lower third proportion": function(PTS, bizy, fh) {
    return dist(PTS.sub, PTS.chin) / Math.max(1, fh);
  },
  "Cheekbone setness": function(PTS, bizy, fh) {
    return dist(PTS.zygR, PTS.zygL) / Math.max(1, bizy);
  },
  "Jaw frontal angle": function(PTS, bizy, fh) {
    return angleAt(PTS.gonR, PTS.chin, PTS.gonL);
  },
  "Bigonial/Bizygomatic": function(PTS, bizy, fh) {
    return dist(PTS.gonR, PTS.gonL) / Math.max(1, bizy);
  },
  "Jawline def": function(PTS, bizy, fh) {
    var r = angleAt(PTS.gonR, PTS.jawMidR, PTS.jawLowR);
    var l = angleAt(PTS.gonL, PTS.jawMidL, PTS.jawLowL);
    return (r + l) / 2;
  },
  "Temple/Jaw taper": function(PTS, bizy, fh) {
    return dist(PTS.tempR, PTS.tempL) / Math.max(1, dist(PTS.gonR, PTS.gonL));
  },
  "Neck width %": function(PTS, bizy, fh) {
    return dist(PTS.neckR, PTS.neckL) / Math.max(1, bizy);
  },
  "Chin/Philtrum": function(PTS, bizy, fh) {
    return dist(PTS.lb, PTS.chin) / Math.max(1, dist(PTS.sub, PTS.lt));
  },
  "Mouth/Nose": function(PTS, bizy, fh) {
    return dist(PTS.mouR, PTS.mouL) / Math.max(1, dist(PTS.noseR, PTS.noseL));
  },
  "Lower/upper lip": function(PTS, bizy, fh) {
    return dist(PTS.st, PTS.lb) / Math.max(1, dist(PTS.lt, PTS.st));
  },
  "Midface ratio": function(PTS, bizy, fh) {
    return bizy / Math.max(1, dist(PTS.nas, PTS.st));
  },
  "Nasal height/width": function(PTS, bizy, fh) {
    return dist(PTS.noseR, PTS.noseL) / Math.max(1, dist(PTS.nas, PTS.ntip));
  },
  "Ipsilateral alar angle": function(PTS, bizy, fh) {
    var r = angleAt(PTS.noseR, PTS.ntip, PTS.nas);
    var l = angleAt(PTS.noseL, PTS.ntip, PTS.nas);
    return (r + l) / 2;
  },
  "IAA-JFA deviation": function(PTS, bizy, fh) {
    var iaa = (angleAt(PTS.noseR, PTS.ntip, PTS.nas) + angleAt(PTS.noseL, PTS.ntip, PTS.nas)) / 2;
    var jfa = angleAt(PTS.gonR, PTS.chin, PTS.gonL);
    return iaa - jfa;
  },
  "Symmetry": function(PTS, bizy, fh) {
    return computeSymmetry(PTS, bizy, fh);
  }
};

/* ============================================================
   РАСЧЁТ СИММЕТРИИ
   ============================================================ */

export function computeSymmetry(PTS, bizy, fh) {
  var cx = (PTS.hair.x + PTS.chin.x + PTS.nas.x + PTS.sub.x) / 4;
  var deviations = [];
  for (var i = 0; i < SYMMETRY_PAIRS.length; i++) {
    var pairId = SYMMETRY_PAIRS[i];
    var R = PTS[pairId[0]];
    var L = PTS[pairId[1]];
    if (!R || !L) continue;
    var rDist = Math.abs(R.x - cx);
    var lDist = Math.abs(L.x - cx);
    deviations.push(Math.abs(rDist - lDist) / Math.max(1, bizy));
    deviations.push(Math.abs(R.y - L.y) / Math.max(1, fh));
  }
  if (deviations.length === 0) return 1.0;
  var avgDev = 0;
  for (var j = 0; j < deviations.length; j++) avgDev += deviations[j];
  avgDev /= deviations.length;
  return Math.max(0, Math.min(1, 1 - avgDev * 5));
}

/* ============================================================
   РАСЧЁТ КАЧЕСТВА (CONFIDENCE)
   ============================================================ */

export function computeQuality(PTS, imgWidth, imgHeight, bizy, fh) {
  var QT = QUALITY_THRESHOLDS;
  var conf = 100;
  var warns = [];

  var faceFrac = fh / imgHeight;
  if (faceFrac < QT.minFaceFrac) {
    conf -= QT.faceFracPenalty;
    warns.push("лицо мелкое");
  }

  var roll = Math.abs(Math.atan2(PTS.eyeLc.y - PTS.eyeRc.y, PTS.eyeLc.x - PTS.eyeRc.x)) * 180 / Math.PI;
  if (roll > QT.maxRoll) {
    conf -= Math.min(25, (roll - QT.maxRoll) * QT.rollPenaltyPerDeg);
    warns.push("наклон " + roll.toFixed(0) + "°");
  }

  var cx = (PTS.hair.x + PTS.chin.x + PTS.nas.x + PTS.sub.x) / 4;
  var yaw = Math.abs(Math.abs(cx - PTS.eyeRc.x) - Math.abs(PTS.eyeLc.x - cx)) / Math.max(1, bizy) * 90;
  if (yaw > QT.maxYaw) {
    conf -= Math.min(25, (yaw - QT.maxYaw) * QT.yawPenaltyPerDeg);
    warns.push("поворот ~" + yaw.toFixed(0) + "°");
  }

  var upper = dist(PTS.hair, PTS.nas);
  var lower = dist(PTS.sub, PTS.chin);
  var pitch = Math.abs(lower - upper) / Math.max(1, fh) * 60;
  if (pitch > QT.maxPitch) {
    conf -= Math.min(20, (pitch - QT.maxPitch) * QT.pitchPenaltyPerDeg);
    warns.push("ракурс сверху/снизу");
  }

  return {
    conf: Math.max(QT.minConfidence, Math.min(QT.maxConfidence, conf)),
    roll: roll, yaw: yaw, pitch: pitch, warns: warns, faceFrac: faceFrac
  };
}

/* ============================================================
   ГЛАВНАЯ ФУНКЦИЯ: РАСЧЁТ ВСЕХ МЕТРИК (v19-A)
   Архитектура A: tier → absolute points → sum → penalty → normalize
   ============================================================ */

export function computeAllMetrics(placedPoints, imgWidth, imgHeight) {
  var PTS = {};
  for (var i = 0; i < placedPoints.length; i++) {
    PTS[placedPoints[i].id] = {
      x: placedPoints[i].x * imgWidth,
      y: placedPoints[i].y * imgHeight
    };
  }

  var bizy = dist(PTS.bizR, PTS.bizL);
  var fh = dist(PTS.hair, PTS.chin);

  /* Шаг 1: Расчёт значения и tier для каждой метрики */
  var metrics = [];
  var totalSum = 0;
  var catSums = {};
  var catCounts = {};

  for (var c = 0; c < CATS.length; c++) {
    catSums[CATS[c]] = 0;
    catCounts[CATS[c]] = 0;
  }

  for (var m = 0; m < METRIC_TABLE.length; m++) {
    var mt = METRIC_TABLE[m];
    var computeFn = METRIC_FUNCTIONS[mt.name];
    var value = computeFn ? computeFn(PTS, bizy, fh) : 0;

    /* Определяем tier (0-4) */
    var tIdx = getTierIndex(value, mt.lo, mt.hi);

    /* Получаем абсолютные баллы за этот tier */
    var points = TIER_POINTS[mt.name] ? TIER_POINTS[mt.name][tIdx] : 0;

    metrics.push({
      name: mt.name,
      cat: mt.cat,
      value: value,
      score: points,
      tierIndex: tIdx,
      weight: mt.w,
      unit: mt.u,
      lo: mt.lo,
      hi: mt.hi
    });

    totalSum += points;
    catSums[mt.cat] += points;
    catCounts[mt.cat]++;
  }

  /* Шаг 2: Штраф за дисбаланс категорий */
  var catAvgs = {};
  var minCat = Infinity;
  var maxCat = -Infinity;

  for (var ci = 0; ci < CATS.length; ci++) {
    var catName = CATS[ci];
    if (catCounts[catName] > 0) {
      catAvgs[catName] = catSums[catName] / catCounts[catName];
    } else {
      catAvgs[catName] = 0;
    }
    if (catAvgs[catName] < minCat) minCat = catAvgs[catName];
    if (catAvgs[catName] > maxCat) maxCat = catAvgs[catName];
  }

  var spread = maxCat - minCat;
  var penalty = spread * 0.5;
  var adjustedSum = totalSum - penalty;

  /* Шаг 3: Нормализация в проценты */
  /* Базовый процент: сумма / максимум × 100 */
  var rawPercent = (adjustedSum / MAX_POSSIBLE_SUM) * 100;

  /* Шаг 4: Линейная нормализация (калибровка) */
  /* Коэффициенты для соответствия шкале Looksmax.org */
  /* a = 0.6711, b = 6.38 (из формулы знакомого) */
  var normalizedPercent = 0.6711 * rawPercent + 6.38;

  /* Ограничение 0-100 */
  var overall = Math.max(0, Math.min(100, normalizedPercent));

  /* Шаг 5: Category scores для отображения (тоже нормализованные) */
  var catScores = {};
  for (var cj = 0; cj < CATS.length; cj++) {
    var cn = CATS[cj];
    /* Сумма T1 для метрик в этой категории */
    var catMaxSum = 0;
    for (var mi = 0; mi < METRIC_TABLE.length; mi++) {
      if (METRIC_TABLE[mi].cat === cn && TIER_POINTS[METRIC_TABLE[mi].name]) {
        catMaxSum += TIER_POINTS[METRIC_TABLE[mi].name][0];
      }
    }
    var catRawPercent = catMaxSum > 0 ? (catSums[cn] / catMaxSum) * 100 : 0;
    catScores[cn] = Math.max(0, Math.min(100, catRawPercent));
  }

  var symmetry = computeSymmetry(PTS, bizy, fh);
  var quality = computeQuality(PTS, imgWidth, imgHeight, bizy, fh);

  return {
    metrics: metrics,
    catScores: catScores,
    overall: overall,
    rawSum: totalSum,
    adjustedSum: adjustedSum,
    rawPercent: rawPercent,
    penalty: penalty,
    spread: spread,
    maxPossibleSum: MAX_POSSIBLE_SUM,
    symmetry: symmetry,
    quality: quality,
    bizy: bizy,
    fh: fh,
    PTS: PTS
  };
}

/* ============================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ============================================================ */

export function colorOf(score) {
  /* Для absolute points: сравниваем с максимумом T1 */
  /* Средний T1 ≈ 9.3, поэтому пороги другие */
  if (score >= 8) return "#3ddc84";
  if (score >= 3) return "#ffd166";
  return "#ff5c7a";
}

export function colorOfPercent(percent) {
  if (percent >= 70) return "#3ddc84";
  if (percent >= 45) return "#ffd166";
  return "#ff5c7a";
}

export function computePSL(overall) {
  return Math.max(1, Math.min(8, overall / 10 - 2));
}

export function computeThirds(PTS) {
  var u = dist(PTS.hair, PTS.nas);
  var m = dist(PTS.nas, PTS.sub);
  var l = dist(PTS.sub, PTS.chin);
  var t = u + m + l;
  if (t < 1e-9) return [33.3, 33.3, 33.4];
  return [(u / t) * 100, (m / t) * 100, (l / t) * 100];
}

export function computeAxes(metrics, AXES_CONFIG) {
  var result = {};
  var names = Object.keys(AXES_CONFIG);
  for (var a = 0; a < names.length; a++) {
    var axName = names[a];
    var metricNames = AXES_CONFIG[axName];
    var points = [];
    for (var mi = 0; mi < metricNames.length; mi++) {
      for (var ni = 0; ni < metrics.length; ni++) {
        if (metrics[ni].name === metricNames[mi]) {
          points.push(metrics[ni].score);
          break;
        }
      }
    }
    var sum = 0;
    for (var s = 0; s < points.length; s++) sum += points[s];
    result[axName] = points.length > 0 ? sum / points.length : 0;
  }
  return result;
}

export function buildReportText(result) {
  var lines = [];
  lines.push("📊 LUX PRO v19-A: " + result.overall.toFixed(1) + "/100");
  lines.push("Raw: " + result.rawSum.toFixed(1) + "/" + result.maxPossibleSum.toFixed(1) +
             " (" + result.rawPercent.toFixed(1) + "%)");
  lines.push("Penalty: -" + result.penalty.toFixed(1) + " (spread: " + result.spread.toFixed(1) + ")");
  lines.push("Confidence: " + Math.round(result.quality.conf) + "%");
  lines.push("PSL: " + computePSL(result.overall).toFixed(1) + "/8");
  lines.push("");

  for (var c = 0; c < CATS.length; c++) {
    lines.push(CATS[c] + ": " + Math.round(result.catScores[CATS[c]]) + "/100");
  }

  lines.push("");
  lines.push("--- Детали ---");

  for (var m = 0; m < result.metrics.length; m++) {
    var met = result.metrics[m];
    var sign = met.score >= 0 ? "+" : "";
    lines.push(
      "• " + met.name + ": " + met.value.toFixed(2) + met.unit +
      " | " + sign + met.score.toFixed(1) + " pts" +
      " [" + tierName(met.tierIndex) + "]"
    );
  }

  if (result.quality.warns.length > 0) {
    lines.push("");
    lines.push("⚠️ " + result.quality.warns.join(", "));
  }

  return lines.join("\n");
}
