/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (32 метрики, без нейросетей)
   МОДУЛЬ 5/8: js/results.js
   ---------------------------------------------------------------------
   Назначение: DOM-рендер экрана результатов.
     • вход: scored = FM.scoring.scoreAll(...) ;
     • шапка: итоговый скор /10, общий тиер, счётчик посчитанных метрик;
     • дистрибуция тиеров (5 сегментов с количеством);
     • список метрик: номер, имя, значение, идеал, стрелка направления,
       мини-шкала с зоной идеала и точкой пользователя;
       шкала в единицах hw (полуширина): зона = [0..zonew], поля +-4hw;
       hw берётся из реестра FM.metrics.byKey(key) — override учтён;
     • блок непросчитанных метрик (если точки не хватало);
     • кнопки: копировать шаринг-текст / пройти заново (колбэки в opts);
     • дисклеймер + кредит @sjzso.
   Зависимости: FM.scoring, FM.metrics (опционально), без внешних библиотек.
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = (global.FM = global.FM || {});

  const TIER_CSS = { T1: 't1', T2: 't2', T3: 't3', T4: 't4', T5: 't5' };
  const DIR_ARROW = { ok: '•', low: '▼', high: '▲' };
  const BAR_MARGIN_HW = 4;                       /* поля шкалы в hw по краям */

  function hwOf(item) {
    const reg = (FM.metrics && FM.metrics.byKey) ? FM.metrics.byKey(item.key) : null;
    return FM.scoring.halfWidth(reg || item);
  }

  /* Позиция значения на шкале в hw-единицах: u=0 на a, u=zonew на b */
  function barPcts(item) {
    const hw = hwOf(item);
    const a = item.ideal[0], b = item.ideal[1];
    const zonew = (b - a) / hw;
    const lo = -BAR_MARGIN_HW, hi = zonew + BAR_MARGIN_HW;
    let u;
    if (item.value === null) u = zonew / 2;
    else if (item.dir === 'low') u = -item.h;
    else if (item.dir === 'high') u = zonew + item.h;
    else u = (item.value - a) / hw;
    u = Math.max(lo, Math.min(hi, u));
    const pct = function (x) { return ((x - lo) / (hi - lo) * 100).toFixed(2) + '%'; };
    return { dot: pct(u), zoneL: pct(0), zoneW: pct(zonew) };
  }

  function rowHtml(it) {
    const tcss = it.tier ? TIER_CSS[it.tier] : 'tn';
    const bp = barPcts(it);
    const val = FM.scoring.fmt(it.value, it.unit);
    const ideal = FM.scoring.idealStr(it.ideal, it.unit);
    const arrow = it.dir ? DIR_ARROW[it.dir] : '';
    return '<div class="mrow ' + tcss + '">' +
        '<div class="mnum">' + it.n + '</div>' +
        '<div class="mbody">' +
          '<div class="mname">' + it.name + '</div>' +
          '<div class="mvals">' + val + ' <span class="mideal">идеал ' + ideal + '</span> ' +
            '<span class="mdir">' + arrow + '</span></div>' +
          '<div class="mbar">' +
            '<i class="zone" style="left:' + bp.zoneL + ';width:' + bp.zoneW + '"></i>' +
            '<i class="dot" style="left:' + bp.dot + '"></i>' +
          '</div>' +
        '</div>' +
        '<div class="mtier">' + (it.tier || '—') + '</div>' +
      '</div>';
  }

  function distHtml(scored) {
    const tiers = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 };
    scored.items.forEach(function (it) { if (it.tier) tiers[it.tier]++; });
    let out = '<div class="res-dist">';
    ['T1', 'T2', 'T3', 'T4', 'T5'].forEach(function (t) {
      out += '<div class="dseg ' + TIER_CSS[t] + '"><b>' + t + '</b><span>' + tiers[t] + '</span></div>';
    });
    return out + '</div>';
  }

  function buildShareText(scored) {
    if (!scored.overall) return 'FaceMetrics: нет данных для оценки.';
    const lines = [FM.scoring.summaryText(scored), ''];
    const worst = scored.items
      .filter(function (it) { return it.tier && it.tier !== 'T1'; })
      .sort(function (x, y) { return y.h - x.h; })
      .slice(0, 10);
    worst.forEach(function (it) {
      lines.push('• #' + it.n + ' ' + it.name + ': ' +
        FM.scoring.fmt(it.value, it.unit) + ' (идеал ' +
        FM.scoring.idealStr(it.ideal, it.unit) + ') — ' + it.tier);
    });
    lines.push('', 'Метрики сообщества (credit @sjzso). Развлечение, не наука/медицина.');
    return lines.join('\n');
  }

  function copyText(text, btn) {
    const done = function () {
      if (!btn) return;
      const old = btn.textContent;
      btn.textContent = 'Скопировано ✓';
      setTimeout(function () { btn.textContent = old; }, 1500);
    };
    if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text); done(); });
    } else {
      legacyCopy(text);
      done();
    }
  }
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* тихо */ }
    document.body.removeChild(ta);
  }

  /* ---------------- главный рендер ---------------- */
  function render(container, scored, opts) {
    opts = opts || {};
    if (!container) return;
    if (!scored || !scored.overall) {
      container.innerHTML = '<div class="res-empty">Не удалось посчитать оценку: ' +
        'разметка неполная. Вернитесь и поставьте все точки.</div>';
      return;
    }
    const o = scored.overall;
    const tcss = TIER_CSS[o.tier] || 'tn';
    const label = FM.scoring.TIER_LABELS[o.tier] || '';

    const missingItems = scored.items.filter(function (it) { return it.value === null; });
    let missingHtml = '';
    if (missingItems.length) {
      missingHtml = '<div class="res-missing">Не посчитано (' + missingItems.length + '): ' +
        missingItems.map(function (it) { return '#' + it.n + ' ' + it.key; }).join(', ') +
        ' — не хватает точек разметки.</div>';
    }

    const html =
      '<div class="res-head ' + tcss + '">' +
        '<div class="res-score">' + o.of10.toFixed(1) + '<span>/10</span></div>' +
        '<div class="res-tier">' + o.tier + ' · ' + label + '</div>' +
        '<div class="res-meta">метрик посчитано: ' + o.counted + ' из ' +
          (o.counted + o.missing) + ' · скор ' + Math.round(o.score) + '/100</div>' +
      '</div>' +
      distHtml(scored) +
      '<div class="res-list">' + scored.items.map(rowHtml).join('') + '</div>' +
      missingHtml +
      '<div class="res-actions">' +
        '<button class="btn ghost" id="fmCopy">Скопировать результат</button>' +
        '<button class="btn primary" id="fmRetry">Пройти заново</button>' +
      '</div>' +
      '<div class="res-disclaimer">Оценка развлекательная: метрики сообществ looksmaxxing ' +
        '(credit @sjzso), не медицина и не наука. Точность зависит от фото и аккуратности ' +
        'разметки: фронтальное фото, нейтральная мимика, камера на уровне глаз.</div>';

    container.innerHTML = html;

    const copyBtn = container.querySelector('#fmCopy');
    const retryBtn = container.querySelector('#fmRetry');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyText(buildShareText(scored), copyBtn);
      });
    }
    if (retryBtn && typeof opts.onRetry === 'function') {
      retryBtn.addEventListener('click', opts.onRetry);
    }
  }

  FM.results = {
    render: render,
    buildShareText: buildShareText,
    barPcts: barPcts
  };
})(typeof window !== 'undefined' ? window : this);
