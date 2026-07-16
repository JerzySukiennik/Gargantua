// HUD: suit bars, reticle/hand icon, prompts, toasts, warnings, suit log panel.
const ICONS = {
  o2: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#fff" stroke-width="1.6"/><text x="10" y="13.5" font-size="8" fill="#fff" text-anchor="middle" font-family="monospace">O2</text></svg>',
  temp: '<svg viewBox="0 0 20 20"><rect x="8.5" y="3" width="3" height="9" rx="1.5" fill="none" stroke="#fff" stroke-width="1.4"/><circle cx="10" cy="14.5" r="3" fill="#fff"/></svg>',
  suit: '<svg viewBox="0 0 20 20"><circle cx="10" cy="6" r="3" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M4 17 v-3 a6 4.5 0 0 1 12 0 v3" fill="none" stroke="#fff" stroke-width="1.4"/></svg>',
  power: '<svg viewBox="0 0 20 20"><path d="M11 2 L5 11 h4 L9 18 L15 9 h-4 Z" fill="#fff"/></svg>',
};

const HAND_OPEN = '<svg viewBox="0 0 34 34" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 18 V9.5 a1.8 1.8 0 0 1 3.6 0 V16 M13.6 15 V7.5 a1.8 1.8 0 0 1 3.6 0 V15 M17.2 15 V8.5 a1.8 1.8 0 0 1 3.6 0 V16 M20.8 16 V10.5 a1.8 1.8 0 0 1 3.6 0 V19 c0 6-2.5 10-8 10 c-4 0-5.5-1.5-7.5-5 L6.3 19.5 a1.9 1.9 0 0 1 3.2-2 L11 20"/></svg>';
const HAND_FIST = '<svg viewBox="0 0 34 34" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 17 v-4 a2 2 0 0 1 4 0 M13.5 13 v-1.5 a2 2 0 0 1 4 0 V13 M17.5 13 v-1 a2 2 0 0 1 4 0 v2 M21.5 14 a2 2 0 0 1 3.5 1.4 V19 c0 6-2.5 9.5-8 9.5 c-4.5 0-6.5-2-8-6 l-1-3 a1.9 1.9 0 0 1 3.4-1.6"/><path d="M9.5 17 c0-2 1.5-3.5 4-3.5 h8" opacity="0.9"/></svg>';

export function createHUD() {
  const el = {
    hud: document.getElementById('hud'),
    bars: document.getElementById('suit-bars'),
    hand: document.getElementById('reticle-hand'),
    dot: document.getElementById('reticle-dot'),
    prompt: document.getElementById('interact-prompt'),
    toasts: document.getElementById('toasts'),
    warn: document.getElementById('warn-center'),
    suitlog: document.getElementById('suitlog'),
    roomTag: document.getElementById('room-tag'),
    vignette: document.getElementById('vignette'),
  };

  const BAR_DEFS = [
    { key: 'o2', label: 'OXYGEN', fmt: (v) => Math.round(v).toString().padStart(3, '0') + '%' },
    { key: 'temp', label: 'TEMP', fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + '°C' },
    { key: 'suit', label: 'SUIT', fmt: (v) => Math.round(v).toString().padStart(3, '0') + '%' },
    { key: 'power', label: 'POWER', fmt: (v) => Math.round(v).toString().padStart(3, '0') + '%' },
  ];

  const rows = {};
  el.bars.innerHTML = '';
  for (const def of BAR_DEFS) {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `<div class="bar-ico">${ICONS[def.key]}</div><div class="bar-label">${def.label}</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-val mono">---</div>`;
    el.bars.appendChild(row);
    rows[def.key] = { row, fill: row.querySelector('.bar-fill'), val: row.querySelector('.bar-val'), def };
  }

  let handState = '';
  let promptText = '';
  let warnText = '';

  return {
    show(v) { el.hud.hidden = !v; },
    setBars(res) {
      for (const def of BAR_DEFS) {
        const r = rows[def.key];
        const v = res[def.key];
        let pct;
        if (def.key === 'temp') pct = (v - (-60)) / 150 * 100;
        else pct = v;
        r.fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
        r.val.textContent = def.fmt(v);
        const low = def.key === 'temp' ? (v > 75 || v < -45) : v < 20;
        r.row.classList.toggle('low', low);
      }
    },
    setHand(s) {
      if (s === handState) return;
      handState = s;
      if (s === 'none') { el.hand.hidden = true; el.dot.style.opacity = '0.9'; }
      else {
        el.hand.hidden = false;
        el.hand.innerHTML = s === 'fist' ? HAND_FIST : HAND_OPEN;
        el.dot.style.opacity = '0';
      }
    },
    setPrompt(t) {
      if (t === promptText) return;
      promptText = t;
      el.prompt.hidden = !t;
      if (t) el.prompt.textContent = t;
    },
    setWarn(t) {
      if (t === warnText) return;
      warnText = t;
      el.warn.hidden = !t;
      if (t) el.warn.textContent = t;
    },
    setVignette(a) { el.vignette.style.opacity = String(a); },
    setRoomTag(t) {
      el.roomTag.hidden = !t;
      if (t) el.roomTag.innerHTML = t;
    },
    toast(text, warn = false) {
      const d = document.createElement('div');
      d.className = 'toast' + (warn ? ' warn' : '');
      d.textContent = text;
      el.toasts.appendChild(d);
      setTimeout(() => { d.style.transition = 'opacity 0.5s'; d.style.opacity = '0'; }, 3600);
      setTimeout(() => d.remove(), 4200);
    },
    setSuitLog(html) { el.suitlog.innerHTML = html; },
    toggleSuitLog(force) {
      el.suitlog.hidden = force !== undefined ? !force : !el.suitlog.hidden;
      return !el.suitlog.hidden;
    },
  };
}
