// Níveis simulados para os medidores no modo demo.
import { get, posToDb, groupMuted, dcaDb, CFG } from './state.js';
import { sig, dbLin } from './ui.js';
import { liveMeters } from './transport.js';
import { meterLin } from './axios-protocol.js';

function srcSignal(i) {
  const s = get(`routing.in.${i}`);
  const m = /^IN (\d+)$/.exec(s);
  if (m) return sig[+m[1] - 1];
  if (s === 'USB L') return sig[40];
  if (s === 'USB R') return sig[41];
  if (s === 'GERADOR') return get('gen.on') ? dbLin(get('gen.level')) : 0;
  return 0;
}
export const chIn = (i) => (liveMeters.on ? meterLin(liveMeters.ch[i]) : srcSignal(i) * dbLin(get(`ch.${i}.gain`) - 30));
export function chPost(i) {
  const c = get(`ch.${i}`);
  if (liveMeters.on) return c.mute ? 0 : meterLin(liveMeters.ch[i]) * dbLin(posToDb(c.fader));
  if (c.mute || groupMuted(i)) return 0;
  return chIn(i) * dbLin(posToDb(c.fader) + dcaDb(i));
}
export function chSend(i, a) {
  const s = get(`ch.${i}.sends.${a}`);
  const base = s.pre ? (get(`ch.${i}.mute`) || groupMuted(i) ? 0 : chIn(i)) : chPost(i);
  return base * dbLin(posToDb(s.level));
}
function fxIn(f) {
  let sum = 0;
  for (let i = 0; i < CFG.CH; i++) sum += (chPost(i) * dbLin(posToDb(get(`ch.${i}.fx.${f}`)))) ** 2;
  return Math.sqrt(sum) * 0.7;
}
export function fxRet(f) {
  if (liveMeters.on) return meterLin(liveMeters.bus[8 + f]);
  const x = get(`fx.${f}`);
  return x.mute ? 0 : fxIn(f) * dbLin(posToDb(x.ret));
}
export function fxSend(f, a) {
  const x = get(`fx.${f}`);
  return x.mute ? 0 : fxIn(f) * dbLin(posToDb(x.aux[a]));
}
export function auxOut(a) {
  if (liveMeters.on) return meterLin(liveMeters.bus[a]);
  const x = get(`aux.${a}`);
  if (x.mute) return 0;
  let sum = 0;
  for (let i = 0; i < CFG.CH; i++) sum += chSend(i, a) ** 2;
  for (let f = 0; f < CFG.FX; f++) sum += fxSend(f, a) ** 2;
  let g = 0;
  if (get('gen.on') && get('gen.dest') === `aux${a}`) g = dbLin(get('gen.level'));
  return (Math.sqrt(sum) * 0.6 + g) * dbLin(posToDb(x.fader));
}
export function mainOut(side = 0) {
  if (liveMeters.on) return meterLin(liveMeters.bus[12 + side]);
  const m = get('main');
  if (m.mute) return 0;
  let sum = 0;
  for (let i = 0; i < CFG.CH; i++) {
    const pan = get(`ch.${i}.pan`);
    const w = side === 0 ? Math.min(1, 1 - pan) : Math.min(1, 1 + pan);
    sum += (chPost(i) * w) ** 2;
  }
  for (let f = 0; f < CFG.FX; f++) sum += fxRet(f) ** 2;
  let g = 0;
  if (get('gen.on') && get('gen.dest') === 'main') g = dbLin(get('gen.level'));
  return (Math.sqrt(sum) * 0.6 + g) * dbLin(posToDb(m.fader));
}
