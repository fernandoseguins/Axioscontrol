// Estado central do mixer AXIOS DUON 24.
// Todo valor é endereçado por um "path" com pontos, ex.: "ch.3.eq.bands.1.gain".
import { createTransport } from './transport.js';

export const CFG = { CH: 24, AUX: 8, FX: 2, DCA: 8, MG: 6, SCENES: 30, OUT: 12 };

export const COLORS = ['#e5484d', '#f76b15', '#ffc53d', '#46a758', '#12a594', '#0090ff', '#8e4ec6', '#d6409f', '#8b8d98'];

export const GEQ_FREQS = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000];

const P = (k, label, min, max, def, step = 1, unit = '', log = false) => ({ k, label, min, max, def, step, unit, log });
const REV = (time) => [P('time', 'Tempo', 0.2, 10, time, 0.1, 's'), P('pre', 'Pré-delay', 0, 200, 20, 1, 'ms'), P('tone', 'Tom', -10, 10, 0, 1), P('mix', 'Mix', 0, 100, 100, 1, '%')];
export const FX_TYPES = {
  'Reverb Hall': REV(2.6),
  'Reverb Plate': REV(1.8),
  'Reverb Room': REV(0.9),
  'Reverb Vocal 1': REV(1.4),
  'Reverb Vocal 2': REV(2.0),
  'Reverb Gate': [P('time', 'Tempo', 0.1, 1, 0.35, 0.01, 's'), P('thr', 'Threshold', -60, 0, -30, 1, 'dB'), P('mix', 'Mix', 0, 100, 100, 1, '%')],
  'Delay': [P('time', 'Tempo', 1, 2000, 350, 1, 'ms'), P('fb', 'Feedback', 0, 95, 35, 1, '%'), P('hicut', 'Corte agudo', 1000, 20000, 8000, 100, 'Hz', true), P('mix', 'Mix', 0, 100, 100, 1, '%')],
  'Tap Delay': [P('time', 'Tempo', 1, 2000, 500, 1, 'ms'), P('fb', 'Feedback', 0, 95, 30, 1, '%'), P('spread', 'Abertura', 0, 100, 50, 1, '%'), P('mix', 'Mix', 0, 100, 100, 1, '%')],
  'Echo Vocal': [P('time', 'Tempo', 1, 1000, 280, 1, 'ms'), P('rep', 'Repetições', 0, 95, 40, 1, '%'), P('mix', 'Mix', 0, 100, 100, 1, '%')],
  'Chorus': [P('rate', 'Velocidade', 0.1, 5, 0.8, 0.1, 'Hz'), P('depth', 'Profundidade', 0, 100, 50, 1, '%'), P('mix', 'Mix', 0, 100, 100, 1, '%')],
  'Flanger': [P('rate', 'Velocidade', 0.05, 5, 0.4, 0.05, 'Hz'), P('depth', 'Profundidade', 0, 100, 60, 1, '%'), P('fb', 'Feedback', 0, 95, 40, 1, '%'), P('mix', 'Mix', 0, 100, 100, 1, '%')],
  'Phaser': [P('rate', 'Velocidade', 0.05, 5, 0.5, 0.05, 'Hz'), P('depth', 'Profundidade', 0, 100, 60, 1, '%'), P('stages', 'Estágios', 2, 12, 6, 2), P('mix', 'Mix', 0, 100, 100, 1, '%')],
  'Tremolo': [P('rate', 'Velocidade', 0.5, 15, 5, 0.1, 'Hz'), P('depth', 'Profundidade', 0, 100, 50, 1, '%')],
  'Pitch Change': [P('semi', 'Semitons', -12, 12, 0, 1, 'st'), P('cent', 'Cents', -50, 50, 0, 1, 'ct'), P('mix', 'Mix', 0, 100, 100, 1, '%')],
  'Vocal Doubler': [P('detune', 'Desafinação', 0, 50, 10, 1, 'ct'), P('delay', 'Atraso', 5, 60, 20, 1, 'ms'), P('mix', 'Mix', 0, 100, 100, 1, '%')],
  'Distortion': [P('drive', 'Drive', 0, 100, 40, 1, '%'), P('tone', 'Tom', -10, 10, 0, 1), P('level', 'Nível', -20, 6, 0, 0.5, 'dB')],
};

export function fxDefaults(type) {
  const o = {};
  for (const p of FX_TYPES[type]) o[p.k] = p.def;
  return o;
}

