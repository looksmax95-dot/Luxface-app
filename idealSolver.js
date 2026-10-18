/* =====================================================================
   FaceMetrics — TG Mini App
   КОД 7: idealSolver.js (v1 — решатель идеальных координат)
   ---------------------------------------------------------------------
   Задача: по 38 реальным точкам найти ТОЧКИ, при которых метрика
   попадает в T1. Никаких готовых «идеальных лиц» — только численная
   оптимизация поверх существующего реестра FM.metrics.

   ДВА РЕЖИМА:
     solveLocal(points, key)  — одна метрика. Двигаются ТОЛЬКО точки
                                из её req. Цель = середина полосы T1.
     solveGlobal(points)      — все метрики. Двигается всё. Цель =
                                вернуть вылетевшее в T1 (hinge-loss).
                                То, что УЖЕ в T1, не трогаем — это
                                критично для сохранения узнаваемости.

   КЛЮЧЕВЫЕ РЕШЕНИЯ:
     1. Симметричный базис переменных. Точки L/R двигаются ЗЕРКАЛЬНО:
        либо обе наружу/внутрь (x), либо обе вверх/вниз (y).
        Почему: иначе решатель «чинит» только один глаз, потому что
        это математически дешевле. Лицо становится кривым.
        Мы сохраняем исходную асимметрию лица, но КОРРЕКЦИЯ симметрична.
     2. Якоря PUP_L / PUP_R заморожены полностью. Зрачки — это
        идентичность и взгляд. Морфить их нельзя.
     3. Средние точки (TR, GL, SN, LS, GN, N) заморожены по X.
        Они двигаются только по вертикали. Ось лица не гуляет.
     4. Нормировка каждой метрики = её полный тиер-размах / 10.
        Так градусы, проценты и ratios становятся сравнимыми.
     5. Регуляризация смещения + жёсткий cap на каждую точку.
        Решатель не имеет права превратить человека в другого человека.
     6. Projector: после каждого шага проверяем топологию.
        Левая точка не может улететь правее правой, верхнее веко —
        ниже нижнего, TR выше GL выше SN выше LS выше GN.

   solver = Levenberg–Marquardt с конечными разностями и РЕДКИМ
   якобианом: для метрики дифференцируем только её собственные точки.
   Это ~600 вычислений на итерацию вместо ~26000.

   НАСТРАИВАЕМЫЕ КОНСТАНТЫ — в DEFAULTS / LOCAL_OPTS / GLOBAL_OPTS.
   Их крутить по реальным фото, не по таблице.
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = (global.FM = global.FM || {});

  /* ================= КОНФИГ ================= */

  /* Точки, которые лежат на сагиттальной оси.
     Если в points.js у какой-то из них другой смысл — убери из списка. */
  const MIDLINE = ['TR', 'GL', 'SN', 'LS', 'GN', 'N'];

  /* Точки, которые не двигаются НИ ПРИ КАКИХ ОБСТОЯТЕЛЬСТВАХ. */
  const ANCHORS = ['PUP_L', 'PUP_R'];

  /* Порядок средних точек сверху вниз — для защиты от инверсии лица. */
  const CHAIN = ['TR', 'GL', 'SN', 'LS', 'GN'];

  /* Целевая политика там, где «середина T1» — не идеал. */
  const TARGET_POLICY = {
    Thirds: 'min'   // это МЕТРИКА ОШИБКИ: 0 лучше, чем 1.5
  };

  const DEFAULTS = {
    reg: 0.8,        // сила пружины, тянущей точку домой
    maxMove: 0.14,   // макс. смещение точки, в долях ширины лица
    maxIter: 70,     // макс. итераций LM
    step: 0.03,      // макс. шаг за итерацию, в долях ширины лица
    eps: 0.0001      // шаг конечной разности, в долях ширины лица
  };

  const LOCAL_OPTS = {
    reg: 0.12,       // локально мы РАЗРЕШАЕМ двигать смелее
    maxMove: 0.22,
    maxIter: 50
  };

  /* ================= ЦЕЛИ И МАСШТАБЫ ================= */

  function t1(m) {
    const src = m.tiers || m.ideal;
    const b = FM.scoring.bandsOf(src && src.T1);
    return b.length ? b[0] : null;
  }

  function hasT5(m, sign) {
    const t5 = m.tiers && m.tiers.T5;
    return Array.isArray(t5) && t5.some(function (s) {
      return typeof s === 'string' && s.charAt(0) === sign;
    });
  }

  /* Куда именно хотим прийти по этой метрике. */
  function targetOf(m) {
    const b = t1(m);
    if (!b) return null;

    const policy = TARGET_POLICY[m.key];
    if (policy === 'min') return b[0];
    if (policy === 'max') return b[1];

    /* Односторонние тиеры: идеал — на краю полосы, не в её центре.
       Пример: bSet T1=[0, .66], T5=['>1.50'] → идеал .66, а не .33. */
    if (!hasT5(m, '<') && b[0] <= 0) return b[1];
    if (!hasT5(m, '>') && b[1] >= 100) return b[0];

    return (b[0] + b[1]) / 2;
  }

  /* Полный размах всех тиеров метрики. */
  function spanOf(m) {
    let lo = Infinity, hi = -Infinity;
    ['T1', 'T2', 'T3', 'T4'].forEach(function (t) {
      FM.scoring.bandsOf(m.tiers && m.tiers[t]).forEach(function (b) {
        lo = Math.min(lo, b[0]); hi = Math.max(hi, b[1]);
      });
    });
    const t5 = m.tiers && m.tiers.T5;
    if (Array.isArray(t5)) {
      t5.forEach(function (s) {
        if (typeof s !== 'string') return;
        const v = parseFloat(s.replace(/^[<>]=?/, ''));
        if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      });
    }
    return isFinite(lo) && isFinite(hi) && hi - lo > 1e-9 ? hi - lo : null;
  }

  /* Одна единица残 = 10% полного тиер-размаха.
     FWHR: .48/10 = .048 | CanthalTilt: 16/10 = 1.6 | Thirds: 10/10 = 1 */
  function scaleOf(m) {
    const span = spanOf(m);
    if (span) return span / 10;
    const target = targetOf(m);
    return Math.max(Math.abs(target || 1) * 0.08, 1e-4);
  }

  /* ================= ГЕОМЕТРИЧЕСКИЙ БАЗИС ================= */

  function clonePts(p) {
    const o = {};
    Object.keys(p).forEach(function (id) {
      if (p[id] && isFinite(p[id].x) && isFinite(p[id].y)) {
        o[id] = { x: p[id].x, y: p[id].y };
      }
    });
    return o;
  }

  function faceWidth(pts) {
    if (pts.ZY_L && pts.ZY_R) {
      const w = Math.hypot(pts.ZY_L.x - pts.ZY_R.x, pts.ZY_L.y - pts.ZY_R.y);
      if (w > 1) return w;
    }
    const xs = Object.keys(pts).map(function (k) { return pts[k].x; });
    return Math.max(1, Math.max.apply(null, xs) - Math.min.apply(null, xs));
  }

  /*
    Вместо переменных «координата точки» используем переменные
    «симметричное движение пары».

    pair-x:  x_L -= d ; x_R += d     (раскрытие/сужение пары)
    pair-y:  y_L += d ; y_R += d     (совместный вертикальный сдвиг)
    single:  одна координата одной точки
    midline: только y средней точки

    Каждый var — это список {idx, sign}, где idx — слот в плоском
    массиве координат. Так якобиан строится ровно по этому базису.
  */
  function buildBasis(pts, allowed) {
    const home = clonePts(pts);
    const ids = Object.keys(home);
    const slots = [];
    const index = {};

    ids.forEach(function (id) {
      index[id] = { x: slots.length, y: slots.length + 1 };
      slots.push({ id: id, axis: 'x' });
      slots.push({ id: id, axis: 'y' });
    });

    const isAnchor = function (id) { return ANCHORS.indexOf(id) >= 0; };
    const isMid = function (id) { return MIDLINE.indexOf(id) >= 0; };
    const movable = ids.filter(function (id) {
      return !isAnchor(id) && (!allowed || allowed.indexOf(id) >= 0);
    });
    const movableSet = {};
    movable.forEach(function (id) { movableSet[id] = true; });

    const vars = [];
    const used = {};

    function add(cols, label) { vars.push({ cols: cols, label: label }); }

    movable.forEach(function (id) {
      if (used[id]) return;

      /* Средняя точка: только вертикаль. */
      if (isMid(id)) {
        used[id] = true;
        add([{ idx: index[id].y, sign: 1 }], id + ':y');
        return;
      }

      /* Зеркальная пара. */
      if (/^.*_L$/.test(id)) {
        const rid = id.slice(0, -2) + '_R';
        if (home[rid] && movableSet[rid] && !used[rid]) {
          used[id] = used[rid] = true;
          add([
            { idx: index[id].x, sign: -1 },
            { idx: index[rid].x, sign: +1 }
          ], id + '/R:out');
          add([
            { idx: index[id].y, sign: +1 },
            { idx: index[rid].y, sign: +1 }
          ], id + '/R:down');
          return;
        }
      }

      /* Одиночная точка. */
      used[id] = true;
      add([{ idx: index[id].x, sign: 1 }], id + ':x');
      add([{ idx: index[id].y, sign: 1 }], id + ':y');
    });

    const regSlots = [];
    slots.forEach(function (s, i) {
      if (movableSet[s.id] && !(isMid(s.id) && s.axis === 'x')) {
        regSlots.push(i);
      }
    });

    return {
      home: home, slots: slots, index: index,
      vars: vars, movable: movable, regSlots: regSlots,
      W: faceWidth(home)
    };
  }

  function slotVal(work, basis, idx) {
    const s = basis.slots[idx];
    return work[s.id][s.axis];
  }

  function applyVar(work, basis, v, d) {
    v.cols.forEach(function (c) {
      const s = basis.slots[c.idx];
      work[s.id][s.axis] += c.sign * d;
    });
  }

  /* ================= ВЫЧИСЛЕНИЕ МЕТРИКИ ================= */

  /* Прямо в реестр. Ни одной продублированной формулы. */
  function readMetric(m, work) {
    for (let i = 0; i < m.req.length; i++) {
      const p = work[m.req[i]];
      if (!p || !isFinite(p.x) || !isFinite(p.y)) return null;
    }
    try {
      const v = m.calc(work);
      return isFinite(v) ? v : null;
    } catch (e) { return null; }
  }

  /* Ненормированная残 в единицах метрики. */
  function violation(m, value, mode) {
    if (mode === 'local') {
      const target = targetOf(m);
      return target === null ? null : value - target;
    }
    /* global: hinge. Внутри T1 — ноль, лицо не трогаем. */
    const b = t1(m);
    if (!b) return null;
    if (value < b[0]) return value - b[0];
    if (value > b[1]) return value - b[1];
    return 0;
  }

  /* ================= ПРОЕКЦИЯ / ЗАЩИТА ТОПОЛОГИИ ================= */

  function project(basis, work, o) {
    const home = basis.home;
    const W = basis.W;
    const maxMove = o.maxMove * W;

    /* 1. Жёсткий cap смещения каждой точки. */
    basis.movable.forEach(function (id) {
      const p = work[id], h = home[id];
      const dx = p.x - h.x, dy = p.y - h.y;
      const d = Math.hypot(dx, dy);
      if (d > maxMove && d > 0) {
        const k = maxMove / d;
        p.x = h.x + dx * k;
        p.y = h.y + dy * k;
      }
    });

    const anchor = function (a, b) {
      return ANCHORS.indexOf(a) >= 0 || ANCHORS.indexOf(b) >= 0;
    };

    /* 2. Левая пара всегда левее правой. */
    Object.keys(home).forEach(function (id) {
      if (!/_L$/.test(id)) return;
      const rid = id.slice(0, -2) + '_R';
      if (!work[id] || !work[rid] || anchor(id, rid)) return;
      const hd = Math.abs(home[rid].x - home[id].x);
      const gap = Math.max(hd * 0.12, W * 0.002);
      const l = work[id], r = work[rid];
      if (r.x - l.x < gap) {
        const mid = (l.x + r.x) / 2;
        l.x = mid - gap / 2;
        r.x = mid + gap / 2;
      }
    });

    /* 3. Верхнее веко всегда выше нижнего. */
    ['L', 'R'].forEach(function (s) {
      const u = 'UL_' + s, l = 'LL_' + s;
      if (!work[u] || !work[l] || anchor(u, l)) return;
      const hd = Math.abs(home[l].y - home[u].y);
      const gap = Math.max(hd * 0.12, W * 0.002);
      if (work[l].y - work[u].y < gap) {
        const mid = (work[l].y + work[u].y) / 2;
        work[u].y = mid - gap / 2;
        work[l].y = mid + gap / 2;
      }
    });

    /* 4. Средневая линия не инвертируется. */
    for (let i = 0; i < CHAIN.length - 1; i++) {
      const a = CHAIN[i], b = CHAIN[i + 1];
      if (!work[a] || !work[b] || !home[a] || !home[b]) continue;
      const hd = Math.abs(home[b].y - home[a].y);
      const gap = Math.max(hd * 0.15, W * 0.005);
      if (work[b].y - work[a].y < gap) {
        const mid = (work[b].y + work[a].y) / 2;
        work[a].y = mid - gap / 2;
        work[b].y = mid + gap / 2;
      }
    }

    /* 5. Опциональные границы изображения. */
    if (o.bounds) {
      Object.keys(work).forEach(function (id) {
        const p = work[id];
        p.x = Math.max(0, Math.min(o.bounds.w, p.x));
        p.y = Math.max(0, Math.min(o.bounds.h, p.y));
      });
    }
  }

  /* ================= ЛИНЕЙНАЯ АЛГЕБРА ================= */

  /* Гаусс с выбором главного элемента. n ~ 30–40, хватает за глаза. */
  function solveLinear(A, b) {
    const n = b.length;
    if (!n) return [];
    const M = [];
    for (let i = 0; i < n; i++) {
      const row = new Array(n + 1);
      for (let j = 0; j < n; j++) row[j] = A[i][j];
      row[n] = b[i];
      M.push(row);
    }

    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
      }
      if (Math.abs(M[pivot][col]) < 1e-12) return null;
      if (pivot !== col) { const tmp = M[pivot]; M[pivot] = M[col]; M[col] = tmp; }

      const pv = M[col][col];
      for (let r = col + 1; r < n; r++) {
        const k = M[r][col] / pv;
        if (!k) continue;
        M[r][col] = 0;
        for (let c = col + 1; c <= n; c++) M[r][c] -= k * M[col][c];
      }
    }

    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = M[i][n];
      for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
      if (!isFinite(x[i])) return null;
    }
    return x;
  }

  /* ================= РЕШАТЕЛЬ ================= */

  function optimize(basis, tasks, o) {
    const W = basis.W;
    const eps = Math.max(W * o.eps, 0.02);
    const maxStep = o.step * W;
    const regK = o.reg / W;

    let work = clonePts(basis.home);
    const nv = basis.vars.length;

    function energy(w) {
      let s = 0;
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        const v = readMetric(t.m, w);
        if (v === null) continue;
        const res = violation(t.m, v, t.mode);
        if (res === null) continue;
        const r = res / t.scale;
        s += t.weight * r * r;
      }
      /* Пружина домой. */
      for (let i = 0; i < basis.regSlots.length; i++) {
        const idx = basis.regSlots[i];
        const d = slotVal(w, basis, idx) - slotVal(basis.home, basis, idx);
        s += (regK * d) * (regK * d);
      }
      return s;
    }

    /* Редкий якобиан: дифференцируем только vars,
       которые задевают точки этой метрики. */
    function rowOf(t) {
      const m = t.m;
      const base = readMetric(m, work);
      if (base === null) return null;

      const res = violation(m, base, t.mode);
      if (res === null) return null;

      const needed = {};
      m.req.forEach(function (id) { needed[id] = true; });

      const row = new Array(nv).fill(0);
      let any = false;

      for (let vi = 0; vi < nv; vi++) {
        const v = basis.vars[vi];
        let touches = false;
        for (let k = 0; k < v.cols.length; k++) {
          if (needed[basis.slots[v.cols[k].idx].id]) { touches = true; break; }
        }
        if (!touches) continue;

        applyVar(work, basis, v, eps);
        const v1 = readMetric(m, work);
        applyVar(work, basis, v, -eps);

        if (v1 !== null) {
          row[vi] = (v1 - base) / eps / t.scale;
          any = true;
        }
      }
      if (!any) return null;

      return { row: row, r: res / t.scale, w: t.weight };
    }

    let cur = energy(work);
    let lambda = 1e-3;
    let iterations = 0;

    for (let it = 0; it < o.maxIter; it++) {
      iterations = it + 1;

      const A = [];
      for (let i = 0; i < nv; i++) A.push(new Array(nv).fill(0));
      const g = new Array(nv).fill(0);

      function addRow(row, r, weight) {
        for (let i = 0; i < nv; i++) {
          if (!row[i]) continue;
          const a = weight * row[i] * r;
          g[i] -= a;
          for (let j = 0; j < nv; j++) {
            if (row[j]) A[i][j] += a * row[j];
          }
        }
      }

      let active = 0;
      for (let i = 0; i < tasks.length; i++) {
        const rr = rowOf(tasks[i]);
        if (!rr) continue;
        if (Math.abs(rr.r) < 1e-9) continue;
        addRow(rr.row, rr.r, rr.w);
        active++;
      }

      /* Регуляризация как отдельные псевдо-строки. */
      for (let si = 0; si < basis.regSlots.length; si++) {
        const idx = basis.regSlots[si];
        const d = slotVal(work, basis, idx) - slotVal(basis.home, basis, idx);
        const r = regK * d;
        if (Math.abs(r) < 1e-12) continue;
        for (let vi = 0; vi < nv; vi++) {
          const v = basis.vars[vi];
          let coeff = 0;
          for (let k = 0; k < v.cols.length; k++) {
            if (v.cols[k].idx === idx) coeff += v.cols[k].sign * regK;
          }
          if (!coeff) continue;
          g[vi] -= coeff * r;
          for (let vj = 0; vj < nv; vj++) {
            const w = basis.vars[vj];
            let c2 = 0;
            for (let k = 0; k < w.cols.length; k++) {
              if (w.cols[k].idx === idx) c2 += w.cols[k].sign * regK;
            }
            A[vi][vj] += coeff * c2;
          }
        }
      }

      if (!active) break;

      let accepted = false;
      let improvement = 0;

      for (let trial = 0; trial < 8; trial++) {
        const D = [];
        for (let i = 0; i < nv; i++) {
          D.push(A[i].slice());
          D[i][i] += lambda * (Math.abs(A[i][i]) + 1e-8) + 1e-10;
        }

        const delta = solveLinear(D, g);
        if (!delta) { lambda *= 8; continue; }

        const cand = clonePts(work);
        for (let vi = 0; vi < nv; vi++) {
          let d = delta[vi];
          if (!isFinite(d)) { d = 0; }
          if (d > maxStep) d = maxStep;
          if (d < -maxStep) d = -maxStep;
          applyVar(cand, basis, basis.vars[vi], d);
        }
        project(basis, cand, o);

        const next = energy(cand);
        if (next < cur - 1e-12) {
          improvement = cur - next;
          cur = next;
          work = cand;
          lambda = Math.max(1e-6, lambda * 0.35);
          accepted = true;
          break;
        }
        lambda *= 4;
      }

      if (!accepted) break;
      if (improvement < 1e-8 * Math.max(1, cur)) break;
    }

    project(basis, work, o);
    return { points: work, iterations: iterations, energy: cur };
  }

  /* ================= ПУБЛИЧНЫЙ API ================= */

  function solveLocal(points, key, opts) {
    const m = FM.metrics.byKey(key);
    if (!m) return { ok: false, reason: 'unknown metric', points: clonePts(points) };

    const target = targetOf(m);
    if (target === null) return { ok: false, reason: 'no T1', points: clonePts(points) };

    const o = Object.assign({}, DEFAULTS, LOCAL_OPTS, opts || {});
    const before = readMetric(m, points);

    /* Двигаем ТОЛЬКО точки этой метрики. Остальное — бетон. */
    const basis = buildBasis(points, m.req.slice());
    if (!basis.vars.length) {
      return { ok: false, reason: 'all points are anchors', points: clonePts(points) };
    }

    const res = optimize(basis, [{
      m: m, mode: 'local', scale: scaleOf(m), weight: 1
    }], o);

    const after = readMetric(m, res.points);
    const tier = after === null ? null : FM.scoring.tierOf(m, after);

    return {
      ok: tier === 'T1',
      points: res.points,
      key: key,
      before: before,
      after: after,
      target: target,
      tier: tier,
      iterations: res.iterations,
      moved: movedList(basis, res.points)
    };
  }

  function solveGlobal(points, opts) {
    const o = Object.assign({}, DEFAULTS, GLOBAL_OPTS(opts), opts || {});
    const basis = buildBasis(points, null);

    const tasks = [];
    FM.metrics.METRICS.forEach(function (m) {
      const v = readMetric(m, points);
      if (v === null) return;
      if (t1(m) === null) return;
      tasks.push({
        m: m, mode: 'global',
        scale: scaleOf(m),
        weight: (FM.scoring.WEIGHTS[m.key] || 1)
      });
    });

    const before = countT1(points);
    const res = optimize(basis, tasks, o);
    const after = countT1(res.points);

    return {
      ok: after.t1 > before.t1,
      points: res.points,
      before: before,
      after: after,
      iterations: res.iterations,
      energy: res.energy,
      moved: movedList(basis, res.points)
    };
  }

  /* Мягче глобального пружина — узнаваемость важнее идеала. */
  function GLOBAL_OPTS(opts) {
    if (opts && opts.reg != null) return {};
    return { reg: 0.9, maxMove: 0.12, maxIter: 80 };
  }

  function countT1(pts) {
    const out = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0, missing: 0 };
    FM.metrics.METRICS.forEach(function (m) {
      const v = readMetric(m, pts);
      if (v === null) { out.missing++; return; }
      const t = FM.scoring.tierOf(m, v);
      if (out[t] != null) out[t]++;
    });
    return out;
  }

  function movedList(basis, pts) {
    const out = [];
    basis.movable.forEach(function (id) {
      const h = basis.home[id], p = pts[id];
      const dx = p.x - h.x, dy = p.y - h.y;
      if (Math.hypot(dx, dy) > 0.05) {
        out.push({ id: id, dx: dx, dy: dy, d: Math.hypot(dx, dy) });
      }
    });
    return out.sort(function (a, b) { return b.d - a.d; });
  }

  /* Линейная интерполяция между реальным и идеальным набором.
     Это то, что дёргает слайдер. α ∈ [0, 1]. */
  function blend(real, ideal, alpha) {
    const a = Math.max(0, Math.min(1, alpha));
    const out = clonePts(real);
    Object.keys(out).forEach(function (id) {
      const p = ideal && ideal[id];
      if (!p) return;
      out[id].x += (p.x - out[id].x) * a;
      out[id].y += (p.y - out[id].y) * a;
    });
    return out;
  }

  /* ================= ДИАГНОСТИКА ================= */

  /* Проверка реестра: есть ли у всех метрик цель и масштаб. */
  function audit() {
    const rows = [];
    FM.metrics.METRICS.forEach(function (m) {
      const target = targetOf(m);
      rows.push({
        n: m.n, key: m.key,
        target: target === null ? 'НЕТ T1' : +target.toFixed(4),
        scale: +scaleOf(m).toFixed(5),
        points: m.req.length,
        free: buildBasis(sampleOrEmpty(m.req), m.req).vars.length
      });
    });
    if (console.table) console.table(rows);
    return rows;
  }

  function sampleOrEmpty(req) {
    /* Для аудита базиса координаты не важны, только состав точек. */
    const p = {};
    req.forEach(function (id, i) { p[id] = { x: i * 10, y: i * 5 }; });
    return p;
  }

  /* Прогон всех 38 локальных решателей на РЕАЛЬНЫХ точках.
     Использование: FM.ideal.bench(window.__fmPoints) */
  function bench(points) {
    if (!points) { console.warn('bench: передай точки'); return []; }
    const rows = [];
    FM.metrics.METRICS.forEach(function (m) {
      const t0 = (global.performance || Date).now();
      let r;
      try { r = solveLocal(points, m.key); }
      catch (e) { rows.push({ key: m.key, error: String(e) }); return; }
      const t1ms = (global.performance || Date).now() - t0;
      rows.push({
        key: m.key,
        ok: r.ok ? 'OK' : '—',
        before: r.before == null ? null : +r.before.toFixed(3),
        after: r.after == null ? null : +r.after.toFixed(3),
        target: r.target == null ? null : +r.target.toFixed(3),
        iter: r.iterations || 0,
        ms: Math.round(t1ms),
        moved: (r.moved || []).length
      });
    });
    if (console.table) console.table(rows);
    return rows;
  }

  FM.ideal = {
    MIDLINE: MIDLINE, ANCHORS: ANCHORS,
    targetOf: targetOf, scaleOf: scaleOf,
    solveLocal: solveLocal,
    solveGlobal: solveGlobal,
    blend: blend,
    countT1: countT1,
    audit: audit,
    bench: bench
  };

})(typeof window !== 'undefined' ? window : this);
