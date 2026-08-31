/* ============================================================
   LUX FACE BOT — config.js
   Единственный источник данных: точки, метрики, тиры, веса.
   Никакой логики. Только константы и конфигурация.
   Версия: v17-tier (Looksmax.org March 2026)
   ============================================================ */

/* ---------- 46 ТОЧЕК ---------- */
/* Формат: [id, имя_рус, описание_рус, guide_x, guide_y] */
/* guide_x и guide_y — нормализованные координаты (0..1) для рисования гайда */

export var POINTS = [
  ["hair",      "Линия роста волос",       "Середина лба, где начинаются волосы",           0.50, 0.06],
  ["nas",       "Назион",                   "Переносица, где нос начинается между глаз",     0.50, 0.42],
  ["sub",       "Субназале",               "Основание носа, стык с верхней губой",          0.50, 0.66],
  ["chin",      "Подбородок",              "Самая нижняя точка подбородка",                 0.50, 0.97],
  ["eyeRo",     "Глаз прав. внешн.",       "Внешний уголок правого глаза",                  0.24, 0.45],
  ["eyeRi",     "Глаз прав. внутр.",       "Внутренний уголок правого глаза",               0.40, 0.45],
  ["eyeRu",     "Прав. верх. веко",        "Середина верхнего века правого",                0.32, 0.43],
  ["eyeRl",     "Прав. ниж. веко",         "Середина нижнего века правого",                 0.32, 0.47],
  ["eyeRc",     "Прав. зрачок",            "Центр зрачка правого глаза",                    0.32, 0.45],
  ["eyeLo",     "Глаз лев. внешн.",        "Внешний уголок левого глаза",                   0.76, 0.45],
  ["eyeLi",     "Глаз лев. внутр.",        "Внутренний уголок левого глаза",                0.60, 0.45],
  ["eyeLu",     "Лев. верх. веко",         "Середина верхнего века левого",                 0.68, 0.43],
  ["eyeLl",     "Лев. ниж. веко",          "Середина нижнего века левого",                  0.68, 0.47],
  ["eyeLc",     "Лев. зрачок",             "Центр зрачка левого глаза",                     0.68, 0.45],
  ["browRi",    "Бровь прав. внутр.",      "Начало правой брови",                           0.36, 0.36],
  ["browRp",    "Бровь прав. пик",         "Верх правой брови",                             0.32, 0.34],
  ["browRo",    "Бровь прав. внешн.",      "Хвост правой брови",                            0.22, 0.36],
  ["browLi",    "Бровь лев. внутр.",       "Начало левой брови",                            0.64, 0.36],
  ["browLp",    "Бровь лев. пик",          "Верх левой брови",                              0.68, 0.34],
  ["browLo",    "Бровь лев. внешн.",       "Хвост левой брови",                             0.78, 0.36],
  ["bizR",      "Ширина прав.",            "Максимум ширины лица справа",                   0.13, 0.50],
  ["bizL",      "Ширина лев.",             "Максимум ширины лица слева",                    0.87, 0.50],
  ["tempR",     "Висок прав.",             "Край лба у виска справа",                       0.16, 0.32],
  ["tempL",     "Висок лев.",              "Край лба у виска слева",                        0.84, 0.32],
  ["noseR",     "Крыло прав.",             "Внешний край правой ноздри",                    0.42, 0.62],
  ["noseL",     "Крыло лев.",              "Внешний край левой ноздри",                     0.58, 0.62],
  ["ntip",      "Кончик носа",             "Выступающая точка носа",                        0.50, 0.60],
  ["lt",        "Верхняя губа",            "Лук Купидона",                                  0.50, 0.73],
  ["st",        "Линия губ",               "Стык губ по центру",                            0.50, 0.76],
  ["lb",        "Низ нижней губы",         "Нижний край нижней губы",                       0.50, 0.80],
  ["mouR",      "Рот прав. уголок",        "Правый уголок губ",                             0.34, 0.76],
  ["mouL",      "Рот лев. уголок",         "Левый уголок губ",                              0.66, 0.76],
  ["gonR",      "Угол челюсти прав.",      "Нижний угол челюсти справа",                    0.24, 0.80],
  ["gonL",      "Угол челюсти лев.",       "Нижний угол челюсти слева",                     0.76, 0.80],
  ["jawMidR",   "Челюсть сред прав.",      "Середина дуги справа",                          0.32, 0.89],
  ["jawMidL",   "Челюсть сред лев.",       "Середина дуги слева",                           0.68, 0.89],
  ["jawLowR",   "Челюсть низ прав.",       "Низ дуги справа",                               0.41, 0.94],
  ["jawLowL",   "Челюсть низ лев.",        "Низ дуги слева",                                0.59, 0.94],
  ["zygR",      "Скула прав.",             "Выступающая точка правой скулы",                0.18, 0.57],
  ["zygL",      "Скула лев.",              "Выступающая точка левой скулы",                 0.82, 0.57],
  ["holR",      "Впадина прав.",           "Щёчная впадина справа",                         0.30, 0.70],
  ["holL",      "Впадина лев.",            "Щёчная впадина слева",                          0.70, 0.70],
  ["neckR",     "Шея прав.",               "Правый край шеи",                               0.32, 1.00],
  ["neckL",     "Шея лев.",                "Левый край шеи",                                0.68, 1.00],
  ["chinR",     "Подбородок прав.",        "Правый край подбородка",                        0.44, 0.95],
  ["chinL",     "Подбородок лев.",         "Левый край подбородка",                         0.56, 0.95]
];

