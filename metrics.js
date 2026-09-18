/* ============================================================
 * metrics.js — формулы 28 метрик looksmax.org по 49 точкам лица.
 *
 * ВХОД: pointsByID = { pointId: { x: 0..1, y: 0..1 } }
 *       Где x нормализован по ширине canvas,
 *           y нормализован по высоте canvas.
 *
 * Корректные пропорции обеспечиваются приведением обеих осей
 * к единой единице измерения (ширине canvas):
 *   x_real = x
 *   y_real = y * canvasAspect, где canvasAspect = H / W
 *
 * Пропущены две профильные метрики, не измеримые по анфасу:
 *   - Medial Canthal Angle (нужен профиль)
 *   - Cheekbones Height (проекция, нужен профиль)
 *
 * Функция calculateMetrics(pointsByID, canvasAspect) возвращает массив:
 *   [{ id, name, tier, ideal, tolerance, value, score }]
 * где score — 0..100, рассчитывается через exp-штраф за отклонение.
 * ============================================================ */

'use strict';

/* ==================== КОНСТАНТЫ ==================== */
const CANVAS_ASPECT_HW_DEFAULT = 4 / 3; // H / W (canvas 3:4)

/* ==================== ГЕОМЕТРИЧЕСКИЕ ХЕЛПЕРЫ ==================== */

// Расстояние между двумя точками
function _dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Середина отрезка
function _mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Угол при вершине b между векторами b→a и b→c (в градусах)
function _angleAt(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const m2 = Math.sqrt(v2x * v2x + v2y * v2y);
  if (m1 === 0 || m2 === 0) return NaN;
  let cos = dot / (m1 * m2);
  if (cos > 1) cos = 1;
  if (cos < -1) cos = -1;
  return Math.acos(cos) * 180 / Math.PI;
}

// Абсолютный угол к горизонтали (в градусах, 0..90)
function _tiltDeg(dx, dy) {
  return Math.abs(Math.atan2(dy, dx)) * 180 / Math.PI;
}

/* ==================== ОПРЕДЕЛЕНИЯ 28 МЕТРИК ====================
 * Поля:
 *   id         — строковый идентификатор
 *   name       — читаемое имя
 *   tier       — T1..T5 (приоритет)
 *   ideal      — идеальное значение
 *   tolerance  — допустимое отклонение (σ для exp-штрафа)
 *   calc(P)    — функция расчёта значения
 * ============================================================= */

