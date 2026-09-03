/* ============================================================
   LUX FACE — config.js
   Версия: v23-professional
   Дата: 2026-09-01

   НАЗНАЧЕНИЕ:
   Единственный источник конфигурационных данных.

   ВАЖНО:
   - Здесь НЕТ вычислительной логики оценки.
   - Геометрия находится в math-core.js.
   - Итоговая математика находится в math-core.js.
   - UI не должен самостоятельно дублировать эти значения.

   SCORING MODEL:
   Professional 4-pillar model:

     HARM = 32%
     MISC = 26%
     ANGU = 22%
     DIMO = 20%

   После расчёта pillar scores применяется dynamic penalty
   weighting из исходной формулы.

   Источник исходной формулы:
   Looksmax.org — Definitive Facial Analysis Guide.
   Формула используется как математическая модель,
   а не как научно валидированная шкала привлекательности.
   ============================================================ */


/* ============================================================
   1. ВЕРСИЯ
   ============================================================ */

export var APP_VERSION = "v23-professional";


/* ============================================================
   2. 46 ТОЧЕК ЛИЦА
   ============================================================ */

export var POINTS = [

  /* ---------- CENTRAL LINE ---------- */

  [
    "hair",
    "Линия роста волос",
    "Середина лба, где начинаются волосы",
    0.50,
    0.06
  ],

  [
    "nas",
    "Назион",
    "Переносица, где нос начинается между глаз",
    0.50,
    0.42
  ],

  [
    "sub",
    "Субназале",
    "Основание носа, стык с верхней губой",
    0.50,
    0.66
  ],

  [
    "chin",
    "Подбородок",
    "Самая нижняя точка подбородка",
    0.50,
    0.97
  ],


  /* ---------- RIGHT EYE ---------- */

  [
    "eyeRo",
    "Глаз прав. внешн.",
    "Внешний уголок правого глаза",
    0.24,
    0.45
  ],

  [
    "eyeRi",
    "Глаз прав. внутр.",
    "Внутренний уголок правого глаза",
    0.40,
    0.45
  ],

  [
    "eyeRu",
    "Прав. верх. веко",
    "Середина верхнего века правого глаза",
    0.32,
    0.43
  ],

  [
    "eyeRl",
    "Прав. ниж. веко",
    "Середина нижнего века правого глаза",
    0.32,
    0.47
  ],

  [
    "eyeRc",
    "Прав. зрачок",
    "Центр зрачка правого глаза",
    0.32,
    0.45
  ],


  /* ---------- LEFT EYE ---------- */

  [
    "eyeLo",
    "Глаз лев. внешн.",
    "Внешний уголок левого глаза",
    0.76,
    0.45
  ],

  [
    "eyeLi",
    "Глаз лев. внутр.",
    "Внутренний уголок левого глаза",
    0.60,
    0.45
  ],

  [
    "eyeLu",
    "Лев. верх. веко",
    "Середина верхнего века левого глаза",
    0.68,
    0.43
  ],

  [
    "eyeLl",
    "Лев. ниж. веко",
    "Середина нижнего века левого глаза",
    0.68,
    0.47
  ],

  [
    "eyeLc",
    "Лев. зрачок",
    "Центр зрачка левого глаза",
    0.68,
    0.45
  ],


  /* ---------- RIGHT EYEBROW ---------- */

  [
    "browRi",
    "Бровь прав. внутр.",
    "Начало правой брови",
    0.36,
    0.36
  ],

  [
    "browRp",
    "Бровь прав. пик",
    "Верхняя точка правой брови",
    0.32,
    0.34
  ],

  [
    "browRo",
    "Бровь прав. внешн.",
    "Хвост правой брови",
    0.22,
    0.36
  ],


  /* ---------- LEFT EYEBROW ---------- */

  [
    "browLi",
    "Бровь лев. внутр.",
    "Начало левой брови",
    0.64,
    0.36
  ],

  [
    "browLp",
    "Бровь лев. пик",
    "Верхняя точка левой брови",
    0.68,
    0.34
  ],

  [
    "browLo",
    "Бровь лев. внешн.",
    "Хвост левой брови",
    0.78,
    0.36
  ],


  /* ---------- CHEEKBONES ---------- */

  [
    "bizR",
    "Ширина прав.",
    "Максимальная ширина лица справа",
    0.13,
    0.50
  ],

  [
    "bizL",
    "Ширина лев.",
    "Максимальная ширина лица слева",
    0.87,
    0.50
  ],


  /* ---------- TEMPLES ---------- */

  [
    "tempR",
    "Висок прав.",
    "Край лба у правого виска",
    0.16,
    0.32
  ],

  [
    "tempL",
    "Висок лев.",
    "Край лба у левого виска",
    0.84,
    0.32
  ],


  /* ---------- NOSE ---------- */

  [
    "noseR",
    "Крыло прав.",
    "Внешний край правой ноздри",
    0.42,
    0.62
  ],

  [
    "noseL",
    "Крыло лев.",
    "Внешний край левой ноздри",
    0.58,
    0.62
  ],

  [
    "ntip",
    "Кончик носа",
    "Наиболее выступающая точка кончика носа",
    0.50,
    0.60
  ],


  /* ---------- LIPS ---------- */

  [
    "lt",
    "Верхняя губа",
    "Верхняя центральная точка верхней губы",
    0.50,
    0.73
  ],

  [
    "st",
    "Линия губ",
    "Центр линии смыкания губ",
    0.50,
    0.76
  ],

  [
    "lb",
    "Низ нижней губы",
    "Нижняя центральная точка нижней губы",
    0.50,
    0.80
  ],


  /* ---------- MOUTH CORNERS ---------- */

  [
    "mouR",
    "Рот прав. уголок",
    "Правый уголок рта",
    0.34,
    0.76
  ],

  [
    "mouL",
    "Рот лев. уголок",
    "Левый уголок рта",
    0.66,
    0.76
  ],


  /* ---------- GONIONS ---------- */

  [
    "gonR",
    "Угол челюсти прав.",
    "Правый gonion",
    0.24,
    0.80
  ],

  [
    "gonL",
    "Угол челюсти лев.",
    "Левый gonion",
    0.76,
    0.80
  ],


  /* ---------- JAW MID ---------- */

  [
    "jawMidR",
    "Челюсть сред прав.",
    "Средняя точка правой линии челюсти",
    0.32,
    0.89
  ],

  [
    "jawMidL",
    "Челюсть сред лев.",
    "Средняя точка левой линии челюсти",
    0.68,
    0.89
  ],


  /* ---------- JAW LOW ---------- */

  [
    "jawLowR",
    "Челюсть низ прав.",
    "Нижняя точка правой линии челюсти",
    0.41,
    0.94
  ],

  [
    "jawLowL",
    "Челюсть низ лев.",
    "Нижняя точка левой линии челюсти",
    0.59,
    0.94
  ],


  /* ---------- ZYGOMATIC ---------- */

  [
    "zygR",
    "Скула прав.",
    "Наиболее выступающая точка правой скулы",
    0.18,
    0.57
  ],

  [
    "zygL",
    "Скула лев.",
    "Наиболее выступающая точка левой скулы",
    0.82,
    0.57
  ],


  /* ---------- CHEEK HOLLOW ---------- */

  [
    "holR",
    "Впадина прав.",
    "Щёчная впадина справа",
    0.30,
    0.70
  ],

  [
    "holL",
    "Впадина лев.",
    "Щёчная впадина слева",
    0.70,
    0.70
  ],


  /* ---------- NECK ---------- */

  [
    "neckR",
    "Шея прав.",
    "Правый край шеи",
    0.32,
    1.00
  ],

  [
    "neckL",
    "Шея лев.",
    "Левый край шеи",
    0.68,
    1.00
  ],


  /* ---------- CHIN EDGES ---------- */

  [
    "chinR",
    "Подбородок прав.",
    "Правый край подбородка",
    0.44,
    0.95
  ],

  [
    "chinL",
    "Подбородок лев.",
    "Левый край подбородка",
    0.56,
    0.95
  ]

];


