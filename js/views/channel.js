import { get, set, watch, onCleanup, CFG, COLORS, GEQ_FREQS, partner } from '../state.js';
import { h, vslider, hslider, knob, tbtn, selectBox, textInput, card, meter, levelToMeter, toast } from '../ui.js';
import { chIn, chPost, auxOut, mainOut } from '../levels.js';
import { fmtPan } from './mixer.js';
import { drawEq, eqGeom } from '../eq.js';
import { chSpectrum } from '../spectrum.js';

const KINDS = [['ch', 'Canais'], ['aux', 'AUX'], ['dca', 'DCA'], ['main', 'MAIN']];
const COUNT = { ch: CFG.CH, aux: CFG.AUX, dca: CFG.DCA, main: 1 };

export function renderChannel(root, [kind = 'ch', idx = '0']) {
  if (!COUNT[kind]) kind = 'ch';
  let i = Math.min(Math.max(0, +idx || 0), COUNT[kind] - 1);
  const go = (k, n) => { location.hash = k === 'main' ? '#/canal/main' : `#/canal/${k}/${n}`; };

  const tabs = h('div', { class: 'seg' }, KINDS.map(([k, t]) =>
    h('button', { class: 'seg-b' + (k === kind ? ' on' : ''), onclick: () => go(k, 0) }, t)));

  let picker = null;
  if (kind !== 'main') {
    const sel = h('select', { class: 'sel big', onchange: () => go(kind, +sel.value) },
      Array.from({ length: COUNT[kind] }, (_, n) => h('option', { value: n, selected: n === i }, `${n + 1} · ${get(`${kind}.${n}.name`)}`)));
    picker = h('div', { class: 'picker' },
      h('button', { class: 'btn icon', 'aria-label': 'Anterior', onclick: () => go(kind, (i - 1 + COUNT[kind]) % COUNT[kind]) }, '‹'),
      sel,
      h('button', { class: 'btn icon', 'aria-label': 'Próximo', onclick: () => go(kind, (i + 1) % COUNT[kind]) }, '›'));
  }

  const body = h('div', { class: 'grid' });
  if (kind === 'ch') channelCards(body, i);
  else if (kind === 'aux') auxCards(body, i);
  else if (kind === 'dca') dcaCards(body, i);
  else mainCards(body);

  root.append(h('div', { class: 'page' }, h('div', { class: 'bar' }, tabs, picker), body));
}

function nameColor(p, maxlength = 12) {
  const sw = h('div', { class: 'swatches' }, COLORS.map((c) =>
    h('button', { class: 'sw', style: `--c:${c}`, 'aria-label': 'Cor ' + c, onclick: () => set(`${p}.color`, c) })));
  const draw = () => sw.querySelectorAll('.sw').forEach((b, n) => b.classList.toggle('on', COLORS[n] === get(`${p}.color`)));
  watch(`${p}.color`, draw);
  draw();
  return [h('label', { class: 'fld' }, h('span', null, 'Nome'), textInput(`${p}.name`, { maxlength })), sw];
}

function faderBlock(path, mfn, mutePath, extra) {
  return h('div', { class: 'fblock' },
    h('div', { class: 'st-fader' }, mfn ? meter(mfn) : null, vslider({ path, cls: 'fader' })),
    h('div', { class: 'fb-btns' }, extra, mutePath ? tbtn(mutePath, 'MUTE', 'mute') : null));
}

