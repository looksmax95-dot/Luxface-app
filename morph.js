/* =====================================================================
   FaceMetrics — TG Mini App
   КОД 8: morph.js (v1 — движок треугольного морфа)
   ---------------------------------------------------------------------
   Реализует плавную деформацию фото по точкам.
   Алгоритм: Триангуляция Делоне (Bowyer-Watson) + Аффинное текстурирование.
   ===================================================================== */
(function (global) {
  'use strict';
  const FM = (global.FM = global.FM || {});

  /* --- Триангуляция Делоне --- */
  function triangulate(pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].x < minX) minX = pts[i].x;
      if (pts[i].y < minY) minY = pts[i].y;
      if (pts[i].x > maxX) maxX = pts[i].x;
      if (pts[i].y > maxY) maxY = pts[i].y;
    }
    const dx = maxX - minX, dy = maxY - minY;
    const deltaMax = Math.max(dx, dy) * 2;
    const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;

    // Супер-треугольник (против часовой стрелки)
    const p0 = { x: midX - 3 * deltaMax, y: midY + deltaMax, id: -1 };
    const p1 = { x: midX + 3 * deltaMax, y: midY + deltaMax, id: -2 };
    const p2 = { x: midX, y: midY - 3 * deltaMax, id: -3 };
    const allPts = [p0, p1, p2].concat(pts.map(function(p, i) { return {x: p.x, y: p.y, id: i}; }));

    let triangles = [{ p0: 0, p1: 1, p2: 2 }];

    for (let i = 3; i < allPts.length; i++) {
      const p = allPts[i];
      const badTriangles = [];
      for (let j = 0; j < triangles.length; j++) {
        const t = triangles[j];
        if (isPointInCircumcircle(p, allPts[t.p0], allPts[t.p1], allPts[t.p2])) {
          badTriangles.push(j);
        }
      }
      const polygon = [];
      for (let j = 0; j < badTriangles.length; j++) {
        const t = triangles[badTriangles[j]];
        const edges = [{ p0: t.p0, p1: t.p1 }, { p0: t.p1, p1: t.p2 }, { p0: t.p2, p1: t.p0 }];
        for (let e = 0; e < 3; e++) {
          let shared = false;
          for (let k = 0; k < badTriangles.length; k++) {
            if (k === j) continue;
            if (hasEdge(triangles[badTriangles[k]], edges[e].p0, edges[e].p1)) { shared = true; break; }
          }
          if (!shared) polygon.push(edges[e]);
        }
      }
      for (let j = badTriangles.length - 1; j >= 0; j--) triangles.splice(badTriangles[j], 1);
      for (let j = 0; j < polygon.length; j++) {
        triangles.push({ p0: polygon[j].p0, p1: polygon[j].p1, p2: i });
      }
    }
    return triangles.filter(function(t) {
      return t.p0 >= 3 && t.p1 >= 3 && t.p2 >= 3;
    }).map(function(t) {
      return [t.p0 - 3, t.p1 - 3, t.p2 - 3];
    });
  }

  function isPointInCircumcircle(p, a, b, c) {
    const ax = a.x - p.x, ay = a.y - p.y;
    const bx = b.x - p.x, by = b.y - p.y;
    const cx = c.x - p.x, cy = c.y - p.y;
    const det = (ax * ax + ay * ay) * (bx * cy - cx * by) -
                (bx * bx + by * by) * (ax * cy - cx * ay) +
                (cx * cx + cy * cy) * (ax * by - bx * ay);
    return det > 0;
  }

  function hasEdge(t, i, j) {
    return (t.p0 === i && t.p1 === j) || (t.p1 === i && t.p0 === j) ||
           (t.p1 === j && t.p2 === i) || (t.p2 === j && t.p1 === i) ||
           (t.p2 === i && t.p0 === j) || (t.p0 === i && t.p2 === j);
  }

  /* --- Аффинное преобразование (Canvas) --- */
  function getAffineTransform(dst, src) {
    const x1 = dst[0].x, y1 = dst[0].y, x2 = dst[1].x, y2 = dst[1].y, x3 = dst[2].x, y3 = dst[2].y;
    const u1 = src[0].x, v1 = src[0].y, u2 = src[1].x, v2 = src[1].y, u3 = src[2].x, v3 = src[2].y;
    const det = x1 * (y2 - y3) - y1 * (x2 - x3) + (x2 * y3 - x3 * y2);
    if (Math.abs(det) < 1e-9) return null;
    const inv = 1 / det;
    return [
      (u1 * (y2 - y3) - u2 * (y1 - y3) + u3 * (y1 - y2)) * inv, // m11
      (v1 * (y2 - y3) - v2 * (y1 - y3) + v3 * (y1 - y2)) * inv, // m12
      (u1 * (x3 - x2) + u2 * (x1 - x3) + u3 * (x2 - x1)) * inv, // m21
      (v1 * (x3 - x2) + v2 * (x1 - x3) + v3 * (x2 - x1)) * inv, // m22
      (u1 * (x2 * y3 - x3 * y2) + u2 * (x3 * y1 - x1 * y3) + u3 * (x1 * y2 - x2 * y1)) * inv, // dx
      (v1 * (x2 * y3 - x3 * y2) + v2 * (x3 * y1 - x1 * y3) + v3 * (x1 * y2 - x2 * y1)) * inv  // dy
    ];
  }

  /* --- Публичный API --- */
  let mesh = null;

  function init(realPoints, imgW, imgH) {
    const pts = [];
    let idx = 0;
    Object.keys(realPoints).forEach(function(id) {
      pts.push({ x: realPoints[id].x, y: realPoints[id].y, origId: id });
      idx++;
    });
    // Добавляем 4 угла, чтобы фото не рвалось по краям при морфе
    const m = 0;
    pts.push({ x: m, y: m, origId: 'TL' });
    pts.push({ x: imgW - m, y: m, origId: 'TR' });
    pts.push({ x: m, y: imgH - m, origId: 'BL' });
    pts.push({ x: imgW - m, y: imgH - m, origId: 'BR' });
    
    mesh = { pts: pts, tris: triangulate(pts), count: Object.keys(realPoints).length };
  }

  function render(canvas, img, realPoints, targetPoints, alpha) {
    if (!mesh) return;
    const ctx = canvas.getContext('2d');
    const dpr = global.devicePixelRatio || 1;
    const W = canvas.clientWidth || img.width;
    const H = canvas.clientHeight || img.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Интерполяция точек
    const currentPts = mesh.pts.map(function(p, i) {
      if (i >= mesh.count) return p; // углы не двигаются
      const rp = realPoints[p.origId], tp = targetPoints[p.origId];
      if (!rp || !tp) return p;
      return { x: rp.x + (tp.x - rp.x) * alpha, y: rp.y + (tp.y - rp.y) * alpha };
    });

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (let i = 0; i < mesh.tris.length; i++) {
      const t = mesh.tris[i];
      const p0 = currentPts[t[0]], p1 = currentPts[t[1]], p2 = currentPts[t[2]];
      const s0 = mesh.pts[t[0]], s1 = mesh.pts[t[1]], s2 = mesh.pts[t[2]];
      const tr = getAffineTransform([p0, p1, p2], [s0, s1, s2]);
      if (!tr) continue;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.closePath();
      ctx.clip();
      ctx.setTransform(dpr * tr[0], dpr * tr[1], dpr * tr[2], dpr * tr[3], dpr * tr[4], dpr * tr[5]);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  FM.morph = { init: init, render: render };
})(typeof window !== 'undefined' ? window : this);
