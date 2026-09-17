/**
 * ============================================================================
 * HARM MATH ENGINE v2.0
 * Полный математический движок для расчета 30 антропометрических метрик
 * по методологии looksmax.org (HARM Calculator)
 * ============================================================================
 * 
 * Архитектура:
 * 1. LANDMARKS_49 - определения 49 анатомических точек
 * 2. METRICS_DEFINITIONS - 30 метрик с формулами и идеалами
 * 3. CATEGORIES - 4 категории с весами
 * 4. calculateAllMetrics() - основной расчет
 * 5. calculateCategories() - агрегация по категориям
 * 6. calculateHARMFormula() - финальная формула со штрафом
 * 
 * Автор: Luxface App
 * Дата: 2026
 * ============================================================================
 */

// ============================================================================
// ======================== LANDMARKS DEFINITIONS =============================
// ============================================================================

/**
 * 49 анатомических точек лица для антропометрического анализа
 * Порядок точек критически важен для всех формул!
 * 
 * Группировка:
 * 0-8:   Контур лица и подбородок (9 точек)
 * 9-14:  Глаза (6 точек)
 * 15-20: Брови (6 точек)
 * 21-32: Нос (12 точек)
 * 33-42: Губы и рот (10 точек)
 * 43-48: Дополнительные ориентиры (6 точек)
 */
const LANDMARKS_49 = [
    // === ОВАЛ ЛИЦА И ПОДБОРОДОК (0-8) ===
    { id: 0,  name: "Верхняя точка лба (Trichion)",              region: "forehead",    group: "contour" },
    { id: 1,  name: "Левый висок (Temporal L)",                  region: "temple",      group: "contour" },
    { id: 2,  name: "Правый висок (Temporal R)",                 region: "temple",      group: "contour" },
    { id: 3,  name: "Левый угол челюсти (Gonion L)",             region: "jaw",         group: "contour" },
    { id: 4,  name: "Правый угол челюсти (Gonion R)",            region: "jaw",         group: "contour" },
    { id: 5,  name: "Левая скула (Zygion L)",                    region: "cheek",       group: "contour" },
    { id: 6,  name: "Правая скула (Zygion R)",                   region: "cheek",       group: "contour" },
    { id: 7,  name: "Центр подбородка (Menton Center)",          region: "chin",        group: "contour" },
    { id: 8,  name: "Низ подбородка (Gnathion)",                 region: "chin",        group: "contour" },
    
    // === ГЛАЗА (9-14) ===
    { id: 9,  name: "Внутр. угол левого глаза (Medial Canthus L)", region: "eye",       group: "eyes" },
    { id: 10, name: "Внеш. угол левого глаза (Lateral Canthus L)", region: "eye",       group: "eyes" },
    { id: 11, name: "Центр левого зрачка (Pupil L)",             region: "eye",         group: "eyes" },
    { id: 12, name: "Внутр. угол правого глаза (Medial Canthus R)", region: "eye",      group: "eyes" },
    { id: 13, name: "Внеш. угол правого глаза (Lateral Canthus R)", region: "eye",      group: "eyes" },
    { id: 14, name: "Центр правого зрачка (Pupil R)",            region: "eye",         group: "eyes" },
    
    // === БРОВИ (15-20) ===
    { id: 15, name: "Левая бровь (старт / Head)",                region: "brow",        group: "brows" },
    { id: 16, name: "Левая бровь (пик / Peak)",                  region: "brow",        group: "brows" },
    { id: 17, name: "Левая бровь (хвост / Tail)",                region: "brow",        group: "brows" },
    { id: 18, name: "Правая бровь (старт / Head)",               region: "brow",        group: "brows" },
    { id: 19, name: "Правая бровь (пик / Peak)",                 region: "brow",        group: "brows" },
    { id: 20, name: "Правая бровь (хвост / Tail)",               region: "brow",        group: "brows" },
    
    // === НОС (21-32) ===
    { id: 21, name: "Межбровье (Glabella)",                      region: "nose",        group: "nose" },
    { id: 22, name: "Верх переносицы (Nasion)",                  region: "nose",        group: "nose" },
    { id: 23, name: "Кончик носа (Pronasale)",                   region: "nose",        group: "nose" },
    { id: 24, name: "Субназале (Subnasale)",                     region: "nose",        group: "nose" },
    { id: 25, name: "Левое крыло носа (Alar L)",                 region: "nose",        group: "nose" },
    { id: 26, name: "Правое крыло носа (Alar R)",                region: "nose",        group: "nose" },
    { id: 27, name: "Левая ноздря",                              region: "nose",        group: "nose" },
    { id: 28, name: "Правая ноздря",                             region: "nose",        group: "nose" },
    { id: 29, name: "Спинка носа (верх)",                        region: "nose",        group: "nose" },
    { id: 30, name: "Спинка носа (середина)",                    region: "nose",        group: "nose" },
    { id: 31, name: "Колумелла (Columella)",                     region: "nose",        group: "nose" },
    { id: 32, name: "Губной желобок (Philtrum Top)",             region: "nose",        group: "nose" },
    
    // === ГУБЫ И РОТ (33-42) ===
    { id: 33, name: "Верхняя губа (Купидон лево)",               region: "mouth",       group: "lips" },
    { id: 34, name: "Верхняя губа (Купидон право)",              region: "mouth",       group: "lips" },
    { id: 35, name: "Центр верх. губы (низ)",                    region: "mouth",       group: "lips" },
    { id: 36, name: "Левый угол рта (Cheilion L)",               region: "mouth",       group: "lips" },
    { id: 37, name: "Правый угол рта (Cheilion R)",              region: "mouth",       group: "lips" },
    { id: 38, name: "Нижняя губа (верх)",                        region: "mouth",       group: "lips" },
    { id: 39, name: "Нижняя губа (низ)",                         region: "mouth",       group: "lips" },
    { id: 40, name: "Фильтрум (центр)",                          region: "mouth",       group: "lips" },
    { id: 41, name: "Левая подгубная складка",                   region: "mouth",       group: "lips" },
    { id: 42, name: "Правая подгубная складка",                  region: "mouth",       group: "lips" },
    
    // === ДОПОЛНИТЕЛЬНЫЕ ОРИЕНТИРЫ (43-48) ===
    { id: 43, name: "Широкая точка левой скулы (Zygomatic L)",   region: "cheekbone",   group: "extra" },
    { id: 44, name: "Широкая точка правой скулы (Zygomatic R)",  region: "cheekbone",   group: "extra" },
    { id: 45, name: "Граница верхней трети",                     region: "thirds",      group: "extra" },
    { id: 46, name: "Граница средней трети",                     region: "thirds",      group: "extra" },
    { id: 47, name: "Граница нижней трети",                      region: "thirds",      group: "extra" },
    { id: 48, name: "Адамово яблоко / Шея",                      region: "neck",        group: "extra" }
];

