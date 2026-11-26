// Conversões de fader (posição 0–1 ↔ dB). Sem dependências, para evitar import circular.
const FPTS = [[0, -90], [0.0625, -60], [0.25, -30], [0.5, -10], [0.75, 0], [1, 10]];
export function posToDb(p) {
  if (p <= 0.002) return -Infinity;
  for (let i = 1; i < FPTS.length; i++) {
    const [x1, y1] = FPTS[i];
    if (p <= x1) {
      const [x0, y0] = FPTS[i - 1];
      return y0 + ((p - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 10;
}
export function dbToPos(db) {
  if (db === -Infinity || db <= -90) return 0;
  for (let i = 1; i < FPTS.length; i++) {
    const [x1, y1] = FPTS[i];
    if (db <= y1) {
      const [x0, y0] = FPTS[i - 1];
      return x0 + ((db - y0) / (y1 - y0)) * (x1 - x0);
    }
  }
  return 1;
}
export function fmtDb(db) {
  if (db === -Infinity) return '-∞';
  const r = Math.round(db * 10) / 10;
  return (r > 0 ? '+' : '') + r.toFixed(1);
}
