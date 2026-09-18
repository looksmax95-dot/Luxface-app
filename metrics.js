/* ============================================================
 * metrics.js — формулы 28 метрик looksmax.org по 49 точкам лица.
 *
 * ВХОД: pointsByID = { pointId: { x, y } } в нормализованных
 *       координатах изображения (x по ширине, y по высоте).
 *
 * Корректные пропорции обеспечиваются приведением обеих осей
 * к единой единице (ширине изображения):
 *   x_real = x
 *   y_real = y * imageAspect, где imageAspect = H / W
 *
 * Для каждой метрики добавлены:
 *   • description — человеческое описание (что значит, какой идеал)
 *   • visual      — что рисовать на фото:
 *       { type: 'line',     lines: [{from, to}, ...] }
 *       { type: 'angle',    vertex, from, to }
 *       { type: 'multi',    parts: [ {type:'line',...}, {type:'angle',...} ] }
 *
 * calculateMetrics(pointsByID, imageAspect) возвращает массив:
 *   [{ id, name, tier, ideal, tolerance, value, score, description, visual }]
 * ============================================================ */

'use strict';

const IMAGE_ASPECT_HW_DEFAULT = 4 / 3;

/* ==================== ГЕОМЕТРИЧЕСКИЕ ХЕЛПЕРЫ ==================== */

function _dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function _mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function _angleAt(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const m2 = Math.sqrt(v2x * v2x + v2y * v2y);
  if (m1 === 0 || m2 === 0) return NaN;
  let cos = dot / (m1 * m2);
  if (cos >  1) cos =  1;
  if (cos < -1) cos = -1;
  return Math.acos(cos) * 180 / Math.PI;
}

function _tiltDeg(dx, dy) {
  return Math.abs(Math.atan2(dy, dx)) * 180 / Math.PI;
}

/* ==================== ХЕЛПЕРЫ ДЛЯ VISUAL ==================== */

const L  = (from, to) => ({ type: 'line', from, to });
const A  = (vertex, from, to) => ({ type: 'angle', vertex, from, to });
const M  = (...parts) => ({ type: 'multi', parts });

/* ==================== ОПРЕДЕЛЕНИЯ МЕТРИК ==================== */