const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const geq = () => ({ on: false, bands: rep(GEQ_FREQS.length, () => 0) });

export function defaults() {
  const fxTypes = ['Reverb Hall', 'Delay', 'Reverb Plate', 'Chorus'];
  return {
    v: 1,
    ch: rep(CFG.CH, (i) => ({
      name: `CH ${i + 1}`, color: COLORS[8], fader: 0.6, mute: false, solo: false, pan: 0, link: false,
      gain: 20, phantom: false, phase: false, hpf: { on: false, freq: 80 },
      gate: { on: false, thr: -50, att: 1, rel: 150 },
      comp: { on: false, thr: -20, ratio: 3, att: 10, rel: 120, gain: 0 },
      eq: {
        on: true, bands: [
          { type: 'lshelf', freq: 100, gain: 0, q: 0.7 },
          { type: 'peak', freq: 500, gain: 0, q: 1.4 },
          { type: 'peak', freq: 2500, gain: 0, q: 1.4 },
          { type: 'hshelf', freq: 8000, gain: 0, q: 0.7 },
        ],
      },
      sends: rep(CFG.AUX, () => ({ level: 0, pre: true })),
      fx: rep(CFG.FX, () => 0),
      dca: rep(CFG.DCA, () => false),
      mg: rep(CFG.MG, () => false),
    })),
    aux: rep(CFG.AUX, (i) => ({
      name: `AUX ${i + 1}`, color: COLORS[i % 8], fader: 0.75, mute: false, geq: geq(),
      mus: { show: rep(CFG.CH, () => true), master: true, fx: true },
    })),
    fx: rep(CFG.FX, (i) => ({ type: fxTypes[i], p: fxDefaults(fxTypes[i]), ret: 0.75, mute: false, aux: rep(CFG.AUX, () => 0) })),
    dca: rep(CFG.DCA, (i) => ({ name: `DCA ${i + 1}`, fader: 0.75, mute: false })),
    mg: rep(CFG.MG, (i) => ({ name: `MUTE ${i + 1}`, on: false })),
    main: { fader: 0.75, mute: false, geq: geq() },
    routing: {
      in: rep(CFG.CH, (i) => `IN ${i + 1}`),
      out: [...rep(CFG.OUT, (i) => (i < 2 ? ['MAIN L', 'MAIN R'][i] : `AUX ${i - 1}`)), 'MAIN L', 'MAIN R', 'MAIN L', 'MAIN R'],
    },
    gen: { on: false, type: 'pink', freq: 1000, level: -30, dest: 'main' },
    phones: { src: 'main', level: 0.6 },
    scenes: rep(CFG.SCENES, () => null),
    curScene: -1,
    sys: {
      name: 'DUON 24', mode: 'demo', host: '10.0.0.119', bridge: 'ws://192.168.1.100:8080',
      dhcp: true, ip: '192.168.1.100', mask: '255.255.255.0', gw: '192.168.1.1',
      ssid: 'AXIOS-DUON24', wifiPass: '', adminPass: '', sceneLock: false,
    },
  };
}

// Saídas físicas (12 XLR + fone + gravação USB)
export const OUT_NAMES = [...rep(CFG.OUT, (i) => `OUT ${i + 1}`), 'PHONES L', 'PHONES R', 'USB REC L', 'USB REC R'];
export const inSources = () => [...rep(CFG.CH, (i) => `IN ${i + 1}`), 'USB L', 'USB R', 'GERADOR', 'OFF'];
export const outSources = () => ['MAIN L', 'MAIN R', ...rep(CFG.AUX, (i) => `AUX ${i + 1}`), ...rep(CFG.FX, (i) => `FX ${i + 1}`), ...rep(CFG.CH, (i) => `DIRECT ${i + 1}`), 'OFF'];

// Partes do estado que uma cena guarda (sistema, gerador e cenas ficam de fora)
export const SCENE_KEYS = ['ch', 'aux', 'fx', 'dca', 'mg', 'main', 'routing'];

// ---------- armazenamento ----------
const KEY = 'duon24.state.v1';
let state = load();

