/* ============================================================
   LUX FACE BOT — math-core.js
   Версия: v20-looksmax
   Дата: 2026-09-01
   Назначение: Чистая математика. Никакого DOM. Никакого canvas.
               Только функции: входные данные → результат.
   
   Архитектура: Architecture A (на основе looksmax.org HARM формулы)
   
   Поток данных:
   1. 46 точек → нормализованные координаты (0..1)
   2. Конвертация в пиксели
   3. Расчёт 26 метрик через METRIC_FUNCTIONS
   4. Определение tier (T1-T5) для каждой метрики
   5. Получение absolute points из METRIC_TABLE[m].pts[tierIndex]
   6. Сумма баллов по всем метрикам
   7. Расчёт процентов по категориям
   8. Штраф за дисбаланс: penalty = spread × 0.5
   9. Сырой процент: (totalSum / maxSum) × 100
   10. Линейная нормализация: 0.6711 × adjusted + 6.38
   11. Лейбл looksmax: SUB3 / SUB5 / LTN / MTN / HTN / CHADLITE / CHAD
   12. PSL: 1-8 (overall / 12.5)
   ============================================================ */

import {
  METRIC_TABLE,
  TIER_THRESHOLDS,
  CATS,
  SYMMETRY_PAIRS,
  QUALITY_THRESHOLDS,
  LOOKSMAX_SCALE,
  NORMALIZATION
} from './config.js';

/* ============================================================
   РАЗДЕЛ 1: БАЗОВЫЕ ГЕОМЕТРИЧЕСКИЕ ФУНКЦИИ
   ============================================================ */

/*
   Евклидово расстояние между двумя точками.
   a, b: объекты {x, y} в пикселях
   Возвращает: расстояние в пикселях
*/
export function dist(a, b) {
  var dx = a.x - b.x;
  var dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/*
   Угол при вершине b в треугольнике a-b-c.
   a, b, c: объекты {x, y} в пикселях
   Возвращает: угол в градусах (0-180)
   
   Используется для:
   - Canthal tilt (угол наклона глаз)
   - Jaw frontal angle (угол при подбородке)
   - Jawline def (угол линии челюсти)
   - Ipsilateral alar angle (угол крыла носа)
*/
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
  
  /* Защита от ошибок округления */
  cosVal = Math.max(-1, Math.min(1, cosVal));
  
  return Math.acos(cosVal) * 180 / Math.PI;
}

/* ============================================================
   РАЗДЕЛ 2: TIER-СИСТЕМА (T1-T5)
   ============================================================ */

/*
   Определяет индекс тира (0-4) для данного значения метрики.
   
   value: измеренное значение метрики
   lo: нижняя граница идеального диапазона
   hi: верхняя граница идеального диапазона
   
   Возвращает: 0 (T1) до 4 (T5)
   
   Логика:
   - Находим центр идеального диапазона: center = (lo + hi) / 2
   - Находим полуширину: halfRange = (hi - lo) / 2
   - Считаем отклонение: deviation = |value - center|
   - Сравниваем с порогами из TIER_THRESHOLDS
*/
export function getTierIndex(value, lo, hi) {
  var center = (lo + hi) / 2;
  var halfRange = (hi - lo) / 2;
  
  /* Защита от деления на ноль */
  if (halfRange < 1e-12) halfRange = 1e-12;
  
  var deviation = Math.abs(value - center);
  
  for (var i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (deviation <= halfRange * TIER_THRESHOLDS[i]) {
      return i;
    }
  }
  
  /* Если не попали ни в один порог — последний tier */
  return TIER_THRESHOLDS.length - 1;
}

/*
   Возвращает строковое название тира по индексу.
   idx: 0-4
   Возвращает: "T1", "T2", "T3", "T4", "T5" или "T?"
*/
export function tierName(idx) {
  var names = ["T1", "T2", "T3", "T4", "T5"];
  if (idx >= 0 && idx < names.length) {
    return names[idx];
  }
  return "T?";
}

/* ============================================================
   РАЗДЕЛ 3: ШКАЛА LOOKSMAX (ЛЕЙБЛЫ)
   ============================================================ */

