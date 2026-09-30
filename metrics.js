/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (38 метрик)
   КОД 1/6: metrics.js (v4 — финальные формулы после аудита)
   ---------------------------------------------------------------------
   Принцип: числовые идеалы таблицы — истина; формула верна, если на
   среднестатистическом лице значение попадает в T1.
   Ключевые решения v4:
     #7  GO / нижняя треть (SN-GN);
     #8  рот / GO (углы челюсти);
     #17/#20 (бровь->веко)/(бровь->зрачок);
     #19 размах бровей / скулы;
     #25 нос / переносица (GL-N);
     #27 нижняя губа / верхняя;  #28 рот / нос;
     #29 угол при ST между лучами к ЗРАЧКАМ;
     #30 JW/скулы, #31 GO/скулы (разведены);  #32 шея / JW;
     #33/#37 вертикально: (линия скул->LS)/(линия зрачков->LS);
     #35 JFA = V-угол при GN между лучами GN->GO_L и GN->GO_R;
     #38 CLWR = площадка подбородка / ширина рта.
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = (global.FM = global.FM || {});

  /* === примитивы === */
  const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
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
    return Math.atan2(inner.y - outer.y, dx) * 180 / Math.PI;
  }
  function alarToPupilAngle(al, pup) {
    const dx = Math.abs(pup.x - al.x);
    if (dx < 1e-9) return 0;
    return Math.atan2(al.y - pup.y, dx) * 180 / Math.PI;
  }
  function lineYat(a, b, x) {
    if (Math.abs(b.x - a.x) < 1e-9) return (a.y + b.y) / 2;
    return a.y + (x - a.x) * (b.y - a.y) / (b.x - a.x);
  }
  function reqMissing(pts, req) {
    return req.filter(id => !pts[id] || !isFinite(pts[id].x) || !isFinite(pts[id].y));
  }

  /* === реестр === */
  const M = [];
  function def(n, key, name, unit, tiers, req, calc, viz) {
    M.push({ n, key, name, unit, tiers, req, calc, viz, ideal: tiers.T1 });
  }

  const ZW = p => D(p.ZY_L, p.ZY_R);
  const JW = p => D(p.JW_L, p.JW_R);
  const GOW = p => D(p.GO_L, p.GO_R);
  const IPD = p => D(p.PUP_L, p.PUP_R);
  const ICD = p => D(p.EN_L, p.EN_R);
  const PFL = (p, s) => D(p['EN_' + s], p['EX_' + s]);
  const PHL = (p, s) => D(p['UL_' + s], p['LL_' + s]);
  const PUPY = p => (p.PUP_L.y + p.PUP_R.y) / 2;
  const ZYY = p => (p.ZY_L.y + p.ZY_R.y) / 2;
  const jfaOf = p => angBetween(vec(p.GN, p.GO_L), vec(p.GN, p.GO_R));
  const iaaOf = p => mean([alarToPupilAngle(p.AL_L, p.PUP_L), alarToPupilAngle(p.AL_R, p.PUP_R)]);
  const browRatio = p => mean(['L', 'R'].map(s => {
    const pup = p['PUP_' + s];
    const by = lineYat(p['BR_IN_' + s], p['BR_OUT_' + s], pup.x);
    const lid = Math.abs(by - p['UL_' + s].y);
    const pupd = Math.abs(by - pup.y);
    return pupd > 0 ? lid / pupd : 0;
  }));
  const cheekSet = p => {
    const den = Math.abs(PUPY(p) - p.LS.y);
    return den > 0 ? Math.abs(ZYY(p) - p.LS.y) / den * 100 : 0;
  };

  const CA = '#00ffaa', CB = '#ff8844', CG = '#8b939d';

  /* 1 */ def(1, 'FWHR', 'Ширина лица к высоте верха (FWHR)', 'ratio',
    { T1: [1.90, 2.06], T2: [[1.83, 1.89], [2.07, 2.13]], T3: [[1.80, 1.82], [2.14, 2.16]], T4: [[1.70, 1.79], [2.17, 2.18]], T5: ['<1.70', '>2.18'] },
    ['ZY_L', 'ZY_R', 'GL', 'LS'],
    p => ZW(p) / D(p.GL, p.LS),
    { type: 'ratio', segs: [
      { from: 'ZY_L', to: 'ZY_R', label: 'A', color: CA },
      { from: 'GL', to: 'LS', label: 'B', color: CB }], formula: 'A ÷ B' });

  /* 2 */ def(2, 'tFWHR', 'Полная высота к ширине (tFWHR)', 'ratio',
    { T1: [1.33, 1.38], T2: [[1.30, 1.32], [1.39, 1.41]], T3: [[1.26, 1.29], [1.42, 1.45]], T4: [[1.23, 1.25], [1.46, 1.48]], T5: ['<1.23', '>1.48'] },
    ['TR', 'GN', 'ZY_L', 'ZY_R'],
    p => D(p.TR, p.GN) / ZW(p),
    { type: 'ratio', segs: [
      { from: 'TR', to: 'GN', label: 'A', color: CA },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: CB }], formula: 'A ÷ B' });

  /* 3 */ def(3, 'MFR', 'Средняя зона (MFR)', 'ratio',
    { T1: [0.93, 1.01], T2: [[0.90, 0.92], [1.02, 1.04]], T3: [[0.88, 0.89], [1.05, 1.06]], T4: [[0.85, 0.87], [1.07, 1.09]], T5: ['<0.85', '>1.09'] },
    ['PUP_L', 'PUP_R', 'LS'],
    p => {
      const h = mean([Math.abs(p.PUP_L.y - p.LS.y), Math.abs(p.PUP_R.y - p.LS.y)]);
      return h > 0 ? IPD(p) / h : 0;
    },
    { type: 'ratio', segs: [
      { from: 'PUP_L', to: 'PUP_R', label: 'A (IPD)', color: CA },
      { from: 'PUP_L', to: 'LS', label: 'B', color: CB },
      { from: 'PUP_R', to: 'LS', label: 'B', color: CB }], formula: 'A ÷ B (верт.)' });

  /* 4 */ def(4, 'Thirds', 'Равенство третей', '%',
    { T1: [0, 3], T2: [4, 5], T3: [6, 7], T4: [8, 10], T5: ['>10'] },
    ['TR', 'GL', 'SN', 'GN'],
    p => {
      const fh = D(p.TR, p.GN) || 1;
      const pcts = [D(p.TR, p.GL), D(p.GL, p.SN), D(p.SN, p.GN)].map(v => v / fh * 100);
      return Math.max(...pcts.map(v => Math.abs(v - 100 / 3)));
    },
    { type: 'percent', segs: [
      { from: 'TR', to: 'GL', label: 'верх', color: CA },
      { from: 'GL', to: 'SN', label: 'середина', color: CA },
      { from: 'SN', to: 'GN', label: 'низ', color: CA }], formula: 'max |треть − 33.3%|' });

  /* 5 */ def(5, 'LowerThird', 'Нижняя треть', '%',
    { T1: [30.6, 34], T2: [[29.6, 30.5], [34.1, 35]], T3: [[28.4, 29.5], [35.1, 36.2]], T4: [[27.2, 28.3], [36.3, 37.4]], T5: ['<27.2', '>37.4'] },
    ['TR', 'SN', 'GN'],
    p => D(p.SN, p.GN) / D(p.TR, p.GN) * 100,
    { type: 'percent', segs: [
      { from: 'SN', to: 'GN', label: 'A', color: CA },
      { from: 'TR', to: 'GN', label: 'B (всё лицо)', color: CB }], formula: '(A ÷ B) × 100' });

  /* 6 */ def(6, 'Bitemporal', 'Виски к скулам', '%',
    { T1: [84, 95], T2: [[82, 83], [96, 97]], T3: [[79, 81], [98, 100]], T4: [[77, 78], [101, 102]], T5: ['<77', '>102'] },
    ['BT_L', 'BT_R', 'ZY_L', 'ZY_R'],
    p => D(p.BT_L, p.BT_R) / ZW(p) * 100,
    { type: 'percent', segs: [
      { from: 'BT_L', to: 'BT_R', label: 'A', color: CA },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: CB }], formula: '(A ÷ B) × 100' });

  /* 7 */ def(7, 'JawWHR', 'Челюсть WHR', 'ratio',
    { T1: [1.85, 1.95], T2: [1.80, 1.84], T3: [1.75, 1.79], T4: [1.70, 1.74], T5: ['<1.70', '>1.95'] },
    ['GO_L', 'GO_R', 'SN', 'GN'],
    p => GOW(p) / D(p.SN, p.GN),
    { type: 'ratio', segs: [
      { from: 'GO_L', to: 'GO_R', label: 'A', color: CA },
      { from: 'SN', to: 'GN', label: 'B', color: CB }], formula: 'A ÷ B' });

  /* 8 */ def(8, 'MouthJaw', 'Рот к челюсти', 'ratio',
    { T1: [0.40, 0.47], T2: [0.38, 0.39], T3: [0.36, 0.37], T4: [0.34, 0.35], T5: ['<0.34', '>0.47'] },
    ['CH_L', 'CH_R', 'GO_L', 'GO_R'],
    p => D(p.CH_L, p.CH_R) / GOW(p),
    { type: 'ratio', segs: [
      { from: 'CH_L', to: 'CH_R', label: 'A', color: CA },
      { from: 'GO_L', to: 'GO_R', label: 'B', color: CB }], formula: 'A ÷ B' });

  /* 9 */ def(9, 'CanthalTilt', 'Наклон глаз', '°',
    { T1: [5.0, 8.5], T2: [[3.0, 4.9], [8.6, 10.5]], T3: [[0, 2.9], [10.6, 12]], T4: [[-2, 0], [12, 14]], T5: ['<-2', '>14'] },
    ['EN_L', 'EX_L', 'EN_R', 'EX_R'],
    p => mean([tiltDeg(p.EN_L, p.EX_L), tiltDeg(p.EN_R, p.EX_R)]),
    { type: 'angle', rays: [
      { from: 'EN_L', to: 'EX_L', label: 'левый', color: CA },
      { from: 'EN_R', to: 'EX_R', label: 'правый', color: CA }], formula: 'наклон щели к горизонтали' });

  /* 10 */ def(10, 'ESR', 'Межзрачковое к скулам (ESR)', '%',
    { T1: [44.3, 47.7], T2: [[43.0, 44.2], [47.8, 48.5]], T3: [[41.5, 42.9], [48.6, 49.5]], T4: [[40.0, 41.4], [49.6, 50.5]], T5: ['<40', '>50.5'] },
    ['PUP_L', 'PUP_R', 'ZY_L', 'ZY_R'],
    p => IPD(p) / ZW(p) * 100,
    { type: 'percent', segs: [
      { from: 'PUP_L', to: 'PUP_R', label: 'A (IPD)', color: CA },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: CB }], formula: '(A ÷ B) × 100' });

  /* 11 */ def(11, 'ES', 'Межглазное к длине глаза (ES)', 'ratio',
    { T1: [0.93, 1.04], T2: [[0.88, 0.92], [1.05, 1.07]], T3: [[0.83, 0.87], [1.08, 1.10]], T4: [[0.78, 0.82], [1.11, 1.17]], T5: ['<0.78', '>1.17'] },
    ['EN_L', 'EN_R', 'EX_L', 'EX_R'],
    p => ICD(p) / mean([PFL(p, 'L'), PFL(p, 'R')]),
    { type: 'ratio', segs: [
      { from: 'EN_L', to: 'EN_R', label: 'A (ICD)', color: CA },
      { from: 'EN_L', to: 'EX_L', label: 'B', color: CB },
      { from: 'EN_R', to: 'EX_R', label: 'B', color: CB }], formula: 'A ÷ B (средн.)' });

  /* 12 */ def(12, 'ICD', 'Внутреннее межглазное (ICD)', '%',
    { T1: [25.5, 28], T2: [[24.0, 25.4], [28.1, 29.5]], T3: [[22.5, 23.9], [29.6, 31]], T4: [[21.0, 22.4], [31.1, 32.5]], T5: ['<21', '>32.5'] },
    ['EN_L', 'EN_R', 'ZY_L', 'ZY_R'],
    p => ICD(p) / ZW(p) * 100,
    { type: 'percent', segs: [
      { from: 'EN_L', to: 'EN_R', label: 'A', color: CA },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: CB }], formula: '(A ÷ B) × 100' });

  /* 13 */ def(13, 'OCD', 'Внешнее межглазное (OCD)', 'ratio',
    { T1: [0.63, 0.67], T2: [[0.60, 0.62], [0.68, 0.70]], T3: [[0.57, 0.59], [0.71, 0.73]], T4: [[0.54, 0.56], [0.74, 0.76]], T5: ['<0.54', '>0.76'] },
    ['EX_L', 'EX_R', 'ZY_L', 'ZY_R'],
    p => D(p.EX_L, p.EX_R) / ZW(p),
    { type: 'ratio', segs: [
      { from: 'EX_L', to: 'EX_R', label: 'A', color: CA },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: CB }], formula: 'A ÷ B' });

  /* 14 */ def(14, 'MCA', 'Внутренний угол глаза', '°',
    { T1: [20, 42], T2: [[15, 19], [43, 47]], T3: [[10, 14], [48, 52]], T4: [[5, 9], [53, 57]], T5: ['<5', '>57'] },
    ['EN_L', 'UL_L', 'LL_L', 'EN_R', 'UL_R', 'LL_R'],
    p => mean([
      angBetween(vec(p.EN_L, p.UL_L), vec(p.EN_L, p.LL_L)),
      angBetween(vec(p.EN_R, p.UL_R), vec(p.EN_R, p.LL_R))]),
    { type: 'angle', rays: [
      { from: 'EN_L', to: 'UL_L', label: '', color: CA },
      { from: 'EN_L', to: 'LL_L', label: '', color: CB },
      { from: 'EN_R', to: 'UL_R', label: '', color: CA },
      { from: 'EN_R', to: 'LL_R', label: '', color: CB }], formula: 'угол схождения век' });

  /* 15 */ def(15, 'PFL_PHL', 'Длина глаза к высоте', 'ratio',
    { T1: [2.8, 3.6], T2: [[2.6, 2.7], [3.7, 3.8]], T3: [[2.4, 2.5], [3.9, 4.0]], T4: [[2.2, 2.3], [4.1, 4.2]], T5: ['<2.2', '>4.2'] },
    ['EN_L', 'EX_L', 'UL_L', 'LL_L', 'EN_R', 'EX_R', 'UL_R', 'LL_R'],
    p => mean([PFL(p, 'L') / PHL(p, 'L'), PFL(p, 'R') / PHL(p, 'R')]),
    { type: 'ratio', segs: [
      { from: 'EN_L', to: 'EX_L', label: 'A', color: CA },
      { from: 'UL_L', to: 'LL_L', label: 'B', color: CB },
      { from: 'EN_R', to: 'EX_R', label: 'A', color: CA },
      { from: 'UL_R', to: 'LL_R', label: 'B', color: CB }], formula: 'A ÷ B (средн.)' });

  /* 16 */ def(16, 'BrowTilt', 'Наклон бровей', '°',
    { T1: [5, 13], T2: [[3, 4], [14, 15]], T3: [[0, 2], [16, 18]], T4: [[-2, 0], [19, 20]], T5: ['<-2', '>20'] },
    ['BR_IN_L', 'BR_OUT_L', 'BR_IN_R', 'BR_OUT_R'],
    p => mean([tiltDeg(p.BR_IN_L, p.BR_OUT_L), tiltDeg(p.BR_IN_R, p.BR_OUT_R)]),
    { type: 'angle', rays: [
      { from: 'BR_IN_L', to: 'BR_OUT_L', label: 'левая', color: CA },
      { from: 'BR_IN_R', to: 'BR_OUT_R', label: 'правая', color: CA }], formula: 'наклон к горизонтали' });

  /* 17 */ def(17, 'BrowHeight', 'Высота брови', 'ratio',
    { T1: [0.6, 0.65], T2: [[0.5, 0.59], [0.66, 0.95]], T3: [[0.4, 0.49], [0.96, 1.20]], T4: [[0.3, 0.39], [1.21, 1.50]], T5: ['<0.3', '>1.50'] },
    ['BR_IN_L', 'BR_OUT_L', 'BR_IN_R', 'BR_OUT_R', 'PUP_L', 'PUP_R', 'UL_L', 'UL_R'],
    p => browRatio(p),
    { type: 'ratio', segs: [
      { from: 'PUP_L', to: 'UL_L', label: 'веко-зрачок', color: CG },
      { from: 'PUP_R', to: 'UL_R', label: 'веко-зрачок', color: CG }],
      formula: '(бровь→веко) ÷ (бровь→зрачок)', note: 'бровь берётся над зрачком' });

  /* 18 */ def(18, 'PFLBizygo', 'Длина глаза к скулам', '%',
    { T1: [19.5, 21.5], T2: [18.5, 19.4], T3: [17.5, 18.4], T4: [16.5, 17.4], T5: ['<16.5', '>21.5'] },
    ['EN_L', 'EX_L', 'EN_R', 'EX_R', 'ZY_L', 'ZY_R'],
    p => mean([PFL(p, 'L'), PFL(p, 'R')]) / ZW(p) * 100,
    { type: 'percent', segs: [
      { from: 'EN_L', to: 'EX_L', label: 'A', color: CA },
      { from: 'EN_R', to: 'EX_R', label: 'A', color: CA },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: CB }], formula: '(A ÷ B) × 100' });

  /* 19 */ def(19, 'BrowBizygo', 'Бровь к скулам', 'ratio',
    { T1: [0.90, 0.95], T2: [0.85, 0.89], T3: [0.80, 0.84], T4: [0.75, 0.79], T5: ['<0.75', '>0.95'] },
    ['BR_OUT_L', 'BR_OUT_R', 'ZY_L', 'ZY_R'],
    p => D(p.BR_OUT_L, p.BR_OUT_R) / ZW(p),
    { type: 'ratio', segs: [
      { from: 'BR_OUT_L', to: 'BR_OUT_R', label: 'A (размах)', color: CA },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: CB }], formula: 'A ÷ B' });

  /* 20 */ def(20, 'bSet', 'Посадка бровей (b-set)', 'ratio',
    { T1: [0, 0.66], T2: [0.66, 0.95], T3: [0.96, 1.20], T4: [1.21, 1.50], T5: ['>1.50'] },
    ['BR_IN_L', 'BR_OUT_L', 'BR_IN_R', 'BR_OUT_R', 'PUP_L', 'PUP_R', 'UL_L', 'UL_R'],
    p => browRatio(p),
    { type: 'ratio', segs: [], formula: 'как Brow Height, тиеры односторонние' });

  /* 21 */ def(21, 'NoseZygo', 'Нос к скулам', 'ratio',
    { T1: [0.20, 0.30], T2: [[0.18, 0.19], [0.31, 0.32]], T3: [[0.16, 0.17], [0.33, 0.34]], T4: [[0.14, 0.15], [0.35, 0.36]], T5: ['<0.14', '>0.36'] },
    ['AL_L', 'AL_R', 'ZY_L', 'ZY_R'],
    p => D(p.AL_L, p.AL_R) / ZW(p),
    { type: 'ratio', segs: [
      { from: 'AL_L', to: 'AL_R', label: 'A', color: CA },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: CB }], formula: 'A ÷ B' });

  /* 22 */ def(22, 'NoseICD', 'Нос к межглазному', 'ratio',
    { T1: [0.86, 0.94], T2: [[0.82, 0.85], [0.95, 0.98]], T3: [[0.78, 0.81], [0.99, 1.02]], T4: [[0.74, 0.77], [1.03, 1.06]], T5: ['<0.74', '>1.06'] },
    ['AL_L', 'AL_R', 'EN_L', 'EN_R'],
    p => D(p.AL_L, p.AL_R) / ICD(p),
    { type: 'ratio', segs: [
      { from: 'AL_L', to: 'AL_R', label: 'A', color: CA },
      { from: 'EN_L', to: 'EN_R', label: 'B (ICD)', color: CB }], formula: 'A ÷ B' });

  /* 23 */ def(23, 'NoseHeight', 'Нос: ширина к высоте', 'ratio',
    { T1: [0.66, 0.85], T2: [[0.60, 0.65], [0.86, 0.90]], T3: [[0.54, 0.59], [0.91, 0.95]], T4: [[0.48, 0.53], [0.96, 1.00]], T5: ['<0.48', '>1.00'] },
    ['AL_L', 'AL_R', 'N', 'SN'],
    p => D(p.AL_L, p.AL_R) / D(p.N, p.SN),
    { type: 'ratio', segs: [
      { from: 'AL_L', to: 'AL_R', label: 'A', color: CA },
      { from: 'N', to: 'SN', label: 'B', color: CB }],
      formula: 'A ÷ B', note: 'кончик на анфас ≈ основание носа' });

  /* 24 */ def(24, 'IAA', 'Угол крыла носа', '°',
    { T1: [84, 95], T2: [[82, 83], [96, 97]], T3: [[79, 81], [98, 100]], T4: [[77, 78], [101, 102]], T5: ['<77', '>102'] },
    ['AL_L', 'AL_R', 'PUP_L', 'PUP_R'],
    p => iaaOf(p),
    { type: 'angle', rays: [
      { from: 'AL_L', to: 'PUP_L', label: 'левый', color: CA },
      { from: 'AL_R', to: 'PUP_R', label: 'правый', color: CA }], formula: 'крыло→зрачок к горизонтали' });

  /* 25 */ def(25, 'AlarBridge', 'Крылья к переносице', 'ratio',
    { T1: [2.0, 2.1], T2: [1.9, 1.99], T3: [1.8, 1.89], T4: [1.7, 1.79], T5: ['<1.7', '>2.1'] },
    ['AL_L', 'AL_R', 'GL', 'N'],
    p => D(p.AL_L, p.AL_R) / D(p.GL, p.N),
    { type: 'ratio', segs: [
      { from: 'AL_L', to: 'AL_R', label: 'A', color: CA },
      { from: 'GL', to: 'N', label: 'B (переносица)', color: CB }], formula: 'A ÷ B' });

  /* 26 */ def(26, 'MouthNoseH', 'Рот к высоте носа', 'ratio',
    { T1: [1.05, 1.10], T2: [0.95, 1.04], T3: [0.85, 0.94], T4: [0.75, 0.84], T5: ['<0.75', '>1.10'] },
    ['CH_L', 'CH_R', 'N', 'SN'],
    p => D(p.CH_L, p.CH_R) / D(p.N, p.SN),
    { type: 'ratio', segs: [
      { from: 'CH_L', to: 'CH_R', label: 'A', color: CA },
      { from: 'N', to: 'SN', label: 'B', color: CB }], formula: 'A ÷ B' });

  /* 27 */ def(27, 'LipProp', 'Пропорции губ', 'ratio',
    { T1: [1.4, 2.0], T2: [[1.1, 1.3], [2.1, 2.3]], T3: [[0.9, 1.0], [2.4, 2.5]], T4: [[0.7, 0.8], [2.6, 2.7]], T5: ['<0.7', '>2.7'] },
    ['LS', 'ST', 'LI'],
    p => D(p.ST, p.LI) / D(p.LS, p.ST),
    { type: 'ratio', segs: [
      { from: 'ST', to: 'LI', label: 'A (нижняя)', color: CA },
      { from: 'LS', to: 'ST', label: 'B (верхняя)', color: CB }], formula: 'A ÷ B' });

  /* 28 */ def(28, 'MouthNose', 'Рот к носу', 'ratio',
    { T1: [1.38, 1.53], T2: [[1.34, 1.37], [1.54, 1.57]], T3: [[1.30, 1.33], [1.58, 1.61]], T4: [[1.26, 1.29], [1.62, 1.65]], T5: ['<1.26', '>1.65'] },
    ['CH_L', 'CH_R', 'AL_L', 'AL_R'],
    p => D(p.CH_L, p.CH_R) / D(p.AL_L, p.AL_R),
    { type: 'ratio', segs: [
      { from: 'CH_L', to: 'CH_R', label: 'A (рот)', color: CA },
      { from: 'AL_L', to: 'AL_R', label: 'B (нос)', color: CB }], formula: 'A ÷ B' });

  /* 29 */ def(29, 'EME', 'Глаз-рот-глаз (EME)', '°',
    { T1: [45, 49], T2: [[43, 44], [50, 51]], T3: [[41, 42], [52, 53]], T4: [[39, 40], [54, 55]], T5: ['<39', '>55'] },
    ['ST', 'PUP_L', 'PUP_R'],
    p => angBetween(vec(p.ST, p.PUP_L), vec(p.ST, p.PUP_R)),
    { type: 'angle', rays: [
      { from: 'ST', to: 'PUP_L', label: '', color: CA },
      { from: 'ST', to: 'PUP_R', label: '', color: CA }], formula: 'угол при центре рта к зрачкам' });

  /* 30 */ def(30, 'JawWidth', 'Ширина челюсти к скулам', 'ratio',
    { T1: [0.86, 0.92], T2: [[0.82, 0.85], [0.93, 0.96]], T3: [[0.78, 0.81], [0.97, 1.00]], T4: [[0.74, 0.77], [1.01, 1.04]], T5: ['<0.74', '>1.04'] },
    ['JW_L', 'JW_R', 'ZY_L', 'ZY_R'],
    p => JW(p) / ZW(p),
    { type: 'ratio', segs: [
      { from: 'JW_L', to: 'JW_R', label: 'A (массетер)', color: CA },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: CB }], formula: 'A ÷ B' });

  /* 31 */ def(31, 'Bigonial', 'Межугловая ширина', '%',
    { T1: [85.5, 92], T2: [[82, 85.4], [92.1, 94]], T3: [[78, 81.9], [94.1, 97]], T4: [[74, 77.9], [97.1, 100]], T5: ['<74', '>100'] },
    ['GO_L', 'GO_R', 'ZY_L', 'ZY_R'],
    p => GOW(p) / ZW(p) * 100,
    { type: 'percent', segs: [
      { from: 'GO_L', to: 'GO_R', label: 'A (гонионы)', color: CA },
      { from: 'ZY_L', to: 'ZY_R', label: 'B', color: CB }], formula: '(A ÷ B) × 100' });

  /* 32 */ def(32, 'NeckWidth', 'Шея к челюсти', '%',
    { T1: [90, 100], T2: [[85, 89], [101, 102]], T3: [[80, 84], [103, 105]], T4: [[75, 79], [106, 107]], T5: ['<75', '>107'] },
    ['NK_L', 'NK_R', 'JW_L', 'JW_R'],
    p => D(p.NK_L, p.NK_R) / JW(p) * 100,
    { type: 'percent', segs: [
      { from: 'NK_L', to: 'NK_R', label: 'A', color: CA },
      { from: 'JW_L', to: 'JW_R', label: 'B', color: CB }], formula: '(A ÷ B) × 100' });

  /* 33 */ def(33, 'CheekHeight', 'Высота скул', '%',
    { T1: [81, 100], T2: [76, 80], T3: [70, 75], T4: [66, 69], T5: ['<66'] },
    ['ZY_L', 'ZY_R', 'LS', 'PUP_L', 'PUP_R'],
    p => cheekSet(p),
    { type: 'percent', segs: [
      { from: 'ZY_L', to: 'ZY_R', label: 'линия скул', color: CA },
      { from: 'PUP_L', to: 'PUP_R', label: 'линия зрачков', color: CB }],
      formula: '(скулы→губы) ÷ (зрачки→губы)', note: 'вертикально до LS' });

  /* 34 */ def(34, 'ChinPhiltrum', 'Подбородок к фильтруму', 'ratio',
    { T1: [2.05, 2.55], T2: [[1.87, 2.04], [2.56, 2.73]], T3: [[1.75, 1.86], [2.74, 2.85]], T4: [[1.55, 1.74], [2.86, 3.20]], T5: ['<1.55', '>3.20'] },
    ['SN', 'GN', 'LS'],
    p => D(p.SN, p.GN) / D(p.SN, p.LS),
    { type: 'ratio', segs: [
      { from: 'SN', to: 'GN', label: 'A (подбородок)', color: CA },
      { from: 'SN', to: 'LS', label: 'B (фильтрум)', color: CB }], formula: 'A ÷ B' });

  /* 35 */ def(35, 'JFA', 'Фронтальный угол челюсти', '°',
    { T1: [84.5, 95], T2: [[82, 84], [96, 97]], T3: [[79, 81], [98, 100]], T4: [[77, 78], [101, 102]], T5: ['<77', '>102'] },
    ['GN', 'GO_L', 'GO_R'],
    p => jfaOf(p),
    { type: 'angle', rays: [
      { from: 'GN', to: 'GO_L', label: 'левая линия', color: CA },
      { from: 'GN', to: 'GO_R', label: 'правая линия', color: CA }], formula: 'V-угол при подбородке' });

  /* 36 */ def(36, 'IAA_JFA', 'Расхождение IAA и JFA', '°',
    { T1: [0, 5], T2: [6, 10], T3: [11, 15], T4: [16, 18], T5: ['>18'] },
    ['AL_L', 'AL_R', 'PUP_L', 'PUP_R', 'GN', 'GO_L', 'GO_R'],
    p => Math.abs(iaaOf(p) - jfaOf(p)),
    { type: 'custom', formula: '|IAA (#24) − JFA (#35)|' });

  /* 37 */ def(37, 'ZSet', 'Выступание скул (Z-set)', '%',
    { T1: [80, 100], T2: [75, 79], T3: [70, 74], T4: [65, 69], T5: ['<65'] },
    ['ZY_L', 'ZY_R', 'LS', 'PUP_L', 'PUP_R'],
    p => cheekSet(p),
    { type: 'percent', segs: [
      { from: 'ZY_L', to: 'ZY_R', label: 'линия скул', color: CA },
      { from: 'PUP_L', to: 'PUP_R', label: 'линия зрачков', color: CB }],
      formula: 'как Cheekbones Height, свои тиеры' });

  /* 38 */ def(38, 'CLWR', 'Подбородок к рту (CLWR)', 'ratio',
    { T1: [0.700, 0.800], T2: [[0.630, 0.699], [0.801, 0.870]], T3: [[0.530, 0.629], [0.871, 0.950]], T4: [[0.420, 0.529], [0.951, 1.050]], T5: ['<0.420', '>1.050'] },
    ['CHIN_L', 'CHIN_R', 'CH_L', 'CH_R'],
    p => D(p.CHIN_L, p.CHIN_R) / D(p.CH_L, p.CH_R),
    { type: 'ratio', segs: [
      { from: 'CHIN_L', to: 'CHIN_R', label: 'A (подбородок)', color: CA },
      { from: 'CH_L', to: 'CH_R', label: 'B (рот)', color: CB }], formula: 'A ÷ B' });

  /* === вычисление === */
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

  /* === линии-подсказки для точки (переключатель на разметке) === */
  function forPoint(id) {
    const out = { segs: [], rays: [] };
    M.forEach(m => {
      if (!m.viz) return;
      (m.viz.segs || []).forEach(sg => {
        if (sg.from === id) out.segs.push({ other: sg.to, color: sg.color, metric: m.n });
        else if (sg.to === id) out.segs.push({ other: sg.from, color: sg.color, metric: m.n });
      });
      (m.viz.rays || []).forEach(ry => {
        if (ry.from === id) out.rays.push({ other: ry.to, color: ry.color, metric: m.n, vertex: true });
        else if (ry.to === id) out.rays.push({ other: ry.from, color: ry.color, metric: m.n, vertex: false });
      });
    });
    return out;
  }

  FM.metrics = { METRICS: M, computeAll, byKey, forPoint };
})(typeof window !== 'undefined' ? window : this);