const METRIC_DEFS = [

  /* ---------- T1 — КЛЮЧЕВЫЕ ---------- */

  {
    id: 'fwhr',
    name: 'FWHR (ширина/высота лица)',
    tier: 'T1',
    ideal: 1.90,
    tolerance: 0.20,
    description: 'Отношение максимальной ширины лица к высоте средней трети (от линии бровей до верхней губы). Идеал у мужчин ≈ 1.90.',
    visual: M(
      L('face_width_left', 'face_width_right'),
      L('brow_left_peak',  'upper_lip_bottom')
    ),
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
    description: 'Отношение ширины лица к полной высоте (от линии роста волос до подбородка). Идеал ≈ 1.34.',
    visual: M(
      L('face_width_left', 'face_width_right'),
      L('hairline',        'menton')
    ),
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
    description: 'Ширина челюсти (между нижними точками челюсти) относительно ширины лица. Идеал ≈ 0.864.',
    visual: M(
      L('jaw_left',        'jaw_right'),
      L('face_width_left', 'face_width_right')
    ),
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
    description: 'Ширина шеи относительно ширины углов челюсти. Идеал ≈ 0.924.',
    visual: M(
      L('neck_left',   'neck_right'),
      L('gonion_left', 'gonion_right')
    ),
    calc: (P) => {
      const neckW = P.neck_right.x - P.neck_left.x;
      const jawW  = P.gonion_right.x - P.gonion_left.x;
      return neckW / jawW;
    }
  },

  {
    id: 'esr',
    name: 'ESR (межзрачковое / ширина лица)',
    tier: 'T1',
    ideal: 0.444,
    tolerance: 0.03,
    description: 'Расстояние между зрачками относительно ширины лица. Идеал ≈ 0.444.',
    visual: M(
      L('pupil_left',      'pupil_right'),
      L('face_width_left', 'face_width_right')
    ),
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
    description: 'Расстояние между внешними уголками глаз относительно ширины лица. Идеал ≈ 0.628.',
    visual: M(
      L('eye_left_outer',  'eye_right_outer'),
      L('face_width_left', 'face_width_right')
    ),
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
    description: 'Отношение длины глаза (от внутреннего до внешнего уголка) к высоте глаза (от верхнего до нижнего века). Идеал ≈ 2.94.',
    visual: M(
      L('eye_right_inner', 'eye_right_outer'),
      L('eyelid_right_upper', 'eyelid_right_lower')
    ),
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
    description: 'Отношение высоты подбородка к высоте фильтрума (от основания носа до верхней губы). Идеал ≈ 2.19.',
    visual: M(
      L('subnasale',        'cupid_bow'),
      L('lower_lip_bottom', 'menton')
    ),
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
    description: 'Ширина носа относительно расстояния между скулами. Идеал ≈ 0.246.',
    visual: M(
      L('alar_left',  'alar_right'),
      L('zygo_left',  'zygo_right')
    ),
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
    description: 'Внутреннее межзрачковое расстояние относительно ширины носа. Идеал ≈ 0.911.',
    visual: M(
      L('eye_left_inner', 'eye_right_inner'),
      L('alar_left',      'alar_right')
    ),
    calc: (P) => {
      const icd   = P.eye_right_inner.x - P.eye_left_inner.x;
      const noseW = P.alar_right.x     - P.alar_left.x;
      return icd / noseW;
    }
  },

  {
    id: 'nose_wh',
    name: 'Nose Width to Height',
    tier: 'T1',
    ideal: 0.730,
    tolerance: 0.08,
    description: 'Ширина носа относительно его высоты (от переносицы до основания). Идеал ≈ 0.730.',
    visual: M(
      L('alar_left', 'alar_right'),
      L('radix',     'subnasale')
    ),
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
    description: 'Угол при кончике носа между крыльями. Идеал ≈ 95°.',
    visual: A('nose_tip', 'alar_left', 'alar_right'),
    calc: (P) => _angleAt(P.alar_left, P.nose_tip, P.alar_right)
  },

  {
    id: 'eme',
    name: 'EME (угол глаза-рот-глаза)',
    tier: 'T1',
    ideal: 48.0,
    tolerance: 5.0,
    description: 'Угол при центре рта между внутренними уголками глаз. Идеал ≈ 48°.',
    visual: A('_mouth_center', 'eye_left_inner', 'eye_right_inner'),
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
    description: 'Ширина между висками относительно ширины лица. Идеал ≈ 0.907.',
    visual: M(
      L('temple_left',     'temple_right'),
      L('face_width_left', 'face_width_right')
    ),
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
    description: 'Абсолютная разница между углом крыльев носа (IAA) и фронтальным углом челюсти (JFA). Идеал ≈ 0.9°.',
    visual: M(
      A('nose_tip',     'alar_left',   'alar_right'),
      A('pogonion',     'gonion_left', 'gonion_right')
    ),
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
    description: 'Средний наклон бровей (от внутреннего края к пику). Идеал ≈ 8.2°.',
    visual: M(
      L('brow_left_inner',  'brow_left_peak'),
      L('brow_right_inner', 'brow_right_peak')
    ),
    calc: (P) => {
      const lDx = P.brow_left_peak.x  - P.brow_left_inner.x;
      const lDy = P.brow_left_peak.y  - P.brow_left_inner.y;
      const rDx = P.brow_right_peak.x - P.brow_right_inner.x;
      const rDy = P.brow_right_peak.y - P.brow_right_inner.y;
      return (_tiltDeg(lDx, lDy) + _tiltDeg(rDx, rDy)) / 2;
    }
  },

  /* ---------- T2 — ВАЖНЫЕ ---------- */

  {
    id: 'mfr',
    name: 'MFR (midface ratio)',
    tier: 'T2',
    ideal: 1.018,
    tolerance: 0.08,
    description: 'Отношение межзрачкового расстояния к высоте средней трети лица. Идеал ≈ 1.018.',
    visual: M(
      L('pupil_left', 'pupil_right'),
      L('_mid_pupils', 'subnasale')
    ),
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
    description: 'Ширина между углами челюсти относительно ширины лица. Идеал ≈ 0.823.',
    visual: M(
      L('gonion_left',     'gonion_right'),
      L('face_width_left', 'face_width_right')
    ),
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
    description: 'Отношение высоты верхней губы к высоте нижней. Идеал ≈ 1.29.',
    visual: M(
      L('cupid_bow',        'upper_lip_bottom'),
      L('lower_lip_top',    'lower_lip_bottom')
    ),
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
    description: 'Фронтальный угол челюсти при подбородке между углами. Идеал ≈ 96°.',
    visual: A('pogonion', 'gonion_left', 'gonion_right'),
    calc: (P) => _angleAt(P.gonion_left, P.pogonion, P.gonion_right)
  },

  /* ---------- T3 — СРЕДНИЕ ---------- */

  {
    id: 'canthal_tilt',
    name: 'Canthal Tilt (наклон глаз)',
    tier: 'T3',
    ideal: 1.0,
    tolerance: 4.0,
    description: 'Угол наклона глазной щели от внешнего уголка к внутреннему. Идеал у мужчин ≈ 1°.',
    visual: M(
      L('eye_left_outer',  'eye_left_inner'),
      L('eye_right_outer', 'eye_right_inner')
    ),
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
    description: 'Внутреннее расстояние между глазами относительно длины глаза. Идеал ≈ 1.12.',
    visual: M(
      L('eye_left_inner', 'eye_right_inner'),
      L('eye_right_inner', 'eye_right_outer')
    ),
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
    description: 'Внутреннее расстояние между глазами относительно ширины лица. Идеал ≈ 0.224.',
    visual: M(
      L('eye_left_inner',  'eye_right_inner'),
      L('face_width_left', 'face_width_right')
    ),
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
    description: 'Максимальное отклонение одной из трёх третей лица от средней трети. Идеал 0 (все трети равны).',
    visual: M(
      L('hairline',  '_brow_line'),
      L('_brow_line', 'subnasale'),
      L('subnasale', 'menton')
    ),
    calc: (P) => {
      const browY = (P.brow_left_peak.y + P.brow_right_peak.y) / 2;
      const upper = browY - P.hairline.y;
      const mid   = P.subnasale.y - browY;
      const lower = P.menton.y - P.subnasale.y;
      const total = upper + mid + lower;
      const mean  = total / 3;
      if (mean === 0) return NaN;
      return Math.max(
        Math.abs(upper - mean),
        Math.abs(mid   - mean),
        Math.abs(lower - mean)
      ) / mean;
    }
  },

  {
    id: 'brow_height',
    name: 'Brow Height',
    tier: 'T4',
    ideal: 0.314,
    tolerance: 0.06,
    description: 'Высота верхнего века относительно высоты брови над зрачком. Идеал ≈ 0.314.',
    visual: M(
      L('eyelid_left_upper', 'pupil_left'),
      L('brow_left_peak',    'pupil_left')
    ),
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
    description: 'Нижняя треть лица (от основания носа до подбородка) относительно всей высоты. Идеал ≈ 0.533.',
    visual: M(
      L('subnasale', 'menton'),
      L('hairline',  'menton')
    ),
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
    description: 'Ширина рта относительно ширины носа. Идеал ≈ 1.45.',
    visual: M(
      L('mouth_left', 'mouth_right'),
      L('alar_left',  'alar_right')
    ),
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
    description: 'Высота носа (от переносицы до основания) относительно высоты подбородка. Идеал ≈ 0.588.',
    visual: M(
      L('radix',     'subnasale'),
      L('subnasale', 'menton')
    ),
    calc: (P) => {
      const noseH = P.subnasale.y - P.radix.y;
      const chinH = P.menton.y    - P.subnasale.y;
      return noseH / chinH;
    }
  }

];