/* ============================================================
   3. GUIDE SCHEMA
   ============================================================ */

export var SCH = {};

for (var i = 0; i < POINTS.length; i++) {
  SCH[POINTS[i][0]] = {
    x: POINTS[i][3],
    y: POINTS[i][4]
  };
}


/* ============================================================
   4. LEGACY TIER CONFIG
   ------------------------------------------------------------
   Временно сохраняется для совместимости со старым
   math-core.js.

   После перехода math-core.js на v23 эти значения
   больше не используются для итогового score.
   ============================================================ */

export var TIER_THRESHOLDS = [
  1.0,
  1.5,
  2.5,
  4.0,
  Infinity
];


/*
   Старый коэффициент:
   T1 = 100%
   T2 = 90%
   T3 = 50%
   T4 = 30%
   T5 = 0%

   Нужен только для обратной совместимости.
*/

export var TIER_COEFF = [
  1.00,
  0.90,
  0.50,
  0.30,
  0.00
];


/* ============================================================
   5. PROFESSIONAL 4-PILLAR MODEL
   ============================================================ */

export var PILLARS = [
  "HARM",
  "MISC",
  "ANGU",
  "DIMO"
];


/*
   Базовые веса исходной модели.
*/

export var PILLAR_WEIGHTS = {
  HARM: 0.32,
  MISC: 0.26,
  ANGU: 0.22,
  DIMO: 0.20
};


