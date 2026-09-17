// Определения 49 ключевых точек
const LANDMARKS_49 = [
    // Овал лица и подбородок (1-9)
    "Верхняя точка лба", "Левый висок", "Правый висок", "Левый угол челюсти", "Правый угол челюсти", 
    "Левая щека", "Правая щека", "Центр подбородка", "Нижняя точка подбородка",
    // Глаза и брови (10-23)
    "Внутренний угол левого глаза", "Внешний угол левого глаза", "Центр левого зрачка",
    "Внутренний угол правого глаза", "Внешний угол правого глаза", "Центр правого зрачка",
    "Левая бровь (начало)", "Левая бровь (пик)", "Левая бровь (конец)",
    "Правая бровь (начало)", "Правая бровь (пик)", "Правая бровь (конец)",
    "Межбровье", "Центр переносицы",
    // Нос (24-33)
    "Кончик носа", "Низ носа (субназале)", "Левое крыло носа", "Правое крыло носа",
    "Левая ноздря", "Правая ноздря", "Спинка носа (верх)", "Спинка носа (середина)",
    "Колумелла", "Переход к губному желобку",
    // Губы и рот (34-43)
    "Верхний центр губы (Лук Купидона лево)", "Верхний центр губы (Лук Купидона право)",
    "Нижний центр верхней губы", "Левый угол рта", "Правый угол рта",
    "Центр нижней губы (верх)", "Центр нижней губы (низ)", "Центр фильтрума",
    "Левая подгубная складка", "Правая подгубная складка",
    // Дополнительные ориентиры скул и пропорций (44-49)
    "Левая точка скулы (самая широкая)", "Правая точка скулы (самая широкая)",
    "Верхняя треть лица (граница)", "Средняя треть лица (граница)", 
    "Нижняя треть лица (граница)", "Точка верхушки адамова яблока / шеи"
];

// Вычисление евклидова расстояния между точками
function dist(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Расчет угла наклона (например, для Canthal Tilt)
function angle(p1, p2) {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
}

// Расчет всех метрик и индекса HARM
function calculateHARM(pts) {
    // 1. Измерения ключевых отрезков
    const intercanthal = dist(pts[9], pts[12]); // Расстояние между глазами
    const eyeWidthLeft = dist(pts[9], pts[10]);
    const eyeWidthRight = dist(pts[12], pts[13]);
    const faceWidth = dist(pts[43], pts[44]);   // Ширина скул
    const jawWidth = dist(pts[3], pts[4]);      // Ширина челюсти
    const noseWidth = dist(pts[25], pts[26]);   // Ширина носа
    const faceHeight = dist(pts[0], pts[8]);    // Высота лица

    // 2. Метрики (Идеальные коэффициенты)
    const metrics = [
        { name: "ESR (Eye Separation Ratio)", val: intercanthal / ((eyeWidthLeft + eyeWidthRight)/2), ideal: 1.0, weight: 0.32, group: "Harmony" },
        { name: "FWHR (Facial Width-to-Height)", val: faceWidth / (dist(pts[21], pts[36])), ideal: 1.9, weight: 0.22, group: "Angularity" },
        { name: "Соотношение челюсти к скулам", val: jawWidth / faceWidth, ideal: 0.85, weight: 0.20, group: "Dimorphism" },
        { name: "Соотношение носа к межглазному", val: noseWidth / intercanthal, ideal: 1.0, weight: 0.26, group: "Misc" },
        { name: "Canthal Tilt (Наклон глаз)", val: Math.abs(angle(pts[9], pts[10])), ideal: 4.0, weight: 0.32, group: "Harmony" }
    ];

    let totalScore = 0;
    let processedMetrics = metrics.map(m => {
        let dev = Math.abs((m.val - m.ideal) / m.ideal) * 100; // % отклонения
        let score = Math.max(0, 100 - dev * 2);
        totalScore += score * m.weight;

        let status = dev <= 5 ? "green" : (dev <= 15 ? "yellow" : "red");
        return { name: m.name, val: m.val.toFixed(2), ideal: m.ideal, dev: dev.toFixed(1), status: status };
    });

    // Определение тира (T1-T5)
    let tier = "T5 (Ниже среднего)";
    if (totalScore >= 85) tier = "T1 (Chiseled / Model Tier)";
    else if (totalScore >= 75) tier = "T2 (Высокая гармония)";
    else if (totalScore >= 65) tier = "T3 (Норма)";
    else if (totalScore >= 50) tier = "T4 (Диспропорция)";

    return { score: Math.round(totalScore), tier: tier, details: processedMetrics };
}