/* ---------- СХЕМА ДЛЯ ГАЙДА ---------- */
/* Автоматически генерируется из POINTS. Используется в editor-engine.js */

export var SCH = {};
for (var _i = 0; _i < POINTS.length; _i++) {
  SCH[POINTS[_i][0]] = { x: POINTS[_i][3], y: POINTS[_i][4] };
}

/* ---------- TIER-КОЭФФИЦИЕНТЫ (Looksmax.org) ---------- */
/* Индекс = уровень отклонения. 0 = идеал, 6 = экстремум */

export var TIER_COEFF = [1.00, 0.90, 0.75, 0.60, 0.40, 0.20, 0.0];

/* ---------- ПОРОГИ ТИРОВ (множители halfRange) ---------- */
/* deviation <= halfRange * TIER_THRESHOLDS[i] → TIER_COEFF[i] */

export var TIER_THRESHOLDS = [0.25, 0.50, 1.00, 1.50, 2.00, 3.00, Infinity];

/* ---------- 28 МЕТРИК (таблица Looksmax.org, март 2026) ---------- */
/* Формат: {name, cat, lo, hi, w, u} */
/* lo/hi — идеальный диапазон. w — вес из гайда. u — единица измерения */

export var METRIC_TABLE = [
  { name: "Eye separation",        cat: "👁 Глаза",       lo: 0.45,  hi: 0.47,  w: 35,   u: ""  },
  { name: "Canthal tilt",          cat: "👁 Глаза",       lo: 5,     hi: 8.5,   w: 30,   u: "°" },
  { name: "Eye spacing",           cat: "👁 Глаза",       lo: 0.93,  hi: 1.04,  w: 10,   u: ""  },
  { name: "Eye aspect",            cat: "👁 Глаза",       lo: 3.0,   hi: 3.7,   w: 10,   u: ""  },
  { name: "Eyebrow tilt",          cat: "👁 Глаза",       lo: 5,     hi: 13,    w: 5,    u: "°" },
  { name: "Eyebrow setness",       cat: "👁 Глаза",       lo: 0,     hi: 0.5,   w: 10,   u: ""  },
  { name: "Orbital vector",        cat: "👁 Глаза",       lo: 0.5,   hi: 1.5,   w: 7.5,  u: ""  },
  { name: "Upper third",           cat: "📐 Пропорции",   lo: 0.30,  hi: 0.36,  w: 30,   u: ""  },
  { name: "FWHR",                  cat: "📐 Пропорции",   lo: 1.90,  hi: 2.06,  w: 25,   u: ""  },
  { name: "Total face H/W",        cat: "📐 Пропорции",   lo: 1.30,  hi: 1.40,  w: 15,   u: ""  },
  { name: "Middle third",          cat: "📐 Пропорции",   lo: 0.32,  hi: 0.38,  w: 12,   u: ""  },
  { name: "Lower third",           cat: "📐 Пропорции",   lo: 0.30,  hi: 0.36,  w: 12,   u: ""  },
  { name: "Bitemporal",            cat: "📐 Пропорции",   lo: 0.89,  hi: 1.00,  w: 5,    u: ""  },
  { name: "Lower third proportion",cat: "📐 Пропорции",   lo: 0.33,  hi: 0.40,  w: 5,    u: ""  },
  { name: "Cheekbone setness",     cat: "🦴 Челюсть",     lo: 0.81,  hi: 1.00,  w: 25,   u: ""  },
  { name: "Jaw frontal angle",     cat: "🦴 Челюсть",     lo: 82,    hi: 94,    w: 25,   u: "°" },
  { name: "Bigonial/Bizygomatic",  cat: "🦴 Челюсть",     lo: 0.88,  hi: 1.00,  w: 15,   u: ""  },
  { name: "Jawline def",           cat: "🦴 Челюсть",     lo: 160,   hi: 178,   w: 8,    u: "°" },
  { name: "Temple/Jaw taper",      cat: "🦴 Челюсть",     lo: 1.15,  hi: 1.30,  w: 6,    u: ""  },
  { name: "Neck width %",          cat: "🦴 Челюсть",     lo: 0.90,  hi: 1.00,  w: 6,    u: ""  },
  { name: "Chin/Philtrum",         cat: "👄 Рот",         lo: 2.0,   hi: 2.5,   w: 12.5, u: ""  },
  { name: "Mouth/Nose",            cat: "👄 Рот",         lo: 1.40,  hi: 1.60,  w: 10,   u: ""  },
  { name: "Lower/upper lip",       cat: "👄 Рот",         lo: 0.33,  hi: 0.40,  w: 7.5,  u: ""  },
  { name: "Midface ratio",         cat: "👃 Нос",         lo: 0.90,  hi: 1.10,  w: 10,   u: ""  },
  { name: "Nasal height/width",    cat: "👃 Нос",         lo: 0.62,  hi: 0.88,  w: 5,    u: ""  },
  { name: "Ipsilateral alar angle",cat: "👃 Нос",         lo: 84,    hi: 95,    w: 2.5,  u: "°" },
  { name: "IAA-JFA deviation",     cat: "👃 Нос",         lo: -2.5,  hi: 2.5,   w: 7,    u: "°" },
  { name: "Symmetry",              cat: "🪞 Симметрия",   lo: 0.90,  hi: 1.00,  w: 20,   u: ""  }
];

