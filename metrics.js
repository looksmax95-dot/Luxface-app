/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (32 метрики, без нейросетей)
   МОДУЛЬ 3/8: js/metrics.js
   ---------------------------------------------------------------------
   Назначение: чистая математика метрик.
     • вход: карта точек {id: {x, y}} в координатах изображения (Y вниз);
     • выход: FM.metrics.computeAll(pts) -> массив из 32 записей
       {n, key, name, unit, ideal:[a,b], hw, value|null, missing:[ids]};
     • value = null, если не хватает хотя бы одной требуемой точки;
     • hw — полуширина диапазона для скоринга (переопределение для
       «девиационных» метрик 25/26/27, где идеал = ноль отклонения).
   Определения операций — по дизайн-доку (спорные помечены комментарием
   «DEF-FLAG» и меняются только здесь).
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = (global.FM = global.FM || {});

  /* ---------------- геометрические примитивы ---------------- */
  const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);              /* длина отрезка   */
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const vec = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
  const vlen = v => Math.hypot(v.x, v.y);
  const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;

  function angBetween(u, v) {                                        /* угол между векторами, ° */
    const du = vlen(u), dv = vlen(v);
    if (!du || !dv) return 0;
    const c = Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (du * dv)));
    return Math.acos(c) * 180 / Math.PI;
  }
  function tiltDeg(inner, outer) {                                   /* наклон к горизонтали, ° */
    const dx = Math.abs(outer.x - inner.x);                          /* >0, если внешний выше внутреннего */
    if (dx < 1e-9) return 0;
    const dyUp = inner.y - outer.y;                                  /* Y вниз: минус = внешний ниже */
    return Math.atan2(dyUp, dx) * 180 / Math.PI;
  }
  function alarAngleDeg(sn, al) {                                    /* DEF-FLAG: угол крыла к вертикали */
    const v = vec(sn, al);
    return Math.atan2(Math.abs(v.x), Math.abs(v.y)) * 180 / Math.PI; /* горизонтальное основание = 90° */
  }
  function lineYat(a, b, x) {                                        /* Y прямой AB в точке X */
    if (Math.abs(b.x - a.x) < 1e-9) return (a.y + b.y) / 2;
    return a.y + (x - a.x) * (b.y - a.y) / (b.x - a.x);
  }

  function reqMissing(pts, req) {
    return req.filter(function (id) {
      return !pts[id] || !isFinite(pts[id].x) || !isFinite(pts[id].y);
    });
  }

  /* ---------------- реестр метрик ---------------- */
  const M = [];
  function def(n, key, name, unit, ideal, req, calc, hw) {
    M.push({ n: n, key: key, name: name, unit: unit, ideal: ideal, req: req, calc: calc, hw: hw || null });
  }

  const ZW = p => D(p.ZY_L, p.ZY_R);                                 /* би-зиго ширина   */
  const EC_L = p => mid(p.EN_L, p.EX_L);                             /* центр левого глаза  */
  const EC_R = p => mid(p.EN_R, p.EX_R);                             /* центр правого глаза */
  const PFL = (p, s) => D(p['EN_' + s], p['EX_' + s]);               /* длина глазной щели  */
  const PHL = (p, s) => D(p['UL_' + s], p['LL_' + s]);               /* высота глазной щели */

  def(1, 'FWHR', 'Ширина лица к высоте верха (FWHR)', 'ratio', [1.9, 2.06],
    ['ZY_L', 'ZY_R', 'GL', 'LS'],
    p => ZW(p) / D(p.GL, p.LS));                                     /* DEF-FLAG: высота = GL->LS */

  def(2, 'tFWHR', 'Полная высота к ширине (tFWHR)', 'ratio', [1.33, 1.38],
    ['TR', 'GN', 'ZY_L', 'ZY_R'],
    p => D(p.TR, p.GN) / ZW(p));

  def(3, 'MFR', 'Средняя треть к нижней (MFR)', 'ratio', [0.95, 1.01],
    ['GL', 'SN', 'GN'],
    p => D(p.GL, p.SN) / D(p.SN, p.GN));                             /* DEF-FLAG */

  def(4, 'JawWidth', 'Ширина челюсти к скулам (Jaw Width)', 'ratio', [0.9, 1],
    ['JW_L', 'JW_R', 'ZY_L', 'ZY_R'],
    p => D(p.JW_L, p.JW_R) / ZW(p));

  def(5, 'Bigonial', 'Межугловая ширина (Bigonial Width)', '%', [85.5, 92],
    ['GO_L', 'GO_R', 'ZY_L', 'ZY_R'],
    p => D(p.GO_L, p.GO_R) / ZW(p) * 100);

  def(6, 'NeckWidth', 'Шея к челюсти (Neck Width)', '%', [90, 100],
    ['NK_L', 'NK_R', 'JW_L', 'JW_R'],
    p => D(p.NK_L, p.NK_R) / D(p.JW_L, p.JW_R) * 100);

  def(7, 'CanthalTilt', 'Наклон глазных щелей (Canthal Tilt)', '°', [5, 9],
    ['EN_L', 'EX_L', 'EN_R', 'EX_R'],
    p => mean([tiltDeg(p.EN_L, p.EX_L), tiltDeg(p.EN_R, p.EX_R)]));

  def(8, 'ESR', 'Сумма глаз к скулам (ESR)', '%', [44.3, 47.3],
    ['EN_L', 'EX_L', 'EN_R', 'EX_R', 'ZY_L', 'ZY_R'],
    p => (PFL(p, 'L') + PFL(p, 'R')) / ZW(p) * 100);

  def(9, 'ES', 'Глаз к межглазному (ES)', 'ratio', [0.93, 1.04],
    ['EN_L', 'EX_L', 'EN_R', 'EX_R'],
    p => mean([PFL(p, 'L'), PFL(p, 'R')]) / D(p.EN_L, p.EN_R));

  def(10, 'ICD', 'Внутреннее межглазное (Inner Canthal Distance)', '%', [25.5, 28],
    ['EN_L', 'EN_R', 'ZY_L', 'ZY_R'],
    p => D(p.EN_L, p.EN_R) / ZW(p) * 100);

  def(11, 'OCD', 'Внешнее межглазное (Outer Canthal Distance)', 'ratio', [0.63, 0.67],
    ['EX_L', 'EX_L', 'EX_R', 'ZY_L', 'ZY_R'].filter((v, i, a) => a.indexOf(v) === i),
    p => D(p.EX_L, p.EX_R) / ZW(p));

  def(12, 'MCA', 'Внутренний угол глаза (Medial Canthal Angle)', '°', [20, 42],
    ['EN_L', 'UL_L', 'LL_L', 'EN_R', 'UL_R', 'LL_R'],
    p => mean([
      angBetween(vec(p.EN_L, p.UL_L), vec(p.EN_L, p.LL_L)),
      angBetween(vec(p.EN_R, p.UL_R), vec(p.EN_R, p.LL_R))
    ]));

  def(13, 'PFL_PHL', 'Длина глаза к высоте (PFL:PHL)', 'ratio', [3, 3.5],
    ['EN_L', 'EX_L', 'UL_L', 'LL_L', 'EN_R', 'EX_R', 'UL_R', 'LL_R'],
    p => mean([PFL(p, 'L') / PHL(p, 'L'), PFL(p, 'R') / PHL(p, 'R')]));

  def(14, 'LowerThird', 'Нижняя треть (Lower Third)', '%', [30.6, 34],
    ['TR', 'SN', 'GN'],
    p => D(p.SN, p.GN) / D(p.TR, p.GN) * 100);

  def(15, 'CheekHeight', 'Высота скул (Cheekbones Height)', '%', [81, 100],
    ['ST', 'ZY_L', 'ZY_R', 'EN_L', 'EX_L', 'EN_R', 'EX_R'],
    p => {
      const zy = (p.ZY_L.y + p.ZY_R.y) / 2;
      const ey = (EC_L(p).y + EC_R(p).y) / 2;
      const den = Math.abs(p.ST.y - ey);
      return den < 1e-9 ? 0 : Math.abs(p.ST.y - zy) / den * 100;
    });

  def(16, 'ChinPhiltrum', 'Подбородок к филтруму (Chin to Philtrum)', 'ratio', [2.05, 2.55],
    ['GN', 'ST', 'SN', 'LS'],
    p => D(p.GN, p.ST) / D(p.SN, p.LS));

  def(17, 'LipProp', 'Пропорции губ (Lip Proportions)', 'ratio', [1.4, 2],
    ['LS', 'ST', 'LI'],
    p => D(p.ST, p.LI) / D(p.LS, p.ST));

  def(18, 'MouthNose', 'Рот к носу (Nose to Mouth Width)', 'ratio', [1.38, 1.53],
    ['CH_L', 'CH_R', 'AL_L', 'AL_R'],
    p => D(p.CH_L, p.CH_R) / D(p.AL_L, p.AL_R));

  def(19, 'NoseZygo', 'Нос к скулам (Nose to Zygo)', 'ratio', [0.2, 0.3],
    ['AL_L', 'AL_R', 'ZY_L', 'ZY_R'],
    p => D(p.AL_L, p.AL_R) / ZW(p));

  def(20, 'NW_ICD', 'Нос к межглазному (Nose Width to ICD)', 'ratio', [0.86, 0.94],
    ['AL_L', 'AL_R', 'EN_L', 'EN_R'],
    p => D(p.AL_L, p.AL_R) / D(p.EN_L, p.EN_R));

  def(21, 'NW_Height', 'Нос: ширина к высоте (Nose Width to Height)', 'ratio', [0.66, 0.85],
    ['AL_L', 'AL_R', 'N', 'SN'],
    p => D(p.AL_L, p.AL_R) / D(p.N, p.SN));

  def(22, 'IAA', 'Угол крыла носа (Ipsilateral Alar Angle)', '°', [85, 95],
    ['SN', 'AL_L', 'AL_R'],
    p => mean([alarAngleDeg(p.SN, p.AL_L), alarAngleDeg(p.SN, p.AL_R)]));

  def(23, 'EME', 'Глаз-рот-глаз (Eye Mouth Eye)', '°', [47, 50],
    ['ST', 'EN_L', 'EX_L', 'EN_R', 'EX_R'],
    p => angBetween(vec(p.ST, EC_L(p)), vec(p.ST, EC_R(p))));

  def(24, 'NoseChin', 'Нос к подбородку (Nose to Chin)', 'ratio', [0.96, 1.03],
    ['N', 'SN', 'ST', 'GN'],
    p => D(p.N, p.SN) / D(p.ST, p.GN));

  def(25, 'NostrilAlign', 'Крылья по вертикали уголков (Nostrils Width)', '%', [0, 2],
    ['AL_L', 'AL_R', 'EN_L', 'EN_R'],
    p => mean([Math.abs(p.AL_L.x - p.EN_L.x), Math.abs(p.AL_R.x - p.EN_R.x)]) /
         D(p.EN_L, p.EN_R) * 100,
    2);                                                              /* hw-переопределение */

  def(26, 'Commisure', 'Уголки рта по центрам глаз (Commisure Alignment)', '%', [0, 3],
    ['CH_L', 'CH_R', 'EN_L', 'EX_L', 'EN_R', 'EX_R'],
    p => mean([Math.abs(p.CH_L.x - EC_L(p).x), Math.abs(p.CH_R.x - EC_R(p).x)]) /
         D(p.CH_L, p.CH_R) * 100,
    3);                                                              /* DEF-FLAG: зрачок, не EN */

  def(27, 'Thirds', 'Равенство третей (Facial Thirds)', '%', [0, 3],
    ['TR', 'GL', 'SN', 'GN'],
    p => {
      const fh = D(p.TR, p.GN) || 1;
      const pcts = [D(p.TR, p.GL), D(p.GL, p.SN), D(p.SN, p.GN)].map(v => v / fh * 100);
      return Math.max.apply(null, pcts.map(v => Math.abs(v - 100 / 3)));
    },
    3);

  def(28, 'BrowHeight', 'Высота брови (Brow Height)', 'ratio', [0.8, 2],
    ['BR_IN_L', 'BR_OUT_L', 'BR_IN_R', 'BR_OUT_R', 'EN_L', 'EX_L', 'EN_R', 'EX_R', 'UL_L', 'LL_L', 'UL_R', 'LL_R'],
    p => mean(['L', 'R'].map(function (s) {
      const ec = s === 'L' ? EC_L(p) : EC_R(p);
      const y = lineYat(p['BR_IN_' + s], p['BR_OUT_' + s], ec.x);
      const den = PHL(p, s);
      return den < 1e-9 ? 0 : Math.abs(ec.y - y) / den;
    })));                                                            /* DEF-FLAG */

  def(29, 'Bitemporal', 'Виски к скулам (Bitemporal Width)', '%', [84, 95],
    ['BT_L', 'BT_R', 'ZY_L', 'ZY_R'],
    p => D(p.BT_L, p.BT_R) / ZW(p) * 100);

  def(30, 'JFA', 'Фронтальный угол челюсти (Jaw Frontal Angle)', '°', [84.5, 95],
    ['GN', 'GO_L', 'GO_R'],
    p => angBetween(vec(p.GN, p.GO_L), vec(p.GN, p.GO_R)));

  def(31, 'IAA_JFA', 'Расхождение IAA и JFA (IAA-JFA deviation)', '°', [0, 2.5],
    ['SN', 'AL_L', 'AL_R', 'GN', 'GO_L', 'GO_R'],
    p => Math.abs(
      mean([alarAngleDeg(p.SN, p.AL_L), alarAngleDeg(p.SN, p.AL_R)]) -
      angBetween(vec(p.GN, p.GO_L), vec(p.GN, p.GO_R))
    ));

  def(32, 'BrowTilt', 'Наклон бровей (Eyebrows Tilt)', '°', [5, 13],
    ['BR_IN_L', 'BR_OUT_L', 'BR_IN_R', 'BR_OUT_R'],
    p => mean([tiltDeg(p.BR_IN_L, p.BR_OUT_L), tiltDeg(p.BR_IN_R, p.BR_OUT_R)]));

  /* ---------------- вычисление всех метрик ---------------- */
  function computeAll(pts) {
    pts = pts || {};
    return M.map(function (m) {
      const missing = reqMissing(pts, m.req);
      let value = null;
      if (!missing.length) {
        value = m.calc(pts);
        if (!isFinite(value)) value = null;
      }
      return {
        n: m.n, key: m.key, name: m.name, unit: m.unit,
        ideal: m.ideal, hw: m.hw, value: value, missing: missing
      };
    });
  }

  function byKey(key) {
    for (let i = 0; i < M.length; i++) if (M[i].key === key) return M[i];
    return null;
  }

  FM.metrics = { METRICS: M, computeAll: computeAll, byKey: byKey };
})(typeof window !== 'undefined' ? window : this);
