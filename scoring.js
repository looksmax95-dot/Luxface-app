/* ============================================================
 * scoring.js — агрегация 28 метрик в итоговый балл гармонии.
 *
 * Логика (гибридная, чтобы ни одна метрика не убивала всё):
 *
 *   1. Метрики группируются по Tier (T1..T5).
 *   2. Внутри каждого Tier считаем взвешенное среднее —
 *      линейное, чтобы слабая метрика не обнуляла категорию.
 *   3. Между Tier'ами считаем геометрическое взвешенное среднее —
 *      оно штрафует за реальные провалы, но не обнуляет всё
 *      из-за одной метрики (как чистое геом. среднее).
 *   4. Накладываем штраф за дисбаланс между категориями —
 *      квадратичный, чтобы слабый разброс почти не наказывался,
 *      а критический — бил ощутимо.
 *
 * Зависит от: metrics.js (calculateMetrics).
 * ============================================================ */

'use strict';

/* ==================== ВЕСА TIER'ОВ ====================
 * Сумма = 1.0.
 * T1 — самые важные, задают основной вклад.
 * T5 — минимальный вклад, лишь слегка подкручивает итог.
 */
const TIER_WEIGHTS = {
  T1: 0.40,
  T2: 0.25,
  T3: 0.15,
  T4: 0.12,
  T5: 0.08
};

/* Минимальное значение Tier-балла перед логарифмированием,
 * чтобы геометрическое среднее не превратилось в 0 при полном
 * провале одной из категорий. */
const LOG_FLOOR = 1.0;

/* ==================== ХЕЛПЕРЫ ==================== */
function _mean(arr) {
  if (!arr.length) return 0;
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function _weightedMean(values, weights) {
  let sw = 0, sv = 0;
  for (let i = 0; i < values.length; i++) {
    const w = weights[i];
    if (!isFinite(w) || w <= 0) continue;
    sv += values[i] * w;
    sw += w;
  }
  return sw > 0 ? sv / sw : 0;
}

/* ==================== ГРУППИРОВКА ==================== */
function _groupByTier(metrics) {
  const groups = { T1: [], T2: [], T3: [], T4: [], T5: [] };
  for (const m of metrics) {
    if (!m || !groups[m.tier]) continue;
    if (typeof m.score !== 'number' || !isFinite(m.score)) continue;
    groups[m.tier].push(m);
  }
  return groups;
}

/* ==================== РАСЧЁТ TIER-БАЛЛОВ ====================
 * Внутри tier'а все метрики имеют равный вес.
 * Возвращает: { T1: 0..100, T2: ..., ... } только для непустых tier'ов.
 */
function _calcTierScores(groups) {
  const scores = {};
  for (const key of Object.keys(groups)) {
    const arr = groups[key];
    if (!arr.length) continue;
    const values = arr.map((m) => Math.max(0, Math.min(100, m.score)));
    scores[key] = _mean(values);
  }
  return scores;
}

/* ==================== ГЕОМЕТРИЧЕСКОЕ СРЕДНЕЕ ====================
 * Взвешенное геометрическое среднее по tier'ам.
 *   G = exp( sum(w_i * ln(T_i)) / sum(w_i) )
 * При отсутствии какого-то tier'а — просто пропускаем его,
 * веса нормализуются по факту.
 */
function _geometricAggregate(tierScores) {
  let sumW = 0;
  let sumLog = 0;
  for (const key of Object.keys(TIER_WEIGHTS)) {
    const w = TIER_WEIGHTS[key];
    const v = tierScores[key];
    if (typeof v !== 'number' || !isFinite(v)) continue; // категория пустая — не учитываем
    const clamped = Math.max(LOG_FLOOR, Math.min(100, v));
    sumLog += w * Math.log(clamped);
    sumW   += w;
  }
  if (sumW === 0) return 0;
  return Math.exp(sumLog / sumW);
}

/* ==================== ШТРАФ ЗА ДИСБАЛАНС ====================
 * Квадратичный штраф:
 *   Penalty = 0.5 * (Spread / 100)^2 * 100
 * Spread = max(tierScores) - min(tierScores).
 *
 * Примеры:
 *   Spread 10  → 0.5
 *   Spread 30  → 4.5
 *   Spread 50  → 12.5
 *   Spread 70  → 24.5
 *   Spread 90  → 40.5
 */
function _imbalancePenalty(tierScores) {
  const vals = Object.values(tierScores).filter((v) => isFinite(v));
  if (vals.length < 2) return 0;
  const spread = Math.max(...vals) - Math.min(...vals);
  const norm = spread / 100;
  return 0.5 * norm * norm * 100;
}

/* ==================== ЯРЛЫКИ ====================
 * Текстовое описание итога. Не оценочное, просто ориентир.
 */
function _labelFor(score) {
  if (score >= 85) return 'Исключительная гармония';
  if (score >= 75) return 'Высокая гармония';
  if (score >= 65) return 'Хорошая гармония';
  if (score >= 55) return 'Выше среднего';
  if (score >= 45) return 'Средняя гармония';
  if (score >= 35) return 'Ниже среднего';
  if (score >= 20) return 'Заметные дисбалансы';
  return 'Сильные дисбалансы';
}

/* ==================== ГЛАВНАЯ ФУНКЦИЯ ====================
 * calculateScore(pointsByID, canvasAspect?)
 *   pointsByID  — { id_точки: { x, y } } (нормированные координаты canvas)
 *   canvasAspect — H / W (по умолчанию 4/3)
 *
 * Возвращает объект:
 *   {
 *     score: 0..100,          // итоговый балл
 *     rawScore: 0..100,       // до штрафа
 *     penalty: number,        // снятые баллы
 *     tiers: { T1:..., ...},  // баллы по категориям
 *     metrics: [...],         // полный список метрик
 *     label: '...',           // текстовое описание
 *     version: '1.0'
 *   }
 * ==================================================== */
function calculateScore(pointsByID, canvasAspect) {
  if (typeof calculateMetrics !== 'function') {
    throw new Error('metrics.js не загружен (calculateMetrics недоступна)');
  }

  const metrics = calculateMetrics(pointsByID, canvasAspect);
  if (!metrics || !metrics.length) {
    throw new Error('не удалось рассчитать метрики');
  }

  const groups     = _groupByTier(metrics);
  const tierScores = _calcTierScores(groups);
  const rawScore   = _geometricAggregate(tierScores);
  const penalty    = _imbalancePenalty(tierScores);

  // Итог — не уходим ниже 0, не поднимаем выше 100
  const score = Math.max(0, Math.min(100, rawScore - penalty));

  // Сортируем метрики для вывода: сначала по tier, потом по score (слабые — выше)
  const tierOrder = { T1: 1, T2: 2, T3: 3, T4: 4, T5: 5 };
  const sortedMetrics = metrics.slice().sort((a, b) => {
    const ta = tierOrder[a.tier] || 99;
    const tb = tierOrder[b.tier] || 99;
    if (ta !== tb) return ta - tb;
    return a.score - b.score;
  });

  const result = {
    score,
    rawScore,
    penalty,
    tiers: tierScores,
    metrics: sortedMetrics,
    label: _labelFor(score),
    version: '1.0'
  };

  console.log('scoring.js: tiers =', tierScores);
  console.log(
    'scoring.js: raw=' + rawScore.toFixed(2) +
    ' penalty=' + penalty.toFixed(2) +
    ' final=' + score.toFixed(2)
  );

  return result;
}

/* ==================== ЭКСПОРТ ==================== */
window.calculateScore  = calculateScore;
window.TIER_WEIGHTS    = TIER_WEIGHTS;
