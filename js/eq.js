// Gráfico do EQ: espectro do canal (pré e pós-EQ) + curva de resposta (filtros biquad RBJ).
import { SPEC_F, SPEC_N } from './spectrum.js';

const FS = 48000;

function coefs(type, f0, gain, Q) {
  const A = Math.pow(10, gain / 40);
  const w0 = (2 * Math.PI * f0) / FS;
  const cs = Math.cos(w0), sn = Math.sin(w0);
  const al = sn / (2 * Q);
  const sA = 2 * Math.sqrt(A) * al;
  switch (type) {
    case 'lshelf': return [A * ((A + 1) - (A - 1) * cs + sA), 2 * A * ((A - 1) - (A + 1) * cs), A * ((A + 1) - (A - 1) * cs - sA), (A + 1) + (A - 1) * cs + sA, -2 * ((A - 1) + (A + 1) * cs), (A + 1) + (A - 1) * cs - sA];
    case 'hshelf': return [A * ((A + 1) + (A - 1) * cs + sA), -2 * A * ((A - 1) + (A + 1) * cs), A * ((A + 1) + (A - 1) * cs - sA), (A + 1) - (A - 1) * cs + sA, 2 * ((A - 1) - (A + 1) * cs), (A + 1) - (A - 1) * cs - sA];
    case 'hpf': return [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2, 1 + al, -2 * cs, 1 - al];
    default: return [1 + al * A, -2 * cs, 1 - al * A, 1 + al / A, -2 * cs, 1 - al / A];
  }
}

function magDb([b0, b1, b2, a0, a1, a2], f) {
  const w = (2 * Math.PI * f) / FS;
  const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2);
  const dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
}

export function eqResponse(eq, hpf, freqs) {
  const filters = [];
  if (eq.on) for (const b of eq.bands) if (b.gain !== 0) filters.push(coefs(b.type, b.freq, b.gain, b.q));
  if (hpf?.on) filters.push(coefs('hpf', hpf.freq, 0, 0.707));
  return Float32Array.from(freqs, (f) => filters.reduce((s, c) => s + magDb(c, f), 0));
}

let memo = { key: '', resp: null };
function response(eq, hpf) {
  const key = JSON.stringify([eq, hpf]);
  if (key !== memo.key) memo = { key, resp: eqResponse(eq, hpf, SPEC_F) };
  return memo.resp;
}

const SPEC_MIN = -90; // faixa do analisador: -90..0 dBFS (escala própria, à direita)
const R = 18; // faixa da curva do EQ: ±18 dB

/** Desenha o gráfico. spec = espectro de entrada (dBFS) ou null para só a curva. */
export function drawEq(cv, eq, hpf, spec) {
  const dpr = devicePixelRatio || 1;
  const W = cv.clientWidth || 300, H = cv.clientHeight || 200;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement);
  const v = (n) => css.getPropertyValue(n).trim();
  const line = v('--line'), muted = v('--muted'), acc = v('--accent'), specC = v('--spec');
  const fx = (f) => (Math.log10(f / 20) / 3) * W;
  const fy = (db) => H / 2 - (db / R) * (H / 2 - 8);
  const sy = (db) => H - ((Math.max(SPEC_MIN, Math.min(0, db)) - SPEC_MIN) / -SPEC_MIN) * (H - 4);
  const resp = response(eq, hpf);
  const active = eq.on || hpf?.on;

  // grade
  g.strokeStyle = line; g.lineWidth = 1; g.fillStyle = muted; g.font = '10px system-ui';
  for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
    const x = Math.round(fx(f)) + 0.5;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    g.fillText(f >= 1000 ? f / 1000 + 'k' : f, x + 3, H - 4);
  }
  for (const db of [-12, -6, 0, 6, 12]) {
    const y = Math.round(fy(db)) + 0.5;
    g.globalAlpha = db === 0 ? 0.9 : 0.45;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    g.globalAlpha = 1;
    if (db) g.fillText((db > 0 ? '+' : '') + db, 3, y - 3);
  }

  if (spec) {
    const path = (vals) => {
      const p = new Path2D();
      p.moveTo(0, H);
      for (let k = 0; k < SPEC_N; k++) p.lineTo(fx(SPEC_F[k]), sy(vals(k)));
      p.lineTo(W, H);
      p.closePath();
      return p;
    };
    const stroke = (vals) => {
      const p = new Path2D();
      for (let k = 0; k < SPEC_N; k++) k ? p.lineTo(fx(SPEC_F[k]), sy(vals(k))) : p.moveTo(0, sy(vals(0)));
      return p;
    };
    // pré-EQ: silhueta cinza
    const pre = (k) => spec[k];
    if (active) {
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fill(path(pre));
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1;
      g.stroke(stroke(pre));
    }
    // pós-EQ: preenchimento com degradê
    const post = active ? (k) => spec[k] + resp[k] : pre;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, hexA(specC, 0.55));
    grad.addColorStop(0.6, hexA(specC, 0.18));
    grad.addColorStop(1, hexA(specC, 0.02));
    g.fillStyle = grad;
    g.fill(path(post));
    g.strokeStyle = hexA(specC, 0.9); g.lineWidth = 1.25;
    g.stroke(stroke(post));
  }

  // curva do EQ
  const N = Math.max(80, Math.floor(W / 2));
  const freqs = Array.from({ length: N + 1 }, (_, i) => 20 * Math.pow(1000, i / N));
  const curve = eqResponse(eq, hpf, freqs);
  const c = new Path2D();
  curve.forEach((db, i) => { const x = fx(freqs[i]), y = fy(Math.max(-R, Math.min(R, db))); i ? c.lineTo(x, y) : c.moveTo(x, y); });
  if (active) {
    const fill = new Path2D(c);
    fill.lineTo(W, fy(0)); fill.lineTo(0, fy(0)); fill.closePath();
    g.globalAlpha = 0.14; g.fillStyle = acc; g.fill(fill); g.globalAlpha = 1;
  }
  g.strokeStyle = active ? acc : muted; g.lineWidth = 2.25;
  g.shadowColor = active ? hexA(acc, 0.6) : 'transparent'; g.shadowBlur = active ? 6 : 0;
  g.stroke(c);
  g.shadowBlur = 0;
  if (eq.on) eq.bands.forEach((b, i) => {
    const x = fx(b.freq), y = fy(Math.max(-R, Math.min(R, b.gain)));
    g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2);
    g.fillStyle = acc; g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#1a0f00'; g.font = 'bold 9px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(i + 1, x, y + 0.5);
    g.textAlign = 'start'; g.textBaseline = 'alphabetic';
  });
}

function hexA(color, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