/* ---------- ВЕСА КАТЕГОРИЙ (для геометрического среднего) ---------- */
/* Сумма не обязана быть 1.0 — wpmean нормализует */

export var CATW = {
  "👁 Глаза":       0.22,
  "📐 Пропорции":   0.24,
  "🦴 Челюсть":     0.22,
  "👄 Рот":         0.12,
  "👃 Нос":         0.10,
  "🪞 Симметрия":   0.10
};

/* ---------- ПОРЯДОК КАТЕГОРИЙ (для отображения) ---------- */

export var CATS = [
  "👁 Глаза",
  "📐 Пропорции",
  "🦴 Челюсть",
  "👄 Рот",
  "👃 Нос",
  "🪞 Симметрия"
];

/* ---------- 4 ПРОФИЛЯ (оси для превью) ---------- */
/* Каждый профиль — набор имён метрик. Среднее арифметическое их скоров */

export var AXES = {
  "Гармония": [
    "Eye separation",
    "Total face H/W",
    "Upper third",
    "Middle third",
    "Lower third",
    "Symmetry",
    "Midface ratio"
  ],
  "Угловатость": [
    "Bigonial/Bizygomatic",
    "Jaw frontal angle",
    "Jawline def",
    "Cheekbone setness",
    "Temple/Jaw taper"
  ],
  "Диморфизм": [
    "Bigonial/Bizygomatic",
    "Jaw frontal angle",
    "Neck width %",
    "Eyebrow tilt",
    "Temple/Jaw taper"
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

/* ---------- ПАРАМЕТРЫ КАЧЕСТВА (для confidence) ---------- */
/* Конфиденс НЕ влияет на балл. Только показывает доверие */

export var QUALITY_THRESHOLDS = {
  minFaceFrac: 0.5,
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

/* ---------- НАСТРОЙКИ РЕДАКТОРА ---------- */

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

/* ---------- НАСТРОЙКИ ОТОБРАЖЕНИЯ РЕЗУЛЬТАТОВ ---------- */

export var RESULT_CONFIG = {
  strongCount: 3,
  weakCount: 3,
  gaugeSigmaMultiplier: 3,
  animationDelayStep: 0.04
};

/* ---------- ПАРЫ ДЛЯ СИММЕТРИИ ---------- */
/* 11 пар билатеральных точек */

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

/* ---------- СЕГМЕНТЫ ДЛЯ ВИЗУАЛИЗАЦИИ КАЖДОЙ МЕТРИКИ ---------- */
/* Какие линии рисовать при показе метрики в результате */

export var METRIC_SEGMENTS = {
  "Eye separation":         [["eyeRc", "eyeLc"]],
  "Canthal tilt":           [["eyeRo", "eyeRi"], ["eyeLo", "eyeLi"]],
  "Eye spacing":            [["eyeRi", "eyeLi"]],
  "Eye aspect":             [["eyeRo", "eyeRi"], ["eyeRu", "eyeRl"], ["eyeLo", "eyeLi"], ["eyeLu", "eyeLl"]],
  "Eyebrow tilt":           [["browRi", "browRo"], ["browLi", "browLo"]],
  "Eyebrow setness":        [["eyeRu", "browRp"], ["eyeLu", "browLp"]],
  "Orbital vector":         [["eyeRl", "zygR"], ["eyeLl", "zygL"]],
  "Upper third":            [["hair", "nas"]],
  "FWHR":                   [["bizR", "bizL"], ["nas", "lt"]],
  "Total face H/W":         [["hair", "chin"], ["bizR", "bizL"]],
  "Middle third":           [["nas", "sub"]],
  "Lower third":            [["sub", "chin"]],
  "Bitemporal":             [["tempR", "tempL"]],
  "Lower third proportion": [["sub", "chin"], ["hair", "chin"]],
  "Cheekbone setness":      [["zygR", "zygL"], ["bizR", "bizL"]],
  "Jaw frontal angle":      [["gonR", "chin"], ["gonL", "chin"]],
  "Bigonial/Bizygomatic":   [["gonR", "gonL"], ["bizR", "bizL"]],
  "Jawline def":            [["gonR", "jawMidR"], ["jawMidR", "jawLowR"], ["gonL", "jawMidL"], ["jawMidL", "jawLowL"]],
  "Temple/Jaw taper":       [["tempR", "tempL"], ["gonR", "gonL"]],
  "Neck width %":           [["neckR", "neckL"], ["bizR", "bizL"]],
  "Chin/Philtrum":          [["lb", "chin"], ["sub", "lt"]],
  "Mouth/Nose":             [["mouR", "mouL"], ["noseR", "noseL"]],
  "Lower/upper lip":        [["st", "lb"], ["lt", "st"]],
  "Midface ratio":          [["bizR", "bizL"], ["nas", "st"]],
  "Nasal height/width":     [["noseR", "noseL"], ["nas", "ntip"]],
  "Ipsilateral alar angle": [["noseR", "ntip"], ["noseL", "ntip"]],
  "IAA-JFA deviation":      [["noseR", "ntip"], ["gonR", "chin"]],
  "Symmetry":               [["hair", "chin"]]
};
