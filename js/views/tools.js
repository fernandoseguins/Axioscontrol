import { get, watch, onCleanup, CFG } from '../state.js';
import { h, knob, tbtn, selectBox, card, hslider, toast, sig } from '../ui.js';

const RTA_F = [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000];

export function renderTools(root) {
  const dests = [['main', 'MAIN L/R'], ...Array.from({ length: CFG.AUX }, (_, a) => [`aux${a}`, get(`aux.${a}.name`)])];
  const genWarn = h('div', { class: 'warnbox' }, '⚠ Gerador ligado — cuidado com o volume nas caixas.');
  const drawWarn = () => genWarn.hidden = !get('gen.on');
  watch('gen.on', drawWarn);
  drawWarn();

  root.append(h('div', { class: 'page' },
    h('div', { class: 'bar' }, h('h2', null, 'Ferramentas')),
    h('div', { class: 'grid two' },
      card('Gerador de sinal',
        h('div', { class: 'row' }, tbtn('gen.on', 'LIGAR', 'warn'),
          selectBox('gen.type', [['sine', 'Senoide'], ['pink', 'Ruído rosa'], ['white', 'Ruído branco']]),
          selectBox('gen.dest', dests)),
        h('div', { class: 'row' },
          knob({ path: 'gen.freq', label: 'Frequência', min: 20, max: 20000, def: 1000, step: 1, unit: 'Hz', log: true }),
          knob({ path: 'gen.level', label: 'Nível', min: -60, max: 0, def: -30, step: 0.5, unit: 'dB', bipolar: false })),
        genWarn),
      card('Monitor de fone (PHONES)',
        h('div', { class: 'row' }, h('span', { class: 'k-l' }, 'Fonte'),
          selectBox('phones.src', [['main', 'MAIN L/R'], ['solo', 'SOLO'], ...Array.from({ length: CFG.AUX }, (_, a) => [`aux${a}`, get(`aux.${a}.name`)])])),
        h('div', { class: 'send-row' }, h('span', { class: 'sr-name' }, 'Volume'), hslider({ path: 'phones.level' })))),
    rtaCard()));
}

function rtaCard() {
  const cv = h('canvas', { class: 'rta-cv' });
  const srcSel = h('select', { class: 'sel' },
    h('option', { value: 'sim' }, 'Saída MAIN (simulada)'),
    h('option', { value: 'mic' }, 'Microfone deste aparelho'));
  const hold = h('button', { class: 'tb sm', onclick: () => { hold.classList.toggle('on'); peaks.fill(0); } }, 'Pico');
  const note = h('p', { class: 'hint' }, 'Use o microfone do celular/tablet no ponto de escuta para ver o espectro real do som da sala.');
  const bands = new Float32Array(RTA_F.length);
  const peaks = new Float32Array(RTA_F.length);
  let ac = null, an = null, stream = null, buf = null;

  async function startMic() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      ac = new (window.AudioContext || window.webkitAudioContext)();
      an = ac.createAnalyser();
      an.fftSize = 8192;
      an.smoothingTimeConstant = 0.6;
      ac.createMediaStreamSource(stream).connect(an);
      buf = new Float32Array(an.frequencyBinCount);
    } catch {
      toast('Sem acesso ao microfone');
      srcSel.value = 'sim';
    }
  }
  function stopMic() {
    stream?.getTracks().forEach((t) => t.stop());
    ac?.close();
    ac = an = stream = null;
  }
  srcSel.onchange = () => (srcSel.value === 'mic' ? startMic() : stopMic());
  onCleanup(stopMic);

  function compute() {
    if (an) {
      an.getFloatFrequencyData(buf);
      const binHz = ac.sampleRate / an.fftSize;
      RTA_F.forEach((f, i) => {
        const lo = f / Math.pow(2, 1 / 6), hi = f * Math.pow(2, 1 / 6);
        let sum = 0, n = 0;
        for (let b = Math.max(1, Math.floor(lo / binHz)); b <= Math.ceil(hi / binHz) && b < buf.length; b++) { sum += Math.pow(10, buf[b] / 10); n++; }
        const db = n ? 10 * Math.log10(sum) : -100;
        bands[i] = Math.max(0, Math.min(1, (db + 90) / 80));
      });
      return;
    }
    // Simulação: música + gerador
    const g = get('gen');
    const genOn = g.on && g.dest === 'main' && !get('main.mute');
    const music = (sig[0] + sig[1] + sig[2] + sig[3]) / 4;
    RTA_F.forEach((f, i) => {
      let v = music * (0.75 - Math.abs(Math.log10(f / 250)) * 0.22) + Math.random() * 0.05;
      if (genOn) {
        const lvl = (g.level + 70) / 70;
        if (g.type === 'pink') v = Math.max(v, lvl * (0.85 + Math.random() * 0.08));
        else if (g.type === 'white') v = Math.max(v, lvl * (0.45 + (i / RTA_F.length) * 0.5 + Math.random() * 0.06));
        else { const d = Math.abs(Math.log2(f / g.freq)); v = Math.max(v, lvl * Math.max(0, 1 - d * 2.2)); }
      }
      bands[i] = bands[i] * 0.5 + Math.max(0, Math.min(1, v)) * 0.5;
    });
  }

  function draw() {
    const dpr = devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W) return;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    const line = css.getPropertyValue('--line').trim(), acc = css.getPropertyValue('--accent').trim(), muted = css.getPropertyValue('--muted').trim(), text = css.getPropertyValue('--text').trim();
    const bh = H - 16;
    g.strokeStyle = line;
    for (let k = 1; k < 4; k++) { const y = Math.round((bh * k) / 4) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const bw = W / RTA_F.length;
    g.font = '9px system-ui';
    RTA_F.forEach((f, i) => {
      const v = bands[i];
      if (hold.classList.contains('on')) peaks[i] = Math.max(peaks[i], v);
      g.fillStyle = acc;
      g.fillRect(i * bw + 1, bh - v * bh, bw - 2, v * bh);
      if (peaks[i]) { g.fillStyle = text; g.fillRect(i * bw + 1, bh - peaks[i] * bh - 2, bw - 2, 2); }
      if (i % 3 === 0) { g.fillStyle = muted; g.fillText(f >= 1000 ? f / 1000 + 'k' : f, i * bw + 1, H - 3); }
    });
  }
  let raf, last = 0;
  const loop = (t) => { raf = requestAnimationFrame(loop); if (t - last < 50) return; last = t; compute(); draw(); };
  raf = requestAnimationFrame(loop);
  onCleanup(() => cancelAnimationFrame(raf));

  return card('RTA — analisador de espectro (1/3 de oitava)', h('div', { class: 'row' }, srcSel, hold), cv, note);
}
