// Componentes de interface: faders, knobs, botões, medidores e diálogos.
import { get, set, watch, onCleanup, fmtPos, posToDb, dbToPos } from './state.js';

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const quant = (v, step) => (step ? Math.round(v / step) * step : v);

// Arraste relativo (não "pula" ao tocar) + duplo toque para valor padrão.
function dragger(el, { axis, size, getV, setV, min, max, def, step, fine = 1 }) {
  let start = null;
  let lastTap = 0;
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    el.setPointerCapture(e.pointerId);
    start = { x: e.clientX, y: e.clientY, v: getV(), moved: false, id: e.pointerId };
    el.classList.add('active');
  });
  el.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const d = axis === 'y' ? start.y - e.clientY : e.clientX - start.x;
    if (Math.abs(d) > 3) start.moved = true;
    const f = e.shiftKey ? 0.2 : fine;
    const v = start.v + (d / Math.max(20, size())) * (max - min) * f;
    setV(clamp(quant(v, step), min, max));
  });
  const end = (e) => {
    if (!start || e.pointerId !== start.id) return;
    el.classList.remove('active');
    if (!start.moved && e.type === 'pointerup') {
      const now = performance.now();
      if (now - lastTap < 320) { setV(def); lastTap = 0; } else lastTap = now;
    }
    start = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const s = step || (max - min) / 100;
    setV(clamp(quant(getV() + (e.deltaY < 0 ? s : -s), step), min, max));
  }, { passive: false });
  el.tabIndex = 0;
  el.addEventListener('keydown', (e) => {
    const s = step || (max - min) / 100;
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (dir) { e.preventDefault(); setV(clamp(quant(getV() + dir * s, step), min, max)); }
  });
}

/** Fader vertical. Valor em [min,max]. */
export function vslider({ path, min = 0, max = 1, def = 0.75, step = 0, fmt = fmtPos, cls = '', center = false }) {
  const fill = h('div', { class: 'vs-fill' });
  const thumb = h('div', { class: 'vs-thumb' });
  const track = h('div', { class: 'vs-track' + (center ? ' center' : '') }, h('div', { class: 'vs-groove' }), fill, thumb);
  const val = h('div', { class: 'vs-val' });
  const el = h('div', { class: 'vs ' + cls }, track, val);
  const draw = () => {
    const v = get(path);
    if (typeof v !== 'number') return;
    const n = (v - min) / (max - min);
    el.style.setProperty('--p', n);
    el.style.setProperty('--z', center ? (0 - min) / (max - min) : 0);
    val.textContent = fmt(v);
  };
  dragger(track, { axis: 'y', size: () => track.clientHeight - 30, getV: () => get(path), setV: (v) => set(path, v), min, max, def, step });
  watch(path, draw);
  draw();
  return el;
}

/** Fader horizontal (Modo Músico / envios). */
export function hslider({ path, min = 0, max = 1, def = 0.75, step = 0, fmt = fmtPos, cls = '', color }) {
  const fill = h('div', { class: 'hs-fill', style: color ? `background:${color}` : '' });
  const thumb = h('div', { class: 'hs-thumb' });
  const track = h('div', { class: 'hs-track' }, fill, thumb);
  const val = h('div', { class: 'hs-val' });
  const el = h('div', { class: 'hs ' + cls }, track, val);
  const draw = () => {
    const v = get(path);
    if (typeof v !== 'number') return;
    el.style.setProperty('--p', (v - min) / (max - min));
    val.textContent = fmt(v);
  };
  dragger(track, { axis: 'x', size: () => track.clientWidth - 28, getV: () => get(path), setV: (v) => set(path, v), min, max, def, step });
  watch(path, draw);
  draw();
  return el;
}

/** Botões −/+ de 1 dB para faders (ajuste fino em telas pequenas). */
export function nudge(path, dbStep = 1) {
  const bump = (dir) => {
    let db = posToDb(get(path));
    if (db === -Infinity) db = dir > 0 ? -60 : -Infinity;
    else db = Math.round(db) + dir * dbStep;
    set(path, db < -60 ? 0 : Math.min(1, dbToPos(db)));
  };
  return [
    h('button', { class: 'nudge', 'aria-label': 'Diminuir 1 dB', onclick: () => bump(-1) }, '−'),
    h('button', { class: 'nudge', 'aria-label': 'Aumentar 1 dB', onclick: () => bump(1) }, '+'),
  ];
}

