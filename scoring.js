/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (32 метрики, без нейросетей)
   МОДУЛЬ 4/8: js/scoring.js
   ---------------------------------------------------------------------
   Назначение: превратить сырые значения метрик в тиеры и скоры.
   Модель (по дизайн-доку):
     • hw  — полуширина идеального диапазона: (b-a)/2, либо hw-override
       из metrics.js для девиационных метрик (25/26/27);
     • h   — отклонение ЗА краем диапазона, в единицах hw
       (внутри диапазона h = 0);
     • тиер:  h=0 -> T1 | h<=0.5 -> T2 | h<=1.5 -> T3 | h<=3 -> T4 | иначе T5;
     • скор метрики: 100 - 20*h, кламп [0..100];
     • итог: взвешенное среднее скоров посчитанных метрик -> 0..100,
       общий тиер по порогам [88, 72, 55, 38] и скор /10 (1 знак).
   Вход: результат FM.metrics.computeAll(pts) (массив записей с value).
   Выход: FM.scoring.scoreAll(results, weights?) ->
     { items:[{...metric, h, tier, score, dir}], overall:{score, of10, tier, counted, missing} }.
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = (global.FM = global.FM || {});

  const TIER_LABELS = {
    T1: 'Топ-диапазон',
    T2: 'Выше среднего',
    T3: 'Среднее',
    T4: 'Ниже среднего',
    T5: 'Далеко от идеала'
  };
  const OVERALL_THRESHOLDS = [88, 72, 55, 38];   /* границы T1..T5 для итога */

  /* ---------------- форматирование значений ---------------- */
  function fmt(value, unit) {
    if (value === null || value === undefined || !isFinite(value)) return '—';
    if (unit === '%') return value.toFixed(1) + '%';
    if (unit === '°') return value.toFixed(1) + '°';
    return value.toFixed(3);
  }
  function idealStr(ideal, unit) {
    return fmt(ideal[0], unit) + ' — ' + fmt(ideal[1], unit);
  }

  /* ---------------- ядро скоринга ---------------- */
  function halfWidth(m) {
    if (m.hw !== null && m.hw !== undefined && m.hw > 0) return m.hw;
    const hw = (m.ideal[1] - m.ideal[0]) / 2;
    return hw > 0 ? hw : Math.max(Math.abs(m.ideal[1]) * 0.05, 1e-9);
  }

  function deviationH(m, value) {
    const hw = halfWidth(m);
    if (value < m.ideal[0]) return (m.ideal[0] - value) / hw;
    if (value > m.ideal[1]) return (value - m.ideal[1]) / hw;
    return 0;
  }

  function tierOfH(h) {
    if (h <= 0) return 'T1';
    if (h <= 0.5) return 'T2';
    if (h <= 1.5) return 'T3';
    if (h <= 3) return 'T4';
    return 'T5';
  }

  function scoreOfH(h) {
    return Math.max(0, Math.min(100, 100 - 20 * h));
  }

  function dirOf(m, value) {
    if (value < m.ideal[0]) return 'low';
    if (value > m.ideal[1]) return 'high';
    return 'ok';
  }

  function overallTier(score) {
    if (score >= OVERALL_THRESHOLDS[0]) return 'T1';
    if (score >= OVERALL_THRESHOLDS[1]) return 'T2';
    if (score >= OVERALL_THRESHOLDS[2]) return 'T3';
    if (score >= OVERALL_THRESHOLDS[3]) return 'T4';
    return 'T5';
  }

  /* ---------------- скоринг всего набора ---------------- */
  function scoreAll(results, weights) {
    weights = weights || {};
    const items = [];
    let sum = 0, wsum = 0, counted = 0, missing = 0;

    for (let i = 0; i < results.length; i++) {
      const m = results[i];
      const w = (typeof weights[m.key] === 'number' && weights[m.key] > 0) ? weights[m.key] : 1;

      if (m.value === null || m.value === undefined) {
        missing++;
        items.push({
          n: m.n, key: m.key, name: m.name, unit: m.unit, ideal: m.ideal,
          value: null, h: null, tier: null, score: null, dir: null,
          missing: m.missing || []
        });
        continue;
      }

      const h = deviationH(m, m.value);
      const score = scoreOfH(h);
      counted++;
      sum += score * w;
      wsum += w;

      items.push({
        n: m.n, key: m.key, name: m.name, unit: m.unit, ideal: m.ideal,
        value: m.value, h: h, tier: tierOfH(h), score: score,
        dir: dirOf(m, m.value), missing: []
      });
    }

    let overall = null;
    if (wsum > 0 && counted > 0) {
      const score = sum / wsum;
      overall = {
        score: score,
        of10: Math.round(score) / 10,          /* 0..10 с одним знаком */
        tier: overallTier(score),
        counted: counted,
        missing: missing
      };
    }

    return { items: items, overall: overall };
  }

  /* ---------------- сводка для шаринга/текста ---------------- */
  function summaryText(scored) {
    if (!scored.overall) return 'FaceMetrics: нет данных для оценки.';
    const o = scored.overall;
    const tiers = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 };
    scored.items.forEach(function (it) { if (it.tier) tiers[it.tier]++; });
    return 'FaceMetrics: ' + o.of10.toFixed(1) + '/10 (' + o.tier + '). ' +
      'T1:' + tiers.T1 + ' T2:' + tiers.T2 + ' T3:' + tiers.T3 +
      ' T4:' + tiers.T4 + ' T5:' + tiers.T5 +
      (o.missing ? ' | не посчитано: ' + o.missing : '');
  }

  FM.scoring = {
    TIER_LABELS: TIER_LABELS,
    OVERALL_THRESHOLDS: OVERALL_THRESHOLDS,
    fmt: fmt,
    idealStr: idealStr,
    halfWidth: halfWidth,
    deviationH: deviationH,
    tierOfH: tierOfH,
    scoreOfH: scoreOfH,
    overallTier: overallTier,
    scoreAll: scoreAll,
    summaryText: summaryText
  };
})(typeof window !== 'undefined' ? window : this);