function channelCards(body, i) {
  const p = `ch.${i}`;
  const linkBtn = tbtn(`${p}.link`, `LINK ${Math.min(i, partner(i)) + 1}-${Math.max(i, partner(i)) + 1}`, 'sm');
  body.append(
    card('Entrada',
      ...nameColor(p),
      h('div', { class: 'row' },
        knob({ path: `${p}.gain`, label: 'Ganho', min: 0, max: 60, def: 20, step: 0.5, unit: 'dB' }),
        h('div', { class: 'col' },
          tbtn(`${p}.phantom`, '+48V', 'warn'),
          tbtn(`${p}.phase`, 'Ø FASE'),
          linkBtn),
        h('div', { class: 'col center' }, h('div', { class: 'k-l' }, 'Entrada'), meter(() => levelToMeter(chIn(i)), 'tall'))),
      h('div', { class: 'row' },
        tbtn(`${p}.hpf.on`, 'HPF'),
        knob({ path: `${p}.hpf.freq`, label: 'Corte', min: 20, max: 400, def: 80, step: 1, unit: 'Hz', log: true }),
        knob({ path: `${p}.pan`, label: 'Pan', min: -1, max: 1, def: 0, step: 0.02, fmt: fmtPan }))),

    eqCard(p),

    card('Gate',
      h('div', { class: 'row' },
        tbtn(`${p}.gate.on`, 'GATE'),
        knob({ path: `${p}.gate.thr`, label: 'Threshold', min: -80, max: 0, def: -50, step: 1, unit: 'dB', bipolar: false }),
        knob({ path: `${p}.gate.att`, label: 'Attack', min: 0.1, max: 50, def: 1, step: 0.1, unit: 'ms', log: true }),
        knob({ path: `${p}.gate.rel`, label: 'Release', min: 10, max: 2000, def: 150, step: 1, unit: 'ms', log: true }))),

    card('Compressor',
      h('div', { class: 'row' },
        tbtn(`${p}.comp.on`, 'COMP'),
        knob({ path: `${p}.comp.thr`, label: 'Threshold', min: -60, max: 0, def: -20, step: 0.5, unit: 'dB', bipolar: false }),
        knob({ path: `${p}.comp.ratio`, label: 'Ratio', min: 1, max: 20, def: 3, step: 0.1, fmt: (v) => v.toFixed(1) + ':1', log: true }),
        knob({ path: `${p}.comp.att`, label: 'Attack', min: 0.1, max: 200, def: 10, step: 0.1, unit: 'ms', log: true }),
        knob({ path: `${p}.comp.rel`, label: 'Release', min: 10, max: 2000, def: 120, step: 1, unit: 'ms', log: true }),
        knob({ path: `${p}.comp.gain`, label: 'Ganho', min: 0, max: 24, def: 0, step: 0.5, unit: 'dB' })),
      compCurve(p)),

    card('Envios AUX',
      h('div', { class: 'sends' }, Array.from({ length: CFG.AUX }, (_, a) =>
        h('div', { class: 'send-row' },
          h('span', { class: 'dot', style: `--c:${get(`aux.${a}.color`)}` }),
          h('span', { class: 'sr-name' }, get(`aux.${a}.name`)),
          hslider({ path: `${p}.sends.${a}.level`, color: get(`aux.${a}.color`) }),
          tbtn(`${p}.sends.${a}.pre`, 'PRE', 'sm pre', (b, on) => { b.textContent = on ? 'PRE' : 'POST'; }))))),

    card('Envios FX',
      h('div', { class: 'sends' }, Array.from({ length: CFG.FX }, (_, f) =>
        h('div', { class: 'send-row' },
          h('span', { class: 'dot', style: '--c:var(--fx)' }),
          h('span', { class: 'sr-name' }, `FX${f + 1} ${get(`fx.${f}.type`)}`),
          hslider({ path: `${p}.fx.${f}`, color: 'var(--fx)' }))))),

    card('Grupos',
      h('div', { class: 'k-l' }, 'DCA'),
      h('div', { class: 'btn-grid' }, Array.from({ length: CFG.DCA }, (_, d) => tbtn(`${p}.dca.${d}`, get(`dca.${d}.name`), 'sm dca'))),
      h('div', { class: 'k-l' }, 'Mute groups'),
      h('div', { class: 'btn-grid' }, Array.from({ length: CFG.MG }, (_, g) => tbtn(`${p}.mg.${g}`, get(`mg.${g}.name`), 'sm mute')))),

    card('Fader',
      faderBlock(`${p}.fader`, () => levelToMeter(chPost(i)), `${p}.mute`, tbtn(`${p}.solo`, 'SOLO', 'solo'))),
  );
}

const SPEC_KEY = 'duon24.eqSpec';
const specOn = () => { try { return localStorage.getItem(SPEC_KEY) !== '0'; } catch { return true; } };