/** Knob rotativo (arraste vertical). */
export function knob({ path, label, min, max, def, step = 0, unit = '', log = false, fmt, cls = '', bipolar }) {
  bipolar = bipolar ?? (min < 0 && max > 0);
  def = def ?? (bipolar ? 0 : min);
  const toN = (v) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
  const fromN = (n) => (log ? min * Math.pow(max / min, n) : min + n * (max - min));
  const format = fmt || ((v) => {
    if (unit === 'Hz') return fmtHzLocal(v) + 'Hz';
    const d = step && step < 1 ? (step < 0.1 ? 2 : 1) : 0;
    return (bipolar && v > 0 ? '+' : '') + v.toFixed(d) + (unit ? ' ' + unit : '');
  });
  const R = 18, C = 2 * Math.PI * R, ARC = 0.75;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.innerHTML = `<circle class="k-bg" cx="24" cy="24" r="${R}" stroke-dasharray="${C * ARC} ${C}" transform="rotate(135 24 24)"/>
    <circle class="k-val" cx="24" cy="24" r="${R}" transform="rotate(135 24 24)"/>
    <circle class="k-cap" cx="24" cy="24" r="12"/><line class="k-ptr" x1="24" y1="24" x2="24" y2="14"/>`;
  const arc = svg.querySelector('.k-val');
  const ptr = svg.querySelector('.k-ptr');
  const val = h('div', { class: 'k-v' });
  const dial = h('div', { class: 'k-dial' }, svg);
  const el = h('div', { class: 'knob ' + cls }, label ? h('div', { class: 'k-l' }, label) : null, dial, val);
  const draw = () => {
    const v = get(path);
    if (typeof v !== 'number') return;
    const n = clamp(toN(v), 0, 1);
    const z = bipolar ? toN(0) : 0;
    const a = Math.min(n, z), b = Math.max(n, z);
    arc.setAttribute('stroke-dasharray', `${C * ARC * (b - a)} ${C}`);
    arc.setAttribute('stroke-dashoffset', `${-C * ARC * a}`);
    ptr.setAttribute('transform', `rotate(${-135 + n * 270} 24 24)`);
    val.textContent = format(v);
  };
  dragger(dial, {
    axis: 'y', size: () => 160, min: 0, max: 1, def: toN(def), step: 0,
    getV: () => toN(get(path)),
    setV: (n) => {
      let v = fromN(n);
      if (step) v = quant(v, step);
      set(path, +clamp(v, min, max).toFixed(4));
    },
  });
  watch(path, draw);
  draw();
  return el;
}
function fmtHzLocal(f) {
  return f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 1 : 2).replace(/\.?0+$/, '') + 'k' : Math.round(f) + ' ';
}

/** Botão liga/desliga ligado a um path booleano. */
export function tbtn(path, text, cls = '', extra) {
  const b = h('button', { class: 'tb ' + cls, 'aria-pressed': 'false', onclick: () => set(path, !get(path)) }, text);
  const draw = () => {
    const on = !!get(path);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    extra?.(b, on);
  };
  watch(path, draw);
  draw();
  return b;
}

export function selectBox(path, options, cls = '', onChange) {
  const s = h('select', { class: 'sel ' + cls, onchange: () => { const v = isNaN(+s.value) || s.value === '' ? s.value : +s.value; onChange ? onChange(v) : set(path, v); } },
    options.map((o) => (Array.isArray(o) ? h('option', { value: o[0] }, o[1]) : h('option', { value: o }, o))));
  const draw = () => { s.value = String(get(path)); };
  watch(path, draw);
  draw();
  return s;
}

