// Protocolo da mesa AXIOS (DUON 24 / "AXIOS24E"), decifrado a partir da página de controle
// que a própria mesa serve (http://IP-DA-MESA/) e do WebSocket que ela usa (porta 8088).
//
// Quadro: 0x80 | LEN | CMD | dados… | CRC16 (alto, baixo)
//   LEN = bytes depois dele (CMD + dados + CRC). CRC-16/MODBUS sobre todo o quadro, menos o CRC.
// Comandos conhecidos:
//   0x00 info do aparelho (resposta traz o nome, ex.: "AXIOS24E")
//   0x03 gravar parâmetro: ID(2) VALOR(2)          → a mesa devolve o mesmo quadro
//   0x06 ler parâmetros:   ID(2) ID(2) …            → resposta: ID(2) VALOR(2) …
//   0x2E nome:             ÍNDICE(1)                → resposta: ÍNDICE + texto ASCII
//   0x04 nome de cena:     NÚMERO(1)                → resposta: NÚMERO + texto
//   0x39 texto chave=valor (DEVNAME=, FW_VER=, …)
import { posToDb, dbToPos } from './db.js';

export const PORT = 8088;
export const CMD = { INFO: 0x00, SET: 0x03, SCENE_NAME: 0x04, READ: 0x06, NAME: 0x2e, TEXT: 0x39 };

export function crc16(b, n = b.length) {
  let c = 0xffff;
  for (let i = 0; i < n; i++) {
    c ^= b[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xa001 : c >>> 1;
  }
  return c;
}

export function frame(cmd, payload = []) {
  const b = new Uint8Array(payload.length + 5);
  b[0] = 0x80;
  b[1] = payload.length + 3;
  b[2] = cmd;
  b.set(payload, 3);
  const c = crc16(b, b.length - 2);
  b[b.length - 2] = c >> 8;
  b[b.length - 1] = c & 0xff;
  return b;
}

/** Separa um ou mais quadros de uma mensagem. Ignora quadros com CRC errado. */
export function parse(buf) {
  const b = new Uint8Array(buf);
  const out = [];
  let i = 0;
  while (i + 5 <= b.length) {
    if (b[i] !== 0x80) { i++; continue; }
    const end = i + 2 + b[i + 1];
    if (end > b.length) break;
    const f = b.subarray(i, end);
    const c = crc16(f, f.length - 2);
    if (f[f.length - 2] === c >> 8 && f[f.length - 1] === (c & 0xff)) out.push({ cmd: f[2], p: f.subarray(3, f.length - 2) });
    i = end;
  }
  return out;
}

export const u16 = (v) => [(v >> 8) & 0xff, v & 0xff];
export const setFrame = (id, v) => frame(CMD.SET, [...u16(id), ...u16(v)]);
export const readFrame = (ids) => frame(CMD.READ, ids.flatMap(u16));

// ---------- mapa de parâmetros ----------
export const CH_BASE = 0x42;
export const CH_STRIDE = 0x3e; // 62 parâmetros por canal
export const CH_COUNT = 26; // 24 canais + 2 entradas extras
export const OFF = { gain: 0x06, mute: 0x08, fader: 0x0a, send: 0x0b, fx: 0x13 };
export const chId = (i, off) => CH_BASE + i * CH_STRIDE + off;
// Masters dos barramentos: 0–7 = mixes de retorno (AUX 1–8), 8 = provavelmente MAIN. A confirmar.
export const busMasterId = (k) => 0x06f9 + k * 0x6d;
// Índices dos nomes (comando 0x2E)
export const NAME_IDX = { ch: 0, fx: 26, aux: 28 };
// Medidores: 1 byte por sinal, 2 por parâmetro
export const METER_CH_IDS = Array.from({ length: 13 }, (_, i) => 0x02 + i); // 26 canais
export const METER_BUS_IDS = Array.from({ length: 7 }, (_, i) => 0x29 + i); // 14 saídas

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const rawToDb = (r) => (r <= 0 ? -Infinity : r / 10 - 120);
export const dbToRaw = (db) => (db === -Infinity ? 0 : clamp(Math.round((db + 120) * 10), 0, 1300));

const level = { to: (v, cur) => (cur & 0x8000) | dbToRaw(posToDb(v)), from: (r) => dbToPos(rawToDb(r & 0x7fff)) };
const bool = { to: (v) => (v ? 1 : 0), from: (r) => r !== 0 };
const gainC = { to: (v) => clamp(Math.round(v), 0, 48), from: (r) => clamp(r, 0, 48) };

/** Liga os paths do app aos IDs da mesa. `exp` = ainda não confirmado na mesa. */
export function buildMap(nCh, nAux, nFx) {
  const m = [];
  for (let i = 0; i < nCh; i++) {
    m.push({ path: `ch.${i}.fader`, id: chId(i, OFF.fader), ...level });
    m.push({ path: `ch.${i}.mute`, id: chId(i, OFF.mute), ...bool });
    m.push({ path: `ch.${i}.gain`, id: chId(i, OFF.gain), ...gainC });
    for (let a = 0; a < Math.min(nAux, 8); a++) m.push({ path: `ch.${i}.sends.${a}.level`, id: chId(i, OFF.send + a), ...level });
    for (let f = 0; f < Math.min(nFx, 2); f++) m.push({ path: `ch.${i}.fx.${f}`, id: chId(i, OFF.fx + f), ...level, exp: true });
  }
  for (let a = 0; a < Math.min(nAux, 8); a++) m.push({ path: `aux.${a}.fader`, id: busMasterId(a), ...level, exp: true });
  m.push({ path: 'main.fader', id: busMasterId(8), ...level, exp: true });
  return m;
}

/** Byte do medidor → nível linear (estimativa: 1 unidade = 1 dB, 0xFF = 0 dBFS). */
export const meterLin = (b) => (b <= 0xb5 ? 0 : Math.pow(10, (b - 0xff) / 20));
