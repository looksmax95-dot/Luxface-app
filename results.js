/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (37 метрик, без нейросетей)
   МОДУЛЬ 4/7: results.js
   ---------------------------------------------------------------------
   Два блока:
     1) render(container, scored, opts) — экран результатов:
        шапка с итогом, дистрибуция T1-T5, ТАПАБЕЛЬНЫЕ строки 37 метрик
        (тап = открыть вьювер), копирование, дисклеймер.
     2) openViewer(host, scored, points, img, opts) — вьювер измерений:
        • режим full:  фото на весь экран, оверлей-подпись снизу,
          свайп влево/вправо + кнопки ← → для листания метрик;
        • режим split: сверху фото с линиями, снизу скроллящийся список
          всех метрик — тап по строке обновляет линии сверху;
        • переключатель режимов — кнопка ⬒ сверху;
        • отрисовка: ratio/percent = цветные отрезки A/B + подписи,
          angle = лучи из вершины + дуга, custom = линии ссылочных метрик.
   Зависимости: FM.scoring, FM.metrics. DOM создаёт сам, слушатели снимаются
   при close().
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = (global.FM = global.FM || {});

  const TIER_CSS = { T1: 't1', T2: 't2', T3: 't3', T4: 't4', T5: 't5' };
  const DIR_ARROW = { ok: '•', low: '▼', high: '▲' };
  const WORST_RANK = { T5: 0, T4: 1, T3: 2, T2: 3, T1: 4 };
  const CUSTOM_REFS = { IAA_JFA: ['IAA', 'JFA'] };   /* чьи линии рисуем для custom */

  /* ================= ОТРИСОВКА ВИЗУАЛИЗАЦИИ ================= */
  function fitTransform(W, H, iw, ih) {
    const s = Math.min(W / iw, H / ih);
    return { s: s, tx: (W - iw * s) / 2, ty: (H - ih * s) / 2 };
  }

  function drawViz(canvas, img, item, points) {
    const ctx = canvas.getContext('2d');
    const dpr = global.devicePixelRatio || 1;
    const W = canvas.clientWidth || 300;
    const H = canvas.clientHeight || 300;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, W, H);

    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const t = fitTransform(W, H, iw, ih);
    ctx.save();
    ctx.translate(t.tx, t.ty);
    ctx.scale(t.s, t.s);
    ctx.drawImage(img, 0, 0, iw, ih);
    ctx.restore();

    const S = function (p) { return { x: p.x * t.s + t.tx, y: p.y * t.s + t.ty }; };
    const used = {};

    /* собираем список отрезков и лучей (custom тянет ссылочные метрики) */
    let vizs = [];
    if (item && item.viz) {
      if (item.viz.type === 'custom') {
        (CUSTOM_REFS[item.key] || []).forEach(function (k) {
          const m = FM.metrics.byKey(k);
          if (m && m.viz) vizs.push(m.viz);
        });
      } else {
        vizs.push(item.viz);
      }
    }

    vizs.forEach(function (viz) {
      /* отрезки (ratio / percent) */
      (viz.segs || []).forEach(function (sg) {
        const a = points[sg.from], b = points[sg.to];
        if (!a || !b) return;
        used[sg.from] = 1; used[sg.to] = 1;
        const pa = S(a), pb = S(b);
        ctx.strokeStyle = sg.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
        /* подпись отрезка у середины */
        if (sg.label) {
          const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
          ctx.font = 'bold 12px monospace';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(15,17,21,0.9)';
          ctx.strokeText(sg.label, mx + 6, my - 6);
          ctx.fillStyle = sg.color;
          ctx.fillText(sg.label, mx + 6, my - 6);
        }
      });

      /* лучи + дуги (angle) */
      const groups = {};
      (viz.rays || []).forEach(function (ry) {
        const v = points[ry.from], e = points[ry.to];
        if (!v || !e) return;
        used[ry.from] = 1; used[ry.to] = 1;
        const pv = S(v), pe = S(e);
        ctx.strokeStyle = ry.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pv.x, pv.y);
        ctx.lineTo(pe.x, pe.y);
        ctx.stroke();
        (groups[ry.from] = groups[ry.from] || []).push(pe);
      });
      Object.keys(groups).forEach(function (vid) {
        const arr = groups[vid];
        if (arr.length < 2) return;
        const v = S(points[vid]);
        const a1 = Math.atan2(arr[0].y - v.y, arr[0].x - v.x);
        const a2 = Math.atan2(arr[1].y - v.y, arr[1].x - v.x);
        let diff = a2 - a1;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(v.x, v.y, 22, a1, a1 + diff, diff < 0);
        ctx.stroke();
      });
    });

    /* маркеры задействованных точек */
    Object.keys(used).forEach(function (id) {
      const p = S(points[id]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#0f1115';
      ctx.stroke();
    });
  }

  /* ================= ЭКРАН РЕЗУЛЬТАТОВ ================= */
  function rowHtml(it, idx) {
    const tcss = it.tier ? TIER_CSS[it.tier] : 'tn';
    const val = FM.scoring.fmt(it.value, it.unit);
    const ideal = FM.scoring.idealStr(it, it.unit);
    const arrow = it.dir ? DIR_ARROW[it.dir] : '';
    return '<div class="mrow ' + tcss + '" data-idx="' + idx + '" role="button">' +
        '<div class="mnum">' + it.n + '</div>' +
        '<div class="mbody">' +
          '<div class="mname">' + it.name + '</div>' +
          '<div class="mvals">' + val + ' <span class="mideal">идеал ' + ideal + '</span> ' +
            '<span class="mdir">' + arrow + '</span></div>' +
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
      .sort(function (x, y) {
        const d = WORST_RANK[x.tier] - WORST_RANK[y.tier];
        return d !== 0 ? d : x.n - y.n;
      })
      .slice(0, 10);
    worst.forEach(function (it) {
      lines.push('• #' + it.n + ' ' + it.name + ': ' +
        FM.scoring.fmt(it.value, it.unit) + ' (идеал ' +
        FM.scoring.idealStr(it, it.unit) + ') — ' + it.tier);
    });
    lines.push('', 'Метрики сообщества looksmaxxing (credit @sjzso). Развлечение, не наука/медицина.');
    return lines.join('\n');
  }

  function copyText(text, btn) {
    const done = function () {
      if (!btn) return;
      const old = btn.textContent;
      btn.textContent = 'Скопировано ✓';
      setTimeout(function () { btn.textContent = old; }, 1500);
    };
    const legacy = function () {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    };
    if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacy(); done(); });
    } else { legacy(); done(); }
  }

  function render(container, scored, opts) {
    opts = opts || {};
    if (!container) return;
    if (!scored || !scored.overall) {
      container.innerHTML = '<div class="res-empty">Не удалось посчитать оценку: разметка неполная.</div>';
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

    container.innerHTML =
      '<div class="res-head ' + tcss + '">' +
        '<div class="res-score">' + o.of10.toFixed(1) + '<span>/10</span></div>' +
        '<div class="res-tier">' + o.tier + ' · ' + label + '</div>' +
        '<div class="res-meta">метрик посчитано: ' + o.counted + ' из ' +
          (o.counted + o.missing) + ' · скор ' + Math.round(o.score) + '/100</div>' +
      '</div>' +
      distHtml(scored) +
      '<div class="res-hint">Тапни по любой метрике — увидишь, КАК именно она измерялась на твоём фото.</div>' +
      '<div class="res-list">' + scored.items.map(rowHtml).join('') + '</div>' +
      missingHtml +
      '<div class="res-actions">' +
        '<button type="button" class="btn ghost" id="fmCopy">Скопировать</button>' +
        '<button type="button" class="btn primary" id="fmRetry">Пройти заново</button>' +
      '</div>' +
      '<div class="res-disclaimer">Оценка развлекательная: метрики сообществ looksmaxxing ' +
        '(credit @sjzso), не медицина и не наука. Точность зависит от фото и аккуратности разметки.</div>';

    const copyBtn = container.querySelector('#fmCopy');
    if (copyBtn) copyBtn.addEventListener('click', function () { copyText(buildShareText(scored), copyBtn); });
    const retryBtn = container.querySelector('#fmRetry');
    if (retryBtn && typeof opts.onRetry === 'function') retryBtn.addEventListener('click', opts.onRetry);

    const rows = container.querySelectorAll('.mrow');
    for (let i = 0; i < rows.length; i++) {
      rows[i].addEventListener('click', function () {
        const idx = parseInt(this.getAttribute('data-idx'), 10);
        if (typeof opts.onOpenViewer === 'function' && !isNaN(idx)) opts.onOpenViewer(idx);
      });
    }
  }

  /* ================= ВЬЮВЕР ИЗМЕРЕНИЙ ================= */
  function openViewer(host, scored, points, img, opts) {
    opts = opts || {};
    if (!host) return null;

    let cur = (typeof opts.startIndex === 'number') ? opts.startIndex : 0;
    let mode = 'full';

    host.innerHTML =
      '<div class="viewer mode-full" id="fmViewer">' +
        '<div class="v-top" id="vTop">' +
          '<canvas id="vCanvas"></canvas>' +
          '<button type="button" class="v-btn v-close" id="vClose" aria-label="Закрыть">✕</button>' +
          '<button type="button" class="v-btn v-mode" id="vMode" aria-label="Режим">⬒</button>' +
          '<div class="v-nav">' +
            '<button type="button" class="v-btn" id="vPrev" aria-label="Назад">←</button>' +
            '<div class="v-counter" id="vCounter">1 / 37</div>' +
            '<button type="button" class="v-btn" id="vNext" aria-label="Вперёд">→</button>' +
          '</div>' +
        '</div>' +
        '<div class="v-caption" id="vCaption"></div>' +
        '<div class="v-list" id="vList"></div>' +
      '</div>';

    const root = host.querySelector('#fmViewer');
    const canvas = host.querySelector('#vCanvas');
    const caption = host.querySelector('#vCaption');
    const counter = host.querySelector('#vCounter');
    const list = host.querySelector('#vList');

    /* список для сплит-режима строим один раз */
    list.innerHTML = scored.items.map(function (it, i) {
      const tcss = it.tier ? TIER_CSS[it.tier] : 'tn';
      return '<div class="v-row ' + tcss + '" data-i="' + i + '">' +
          '<span class="v-n">' + it.n + '</span>' +
          '<span class="v-nm">' + it.name + '</span>' +
          '<span class="v-v">' + FM.scoring.fmt(it.value, it.unit) + '</span>' +
          '<span class="v-t">' + (it.tier || '—') + '</span>' +
        '</div>';
    }).join('');

    function paint() {
      const it = scored.items[cur];
      counter.textContent = (cur + 1) + ' / ' + scored.items.length;
      drawViz(canvas, img, it, points);
      const tcss = it.tier ? TIER_CSS[it.tier] : 'tn';
      caption.innerHTML =
        '<div class="v-name">#' + it.n + ' ' + it.name +
          ' <span class="v-tier ' + tcss + '">' + (it.tier || '—') + '</span></div>' +
        '<div class="v-val">' + FM.scoring.fmt(it.value, it.unit) +
          ' · идеал ' + FM.scoring.idealStr(it, it.unit) + '</div>' +
        '<div class="v-formula">' + ((it.viz && it.viz.formula) ? it.viz.formula : '') +
          ((it.viz && it.viz.note) ? ' · ' + it.viz.note : '') + '</div>';
      const rows = list.querySelectorAll('.v-row');
      for (let i = 0; i < rows.length; i++) {
        rows[i].classList.toggle('cur', i === cur);
      }
      const curRow = list.querySelector('.v-row.cur');
      if (curRow && curRow.scrollIntoView) curRow.scrollIntoView({ block: 'nearest' });
    }

    function go(i) {
      const n = scored.items.length;
      cur = ((i % n) + n) % n;
      paint();
    }

    function setMode(m) {
      mode = m;
      root.classList.toggle('mode-full', mode === 'full');
      root.classList.toggle('mode-split', mode === 'split');
      paint();
    }

    /* свайпы по фото */
    let tx0 = null, ty0 = null;
    function onTouchStart(e) {
      if (e.touches.length === 1) { tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; }
    }
    function onTouchEnd(e) {
      if (tx0 === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - tx0, dy = t.clientY - ty0;
      tx0 = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        go(cur + (dx < 0 ? 1 : -1));
      }
    }
    const top = host.querySelector('#vTop');
    top.addEventListener('touchstart', onTouchStart, { passive: true });
    top.addEventListener('touchend', onTouchEnd, { passive: true });

    /* кнопки и тапы по списку */
    host.querySelector('#vPrev').addEventListener('click', function () { go(cur - 1); });
    host.querySelector('#vNext').addEventListener('click', function () { go(cur + 1); });
    host.querySelector('#vClose').addEventListener('click', function () { controller.close(); });
    host.querySelector('#vMode').addEventListener('click', function () {
      setMode(mode === 'full' ? 'split' : 'full');
    });
    list.addEventListener('click', function (e) {
      const row = e.target.closest ? e.target.closest('.v-row') : null;
      if (row) go(parseInt(row.getAttribute('data-i'), 10));
    });

    /* клавиатура для отладки с десктопа */
    function onKey(e) {
      if (e.key === 'ArrowRight') go(cur + 1);
      else if (e.key === 'ArrowLeft') go(cur - 1);
      else if (e.key === 'Escape') controller.close();
    }
    global.addEventListener('keydown', onKey);

    function onResize() { paint(); }
    global.addEventListener('resize', onResize);

    const controller = {
      go: go,
      setMode: setMode,
      close: function () {
        global.removeEventListener('keydown', onKey);
        global.removeEventListener('resize', onResize);
        top.removeEventListener('touchstart', onTouchStart);
        top.removeEventListener('touchend', onTouchEnd);
        host.innerHTML = '';
        if (typeof opts.onClose === 'function') opts.onClose();
      }
    };

    paint();
    return controller;
  }

  FM.results = {
    render: render,
    openViewer: openViewer,
    drawViz: drawViz,
    buildShareText: buildShareText
  };
})(typeof window !== 'undefined' ? window : this);