// ============================================================================
// ======================== CATEGORIES DEFINITIONS ============================
// ============================================================================

/**
 * 4 категории HARM методологии с весами
 * Веса суммируются в 1.0 (100%)
 */
const CATEGORIES = {
    Harmony: {
        name: "Harmony",
        nameRu: "Гармония",
        icon: "⚖️",
        weight: 0.32,
        description: "Соразмерность и баланс частей лица относительно друг друга. Включает трети лица, пропорции носа к губам, межзрачковое расстояние.",
        color: "#10b981"
    },
    Misc: {
        name: "Miscellaneous",
        nameRu: "Общие пропорции",
        icon: "📏",
        weight: 0.26,
        description: "Базовые метрики высоты и ширины всего лица. FWHR, tFWHR, отступы бровей и другие общие показатели.",
        color: "#3b82f6"
    },
    Angularity: {
        name: "Angularity",
        nameRu: "Угловатость",
        icon: "📐",
        weight: 0.22,
        description: "Оценивает костную структуру: острота челюсти, линии скул, Canthal Tilt, наклон бровей. Маркер маскулинности и графичности.",
        color: "#8b5cf6"
    },
    Dimorphism: {
        name: "Dimorphism",
        nameRu: "Половой диморфизм",
        icon: "👤",
        weight: 0.20,
        description: "Черты характерные для пола: массивная челюсть у мужчин, узкие формы у женщин. Соотношения ширины челюсти к скулам.",
        color: "#f59e0b"
    }
};

// ============================================================================
// ======================== METRICS DEFINITIONS ===============================
// ============================================================================

/**
 * 30 антропометрических метрик с полными параметрами
 * 
 * Структура каждой метрики:
 * - id: уникальный номер (1-30)
 * - name: название метрики
 * - nameRu: русское название
 * - category: принадлежность к категории
 * - ideal: идеальное значение
 * - unit: единица измерения (опционально)
 * - tolerance: допустимое отклонение для T1
 * - formula: тип формулы
 * - points: массив индексов точек для расчета
 * - description: подробное описание
 * - interpretation: что показывает метрика
 */