/*
   Raw-score → 0..10 normalization.

   score10 =
     ((raw - worst) / (max - worst)) * 10
*/

export var PILLAR_NORMALIZATION = {

  HARM: {
    max: 389.74,
    worst: -409.92
  },

  MISC: {
    max: 1031,
    worst: -460
  },

  ANGU: {
    max: 149.83,
    worst: 19.03
  },

  DIMO: {
    max: 120,
    worst: -67.44
  }

};


/* ============================================================
   6. DYNAMIC PENALTY FACTORS
   ============================================================

   Формула:

   score >= 7.5 → 1.05
   score >= 7.0 → 1.10
   score >= 6.5 → 1.25
   score >= 6.0 → 1.45
   score >= 5.5 → 1.70
   score >= 5.0 → 2.00
   score >= 4.5 → 2.35
   score >= 4.0 → 2.75
   score >= 3.5 → 2.20
   score >= 3.0 → 2.70
   score >= 2.5 → 3.25
   score < 2.5  → 3.85

   ВАЖНО:
   Это именно порядок исходной модели.
   math-core.js должен выбирать ПЕРВЫЙ подходящий
   threshold сверху вниз.
*/

export var PENALTY_FACTORS = [
  { min: 7.5, factor: 1.05 },
  { min: 7.0, factor: 1.10 },
  { min: 6.5, factor: 1.25 },
  { min: 6.0, factor: 1.45 },
  { min: 5.5, factor: 1.70 },
  { min: 5.0, factor: 2.00 },
  { min: 4.5, factor: 2.35 },
  { min: 4.0, factor: 2.75 },
  { min: 3.5, factor: 2.20 },
  { min: 3.0, factor: 2.70 },
  { min: 2.5, factor: 3.25 },
  { min: -Infinity, factor: 3.85 }
];


/* ============================================================
   7. HARMONY PILLAR
   ============================================================

   Exact coefficients from the professional reference.

   Tier indexes:
     0 = T1
     1 = T2
     2 = T3
     3 = T4
     4 = T5
     5 = T6

   T7 is currently unused for these HARM metrics.
*/

