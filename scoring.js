/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (37 метрик, без нейросетей)
   МОДУЛЬ 3/7: scoring.js (v4 — весовая система с категориями)
   ---------------------------------------------------------------------
   КАТЕГОРИИ И ВЕСА:
     • EYES (Глаза) — вес ×3.0 (самая важная зона)
     • PROP (Пропорции) — вес ×2.0 (общая гармония)
     • NOSE (Нос) — вес ×1.5 (центр лица)
     • MOUTH (Рот) — вес ×1.5 (центр лица)
     • JAW (Челюсть/Скулы) — вес ×1.0 (структура)
     • MISC (Второстепенное) — вес ×0.5 (менее критично)
   
   ЛОГИКА СКОРИНГА:
     1. Каждая метрика получает балл по тиеру: T1=100, T2=80, T3=60, T4=40, T5=20
     2. Балл умножается на вес категории метрики
     3. Итоговый скор = среднее взвешенное по всем посчитанным метрикам
     4. Дополнительно считаются скоры по каждой категории отдельно
   
   ВХОД: результат FM.metrics.computeAll(pts)
   ВЫХОД: FM.scoring.scoreAll(results) ->
     { items:[...], overall:{score, of10, tier, counted, missing},
       categories:{EYES:{score, tier, count}, PROP:{...}, ...} }
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = (global.FM = global.FM || {});

  /* === ВЕСА КАТЕГОРИЙ === */
  const CATEGORY_WEIGHTS = {
    EYES: 3.0,    /* Глаза — самая важная зона */
    PROP: 2.0,    /* Общие пропорции */
    NOSE: 1.5,    /* Нос */
    MOUTH: 1.5,   /* Рот и губы */
    JAW: 1.0,     /* Челюсть, подбородок, шея, скулы */
    MISC: 0.5     /* Второстепенные метрики */
  };

  /* === КАРТА МЕТРИК -> КАТЕГОРИЯ === */
  const METRIC_CATEGORIES = {
    /* ПРОПОРЦИИ (вес 2.0) */
    FWHR: 'PROP',
    tFWHR: 'PROP',
    MFR: 'PROP',
    Thirds: 'PROP',
    LowerThird: 'PROP',
    Bitemporal: 'PROP',
    JawWHR: 'PROP',
    MouthJaw: 'PROP',

    /* ГЛАЗА (вес 3.0) */
    CanthalTilt: 'EYES',
    ESR: 'EYES',
    ES: 'EYES',
    ICD: 'EYES',
    OCD: 'EYES',
    MCA: 'EYES',
    PFL_PHL: 'EYES',
    BrowTilt: 'EYES',
    BrowHeight: 'EYES',
    PFLBizygo: 'EYES',
    BrowBizygo: 'EYES',
    bSet: 'EYES',

    /* НОС (вес 1.5) */
    NoseZygo: 'NOSE',
    NoseICD: 'NOSE',
    NoseHeight: 'NOSE',
    IAA: 'NOSE',
    AlarBridge: 'NOSE',
    MouthNoseH: 'NOSE',

    /* РОТ (вес 1.5) */
    LipProp: 'MOUTH',
    MouthNose: 'MOUTH',
    EME: 'MOUTH',

    /* ЧЕЛЮСТЬ/ПОДБОРОДОК/ШЕЯ (вес 1.0) */
    JawWidth: 'JAW',
    Bigonial: 'JAW',
    NeckWidth: 'JAW',
    CheekHeight: 'JAW',
    ChinPhiltrum: 'JAW',
    JFA: 'JAW',
    IAA_JFA: 'JAW',
    ZSet: 'JAW'
  };

  /* === ПОРОГИ ТИЕРОВ И БАЛЛЫ === */
  const TIER_ORDER = ['T1', 'T2', 'T3', 'T4'];
  const TIER_SCORE = { T1: 100, T2: 80, T3: 60, T4: 40, T5: 20 };
  const TIER_LABELS = {
    T1: 'Топ-диапазон', T2: 'Выше среднего', T3: 'Среднее',
    T4: 'Ниже среднего', T5: 'Далеко от идеала'
  };
  const OVERALL_THRESHOLDS = [88, 68, 48, 32];

  /* === ПАРСИНГ ПОЛОС === */
  function bandsOf(spec) {
    if (!Array.isArray(spec)) return [];
    if (typeof spec[0] === 'number') return [[spec[0], spec[1]]];
    return spec.filter(function (b) { return Array.isArray(b); });
  }

  function t5Has(tiers, sign) {
    const t5 = tiers && tiers.T5;
    if (!Array.isArray(t5)) return false;
    return t5.some(function (s) { return typeof s === 'string' && s.charAt(0) === sign; });
  }

  /* === ОПРЕДЕЛЕНИЕ ТИЕРА === */
  function tierOf(m, v) {
    const all = [];
    TIER_ORDER.forEach(function (t) {
      bandsOf(m.tiers[t]).forEach(function (b) { all.push({ t: t, a: b[0], b: b[1] }); });
    });
    if (!all.length) return 'T3';

    for (let i = 0; i < all.length; i++) {
      if (v >= all[i].a && v <= all[i].b) return all[i].t;
    }
    all.sort(function (x, y) { return x.a - y.a; });

    if (v > all[all.length - 1].b) {
      return t5Has(m.tiers, '>') ? 'T5' : 'T1';
    }
    if (v < all[0].a) {
      return t5Has(m.tiers, '<') ? 'T5' : 'T1';
    }

    let prev = null, next = null;
    for (let i = 0; i < all.length; i++) {
      if (all[i].b < v) prev = all[i];
      if (all[i].a > v && !next) next = all[i];
    }
    if (!prev) return next ? next.t : 'T5';
    if (!next) return prev.t;
    return (v - prev.b) < (next.a - v) ? prev.t : next.t;
  }

  function dirOf(m, v, tier) {
    const t1 = bandsOf(m.tiers.T1)[0];
    if (!t1) return 'ok';
    if (tier === 'T1') return 'ok';
    return v < t1[0] ? 'low' : 'high';
  }

  /* === ФОРМАТИРОВАНИЕ === */
  function fmt(value, unit) {
    if (value === null || value === undefined || !isFinite(value)) return '—';
    if (unit === '%') return value.toFixed(1) + '%';
    if (unit === '°') return value.toFixed(1) + '°';
    return value.toFixed(3);
  }

  function idealStr(m, unit) {
    const t1 = bandsOf(m.tiers ? m.tiers.T1 : m.ideal)[0];
    if (!t1) return '—';
    const openHigh = !t5Has(m.tiers, '>');
    const openLow = !t5Has(m.tiers, '<');
    if (openHigh && t1[1] >= 100) return '≥ ' + fmt(t1[0], unit);
    if (openLow && t1[0] <= 0) return '≤ ' + fmt(t1[1], unit);
    return fmt(t1[0], unit) + ' — ' + fmt(t1[1], unit);
  }

  /* === ОСНОВНАЯ ФУНКЦИЯ СКОРИНГА === */
  function scoreAll(results, weights) {
    weights = weights || {};
    const items = [];
    
    /* Суммы для итогового скора */
    let totalWeightedScore = 0, totalWeight = 0, counted = 0, missing = 0;
    
    /* Суммы по категориям */
    const catData = {};
    Object.keys(CATEGORY_WEIGHTS).forEach(function (cat) {
      catData[cat] = { weightedScore: 0, weight: 0, count: 0, tiers: { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 } };
    });

    for (let i = 0; i < results.length; i++) {
      const m = results[i];
      const category = METRIC_CATEGORIES[m.key] || 'MISC';
      const catWeight = CATEGORY_WEIGHTS[category] || 1.0;

      if (m.value === null || m.value === undefined) {
        missing++;
        items.push({
          n: m.n, key: m.key, name: m.name, unit: m.unit, tiers: m.tiers,
          value: null, tier: null, score: null, dir: null, viz: m.viz,
          category: category, catWeight: catWeight,
          missing: m.missing || []
        });
        continue;
      }

      const tier = tierOf(m, m.value);
      const baseScore = TIER_SCORE[tier];
      const weightedScore = baseScore * catWeight;

      counted++;
      totalWeightedScore += weightedScore;
      totalWeight += catWeight;

      catData[category].weightedScore += weightedScore;
      catData[category].weight += catWeight;
      catData[category].count++;
      catData[category].tiers[tier]++;

      items.push({
        n: m.n, key: m.key, name: m.name, unit: m.unit, tiers: m.tiers,
        value: m.value, tier: tier, score: baseScore, weightedScore: weightedScore,
        dir: dirOf(m, m.value, tier), viz: m.viz,
        category: category, catWeight: catWeight, missing: []
      });
    }

    /* Итоговый скор */
    let overall = null;
    if (totalWeight > 0 && counted > 0) {
      const score = totalWeightedScore / totalWeight;
      overall = {
        score: score,
        of10: Math.round(score) / 10,
        tier: overallTier(score),
        counted: counted,
        missing: missing
      };
    }

    /* Скоры по категориям */
    const categories = {};
    Object.keys(catData).forEach(function (cat) {
      const cd = catData[cat];
      if (cd.count > 0) {
        const avgScore = cd.weightedScore / cd.weight;
        categories[cat] = {
          score: avgScore,
          of10: Math.round(avgScore) / 10,
          tier: overallTier(avgScore),
          count: cd.count,
          weight: CATEGORY_WEIGHTS[cat],
          tiers: cd.tiers
        };
      }
    });

    return { items: items, overall: overall, categories: categories };
  }

  function overallTier(score) {
    if (score >= OVERALL_THRESHOLDS[0]) return 'T1';
    if (score >= OVERALL_THRESHOLDS[1]) return 'T2';
    if (score >= OVERALL_THRESHOLDS[2]) return 'T3';
    if (score >= OVERALL_THRESHOLDS[3]) return 'T4';
    return 'T5';
  }

  function summaryText(scored) {
    if (!scored.overall) return 'FaceMetrics: нет данных для оценки.';
    const o = scored.overall;
    const tiers = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 };
    scored.items.forEach(function (it) { if (it.tier) tiers[it.tier]++; });
    
    let txt = 'FaceMetrics: ' + o.of10.toFixed(1) + '/10 (' + o.tier + ')\n';
    txt += 'T1:' + tiers.T1 + ' T2:' + tiers.T2 + ' T3:' + tiers.T3 +
           ' T4:' + tiers.T4 + ' T5:' + tiers.T5 + '\n\n';
    
    const catNames = { EYES: '👁️ Глаза', PROP: '⚖️ Пропорции', NOSE: '👃 Нос', MOUTH: '👄 Рот', JAW: '🦴 Челюсть', MISC: '📏 Прочее' };
    Object.keys(scored.categories).forEach(function (cat) {
      const c = scored.categories[cat];
      txt += catNames[cat] + ': ' + c.of10.toFixed(1) + '/10 (' + c.tier + ', вес ×' + c.weight + ')\n';
    });
    
    if (o.missing) txt += '\nНе посчитано: ' + o.missing + ' метрик';
    return txt;
  }

  /* === ПУБЛИЧНЫЙ API === */
  FM.scoring = {
    CATEGORY_WEIGHTS: CATEGORY_WEIGHTS,
    METRIC_CATEGORIES: METRIC_CATEGORIES,
    TIER_ORDER: TIER_ORDER,
    TIER_SCORE: TIER_SCORE,
    TIER_LABELS: TIER_LABELS,
    OVERALL_THRESHOLDS: OVERALL_THRESHOLDS,
    bandsOf: bandsOf,
    tierOf: tierOf,
    dirOf: dirOf,
    fmt: fmt,
    idealStr: idealStr,
    overallTier: overallTier,
    scoreAll: scoreAll,
    summaryText: summaryText
  };
})(typeof window !== 'undefined' ? window : this);
