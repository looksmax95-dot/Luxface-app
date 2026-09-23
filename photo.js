/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (32 метрики, без нейросетей)
   МОДУЛЬ 2/8: js/photo.js
   ---------------------------------------------------------------------
   Назначение: viewport изображения под прицелом.
     • трансформация: screen = image * scale + t  (tx, ty);
     • жесты: 1 палец = панорама, 2 пальца (pinch) = зум+панорама;
       мышь/колесо — для отладки с десктопа;
     • прицел НЕПОДВИЖЕН в центре canvas; зум якорится в центр,
       поэтому цель под прицелом не «уезжает» при приближении;
     • кламп панорамы: центр экрана всегда внутри границ фото —
       поставить точку за пределами лица невозможно;
     • отрисовка: фото, маркеры точек, линии обзора, прицел;
       размеры маркеров/линий постоянны в ЭКРАННЫХ px (не масштабируются);
     • плавный авто-зум до рекомендованного уровня точки (zoomHint).
   API: FM.photo.create(canvas, img) -> viewport (см. конец файла).
   Зависимости: нет. DOM: только переданный canvas.
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = (global.FM = global.FM || {});

  const MIN_ZOOM = 0.7;    /* относительно fit-масштаба */
  const MAX_ZOOM = 14.0;
  const MARKER_R = 5;      /* экранного px */
  const CROSS_R = 14;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function create(canvas, img) {
    const ctx = canvas.getContext('2d');
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    /* --- состояние viewport --- */
    let W = 0, H = 0, dpr = 1;          /* CSS-размеры canvas и плотность px */
    let fitScale = 1;                   /* масштаб «всё лицо в кадре»        */
    let scale = 1, tx = 0, ty = 0;      /* текущая трансформация             */
    let pointsMap = {};                 /* ссылка на хранилище точек app.js  */
    let activeId = null;                /* точка, которую ставим сейчас      */
    let review = false;                 /* режим обзора: линии + подписи     */
    let anim = null;                    /* {from,to,t0,dur} авто-зума        */
    let destroyed = false;

    /* ================= РАЗМЕР / МАСШТАБ ================= */
    function resize() {
      dpr = global.devicePixelRatio || 1;
      W = canvas.clientWidth || 300;
      H = canvas.clientHeight || 300;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const prevFit = fitScale;
      fitScale = Math.min(W / iw, H / ih);
      if (prevFit > 0) {                 /* сохраняем относительный зум */
        scale = scale / prevFit * fitScale;
      } else {
        scale = fitScale;
      }
      clampPan();
      redraw();
    }

    function zoomLevel() { return scale / fitScale; }

    function clampPan() {
      scale = clamp(scale, fitScale * MIN_ZOOM, fitScale * MAX_ZOOM);
      const cx = W / 2, cy = H / 2;      /* прицел всегда внутри фото */
      tx = clamp(tx, cx - iw * scale, cx);
      ty = clamp(ty, cy - ih * scale, cy);
    }

    /* ================= ПРЕОБРАЗОВАНИЯ ================= */
    function imageToScreen(p) { return { x: p.x * scale + tx, y: p.y * scale + ty }; }
    function screenToImage(x, y) { return { x: (x - tx) / scale, y: (y - ty) / scale }; }
    function crosshairImagePoint() {
      const p = screenToImage(W / 2, H / 2);
      return { x: clamp(p.x, 0, iw), y: clamp(p.y, 0, ih) };
    }

    /* Зум с якорем: экранный пин (sx,sy) остаётся над той же точкой фото */
    function zoomAt(sx, sy, newScale) {
      const ns = clamp(newScale, fitScale * MIN_ZOOM, fitScale * MAX_ZOOM);
      const ip = screenToImage(sx, sy);
      scale = ns;
      tx = sx - ip.x * scale;
      ty = sy - ip.y * scale;
      clampPan();
    }

    function zoomBy(f) {
      stopAnim();
      zoomAt(W / 2, H / 2, scale * f);   /* якорь = прицел */
      redraw();
    }

    function panBy(dx, dy) {
      stopAnim();
      tx += dx; ty += dy;
      clampPan();
      redraw();
    }

    /* Плавный выход на рекомендованный зум точки (z из points.js) */
    function zoomHint(z, dur) {
      const target = clamp(fitScale * (z || 1), fitScale * MIN_ZOOM, fitScale * MAX_ZOOM);
      if (Math.abs(target - scale) < 1e-6) return;
      anim = { from: scale, to: target, t0: performance.now(), dur: dur || 260 };
      requestAnimationFrame(stepAnim);
    }
    function stopAnim() { anim = null; }
    function stepAnim(now) {
      if (!anim || destroyed) return;
      let p = (now - anim.t0) / anim.dur;
      if (p >= 1) { p = 1; }
      const e = 1 - Math.pow(1 - p, 3);  /* easeOutCubic */
      zoomAt(W / 2, H / 2, anim.from + (anim.to - anim.from) * e);
      redraw();
      if (p < 1) { requestAnimationFrame(stepAnim); } else { anim = null; }
    }

    /* ================= ОТРИСОВКА ================= */
    function redraw() {
      if (destroyed) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0f1115';
      ctx.fillRect(0, 0, W, H);

      /* фото */
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, iw, ih);
      ctx.restore();

      /* направляющие через прицел (помогают ловить горизонталь) */
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
      ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
      ctx.stroke();

      /* линии обзора */
      if (review && FM.points) {
        ctx.strokeStyle = 'rgba(0,255,170,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        FM.points.REVIEW_LINES.forEach(function (ln) {
          const a = pointsMap[ln[0]], b = pointsMap[ln[1]];
          if (!a || !b) return;
          const sa = imageToScreen(a), sb = imageToScreen(b);
          ctx.moveTo(sa.x, sa.y);
          ctx.lineTo(sb.x, sb.y);
        });
        ctx.stroke();
      }

      /* маркеры поставленных точек */
      const ids = Object.keys(pointsMap);
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const s = imageToScreen(pointsMap[id]);
        ctx.beginPath();
        ctx.arc(s.x, s.y, MARKER_R, 0, Math.PI * 2);
        ctx.fillStyle = (id === activeId) ? '#ffd75e' : '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#0f1115';
        ctx.stroke();
        if (review) {
          ctx.font = '10px monospace';
          ctx.fillStyle = 'rgba(0,255,170,0.9)';
          ctx.fillText(id, s.x + MARKER_R + 3, s.y - MARKER_R - 2);
        }
      }

      /* прицел поверх всего */
      const cx = W / 2, cy = H / 2;
      ctx.strokeStyle = '#00ffaa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, CROSS_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - CROSS_R - 8, cy); ctx.lineTo(cx - CROSS_R + 4, cy);
      ctx.moveTo(cx + CROSS_R - 4, cy); ctx.lineTo(cx + CROSS_R + 8, cy);
      ctx.moveTo(cx, cy - CROSS_R - 8); ctx.lineTo(cx, cy - CROSS_R + 4);
      ctx.moveTo(cx, cy + CROSS_R - 4); ctx.lineTo(cx, cy + CROSS_R + 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#00ffaa';
      ctx.fill();
    }

    /* ================= ЖЕСТЫ (touch) ================= */
    let mode = 'none';                  /* 'pan' | 'pinch' */
    let t0 = null;                      /* старт-панорама */
    let pinch = null;                   /* старт-pinch */

    function touchPos(e) {
      const r = canvas.getBoundingClientRect();
      const out = [];
      for (let i = 0; i < e.touches.length; i++) {
        out.push({ x: e.touches[i].clientX - r.left, y: e.touches[i].clientY - r.top });
      }
      return out;
    }

    function onStart(e) {
      e.preventDefault();
      stopAnim();
      const p = touchPos(e);
      if (p.length === 1) {
        mode = 'pan';
        t0 = { x: p[0].x, y: p[0].y, tx: tx, ty: ty };
      } else if (p.length >= 2) {
        mode = 'pinch';
        pinch = {
          d0: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1,
          m0: { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 },
          s0: scale, t0x: tx, t0y: ty
        };
      }
    }

    function onMove(e) {
      e.preventDefault();
      const p = touchPos(e);
      if (mode === 'pan' && p.length === 1 && t0) {
        tx = t0.tx + (p[0].x - t0.x);
        ty = t0.ty + (p[0].y - t0.y);
        clampPan();
        redraw();
      } else if (mode === 'pinch' && p.length >= 2 && pinch) {
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
        const m = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
        const ns = clamp(pinch.s0 * (d / pinch.d0), fitScale * MIN_ZOOM, fitScale * MAX_ZOOM);
        /* точка фото под стартовым центром пальцев уходит под текущий центр */
        const ipx = (pinch.m0.x - pinch.t0x) / pinch.s0;
        const ipy = (pinch.m0.y - pinch.t0y) / pinch.s0;
        scale = ns;
        tx = m.x - ipx * scale;
        ty = m.y - ipy * scale;
        clampPan();
        redraw();
      }
    }

    function onEnd(e) {
      if (e.touches.length === 0) { mode = 'none'; t0 = null; pinch = null; }
      else if (e.touches.length === 1) {
        const r = canvas.getBoundingClientRect();
        mode = 'pan';
        t0 = { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top, tx: tx, ty: ty };
        pinch = null;
      }
    }

    /* ================= ЖЕСТЫ (мышь, отладка) ================= */
    let mouse = null;
    function onMouseDown(e) {
      e.preventDefault();
      stopAnim();
      mouse = { x: e.offsetX, y: e.offsetY, tx: tx, ty: ty };
    }
    function onMouseMove(e) {
      if (!mouse) return;
      tx = mouse.tx + (e.offsetX - mouse.x);
      ty = mouse.ty + (e.offsetY - mouse.y);
      clampPan();
      redraw();
    }
    function onMouseUp() { mouse = null; }
    function onWheel(e) {
      e.preventDefault();
      stopAnim();
      zoomAt(e.offsetX, e.offsetY, scale * (e.deltaY < 0 ? 1.15 : 0.87));
      redraw();
    }

    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd);
    canvas.addEventListener('touchcancel', onEnd);
    canvas.addEventListener('mousedown', onMouseDown);
    global.addEventListener('mousemove', onMouseMove);
    global.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    /* ================= ПУБЛИЧНЫЙ VIEWPORT ================= */
    const vp = {
      resize: resize,
      redraw: redraw,
      zoomBy: zoomBy,
      zoomHint: zoomHint,
      panBy: panBy,
      zoomLevel: zoomLevel,
      imageToScreen: imageToScreen,
      screenToImage: screenToImage,
      crosshairImagePoint: crosshairImagePoint,
      setPoints: function (m) { pointsMap = m || {}; redraw(); },
      setActive: function (id) { activeId = id; redraw(); },
      setReview: function (on) { review = !!on; redraw(); },
      imageSize: function () { return { w: iw, h: ih }; },
      destroy: function () {
        destroyed = true;
        stopAnim();
        canvas.removeEventListener('touchstart', onStart);
        canvas.removeEventListener('touchmove', onMove);
        canvas.removeEventListener('touchend', onEnd);
        canvas.removeEventListener('touchcancel', onEnd);
        canvas.removeEventListener('mousedown', onMouseDown);
        global.removeEventListener('mousemove', onMouseMove);
        global.removeEventListener('mouseup', onMouseUp);
        canvas.removeEventListener('wheel', onWheel);
      }
    };

    resize();                            /* первичная подгонка под canvas */
    return vp;
  }

  FM.photo = { create: create };
})(typeof window !== 'undefined' ? window : this);