/*
   Определяет лейбл looksmax по итоговому проценту (0-100).
   
   percent: итоговый балл после нормализации
   Возвращает: "SUB3", "SUB5", "LTN", "MTN", "HTN", "CHADLITE", "CHAD"
   
   Использует LOOKSMAX_SCALE из config.js
*/
export function looksmaxLabel(percent) {
  for (var i = 0; i < LOOKSMAX_SCALE.length; i++) {
    if (percent >= LOOKSMAX_SCALE[i].min) {
      return LOOKSMAX_SCALE[i].label;
    }
  }
  return LOOKSMAX_SCALE[LOOKSMAX_SCALE.length - 1].label;
}

/* ============================================================
   РАЗДЕЛ 4: ФОРМУЛЫ РАСЧЁТА 26 МЕТРИК
   ============================================================ */

/*
   Каждая функция принимает:
   - P: объект с ключами = id точек, значения = {x, y} в пикселях
   - bizy: бизигоматическая ширина (dist(bizR, bizL)) в пикселях
   - fh: высота лица (dist(hair, chin)) в пикселях
   
   Возвращает: числовое значение метрики
   
   Имена функций должны ТОЧНО совпадать с name в METRIC_TABLE.
*/

export var METRIC_FUNCTIONS = {

  /* ==================== 👁 ГЛАЗА ==================== */

  "Eye separation": function(P, bizy, fh) {
    /* IPD (inter-pupillary distance) / bizygomatic width */
    var ipd = dist(P.eyeRc, P.eyeLc);
    return ipd / Math.max(1, bizy);
  },

  "Canthal tilt": function(P, bizy, fh) {
    /* Средний угол наклона глазных щелей (правый + левый) / 2 */
    var rightAngle = Math.atan2(
      P.eyeRi.y - P.eyeRo.y,
      Math.abs(P.eyeRo.x - P.eyeRi.x)
    ) * 180 / Math.PI;
    
    var leftAngle = Math.atan2(
      P.eyeLi.y - P.eyeLo.y,
      Math.abs(P.eyeLo.x - P.eyeLi.x)
    ) * 180 / Math.PI;
    
    return (rightAngle + leftAngle) / 2;
  },

  "Eye spacing": function(P, bizy, fh) {
    /* Inter-canthal distance / средняя ширина глаза */
    var eyeW = (dist(P.eyeRo, P.eyeRi) + dist(P.eyeLo, P.eyeLi)) / 2;
    var icd = dist(P.eyeRi, P.eyeLi);
    return icd / Math.max(1, eyeW);
  },

  "Eye aspect": function(P, bizy, fh) {
    /* Eye width / eye height (среднее по двум глазам) */
    var rightW = dist(P.eyeRo, P.eyeRi);
    var rightH = Math.max(1, dist(P.eyeRu, P.eyeRl));
    var leftW = dist(P.eyeLo, P.eyeLi);
    var leftH = Math.max(1, dist(P.eyeLu, P.eyeLl));
    
    var rightAspect = rightW / rightH;
    var leftAspect = leftW / leftH;
    
    return (rightAspect + leftAspect) / 2;
  },

  "Eyebrow tilt": function(P, bizy, fh) {
    /* Средний угол наклона бровей */
    var rightTilt = Math.atan2(
      P.browRi.y - P.browRp.y,
      Math.abs(P.browRo.x - P.browRi.x)
    ) * 180 / Math.PI;
    
    var leftTilt = Math.atan2(
      P.browLi.y - P.browLp.y,
      Math.abs(P.browLo.x - P.browLi.x)
    ) * 180 / Math.PI;
    
    return (rightTilt + leftTilt) / 2;
  },

  "Eyebrow setness": function(P, bizy, fh) {
    /* Высота глаза / расстояние зрачок-бровь (среднее) */
    var rightEyeH = dist(P.eyeRc, P.eyeRu);
    var rightBrowDist = Math.max(1, dist(P.eyeRc, P.browRp));
    
    var leftEyeH = dist(P.eyeLc, P.eyeLu);
    var leftBrowDist = Math.max(1, dist(P.eyeLc, P.browLp));
    
    var rightSetness = rightEyeH / rightBrowDist;
    var leftSetness = leftEyeH / leftBrowDist;
    
    return (rightSetness + leftSetness) / 2;
  },

  "Orbital vector": function(P, bizy, fh) {
    /* Относительное положение скулы относительно нижнего века */
    /* Положительный = скула ниже глаза (хорошо) */
    var rightVec = (P.zygR.y - P.eyeRl.y) / Math.max(1, fh) * 10;
    var leftVec = (P.zygL.y - P.eyeLl.y) / Math.max(1, fh) * 10;
    
    return (rightVec + leftVec) / 2;
  },

  /* ==================== 📐 ПРОПОРЦИИ ==================== */

  "Upper third": function(P, bizy, fh) {
    /* Верхняя треть / полная высота лица */
    var upper = dist(P.hair, P.nas);
    return upper / Math.max(1, fh);
  },

  "Middle third": function(P, bizy, fh) {
    /* Средняя треть / полная высота лица */
    var middle = dist(P.nas, P.sub);
    return middle / Math.max(1, fh);
  },

  "Lower third": function(P, bizy, fh) {
    /* Нижняя треть / полная высота лица */
    var lower = dist(P.sub, P.chin);
    return lower / Math.max(1, fh);
  },

  "FWHR": function(P, bizy, fh) {
    /* Facial Width-to-Height Ratio */
    /* Bizygomatic width / midface height (nasion to upper lip) */
    var midfaceH = dist(P.nas, P.lt);
    return bizy / Math.max(1, midfaceH);
  },

  "Total face H/W": function(P, bizy, fh) {
    /* Полная высота лица / bizygomatic width */
    return fh / Math.max(1, bizy);
  },

  "Bitemporal": function(P, bizy, fh) {
    /* Височная ширина / bizygomatic width */
    var bitemp = dist(P.tempR, P.tempL);
    return bitemp / Math.max(1, bizy);
  },

  /* ==================== 🦴 ЧЕЛЮСТЬ ==================== */

  "Bigonial/Bizygomatic": function(P, bizy, fh) {
    /* Ширина челюсти / bizygomatic width */
    var gonW = dist(P.gonR, P.gonL);
    return gonW / Math.max(1, bizy);
  },

  "Cheekbone setness": function(P, bizy, fh) {
    /* Ширина скул / bizygomatic width */
    var zygW = dist(P.zygR, P.zygL);
    return zygW / Math.max(1, bizy);
  },

  "Jaw frontal angle": function(P, bizy, fh) {
    /* Угол при подбородке между гонионами */
    return angleAt(P.gonR, P.chin, P.gonL);
  },

  "Jawline def": function(P, bizy, fh) {
    /* Средний угол линии челюсти (правый + левый) / 2 */
    var rightAngle = angleAt(P.gonR, P.jawMidR, P.jawLowR);
    var leftAngle = angleAt(P.gonL, P.jawMidL, P.jawLowL);
    return (rightAngle + leftAngle) / 2;
  },

  "Temple/Jaw taper": function(P, bizy, fh) {
    /* Височная ширина / ширина челюсти */
    var tempW = dist(P.tempR, P.tempL);
    var gonW = dist(P.gonR, P.gonL);
    return tempW / Math.max(1, gonW);
  },

  "Neck width %": function(P, bizy, fh) {
    /* Ширина шеи / bigonial width (НЕ bizygomatic) */
    var neckW = dist(P.neckR, P.neckL);
    var gonW = dist(P.gonR, P.gonL);
    return neckW / Math.max(1, gonW);
  },

  /* ==================== 👄 РОТ ==================== */

  "Chin/Philtrum": function(P, bizy, fh) {
    /* Расстояние от нижней губы до подбородка / philtrum */
    var chinToLip = dist(P.lb, P.chin);
    var philtrum = dist(P.sub, P.lt);
    return chinToLip / Math.max(1, philtrum);
  },

  "Mouth/Nose": function(P, bizy, fh) {
    /* Ширина рта / ширина носа */
    var mouthW = dist(P.mouR, P.mouL);
    var noseW = dist(P.noseR, P.noseL);
    return mouthW / Math.max(1, noseW);
  },

  "Lower/upper lip": function(P, bizy, fh) {
    /* Высота нижней губы / высота верхней губы */
    var lowerLip = dist(P.st, P.lb);
    var upperLip = dist(P.lt, P.st);
    return lowerLip / Math.max(1, upperLip);
  },

  /* ==================== 👃 НОС ==================== */

  "Nasal height/width": function(P, bizy, fh) {
    /* Ширина носа / высота носа */
    var noseW = dist(P.noseR, P.noseL);
    var noseH = dist(P.nas, P.ntip);
    return noseW / Math.max(1, noseH);
  },

  "Ipsilateral alar angle": function(P, bizy, fh) {
    /* Средний угол крыла носа (правый + левый) / 2 */
    var rightAngle = angleAt(P.noseR, P.ntip, P.nas);
    var leftAngle = angleAt(P.noseL, P.ntip, P.nas);
    return (rightAngle + leftAngle) / 2;
  },

  "IAA-JFA deviation": function(P, bizy, fh) {
    /* Отклонение между углом крыла носа и углом челюсти */
    var iaa = (angleAt(P.noseR, P.ntip, P.nas) + angleAt(P.noseL, P.ntip, P.nas)) / 2;
    var jfa = angleAt(P.gonR, P.chin, P.gonL);
    return iaa - jfa;
  },

  /* ==================== 🪞 СИММЕТРИЯ ==================== */

  "Symmetry": function(P, bizy, fh) {
    /* Вычисляется отдельной функцией computeSymmetry */
    return computeSymmetry(P, bizy, fh);
  }
};