const METRICS_DEFINITIONS = [
    // =============== HARMONY (8 метрик) ===============
    {
        id: 1,
        name: "FWHR",
        nameRu: "Ширина лица к высоте",
        fullName: "Facial Width-to-Height Ratio",
        category: "Misc",
        ideal: 1.93,
        unit: "",
        tolerance: 0.15,
        formula: "ratio",
        points: [43, 44, 21, 35],
        numerator: "width",
        denominator: "height",
        description: "Отношение ширины лица (между скулами) к высоте средней трети. Ключевой маркер маскулинности.",
        interpretation: "Выше 1.9 = более маскулинное лицо, ниже = более феминное"
    },
    {
        id: 2,
        name: "tFWHR",
        nameRu: "Общая высота лица",
        fullName: "Total Facial Width-to-Height Ratio",
        category: "Misc",
        ideal: 1.33,
        unit: "",
        tolerance: 0.12,
        formula: "ratio",
        points: [43, 44, 0, 8],
        numerator: "width",
        denominator: "total_height",
        description: "Отношение ширины лица к полной высоте от линии роста волос до низа подбородка.",
        interpretation: "Показывает общие пропорции лица"
    },
    {
        id: 3,
        name: "MFR",
        nameRu: "Соотношение средней трети",
        fullName: "Midface Ratio",
        category: "Misc",
        ideal: 1.00,
        unit: "",
        tolerance: 0.10,
        formula: "ratio",
        points: [11, 14, 21, 35],
        numerator: "ipd",
        denominator: "midface_height",
        description: "Отношение межзрачкового расстояния к высоте средней трети лица.",
        interpretation: "Баланс между шириной глаз и длиной средней трети"
    },
    {
        id: 4,
        name: "Jaw Width",
        nameRu: "Ширина челюсти",
        fullName: "Jaw Width to Cheekbone Ratio",
        category: "Dimorphism",
        ideal: 0.86,
        unit: "",
        tolerance: 0.08,
        formula: "ratio",
        points: [3, 4, 43, 44],
        numerator: "jaw_width",
        denominator: "cheekbone_width",
        description: "Отношение ширины челюсти к ширине скул. Маркер маскулинности.",
        interpretation: "Выше = более квадратная, мужская челюсть"
    },
    {
        id: 5,
        name: "Bigonial Width",
        nameRu: "Бигониальная ширина",
        fullName: "Bigonial to Bizygomatic Ratio",
        category: "Dimorphism",
        ideal: 0.82,
        unit: "",
        tolerance: 0.08,
        formula: "ratio",
        points: [3, 4, 43, 44],
        numerator: "bigonial",
        denominator: "bizygomatic",
        description: "Альтернативное измерение ширины нижней челюсти относительно скул.",
        interpretation: "Показатель развитости жевательных мышц"
    },
    {
        id: 6,
        name: "Canthal Tilt",
        nameRu: "Наклон глаз",
        fullName: "Canthal Tilt Angle",
        category: "Angularity",
        ideal: 5.0,
        unit: "°",
        tolerance: 3.0,
        formula: "angle_average",
        points: [9, 10, 12, 13],
        description: "Средний угол наклона линии от внутреннего к внешнему углу глаза. Положительный наклон = «hunter eyes».",
        interpretation: "Положительные значения = привлекательные «охотничьи глаза»"
    },
    {
        id: 7,
        name: "ESR",
        nameRu: "Расстояние между глазами",
        fullName: "Eye Separation Ratio",
        category: "Misc",
        ideal: 44.4,
        unit: "%",
        tolerance: 4.0,
        formula: "percentage",
        points: [11, 14, 43, 44],
        description: "Процентное отношение межзрачкового расстояния к ширине лица.",
        interpretation: "Оптимальное расположение глаз на лице"
    },
    {
        id: 8,
        name: "ES",
        nameRu: "Разделение глаз",
        fullName: "Eye Separation",
        category: "Harmony",
        ideal: 1.0,
        unit: "",
        tolerance: 0.15,
        formula: "ratio",
        points: [9, 12, 9, 10],
        numerator: "eye_separation",
        denominator: "eye_width",
        description: "Отношение расстояния между глазами к ширине одного глаза.",
        interpretation: "Золотое правило: расстояние = ширина глаза"
    },
    {
        id: 9,
        name: "ICD",
        nameRu: "Внутреннее межкантальное",
        fullName: "Inner Canthal Distance",
        category: "Misc",
        ideal: 22.4,
        unit: "%",
        tolerance: 3.0,
        formula: "percentage",
        points: [9, 12, 43, 44],
        description: "Процентное отношение расстояния между внутренними углами глаз к ширине лица.",
        interpretation: "Показывает ширину переносицы"
    },
    {
        id: 10,
        name: "OCD",
        nameRu: "Внешнее межкантальное",
        fullName: "Outer Canthal Distance",
        category: "Misc",
        ideal: 0.628,
        unit: "",
        tolerance: 0.05,
        formula: "ratio",
        points: [10, 13, 43, 44],
        numerator: "outer_canthal",
        denominator: "face_width",
        description: "Отношение расстояния между внешними углами глаз к ширине лица.",
        interpretation: "Общая ширина глазной области"
    },
    {
        id: 11,
        name: "PFL:PHL",
        nameRu: "Форма глаза",
        fullName: "Palpebral Fissure Length to Height",
        category: "Angularity",
        ideal: 2.94,
        unit: "",
        tolerance: 0.30,
        formula: "ratio",
        points: [9, 10, 11],
        numerator: "eye_length",
        denominator: "eye_height",
        description: "Отношение длины глаза к его высоте. Показатель «миндалевидности».",
        interpretation: "Выше = более узкие, «охотничьи» глаза"
    },
    {
        id: 12,
        name: "Lower Third",
        nameRu: "Нижняя треть",
        fullName: "Lower Facial Third",
        category: "Harmony",
        ideal: 36.0,
        unit: "%",
        tolerance: 3.0,
        formula: "percentage",
        points: [24, 8, 0],
        description: "Процент нижней трети лица (от носа до подбородка) от общей высоты.",
        interpretation: "Одна из трех равных частей идеального лица"
    },
    {
        id: 13,
        name: "Cheekbones Height",
        nameRu: "Высота скул",
        fullName: "Cheekbones to Face Height",
        category: "Misc",
        ideal: 0.79,
        unit: "",
        tolerance: 0.08,
        formula: "ratio",
        points: [43, 44],
        description: "Позиционирование скуловых костей относительно общей высоты лица.",
        interpretation: "Высокие скулы = признак привлекательности"
    },
    {
        id: 14,
        name: "Chin to Philtrum",
        nameRu: "Подбородок к фильтруму",
        fullName: "Chin to Philtrum Ratio",
        category: "Harmony",
        ideal: 2.18,
        unit: "",
        tolerance: 0.25,
        formula: "ratio",
        points: [39, 8, 24, 35],
        numerator: "chin_height",
        denominator: "philtrum_height",
        description: "Отношение высоты подбородка к высоте фильтрума (пространство между носом и губой).",
        interpretation: "Баланс нижней части лица"
    },
    {
        id: 15,
        name: "Lip Proportions",
        nameRu: "Пропорции губ",
        fullName: "Upper to Lower Lip Ratio",
        category: "Harmony",
        ideal: 1.29,
        unit: "",
        tolerance: 0.15,
        formula: "ratio",
        points: [32, 35, 38, 39],
        numerator: "upper_lip",
        denominator: "lower_lip",
        description: "Отношение высоты верхней губы к нижней. Идеал по золотому сечению.",
        interpretation: "Верхняя губа должна быть чуть тоньше нижней"
    },
    {
        id: 16,
        name: "Mouth to Nose",
        nameRu: "Рот к носу",
        fullName: "Mouth Width to Nose Width",
        category: "Harmony",
        ideal: 0.69,
        unit: "",
        tolerance: 0.08,
        formula: "ratio",
        points: [25, 26, 36, 37],
        numerator: "nose_width",
        denominator: "mouth_width",
        description: "Отношение ширины носа к ширине рта.",
        interpretation: "Рот должен быть шире носа в ~1.5 раза"
    },
    {
        id: 17,
        name: "Nose to Zygo",
        nameRu: "Нос к скулам",
        fullName: "Nose Width to Cheekbone Width",
        category: "Dimorphism",
        ideal: 0.246,
        unit: "",
        tolerance: 0.03,
        formula: "ratio",
        points: [25, 26, 43, 44],
        numerator: "nose_width",
        denominator: "cheekbone_width",
        description: "Отношение ширины носа к ширине скул.",
        interpretation: "Показатель компактности носа"
    },
    {
        id: 18,
        name: "Nose to ICD",
        nameRu: "Нос к межглазному",
        fullName: "Nose Width to Inner Canthal Distance",
        category: "Dimorphism",
        ideal: 0.91,
        unit: "",
        tolerance: 0.10,
        formula: "ratio",
        points: [9, 12, 25, 26],
        numerator: "eye_distance",
        denominator: "nose_width",
        description: "Отношение межглазного расстояния к ширине носа.",
        interpretation: "Ширина носа должна быть равна расстоянию между глазами"
    },
    {
        id: 19,
        name: "Nose W:H",
        nameRu: "Ширина к высоте носа",
        fullName: "Nose Width to Height Ratio",
        category: "Dimorphism",
        ideal: 0.73,
        unit: "",
        tolerance: 0.08,
        formula: "ratio",
        points: [25, 26, 22, 24],
        numerator: "nose_width",
        denominator: "nose_height",
        description: "Отношение ширины носа к его высоте.",
        interpretation: "Показатель изящности носа"
    },
    {
        id: 20,
        name: "Alar Angle",
        nameRu: "Угол крыльев носа",
        fullName: "Alar Angle",
        category: "Angularity",
        ideal: 95.0,
        unit: "°",
        tolerance: 8.0,
        formula: "angle_triangle",
        points: [25, 23, 26],
        description: "Угол между крыльями носа и кончиком.",
        interpretation: "Показатель формы и ширины носа"
    },
    {
        id: 21,
        name: "EME",
        nameRu: "Глаз-Рот-Глаз",
        fullName: "Eye-Mouth-Eye Angle",
        category: "Angularity",
        ideal: 48.0,
        unit: "°",
        tolerance: 6.0,
        formula: "angle_triangle",
        points: [11, 35, 14],
        description: "Угол треугольника между центрами глаз и ртом.",
        interpretation: "Компактность центральной части лица"
    },
    {
        id: 22,
        name: "Nose to Chin",
        nameRu: "Нос к подбородку",
        fullName: "Nose to Chin Proportion",
        category: "Dimorphism",
        ideal: 0.588,
        unit: "",
        tolerance: 0.06,
        formula: "ratio",
        points: [24, 8],
        description: "Пропорция расстояния от носа до подбородка.",
        interpretation: "Баланс нижней трети"
    },
    {
        id: 23,
        name: "Facial Thirds",
        nameRu: "Трети лица",
        fullName: "Facial Thirds Deviation",
        category: "Harmony",
        ideal: 0.0,
        unit: "%",
        tolerance: 5.0,
        formula: "thirds_deviation",
        points: [0, 21, 24, 8],
        description: "Отклонение от идеального равенства трех частей лица (лоб, нос, рот-подбородок).",
        interpretation: "Три равные части = идеальное лицо"
    },
    {
        id: 24,
        name: "Brow Height",
        nameRu: "Высота бровей",
        fullName: "Brow Height Ratio",
        category: "Misc",
        ideal: 0.314,
        unit: "",
        tolerance: 0.04,
        formula: "ratio",
        points: [11, 16],
        description: "Высота расположения бровей относительно глаз.",
        interpretation: "Оптимальное расположение бровей"
    },
    {
        id: 25,
        name: "Bitemporal Width",
        nameRu: "Битемпоральная ширина",
        fullName: "Bitemporal to Bizygomatic",
        category: "Misc",
        ideal: 0.907,
        unit: "",
        tolerance: 0.08,
        formula: "ratio",
        points: [1, 2, 43, 44],
        numerator: "bitemporal",
        denominator: "bizygomatic",
        description: "Отношение ширины висков к ширине скул.",
        interpretation: "Пропорции верхней части лица"
    },
    {
        id: 26,
        name: "Jaw Frontal Angle",
        nameRu: "Фронтальный угол челюсти",
        fullName: "Jaw Frontal Angle",
        category: "Angularity",
        ideal: 96.0,
        unit: "°",
        tolerance: 10.0,
        formula: "angle_triangle",
        points: [3, 7, 4],
        description: "Угол между углами челюсти и центром подбородка.",
        interpretation: "Показатель четкости линии челюсти"
    },
    {
        id: 27,
        name: "IAA–JFA Dev",
        nameRu: "Отклонение IAA-JFA",
        fullName: "IAA–JFA Deviation",
        category: "Angularity",
        ideal: 0.9,
        unit: "°",
        tolerance: 2.0,
        formula: "angle_difference",
        points: [25, 23, 3, 7],
        description: "Разница между углами крыльев носа и челюсти.",
        interpretation: "Гармония углов нижней части лица"
    },
    {
        id: 28,
        name: "Eyebrows Tilt",
        nameRu: "Наклон бровей",
        fullName: "Eyebrows Tilt Angle",
        category: "Angularity",
        ideal: 8.2,
        unit: "°",
        tolerance: 4.0,
        formula: "angle_average_brows",
        points: [15, 17, 18, 20],
        description: "Средний угол наклона бровей.",
        interpretation: "Положительный наклон = более выразительный взгляд"
    },
    {
        id: 29,
        name: "Neck Width",
        nameRu: "Ширина шеи",
        fullName: "Neck Width Proportion",
        category: "Dimorphism",
        ideal: 0.92,
        unit: "",
        tolerance: 0.10,
        formula: "static_value",
        points: [48],
        description: "Пропорция ширины шеи (требует дополнительного измерения).",
        interpretation: "Маркер физического развития"
    },
    {
        id: 30,
        name: "Medial Canthal",
        nameRu: "Медиальный угол глаза",
        fullName: "Medial Canthal Angle",
        category: "Dimorphism",
        ideal: 45.0,
        unit: "°",
        tolerance: 8.0,
        formula: "static_value",
        points: [9],
        description: "Угол внутреннего угла глаза.",
        interpretation: "Форма слезного канала"
    }
];

