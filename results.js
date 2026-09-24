/* =====================================================================
   FaceMetrics — TG Mini App: оценка геометрии лица (37 метрик, без нейросетей)
   МОДУЛЬ 6/7: style.css
   ---------------------------------------------------------------------
   Тёмная тема, mobile-first (S23 Ultra), без фреймворков.
   v3: добавлен вьювер измерений (.viewer, .v-*), режимы mode-full/mode-split,
   убраны мёртвые классы мини-бара (.mbar/.zone/.dot).
   ===================================================================== */

:root {
  --bg: #0f1115;
  --panel: #151920;
  --line: #1c2027;
  --text: #e8ecf1;
  --muted: #9aa3ad;
  --dim: #6b7480;
  --accent: #00ffaa;
  --t1: #22c55e;
  --t2: #a3e635;
  --t3: #facc15;
  --t4: #fb923c;
  --t5: #ef4444;
  --tn: #8b939d;
}

[hidden] { display: none !important; }

* { box-sizing: border-box; }

html { height: 100%; }

body {
  height: 100vh;
  height: 100dvh;
  margin: 0;
  overflow: hidden;
  overscroll-behavior: none;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}

button { font: inherit; }

/* ================= ШАПКА ================= */
#hdr {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 10px;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
  position: relative;
  z-index: 5;
}
.hdr-back {
  width: 36px; height: 36px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 26px;
  line-height: 1;
  border-radius: 10px;
  cursor: pointer;
}
.hdr-back:active { background: var(--panel); }
.hdr-title { flex: 1; font-weight: 700; font-size: 15px; }
.hdr-right { font-size: 12px; color: var(--muted); }

/* ================= ЭКРАНЫ ================= */
#app { height: calc(100% - 48px); position: relative; }

.screen { display: none; height: 100%; overflow-y: auto; padding: 16px; }
.screen.active { display: flex; flex-direction: column; gap: 12px; }

h1 { font-size: 22px; margin: 0; }
.lead { color: var(--muted); font-size: 14px; line-height: 1.45; margin: 0; }
.disclaimer, .privacy { font-size: 11px; color: var(--dim); line-height: 1.5; }

.checklist {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px;
  font-size: 13px;
}
.chk-title { font-weight: 600; }
.checklist ul {
  margin: 6px 0 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #b7bfc8;
}

/* ================= КНОПКИ ================= */
.btn {
  border: 1px solid #262c35;
  background: #1a1f27;
  color: var(--text);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
.btn.primary { background: var(--accent); color: #06251b; border-color: transparent; }
.btn.ghost { background: transparent; }
.btn.wide { width: 100%; }
.btn.grow { flex: 1; min-width: 0; }
.btn.sq { width: 48px; flex: 0 0 48px; padding: 12px 0; font-size: 20px; }
.btn:active { transform: scale(0.97); }

/* ================= РАЗМЕТКА / ОБЗОР ================= */
#scrMark, #scrReview { padding: 0; overflow: hidden; }

.mark-hud {
  padding: 8px 12px;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
  user-select: none;
  -webkit-user-select: none;
}
.hud-line1 {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
  font-size: 13px;
}
.hud-line2 {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--dim);
  margin-top: 2px;
}
#hudZoom { color: var(--accent); font-variant-numeric: tabular-nums; }
.hud-hint { text-align: right; }

.mark-canvas-wrap { position: relative; flex: 1; min-height: 0; background: var(--bg); }
.mark-canvas-wrap canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;          /* все жесты — viewport'у photo.js */
}