/* ============================================================
   РАЗДЕЛ 5: РАСЧЁТ СИММЕТРИИ
   ============================================================ */

/*
   Симметрия считается по 11 парам билатеральных точек.
   
   Для каждой пары:
   - Отклонение по X относительно центральной линии (нормализовано на bizy)
   - Отклонение по Y между парными точками (нормализовано на fh)
   
   Центральная линия определяется по 4 точкам: hair, chin, nas, sub
   
   Результат: 0..1 (потом используется как значение метрики Symmetry)
*/
export function computeSymmetry(P, bizy, fh) {
  /* Центральная линия (среднее X 4 центральных точек) */
  var cx = (P.hair.x + P.chin.x + P.nas.x + P.sub.x) / 4;
  
  var deviations = [];
  
  for (var i = 0; i < SYMMETRY_PAIRS.length; i++) {
    var pairId = SYMMETRY_PAIRS[i];
    var R = P[pairId[0]];
    var L = P[pairId[1]];
    
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
  
  /* Среднее отклонение */
  var avgDev = 0;
  for (var j = 0; j < deviations.length; j++) {
    avgDev += deviations[j];
  }
  avgDev /= deviations.length;
  
  /* Преобразование: 1 - avgDev × 5, ограниченное 0..1 */
  var symmetryRaw = Math.max(0, Math.min(1, 1 - avgDev * 5));
  
  return symmetryRaw;
}

/* ============================================================
   РАЗДЕЛ 6: РАСЧЁТ КАЧЕСТВА (CONFIDENCE)
   НЕ ВЛИЯЕТ НА БАЛЛ. Только показывает доверие.
   ============================================================ */

/*
   Оценивает качество фото на основе:
   - Размер лица на фото
   - Наклон головы (roll)
   - Поворот головы (yaw)
   - Ракурс сверху/снизу (pitch)
   
   Возвращает объект:
   {
     conf: 40-100 (процент доверия),
     roll: число (градусы),
     yaw: число (градусы),
     pitch: число (градусы),
     warns: массив строк с предупреждениями,
     faceFrac: число (доля лица на фото)
   }
*/
export function computeQuality(P, imgWidth, imgHeight, bizy, fh) {
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
    Math.atan2(P.eyeLc.y - P.eyeRc.y, P.eyeLc.x - P.eyeRc.x)
  ) * 180 / Math.PI;
  
  if (roll > QT.maxRoll) {
    conf -= Math.min(25, (roll - QT.maxRoll) * QT.rollPenaltyPerDeg);
    warns.push("наклон " + roll.toFixed(0) + "°");
  }
  
  /* Поворот головы (yaw) */
  var cx = (P.hair.x + P.chin.x + P.nas.x + P.sub.x) / 4;
  var yaw = Math.abs(
    Math.abs(cx - P.eyeRc.x) - Math.abs(P.eyeLc.x - cx)
  ) / Math.max(1, bizy) * 90;
  
  if (yaw > QT.maxYaw) {
    conf -= Math.min(25, (yaw - QT.maxYaw) * QT.yawPenaltyPerDeg);
    warns.push("поворот ~" + yaw.toFixed(0) + "°");
  }
  
  /* Ракурс сверху/снизу (pitch) */
  var upper = dist(P.hair, P.nas);
  var lower = dist(P.sub, P.chin);
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
   РАЗДЕЛ 7: ГЛАВНАЯ ФУНКЦИЯ РАСЧЁТА (v20)
   Architecture A: tier → absolute points → sum → penalty → normalize
   ============================================================ */

/*
   Вход:
   - placedPoints: массив [{id, x, y}, ...] в нормализованных координатах (0..1)
   - imgWidth: ширина изображения в пикселях
   - imgHeight: высота изображения в пикселях
   
   Выход:
   {
     metrics: [{name, cat, value, unit, lo, hi, tierIndex, points, maxPoints, score, weight}],
     catScores: {"👁 Глаза": 72.5, ...},
     overall: 68.3 (нормализованный процент 0-100),
     label: "MTN" (лейбл looksmax),
     rawSum: 188.7 (сумма absolute points),
     maxSum: 284.0 (максимально возможная сумма),
     rawPercent: 66.4 (сырой процент до нормализации),
     penalty: 9.9 (штраф за дисбаланс),
     spread: 19.8 (разброс категорий),
     symmetry: 0.92,
     quality: {conf, roll, yaw, pitch, warns, faceFrac},
     bizy: число,
     fh: число,
     PTS: объект с точками в пикселях
   }
*/
export function computeAllMetrics(placedPoints, imgWidth, imgHeight) {
  /* Шаг 1: Конвертация нормализованных координат в пиксели */
  var P = {};
  for (var i = 0; i < placedPoints.length; i++) {
    P[placedPoints[i].id] = {
      x: placedPoints[i].x * imgWidth,
      y: placedPoints[i].y * imgHeight
    };
  }
  
  /* Шаг 2: Базовые измерения */
  var bizy = dist(P.bizR, P.bizL);
  var fh = dist(P.hair, P.chin);
  
  /* Шаг 3: Расчёт каждой метрики */
  var metrics = [];
  var totalSum = 0;
  var maxSum = 0;
  
  /* Суммы по категориям (для штрафа за дисбаланс) */
  var catSum = {};
  var catMax = {};
  for (var c0 = 0; c0 < CATS.length; c0++) {
    catSum[CATS[c0]] = 0;
    catMax[CATS[c0]] = 0;
  }
  
  for (var m = 0; m < METRIC_TABLE.length; m++) {
    var mt = METRIC_TABLE[m];
    var fn = METRIC_FUNCTIONS[mt.name];
    
    /* Вычисляем значение метрики */
    var value = fn ? fn(P, bizy, fh) : 0;
    
    /* Определяем tier (0-4) */
    var tIdx = getTierIndex(value, mt.lo, mt.hi);
    
    /* Получаем absolute points за этот tier */
    var points = mt.pts[tIdx];
    var maxPts = mt.pts[0]; /* T1 = максимум */
    
    /* Накапливаем суммы */
    totalSum += points;
    maxSum += maxPts;
    catSum[mt.cat] += points;
    catMax[mt.cat] += maxPts;
    
    /* Добавляем метрику в массив */
    metrics.push({
      name: mt.name,
      cat: mt.cat,
      value: value,
      unit: mt.u,
      lo: mt.lo,
      hi: mt.hi,
      tierIndex: tIdx,
      points: points,
      maxPoints: maxPts,
      score: Math.max(0, Math.min(100, (points / maxPts) * 100)), /* процент для отображения */
      weight: mt.w
    });
  }
  
  /* Шаг 4: Категории в процентах */
  var catScores = {};
  var minCat = Infinity;
  var maxCat = -Infinity;
  
  for (var c = 0; c < CATS.length; c++) {
    var cn = CATS[c];
    var cp = catMax[cn] > 0 ? (catSum[cn] / catMax[cn]) * 100 : 0;
    catScores[cn] = Math.max(0, Math.min(100, cp));
    
    if (catScores[cn] < minCat) minCat = catScores[cn];
    if (catScores[cn] > maxCat) maxCat = catScores[cn];
  }
  
  /* Шаг 5: Штраф за дисбаланс */
  var spread = maxCat - minCat;
  var penalty = spread * 0.5;
  
  /* Шаг 6: Сырой процент */
  var rawPercent = maxSum > 0 ? (totalSum / maxSum) * 100 : 0;
  
  /* Шаг 7: Линейная нормализация под шкалу looksmax */
  var adjusted = rawPercent - penalty;
  var overall = NORMALIZATION.a * adjusted + NORMALIZATION.b;
  
  /* Ограничение 0-100 */
  overall = Math.max(0, Math.min(100, overall));
  
  /* Шаг 8: Лейбл looksmax */
  var label = looksmaxLabel(overall);
  
  /* Шаг 9: Симметрия и качество */
  var symmetry = computeSymmetry(P, bizy, fh);
  var quality = computeQuality(P, imgWidth, imgHeight, bizy, fh);
  
  return {
    metrics: metrics,
    catScores: catScores,
    overall: overall,
    label: label,
    rawSum: totalSum,
    maxSum: maxSum,
    rawPercent: rawPercent,
    penalty: penalty,
    spread: spread,
    symmetry: symmetry,
    quality: quality,
    bizy: bizy,
    fh: fh,
    PTS: P
  };
}

/* ============================================================
   РАЗДЕЛ 8: ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ============================================================ */

/*
   Цвет по баллу (для UI).
   score: процент 0-100
   Возвращает: HEX-цвет
*/
export function colorOf(score) {
  if (score >= 80) return "#3ddc84"; /* зелёный */
  if (score >= 50) return "#ffd166"; /* жёлтый */
  return "#ff5c7a"; /* красный */
}

/*
   Расчёт PSL (Pretty Scale Level) из итогового балла.
   overall: процент 0-100
   Возвращает: 1-8 (максимум 8, не 10)
   
   Формула: overall / 12.5 (чтобы 100 → 8)
*/
export function computePSL(overall) {
  var psl = overall / 12.5;
  return Math.max(1, Math.min(8, psl));
}

/*
   Расчёт третей лица в процентах.
   P: объект с точками в пикселях
   Возвращает: [upper%, middle%, lower%]
*/
export function computeThirds(P) {
  var upper = dist(P.hair, P.nas);
  var middle = dist(P.nas, P.sub);
  var lower = dist(P.sub, P.chin);
  var total = upper + middle + lower;
  
  if (total < 1e-9) return [33.3, 33.3, 33.4];
  
  return [
    (upper / total) * 100,
    (middle / total) * 100,
    (lower / total) * 100
  ];
}

/*
   Расчёт значений для 4 профилей (осей).
   metrics: массив метрик из computeAllMetrics
   AXES_CONFIG: объект из config.js
   
   Возвращает: {"Гармония": 72.5, "Угловатость": 68.3, ...}
*/
export function computeAxes(metrics, AXES_CONFIG) {
  var result = {};
  var names = Object.keys(AXES_CONFIG);
  
  for (var a = 0; a < names.length; a++) {
    var axName = names[a];
    var metricNames = AXES_CONFIG[axName];
    var scores = [];
    
    /* Ищем метрики по именам */
    for (var mi = 0; mi < metricNames.length; mi++) {
      var mName = metricNames[mi];
      for (var ni = 0; ni < metrics.length; ni++) {
        if (metrics[ni].name === mName) {
          scores.push(metrics[ni].score);
          break;
        }
      }
    }
    
    /* Среднее арифметическое */
    var sum = 0;
    for (var s = 0; s < scores.length; s++) {
      sum += scores[s];
    }
    
    result[axName] = scores.length > 0 ? sum / scores.length : 0;
  }
  
  return result;
}

/*
   Формирование текстового отчёта для отправки боту.
   result: объект из computeAllMetrics
   
   Возвращает: строка с полным отчётом
*/
export function buildReportText(result) {
  var lines = [];
  
  /* Заголовок */
  lines.push("📊 LUX PRO v20: " + result.overall.toFixed(1) + "/100 [" + result.label + "]");
  lines.push("Raw: " + result.rawSum.toFixed(1) + "/" + result.maxSum.toFixed(1) + 
             " (" + result.rawPercent.toFixed(1) + "%)");
  lines.push("Penalty: -" + result.penalty.toFixed(1) + " (spread " + result.spread.toFixed(1) + ")");
  lines.push("Confidence: " + Math.round(result.quality.conf) + "%");
  lines.push("PSL: " + computePSL(result.overall).toFixed(1) + "/8");
  lines.push("");
  
  /* Категории */
  for (var c = 0; c < CATS.length; c++) {
    var catName = CATS[c];
    var catScore = result.catScores[catName];
    lines.push(catName + ": " + Math.round(catScore) + "/100");
  }
  
  lines.push("");
  lines.push("--- Детали ---");
  
  /* Отдельные метрики */
  for (var m = 0; m < result.metrics.length; m++) {
    var met = result.metrics[m];
    var sign = met.points >= 0 ? "+" : "";
    lines.push(
      "• " + met.name + ": " + met.value.toFixed(2) + met.unit +
      " | " + sign + met.points.toFixed(2) + " pts" +
      " [" + tierName(met.tierIndex) + "]"
    );
  }
  
  /* Предупреждения */
  if (result.quality.warns.length > 0) {
    lines.push("");
    lines.push("⚠️ " + result.quality.warns.join(", "));
  }
  
  return lines.join("\n");
  }
