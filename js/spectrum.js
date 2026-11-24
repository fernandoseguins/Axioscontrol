// Espectro de cada canal (analisador atrás da curva do EQ).
// No modo demo é simulado: cada canal ganha um "timbre" pelo nome (bumbo, baixo, voz…)
// e o nível acompanha o sinal de entrada. Com o mixer real, basta trocar chSpectrum()
// pelos dados de FFT que o mixer enviar.
import { get } from './state.js';
import { chIn } from './levels.js';

export const SPEC_N = 160;
export const SPEC_F = Float64Array.from({ length: SPEC_N }, (_, i) => 20 * Math.pow(1000, i / (SPEC_N - 1)));

// [frequência central, nível dB, largura em oitavas]
const PROFILES = {
  kick: [[60, 0, 0.7], [120, -6, 0.8], [700, -20, 1.8], [3500, -18, 1.2]],
  bass: [[80, 0, 1], [250, -6, 1], [900, -16, 1.4]],
  snare: [[200, -2, 0.7], [900, -8, 1.4], [5000, -10, 1.6]],
  tom: [[110, 0, 0.8], [300, -8, 1], [4000, -22, 1.4]],
  hat: [[500, -22, 1.4], [6000, -2, 1.4], [11000, 0, 1]],
  voice: [[220, -4, 0.8], [1100, 0, 1.2], [3200, -5, 0.9], [9000, -20, 1.2]],
  guitar: [[130, -8, 0.8], [500, 0, 1.4], [2500, -6, 1.2], [8000, -22, 1.2]],
  keys: [[180, -3, 1.2], [1200, -4, 1.8], [6000, -16, 1.4]],
};
const BY_NAME = [
  [/bumbo|kick|\bbd\b/i, 'kick'], [/baixo|bass|\bbx\b/i, 'bass'], [/caixa|snare|\bsn\b/i, 'snare'],
  [/\btom|surdo|floor/i, 'tom'], [/hat|chimbal|over|\boh\b|prato|cymbal/i, 'hat'],
  [/voz|vocal|vox|back|pastor|\bmc\b|\bmic/i, 'voice'], [/viol|guit|gtr/i, 'guitar'],
  [/tecl|key|piano|synth|org|sax|metal/i, 'keys'],
];
const BY_INDEX = ['kick', 'snare', 'hat', 'tom', 'bass', 'guitar', 'keys', 'voice'];

function shape(bumps) {
  return Float32Array.from(SPEC_F, (f) => {
    let s = Math.pow(10, -75 / 10);
    for (const [fc, db, w] of bumps) {
      const d = Math.log2(f / fc) / w;
      s += Math.pow(10, (db - 12 * d * d) / 10);
    }
    return 10 * Math.log10(s);
  });
}
const cache = {};
const profileShape = (k) => (cache[k] ??= shape(PROFILES[k]));

function profileFor(i) {
  const name = get(`ch.${i}.name`) || '';
  for (const [re, k] of BY_NAME) if (re.test(name)) return k;
  return BY_INDEX[i % BY_INDEX.length];
}

function genShape(g) {
  if (g.type === 'sine') return shape([[g.freq, 0, 0.06]]);
  if (g.type === 'white') return Float32Array.from(SPEC_F, (f) => -9 + 3 * Math.log2(f / 1000));
  return Float32Array.from(SPEC_F, () => -6);
}

const state = new Map();

/** Espectro de entrada (pré-EQ) do canal i em dBFS, nos pontos SPEC_F. */
export function chSpectrum(i) {
  let a = state.get(i);
  if (!a) { a = new Float32Array(SPEC_N).fill(-120); state.set(i, a); }
  const g = get('gen');
  const base = get(`routing.in.${i}`) === 'GERADOR' ? genShape(g) : profileShape(profileFor(i));
  const lin = chIn(i);
  const lvl = lin > 1e-6 ? 20 * Math.log10(lin) : -140;
  const t = performance.now() / 1000;
  const breathe = (k) => 2.5 * Math.sin(t * 1.7 + k * 0.11 + i) + 1.5 * Math.sin(t * 3.1 - k * 0.07);
  for (let k = 0; k < SPEC_N; k++) {
    const floor = -88 + Math.random() * 4;
    const target = Math.max(floor, base[k] + lvl + breathe(k) + (Math.random() - 0.5) * 5);
    // sobe rápido, desce devagar (como um analisador de verdade)
    a[k] += (target - a[k]) * (target > a[k] ? 0.55 : 0.12);
  }
  return a;
}