export var HARM_METRICS = [

  {
    id: "jawWidth",
    name: "Jaw Width",
    tiers: [20.59, 18.53, 10.29, 6.18, -18.53, -46.32],
    ideal: "87.5–91.5% bigonial width relative to cheekbones"
  },

  {
    id: "eyeEyebrowDistance",
    name: "Eye to Eyebrow Distance / Eyebrow Setness",
    tiers: [19.83, 17.84, 9.91, 5.95, -5.95, -11.90],
    ideal: "Brows close to eyes without drooping"
  },

  {
    id: "browRidgeInclination",
    name: "Brow Ridge Inclination Angle",
    tiers: [19.83, 17.84, 9.91, 5.96, -5.96, -11.90],
    ideal: "Smooth but defined brow ridge"
  },

  {
    id: "facialThirds",
    name: "Facial Thirds",
    tiers: [19.83, 17.84, 9.91, 5.95, -5.95, -11.90],
    ideal: "Upper 30–32%, middle 31.4–33.4%, lower 33.9–37.0%"
  },

  {
    id: "nasofrontalAngle",
    name: "Nasofrontal Angle",
    tiers: [19.06, 17.16, 9.53, 5.72, -5.72, -34.31],
    ideal: "116–128°"
  },

  {
    id: "neckWidth",
    name: "Neck Width",
    tiers: [19.06, 17.16, 9.53, 5.72, -17.16, -34.31],
    ideal: "92–98% relative to bigonial width"
  },

  {
    id: "lowerThirdProportion",
    name: "Lower Third Proportion",
    tiers: [18.30, 16.47, 9.15, 5.49, -5.49, -10.98],
    ideal: "Lower third ≈ 34–37% of total face height"
  },

  {
    id: "fwhr",
    name: "FWHR",
    tiers: [18.30, 16.47, 9.15, 5.49, -16.47, -49.41],
    ideal: "1.95–2.05"
  },

  {
    id: "eyeAspectRatio",
    name: "Eye Aspect Ratio",
    tiers: [18.30, 16.47, 9.15, 5.49, -5.49, -10.98],
    ideal: "3–3.7x"
  },

  {
    id: "gonialAngle",
    name: "Gonial Angle",
    tiers: [16.78, 15.10, 8.39, 5.03, -10.07, -20.13],
    ideal: "≈115–121°"
  },

  {
    id: "ramusLength",
    name: "Ramus Length",
    tiers: [14.41, 14.41, 8.01, 5.80, -10.59, -20.13],
    ideal: "Long ramus with strong vertical jaw height"
  },

  {
    id: "thirdsOfJaw",
    name: "Thirds of Jaw",
    tiers: [17.54, 15.78, 8.77, 6.48, -3.89, -23.35],
    ideal: "Symmetric vertical jaw thirds"
  },

  {
    id: "chinPhiltrum",
    name: "Chin to Philtrum Ratio",
    tiers: [12.96, 11.67, 6.48, 3.89, -1.95, -3.89],
    ideal: "2.1–2.5"
  },

  {
    id: "lateralCanthalTilt",
    name: "Lateral Canthal Tilt",
    tiers: [12.35, 11.12, 6.18, 3.71, -3.71, -7.40],
    ideal: "6–8° positive"
  },

  {
    id: "mouthNose",
    name: "Mouth to Nose Ratio",
    tiers: [12.35, 11.12, 6.18, 3.71, -3.71, -7.40],
    ideal: "1.4–1.6x"
  },

  {
    id: "eyeSeparation",
    name: "Eye Separation / ESR",
    tiers: [12.20, 10.98, 6.59, 3.66, -10.98, -65.88],
    ideal: "45–47% of bizygomatic width"
  },

  {
    id: "midfaceRatio",
    name: "Midface Ratio",
    tiers: [11.90, 10.71, 5.95, 3.57, -3.57, -7.14],
    ideal: "0.98–1.02"
  },

  {
    id: "jawFrontalAngle",
    name: "Jaw Frontal Angle",
    tiers: [9.15, 8.24, 4.58, 2.75, -4.58, -9.15],
    ideal: "86.5–92.5°"
  },

  {
    id: "cheekboneSetness",
    name: "Cheekbone Setness",
    tiers: [20.00, 10.00, 5.00, 2.50, 0.00, -2.50],
    ideal: "High, laterally projecting zygos with visible ogee curve"
  },

  {
    id: "faceLength",
    name: "Face Length",
    tiers: [20.00, 10.00, 5.00, 2.50, 0.00, -2.50],
    ideal: "1.33–1.37x"
  },

  {
    id: "bizygomaticWidth",
    name: "Bizygomatic Width",
    tiers: [20.00, 10.00, 5.00, 2.50, 0.00, -2.50],
    ideal: "Wide and proportional relative to the rest of the face"
  },

  {
    id: "noseToBizygomatic",
    name: "Nose to Bizygomatic Ratio",
    tiers: [7.00, 3.75, 1.88, 0.94, 0.00, -0.94],
    ideal: "Nose width ≈20% of cheekbone width"
  },

  {
    id: "eyebrowTilt",
    name: "Eyebrow Tilt",
    tiers: [10.00, 5.00, 2.50, 0.00, -2.50, -5.00],
    ideal: "6.5–11°"
  },

  {
    id: "medialCanthalAngle",
    name: "Medial Canthal Angle",
    tiers: [7.50, 3.75, 1.88, 0.00, -1.88, -3.75],
    ideal: "Symmetric medial canthi"
  },

  {
    id: "bitemporalWidth",
    name: "Bitemporal Width",
    tiers: [7.50, 3.75, 1.88, 0.00, -1.88, -3.75],
    ideal: "85–92% of bizygomatic width"
  },

  {
    id: "lowerThirdNostrilCommissure",
    name: "Lower Third Proportion / Nostril-Commissure",
    tiers: [2.50, 2.50, 1.25, 0.00, -1.25, -2.50],
    ideal: "31–33.5% of total lower-third height"
  }

];


