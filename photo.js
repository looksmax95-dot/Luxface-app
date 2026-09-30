/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (38 метрик)
   КОД 4/6: photo.js (v2 — хук setOverlay для линий-подсказок)
   ---------------------------------------------------------------------
   Вьюпорт изображения на canvas: пан (1 палец), щипок-зум (2 пальца),
   колесо мыши (отладка с десктопа), прицел в центре (режим разметки),
   структурные линии (режим обзора), маркеры точек.
   НОВОЕ: vp.setOverlay(fn) — fn вызывается в конце КАЖДОГО redraw и
   получает { S, ctx, W, H, center }, где S = imageToScreen. Через него
   app.js рисует линии-подсказки текущей метрики поверх фото — они не
   стираются при пан/зуме, потому что перерисовываются каждый кадр.
   Трансформация: screen = image * s + t. Зум ограничен [0.5×fit, 14×fit].
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = (global.FM = global.FM || {});

  function create(canvas, img) {
    const ctx = canvas.getContext('2d');
    let W = 300, H = 300, dpr = 1;
    let s = 1, tx = 0, ty = 0;          /* масштаб и сдвиг */
    let fitS = 1, fitted = false;       /* базовый масштаб «вписать» */
    let points = {}, activeId = null, review = false, overlayFn = null;

    const iw = () => (img.naturalWidth || img.width || 1);
    const ih = () => (img.naturalHeight || img.height || 1);

    /* === трансформации === */
    function imageToScreen(p) { return { x: p.x * s + tx, y: p.y * s + ty }; }
    function screenToImage(x, y) { return { x: (x - tx) / s, y: (y - ty) / s }; }
    function zoomLevel() { return s / fitS; }

    function zoomBy(k, cx, cy) {
      cx = (cx == null) ? W / 2 : cx;
      cy = (cy == null) ? H / 2 : cy;
      const ns = Math.min(Math.max(fitS * 0.5, s * k), fitS * 14);
      const kk = ns / s;
      tx = cx - (cx - tx) * kk;
      ty = cy - (cy - ty) * kk;
      s = ns;
      redraw();
    }

    /* авто-зум к рекомендованному уровню точки (вокруг центра) */
    function zoomHint(z) {
      const target = fitS * z;
      if (Math.abs(target - s) / target > 0.02) zoomBy(target / s);
    }

    function resize() {
      dpr = global.devicePixelRatio || 1;
      W = canvas.clientWidth || 300;
      H = canvas.clientHeight || 300;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const rel = fitted ? s / fitS : 1;
      fitS = Math.min(W / iw(), H / ih());
      if (!fitted) {
        s = fitS;
        tx = (W - iw() * s) / 2;
        ty = (H - ih() * s) / 2;
        fitted = true;
      } else {
        const ns = fitS * rel;
        const k = ns / s;
        tx = W / 2 - (W / 2 - tx) * k;
        ty = H / 2 - (H / 2 - ty) * k;
        s = ns;
      }
      redraw();
    }

    /* === отрисовка === */
    function redraw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0f1115';
      ctx.fillRect(0, 0, W, H);

      /* фото */
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(s, s);
      ctx.drawImage(img, 0, 0, iw(), ih());
      ctx.restore();

      /* обзор: структурные линии между поставленными точками */
      if (review && FM.points && FM.points.REVIEW_LINES) {
        ctx.strokeStyle = 'rgba(0,255,170,0.5)';
        ctx.lineWidth = 1.5;
        FM.points.REVIEW_LINES.forEach(function (pr) {
          const a = points[pr[0]], b = points[pr[1]];
          if (!a || !b) return;
          const pa = imageToScreen(a), pb = imageToScreen(b);
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        });
      }

      /* маркеры точек (+ акцент на активной) */
      Object.keys(points).forEach(function (id) {
        const p = imageToScreen(points[id]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#0f1115';
        ctx.stroke();
        if (id === activeId) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
          ctx.strokeStyle = '#00ffaa';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      /* прицел (только режим разметки) */
      if (!review) {
        const cx = W / 2, cy = H / 2;
        ctx.strokeStyle = '#00ffaa';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 24, cy); ctx.lineTo(cx - 8, cy);
        ctx.moveTo(cx + 8, cy);  ctx.lineTo(cx + 24, cy);
        ctx.moveTo(cx, cy - 24); ctx.lineTo(cx, cy - 8);
        ctx.moveTo(cx, cy + 8);  ctx.lineTo(cx, cy + 24);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#00ffaa';
        ctx.fill();
      }

      /* внешний оверлей (линии-подсказки) — поверх всего, каждый кадр */
      if (typeof overlayFn === 'function') {
        overlayFn({ S: imageToScreen, ctx: ctx, W: W, H: H, center: { x: W / 2, y: H / 2 } });
      }
    }

    /* === жесты === */
    const tmap = {};
    let pinch = null;

    function store(e, rect) {
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        tmap[t.identifier] = { x: t.clientX - rect.left, y: t.clientY - rect.top };
      }
    }

    function onTouchStart(e) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      store(e, rect);
      const ids = Object.keys(tmap);
      if (ids.length === 2) {
        const a = tmap[ids[0]], b = tmap[ids[1]];
        pinch = { d: Math.hypot(b.x - a.x, b.y - a.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      }
    }

    function onTouchMove(e) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      if (e.touches.length === 1 && !pinch) {
        const t = e.touches[0];
        const prev = tmap[t.identifier];
        if (prev) {
          const nx = t.clientX - rect.left, ny = t.clientY - rect.top;
          tx += nx - prev.x;
          ty += ny - prev.y;
          tmap[t.identifier] = { x: nx, y: ny };
          redraw();
        }
      } else if (e.touches.length >= 2) {
        store(e, rect);
        const ids = Object.keys(tmap);
        const a = tmap[ids[0]], b = tmap[ids[1]];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (pinch && pinch.d > 0) {
          const k = d / pinch.d;
          const ns = Math.min(Math.max(fitS * 0.5, s * k), fitS * 14);
          const kk = ns / s;
          /* точка под старой серединой щипка уезжает в новую середину */
          tx = mx - (pinch.mx - tx) * kk;
          ty = my - (pinch.my - ty) * kk;
          s = ns;
          redraw();
        }
        pinch = { d: d, mx: mx, my: my };
      }
    }

    function onTouchEnd(e) {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        delete tmap[e.changedTouches[i].identifier];
      }
      if (Object.keys(tmap).length < 2) pinch = null;
    }

    function onWheel(e) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomBy(e.deltaY < 0 ? 1.15 : 0.87, e.clientX - rect.left, e.clientY - rect.top);
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
    canvas.addEventListener('wheel', onWheel, { passive: false });

    function destroy() {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      canvas.removeEventListener('wheel', onWheel);
    }

    const vp = {
      resize: resize,
      redraw: redraw,
      zoomBy: zoomBy,
      zoomHint: zoomHint,
      zoomLevel: zoomLevel,
      imageToScreen: imageToScreen,
      screenToImage: screenToImage,
      crosshairImagePoint: function () { return screenToImage(W / 2, H / 2); },
      setPoints: function (p) { points = p || {}; redraw(); },
      setActive: function (id) { activeId = id; redraw(); },
      setReview: function (b) { review = !!b; redraw(); },
      setOverlay: function (fn) { overlayFn = fn; redraw(); },
      imageSize: function () { return { w: iw(), h: ih() }; },
      destroy: destroy
    };

    resize();
    return vp;
  }

  FM.photo = { create: create };
})(typeof window !== 'undefined' ? window : this);
