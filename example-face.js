/* ============================================================
 * example-face.js — рисует стилизованное лицо на canvas примера.
 *
 * Лицо строится по тем же координатам exampleX/exampleY, что и
 * точки в points.js, поэтому точки физически не могут «съехать»
 * с ориентиров.
 *
 * Холст примера: 100 × 130 условных единиц.
 * Все пути рисуются в этой системе, потом масштабируются под
 * фактический размер canvas (CSS-пиксели * dpr).
 *
 * Экспорт: window.ExampleFace.draw(ctx, W, H, options)
 *   options = {
 *     showPoints: true,      // рисовать ли поверх все точки
 *     highlightId: 'nose_tip' // какую точку выделить (пульсирующую)
 *   }
 * ============================================================ */

'use strict';

(function () {

  /* ==================== ГЕОМЕТРИЯ ЛИЦА ====================
   * Все координаты — в единицах 100 × 130.
   * Берём из POINTS_BY_ID, чтобы точки и линии совпадали.
   * ====================================================== */

  function P(id) {
    const p = (typeof POINTS_BY_ID !== 'undefined' && POINTS_BY_ID[id]) || null;
    if (!p) {
      console.warn('example-face.js: точка не найдена —', id);
      return { exampleX: 50, exampleY: 50 };
    }
    return p;
  }

  /* ==================== ПАЛИТРА ==================== */
  const COLORS = {
    skin:        '#2b2b2b',
    skinEdge:    '#4a4a4a',
    hair:        '#0f0f0f',
    hairEdge:    '#1c1c1c',
    brow:        '#1a1a1a',
    eye:         '#0a0a0a',
    iris:        '#3a3a3a',
    eyeOutline:  '#5a5a5a',
    nose:        '#4a4a4a',
    lips:        '#3a2a2a',
    lipsEdge:    '#5a3a3a',
    jawLine:     '#3a3a3a',
    neck:        '#2b2b2b',
    neckEdge:    '#4a4a4a',
    pointFill:   '#2ea6ff',
    pointStroke: '#ffffff',
    highlight:   '#ff3b3b',
    highlightHalo: 'rgba(255, 59, 59, 0.35)'
  };

  /* ==================== БАЗОВЫЕ ФОРМЫ ==================== */

  function fillOval(ctx, cx, cy, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function strokeOval(ctx, cx, cy, rx, ry, color, width) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function line(ctx, a, b, color, width) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /* ==================== ЧАСТИ ЛИЦА ==================== */

  function drawNeck(ctx) {
    const l = P('neck_left');
    const r = P('neck_right');
    const jl = P('gonion_left');
    const jr = P('gonion_right');

    // Шея — трапеция от углов челюсти вниз
    ctx.beginPath();
    ctx.moveTo(jl.exampleX + 4, jl.exampleY + 4);
    ctx.lineTo(l.exampleX, l.exampleY);
    ctx.lineTo(l.exampleX, 130);
    ctx.lineTo(r.exampleX, 130);
    ctx.lineTo(r.exampleX, r.exampleY);
    ctx.lineTo(jr.exampleX - 4, jr.exampleY + 4);
    ctx.closePath();
    ctx.fillStyle = COLORS.neck;
    ctx.fill();
    ctx.strokeStyle = COLORS.neckEdge;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  function drawHair(ctx) {
    const v = P('vertex');
    const hl = P('hairline');
    const tl = P('temple_left');
    const tr = P('temple_right');

    // Масса волос сверху
    ctx.beginPath();
    ctx.moveTo(tl.exampleX - 1, tl.exampleY);
    ctx.bezierCurveTo(
      tl.exampleX - 3, v.exampleY + 4,
      hl.exampleX - 14, v.exampleY - 2,
      hl.exampleX, hl.exampleY
    );
    ctx.bezierCurveTo(
      hl.exampleX + 14, v.exampleY - 2,
      tr.exampleX + 3, v.exampleY + 4,
      tr.exampleX + 1, tr.exampleY
    );
    ctx.bezierCurveTo(
      tr.exampleX + 4, tl.exampleY - 6,
      tl.exampleX - 4, tl.exampleY - 6,
      tl.exampleX - 1, tl.exampleY
    );
    ctx.closePath();
    ctx.fillStyle = COLORS.hair;
    ctx.fill();
    ctx.strokeStyle = COLORS.hairEdge;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  function drawFaceShape(ctx) {
    const tl = P('temple_left');
    const tr = P('temple_right');
    const zl = P('zygo_left');
    const zr = P('zygo_right');
    const gl = P('gonion_left');
    const gr = P('gonion_right');
    const jl = P('jaw_left');
    const jr = P('jaw_right');
    const gn = P('pogonion');
    const mt = P('menton');

    // Контур лица: висок → скула → угол челюсти → челюсть → подбородок → ... → висок
    ctx.beginPath();
    ctx.moveTo(tl.exampleX, tl.exampleY);

    // Левая сторона
    ctx.bezierCurveTo(
      tl.exampleX - 1, tl.exampleY + 6,
      zl.exampleX, zl.exampleY - 2,
      zl.exampleX, zl.exampleY
    );
    ctx.bezierCurveTo(
      zl.exampleX, zl.exampleY + 6,
      gl.exampleX - 1, gl.exampleY - 4,
      gl.exampleX, gl.exampleY
    );
    ctx.bezierCurveTo(
      gl.exampleX + 2, gl.exampleY + 6,
      jl.exampleX - 2, jl.exampleY + 2,
      jl.exampleX, jl.exampleY
    );
    ctx.bezierCurveTo(
      jl.exampleX + 4, mt.exampleY - 2,
      gn.exampleX - 5, mt.exampleY + 1,
      gn.exampleX, mt.exampleY
    );

    // Правая сторона (зеркально)
    ctx.bezierCurveTo(
      gn.exampleX + 5, mt.exampleY + 1,
      jr.exampleX - 4, mt.exampleY - 2,
      jr.exampleX, jr.exampleY
    );
    ctx.bezierCurveTo(
      jr.exampleX + 2, jr.exampleY + 2,
      gr.exampleX - 2, gr.exampleY + 6,
      gr.exampleX, gr.exampleY
    );
    ctx.bezierCurveTo(
      gr.exampleX + 1, gr.exampleY - 4,
      zr.exampleX, zr.exampleY + 6,
      zr.exampleX, zr.exampleY
    );
    ctx.bezierCurveTo(
      zr.exampleX, zr.exampleY - 2,
      tr.exampleX + 1, tr.exampleY + 6,
      tr.exampleX, tr.exampleY
    );

    ctx.closePath();
    ctx.fillStyle = COLORS.skin;
    ctx.fill();
    ctx.strokeStyle = COLORS.skinEdge;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  function drawBrows(ctx) {
    // Каждая бровь — через 3 точки: inner → peak → outer
    function drawOne(innerId, peakId, outerId) {
      const i = P(innerId);
      const p = P(peakId);
      const o = P(outerId);

      ctx.beginPath();
      ctx.moveTo(i.exampleX, i.exampleY);
      ctx.quadraticCurveTo(
        (i.exampleX + p.exampleX) / 2, p.exampleY - 1.2,
        p.exampleX, p.exampleY
      );
      ctx.quadraticCurveTo(
        (p.exampleX + o.exampleX) / 2, p.exampleY + 0.4,
        o.exampleX, o.exampleY
      );
      ctx.strokeStyle = COLORS.brow;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    drawOne('brow_left_inner',  'brow_left_peak',  'brow_left_outer');
    drawOne('brow_right_inner', 'brow_right_peak', 'brow_right_outer');
  }

  function drawEye(ctx, innerId, outerId, upperId, lowerId, pupilId) {
    const i = P(innerId);
    const o = P(outerId);
    const u = P(upperId);
    const l = P(lowerId);
    const pu = P(pupilId);

    // Миндалевидная форма: inner → upper → outer → lower → inner
    ctx.beginPath();
    ctx.moveTo(i.exampleX, i.exampleY);
    ctx.quadraticCurveTo(
      (i.exampleX + u.exampleX) / 2, u.exampleY - 0.8,
      u.exampleX, u.exampleY
    );
    ctx.quadraticCurveTo(
      (u.exampleX + o.exampleX) / 2, o.exampleY - 1.2,
      o.exampleX, o.exampleY
    );
    ctx.quadraticCurveTo(
      (o.exampleX + l.exampleX) / 2, l.exampleY + 0.8,
      l.exampleX, l.exampleY
    );
    ctx.quadraticCurveTo(
      (l.exampleX + i.exampleX) / 2, l.exampleY + 0.8,
      i.exampleX, i.exampleY
    );
    ctx.closePath();

    // Белок
    ctx.fillStyle = '#e8e8e8';
    ctx.fill();

    // Контур века
    ctx.strokeStyle = COLORS.eyeOutline;
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Радужка + зрачок
    fillOval(ctx, pu.exampleX, pu.exampleY, 2.0, 2.0, COLORS.iris);
    fillOval(ctx, pu.exampleX, pu.exampleY, 1.0, 1.0, '#000');

    // Блик
    fillOval(ctx, pu.exampleX - 0.7, pu.exampleY - 0.7, 0.4, 0.4, '#ffffff');
  }

  function drawEyes(ctx) {
    drawEye(
      ctx,
      'eye_left_inner', 'eye_left_outer',
      'eyelid_left_upper', 'eyelid_left_lower',
      'pupil_left'
    );
    drawEye(
      ctx,
      'eye_right_inner', 'eye_right_outer',
      'eyelid_right_upper', 'eyelid_right_lower',
      'pupil_right'
    );
  }

  function drawNose(ctx) {
    const r  = P('radix');
    const nm = P('nose_bridge_mid');
    const nt = P('nose_tip');
    const al = P('alar_left');
    const ar = P('alar_right');
    const sn = P('subnasale');

    // Спинка носа — левая и правая линии от переносицы к крыльям
    ctx.beginPath();
    ctx.moveTo(r.exampleX, r.exampleY);
    ctx.quadraticCurveTo(
      nm.exampleX - 1.2, nm.exampleY,
      al.exampleX - 0.5, al.exampleY - 2
    );
    ctx.strokeStyle = COLORS.nose;
    ctx.lineWidth = 0.7;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(r.exampleX, r.exampleY);
    ctx.quadraticCurveTo(
      nm.exampleX + 1.2, nm.exampleY,
      ar.exampleX + 0.5, ar.exampleY - 2
    );
    ctx.strokeStyle = COLORS.nose;
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Кончик + крылья + основание — мягкий контур
    ctx.beginPath();
    ctx.moveTo(al.exampleX, al.exampleY - 1);
    ctx.quadraticCurveTo(
      nt.exampleX - 2, nt.exampleY + 1,
      nt.exampleX, nt.exampleY
    );
    ctx.quadraticCurveTo(
      nt.exampleX + 2, nt.exampleY + 1,
      ar.exampleX, ar.exampleY - 1
    );
    ctx.quadraticCurveTo(
      ar.exampleX - 1, sn.exampleY + 0.4,
      sn.exampleX, sn.exampleY
    );
    ctx.quadraticCurveTo(
      al.exampleX + 1, sn.exampleY + 0.4,
      al.exampleX, al.exampleY - 1
    );
    ctx.closePath();
    ctx.strokeStyle = COLORS.nose;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  function drawLips(ctx) {
    const cb = P('cupid_bow');
    const ulb = P('upper_lip_bottom');
    const llb = P('lower_lip_bottom');
    const ml = P('mouth_left');
    const mr = P('mouth_right');
    const stomion = P('stomion');

    // Верхняя губа
    ctx.beginPath();
    ctx.moveTo(ml.exampleX, ml.exampleY);
    ctx.quadraticCurveTo(
      cb.exampleX - 5, cb.exampleY - 0.5,
      cb.exampleX, cb.exampleY
    );
    ctx.quadraticCurveTo(
      cb.exampleX + 5, cb.exampleY - 0.5,
      mr.exampleX, mr.exampleY
    );
    ctx.quadraticCurveTo(
      (mr.exampleX + ml.exampleX) / 2, ulb.exampleY + 0.4,
      ml.exampleX, ml.exampleY
    );
    ctx.closePath();
    ctx.fillStyle = COLORS.lips;
    ctx.fill();
    ctx.strokeStyle = COLORS.lipsEdge;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Нижняя губа
    ctx.beginPath();
    ctx.moveTo(ml.exampleX, ml.exampleY);
    ctx.quadraticCurveTo(
      (ml.exampleX + mr.exampleX) / 2, llb.exampleY + 0.6,
      mr.exampleX, mr.exampleY
    );
    ctx.quadraticCurveTo(
      (mr.exampleX + ml.exampleX) / 2, stomion.exampleY + 0.5,
      ml.exampleX, ml.exampleY
    );
    ctx.closePath();
    ctx.fillStyle = COLORS.lips;
    ctx.fill();
    ctx.strokeStyle = COLORS.lipsEdge;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Линия смыкания губ
    ctx.beginPath();
    ctx.moveTo(ml.exampleX, ml.exampleY);
    ctx.lineTo(mr.exampleX, mr.exampleY);
    ctx.strokeStyle = '#1a1010';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  function drawJawContour(ctx) {
    const gl = P('gonion_left');
    const gr = P('gonion_right');
    const jl = P('jaw_left');
    const jr = P('jaw_right');
    const gn = P('pogonion');
    const mt = P('menton');

    // Внутренняя линия челюсти — визуальный акцент
    ctx.beginPath();
    ctx.moveTo(gl.exampleX + 1, gl.exampleY + 2);
    ctx.quadraticCurveTo(
      jl.exampleX, jl.exampleY - 1,
      gn.exampleX - 6, mt.exampleY - 2
    );
    ctx.moveTo(gr.exampleX - 1, gr.exampleY + 2);
    ctx.quadraticCurveTo(
      jr.exampleX, jr.exampleY - 1,
      gn.exampleX + 6, mt.exampleY - 2
    );
    ctx.strokeStyle = COLORS.jawLine;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  /* ==================== ТОЧКИ ПОВЕРХ ЛИЦА ==================== */

  function drawAllPoints(ctx, highlightId) {
    if (typeof POINTS === 'undefined') return;
    for (const p of POINTS) {
      const isHi = (p.id === highlightId);
      const r    = isHi ? 1.8 : 1.1;

      // Ореол для выделенной точки
      if (isHi) {
        ctx.beginPath();
        ctx.arc(p.exampleX, p.exampleY, r + 2.2, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.highlightHalo;
        ctx.fill();
      }

      // Сама точка
      ctx.beginPath();
      ctx.arc(p.exampleX, p.exampleY, r, 0, Math.PI * 2);
      ctx.fillStyle = isHi ? COLORS.highlight : COLORS.pointFill;
      ctx.fill();

      // Тонкая обводка
      ctx.lineWidth = 0.4;
      ctx.strokeStyle = COLORS.pointStroke;
      ctx.stroke();
    }
  }

  /* ==================== ГЛАВНАЯ ФУНКЦИЯ ====================
   * draw(ctx, W, H, options)
   *   ctx        — 2d-контекст
   *   W, H       — размеры холста в CSS-пикселях
   *   options    — { showPoints, highlightId }
   * ====================================================== */
  function draw(ctx, W, H, options) {
    const opts = options || {};
    const showPoints  = opts.showPoints !== false;
    const highlightId = opts.highlightId || null;

    if (!ctx || !W || !H) return;

    // Масштаб: 100×130 → W×H. Сохраняем пропорции, центрируем.
    const scaleX = W / 100;
    const scaleY = H / 130;
    const s = Math.min(scaleX, scaleY);
    const offsetX = (W - 100 * s) / 2;
    const offsetY = (H - 130 * s) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(s, s);

    // Порядок слоёв важен: сзади → вперёд
    drawNeck(ctx);
    drawHair(ctx);
    drawFaceShape(ctx);
    drawBrows(ctx);
    drawEyes(ctx);
    drawNose(ctx);
    drawLips(ctx);
    drawJawContour(ctx);

    if (showPoints) {
      drawAllPoints(ctx, highlightId);
    }

    ctx.restore();
  }

  /* ==================== ЭКСПОРТ ==================== */
  window.ExampleFace = {
    draw,
    COLORS,
    CANVAS_W: 100,
    CANVAS_H: 130
  };

  console.log('example-face.js: модуль загружен');
})();
