/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (37 метрик, без нейросетей)
   МОДУЛЬ 1/7: points.js
   ---------------------------------------------------------------------
   Реестр из 36 анатомических точек + 7 этапов + правила валидации.
   Изменения v2: добавлены PUP_L / PUP_R (зрачки) — нужны для
   MFR, ESR, IAA, EME, Brow Height. Всего 36 точек.
   ===================================================================== */
(function (global) {
  'use strict';

  const FM = (global.FM = global.FM || {});

  const POINTS = {};
  function pt(id, name, guide, zoom, side) {
    POINTS[id] = { id: id, name: name, guide: guide, zoom: zoom, side: side || 'C' };
  }

  /* --- Этап 1: осевая линия (5) --- */
  pt('TR', 'Линия роста волос (трихион)',
    'Центр лба: граница кожи и волос строго по вертикали лица.', 1.3, 'C');
  pt('GL', 'Глабелла (нижний край бровей)',
    'Точка между бровями на вертикали лица: самый нижний край волосков по центру.', 1.6, 'C');
  pt('N',  'Переносица (назион)',
    'Самая глубокая точка впадины между глазами — где начинается спинка носа.', 2.0, 'C');
  pt('SN', 'Основание носа (субназале)',
    'Центр под носом: где перегородка соединяется с верхней губой.', 2.0, 'C');
  pt('GN', 'Низ подбородка (гнатион)',
    'Самая нижняя точка подбородка строго по центру.', 1.6, 'C');

  /* --- Этап 2: скулы и виски (4) --- */
  pt('ZY_L', 'Скула слева (зигион)',
    'Самая широкая точка скуловой дуги слева по внешнему краю силуэта.', 1.5, 'L');
  pt('ZY_R', 'Скула справа (зигион)',
    'Зеркально: самая широкая точка скуловой дуги справа.', 1.5, 'R');
  pt('BT_L', 'Висок слева',
    'Самая широкая точка контура лба/виска НАД скулой, край силуэта.', 1.5, 'L');
  pt('BT_R', 'Висок справа',
    'Зеркально: самая широкая точка контура лба/виска над скулой.', 1.5, 'R');

  /* --- Этап 3: челюсть и шея (6) --- */
  pt('JW_L', 'Ширина челюсти слева',
    'Самая широкая точка нижней трети силуэта слева (массив жевательной мышцы).', 1.5, 'L');
  pt('JW_R', 'Ширина челюсти справа',
    'Зеркально: самая широкая точка нижней трети справа.', 1.5, 'R');
  pt('GO_L', 'Угол челюсти слева (гонион)',
    'Точка излома контура: где низ челюсти поворачивает вверх к уху.', 2.0, 'L');
  pt('GO_R', 'Угол челюсти справа (гонион)',
    'Зеркально: точка излома контура челюсти справа.', 2.0, 'R');
  pt('NK_L', 'Шея слева',
    'Самая широкая точка контура шеи на уровне угла челюсти.', 1.5, 'L');
  pt('NK_R', 'Шея справа',
    'Зеркально: самая широкая точка контура шеи.', 1.5, 'R');

  /* --- Этап 4: уголки глаз и ЗРАЧКИ (6) --- */
  pt('EN_L', 'Внутренний уголок глаза слева',
    'Точка слёзного озера у переносицы. Ставь точно в стык век.', 3.2, 'L');
  pt('EX_L', 'Внешний уголок глаза слева',
    'Внешняя точка смыкания век у виска.', 3.2, 'L');
  pt('PUP_L', 'Центр зрачка слева',
    'Центр ЧЁРНОГО кружка в середине радужки. Зум максимум, ставь точно в центр зрачка.', 4.0, 'L');
  pt('EN_R', 'Внутренний уголок глаза справа',
    'Зеркально: слёзное озеро у переносицы.', 3.2, 'R');
  pt('EX_R', 'Внешний уголок глаза справа',
    'Зеркально: внешняя точка смыкания век.', 3.2, 'R');
  pt('PUP_R', 'Центр зрачка справа',
    'Зеркально: центр чёрного кружка в середине правой радужки. Зум максимум.', 4.0, 'R');

  /* --- Этап 5: веки (4) --- */
  pt('UL_L', 'Середина верхнего века слева',
    'Самая верхняя точка ресничного края левого глаза, посередине между уголками.', 3.6, 'L');
  pt('LL_L', 'Середина нижнего века слева',
    'Самая нижняя точка края нижнего века левого глаза, посередине.', 3.6, 'L');
  pt('UL_R', 'Середина верхнего века справа',
    'Зеркально: верхняя точка ресничного края правого глаза.', 3.6, 'R');
  pt('LL_R', 'Середина нижнего века справа',
    'Зеркально: нижняя точка края нижнего века.', 3.6, 'R');

  /* --- Этап 6: брови (4) --- */
  pt('BR_IN_L', 'Начало брови слева',
    'Внутренний кончик волосков брови (головка брови).', 2.6, 'L');
  pt('BR_OUT_L', 'Кончик брови слева',
    'Самая внешняя точка хвоста брови.', 2.6, 'L');
  pt('BR_IN_R', 'Начало брови справа',
    'Зеркально: внутренний кончик волосков брови.', 2.6, 'R');
  pt('BR_OUT_R', 'Кончик брови справа',
    'Зеркально: самая внешняя точка хвоста брови.', 2.6, 'R');

  /* --- Этап 7: нос и рот (7) --- */
  pt('AL_L', 'Крыло носа слева',
    'Самая широкая точка контура ноздри слева.', 2.4, 'L');
  pt('AL_R', 'Крыло носа справа',
    'Зеркально: самая широкая точка контура ноздри.', 2.4, 'R');
  pt('LS', 'Верх верхней губы',
    'Центр верхней кромки верхней губы: середина дуги Купидона, конец фильтрума.', 2.6, 'C');
  pt('ST', 'Линия смыкания губ (стомион)',
    'Центр щели между губами: где верхняя касается нижней.', 2.6, 'C');
  pt('LI', 'Низ нижней губы',
    'Центр нижней кромки нижней губы, где кожа переходит в подбородок.', 2.6, 'C');
  pt('CH_L', 'Уголок рта слева',
    'Точка смыкания губ в левом углу рта.', 2.6, 'L');
  pt('CH_R', 'Уголок рта справа',
    'Зеркально: точка смыкания губ в правом углу рта.', 2.6, 'R');

  const STAGES = [
    { id: 1, title: 'Осевая линия',   caption: '5 точек сверху вниз по центру',
      points: ['TR', 'GL', 'N', 'SN', 'GN'] },
    { id: 2, title: 'Скулы и виски',  caption: '4 точки по внешнему краю силуэта',
      points: ['ZY_L', 'ZY_R', 'BT_L', 'BT_R'] },
    { id: 3, title: 'Челюсть и шея',  caption: '6 точек нижнего силуэта',
      points: ['JW_L', 'JW_R', 'GO_L', 'GO_R', 'NK_L', 'NK_R'] },
    { id: 4, title: 'Глаза и зрачки', caption: '6 точек: уголки и центр зрачка (макс зум)',
      points: ['EN_L', 'EX_L', 'PUP_L', 'EN_R', 'EX_R', 'PUP_R'] },
    { id: 5, title: 'Веки',           caption: '4 точки: середины краёв век',
      points: ['UL_L', 'LL_L', 'UL_R', 'LL_R'] },
    { id: 6, title: 'Брови',          caption: '4 точки: головка и хвост',
      points: ['BR_IN_L', 'BR_OUT_L', 'BR_IN_R', 'BR_OUT_R'] },
    { id: 7, title: 'Нос и рот',      caption: '7 точек: крылья носа и контур губ',
      points: ['AL_L', 'AL_R', 'LS', 'ST', 'LI', 'CH_L', 'CH_R'] }
  ];

  const ORDER = STAGES.reduce(function (acc, s) { return acc.concat(s.points); }, []);

  function stageOf(id) {
    for (let i = 0; i < STAGES.length; i++) {
      if (STAGES[i].points.indexOf(id) !== -1) return STAGES[i];
    }
    return null;
  }
  function indexInStage(id) {
    const s = stageOf(id);
    return s ? s.points.indexOf(id) : -1;
  }
  function indexOf(id) { return ORDER.indexOf(id); }
  function pairOf(id) {
    if (/_L$/.test(id)) return id.replace(/_L$/, '_R');
    if (/_R$/.test(id)) return id.replace(/_R$/, '_L');
    return null;
  }

  /* === ВАЛИДАЦИЯ === */
  const SYM_PAIRS = [
    ['ZY_L', 'ZY_R'], ['BT_L', 'BT_R'], ['JW_L', 'JW_R'], ['GO_L', 'GO_R'],
    ['NK_L', 'NK_R'], ['EN_L', 'EN_R'], ['EX_L', 'EX_R'],
    ['PUP_L', 'PUP_R'],                                   /* НОВОЕ: зрачки */
    ['UL_L', 'UL_R'], ['LL_L', 'LL_R'],
    ['BR_IN_L', 'BR_IN_R'], ['BR_OUT_L', 'BR_OUT_R'],
    ['AL_L', 'AL_R'], ['CH_L', 'CH_R']
  ];
  const YORDERS = [
    ['TR', 'GL', 'N', 'SN', 'GN'],
    ['LS', 'ST', 'LI']
  ];
  const XORDERS = [
    ['EX_L', 'EN_L', 'EN_R', 'EX_R'],
    ['CH_L', 'AL_L', 'AL_R', 'CH_R']
  ];
  const BETWEEN_X = [
    ['UL_L', 'EX_L', 'EN_L'], ['LL_L', 'EX_L', 'EN_L'],
    ['UL_R', 'EN_R', 'EX_R'], ['LL_R', 'EN_R', 'EX_R'],
    ['PUP_L', 'EX_L', 'EN_L'],                            /* НОВОЕ: зрачок между уголками */
    ['PUP_R', 'EN_R', 'EX_R']                             /* НОВОЕ */
  ];
  const MIDLINE = ['TR', 'GL', 'N', 'SN', 'GN', 'LS', 'ST', 'LI'];

  function has(pts, id) {
    return !!pts[id] && isFinite(pts[id].x) && isFinite(pts[id].y);
  }
  function need(pts, ids) {
    return ids.every(function (id) { return has(pts, id); });
  }

  function validate(pts) {
    const warns = [];
    if (!need(pts, ['TR', 'GN'])) return warns;
    const faceH = Math.abs(pts.GN.y - pts.TR.y) || 1;
    const tolY = faceH * 0.04;
    const pct = function (d) { return Math.round((d / faceH) * 100); };

    SYM_PAIRS.forEach(function (pr) {
      if (!need(pts, pr)) return;
      const d = Math.abs(pts[pr[0]].y - pts[pr[1]].y);
      if (d > tolY) {
        warns.push({
          code: 'SYM_Y', ids: pr,
          msg: POINTS[pr[0]].name + ' и ' + POINTS[pr[1]].name +
               ': расхождение по высоте ' + pct(d) + '% лица. Голова наклонена или точка сбита.'
        });
      }
    });

    YORDERS.forEach(function (chain) {
      if (!need(pts, chain)) return;
      for (let i = 1; i < chain.length; i++) {
        const d = pts[chain[i]].y - pts[chain[i - 1]].y;
        if (d < -faceH * 0.01) {
          warns.push({
            code: 'Y_ORDER', ids: [chain[i - 1], chain[i]],
            msg: POINTS[chain[i]].name + ' оказалась ВЫШЕ ' + POINTS[chain[i - 1]].name + '.'
          });
        }
      }
    });

    XORDERS.forEach(function (chain) {
      if (!need(pts, chain)) return;
      for (let i = 1; i < chain.length; i++) {
        if (pts[chain[i]].x <= pts[chain[i - 1]].x) {
          warns.push({
            code: 'X_ORDER', ids: [chain[i - 1], chain[i]],
            msg: POINTS[chain[i]].name + ' должна быть правее ' + POINTS[chain[i - 1]].name + '.'
          });
        }
      }
    });

    BETWEEN_X.forEach(function (tr) {
      if (!need(pts, tr)) return;
      const a = Math.min(pts[tr[1]].x, pts[tr[2]].x);
      const b = Math.max(pts[tr[1]].x, pts[tr[2]].x);
      const x = pts[tr[0]].x;
      if (x < a || x > b) {
        warns.push({
          code: 'BETWEEN_X', ids: tr,
          msg: POINTS[tr[0]].name + ' вышла за границы — уточни положение.'
        });
      }
    });

    if (need(pts, ['EN_L', 'EN_R'])) {
      const lo = pts.EN_L.x, hi = pts.EN_R.x;
      MIDLINE.forEach(function (id) {
        if (!has(pts, id)) return;
        if (pts[id].x < lo || pts[id].x > hi) {
          warns.push({
            code: 'MIDLINE', ids: [id],
            msg: POINTS[id].name + ' ушла с вертикали лица.'
          });
        }
      });
    }
    return warns;
  }

  /* === ЛИНИИ ОБЗОРА (с новыми линиями для зрачков) === */
  const REVIEW_LINES = [
    ['ZY_L', 'ZY_R'], ['BT_L', 'BT_R'], ['JW_L', 'JW_R'], ['GO_L', 'GO_R'], ['NK_L', 'NK_R'],
    ['TR', 'GN'], ['EX_L', 'EX_R'], ['EN_L', 'EN_R'],
    ['EN_L', 'EX_L'], ['EN_R', 'EX_R'], ['UL_L', 'LL_L'], ['UL_R', 'LL_R'],
    ['EN_L', 'PUP_L'], ['EX_L', 'PUP_L'],                  /* НОВОЕ: зрачки */
    ['EN_R', 'PUP_R'], ['EX_R', 'PUP_R'],                  /* НОВОЕ */
    ['BR_IN_L', 'BR_OUT_L'], ['BR_IN_R', 'BR_OUT_R'],
    ['AL_L', 'AL_R'], ['CH_L', 'CH_R'], ['LS', 'LI'], ['N', 'SN'], ['SN', 'GN'],
    ['GO_L', 'GN'], ['GO_R', 'GN']
  ];

  FM.points = {
    POINTS: POINTS, STAGES: STAGES, ORDER: ORDER, REVIEW_LINES: REVIEW_LINES,
    total: ORDER.length,          /* 36 */
    totalStages: STAGES.length,   /* 7  */
    stageOf: stageOf, indexInStage: indexInStage, indexOf: indexOf, pairOf: pairOf,
    validate: validate
  };
})(typeof window !== 'undefined' ? window : this);
