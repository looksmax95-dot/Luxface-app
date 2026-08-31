/* ============================================================
   LUX FACE BOT — math-core.js
   Чистая математика. Никакого DOM. Никакого canvas.
   Только функции: входные данные → результат.
   Этот файл портируется в Python для Express-режима.
   Версия: v17-tier
   ============================================================ */

import {
  METRIC_TABLE,
  TIER_COEFF,
  TIER_THRESHOLDS,
  CATW,
  CATS,
  SYMMETRY_PAIRS,
  QUALITY_THRESHOLDS
} from './config.js';

/* ============================================================
   БАЗОВЫЕ ГЕОМЕТРИЧЕСКИЕ ФУНКЦИИ
   ============================================================ */

/* Евклидово расстояние между двумя точками */
export function dist(a, b) {
  var dx = a.x - b.x;
  var dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/* Угол при вершине b в треугольнике a-b-c, в градусах */
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

/* Атангенса для углов наклона (в градусах) */
export function atan2Deg(dy, dx) {
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

/* ============================================================
   TIER-СИСТЕМА ОЦЕНКИ (замена гауссианы)
   ============================================================ */

/*
   Определяет коэффициент тира (0..1) для данного значения метрики.
   
   Логика:
   - Находим центр идеального диапазона и его полуширину
   - Считаем отклонение значения от центра
   - Сравниваем отклонение с порогами (множители полуширины)
   - Возвращаем соответствующий коэффициент
   
   Пример для Canthal tilt (lo=5, hi=8.5):
   - center = 6.75, halfRange = 1.75
   - deviation <= 0.4375 → 1.00 (идеал)
   - deviation <= 0.875  → 0.90
   - deviation <= 1.75   → 0.75
   - deviation <= 2.625  → 0.60
   - deviation <= 3.5    → 0.40
   - deviation <= 5.25   → 0.20
   - иначе               → 0.00
*/
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

/* Перевод коэффициента тира в баллы 0-100 */
export function metricScoreFromTier(value, lo, hi) {
  return tierScore(value, lo, hi) * 100;
}

/* ============================================================
   АГРЕГАЦИЯ: ВЗВЕШЕННОЕ СРЕДНЕЕ
   ============================================================ */

/*
   Взвешенное степенное среднее.
   p = 0 → геометрическое среднее (используется для итогового балла)
   p = 1 → арифметическое среднее
   p = -1 → гармоническое среднее
   
   pairs = [[value, weight], [value, weight], ...]
*/
export function wpmean(pairs, p) {
  if (pairs.length === 0) return 0;
  var sumWeights = 0;
  for (var i = 0; i < pairs.length; i++) {
    sumWeights += pairs[i][1];
  }
  if (sumWeights < 1e-12) return 0;

  if (Math.abs(p) < 1e-9) {
    /* Геометрическое среднее: exp(sum(w * ln(x)) / sum(w)) */
    var logSum = 0;
    for (var j = 0; j < pairs.length; j++) {
      var val = Math.max(0.001, pairs[j][0]);
      logSum += pairs[j][1] * Math.log(val);
    }
    return Math.exp(logSum / sumWeights);
  } else {
    /* Степенное среднее: (sum(w * x^p) / sum(w))^(1/p) */
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

/*
   Каждая функция принимает:
   - PTS: объект с ключами = id точек, значения = {x, y} в пикселях
   - bizy: бизигоматическая ширина (пиксели)
   - fh: высота лица от линии волос до подбородка (пиксели)
   
   Возвращает числовое значение метрики.
*/

export var METRIC_FUNCTIONS = {

  "Eye separation": function(PTS, bizy, fh) {
    /* IPD / bizygomatic width */
    var ipd = dist(PTS.eyeRc, PTS.eyeLc);
    return ipd / Math.max(1, bizy);
  },

  "Canthal tilt": function(PTS, bizy, fh) {
    /* Средний угол наклона глазных щелей */
    var rightAngle = Math.atan2(
      PTS.eyeRi.y - PTS.eyeRo.y,
      Math.abs(PTS.eyeRo.x - PTS.eyeRi.x)
    ) * 180 / Math.PI;
    var leftAngle = Math.atan2(
      PTS.eyeLi.y - PTS.eyeLo.y,
      Math.abs(PTS.eyeLo.x - PTS.eyeLi.x)
    ) * 180 / Math.PI;
    return (rightAngle + leftAngle) / 2;
  },

  "Eye spacing": function(PTS, bizy, fh) {
    /* Межглазничное расстояние / средняя ширина глаза */
    var eyeW = (dist(PTS.eyeRo, PTS.eyeRi) + dist(PTS.eyeLo, PTS.eyeLi)) / 2;
    var icd = dist(PTS.eyeRi, PTS.eyeLi);
    return icd / Math.max(1, eyeW);
  },

  "Eye aspect": function(PTS, bizy, fh) {
    /* Ширина глаза / высота глаза (среднее по двум) */
    var rw = dist(PTS.eyeRo, PTS.eyeRi);
    var rh = Math.max(1, dist(PTS.eyeRu, PTS.eyeRl));
    var lw = dist(PTS.eyeLo, PTS.eyeLi);
    var lh = Math.max(1, dist(PTS.eyeLu, PTS.eyeLl));
    return ((rw / rh) + (lw / lh)) / 2;
  },

  "Eyebrow tilt": function(PTS, bizy, fh) {
    /* Средний угол наклона бровей */
    var rightTilt = Math.atan2(
      PTS.browRi.y - PTS.browRp.y,
      Math.abs(PTS.browRo.x - PTS.browRi.x)
    ) * 180 / Math.PI;
    var leftTilt = Math.atan2(
      PTS.browLi.y - PTS.browLp.y,
      Math.abs(PTS.browLo.x - PTS.browLi.x)
    ) * 180 / Math.PI;
    return (rightTilt + leftTilt) / 2;
  },

  "Eyebrow setness": function(PTS, bizy, fh) {
    /* Расстояние от брови до верхнего века / высота глаза */
    var eyeH = (dist(PTS.eyeRu, PTS.eyeRl) + dist(PTS.eyeLu, PTS.eyeLl)) / 2;
    var browDistR = Math.abs(PTS.eyeRu.y - PTS.browRp.y);
    var browDistL = Math.abs(PTS.eyeLu.y - PTS.browLp.y);
    var avgBrowDist = (browDistR + browDistL) / 2;
    return avgBrowDist / Math.max(1, eyeH);
  },

  "Orbital vector": function(PTS, bizy, fh) {
    /* Относительное положение скулы относительно нижнего века */
    /* Положительный = скула ниже глаза (хорошо) */
    var rightVec = (PTS.zygR.y - PTS.eyeRl.y) / Math.max(1, fh) * 10;
    var leftVec = (PTS.zygL.y - PTS.eyeLl.y) / Math.max(1, fh) * 10;
    return (rightVec + leftVec) / 2;
  },

  "Upper third": function(PTS, bizy, fh) {
    /* Верхняя треть / полная высота лица */
    var upper = dist(PTS.hair, PTS.nas);
    return upper / Math.max(1, fh);
  },

  "FWHR": function(PTS, bizy, fh) {
    /* Bizygomatic width / midface height (nasion to upper lip) */
    var midfaceH = dist(PTS.nas, PTS.lt);
    return bizy / Math.max(1, midfaceH);
  },

  "Total face H/W": function(PTS, bizy, fh) {
    /* Полная высота лица / бизигоматическая ширина */
    return fh / Math.max(1, bizy);
  },

  "Middle third": function(PTS, bizy, fh) {
    /* Средняя треть / полная высота лица */
    var middle = dist(PTS.nas, PTS.sub);
    return middle / Math.max(1, fh);
  },

  "Lower third": function(PTS, bizy, fh) {
    /* Нижняя треть / полная высота лица */
    var lower = dist(PTS.sub, PTS.chin);
    return lower / Math.max(1, fh);
  },

  "Bitemporal": function(PTS, bizy, fh) {
    /* Височная ширина / бизигоматическая ширина */
    var bitemp = dist(PTS.tempR, PTS.tempL);
    return bitemp / Math.max(1, bizy);
  },

  "Lower third proportion": function(PTS, bizy, fh) {
    /* Нижняя треть / полная высота (дублирует Lower third но с другим диапазоном) */
    var lower = dist(PTS.sub, PTS.chin);
    return lower / Math.max(1, fh);
  },

  "Cheekbone setness": function(PTS, bizy, fh) {
    /* Ширина скул / бизигоматическая ширина */
    var zygW = dist(PTS.zygR, PTS.zygL);
    return zygW / Math.max(1, bizy);
  },

  "Jaw frontal angle": function(PTS, bizy, fh) {
    /* Угол при подбородке между гонионами */
    return angleAt(PTS.gonR, PTS.chin, PTS.gonL);
  },

  "Bigonial/Bizygomatic": function(PTS, bizy, fh) {
    /* Ширина челюсти / бизигоматическая ширина */
    var gonW = dist(PTS.gonR, PTS.gonL);
    return gonW / Math.max(1, bizy);
  },

  "Jawline def": function(PTS, bizy, fh) {
    /* Средний угол линии челюсти (правый + левый) */
    var rightAngle = angleAt(PTS.gonR, PTS.jawMidR, PTS.jawLowR);
    var leftAngle = angleAt(PTS.gonL, PTS.jawMidL, PTS.jawLowL);
    return (rightAngle + leftAngle) / 2;
  },

  "Temple/Jaw taper": function(PTS, bizy, fh) {
    /* Височная ширина / ширина челюсти */
    var tempW = dist(PTS.tempR, PTS.tempL);
    var gonW = dist(PTS.gonR, PTS.gonL);
    return tempW / Math.max(1, gonW);
  },

  "Neck width %": function(PTS, bizy, fh) {
    /* Ширина шеи / бизигоматическая ширина */
    var neckW = dist(PTS.neckR, PTS.neckL);
    return neckW / Math.max(1, bizy);
  },

  "Chin/Philtrum": function(PTS, bizy, fh) {
    /* Расстояние от нижней губы до подбородка / филтрум */
    var chinToLip = dist(PTS.lb, PTS.chin);
    var philtrum = dist(PTS.sub, PTS.lt);
    return chinToLip / Math.max(1, philtrum);
  },

  "Mouth/Nose": function(PTS, bizy, fh) {
    /* Ширина рта / ширина носа */
    var mouthW = dist(PTS.mouR, PTS.mouL);
    var noseW = dist(PTS.noseR, PTS.noseL);
    return mouthW / Math.max(1, noseW);
  },

  "Lower/upper lip": function(PTS, bizy, fh) {
    /* Высота нижней губы / высота верхней губы */
    var lowerLip = dist(PTS.st, PTS.lb);
    var upperLip = dist(PTS.lt, PTS.st);
    return lowerLip / Math.max(1, upperLip);
  },

  "Midface ratio": function(PTS, bizy, fh) {
    /* Bizygomatic / высота средней части лица (nasion до губ) */
    var midH = dist(PTS.nas, PTS.st);
    return bizy / Math.max(1, midH);
  },

  "Nasal height/width": function(PTS, bizy, fh) {
    /* Ширина носа / высота носа */
    var noseW = dist(PTS.noseR, PTS.noseL);
    var noseH = dist(PTS.nas, PTS.ntip);
    return noseW / Math.max(1, noseH);
  },

  "Ipsilateral alar angle": function(PTS, bizy, fh) {
    /* Угол крыла носа (средний по двум сторонам) */
    var rightAngle = angleAt(PTS.noseR, PTS.ntip, PTS.nas);
    var leftAngle = angleAt(PTS.noseL, PTS.ntip, PTS.nas);
    return (rightAngle + leftAngle) / 2;
  },

  "IAA-JFA deviation": function(PTS, bizy, fh) {
    /* Отклонение между углом крыла носа и углом челюсти */
    var iaa = (angleAt(PTS.noseR, PTS.ntip, PTS.nas) + angleAt(PTS.noseL, PTS.ntip, PTS.nas)) / 2;
    var jfa = angleAt(PTS.gonR, PTS.chin, PTS.gonL);
    /* Нормализованная разница */
    return iaa - jfa;
  },

  "Symmetry": function(PTS, bizy, fh) {
    /* Вычисляется отдельной функцией computeSymmetry */
    return computeSymmetry(PTS, bizy, fh);
  }
};

/* ============================================================
   РАСЧЁТ СИММЕТРИИ
   ============================================================ */

/*
   Симметрия считается по 11 парам билатеральных точек.
   Для каждой пары:
   - Отклонение по X относительно центральной линии (нормализовано на bizy)
   - Отклонение по Y между парными точками (нормализовано на fh)
   
   Результат: 0..1 (потом умножается на 100 для отображения)
   
   Центральная линия определяется по 4 точкам:
   hair, chin, nas, sub
*/
export function computeSymmetry(PTS, bizy, fh) {
  /* Центральная линия */
  var cx = (PTS.hair.x + PTS.chin.x + PTS.nas.x + PTS.sub.x) / 4;

  var deviations = [];

  for (var i = 0; i < SYMMETRY_PAIRS.length; i++) {
    var pairId = SYMMETRY_PAIRS[i];
    var R = PTS[pairId[0]];
    var L = PTS[pairId[1]];

    if (!R || !L) continue;

    /* Отклонение по X: разница расстояний от центра */
    var rDistFromCenter = Math.abs(R.x - cx);
    var lDistFromCenter = Math.abs(L.x - cx);
    var xDev = Math.abs(rDistFromCenter - lDistFromCenter) / Math.max(1, bizy);
    deviations.push(xDev);

    /* Отклонение по Y: разница высот */
    var yDev = Math.abs(R.y - L.y) / Math.max(1, fh);
    deviations.push(yDev);
  }

  if (deviations.length === 0) return 1.0;

  var avgDev = 0;
  for (var j = 0; j < deviations.length; j++) {
    avgDev += deviations[j];
  }
  avgDev /= deviations.length;

  /* Преобразование: 1 - avgDev * 5, ограниченное 0..1 */
  var symmetryRaw = Math.max(0, Math.min(1, 1 - avgDev * 5));
  return symmetryRaw;
}

/* ============================================================
   РАСЧЁТ КАЧЕСТВА (CONFIDENCE)
   НЕ ВЛИЯЕТ НА БАЛЛ. Только показывает доверие.
   ============================================================ */

export function computeQuality(PTS, imgWidth, imgHeight, bizy, fh) {
  var QT = QUALITY_THRESHOLDS;
  var conf = 100;
  var warns = [];

  /* Размер лица на фото */
  var faceFrac = fh / imgHeight;
  if (faceFrac < QT.minFaceFrac) {
    conf -= QT.faceFracPenalty;
    warns.push("лицо мелкое");
  }

  /* Наклон головы (roll) */
  var roll = Math.abs(
    Math.atan2(PTS.eyeLc.y - PTS.eyeRc.y, PTS.eyeLc.x - PTS.eyeRc.x)
  ) * 180 / Math.PI;
  if (roll > QT.maxRoll) {
    conf -= Math.min(25, (roll - QT.maxRoll) * QT.rollPenaltyPerDeg);
    warns.push("наклон " + roll.toFixed(0) + "°");
  }

  /* Поворот головы (yaw) */
  var cx = (PTS.hair.x + PTS.chin.x + PTS.nas.x + PTS.sub.x) / 4;
  var yaw = Math.abs(
    Math.abs(cx - PTS.eyeRc.x) - Math.abs(PTS.eyeLc.x - cx)
  ) / Math.max(1, bizy) * 90;
  if (yaw > QT.maxYaw) {
    conf -= Math.min(25, (yaw - QT.maxYaw) * QT.yawPenaltyPerDeg);
    warns.push("поворот ~" + yaw.toFixed(0) + "°");
  }

  /* Ракурс сверху/снизу (pitch) */
  var upper = dist(PTS.hair, PTS.nas);
  var lower = dist(PTS.sub, PTS.chin);
  var pitch = Math.abs(lower - upper) / Math.max(1, fh) * 60;
  if (pitch > QT.maxPitch) {
    conf -= Math.min(20, (pitch - QT.maxPitch) * QT.pitchPenaltyPerDeg);
    warns.push("ракурс сверху/снизу");
  }

  var finalConf = Math.max(QT.minConfidence, Math.min(QT.maxConfidence, conf));

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
   ГЛАВНАЯ ФУНКЦИЯ: РАСЧЁТ ВСЕХ МЕТРИК
   ============================================================ */

/*
   Вход:
   - placedPoints: массив {x, y} в нормализованных координатах (0..1)
   - imgWidth: ширина изображения в пикселях
   - imgHeight: высота изображения в пикселях
   
   Выход:
   {
     metrics: [{name, cat, value, score, tier, weight, unit}],
     catScores: {"👁 Глаза": 72.5, ...},
     overall: 68.3,
     symmetry: 0.92,
     quality: {conf, roll, yaw, pitch, warns},
     bizy: число,
     fh: число,
     PTS: объект с точками в пикселях
   }
*/
export function computeAllMetrics(placedPoints, imgWidth, imgHeight) {
  /* Конвертация нормализованных координат в пиксели */
  var PTS = {};
  for (var i = 0; i < placedPoints.length; i++) {
    PTS[placedPoints[i].id] = {
      x: placedPoints[i].x * imgWidth,
      y: placedPoints[i].y * imgHeight
    };
  }

  /* Базовые измерения */
  var bizy = dist(PTS.bizR, PTS.bizL);
  var fh = dist(PTS.hair, PTS.chin);

  /* Расчёт каждой метрики из METRIC_TABLE */
  var metrics = [];
  for (var m = 0; m < METRIC_TABLE.length; m++) {
    var mt = METRIC_TABLE[m];
    var computeFn = METRIC_FUNCTIONS[mt.name];
    var value = 0;

    if (computeFn) {
      value = computeFn(PTS, bizy, fh);
    }

    /* Tier-оценка */
    var tier = tierScore(value, mt.lo, mt.hi);
    var score = tier * 100;

    metrics.push({
      name: mt.name,
      cat: mt.cat,
      value: value,
      score: score,
      tier: tier,
      tierIndex: getTierIndex(value, mt.lo, mt.hi),
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
      if (metrics[n].cat === catName) {
        catMetrics.push(metrics[n]);
      }
    }
    if (catMetrics.length === 0) {
      catScores[catName] = 0;
      continue;
    }
    var weightedSum = 0;
    var weightTotal = 0;
    for (var p = 0; p < catMetrics.length; p++) {
      weightedSum += catMetrics[p].score * catMetrics[p].weight;
      weightTotal += catMetrics[p].weight;
    }
    catScores[catName] = weightTotal > 0 ? weightedSum / weightTotal : 0;
  }

  /* Итог: геометрическое среднее категорий (p=0) */
  var overallPairs = [];
  for (var q = 0; q < CATS.length; q++) {
    var cName = CATS[q];
    var cScore = catScores[cName];
    var cWeight = CATW[cName] || 1;
    if (cScore > 0) {
      overallPairs.push([cScore, cWeight]);
    }
  }
  var overall = wpmean(overallPairs, 0);

  /* Симметрия (отдельно для доступа) */
  var symmetry = computeSymmetry(PTS, bizy, fh);

  /* Качество (confidence) */
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

/* Определение индекса тира (0-6) для отображения */
export function getTierIndex(value, lo, hi) {
  var center = (lo + hi) / 2;
  var halfRange = (hi - lo) / 2;
  if (halfRange < 1e-12) halfRange = 1e-12;
  var deviation = Math.abs(value - center);
  for (var i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (deviation <= halfRange * TIER_THRESHOLDS[i]) {
      return i;
    }
  }
  return TIER_THRESHOLDS.length - 1;
}

/* Цвет по баллу (для UI) */
export function colorOf(score) {
  if (score >= 80) return "#3ddc84";
  if (score >= 50) return "#ffd166";
  return "#ff5c7a";
}

/* Название тира по индексу (для отображения) */
export function tierName(tierIndex) {
  var names = ["T1", "T2", "T3", "T4", "T5", "T6", "T7"];
  if (tierIndex >= 0 && tierIndex < names.length) return names[tierIndex];
  return "T?";
}

/* Расчёт PSL (субъективная шкала 1-8) из итогового балла */
export function computePSL(overall) {
  return Math.max(1, Math.min(8, overall / 10 - 2));
}

/* Расчёт третей лица в процентах */
export function computeThirds(PTS) {
  var upper = dist(PTS.hair, PTS.nas);
  var middle = dist(PTS.nas, PTS.sub);
  var lower = dist(PTS.sub, PTS.chin);
  var total = upper + middle + lower;
  if (total < 1e-9) return [33.3, 33.3, 33.4];
  return [
    (upper / total) * 100,
    (middle / total) * 100,
    (lower / total) * 100
  ];
}

/* Расчёт значений для 4 профилей (осей) */
export function computeAxes(metrics, AXES_CONFIG) {
  var result = {};
  var axisNames = Object.keys(AXES_CONFIG);
  for (var a = 0; a < axisNames.length; a++) {
    var axisName = axisNames[a];
    var metricNames = AXES_CONFIG[axisName];
    var scores = [];
    for (var mIdx = 0; mIdx < metricNames.length; mIdx++) {
      var mName = metricNames[mIdx];
      for (var nIdx = 0; nIdx < metrics.length; nIdx++) {
        if (metrics[nIdx].name === mName) {
          scores.push(metrics[nIdx].score);
          break;
        }
      }
    }
    if (scores.length > 0) {
      var sum = 0;
      for (var s = 0; s < scores.length; s++) {
        sum += scores[s];
      }
      result[axisName] = sum / scores.length;
    } else {
      result[axisName] = 0;
    }
  }
  return result;
}

/* Формирование текстового отчёта для отправки боту */
export function buildReportText(result) {
  var lines = [];
  lines.push("📊 LUX PRO v17: " + result.overall.toFixed(1) + "/100");
  lines.push("Confidence: " + Math.round(result.quality.conf) + "%");
  lines.push("PSL: " + computePSL(result.overall).toFixed(1) + "/8");
  lines.push("");

  for (var c = 0; c < CATS.length; c++) {
    var catName = CATS[c];
    var catScore = result.catScores[catName];
    lines.push(catName + ": " + Math.round(catScore) + "/100");
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
