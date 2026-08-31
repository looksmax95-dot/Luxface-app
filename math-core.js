import {
  METRIC_TABLE,
  TIER_COEFF,
  TIER_THRESHOLDS,
  CATW,
  CATS,
  SYMMETRY_PAIRS,
  QUALITY_THRESHOLDS
} from './config.js';


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

export function atan2Deg(dy, dx) {
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

/* ============================================================
   НЕПРЕРЫВНЫЙ СКОРИНГ (v18)
   Плато 100 внутри [lo, hi], гауссов спад за пределами.
   Tier вычисляется отдельно и используется ТОЛЬКО как лейбл.
   ============================================================ */

export function continuousScore(value, lo, hi) {
  if (value >= lo && value <= hi) return 100;
  var halfRange = (hi - lo) / 2;
  if (halfRange < 1e-12) halfRange = 1e-12;
  var scale = halfRange;
  var d;
  if (value < lo) {
    d = (lo - value) / scale;
  } else {
    d = (value - hi) / scale;
  }
  return 100 * Math.exp(-d * d);
}

/* ============================================================
   TIER КАК ЛЕЙБЛ (не влияет на балл)
   ============================================================ */

export function tierScore(value, lo, hi) {
  var center = (lo + hi) / 2;
  var halfRange = (hi - lo) / 2;
  if (halfRange < 1e-12) halfRange = 1e-12;
  var deviation = Math.abs(value - center);
  for (var i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (deviation <= halfRange * TIER_THRESHOLDS[i]) {
      return TIER_COEFF[i];
    }
  }
  return TIER_COEFF[TIER_COEFF.length - 1];
}

export function getTierIndex(value, lo, hi) {
  var center = (lo + hi) / 2;
  var halfRange = (hi - lo) / 2;
  if (halfRange < 1e-12) halfRange = 1e-12;  var deviation = Math.abs(value - center);
 for (var i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (deviation <= halfRange * TIER_THRESHOLDS[i]) {
      return i;
    }
  }
  return TIER_THRESHOLDS.length - 1;
}

export function tierName(idx) {
  var n = ["T1", "T2", "T3", "T4", "T5", "T6", "T7"];
  return (idx >= 0 && idx < n.length) ? n[idx] : "T?";
}

/* ============================================================
   АГРЕГАЦИЯ: ВЗВЕШЕННОЕ СТЕПЕННОЕ СРЕДНЕЕ
   ============================================================ */

export function wpmean(pairs, p) {
  if (pairs.length === 0) return 0;
  var sumWeights = 0;
  for (var i = 0; i < pairs.length; i++) {
    sumWeights += pairs[i][1];
  }
  if (sumWeights < 1e-12) return 0;

  if (Math.abs(p) < 1e-9) {
    var logSum = 0;
    for (var j = 0; j < pairs.length; j++) {
      var val = Math.max(0.001, pairs[j][0]);
      logSum += pairs[j][1] * Math.log(val);
    }
    return Math.exp(logSum / sumWeights);
  } else {
    var powSum = 0;
    for (var k = 0; k < pairs.length; k++) {
      var v = Math.max(0.001, pairs[k][0]);
      powSum += pairs[k][1] * Math.pow(v, p);
    }
    return Math.pow(powSum / sumWeights, 1 / p);
  }
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
   НЕ ВЛИЯЕТ НА БАЛЛ. Только показывает доверие.
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
    roll: roll,
    yaw: yaw,
    pitch: pitch,
    warns: warns,
    faceFrac: faceFrac
  };
}

/* ============================================================
   ГЛАВНАЯ ФУНКЦИЯ: РАСЧЁТ ВСЕХ МЕТРИК (v18-continuous)
   score = continuousScore (плавный)
   tier = лейбл только для отображения
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

  var metrics = [];
  for (var m = 0; m < METRIC_TABLE.length; m++) {
    var mt = METRIC_TABLE[m];
    var computeFn = METRIC_FUNCTIONS[mt.name];
    var value = computeFn ? computeFn(PTS, bizy, fh) : 0;

    /* Непрерывный балл — НЕ зависит от тира */
    var score = continuousScore(value, mt.lo, mt.hi);

    /* Tier — только лейбл для отображения */
    var tIdx = getTierIndex(value, mt.lo, mt.hi);

    metrics.push({
      name: mt.name,
      cat: mt.cat,
      value: value,
      score: score,
      tier: tierScore(value, mt.lo, mt.hi),
      tierIndex: tIdx,
      weight: mt.w,
      unit: mt.u,
      lo: mt.lo,
      hi: mt.hi
    });
  }

  /* Агрегация по категориям: взвешенное арифметическое */
  var catScores = {};
  for (var c = 0; c < CATS.length; c++) {
    var catName = CATS[c];
    var catMetrics = [];
    for (var n = 0; n < metrics.length; n++) {
      if (metrics[n].cat === catName) catMetrics.push(metrics[n]);
    }
    if (catMetrics.length === 0) {
      catScores[catName] = 0;
      continue;
    }
    var ws = 0;
    var wt = 0;
    for (var p = 0; p < catMetrics.length; p++) {
      ws += catMetrics[p].score * catMetrics[p].weight;
      wt += catMetrics[p].weight;
    }
    catScores[catName] = wt > 0 ? ws / wt : 0;
  }

  /* Итог: геометрическое среднее категорий (p=0) */
  var overallPairs = [];
  for (var q = 0; q < CATS.length; q++) {
    var cn = CATS[q];
    if (catScores[cn] > 0) overallPairs.push([catScores[cn], CATW[cn] || 1]);
  }
  var overall = wpmean(overallPairs, 0);

  var symmetry = computeSymmetry(PTS, bizy, fh);
  var quality = computeQuality(PTS, imgWidth, imgHeight, bizy, fh);

  return {
    metrics: metrics,
    catScores: catScores,
    overall: overall,
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
  if (score >= 80) return "#3ddc84";
  if (score >= 50) return "#ffd166";
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
    var scores = [];
    for (var mi = 0; mi < metricNames.length; mi++) {
      for (var ni = 0; ni < metrics.length; ni++) {
        if (metrics[ni].name === metricNames[mi]) {
          scores.push(metrics[ni].score);
          break;
        }
      }
    }
    var sum = 0;
    for (var s = 0; s < scores.length; s++) sum += scores[s];
    result[axName] = scores.length > 0 ? sum / scores.length : 0;
  }
  return result;
}

export function buildReportText(result) {
  var lines = [];
  lines.push("📊 LUX PRO v18: " + result.overall.toFixed(1) + "/100");
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
    lines.push(
      "• " + met.name + ": " + met.value.toFixed(2) + met.unit +
      " | " + Math.round(met.score) + "/100" +
      " [" + tierName(met.tierIndex) + "]"
    );
  }
  if (result.quality.warns.length > 0) {
    lines.push("");
    lines.push("⚠️ " + result.quality.warns.join(", "));
  }
  return lines.join("\n");
     }