function eqCard(p) {
  const i = +p.split('.')[1];
  const cv = h('canvas', { class: 'eq-cv' });
  let showSpec = specOn();
  let sel = -1, hover = -1;
  const draw = () => drawEq(cv, get(`${p}.eq`), get(`${p}.hpf`), showSpec ? chSpectrum(i) : null, { sel, hover });
  // Com o espectro ligado o gráfico anima (~30 fps); desligado, só redesenha quando o EQ muda.
  let raf = 0, last = 0;
  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    if (t - last < 33 || document.hidden || !cv.isConnected) return;
    last = t;
    draw();
  };
  const start = () => { cancelAnimationFrame(raf); if (showSpec) raf = requestAnimationFrame(loop); else requestAnimationFrame(draw); };
  watch([`${p}.eq`, `${p}.hpf`], () => { if (!showSpec) draw(); });
  start();
  onCleanup(() => cancelAnimationFrame(raf));
  const ro = new ResizeObserver(() => draw());
  ro.observe(cv);
  onCleanup(() => ro.disconnect());

  dragBands(cv, p, {
    setSel: (k) => { sel = k; bandEls.forEach((el, n) => el.classList.toggle('sel', n === k)); draw(); },
    setHover: (k) => { if (k !== hover) { hover = k; draw(); } },
  });

  const specBtn = h('button', { class: 'tb sm spec' + (showSpec ? ' on' : ''), 'aria-pressed': String(showSpec), onclick: () => {
    showSpec = !showSpec;
    try { localStorage.setItem(SPEC_KEY, showSpec ? '1' : '0'); } catch { /* ignore */ }
    specBtn.classList.toggle('on', showSpec);
    specBtn.setAttribute('aria-pressed', String(showSpec));
    start();
  } }, 'Espectro');
  const legend = h('div', { class: 'eq-legend' },
    h('span', { class: 'lg pre' }, 'Antes do EQ'), h('span', { class: 'lg post' }, 'Depois do EQ'), h('span', { class: 'lg curve' }, 'Curva do EQ'));

  const TYPES = [['lshelf', 'Low shelf'], ['peak', 'Peak'], ['hshelf', 'High shelf']];
  const bands = [0, 1, 2, 3].map((b) => {
    const bp = `${p}.eq.bands.${b}`;
    return h('div', { class: 'band' },
      h('div', { class: 'band-h' }, ['LOW', 'LO-MID', 'HI-MID', 'HIGH'][b]),
      selectBox(`${bp}.type`, b === 0 || b === 3 ? TYPES.filter((t) => t[0] === 'peak' || t[0] === (b === 0 ? 'lshelf' : 'hshelf')) : [['peak', 'Peak']], 'sm'),
      knob({ path: `${bp}.freq`, label: 'Freq', min: 20, max: 20000, def: [100, 500, 2500, 8000][b], step: 1, unit: 'Hz', log: true, cls: 'sm' }),
      knob({ path: `${bp}.gain`, label: 'Ganho', min: -15, max: 15, def: 0, step: 0.5, unit: 'dB', cls: 'sm' }),
      knob({ path: `${bp}.q`, label: 'Q', min: 0.3, max: 10, def: 1.4, step: 0.1, log: true, cls: 'sm' }));
  });
  const bandEls = bands;
  return card('Equalizador',
    h('div', { class: 'row' }, tbtn(`${p}.eq.on`, 'EQ'),
      h('button', { class: 'btn sm', onclick: () => [0, 1, 2, 3].forEach((b) => set(`${p}.eq.bands.${b}.gain`, 0)) }, 'Zerar'),
      specBtn),
    cv, legend,
    h('p', { class: 'hint' }, 'Arraste os pontos 1–4 no gráfico: para os lados muda a frequência, para cima/baixo o ganho. Pinça com dois dedos (ou roda do mouse) muda o Q. Toque duas vezes num ponto para zerar o ganho.'),
    h('div', { class: 'bands' }, bands));
}