/* ============================================================
   8. LEGACY METRIC TABLE
   ============================================================

   Оставляем интерфейс старого math-core.js.

   ВАЖНО:
   Эта таблица НЕ является новой профессиональной итоговой
   формулой. Она нужна только для того, чтобы после замены
   config.js приложение не сломалось до следующего этапа.

   В следующем файле math-core.js она будет заменена/связана
   с HARM_METRICS и четырьмя pillars.
*/

export var METRIC_TABLE = [

  {
    name: "Eye separation",
    cat: "👁 Глаза",
    lo: 0.43,
    hi: 0.47,
    w: 12.20,
    u: "",
    pts: [12.20, 10.98, 6.59, 3.66, -10.98]
  },

  {
    name: "Canthal tilt",
    cat: "👁 Глаза",
    lo: 5,
    hi: 8.5,
    w: 12.35,
    u: "°",
    pts: [12.35, 11.12, 6.18, 3.71, -3.71]
  },

  {
    name: "Eye spacing",
    cat: "👁 Глаза",
    lo: 0.93,
    hi: 1.04,
    w: 10,
    u: "",
    pts: [10, 9, 5, 3, -3]
  },

  {
    name: "Eye aspect",
    cat: "👁 Глаза",
    lo: 3.0,
    hi: 3.7,
    w: 18.30,
    u: "",
    pts: [18.30, 16.47, 9.15, 5.49, -5.49]
  },

  {
    name: "Eyebrow tilt",
    cat: "👁 Глаза",
    lo: 6.5,
    hi: 11,
    w: 10,
    u: "°",
    pts: [10, 5, 2.5, 0, -2.5]
  },

  {
    name: "Eyebrow setness",
    cat: "👁 Глаза",
    lo: 0.5,
    hi: 0.9,
    w: 19.83,
    u: "",
    pts: [19.83, 17.84, 9.91, 5.95, -5.95]
  },

  {
    name: "Orbital vector",
    cat: "👁 Глаза",
    lo: 0.5,
    hi: 1.5,
    w: 7.5,
    u: "",
    pts: [7.5, 6.75, 3.75, 2.25, -2.25]
  },

  {
    name: "Upper third",
    cat: "📐 Пропорции",
    lo: 0.30,
    hi: 0.36,
    w: 6.61,
    u: "",
    pts: [6.61, 5.95, 3.31, 1.98, -1.98]
  },

  {
    name: "Middle third",
    cat: "📐 Пропорции",
    lo: 0.314,
    hi: 0.334,
    w: 19.83,
    u: "",
    pts: [19.83, 17.84, 9.91, 5.95, -5.95]
  },

  {
    name: "Lower third",
    cat: "📐 Пропорции",
    lo: 0.339,
    hi: 0.370,
    w: 18.30,
    u: "",
    pts: [18.30, 16.47, 9.15, 5.49, -5.49]
  },

  {
    name: "FWHR",
    cat: "📐 Пропорции",
    lo: 1.95,
    hi: 2.05,
    w: 18.30,
    u: "",
    pts: [18.30, 16.47, 9.15, 5.49, -16.47]
  },

  {
    name: "Total face H/W",
    cat: "📐 Пропорции",
    lo: 1.33,
    hi: 1.37,
    w: 20,
    u: "",
    pts: [20, 10, 5, 2.5, 0]
  },

  {
    name: "Bitemporal",
    cat: "📐 Пропорции",
    lo: 0.85,
    hi: 0.92,
    w: 7.5,
    u: "",
    pts: [7.5, 3.75, 1.88, 0, -1.88]
  },

  {
    name: "Bigonial/Bizygomatic",
    cat: "🦴 Челюсть",
    lo: 0.875,
    hi: 0.915,
    w: 20.59,
    u: "",
    pts: [20.59, 18.53, 10.29, 6.18, -18.53]
  },

  {
    name: "Cheekbone setness",
    cat: "🦴 Челюсть",
    lo: 0,
    hi: 1,
    w: 20,
    u: "",
    pts: [20, 10, 5, 2.5, 0]
  },

  {
    name: "Jaw frontal angle",
    cat: "🦴 Челюсть",
    lo: 86.5,
    hi: 92.5,
    w: 9.15,
    u: "°",
    pts: [9.15, 8.24, 4.58, 2.75, -4.58]
  },

  {
    name: "Jawline def",
    cat: "🦴 Челюсть",
    lo: 160,
    hi: 178,
    w: 8,
    u: "°",
    pts: [8, 7.2, 4, 2.4, -2.4]
  },

  {
    name: "Temple/Jaw taper",
    cat: "🦴 Челюсть",
    lo: 1.15,
    hi: 1.30,
    w: 6,
    u: "",
    pts: [6, 5.4, 3, 1.8, -1.8]
  },

  {
    name: "Neck width %",
    cat: "🦴 Челюсть",
    lo: 0.92,
    hi: 0.98,
    w: 19.06,
    u: "",
    pts: [19.06, 17.16, 9.53, 5.72, -17.16]
  },

  {
    name: "Chin/Philtrum",
    cat: "👄 Рот",
    lo: 2.1,
    hi: 2.5,
    w: 12.96,
    u: "",
    pts: [12.96, 11.67, 6.48, 3.89, -1.95]
  },

  {
    name: "Mouth/Nose",
    cat: "👄 Рот",
    lo: 1.4,
    hi: 1.6,
    w: 12.35,
    u: "",
    pts: [12.35, 11.12, 6.18, 3.71, -3.71]
  },

  {
    name: "Lower/upper lip",
    cat: "👄 Рот",
    lo: 1.0,
    hi: 2.0,
    w: 7.5,
    u: "",
    pts: [7.5, 6.75, 3.75, 2.25, -2.25]
  },

  {
    name: "Nasal height/width",
    cat: "👃 Нос",
    lo: 0.62,
    hi: 0.88,
    w: 5,
    u: "",
    pts: [5, 4.5, 2.5, 1.5, -1.5]
  },

  {
    name: "Ipsilateral alar angle",
    cat: "👃 Нос",
    lo: 84,
    hi: 95,
    w: 2.5,
    u: "°",
    pts: [2.5, 2.25, 1.25, 0.75, -0.75]
  },

  {
    name: "IAA-JFA deviation",
    cat: "👃 Нос",
    lo: -2.5,
    hi: 2.5,
    w: 7,
    u: "°",
    pts: [7, 6.3, 3.5, 2.1, -2.1]
  },

  {
    name: "Symmetry",
    cat: "🪞 Симметрия",
    lo: 0.90,
    hi: 1.00,
    w: 100,
    u: "",
    pts: [100, 70, 50, 30, 10]
  }

];