const METRIC_DEFS = [

  /* ---------- T1 — КЛЮЧЕВЫЕ ---------- */

  {
    id: 'fwhr',
    name: 'FWHR (ширина/высота лица)',
    tier: 'T1',
    ideal: 1.90,
    tolerance: 0.20,
    calc: (P) => {
      const width  = P.face_width_right.x - P.face_width_left.x;
      const browY  = (P.brow_left_peak.y + P.brow_right_peak.y) / 2;
      const height = P.upper_lip_bottom.y - browY;
      return width / height;
    }
  },

  {
    id: 'tfwhr',
    name: 'tFWHR (общая ширина/высота)',
    tier: 'T1',
    ideal: 1.34,
    tolerance: 0.12,
    calc: (P) => {
      const width  = P.face_width_right.x - P.face_width_left.x;
      const height = P.menton.y - P.hairline.y;
      return width / height;
    }
  },

  {
    id: 'jaw_width',
    name: 'Jaw Width (ширина челюсти)',
    tier: 'T1',
    ideal: 0.864,
    tolerance: 0.06,
    calc: (P) => {
      const jawW  = P.jaw_right.x - P.jaw_left.x;
      const faceW = P.face_width_right.x - P.face_width_left.x;
      return jawW / faceW;
    }
  },

  {
    id: 'neck_width',
    name: 'Neck Width (ширина шеи)',
    tier: 'T1',
    ideal: 0.924,
    tolerance: 0.08,
    calc: (P) => {
      const neckW  = P.neck_right.x - P.neck_left.x;
      const jawW   = P.gonion_right.x - P.gonion_left.x;
      return neckW / jawW;
    }
  },

  {
    id: 'esr',
    name: 'ESR (межзрачковое / ширина лица)',
    tier: 'T1',
    ideal: 0.444,
    tolerance: 0.03,
    calc: (P) => {
      const ipd   = P.pupil_right.x - P.pupil_left.x;
      const faceW = P.face_width_right.x - P.face_width_left.x;
      return ipd / faceW;
    }
  },

  {
    id: 'outer_canthal',
    name: 'Outer Canthal Distance',
    tier: 'T1',
    ideal: 0.628,
    tolerance: 0.05,
    calc: (P) => {
      const ocd   = P.eye_right_outer.x - P.eye_left_outer.x;
      const faceW = P.face_width_right.x - P.face_width_left.x;
      return ocd / faceW;
    }
  },

  {
    id: 'pfl_phl',
    name: 'PFL:PHL (длина/высота глаза)',
    tier: 'T1',
    ideal: 2.94,
    tolerance: 0.40,
    calc: (P) => {
      const pfl = P.eye_right_outer.x - P.eye_right_inner.x;
      const phl = P.eyelid_right_lower.y - P.eyelid_right_upper.y;
      return pfl / phl;
    }
  },

  {
    id: 'chin_philtrum',
    name: 'Chin to Philtrum',
    tier: 'T1',
    ideal: 2.19,
    tolerance: 0.30,
    calc: (P) => {
      const philtrum = P.cupid_bow.y - P.subnasale.y;
      const chin     = P.menton.y    - P.lower_lip_bottom.y;
      return chin / philtrum;
    }
  },

  {
    id: 'nose_zygo',
    name: 'Nose to Zygo',
    tier: 'T1',
    ideal: 0.246,
    tolerance: 0.03,
    calc: (P) => {
      const noseW = P.alar_right.x - P.alar_left.x;
      const zygoW = P.zygo_right.x - P.zygo_left.x;
      return noseW / zygoW;
    }
  },

  {
    id: 'nose_icd',
    name: 'Nose Width to ICD',
    tier: 'T1',
    ideal: 0.911,
    tolerance: 0.07,
    calc: (P) => {
      const icd   = P.eye_right_inner.x - P.eye_left_inner.x;
      const noseW = P.alar_right.x    - P.alar_left.x;
      return icd / noseW;
    }
  },

  {
    id: 'nose_wh',
    name: 'Nose Width to Height',
    tier: 'T1',
    ideal: 0.730,
    tolerance: 0.08,
    calc: (P) => {
      const noseW = P.alar_right.x - P.alar_left.x;
      const noseH = P.subnasale.y - P.radix.y;
      return noseW / noseH;
    }
  },

  {
    id: 'alar_angle',
    name: 'Alar Angle (угол крыльев носа)',
    tier: 'T1',
    ideal: 95.0,
    tolerance: 8.0,
    calc: (P) => _angleAt(P.alar_left, P.nose_tip, P.alar_right)
  },

  {
    id: 'eme',
    name: 'EME (угол глаза-рот-глаза)',
    tier: 'T1',
    ideal: 48.0,
    tolerance: 5.0,
    calc: (P) => {
      const mouth = _mid(P.mouth_left, P.mouth_right);
      return _angleAt(P.eye_left_inner, mouth, P.eye_right_inner);
    }
  },

  {
    id: 'bitemporal',
    name: 'Bitemporal Width',
    tier: 'T1',
    ideal: 0.907,
    tolerance: 0.06,
    calc: (P) => {
      const bW    = P.temple_right.x - P.temple_left.x;
      const faceW = P.face_width_right.x - P.face_width_left.x;
      return bW / faceW;
    }
  },

  {
    id: 'iaa_jfa',
    name: 'IAA–JFA deviation',
    tier: 'T1',
    ideal: 0.9,
    tolerance: 3.0,
    calc: (P) => {
      const alar = _angleAt(P.alar_left,   P.nose_tip, P.alar_right);
      const jfa  = _angleAt(P.gonion_left, P.pogonion, P.gonion_right);
      return Math.abs(alar - jfa);
    }
  },

  {
    id: 'eyebrow_tilt',
    name: 'Eyebrows Tilt',
    tier: 'T1',
    ideal: 8.2,
    tolerance: 4.0,
    calc: (P) => {
      const lDx = P.brow_left_peak.x  - P.brow_left_inner.x;
      const lDy = P.brow_left_peak.y  - P.brow_left_inner.y;
      const rDx = P.brow_right_peak.x - P.brow_right_inner.x;
      const rDy = P.brow_right_peak.y - P.brow_right_inner.y;
      const lT  = _tiltDeg(lDx, lDy);
      const rT  = _tiltDeg(rDx, rDy);
      return (lT + rT) / 2;
    }
  },

  /* ---------- T2 — ВАЖНЫЕ ---------- */

  {
    id: 'mfr',
    name: 'MFR (midface ratio)',
    tier: 'T2',
    ideal: 1.018,
    tolerance: 0.08,
    calc: (P) => {
      const ipd       = P.pupil_right.x - P.pupil_left.x;
      const avgPupilY = (P.pupil_left.y + P.pupil_right.y) / 2;
      const midfaceH  = P.subnasale.y - avgPupilY;
      return ipd / midfaceH;
    }
  },

  {
    id: 'bigonial',
    name: 'Bigonial Width',
    tier: 'T2',
    ideal: 0.823,
    tolerance: 0.06,
    calc: (P) => {
      const bW    = P.gonion_right.x - P.gonion_left.x;
      const faceW = P.face_width_right.x - P.face_width_left.x;
      return bW / faceW;
    }
  },

  {
    id: 'lip_prop',
    name: 'Lip Proportions',
    tier: 'T2',
    ideal: 1.293,
    tolerance: 0.15,
    calc: (P) => {
      const upperH = P.upper_lip_bottom.y - P.cupid_bow.y;
      const lowerH = P.lower_lip_bottom.y - P.lower_lip_top.y;
      return upperH / lowerH;
    }
  },

  {
    id: 'jaw_frontal',
    name: 'Jaw Frontal Angle',
    tier: 'T2',
    ideal: 96.1,
    tolerance: 8.0,
    calc: (P) => _angleAt(P.gonion_left, P.pogonion, P.gonion_right)
  },

  /* ---------- T3 — СРЕДНИЕ ---------- */

  {
    id: 'canthal_tilt',
    name: 'Canthal Tilt (наклон глаз)',
    tier: 'T3',
    ideal: 1.0,
    tolerance: 4.0,
    calc: (P) => {
      const lNum = P.eye_left_inner.y  - P.eye_left_outer.y;
      const lDen = Math.abs(P.eye_left_inner.x - P.eye_left_outer.x);
      const rNum = P.eye_right_inner.y - P.eye_right_outer.y;
      const rDen = Math.abs(P.eye_right_inner.x - P.eye_right_outer.x);
      const lT   = Math.atan2(lNum, lDen) * 180 / Math.PI;
      const rT   = Math.atan2(rNum, rDen) * 180 / Math.PI;
      return (lT + rT) / 2;
    }
  },

  /* ---------- T4 — ВТОРОСТЕПЕННЫЕ ---------- */

  {
    id: 'es_ratio',
    name: 'ES (eye separation ratio)',
    tier: 'T4',
    ideal: 1.12,
    tolerance: 0.12,
    calc: (P) => {
      const innerDist = P.eye_right_inner.x - P.eye_left_inner.x;
      const eyeWidth  = P.eye_right_outer.x - P.eye_right_inner.x;
      return innerDist / eyeWidth;
    }
  },

  {
    id: 'icd',
    name: 'Inner Canthal Distance',
    tier: 'T4',
    ideal: 0.224,
    tolerance: 0.025,
    calc: (P) => {
      const icd   = P.eye_right_inner.x - P.eye_left_inner.x;
      const faceW = P.face_width_right.x - P.face_width_left.x;
      return icd / faceW;
    }
  },

  {
    id: 'facial_thirds',
    name: 'Facial Thirds (равенство третей)',
    tier: 'T4',
    ideal: 0.0,
    tolerance: 0.08,
    calc: (P) => {
      const browY = (P.brow_left_peak.y + P.brow_right_peak.y) / 2;
      const upper = browY - P.hairline.y;
      const mid   = P.subnasale.y - browY;
      const lower = P.menton.y - P.subnasale.y;
      const total = upper + mid + lower;
      const mean  = total / 3;
      if (mean === 0) return NaN;
      const maxDev = Math.max(
        Math.abs(upper - mean),
        Math.abs(mid   - mean),
        Math.abs(lower - mean)
      );
      return maxDev / mean; // 0 — идеал, чем больше, тем хуже
    }
  },

  {
    id: 'brow_height',
    name: 'Brow Height',
    tier: 'T4',
    ideal: 0.314,
    tolerance: 0.06,
    calc: (P) => {
      const pupilY      = (P.pupil_left.y + P.pupil_right.y) / 2;
      const browY       = (P.brow_left_peak.y + P.brow_right_peak.y) / 2;
      const eyelidUpper = (P.eyelid_left_upper.y + P.eyelid_right_upper.y) / 2;
      const browToPupil = pupilY - browY;
      const pupilToLid  = pupilY - eyelidUpper;
      return pupilToLid / browToPupil;
    }
  },

  /* ---------- T5 — ДОПОЛНИТЕЛЬНЫЕ ---------- */

  {
    id: 'lower_third',
    name: 'Lower Third',
    tier: 'T5',
    ideal: 0.533,
    tolerance: 0.06,
    calc: (P) => {
      const lowerH = P.menton.y - P.subnasale.y;
      const faceH  = P.menton.y - P.hairline.y;
      return lowerH / faceH;
    }
  },

  {
    id: 'mouth_nose',
    name: 'Mouth to Nose',
    tier: 'T5',
    ideal: 1.45,
    tolerance: 0.15,
    calc: (P) => {
      const mouthW = P.mouth_right.x - P.mouth_left.x;
      const noseW  = P.alar_right.x  - P.alar_left.x;
      return mouthW / noseW;
    }
  },

  {
    id: 'nose_chin',
    name: 'Nose to Chin',
    tier: 'T5',
    ideal: 0.588,
    tolerance: 0.08,
    calc: (P) => {
      const noseH  = P.subnasale.y - P.radix.y;
      const chinH  = P.menton.y    - P.subnasale.y;
      return noseH / chinH;
    }
  }

];

