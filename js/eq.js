// Resposta de frequência do EQ (filtros biquad RBJ) desenhada em canvas.
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
  return freqs.map((f) => filters.reduce((s, c) => s + magDb(c, f), 0));
}

export function eqCurve(cv, eq, hpf) {
  const dpr = devicePixelRatio || 1;
  const W = cv.clientWidth || 300, H = cv.clientHeight || 160;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const line = css.getPropertyValue('--line').trim(), muted = css.getPropertyValue('--muted').trim(), acc = css.getPropertyValue('--accent').trim();
  const fx = (f) => (Math.log10(f / 20) / 3) * W;
  const R = 18;
  const fy = (db) => H / 2 - (db / R) * (H / 2 - 6);
  g.strokeStyle = line; g.lineWidth = 1; g.fillStyle = muted; g.font = '10px system-ui';
  for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
    const x = Math.round(fx(f)) + 0.5;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    g.fillText(f >= 1000 ? f / 1000 + 'k' : f, x + 2, H - 3);
  }
  for (const db of [-12, -6, 0, 6, 12]) {
    const y = Math.round(fy(db)) + 0.5;
    g.globalAlpha = db === 0 ? 1 : 0.6;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    g.globalAlpha = 1;
    if (db) g.fillText((db > 0 ? '+' : '') + db, 2, y - 2);
  }
  const N = Math.max(60, Math.floor(W / 2));
  const freqs = Array.from({ length: N + 1 }, (_, i) => 20 * Math.pow(1000, i / N));
  const resp = eqResponse(eq, hpf, freqs);
  g.beginPath();
  resp.forEach((db, i) => { const x = fx(freqs[i]), y = fy(Math.max(-R, Math.min(R, db))); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.strokeStyle = eq.on || hpf?.on ? acc : muted; g.lineWidth = 2; g.stroke();
  g.lineTo(W, fy(0)); g.lineTo(0, fy(0)); g.closePath();
  g.globalAlpha = 0.15; g.fillStyle = acc; g.fill(); g.globalAlpha = 1;
  if (eq.on) eq.bands.forEach((b, i) => {
    g.beginPath(); g.arc(fx(b.freq), fy(Math.max(-R, Math.min(R, b.gain))), 5, 0, Math.PI * 2);
    g.fillStyle = acc; g.fill();
    g.fillStyle = '#000'; g.font = 'bold 8px system-ui'; g.fillText(i + 1, fx(b.freq) - 2.5, fy(Math.max(-R, Math.min(R, b.gain))) + 3);
  });
}