export function textInput(path, { maxlength = 16, cls = '', type = 'text', placeholder = '' } = {}) {
  const i = h('input', { class: 'txt ' + cls, type, maxlength, placeholder, onchange: () => set(path, i.value) });
  const draw = () => { if (document.activeElement !== i) i.value = get(path) ?? ''; };
  watch(path, draw);
  draw();
  return i;
}

export function card(title, ...children) {
  return h('section', { class: 'card' }, title ? h('h3', { class: 'card-t' }, title) : null, ...children);
}

// ---------- medidores (simulação no modo demo) ----------
const meters = new Set();
export function meter(levelFn, cls = '') {
  const bar = h('div', { class: 'm-bar' });
  const peak = h('div', { class: 'm-peak' });
  const el = h('div', { class: 'meter ' + cls }, bar, peak);
  const m = { el, bar, peak, levelFn, v: 0, pk: 0, pkT: 0 };
  meters.add(m);
  onCleanup(() => meters.delete(m));
  return el;
}
let last = 0;
function loop(t) {
  requestAnimationFrame(loop);
  if (t - last < 33) return;
  last = t;
  tickSignals();
  for (const m of meters) {
    const target = clamp(m.levelFn(), 0, 1);
    m.v = target > m.v ? target : m.v * 0.88 + target * 0.12;
    if (m.v >= m.pk) { m.pk = m.v; m.pkT = t; } else if (t - m.pkT > 1200) m.pk = Math.max(m.v, m.pk - 0.02);
    m.bar.style.transform = `scaleY(${m.v.toFixed(3)})`;
    m.peak.style.bottom = (m.pk * 100).toFixed(1) + '%';
    m.el.classList.toggle('clip', m.pk > 0.97);
  }
}
requestAnimationFrame(loop);

// Sinal de "música" simulado por fonte de entrada.
export const sig = new Float32Array(64);
const tgt = new Float32Array(64);
for (let i = 0; i < 64; i++) tgt[i] = 0.3 + Math.random() * 0.5;
function tickSignals() {
  for (let i = 0; i < 64; i++) {
    if (Math.random() < 0.04) tgt[i] = Math.random() < 0.15 ? 0.02 : 0.35 + Math.random() * 0.6;
    const jitter = 0.75 + Math.random() * 0.35;
    sig[i] += (tgt[i] * jitter - sig[i]) * 0.3;
  }
}
/** Converte nível linear em posição de medidor (-60..+6 dBFS). */
export function levelToMeter(lin) {
  if (lin <= 0.000001) return 0;
  const db = 20 * Math.log10(lin);
  return clamp((db + 60) / 66, 0, 1);
}
export const dbLin = (db) => (db === -Infinity ? 0 : Math.pow(10, db / 20));

// ---------- diálogos ----------
export function dialog({ title, message, input, okText = 'OK', cancelText = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    const inp = input ? h('input', { class: 'txt', type: input.type || 'text', maxlength: input.maxlength || 32, value: input.value ?? '', placeholder: input.placeholder || '' }) : null;
    const err = h('div', { class: 'dlg-err' });
    const done = (v) => { d.close(); d.remove(); resolve(v); };
    const ok = () => {
      if (inp && input.validate) {
        const e = input.validate(inp.value);
        if (e) { err.textContent = e; return; }
      }
      done(inp ? inp.value : true);
    };
    const d = h('dialog', { class: 'dlg' },
      h('h3', null, title),
      message ? h('p', null, message) : null,
      inp, err,
      h('div', { class: 'dlg-b' },
        cancelText ? h('button', { class: 'btn', onclick: () => done(null) }, cancelText) : null,
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: ok }, okText)));
    d.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    inp?.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    document.body.append(d);
    d.showModal();
    inp?.focus();
    inp?.select();
  });
}

let toastTimer;
export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

export function download(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function pickJson() {
  return new Promise((resolve) => {
    const i = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    i.onchange = async () => {
      const f = i.files[0];
      i.remove();
      if (!f) return resolve(null);
      try { resolve(JSON.parse(await f.text())); } catch { toast('Arquivo inválido'); resolve(null); }
    };
    document.body.append(i);
    i.click();
  });
}
