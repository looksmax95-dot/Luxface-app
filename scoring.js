/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (37 метрик, без нейросетей)
   МОДУЛЬ 3/7: scoring.js
   ---------------------------------------------------------------------
   Скоринг v3: ПОЛНЫЕ тиер-полосы из таблицы (T1-T5 на каждую метрику).
   Вход: результат FM.metrics.computeAll(pts) — у каждой записи есть tiers.
   Форматы полос, которые умеем парсить:
     • [a, b]                  — одиночная полоса (T1: [1.90, 2.06]);
     • [[a1,b1],[a2,b2]]       — двустороннее отклонение (T2: [[1.83,1.89],[2.07,2.13]]);
     • ['<1.70', '>2.18']      — строковый T5 (открытые концы).
   Особые случаи:
     • «дырки» между полосами (Thirds: T1 до 3, T2 с 4) -> значение отдаём
       БЛИЖАЙШЕЙ полосе, при равенстве расстояний — более строгой;
     • односторонний идеал (Cheekbones T1 [81,100], T5 только '<66'):
       значение ВЫШЕ всех полос и у T5 нет '>' -> это T1 (лучше идеала);
       симметрично для односторонних внизу (b-set, T5 только '>1.50').
   Скор метрики: T1=100, T2=80, T3=60, T4=40, T5=20.
   Итог: средневзвешенное скоров -> 0..100, /10 и общий тиер
   по порогам [88, 68, 48, 32].
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = (global.FM = global.FM || {});

  const TIER_ORDER = ['T1', 'T2', 'T3', 'T4'];
  const TIER_SCORE = { T1: 100, T2: 80, T3: 60, T4: 40, T5: 20 };
  const TIER_LABELS = {
    T1: 'Топ-диапазон', T2: 'Выше среднего', T3: 'Среднее',
    T4: 'Ниже среднего', T5: 'Далеко от идеала'
  };
  const OVERALL_THRESHOLDS = [88, 68, 48, 32];

  /* ---------------- парсинг полос ---------------- */
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

  /* ---------------- определение тиера ---------------- */
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

    if (v > all[all.length - 1].b) {          /* выше всех конечных полос */
      return t5Has(m.tiers, '>') ? 'T5' : 'T1';
    }
    if (v < all[0].a) {                       /* ниже всех конечных полос */
      return t5Has(m.tiers, '<') ? 'T5' : 'T1';
    }

    /* попали в дырку между полосами — к ближайшей, при равенстве к строгой */
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

  /* ---------------- форматирование ---------------- */
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

  /* ---------------- скоринг набора ---------------- */
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
          n: m.n, key: m.key, name: m.name, unit: m.unit, tiers: m.tiers,
          value: null, tier: null, score: null, dir: null, viz: m.viz,
          missing: m.missing || []
        });
        continue;
      }

      const tier = tierOf(m, m.value);
      const score = TIER_SCORE[tier];
      counted++;
      sum += score * w;
      wsum += w;

      items.push({
        n: m.n, key: m.key, name: m.name, unit: m.unit, tiers: m.tiers,
        value: m.value, tier: tier, score: score,
        dir: dirOf(m, m.value, tier), viz: m.viz, missing: []
      });
    }

    let overall = null;
    if (wsum > 0 && counted > 0) {
      const score = sum / wsum;
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