/* ============================================================
   9. CATEGORIES
   ============================================================ */

export var CATS = [
  "👁 Глаза",
  "📐 Пропорции",
  "🦴 Челюсть",
  "👄 Рот",
  "👃 Нос",
  "🪞 Симметрия"
];


/*
   Старые UI-веса.

   НЕ использовать для professional final score.
*/

export var CATW = {
  "👁 Глаза": 0.22,
  "📐 Пропорции": 0.24,
  "🦴 Челюсть": 0.22,
  "👄 Рот": 0.12,
  "👃 Нос": 0.10,
  "🪞 Симметрия": 0.10
};


/* ============================================================
   10. AXES — UI ONLY
   ============================================================ */

export var AXES = {

  "Гармония": [
    "Eye separation",
    "Total face H/W",
    "Upper third",
    "Middle third",
    "Lower third"
  ],

  "Угловатость": [
    "Bigonial/Bizygomatic",
    "Jaw frontal angle",
    "Jawline def",
    "Temple/Jaw taper"
  ],

  "Диморфизм": [
    "Bigonial/Bizygomatic",
    "Jaw frontal angle",
    "Neck width %",
    "Eyebrow tilt"
  ],

  "Фичи": [
    "Canthal tilt",
    "Eye aspect",
    "Nasal height/width",
    "Lower/upper lip",
    "Mouth/Nose",
    "Eye spacing"
  ]

};


