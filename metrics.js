/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (37 метрик, без нейросетей)
   МОДУЛЬ 2/7: metrics.js
   ---------------------------------------------------------------------
   Все 37 метрик из таблицы с полными тиерами T1-T5.
   Каждая метрика содержит:
     - calc(pts): функция вычисления значения
     - viz: описание визуализации (линии, углы, подписи)
     - tiers: полные диапазоны T1-T5 из xlsx
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = (global.FM = global.FM || {});

  /* === Геометрические примитивы === */
  const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const vec = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
  const vlen = v => Math.hypot(v.x, v.y);
  const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;

  function angBetween(u, v) {
    const du = vlen(u), dv = vlen(v);
    if (!du || !dv) return 0;
    const c = Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (du * dv)));
    return Math.acos(c) * 180 / Math.PI;
  }

  function tiltDeg(inner, outer) {
    const dx = Math.abs(outer.x - inner.x);
    if (dx < 1e-9) return 0;
    const dyUp = inner.y - outer.y;
    return Math.atan2(dyUp, dx) * 180 / Math.PI;
  }

  function alarToPupilAngle(al, pup) {
    const dx = Math.abs(pup.x - al.x);
    if (dx < 1e-9) return 0;
    const dyUp = al.y - pup.y;
    return Math.atan2(dyUp, dx) * 180 / Math.PI;
  }

  function jawFrontalAngle(go, gn) {
    const dx = Math.abs(gn.x - go.x);
    if (dx < 1e-9) return 0;
    const dyDown = gn.y - go.y;
    return Math.atan2(dyDown, dx) * 180 / Math.PI;
  }

  function lineYat(a, b, x) {
    if (Math.abs(b.x - a.x) < 1e-9) return (a.y + b.y) / 2;
    return a.y + (x - a.x) * (b.y - a.y) / (b.x - a.x);
  }

  function reqMissing(pts, req) {
    return req.filter(id => !pts[id] || !isFinite(pts[id].x) || !isFinite(pts[id].y));
  }

  /* === Реестр метрик === */
  const M = [];
  function def(n, key, name, unit, tiers, req, calc, viz) {
    M.push({
      n, key, name, unit, tiers, req, calc, viz,
      ideal: tiers.T1
    });
  }

  const ZW = p => D(p.ZY_L, p.ZY_R);
  const PUP_D = p => D(p.PUP_L, p.PUP_R);
  const EC_L = p => mid(p.EN_L, p.EX_L);
  const EC_R = p => mid(p.EN_R, p.EX_R);
  const PFL = (p, s) => D(p['EN_' + s], p['EX_' + s]);
  const PHL = (p, s) => D(p['UL_' + s], p['LL_' + s]);

  /* 1. FWHR */
  def(1, 'FWHR', 'Ширина лица к высоте верха (FWHR)', 'ratio',
    { T1: [1.90, 2.06], T2: [[1.83, 1.89], [2.07, 2.13]], T3: [[1.80, 1.82], [2.14, 2.16]], T4: [[1.70, 1.79], [2.17, 2.18]], T5: ['<1.70', '>2.18'] },
    ['ZY_L', 'ZY_R', 'GL', 'LS'],
    p => ZW(p) / D(p.GL, p.LS),
    { type: 'ratio', segs: [
      { from: 'ZY_L', to: 'ZY_R', label: 'A', color: '#00ffaa' },
      { from: 'GL', to: 'LS', label: 'B', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 2. tFWHR */
  def(2, 'tFWHR', 'Полная высота к ширине (tFWHR)', 'ratio',
    { T1: [1.33, 1.38], T2: [[1.30, 1.32], [1.39, 1.41]], T3: [[1.26, 1.29], [1.42, 1.45]], T4: [[1.23, 1.25], [1.46, 1.48]], T5: ['<1.23', '>1.48'] },
    ['TR', 'GN', 'ZY_L', 'ZY_R'],
    p => D(p.TR, p.GN) / ZW(p),
    { type: 'ratio', segs: [
      { from: 'TR', to: 'GN', label: 'A', color: '#00ffaa' },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 3. MFR */
  def(3, 'MFR', 'Средняя треть (MFR)', 'ratio',
    { T1: [0.93, 1.01], T2: [[0.90, 0.92], [1.02, 1.04]], T3: [[0.88, 0.89], [1.05, 1.06]], T4: [[0.85, 0.87], [1.07, 1.09]], T5: ['<0.85', '>1.09'] },
    ['PUP_L', 'PUP_R', 'LS'],
    p => {
      const ipd = D(p.PUP_L, p.PUP_R);
      const h = mean([Math.abs(p.PUP_L.y - p.LS.y), Math.abs(p.PUP_R.y - p.LS.y)]);
      return h > 0 ? ipd / h : 0;
    },
    { type: 'ratio', segs: [
      { from: 'PUP_L', to: 'PUP_R', label: 'A (IPD)', color: '#00ffaa' },
      { from: 'PUP_L', to: 'LS', label: 'B', color: '#ff8844' },
      { from: 'PUP_R', to: 'LS', label: 'B', color: '#ff8844' }
    ], formula: 'A ÷ B (среднее)' });

  /* 4. Facial Thirds */
  def(4, 'Thirds', 'Равенство третей', '%',
    { T1: [0, 3], T2: [4, 5], T3: [6, 7], T4: [8, 10], T5: ['>10'] },
    ['TR', 'GL', 'SN', 'GN'],
    p => {
      const fh = D(p.TR, p.GN) || 1;
      const pcts = [D(p.TR, p.GL), D(p.GL, p.SN), D(p.SN, p.GN)].map(v => v / fh * 100);
      return Math.max(...pcts.map(v => Math.abs(v - 100 / 3)));
    },
    { type: 'percent', segs: [
      { from: 'TR', to: 'GL', label: 'верх', color: '#00ffaa' },
      { from: 'GL', to: 'SN', label: 'середина', color: '#00ffaa' },
      { from: 'SN', to: 'GN', label: 'низ', color: '#00ffaa' }
    ], formula: 'max отклонение от 33.3%' });

  /* 5. Lower Third */
  def(5, 'LowerThird', 'Нижняя треть', '%',
    { T1: [30.6, 34], T2: [[29.6, 30.5], [34.1, 35]], T3: [[28.4, 29.5], [35.1, 36.2]], T4: [[27.2, 28.3], [36.3, 37.4]], T5: ['<27.2', '>37.4'] },
    ['TR', 'SN', 'GN'],
    p => D(p.SN, p.GN) / D(p.TR, p.GN) * 100,
    { type: 'percent', segs: [
      { from: 'SN', to: 'GN', label: 'A', color: '#00ffaa' },
      { from: 'TR', to: 'GN', label: 'B (всё лицо)', color: '#ff8844' }
    ], formula: '(A ÷ B) × 100' });

  /* 6. Bitemporal Width */
  def(6, 'Bitemporal', 'Виски к скулам', '%',
    { T1: [84, 95], T2: [[82, 83], [96, 97]], T3: [[79, 81], [98, 100]], T4: [[77, 78], [101, 102]], T5: ['<77', '>102'] },
    ['BT_L', 'BT_R', 'ZY_L', 'ZY_R'],
    p => D(p.BT_L, p.BT_R) / ZW(p) * 100,
    { type: 'percent', segs: [
      { from: 'BT_L', to: 'BT_R', label: 'A', color: '#00ffaa' },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: '#ff8844' }
    ], formula: '(A ÷ B) × 100' });

  /* 7. Jaw WHR */
  def(7, 'JawWHR', 'Челюсть WHR', 'ratio',
    { T1: [1.85, 1.95], T2: [1.80, 1.84], T3: [1.75, 1.79], T4: [1.70, 1.74], T5: ['<1.70', '>1.95'] },
    ['GO_L', 'GO_R', 'TR', 'GN'],
    p => D(p.GO_L, p.GO_R) / D(p.TR, p.GN),
    { type: 'ratio', segs: [
      { from: 'GO_L', to: 'GO_R', label: 'A', color: '#00ffaa' },
      { from: 'TR', to: 'GN', label: 'B', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 8. Mouth W / Jaw W */
  def(8, 'MouthJaw', 'Рот к челюсти', 'ratio',
    { T1: [0.40, 0.47], T2: [0.38, 0.39], T3: [0.36, 0.37], T4: [0.34, 0.35], T5: ['<0.34', '>0.47'] },
    ['CH_L', 'CH_R', 'GO_L', 'GO_R'],
    p => D(p.CH_L, p.CH_R) / D(p.GO_L, p.GO_R),
    { type: 'ratio', segs: [
      { from: 'CH_L', to: 'CH_R', label: 'A', color: '#00ffaa' },
      { from: 'GO_L', to: 'GO_R', label: 'B', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 9. Canthal Tilt */
  def(9, 'CanthalTilt', 'Наклон глаз', '°',
    { T1: [5.0, 8.5], T2: [[3.0, 4.9], [8.6, 10.5]], T3: [[0, 2.9], [10.6, 12]], T4: [[-2, 0], [12, 14]], T5: ['<-2', '>14'] },
    ['EN_L', 'EX_L', 'EN_R', 'EX_R'],
    p => mean([tiltDeg(p.EN_L, p.EX_L), tiltDeg(p.EN_R, p.EX_R)]),
    { type: 'angle', rays: [
      { from: 'EN_L', to: 'EX_L', label: 'левый', color: '#00ffaa' },
      { from: 'EN_R', to: 'EX_R', label: 'правый', color: '#00ffaa' }
    ], formula: 'средний угол к горизонтали' });

  /* 10. ESR */
  def(10, 'ESR', 'IPD к скулам (ESR)', '%',
    { T1: [44.3, 47.7], T2: [[43.0, 44.2], [47.8, 48.5]], T3: [[41.5, 42.9], [48.6, 49.5]], T4: [[40.0, 41.4], [49.6, 50.5]], T5: ['<40', '>50.5'] },
    ['PUP_L', 'PUP_R', 'ZY_L', 'ZY_R'],
    p => D(p.PUP_L, p.PUP_R) / ZW(p) * 100,
    { type: 'percent', segs: [
      { from: 'PUP_L', to: 'PUP_R', label: 'A (IPD)', color: '#00ffaa' },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: '#ff8844' }
    ], formula: '(A ÷ B) × 100' });

  /* 11. ES */
  def(11, 'ES', 'Межглазное к длине глаза (ES)', 'ratio',
    { T1: [0.93, 1.04], T2: [[0.88, 0.92], [1.05, 1.07]], T3: [[0.83, 0.87], [1.08, 1.10]], T4: [[0.78, 0.82], [1.11, 1.17]], T5: ['<0.78', '>1.17'] },
    ['EN_L', 'EN_R', 'EX_L', 'EX_R'],
    p => D(p.EN_L, p.EN_R) / mean([PFL(p, 'L'), PFL(p, 'R')]),
    { type: 'ratio', segs: [
      { from: 'EN_L', to: 'EN_R', label: 'A (ICD)', color: '#00ffaa' },
      { from: 'EN_L', to: 'EX_L', label: 'B (PFL)', color: '#ff8844' },
      { from: 'EN_R', to: 'EX_R', label: 'B', color: '#ff8844' }
    ], formula: 'A ÷ B (среднее)' });

  /* 12. Inner Canthal Distance */
  def(12, 'ICD', 'Внутреннее межглазное (ICD)', '%',
    { T1: [25.5, 28], T2: [[24.0, 25.4], [28.1, 29.5]], T3: [[22.5, 23.9], [29.6, 31]], T4: [[21.0, 22.4], [31.1, 32.5]], T5: ['<21', '>32.5'] },
    ['EN_L', 'EN_R', 'ZY_L', 'ZY_R'],
    p => D(p.EN_L, p.EN_R) / ZW(p) * 100,
    { type: 'percent', segs: [
      { from: 'EN_L', to: 'EN_R', label: 'A', color: '#00ffaa' },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: '#ff8844' }
    ], formula: '(A ÷ B) × 100' });

  /* 13. Outer Canthal Distance */
  def(13, 'OCD', 'Внешнее межглазное (OCD)', 'ratio',
    { T1: [0.63, 0.67], T2: [[0.60, 0.62], [0.68, 0.70]], T3: [[0.57, 0.59], [0.71, 0.73]], T4: [[0.54, 0.56], [0.74, 0.76]], T5: ['<0.54', '>0.76'] },
    ['EX_L', 'EX_R', 'ZY_L', 'ZY_R'],
    p => D(p.EX_L, p.EX_R) / ZW(p),
    { type: 'ratio', segs: [
      { from: 'EX_L', to: 'EX_R', label: 'A', color: '#00ffaa' },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 14. Medial Canthal Angle */
  def(14, 'MCA', 'Внутренний угол глаза', '°',
    { T1: [20, 42], T2: [[15, 19], [43, 47]], T3: [[10, 14], [48, 52]], T4: [[5, 9], [53, 57]], T5: ['<5', '>57'] },
    ['EN_L', 'UL_L', 'LL_L', 'EN_R', 'UL_R', 'LL_R'],
    p => mean([
      angBetween(vec(p.EN_L, p.UL_L), vec(p.EN_L, p.LL_L)),
      angBetween(vec(p.EN_R, p.UL_R), vec(p.EN_R, p.LL_R))
    ]),
    { type: 'angle', rays: [
      { from: 'EN_L', to: 'UL_L', label: 'левый верх', color: '#00ffaa' },
      { from: 'EN_L', to: 'LL_L', label: 'левый низ', color: '#ff8844' },
      { from: 'EN_R', to: 'UL_R', label: 'правый верх', color: '#00ffaa' },
      { from: 'EN_R', to: 'LL_R', label: 'правый низ', color: '#ff8844' }
    ], formula: 'средний угол' });

  /* 15. PFL:PHL */
  def(15, 'PFL_PHL', 'Длина глаза к высоте', 'ratio',
    { T1: [2.8, 3.6], T2: [[2.6, 2.7], [3.7, 3.8]], T3: [[2.4, 2.5], [3.9, 4.0]], T4: [[2.2, 2.3], [4.1, 4.2]], T5: ['<2.2', '>4.2'] },
    ['EN_L', 'EX_L', 'UL_L', 'LL_L', 'EN_R', 'EX_R', 'UL_R', 'LL_R'],
    p => mean([PFL(p, 'L') / PHL(p, 'L'), PFL(p, 'R') / PHL(p, 'R')]),
    { type: 'ratio', segs: [
      { from: 'EN_L', to: 'EX_L', label: 'A (PFL)', color: '#00ffaa' },
      { from: 'UL_L', to: 'LL_L', label: 'B (PHL)', color: '#ff8844' },
      { from: 'EN_R', to: 'EX_R', label: 'A', color: '#00ffaa' },
      { from: 'UL_R', to: 'LL_R', label: 'B', color: '#ff8844' }
    ], formula: 'A ÷ B (среднее)' });

  /* 16. Eyebrows Tilt */
  def(16, 'BrowTilt', 'Наклон бровей', '°',
    { T1: [5, 13], T2: [[3, 4], [14, 15]], T3: [[0, 2], [16, 18]], T4: [[-2, 0], [19, 20]], T5: ['<-2', '>20'] },
    ['BR_IN_L', 'BR_OUT_L', 'BR_IN_R', 'BR_OUT_R'],
    p => mean([tiltDeg(p.BR_IN_L, p.BR_OUT_L), tiltDeg(p.BR_IN_R, p.BR_OUT_R)]),
    { type: 'angle', rays: [
      { from: 'BR_IN_L', to: 'BR_OUT_L', label: 'левая', color: '#00ffaa' },
      { from: 'BR_IN_R', to: 'BR_OUT_R', label: 'правая', color: '#00ffaa' }
    ], formula: 'средний угол к горизонтали' });

  /* 17. Brow Height */
  def(17, 'BrowHeight', 'Высота брови', 'ratio',
    { T1: [0.6, 0.65], T2: [[0.5, 0.59], [0.66, 0.95]], T3: [[0.4, 0.49], [0.96, 1.20]], T4: [[0.3, 0.39], [1.21, 1.50]], T5: ['<0.3', '>1.50'] },
    ['BR_IN_L', 'BR_OUT_L', 'BR_IN_R', 'BR_OUT_R', 'PUP_L', 'PUP_R', 'UL_L', 'UL_R'],
    p => mean(['L', 'R'].map(s => {
      const pup = p['PUP_' + s];
      const browY = lineYat(p['BR_IN_' + s], p['BR_OUT_' + s], pup.x);
      const browToPupil = Math.abs(browY - pup.y);
      const browToLid = Math.abs(browY - p['UL_' + s].y);
      return browToLid > 0 ? browToPupil / browToLid : 0;
    })),
    { type: 'ratio', segs: [
      { from: 'PUP_L', to: 'UL_L', label: 'зрачок→веко', color: '#888888' },
      { from: 'PUP_R', to: 'UL_R', label: 'зрачок→веко', color: '#888888' }
    ], formula: 'бровь→зрачок ÷ бровь→веко',
    note: 'Точка на брови интерполируется над зрачком' });

  /* 18. PFL to bizygo */
  def(18, 'PFLBizygo', 'Длина глаза к скулам', '%',
    { T1: [19.5, 21.5], T2: [18.5, 19.4], T3: [17.5, 18.4], T4: [16.5, 17.4], T5: ['<16.5', '>21.5'] },
    ['EN_L', 'EX_L', 'EN_R', 'EX_R', 'ZY_L', 'ZY_R'],
    p => mean([PFL(p, 'L'), PFL(p, 'R')]) / ZW(p) * 100,
    { type: 'percent', segs: [
      { from: 'EN_L', to: 'EX_L', label: 'A (PFL)', color: '#00ffaa' },
      { from: 'EN_R', to: 'EX_R', label: 'A', color: '#00ffaa' },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: '#ff8844' }
    ], formula: '(A ÷ B) × 100' });

  /* 19. Brow to bizygo */
  def(19, 'BrowBizygo', 'Бровь к скулам', 'ratio',
    { T1: [0.90, 0.95], T2: [0.85, 0.89], T3: [0.80, 0.84], T4: [0.75, 0.79], T5: ['<0.75', '>0.95'] },
    ['BR_IN_L', 'BR_OUT_L', 'BR_IN_R', 'BR_OUT_R', 'ZY_L', 'ZY_R'],
    p => {
      const browMidY = mean([p.BR_IN_L.y, p.BR_OUT_L.y, p.BR_IN_R.y, p.BR_OUT_R.y]);
      const zygoY = mean([p.ZY_L.y, p.ZY_R.y]);
      const dist = Math.abs(browMidY - zygoY);
      return dist / ZW(p);
    },
    { type: 'ratio', segs: [
      { from: 'ZY_L', to: 'ZY_R', label: 'B (скулы)', color: '#ff8844' }
    ], formula: 'расстояние бровь→скулы ÷ ширина скул' });

  /* 20. b-set */
  def(20, 'bSet', 'Высота брови (альт.)', 'ratio',
    { T1: [0, 0.66], T2: [0.66, 0.95], T3: [0.96, 1.20], T4: [1.21, 1.50], T5: ['>1.50'] },
    ['BR_IN_L', 'BR_OUT_L', 'BR_IN_R', 'BR_OUT_R', 'EN_L', 'EX_L', 'EN_R', 'EX_R'],
    p => mean(['L', 'R'].map(s => {
      const ec = s === 'L' ? EC_L(p) : EC_R(p);
      const browY = lineYat(p['BR_IN_' + s], p['BR_OUT_' + s], ec.x);
      const eyeH = PHL(p, s);
      return eyeH > 0 ? Math.abs(browY - ec.y) / eyeH : 0;
    })),
    { type: 'ratio', segs: [], formula: 'бровь→центр глаза ÷ высота глаза' });

  /* 21. Nose to Zygo */
  def(21, 'NoseZygo', 'Нос к скулам', 'ratio',
    { T1: [0.20, 0.30], T2: [[0.18, 0.19], [0.31, 0.32]], T3: [[0.16, 0.17], [0.33, 0.34]], T4: [[0.14, 0.15], [0.35, 0.36]], T5: ['<0.14', '>0.36'] },
    ['AL_L', 'AL_R', 'ZY_L', 'ZY_R'],
    p => D(p.AL_L, p.AL_R) / ZW(p),
    { type: 'ratio', segs: [
      { from: 'AL_L', to: 'AL_R', label: 'A', color: '#00ffaa' },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 22. Nose Width to ICD */
  def(22, 'NoseICD', 'Нос к межглазному', 'ratio',
    { T1: [0.86, 0.94], T2: [[0.82, 0.85], [0.95, 0.98]], T3: [[0.78, 0.81], [0.99, 1.02]], T4: [[0.74, 0.77], [1.03, 1.06]], T5: ['<0.74', '>1.06'] },
    ['AL_L', 'AL_R', 'EN_L', 'EN_R'],
    p => D(p.AL_L, p.AL_R) / D(p.EN_L, p.EN_R),
    { type: 'ratio', segs: [
      { from: 'AL_L', to: 'AL_R', label: 'A', color: '#00ffaa' },
      { from: 'EN_L', to: 'EN_R', label: 'B (ICD)', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 23. Nose Width to Height */
  def(23, 'NoseHeight', 'Нос: ширина к высоте', 'ratio',
    { T1: [0.66, 0.85], T2: [[0.60, 0.65], [0.86, 0.90]], T3: [[0.54, 0.59], [0.91, 0.95]], T4: [[0.48, 0.53], [0.96, 1.00]], T5: ['<0.48', '>1.00'] },
    ['AL_L', 'AL_R', 'N', 'SN'],
    p => D(p.AL_L, p.AL_R) / D(p.N, p.SN),
    { type: 'ratio', segs: [
      { from: 'AL_L', to: 'AL_R', label: 'A', color: '#00ffaa' },
      { from: 'N', to: 'SN', label: 'B', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 24. Ipsilateral Alar Angle */
  def(24, 'IAA', 'Угол крыла носа', '°',
    { T1: [84, 95], T2: [[82, 83], [96, 97]], T3: [[79, 81], [98, 100]], T4: [[77, 78], [101, 102]], T5: ['<77', '>102'] },
    ['AL_L', 'AL_R', 'PUP_L', 'PUP_R'],
    p => mean([alarToPupilAngle(p.AL_L, p.PUP_L), alarToPupilAngle(p.AL_R, p.PUP_R)]),
    { type: 'angle', rays: [
      { from: 'AL_L', to: 'PUP_L', label: 'левый', color: '#00ffaa' },
      { from: 'AL_R', to: 'PUP_R', label: 'правый', color: '#00ffaa' }
    ], formula: 'средний угол крыло→зрачок к горизонтали' });

  /* 25. Alar to Bridge */
  def(25, 'AlarBridge', 'Крылья к переносице', 'ratio',
    { T1: [2.0, 2.1], T2: [1.9, 1.99], T3: [1.8, 1.89], T4: [1.7, 1.79], T5: ['<1.7', '>2.1'] },
    ['AL_L', 'AL_R', 'N', 'SN'],
    p => D(p.AL_L, p.AL_R) / D(p.N, p.SN),
    { type: 'ratio', segs: [
      { from: 'AL_L', to: 'AL_R', label: 'A', color: '#00ffaa' },
      { from: 'N', to: 'SN', label: 'B (переносица)', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 26. Mouth W / Nose H */
  def(26, 'MouthNoseH', 'Рот к высоте носа', 'ratio',
    { T1: [1.05, 1.10], T2: [0.95, 1.04], T3: [0.85, 0.94], T4: [0.75, 0.84], T5: ['<0.75', '>1.10'] },
    ['CH_L', 'CH_R', 'N', 'SN'],
    p => D(p.CH_L, p.CH_R) / D(p.N, p.SN),
    { type: 'ratio', segs: [
      { from: 'CH_L', to: 'CH_R', label: 'A', color: '#00ffaa' },
      { from: 'N', to: 'SN', label: 'B', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 27. Lip Proportions */
  def(27, 'LipProp', 'Пропорции губ', 'ratio',
    { T1: [1.4, 2.0], T2: [[1.1, 1.3], [2.1, 2.3]], T3: [[0.9, 1.0], [2.4, 2.5]], T4: [[0.7, 0.8], [2.6, 2.7]], T5: ['<0.7', '>2.7'] },
    ['LS', 'ST', 'LI'],
    p => D(p.ST, p.LI) / D(p.LS, p.ST),
    { type: 'ratio', segs: [
      { from: 'ST', to: 'LI', label: 'A (нижняя)', color: '#00ffaa' },
      { from: 'LS', to: 'ST', label: 'B (верхняя)', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 28. Mouth to Nose */
  def(28, 'MouthNose', 'Рот к носу', 'ratio',
    { T1: [1.38, 1.53], T2: [[1.34, 1.37], [1.54, 1.57]], T3: [[1.30, 1.33], [1.58, 1.61]], T4: [[1.26, 1.29], [1.62, 1.65]], T5: ['<1.26', '>1.65'] },
    ['CH_L', 'CH_R', 'AL_L', 'AL_R'],
    p => D(p.CH_L, p.CH_R) / D(p.AL_L, p.AL_R),
    { type: 'ratio', segs: [
      { from: 'CH_L', to: 'CH_R', label: 'A', color: '#00ffaa' },
      { from: 'AL_L', to: 'AL_R', label: 'B', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 29. EME */
  def(29, 'EME', 'Глаз-рот-глаз (EME)', '°',
    { T1: [45, 49], T2: [[43, 44], [50, 51]], T3: [[41, 42], [52, 53]], T4: [[39, 40], [54, 55]], T5: ['<39', '>55'] },
    ['ST', 'PUP_L', 'PUP_R'],
    p => angBetween(vec(p.ST, p.PUP_L), vec(p.ST, p.PUP_R)),
    { type: 'angle', rays: [
      { from: 'ST', to: 'PUP_L', label: 'левый', color: '#00ffaa' },
      { from: 'ST', to: 'PUP_R', label: 'правый', color: '#00ffaa' }
    ], formula: 'угол при стомионе между зрачками' });

  /* 30. Jaw Width */
  def(30, 'JawWidth', 'Ширина челюсти к скулам', 'ratio',
    { T1: [0.86, 0.92], T2: [[0.82, 0.85], [0.93, 0.96]], T3: [[0.78, 0.81], [0.97, 1.00]], T4: [[0.74, 0.77], [1.01, 1.04]], T5: ['<0.74', '>1.04'] },
    ['GO_L', 'GO_R', 'ZY_L', 'ZY_R'],
    p => D(p.GO_L, p.GO_R) / ZW(p),
    { type: 'ratio', segs: [
      { from: 'GO_L', to: 'GO_R', label: 'A', color: '#00ffaa' },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 31. Bigonial Width */
  def(31, 'Bigonial', 'Межугловая ширина', '%',
    { T1: [85.5, 92], T2: [[82, 85.4], [92.1, 94]], T3: [[78, 81.9], [94.1, 97]], T4: [[74, 77.9], [97.1, 100]], T5: ['<74', '>100'] },
    ['GO_L', 'GO_R', 'ZY_L', 'ZY_R'],
    p => D(p.GO_L, p.GO_R) / ZW(p) * 100,
    { type: 'percent', segs: [
      { from: 'GO_L', to: 'GO_R', label: 'A', color: '#00ffaa' },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: '#ff8844' }
    ], formula: '(A ÷ B) × 100' });

  /* 32. Neck Width */
  def(32, 'NeckWidth', 'Шея к челюсти', '%',
    { T1: [90, 100], T2: [[85, 89], [101, 102]], T3: [[80, 84], [103, 105]], T4: [[75, 79], [106, 107]], T5: ['<75', '>107'] },
    ['NK_L', 'NK_R', 'GO_L', 'GO_R'],
    p => D(p.NK_L, p.NK_R) / D(p.GO_L, p.GO_R) * 100,
    { type: 'percent', segs: [
      { from: 'NK_L', to: 'NK_R', label: 'A', color: '#00ffaa' },
      { from: 'GO_L', to: 'GO_R', label: 'B', color: '#ff8844' }
    ], formula: '(A ÷ B) × 100' });

  /* 33. Cheekbones Height */
  def(33, 'CheekHeight', 'Высота скул', '%',
    { T1: [81, 100], T2: [76, 80], T3: [70, 75], T4: [66, 69], T5: ['<66'] },
    ['ZY_L', 'ZY_R', 'LS', 'EN_L', 'EX_L', 'EN_R', 'EX_R'],
    p => {
      const zy = mean([p.ZY_L.y, p.ZY_R.y]);
      const ey = mean([EC_L(p).y, EC_R(p).y]);
      const den = Math.abs(ey - p.LS.y);
      return den > 0 ? Math.abs(zy - p.LS.y) / den * 100 : 0;
    },
    { type: 'percent', segs: [
      { from: 'ZY_L', to: 'ZY_R', label: 'скулы', color: '#00ffaa' },
      { from: 'EN_L', to: 'EX_L', label: 'глаз', color: '#888888' },
      { from: 'EN_R', to: 'EX_R', label: 'глаз', color: '#888888' }
    ], formula: '(скулы→губы ÷ глаза→губы) × 100' });

  /* 34. Chin to Philtrum */
  def(34, 'ChinPhiltrum', 'Подбородок к фильтруму', 'ratio',
    { T1: [2.05, 2.55], T2: [[1.87, 2.04], [2.56, 2.73]], T3: [[1.75, 1.86], [2.74, 2.85]], T4: [[1.55, 1.74], [2.86, 3.20]], T5: ['<1.55', '>3.20'] },
    ['SN', 'GN', 'LS'],
    p => D(p.SN, p.GN) / D(p.SN, p.LS),
    { type: 'ratio', segs: [
      { from: 'SN', to: 'GN', label: 'A (подбородок)', color: '#00ffaa' },
      { from: 'SN', to: 'LS', label: 'B (фильтрум)', color: '#ff8844' }
    ], formula: 'A ÷ B' });

  /* 35. Jaw Frontal Angle */
  def(35, 'JFA', 'Фронтальный угол челюсти', '°',
    { T1: [84.5, 95], T2: [[82, 84], [96, 97]], T3: [[79, 81], [98, 100]], T4: [[77, 78], [101, 102]], T5: ['<77', '>102'] },
    ['GN', 'GO_L', 'GO_R'],
    p => mean([jawFrontalAngle(p.GO_L, p.GN), jawFrontalAngle(p.GO_R, p.GN)]),
    { type: 'angle', rays: [
      { from: 'GO_L', to: 'GN', label: 'левый', color: '#00ffaa' },
      { from: 'GO_R', to: 'GN', label: 'правый', color: '#00ffaa' }
    ], formula: 'средний угол угол челюсти→подбородок к горизонтали' });

  /* 36. IAA–JFA Deviation */
  def(36, 'IAA_JFA', 'Расхождение IAA и JFA', '°',
    { T1: [0, 5], T2: [6, 10], T3: [11, 15], T4: [16, 18], T5: ['>18'] },
    ['SN', 'AL_L', 'AL_R', 'PUP_L', 'PUP_R', 'GN', 'GO_L', 'GO_R'],
    p => Math.abs(
      mean([alarToPupilAngle(p.AL_L, p.PUP_L), alarToPupilAngle(p.AL_R, p.PUP_R)]) -
      mean([jawFrontalAngle(p.GO_L, p.GN), jawFrontalAngle(p.GO_R, p.GN)])
    ),
    { type: 'custom', note: 'Абсолютная разница между IAA (#24) и JFA (#35)' });

  /* 37. Z-set */
  def(37, 'ZSet', 'Выступание скул (Z-set)', '%',
    { T1: [80, 100], T2: [75, 79], T3: [70, 74], T4: [65, 69], T5: ['<65'] },
    ['ZY_L', 'ZY_R', 'LS', 'EN_L', 'EX_L', 'EN_R', 'EX_R'],
    p => {
      const zy = mean([p.ZY_L.y, p.ZY_R.y]);
      const ey = mean([EC_L(p).y, EC_R(p).y]);
      const den = Math.abs(ey - p.LS.y);
      return den > 0 ? Math.abs(zy - p.LS.y) / den * 100 : 0;
    },
    { type: 'percent', segs: [
      { from: 'ZY_L', to: 'ZY_R', label: 'скулы', color: '#00ffaa' },
      { from: 'EN_L', to: 'EX_L', label: 'глаз', color: '#888888' },
      { from: 'EN_R', to: 'EX_R', label: 'глаз', color: '#888888' }
    ], formula: '(скулы→губы ÷ глаза→губы) × 100',
    note: 'Альтернативное измерение высоты скул' });

  /* === Вычисление всех метрик === */
  function computeAll(pts) {
    pts = pts || {};
    return M.map(m => {
      const missing = reqMissing(pts, m.req);
      let value = null;
      if (!missing.length) {
        try {
          value = m.calc(pts);
          if (!isFinite(value)) value = null;
        } catch (e) { value = null; }
      }
      return {
        n: m.n, key: m.key, name: m.name, unit: m.unit,
        tiers: m.tiers, ideal: m.ideal, value, missing, viz: m.viz
      };
    });
  }

  function byKey(key) {
    for (let i = 0; i < M.length; i++) if (M[i].key === key) return M[i];
    return null;
  }

  FM.metrics = { METRICS: M, computeAll, byKey };
})(typeof window !== 'undefined' ? window : this);