/** Arrastar as bandas direto no gráfico do EQ (mouse e toque). */
function dragBands(cv, p, { setSel, setHover }) {
  const B = (k) => `${p}.eq.bands.${k}`;
  const geom = () => eqGeom(cv.clientWidth, cv.clientHeight);
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const hit = (x, y) => {
    const eq = get(`${p}.eq`);
    if (!eq.on) return -1;
    const G = geom();
    let best = -1, bd = 26;
    eq.bands.forEach((b, k) => {
      const d = Math.hypot(G.fx(b.freq) - x, G.fy(b.gain) - y);
      if (d < bd) { bd = d; best = k; }
    });
    return best;
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pts = new Map();
  let drag = null, lastTap = { k: -1, t: 0 };

  // Só bloqueia a rolagem da página quando o dedo começa em cima de um ponto (ou durante um arraste).
  cv.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    const r = cv.getBoundingClientRect();
    if (drag || hit(t.clientX - r.left, t.clientY - r.top) >= 0) e.preventDefault();
  }, { passive: false });

  cv.addEventListener('pointerdown', (e) => {
    const [x, y] = pos(e);
    pts.set(e.pointerId, [x, y]);
    if (drag) {
      // segundo dedo: pinça para o Q
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        drag.pinch = { d0: Math.max(10, Math.abs(a[0] - b[0])), q0: get(`${B(drag.k)}.q`) };
      }
      cv.setPointerCapture(e.pointerId);
      return;
    }
    const k = hit(x, y);
    if (k < 0) { pts.delete(e.pointerId); return; }
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    const G = geom();
    const b = get(B(k));
    drag = { k, id: e.pointerId, dx: G.fx(b.freq) - x, dy: G.fy(b.gain) - y, moved: false, x0: x, y0: y };
    cv.classList.add('grabbing');
    setSel(k);
  });

  cv.addEventListener('pointermove', (e) => {
    const [x, y] = pos(e);
    if (pts.has(e.pointerId)) pts.set(e.pointerId, [x, y]);
    if (!drag) {
      if (e.pointerType === 'mouse') { const k = hit(x, y); cv.style.cursor = k >= 0 ? 'grab' : ''; setHover(k); }
      return;
    }
    if (drag.pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.max(10, Math.abs(a[0] - b[0]));
      set(`${B(drag.k)}.q`, +clamp(drag.pinch.q0 * (drag.pinch.d0 / d), 0.3, 10).toFixed(1));
      drag.moved = true;
      return;
    }
    if (e.pointerId !== drag.id) return;
    if (Math.hypot(x - drag.x0, y - drag.y0) > 3) drag.moved = true;
    const G = geom();
    set(`${B(drag.k)}.freq`, Math.round(clamp(G.xf(x + drag.dx), 20, 20000)));
    set(`${B(drag.k)}.gain`, Math.round(clamp(G.yd(y + drag.dy), -15, 15) * 2) / 2);
  });

  const end = (e) => {
    pts.delete(e.pointerId);
    if (!drag) return;
    if (drag.pinch && pts.size < 2) drag.pinch = null;
    if (e.pointerId !== drag.id) return;
    if (!drag.moved && e.type === 'pointerup') {
      const now = performance.now();
      if (lastTap.k === drag.k && now - lastTap.t < 320) { set(`${B(drag.k)}.gain`, 0); lastTap = { k: -1, t: 0 }; } else lastTap = { k: drag.k, t: now };
    }
    drag = null;
    pts.clear();
    cv.classList.remove('grabbing');
    setSel(-1);
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !drag) { cv.style.cursor = ''; setHover(-1); } });

  // roda do mouse em cima de um ponto: muda o Q
  cv.addEventListener('wheel', (e) => {
    const k = drag ? drag.k : hit(...pos(e));
    if (k < 0) return;
    e.preventDefault();
    const q = get(`${B(k)}.q`);
    set(`${B(k)}.q`, +clamp(q * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.3, 10).toFixed(1));
  }, { passive: false });
}

function compCurve(p) {
  const cv = h('canvas', { class: 'comp-cv', width: 120, height: 120 });
  const draw = () => {
    const c = get(`${p}.comp`);
    const dpr = devicePixelRatio || 1;
    const W = 120, H = 120;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    g.strokeStyle = css.getPropertyValue('--line'); g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, W - 1, H - 1);
    g.setLineDash([3, 3]); g.beginPath(); g.moveTo(0, H); g.lineTo(W, 0); g.stroke(); g.setLineDash([]);
    g.strokeStyle = c.on ? css.getPropertyValue('--accent') : css.getPropertyValue('--muted'); g.lineWidth = 2;
    g.beginPath();
    for (let x = 0; x <= W; x++) {
      const inp = -60 + (x / W) * 60;
      let out = inp > c.thr ? c.thr + (inp - c.thr) / c.ratio : inp;
      out += c.gain;
      const y = H - ((out + 60) / 60) * H;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  };
  watch(`${p}.comp`, draw);
  requestAnimationFrame(draw);
  return h('div', { class: 'row' }, cv, h('p', { class: 'hint' }, 'Curva de transferência (entrada × saída, −60 a 0 dB).'));
}

