/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (38 метрик)
   КОД 2/6: scoring.js (v5 — индивидуальные веса, без категорий)
   ---------------------------------------------------------------------
   ИТОГ = средневзвешенное: sum(балл_i × вес_i) / sum(вес_i).
   Баллы тиеров: T1=100, T2=80, T3=60, T4=40, T5=20.
   Веса (1.0–3.5) — по значимости зоны для восприятия лица:
     3.5  наклон глаз, форма глаза (PFL:PHL) — считываются мгновенно;
     3.0  посадка глаз (ESR, ES), брови;
     2.5  каркас (FWHR, челюсти, скулы, нос, рот, подбородок);
     2.0  пропорции/трети/высоты;
     1.5  вторичные отношения;
     1.0  периферия (виски, шея, Z-set).
   Пропущенные метрики (не хватает точек) НЕ обнуляют итог:
   они исключаются и из числителя, и из знаменателя.
   Общий тиер: >=88 T1, >=68 T2, >=48 T3, >=32 T4, иначе T5.
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = (global.FM = global.FM || {});

  /* === ИНДИВИДУАЛЬНЫЕ ВЕСА ВСЕХ 38 МЕТРИК === */
  const WEIGHTS = {
    /* Общие пропорции */
    FWHR: 2.5, tFWHR: 1.5, MFR: 2.5, Thirds: 2.0, LowerThird: 2.0,
    Bitemporal: 1.0, JawWHR: 2.5, MouthJaw: 1.5,
    /* Глаза и брови */
    CanthalTilt: 3.5, ESR: 3.0, ES: 3.0, ICD: 2.5, OCD: 2.5,
    MCA: 2.0, PFL_PHL: 3.5, BrowTilt: 3.0, BrowHeight: 2.5,
    PFLBizygo: 2.0, BrowBizygo: 1.5, bSet: 2.0,
    /* Нос */
    NoseZygo: 2.5, NoseICD: 2.5, NoseHeight: 2.5, IAA: 2.0,
    AlarBridge: 1.5, MouthNoseH: 1.5,
    /* Рот и губы */
    LipProp: 2.5, MouthNose: 2.5, EME: 2.5,
    /* Челюсть, подбородок, шея */
    JawWidth: 2.5, Bigonial: 2.5, NeckWidth: 1.0, CheekHeight: 2.0,
    ChinPhiltrum: 2.5, JFA: 2.5, IAA_JFA: 1.5, ZSet: 1.0,
    /* Новая */
    CLWR: 2.0
  };

  const TIER_ORDER = ['T1', 'T2', 'T3', 'T4'];
  const TIER_SCORE = { T1: 100, T2: 80, T3: 60, T4: 40, T5: 20 };
  const TIER_LABELS = {
    T1: 'Топ-диапазон', T2: 'Выше среднего', T3: 'Среднее',
    T4: 'Ниже среднего', T5: 'Далеко от идеала'
  };
  const OVERALL_THRESHOLDS = [88, 68, 48, 32];

  /* === парсинг полос тиеров === */
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

  /* === определение тиера значения === */
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
    /* выше всех полос: T1, если идеал односторонний «лучше идеала», иначе T5 */
    if (v > all[all.length - 1].b) return t5Has(m.tiers, '>') ? 'T5' : 'T1';
    if (v < all[0].a) return t5Has(m.tiers, '<') ? 'T5' : 'T1';
    /* попали в дырку между полосами (округление в таблице) — к ближайшей */
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

  /* === форматирование === */
  function fmt(value, unit) {
    if (value === null || value === undefined || !isFinite(value)) return '—';
    if (unit === '%') return value.toFixed(1) + '%';
    if (unit === '°') return value.toFixed(1) + '°';
    return value.toFixed(3);
  }
  function idealStr(m, unit) {
    const t1 = bandsOf(m.tiers ? m.tiers.T1 : m.ideal)[0];
    if (!t1) return '—';
    if (!t5Has(m.tiers, '>') && t1[1] >= 100) return '≥ ' + fmt(t1[0], unit);
    if (!t5Has(m.tiers, '<') && t1[0] <= 0) return '≤ ' + fmt(t1[1], unit);
    return fmt(t1[0], unit) + ' — ' + fmt(t1[1], unit);
  }

  /* === СКОРИНГ: средневзвешенное по индивидуальным весам === */
  function scoreAll(results) {
    const items = [];
    let sumWS = 0, sumW = 0, counted = 0, missing = 0;

    for (let i = 0; i < results.length; i++) {
      const m = results[i];
      const w = (typeof WEIGHTS[m.key] === 'number') ? WEIGHTS[m.key] : 1.0;

      if (m.value === null || m.value === undefined) {
        missing++;
        items.push({
          n: m.n, key: m.key, name: m.name, unit: m.unit, tiers: m.tiers,
          value: null, tier: null, score: null, dir: null, viz: m.viz,
          weight: w, missing: m.missing || []
        });
        continue;
      }

      const tier = tierOf(m, m.value);
      const score = TIER_SCORE[tier];
      counted++;
      sumWS += score * w;
      sumW += w;

      items.push({
        n: m.n, key: m.key, name: m.name, unit: m.unit, tiers: m.tiers,
        value: m.value, tier: tier, score: score, weight: w,
        dir: dirOf(m, m.value, tier), viz: m.viz, missing: []
      });
    }

    let overall = null;
    if (sumW > 0 && counted > 0) {
      const score = sumWS / sumW;
      overall = {
        score: score,
        of10: Math.round(score) / 10,
        tier: overallTier(score),
        counted: counted,
        missing: missing
      };
    }
    return { items: items, overall: overall };
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
    return 'FaceMetrics: ' + o.of10.toFixed(1) + '/10 (' + o.tier + '). ' +
      'T1:' + tiers.T1 + ' T2:' + tiers.T2 + ' T3:' + tiers.T3 +
      ' T4:' + tiers.T4 + ' T5:' + tiers.T5 +
      (o.missing ? ' | не посчитано: ' + o.missing : '');
  }

  FM.scoring = {
    WEIGHTS: WEIGHTS,
    TIER_ORDER: TIER_ORDER, TIER_SCORE: TIER_SCORE, TIER_LABELS: TIER_LABELS,
    OVERALL_THRESHOLDS: OVERALL_THRESHOLDS,
    bandsOf: bandsOf, tierOf: tierOf, dirOf: dirOf,
    fmt: fmt, idealStr: idealStr, overallTier: overallTier,
    scoreAll: scoreAll, summaryText: summaryText
  };
})(typeof window !== 'undefined' ? window : this);