// ============================================================================
// ======================== UTILITY FUNCTIONS =================================
// ============================================================================

/**
 * Вычисляет евклидово расстояние между двумя точками
 * @param {Object} p1 - первая точка {x, y}
 * @param {Object} p2 - вторая точка {x, y}
 * @returns {number} расстояние в пикселях
 */
function dist(p1, p2) {
    if (!p1 || !p2) return 0;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Вычисляет угол между двумя точками относительно горизонтали
 * @param {Object} p1 - начальная точка
 * @param {Object} p2 - конечная точка
 * @returns {number} угол в градусах (-180 to 180)
 */
function angle(p1, p2) {
    if (!p1 || !p2) return 0;
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
}

/**
 * Вычисляет угол в треугольнике (в точке p2)
 * @param {Object} p1 - первая точка
 * @param {Object} p2 - вершина угла
 * @param {Object} p3 - третья точка
 * @returns {number} угол в градусах (0-180)
 */
function angleDeg(p1, p2, p3) {
    if (!p1 || !p2 || !p3) return 0;
    const a = dist(p2, p3);
    const b = dist(p1, p2);
    const c = dist(p1, p3);
    
    // Проверка на валидность треугольника
    if (a === 0 || b === 0 || c === 0) return 0;
    
    const cosValue = (b * b + a * a - c * c) / (2 * b * a);
    // Ограничиваем значение для избежания NaN
    const clampedCos = Math.max(-1, Math.min(1, cosValue));
    const rad = Math.acos(clampedCos);
    return rad * (180 / Math.PI);
}

/**
 * Вычисляет среднее значение массива
 * @param {Array<number>} arr - массив чисел
 * @returns {number} среднее значение
 */
function average(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Вычисляет абсолютное отклонение в процентах
 * @param {number} value - фактическое значение
 * @param {number} ideal - идеальное значение
 * @returns {number} отклонение в процентах
 */
function calculateDeviation(value, ideal) {
    if (ideal === 0) return 0;
    return Math.abs((value - ideal) / ideal) * 100;
}

/**
 * Определяет тир (T1-T5) на основе отклонения
 * @param {number} deviation - отклонение в процентах
 * @returns {string} тир (T1-T5)
 */
function getTier(deviation) {
    if (deviation <= 3) return "T1";
    if (deviation <= 8) return "T2";
    if (deviation <= 14) return "T3";
    if (deviation <= 20) return "T4";
    return "T5";
}

/**
 * Получает числовой балл для тира
 * @param {string} tier - тир (T1-T5)
 * @returns {number} балл (100, 75, 50, 25, 0)
 */
function getTierScore(tier) {
    const scores = {
        "T1": 100,
        "T2": 75,
        "T3": 50,
        "T4": 25,
        "T5": 0
    };
    return scores[tier] || 0;
}

// ============================================================================
// ======================== METRIC CALCULATORS ================================
// ============================================================================

/**
 * Рассчитывает значение метрики по её типу формулы
 * @param {Object} metric - определение метрики
 * @param {Array} pts - массив точек
 * @returns {number} рассчитанное значение
 */
function calculateMetricValue(metric, pts) {
    try {
        // Проверка наличия всех необходимых точек
        const hasAllPoints = metric.points.every(idx => pts[idx] !== undefined);
        if (!hasAllPoints) {
            console.warn(`Missing points for metric ${metric.name}`);
            return metric.ideal; // Возвращаем идеал как fallback
        }

        switch (metric.formula) {
            case "ratio":
                return calculateRatio(metric, pts);
            
            case "percentage":
                return calculatePercentage(metric, pts);
            
            case "angle_average":
                return calculateAngleAverage(metric, pts);
            
            case "angle_triangle":
                return calculateAngleTriangle(metric, pts);
            
            case "angle_difference":
                return calculateAngleDifference(metric, pts);
            
            case "angle_average_brows":
                return calculateAngleAverageBrows(metric, pts);
            
            case "thirds_deviation":
                return calculateThirdsDeviation(metric, pts);
            
            case "static_value":
                return metric.ideal; // Статические значения
            
            default:
                console.warn(`Unknown formula type: ${metric.formula}`);
                return metric.ideal;
        }
    } catch (error) {
        console.error(`Error calculating metric ${metric.name}:`, error);
        return metric.ideal;
    }
}

/**
 * Вычисляет отношение двух длин
 */
function calculateRatio(metric, pts) {
    const [p1, p2, p3, p4] = metric.points.map(i => pts[i]);
    
    switch (metric.numerator) {
        case "width":
            const width = dist(p1, p2);
            const height = dist(p3, p4);
            return height > 0 ? width / height : 0;
        
        case "total_height":
            const w = dist(p1, p2);
            const h = dist(p3, p4);
            return h > 0 ? w / h : 0;
        
        case "ipd":
            const ipd = dist(p1, p2);
            const midH = dist(p3, p4);
            return midH > 0 ? ipd / midH : 0;
        
        case "jaw_width":
        case "bigonial":
            const jaw = dist(p1, p2);
            const cheek = dist(p3, p4);
            return cheek > 0 ? jaw / cheek : 0;
        
        case "eye_separation":
            const eyeSep = dist(p1, p2);
            const eyeW = dist(p3, p4);
            return eyeW > 0 ? eyeSep / eyeW : 0;
        
        case "eye_length":
            const length = dist(p1, p2);
            // Высота глаза - вертикальное расстояние от центра зрачка до края
            const center = p3;
            const height = Math.abs(center.y - p1.y);
            return height > 0 ? length / height : 0;
        
        case "outer_canthal":
            const outer = dist(p1, p2);
            const faceW = dist(p3, p4);
            return faceW > 0 ? outer / faceW : 0;
        
        case "chin_height":
            const chin = dist(p1, p2);
            const phil = dist(p3, p4);
            return phil > 0 ? chin / phil : 0;
        
        case "upper_lip":
            const upper = dist(p1, p2);
            const lower = dist(p3, p4);
            return lower > 0 ? upper / lower : 0;
        
        case "nose_width":
            if (metric.denominator === "mouth_width") {
                const noseW = dist(p1, p2);
                const mouthW = dist(p3, p4);
                return mouthW > 0 ? noseW / mouthW : 0;
            } else if (metric.denominator === "cheekbone_width") {
                const noseW = dist(p1, p2);
                const cheekW = dist(p3, p4);
                return cheekW > 0 ? noseW / cheekW : 0;
            } else if (metric.denominator === "nose_height") {
                const noseW = dist(p1, p2);
                const noseH = dist(p3, p4);
                return noseH > 0 ? noseW / noseH : 0;
            }
            return 0;
        
        case "eye_distance":
            const eyeDist = dist(p1, p2);
            const noseWidth = dist(p3, p4);
            return noseWidth > 0 ? eyeDist / noseWidth : 0;
        
        case "bitemporal":
            const bitemp = dist(p1, p2);
            const bizyg = dist(p3, p4);
            return bizyg > 0 ? bitemp / bizyg : 0;
        
        default:
            return metric.ideal;
    }
}

/**
 * Вычисляет процентное отношение
 */
function calculatePercentage(metric, pts) {
    const [p1, p2, p3, p4] = metric.points.map(i => pts[i]);
    
    if (metric.name === "ESR") {
        const ipd = dist(p1, p2);
        const faceW = dist(p3, p4);
        return faceW > 0 ? (ipd / faceW) * 100 : 0;
    }
    
    if (metric.name === "ICD") {
        const icd = dist(p1, p2);
        const faceW = dist(p3, p4);
        return faceW > 0 ? (icd / faceW) * 100 : 0;
    }
    
    if (metric.name === "Lower Third") {
        const lower = dist(p1, p2);
        const total = dist(p2, p3); // От верхней точки лба
        return total > 0 ? (lower / total) * 100 : 0;
    }
    
    return metric.ideal;
}

/**
 * Вычисляет средний угол (для Canthal Tilt)
 */
function calculateAngleAverage(metric, pts) {
    const [p1, p2, p3, p4] = metric.points.map(i => pts[i]);
    
    // Левый глаз: от внутреннего к внешнему углу
    const leftAngle = angle(p1, p2);
    // Правый глаз: от внешнего к внутреннему углу (инвертируем)
    const rightAngle = angle(p4, p3);
    
    return (leftAngle + rightAngle) / 2;
}

/**
 * Вычисляет угол в треугольнике
 */
function calculateAngleTriangle(metric, pts) {
    const [p1, p2, p3] = metric.points.map(i => pts[i]);
    return angleDeg(p1, p2, p3);
}

/**
 * Вычисляет разницу между двумя углами
 */
function calculateAngleDifference(metric, pts) {
    const [p1, p2, p3, p4] = metric.points.map(i => pts[i]);
    
    // Угол крыльев носа
    const alarAngle = angleDeg(p1, p2, p1); // Упрощенно
    // Угол челюсти
    const jawAngle = angleDeg(p3, p4, p3);
    
    return Math.abs(alarAngle - jawAngle);
}

/**
 * Вычисляет средний наклон бровей
 */
function calculateAngleAverageBrows(metric, pts) {
    const [p1, p2, p3, p4] = metric.points.map(i => pts[i]);
    
    // Левая бровь
    const leftTilt = Math.abs(angle(p1, p2));
    // Правая бровь
    const rightTilt = Math.abs(angle(p4, p3));
    
    return (leftTilt + rightTilt) / 2;
}

/**
 * Вычисляет отклонение третей лица от идеала
 */
function calculateThirdsDeviation(metric, pts) {
    const [p1, p2, p3, p4] = metric.points.map(i => pts[i]);
    
    const upper = dist(p1, p2);    // Верхняя треть
    const middle = dist(p2, p3);   // Средняя треть
    const lower = dist(p3, p4);    // Нижняя треть
    
    const total = upper + middle + lower;
    if (total === 0) return 0;
    
    const avg = total / 3;
    
    // Отклонение каждой трети от среднего в процентах
    const devUpper = Math.abs(upper - avg) / avg * 100;
    const devMiddle = Math.abs(middle - avg) / avg * 100;
    const devLower = Math.abs(lower - avg) / avg * 100;
    
    // Среднее отклонение
    return (devUpper + devMiddle + devLower) / 3;
}

// ============================================================================
// ======================== MAIN CALCULATION FUNCTIONS ========================
// ============================================================================

/**
 * ГЛАВНАЯ ФУНКЦИЯ: Рассчитывает все 30 метрик
 * @param {Array} pts - массив из 49 точек {x, y}
 * @returns {Array} массив объектов с рассчитанными метриками
 */
function calculateAllMetrics(pts) {
    if (!pts || pts.length !== 49) {
        console.error('Invalid points array. Expected 49 points.');
        return [];
    }

    return METRICS_DEFINITIONS.map(metric => {
        // Рассчитываем значение метрики
        const value = calculateMetricValue(metric, pts);
        
        // Вычисляем отклонение от идеала
        const deviation = calculateDeviation(value, metric.ideal);
        
        // Определяем тир
        const tier = getTier(deviation);
        
        // Форматируем отображаемые значения
        const unit = metric.unit || "";
        const displayVal = `${value.toFixed(2)}${unit}`;
        const displayIdeal = `${metric.ideal}${unit}`;
        
        return {
            id: metric.id,
            name: `${metric.id}. ${metric.name}`,
            nameRu: metric.nameRu,
            fullName: metric.fullName,
            category: metric.category,
            val: value,
            ideal: metric.ideal,
            unit: unit,
            dev: deviation.toFixed(1),
            tier: tier,
            tierScore: getTierScore(tier),
            displayVal: displayVal,
            displayIdeal: displayIdeal,
            pts: metric.points,
            description: metric.description,
            interpretation: metric.interpretation
        };
    });
}

/**
 * Агрегирует метрики по категориям
 * @param {Array} metrics - массив рассчитанных метрик
 * @returns {Object} объект с данными по каждой категории
 */
function calculateCategories(metrics) {
    const categories = {};
    
    // Инициализируем все категории
    Object.keys(CATEGORIES).forEach(catKey => {
        categories[catKey] = {
            name: CATEGORIES[catKey].name,
            nameRu: CATEGORIES[catKey].nameRu,
            icon: CATEGORIES[catKey].icon,
            weight: CATEGORIES[catKey].weight,
            description: CATEGORIES[catKey].description,
            color: CATEGORIES[catKey].color,
            metrics: [],
            totalScore: 0,
            score: 0,
            metricCount: 0
        };
    });
    
    // Распределяем метрики по категориям
    metrics.forEach(metric => {
        if (categories[metric.category]) {
            categories[metric.category].metrics.push(metric);
            categories[metric.category].totalScore += metric.tierScore;
            categories[metric.category].metricCount++;
        }
    });
    
    // Вычисляем средний балл для каждой категории
    Object.keys(categories).forEach(catKey => {
        const cat = categories[catKey];
        if (cat.metricCount > 0) {
            cat.score = cat.totalScore / cat.metricCount;
        }
    });
    
    return categories;
}

/**
 * ВЫСШАЯ ФУНКЦИЯ: Применяет полную формулу HARM
 * Включает взвешенное суммирование и штраф за дисбаланс
 * 
 * Формула:
 * W = Σ(CategoryScore × Weight)
 * Spread = Max(Categories) - Min(Categories)
 * Penalty = Spread × 0.5
 * TrueScore = W - Penalty
 * 
 * @param {Object} categories - объект с категориями
 * @returns {Object} финальный результат
 */
function calculateHARMFormula(categories) {
    // 1. Взвешенная сумма (Weighted Sum)
    let weightedSum = 0;
    const categoryScores = [];
    
    Object.keys(categories).forEach(catKey => {
        const cat = categories[catKey];
        weightedSum += cat.score * cat.weight;
        categoryScores.push(cat.score);
    });
    
    // 2. Вычисляем разброс (Spread)
    const maxScore = Math.max(...categoryScores);
    const minScore = Math.min(...categoryScores);
    const spread = maxScore - minScore;
    
    // 3. Штраф за дисбаланс
    const penalty = spread * 0.5;
    
    // 4. Итоговый балл
    const rawScore = Math.max(0, weightedSum - penalty);
    
    // 5. Нормализация в 100-балльную шкалу
    // Применяем линейное преобразование из методологии HARM:
    // a = (60 - 50) / (79.9 - 65) ≈ 0.6711
    // b = 50 - a * 65 ≈ 6.38
    const a = 0.6711;
    const b = 6.38;
    const normalizedScore = a * rawScore + b;
    
    // Ограничиваем диапазон 0-100
    const finalScore = Math.max(0, Math.min(100, normalizedScore));
    
    return {
        finalScore: Math.round(finalScore),
        rawScore: rawScore.toFixed(2),
        weightedSum: weightedSum.toFixed(2),
        spread: spread.toFixed(2),
        penalty: penalty.toFixed(2),
        maxCategory: maxScore.toFixed(2),
        minCategory: minScore.toFixed(2),
        categories: categories
    };
}

// ============================================================================
// ======================== ADVANCED METRIC FUNCTIONS =========================
// ============================================================================

/**
 * Вычисляет "золотое сечение" для лица
 * @param {Array} pts - массив точек
 * @returns {Object} результаты по золотому сечению
 */
function calculateGoldenRatio(pts) {
    const PHI = 1.618033988749;
    
    // Основные измерения
    const faceWidth = dist(pts[43], pts[44]);
    const faceHeight = dist(pts[0], pts[8]);
    const mouthWidth = dist(pts[36], pts[37]);
    const noseWidth = dist(pts[25], pts[26]);
    const eyeWidth = dist(pts[9], pts[10]);
    
    return {
        faceRatio: faceWidth / faceHeight,
        mouthToNose: mouthWidth / noseWidth,
        eyeToMouth: dist(pts[11], pts[35]) / mouthWidth,
        phiDeviation: Math.abs((faceWidth / faceHeight) - PHI)
    };
}

/**
 * Вычисляет симметрию лица
 * @param {Array} pts - массив точек
 * @returns {Object} метрики симметрии
 */
function calculateSymmetry(pts) {
    // Парные точки для проверки симметрии
    const pairs = [
        [1, 2],   // Виски
        [3, 4],   // Углы челюсти
        [5, 6],   // Скулы
        [9, 12],  // Внутренние углы глаз
        [10, 13], // Внешние углы глаз
        [11, 14], // Зрачки
        [25, 26], // Крылья носа
        [36, 37], // Углы рта
        [43, 44]  // Широкие точки скул
    ];
    
    // Центральная ось (примерно через центр лица)
    const centerX = (pts[0].x + pts[8].x) / 2;
    
    let totalDeviation = 0;
    pairs.forEach(([left, right]) => {
        const leftDist = Math.abs(pts[left].x - centerX);
        const rightDist = Math.abs(pts[right].x - centerX);
        const deviation = Math.abs(leftDist - rightDist);
        totalDeviation += deviation;
    });
    
    const avgDeviation = totalDeviation / pairs.length;
    const symmetryScore = Math.max(0, 100 - avgDeviation * 2);
    
    return {
        averageDeviation: avgDeviation.toFixed(2),
        symmetryScore: Math.round(symmetryScore),
        pairs: pairs.length
    };
}

/**
 * Генерирует текстовые рекомендации на основе результатов
 * @param {Object} harmResult - результат HARM формулы
 * @param {Array} metrics - массив метрик
 * @returns {Array} массив рекомендаций
 */
function generateRecommendations(harmResult, metrics) {
    const recommendations = [];
    
    // Находим самые слабые метрики (T4 и T5)
    const weakMetrics = metrics.filter(m => m.tier === "T4" || m.tier === "T5");
    
    // Находим самые сильные метрики (T1)
    const strongMetrics = metrics.filter(m => m.tier === "T1");
    
    // Рекомендации по слабым метрикам
    weakMetrics.slice(0, 3).forEach(metric => {
        recommendations.push({
            type: "improvement",
            metric: metric.name,
            description: metric.interpretation,
            priority: metric.tier === "T5" ? "high" : "medium"
        });
    });
    
    // Положительные стороны
    strongMetrics.slice(0, 2).forEach(metric => {
        recommendations.push({
            type: "strength",
            metric: metric.name,
            description: `Отличный показатель: ${metric.nameRu}`,
            priority: "info"
        });
    });
    
    // Общая рекомендация по балансу
    if (parseFloat(harmResult.spread) > 30) {
        recommendations.push({
            type: "balance",
            description: "Значительный дисбаланс между категориями. Рекомендуется работать над гармоничным развитием всех аспектов.",
            priority: "high"
        });
    }
    
    return recommendations;
}

// ============================================================================
// ======================== EXPORT & COMPATIBILITY ============================
// ============================================================================

// Экспорт для использования в других модулях (если нужно)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LANDMARKS_49,
        CATEGORIES,
        METRICS_DEFINITIONS,
        calculateAllMetrics,
        calculateCategories,
        calculateHARMFormula,
        calculateGoldenRatio,
        calculateSymmetry,
        generateRecommendations,
        dist,
        angle,
        angleDeg
    };
}

// Для использования в браузере - функции доступны глобально
// calculateAllMetrics, calculateCategories, calculateHARMFormula уже глобальны

// ============================================================================
// ======================== INITIALIZATION LOG =================================
// ============================================================================

console.log('%c🎭 HARM Math Engine v2.0 загружен', 'color: #3b82f6; font-size: 14px; font-weight: bold;');
console.log(`%c  📐 Метрик: ${METRICS_DEFINITIONS.length}`, 'color: #10b981;');
console.log(`%c  📍 Точек: ${LANDMARKS_49.length}`, 'color: #10b981;');
console.log(`%c  📊 Категорий: ${Object.keys(CATEGORIES).length}`, 'color: #10b981;');
console.log('%c  ✓ Готов к расчетам', 'color: #f59e0b;');

// ============================================================================
// ======================== END OF HARM MATH ENGINE ===========================
// ============================================================================