/* ==================== ПОДСЧЁТ БАЛЛА ЗА МЕТРИКУ ====================
 * Балл = 100 * exp( -( relDev )^2 ), где relDev = |value - ideal| / tolerance.
 *   relDev = 0    → 100
 *   relDev = 1    → 37
 *   relDev = 2    → 2
 *   relDev ≥ 3    → ~0
 * ================================================================ */
function calcScore(value, ideal, tolerance) {
  if (typeof value !== 'number' || !isFinite(value)) return 0;
  if (typeof ideal !== 'number' || typeof tolerance !== 'number' || tolerance <= 0) return 0;
  const relDev = Math.abs(value - ideal) / tolerance;
  return 100 * Math.exp(-(relDev * relDev));
}

/* ==================== ГЛАВНАЯ ФУНКЦИЯ ====================
 * pointsByID  — объект { id_точки: { x, y } } в нормализованных
 *               координатах canvas (x по ширине, y по высоте)
 * canvasAspect — H / W (по умолчанию 4/3 для canvas 3:4)
 *
 * Возвращает массив:
 *   [{ id, name, tier, ideal, tolerance, value, score }, ...]
 * ======================================================== */
function calculateMetrics(pointsByID, canvasAspect) {
  if (!pointsByID || typeof pointsByID !== 'object') {
    console.error('metrics.js: pointsByID не передан');
    return [];
  }
  const aspect = (typeof canvasAspect === 'number' && canvasAspect > 0)
    ? canvasAspect
    : CANVAS_ASPECT_HW_DEFAULT;

  // Приводим все точки к единой системе единиц (ширина canvas)
  const P = {};
  for (const [id, pt] of Object.entries(pointsByID)) {
    if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') continue;
    P[id] = { x: pt.x, y: pt.y * aspect };
  }

  // Проверяем наличие всех нужных точек
  const requiredIds = new Set();
  for (const m of METRIC_DEFS) {
    // пробный вызов с Proxy — чтобы вычислить, какие точки нужны
    const proxy = new Proxy({}, {
      get: (_, key) => {
        requiredIds.add(key);
        return { x: 0, y: 0 };
      }
    });
    try { m.calc(proxy); } catch (_) {}
  }
  const missing = [];
  for (const id of requiredIds) {
    if (!P[id]) missing.push(id);
  }
  if (missing.length) {
    console.warn('metrics.js: не хватает точек для расчёта:', missing);
  }

  // Считаем все метрики
  const results = [];
  for (const m of METRIC_DEFS) {
    let value = null;
    try {
      value = m.calc(P);
    } catch (err) {
      console.warn('metrics.js: ошибка в метрике ' + m.id + ':', err);
    }
    const score = calcScore(value, m.ideal, m.tolerance);
    results.push({
      id:        m.id,
      name:      m.name,
      tier:      m.tier,
      ideal:     m.ideal,
      tolerance: m.tolerance,
      value:     value,
      score:     score
    });
  }

  console.log('metrics.js: посчитано ' + results.length + ' метрик');
  return results;
}

/* ==================== ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ==================== */
// Не используем module.exports — файл подключается через <script>.
window.calculateMetrics = calculateMetrics;
window.calcScore        = calcScore;
window.METRIC_DEFS      = METRIC_DEFS;