/* ============================================================
   11. QUALITY / CONFIDENCE
   ============================================================

   Confidence НЕ изменяет attractiveness score.

   Это отдельная оценка качества входной фотографии.
*/

export var QUALITY_THRESHOLDS = {

  minFaceFrac: 0.50,

  maxRoll: 6,
  maxYaw: 8,
  maxPitch: 8,

  rollPenaltyPerDeg: 3,
  yawPenaltyPerDeg: 2,
  pitchPenaltyPerDeg: 2,

  faceFracPenalty: 15,

  minConfidence: 40,
  maxConfidence: 100

};


/* ============================================================
   12. EDITOR CONFIG
   ============================================================ */

export var EDITOR_CONFIG = {

  minZoom: 0.05,
  maxZoom: 30,
  zoomStep: 1.3,

  pointRadius: 4,

  crosshairSize: 16,

  loupeSize: 110,
  loupeZoomFactor: 0.14,

  guideWidth: 100,
  guideHeight: 126,

  pulseSpeed: 6,
  pulseAmplitude: 3,

  guidePulseBase: 3,
  guidePulseAmp: 1.2

};


/* ============================================================
   13. RESULT UI CONFIG
   ============================================================ */

export var RESULT_CONFIG = {

  strongCount: 3,
  weakCount: 3,

  gaugeSigmaMultiplier: 3,

  animationDelayStep: 0.04

};


/* ============================================================
   14. SYMMETRY PAIRS
   ============================================================ */

export var SYMMETRY_PAIRS = [

  ["eyeRo", "eyeLo"],
  ["eyeRi", "eyeLi"],
  ["eyeRc", "eyeLc"],

  ["browRp", "browLp"],

  ["noseR", "noseL"],

  ["mouR", "mouL"],

  ["zygR", "zygL"],

  ["gonR", "gonL"],

  ["holR", "holL"],

  ["tempR", "tempL"],

  ["chinR", "chinL"]

];


/* ============================================================
   15. METRIC SEGMENTS
   ============================================================ */