function merge(def, src) {
  if (Array.isArray(def)) {
    if (!Array.isArray(src)) return def;
    return def.map((d, i) => (i < src.length ? merge(d, src[i]) : d));
  }
  if (def && typeof def === 'object') {
    if (!src || typeof src !== 'object') return def;
    const o = {};
    for (const k of Object.keys(def)) o[k] = k in src ? merge(def[k], src[k]) : def[k];
    // chaves dinâmicas (ex.: parâmetros de FX) são mantidas
    for (const k of Object.keys(src)) if (!(k in o)) o[k] = src[k];
    return o;
  }
  if (def === null) return src ?? null;
  return typeof src === typeof def ? src : def;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = defaults();
      const s = merge(d, JSON.parse(raw));
      s.fx.forEach((f) => { if (!FX_TYPES[f.type]) { f.type = 'Reverb Hall'; f.p = fxDefaults(f.type); } });
      return s;
    }
  } catch { /* armazenamento indisponível */ }
  return defaults();
}

let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, 250);
}

// ---------- leitura / escrita ----------
export function get(path) {
  if (!path) return state;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state);
}

function rawSet(path, value) {
  const ks = path.split('.');
  const last = ks.pop();
  const o = ks.reduce((o, k) => o[k], state);
  o[last] = value;
}

const listeners = new Set();
function emit(path, value) {
  for (const fn of listeners) {
    try { fn(path, value); } catch (e) { console.error(e); }
  }
}
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const NOLINK = new Set(['name', 'pan']);
export const partner = (i) => (i % 2 ? i - 1 : i + 1);

export function set(path, value, origin = 'local') {
  const cur = get(path);
  if (cur === value) return;
  if (cur && typeof cur === 'object' && JSON.stringify(cur) === JSON.stringify(value)) return;
  rawSet(path, value);
  persist();
  emit(path, value);
  if (origin === 'local') transport.send({ t: 'set', path, value });
  // link estéreo: espelha o par (1-2, 3-4, ...)
  const m = /^ch\.(\d+)\.(.+)$/.exec(path);
  if (origin === 'local' && m) {
    const i = +m[1];
    const key = m[2].split('.')[0];
    if ((key === 'link' || state.ch[i].link) && !NOLINK.has(key)) {
      set(`ch.${partner(i)}.${m[2]}`, structuredClone(value), 'local');
    }
  }
}

export function toggle(path) { set(path, !get(path)); }

// Substitui partes do estado (cena, importação, reset)
export function applyAll(partial, origin = 'local') {
  const d = defaults();
  for (const k of Object.keys(partial)) {
    if (k in d) state[k] = merge(d[k], structuredClone(partial[k]));
  }
  persist();
  emit('*');
  if (origin === 'local') transport.send({ t: 'all', state: partial });
}

export function snapshot(keys = SCENE_KEYS) {
  const o = {};
  for (const k of keys) o[k] = structuredClone(state[k]);
  return o;
}

export function factoryReset() {
  applyAll(defaults());
}

// ---------- escopo de observadores por tela ----------
let scope = [];
export function newScope() {
  scope.forEach((f) => f());
  scope = [];
}
export function onCleanup(fn) { scope.push(fn); }

/** Observa um path (ou qualquer coisa abaixo dele). Removido ao trocar de tela. */
export function watch(paths, fn) {
  const list = Array.isArray(paths) ? paths : [paths];
  const un = subscribe((p) => {
    if (p === '*') return;
    if (list.some((w) => p === w || p.startsWith(w + '.') || w.startsWith(p + '.'))) fn(p);
  });
  scope.push(un);
  return un;
}

// ---------- transporte (demo / ponte) ----------
function onRemote(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'set' && typeof msg.path === 'string') set(msg.path, msg.value, 'remote');
  else if (msg.t === 'all' && msg.state) applyAll(msg.state, 'remote');
}
export let transport = createTransport(state.sys, onRemote, { get, CFG });
export function reconnect() {
  transport.close?.();
  transport = createTransport(state.sys, onRemote, { get, CFG });
}

// ---------- utilidades de áudio ----------
import { posToDb, dbToPos, fmtDb } from './db.js';
export { posToDb, dbToPos, fmtDb };
export const fmtPos = (p) => fmtDb(posToDb(p));
export function fmtHz(f) {
  return f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 1 : 2).replace(/\.?0+$/, '') + 'k' : Math.round(f) + '';
}

export function groupMuted(i) {
  const c = state.ch[i];
  return c.mg.some((on, g) => on && state.mg[g].on) || c.dca.some((on, d) => on && state.dca[d].mute);
}
export function dcaDb(i) {
  const c = state.ch[i];
  let db = 0;
  c.dca.forEach((on, d) => { if (on) db += posToDb(state.dca[d].fader); });
  return db;
}
