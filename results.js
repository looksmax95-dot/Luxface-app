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

  /* --- контролы морфа --- */
  const morphControls = document.createElement('div');
  morphControls.className = 'v-morph-controls';
  morphControls.id = 'vMorphControls';
  morphControls.innerHTML =
    '<div class="v-morph-labels"><span>Реальность</span><span>Идеал</span></div>' +
    '<input type="range" id="vMorphSlider" min="0" max="100" value="0" step="1">' +
    '<button type="button" class="btn sq" id="vMorphPlay" style="margin-top:8px; width:100%">▶ Авто-морф</button>';
  host.querySelector('#vTop').appendChild(morphControls);

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

    // Проверяем, включён ли морф для этой метрики
    const slider = host.querySelector('#vMorphSlider');
    const alpha = slider ? (parseInt(slider.value, 10) / 100) : 0;

    if (alpha > 0 && it.value !== null) {
      // Локальный морф: решаем идеал для этой конкретной метрики
      const localRes = FM.ideal.solveLocal(points, it.key);
      if (localRes && localRes.points) {
        FM.morph.render(canvas, img, points, localRes.points, alpha);
      } else {
        drawViz(canvas, img, it, points);
      }
    } else {
      drawViz(canvas, img, it, points);
    }

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

  /* --- морф: слайдер + play --- */
  const slider = host.querySelector('#vMorphSlider');
  const playBtn = host.querySelector('#vMorphPlay');
  let playInterval = null;

  if (slider) {
    slider.addEventListener('input', function () { paint(); });
  }
  if (playBtn) {
    playBtn.addEventListener('click', function () {
      if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
        playBtn.textContent = '▶ Авто-морф';
        return;
      }
      let t = 0;
      playBtn.textContent = '⏸ Стоп';
      playInterval = setInterval(function () {
        t += 2;
        if (t > 100) t = 0;
        if (slider) slider.value = t;
        paint();
      }, 30);
    });
  }

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
      if (playInterval) { clearInterval(playInterval); playInterval = null; }
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