export var METRIC_SEGMENTS = {

  "Eye separation": [
    ["eyeRc", "eyeLc"]
  ],

  "Canthal tilt": [
    ["eyeRo", "eyeRi"],
    ["eyeLo", "eyeLi"]
  ],

  "Eye spacing": [
    ["eyeRi", "eyeLi"]
  ],

  "Eye aspect": [
    ["eyeRo", "eyeRi"],
    ["eyeRu", "eyeRl"],
    ["eyeLo", "eyeLi"],
    ["eyeLu", "eyeLl"]
  ],

  "Eyebrow tilt": [
    ["browRi", "browRo"],
    ["browLi", "browLo"]
  ],

  "Eyebrow setness": [
    ["eyeRc", "browRp"],
    ["eyeLc", "browLp"]
  ],

  "Orbital vector": [
    ["eyeRl", "zygR"],
    ["eyeLl", "zygL"]
  ],

  "Upper third": [
    ["hair", "nas"]
  ],

  "Middle third": [
    ["nas", "sub"]
  ],

  "Lower third": [
    ["sub", "chin"]
  ],

  "FWHR": [
    ["bizR", "bizL"],
    ["nas", "lt"]
  ],

  "Total face H/W": [
    ["hair", "chin"],
    ["bizR", "bizL"]
  ],

  "Bitemporal": [
    ["tempR", "tempL"]
  ],

  "Bigonial/Bizygomatic": [
    ["gonR", "gonL"],
    ["bizR", "bizL"]
  ],

  "Cheekbone setness": [
    ["zygR", "zygL"],
    ["bizR", "bizL"]
  ],

  "Jaw frontal angle": [
    ["gonR", "chin"],
    ["gonL", "chin"]
  ],

  "Jawline def": [
    ["gonR", "jawMidR"],
    ["jawMidR", "jawLowR"],
    ["gonL", "jawMidL"],
    ["jawMidL", "jawLowL"]
  ],

  "Temple/Jaw taper": [
    ["tempR", "tempL"],
    ["gonR", "gonL"]
  ],

  "Neck width %": [
    ["neckR", "neckL"],
    ["gonR", "gonL"]
  ],

  "Chin/Philtrum": [
    ["lb", "chin"],
    ["sub", "lt"]
  ],

  "Mouth/Nose": [
    ["mouR", "mouL"],
    ["noseR", "noseL"]
  ],

  "Lower/upper lip": [
    ["st", "lb"],
    ["lt", "st"]
  ],

  "Nasal height/width": [
    ["noseR", "noseL"],
    ["nas", "ntip"]
  ],

  "Ipsilateral alar angle": [
    ["noseR", "ntip"],
    ["noseL", "ntip"]
  ],

  "IAA-JFA deviation": [
    ["noseR", "ntip"],
    ["gonR", "chin"]
  ],

  "Symmetry": [
    ["hair", "chin"]
  ]

};


/* ============================================================
   16. LOOKSMAX DISPLAY LABELS
   ============================================================

   Это ТОЛЬКО UI labels.

   Они не являются частью professional 0–10 formula.
*/

export var LOOKSMAX_SCALE = [

  { min: 80, label: "CHAD" },
  { min: 70, label: "CHADLITE" },
  { min: 60, label: "HTN" },
  { min: 50, label: "MTN" },
  { min: 45, label: "LTN" },
  { min: 35, label: "SUB5" },
  { min: 0,  label: "SUB3" }

];


/* ============================================================
   17. LEGACY NORMALIZATION
   ============================================================

   Оставлена только для старого UI/math-core.

   В professional v23 итоговая оценка НЕ должна
   использовать эту линейную нормализацию.
*/

export var NORMALIZATION = {

  a: 0.6711,
  b: 6.38

};


/* ============================================================
   18. PROFESSIONAL OUTPUT SCALE
   ============================================================ */

export var PROFESSIONAL_SCALE = [

  {
    min: 9,
    max: 10,
    label: "Near perfect"
  },

  {
    min: 8,
    max: 9,
    label: "Extremely attractive"
  },

  {
    min: 7,
    max: 8,
    label: "Very attractive"
  },

  {
    min: 6,
    max: 7,
    label: "Noticeably attractive"
  },

  {
    min: 5,
    max: 6,
    label: "Slightly above average"
  },

  {
    min: 4,
    max: 5,
    label: "Below average"
  },

  {
    min: 3,
    max: 4,
    label: "Very unattractive"
  },

  {
    min: 2,
    max: 3,
    label: "Extremely unattractive"
  },

  {
    min: 0,
    max: 2,
    label: "Unbelievably unattractive"
  }

];