function geqCard(p) {
  return card('EQ gráfico (15 bandas)',
    h('div', { class: 'row' }, tbtn(`${p}.geq.on`, 'GEQ'),
      h('button', { class: 'btn sm', onclick: () => GEQ_FREQS.forEach((_, b) => set(`${p}.geq.bands.${b}`, 0)) }, 'Zerar')),
    h('div', { class: 'geq' }, GEQ_FREQS.map((f, b) =>
      h('div', { class: 'geq-b' },
        vslider({ path: `${p}.geq.bands.${b}`, min: -15, max: 15, def: 0, step: 0.5, center: true, cls: 'mini', fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(1) }),
        h('div', { class: 'geq-f' }, f >= 1000 ? f / 1000 + 'k' : f)))));
}

function auxCards(body, a) {
  const p = `aux.${a}`;
  const showGrid = h('div', { class: 'btn-grid ch' }, Array.from({ length: CFG.CH }, (_, i) =>
    tbtn(`${p}.mus.show.${i}`, `${i + 1} ${get(`ch.${i}.name`)}`, 'sm')));
  const link = `${location.origin}${location.pathname}#/musico/${a}`;
  body.append(
    card('Mix de retorno', ...nameColor(p),
      h('p', { class: 'hint' }, 'Use os nomes dos músicos (ex.: "Baterista", "Vocal") para facilitar no Modo Músico.')),
    card('Master', faderBlock(`${p}.fader`, () => levelToMeter(auxOut(a)), `${p}.mute`)),
    geqCard(p),
    card('Modo Músico',
      h('p', { class: 'hint' }, 'Escolha o que o músico pode ver e ajustar neste mix.'),
      h('div', { class: 'row' }, tbtn(`${p}.mus.master`, 'Pode mudar o volume geral'), tbtn(`${p}.mus.fx`, 'Pode mudar os efeitos')),
      h('div', { class: 'k-l' }, 'Canais visíveis para o músico'),
      showGrid,
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', onclick: () => { for (let i = 0; i < CFG.CH; i++) set(`${p}.mus.show.${i}`, true); } }, 'Mostrar todos'),
        h('button', { class: 'btn sm', onclick: () => { for (let i = 0; i < CFG.CH; i++) set(`${p}.mus.show.${i}`, false); } }, 'Esconder todos')),
      h('div', { class: 'k-l' }, 'Link para o músico'),
      h('div', { class: 'row' }, h('code', { class: 'link' }, link),
        h('button', { class: 'btn sm', onclick: () => copy(link) }, 'Copiar'),
        h('a', { class: 'btn sm primary', href: `#/musico/${a}` }, 'Abrir'))),
  );
}

function dcaCards(body, d) {
  const p = `dca.${d}`;
  body.append(
    card('DCA', h('label', { class: 'fld' }, h('span', null, 'Nome'), textInput(`${p}.name`, { maxlength: 12 }))),
    card('Fader', faderBlock(`${p}.fader`, null, `${p}.mute`)),
    card('Canais neste DCA', h('div', { class: 'btn-grid ch' }, Array.from({ length: CFG.CH }, (_, i) =>
      tbtn(`ch.${i}.dca.${d}`, `${i + 1} ${get(`ch.${i}.name`)}`, 'sm dca')))),
  );
}

function mainCards(body) {
  body.append(
    card('MAIN L/R', h('div', { class: 'fblock' },
      h('div', { class: 'st-fader' }, meter(() => levelToMeter(mainOut(0))), meter(() => levelToMeter(mainOut(1))), vslider({ path: 'main.fader', cls: 'fader' })),
      h('div', { class: 'fb-btns' }, tbtn('main.mute', 'MUTE', 'mute')))),
    geqCard('main'),
    card('Nomes dos mute groups', h('div', { class: 'form' }, Array.from({ length: CFG.MG }, (_, g) =>
      h('label', { class: 'fld' }, h('span', null, `Grupo ${g + 1}`), textInput(`mg.${g}.name`, { maxlength: 10 }))))),
  );
}

export async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Link copiado'); } catch { toast('Não foi possível copiar'); }
}