/* ==================== ВИРТУАЛЬНЫЕ ТОЧКИ ====================
 * Некоторые visual-объекты ссылаются на «виртуальные» точки,
 * которых нет в POINTS: _mouth_center, _mid_pupils, _brow_line.
 * Их вычисляет app.js при отрисовке, metrics.js их не использует.
 * Здесь они только объявлены как константы для справки.
 * ======================================================== */
const VIRTUAL_POINTS = ['_mouth_center', '_mid_pupils', '_brow_line'];

/* ==================== ПОДСЧЁТ БАЛЛА ==================== */
function calcScore(value, ideal, tolerance) {
  if (typeof value !== 'number' || !isFinite(value)) return 0;
  if (typeof ideal !== 'number' || typeof tolerance !== 'number' || tolerance <= 0) return 0;
  const relDev = Math.abs(value - ideal) / tolerance;
  return 100 * Math.exp(-(relDev * relDev));
}

/* ==================== ГЛАВНАЯ ФУНКЦИЯ ==================== */
function calculateMetrics(pointsByID, imageAspect) {
  if (!pointsByID || typeof pointsByID !== 'object') {
    console.error('metrics.js: pointsByID не передан');
    return [];
  }
  const aspect = (typeof imageAspect === 'number' && imageAspect > 0)
    ? imageAspect
    : IMAGE_ASPECT_HW_DEFAULT;

  // Приводим все точки к единой системе единиц (ширина изображения)
  const P = {};
  for (const [id, pt] of Object.entries(pointsByID)) {
    if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') continue;
    P[id] = { x: pt.x, y: pt.y * aspect };
  }

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
      id:          m.id,
      name:        m.name,
      tier:        m.tier,
      ideal:       m.ideal,
      tolerance:   m.tolerance,
      value:       value,
      score:       score,
      description: m.description,
      visual:      m.visual
    });
  }

  console.log('metrics.js: посчитано ' + results.length + ' метрик');
  return results;
}

/* ==================== ЭКСПОРТ ==================== */
window.calculateMetrics = calculateMetrics;
window.calcScore        = calcScore;
window.METRIC_DEFS      = METRIC_DEFS;
window.VIRTUAL_POINTS   = VIRTUAL_POINTS;