.mark-card {
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  background: var(--panel);
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.card-name { font-weight: 600; font-size: 15px; }
.card-guide { font-size: 13px; color: var(--muted); line-height: 1.4; }
.card-btns { display: flex; gap: 8px; }
.card-btns.pad {
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  background: var(--panel);
  border-top: 1px solid var(--line);
}

.review-warns {
  max-height: 26vh;
  overflow-y: auto;
  background: #241d10;
  border: 1px solid #3a2f14;
  border-radius: 12px;
  padding: 8px 12px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.warn-item { color: #fcd34d; line-height: 1.35; }

/* ================= РЕЗУЛЬТАТЫ ================= */
.res-empty { padding: 24px; text-align: center; color: var(--muted); }

.res-head {
  text-align: center;
  padding: 18px 12px;
  border-radius: 16px;
  background: var(--panel);
  border: 1px solid var(--line);
}
.res-score { font-size: 52px; font-weight: 800; line-height: 1; }
.res-score span { font-size: 18px; font-weight: 600; color: var(--dim); }
.res-tier { margin-top: 6px; font-weight: 700; font-size: 16px; }
.res-meta { margin-top: 4px; font-size: 12px; color: var(--dim); }
.res-head.t1 .res-tier { color: var(--t1); }
.res-head.t2 .res-tier { color: var(--t2); }
.res-head.t3 .res-tier { color: var(--t3); }
.res-head.t4 .res-tier { color: var(--t4); }
.res-head.t5 .res-tier { color: var(--t5); }

.res-dist { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.dseg {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px 4px;
  text-align: center;
}
.dseg b { display: block; font-size: 11px; color: var(--dim); }
.dseg span { font-size: 16px; font-weight: 700; }
.dseg.t1 span { color: var(--t1); }
.dseg.t2 span { color: var(--t2); }
.dseg.t3 span { color: var(--t3); }
.dseg.t4 span { color: var(--t4); }
.dseg.t5 span { color: var(--t5); }

.res-hint {
  font-size: 12px;
  color: var(--muted);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px 12px;
}

.res-list { display: flex; flex-direction: column; gap: 8px; }

.mrow {
  display: grid;
  grid-template-columns: 26px 1fr 34px;
  gap: 10px;
  align-items: center;
  background: var(--panel);
  border: 1px solid var(--line);
  border-left: 3px solid #3a414b;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
}
.mrow:active { transform: scale(0.985); background: #1a2028; }
.mrow.t1 { border-left-color: var(--t1); }
.mrow.t2 { border-left-color: var(--t2); }
.mrow.t3 { border-left-color: var(--t3); }
.mrow.t4 { border-left-color: var(--t4); }
.mrow.t5 { border-left-color: var(--t5); }

.mnum { color: var(--dim); font-size: 12px; text-align: right; }
.mbody { min-width: 0; }
.mname { font-size: 13px; font-weight: 600; }
.mvals { font-size: 12px; color: #cfd6dd; margin-top: 2px; }
.mideal { color: var(--dim); }
.mdir { color: var(--muted); }

.mtier { font-weight: 800; font-size: 14px; text-align: center; color: var(--tn); }
.mrow.t1 .mtier { color: var(--t1); }
.mrow.t2 .mtier { color: var(--t2); }
.mrow.t3 .mtier { color: var(--t3); }
.mrow.t4 .mtier { color: var(--t4); }
.mrow.t5 .mtier { color: var(--t5); }

.res-missing {
  font-size: 12px;
  color: #fbbf24;
  background: #241d10;
  border: 1px solid #3a2f14;
  padding: 10px 12px;
  border-radius: 10px;
  line-height: 1.45;
}
.res-actions { display: flex; gap: 8px; }
.res-disclaimer {
  font-size: 11px;
  color: var(--dim);
  line-height: 1.5;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

/* ================= ВЬЮВЕР ИЗМЕРЕНИЙ ================= */
.viewer {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.v-top { position: relative; flex: 1; min-height: 0; background: #000; }
.v-top canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: pan-y;         /* вертикальный скролл списка не блокируем в split */
}
.viewer.mode-split .v-top { flex: 0 0 42vh; }

.v-btn {
  width: 40px; height: 40px;
  border-radius: 50%;
  border: 1px solid #2a3038;
  background: rgba(15, 17, 21, 0.72);
  color: var(--text);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
.v-btn:active { transform: scale(0.92); }
.v-close { position: absolute; top: 10px; left: 10px; z-index: 3; }
.v-mode  { position: absolute; top: 10px; right: 10px; z-index: 3; }

.v-nav {
  position: absolute;
  left: 0; right: 0; bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  z-index: 3;
}
.v-counter {
  font-size: 12px;
  color: #cfd6dd;
  background: rgba(15, 17, 21, 0.72);
  padding: 4px 10px;
  border-radius: 10px;
  font-variant-numeric: tabular-nums;
}

.v-caption {
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
  background: var(--panel);
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.v-name { font-weight: 700; font-size: 14px; }
.v-tier {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 800;
  background: rgba(139, 147, 157, 0.15);
  color: var(--tn);
}
.v-tier.t1 { background: rgba(34, 197, 94, 0.16); color: var(--t1); }
.v-tier.t2 { background: rgba(163, 230, 53, 0.16); color: var(--t2); }
.v-tier.t3 { background: rgba(250, 204, 21, 0.16); color: var(--t3); }
.v-tier.t4 { background: rgba(251, 146, 60, 0.16); color: var(--t4); }
.v-tier.t5 { background: rgba(239, 68, 68, 0.16); color: var(--t5); }
.v-val { font-size: 13px; color: #cfd6dd; }
.v-formula { font-size: 11px; color: var(--dim); line-height: 1.4; }

.v-list {
  display: none;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  flex-direction: column;
  background: var(--bg);
}
.viewer.mode-split .v-list { display: flex; }

.v-row {
  display: grid;
  grid-template-columns: 24px 1fr auto 34px;
  gap: 8px;
  align-items: center;
  padding: 9px 12px;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
  cursor: pointer;
}
.v-row:active { background: #1a2028; }
.v-row.cur { background: #1a2028; box-shadow: inset 3px 0 0 var(--accent); }
.v-n { color: var(--dim); text-align: right; }
.v-nm { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.v-v { color: #cfd6dd; font-variant-numeric: tabular-nums; }
.v-t { font-weight: 800; text-align: center; color: var(--tn); }
.v-row.t1 .v-t { color: var(--t1); }
.v-row.t2 .v-t { color: var(--t2); }
.v-row.t3 .v-t { color: var(--t3); }
.v-row.t4 .v-t { color: var(--t4); }
.v-row.t5 .v-t { color: var(--t5); }

/* ================= ЛОАДЕР ================= */
#loader {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(10, 12, 15, 0.85);
}
.spinner {
  width: 42px; height: 42px;
  border-radius: 50%;
  border: 3px solid #262c35;
  border-top-color: var(--accent);
  animation: spin 0.9s linear infinite;
}
.loader-text { font-size: 13px; color: var(--muted); }
@keyframes spin { to { transform: rotate(360deg); } }

/* ================= ПЛАНШЕТ / ДЕСКТОП (отладка) ================= */
@media (min-width: 700px) {
  #scrWelcome > *, #scrUpload > *, #scrResults > * {
    width: 100%;
    max-width: 640px;
    margin-inline: auto;
  }
  .viewer { max-width: 560px; margin-inline: auto; border-inline: 1px solid var(--line); }
  }
