import { get, set, watch, CFG, groupMuted } from '../state.js';
import { h, vslider, knob, tbtn, meter, levelToMeter, linkNote } from '../ui.js';
import { rerender } from '../nav.js';
import { chPost, chSend, fxRet, fxSend, auxOut, mainOut } from '../levels.js';

const ui = (() => {
  try { return { layer: 'ch1', sof: 'main', ...JSON.parse(sessionStorage.getItem('duon24.mixer') || '{}') }; } catch { return { layer: 'ch1', sof: 'main' }; }
})();
const saveUi = () => { try { sessionStorage.setItem('duon24.mixer', JSON.stringify(ui)); } catch { /* ignore */ } };

const LAYERS = [['ch1', 'CH 1–12'], ['ch2', 'CH 13–24'], ['fx', 'FX'], ['aux', 'AUX'], ['dca', 'DCA']];

export function renderMixer(root) {
  const layerBar = h('div', { class: 'seg' }, LAYERS.map(([k, t]) =>
    h('button', { class: 'seg-b' + (ui.layer === k ? ' on' : ''), onclick: () => { ui.layer = k; saveUi(); rerender(); } }, t)));

  const sofBtns = [h('button', { class: 'pill' + (ui.sof === 'main' ? ' on' : ''), onclick: () => setSof('main') }, 'MAIN')];
  for (let a = 0; a < CFG.AUX; a++) {
    const b = h('button', { class: 'pill' + (ui.sof === `aux:${a}` ? ' on' : ''), style: `--c:${get(`aux.${a}.color`)}`, onclick: () => setSof(`aux:${a}`) }, get(`aux.${a}.name`));
    sofBtns.push(b);
  }
  for (let f = 0; f < CFG.FX; f++) sofBtns.push(h('button', { class: 'pill fxp' + (ui.sof === `fx:${f}` ? ' on' : ''), onclick: () => setSof(`fx:${f}`) }, `FX ${f + 1}`));
  function setSof(s) { ui.sof = s; saveUi(); rerender(); }

  const [sofKind, sofIdx] = ui.sof.split(':');
  const n = +sofIdx;

  const strips = h('div', { class: 'strips' });
  if (ui.layer === 'ch1' || ui.layer === 'ch2') {
    const start = ui.layer === 'ch1' ? 0 : 12;
    for (let i = start; i < start + 12; i++) strips.append(chStrip(i, sofKind, n));
  } else if (ui.layer === 'fx') {
    for (let f = 0; f < CFG.FX; f++) strips.append(fxStrip(f, sofKind, n));
  } else if (ui.layer === 'aux') {
    for (let a = 0; a < CFG.AUX; a++) strips.append(auxStrip(a));
  } else {
    for (let d = 0; d < CFG.DCA; d++) strips.append(dcaStrip(d));
  }

  const soloInd = h('button', { class: 'solo-ind', onclick: () => { for (let i = 0; i < CFG.CH; i++) if (get(`ch.${i}.solo`)) set(`ch.${i}.solo`, false); } }, 'SOLO ativo · limpar');
  const drawSolo = () => soloInd.classList.toggle('show', get('ch').some((c) => c.solo));
  watch('ch', drawSolo);
  drawSolo();

  const mgBar = h('div', { class: 'mg-bar' }, h('span', { class: 'lbl' }, 'MUTE GROUPS'),
    Array.from({ length: CFG.MG }, (_, g) => tbtn(`mg.${g}.on`, get(`mg.${g}.name`), 'mute sm')));

  const sofNote = sofKind !== 'main'
    ? h('div', { class: 'sof-note', style: `--c:${sofKind === 'aux' ? get(`aux.${n}.color`) : 'var(--fx)'}` },
      'Faders mostrando os envios para ', h('b', null, sofKind === 'aux' ? get(`aux.${n}.name`) : `FX ${n + 1}`))
    : null;

  root.append(
    h('div', { class: 'mixer' },
      h('div', { class: 'mx-top' }, layerBar, soloInd),
      h('div', { class: 'sof', role: 'group', 'aria-label': 'Sends on faders' }, h('span', { class: 'lbl' }, 'SENDS ON FADERS'), sofBtns),
      sofNote,
      linkNote('Fader, mute e envios para os retornos vão para a mesa. Envios para FX, pan, solo, DCA e mute groups ainda ficam só no app.'),
      h('div', { class: 'mx-body' }, strips, masterStrip(sofKind, n)),
      mgBar));
}

function head(num, name, color, href) {
  return h('a', { class: 'st-head', href, style: `--c:${color}` }, h('span', { class: 'st-num' }, num), h('span', { class: 'st-name' }, name));
}

function chStrip(i, sofKind, n) {
  const p = `ch.${i}`;
  let fpath = `${p}.fader`, mfn = () => levelToMeter(chPost(i));
  if (sofKind === 'aux') { fpath = `${p}.sends.${n}.level`; mfn = () => levelToMeter(chSend(i, n)); }
  if (sofKind === 'fx') fpath = `${p}.fx.${n}`;
  const name = h('span', { class: 'st-name' });
  const hd = h('a', { class: 'st-head', href: `#/canal/ch/${i}` }, h('span', { class: 'st-num' }, i + 1), name);
  const drawHead = () => { name.textContent = get(`${p}.name`); hd.style.setProperty('--c', get(`${p}.color`)); hd.classList.toggle('linked', get(`${p}.link`)); };
  watch([`${p}.name`, `${p}.color`, `${p}.link`], drawHead);
  drawHead();

  const mute = tbtn(`${p}.mute`, 'MUTE', 'mute');
  const drawGrp = () => mute.classList.toggle('grp', groupMuted(i));
  watch(['mg', 'dca', `${p}.mg`, `${p}.dca`], drawGrp);
  drawGrp();

  const ctl = sofKind === 'aux'
    ? tbtn(`${p}.sends.${n}.pre`, 'PRE', 'sm pre', (b, on) => { b.textContent = on ? 'PRE' : 'POST'; })
    : knob({ path: `${p}.pan`, min: -1, max: 1, def: 0, step: 0.02, fmt: fmtPan, cls: 'sm' });

  return h('div', { class: 'strip' + (sofKind !== 'main' ? ' send' : '') },
    hd, ctl,
    h('div', { class: 'st-fader' }, meter(mfn), vslider({ path: fpath, cls: 'fader' })),
    tbtn(`${p}.solo`, 'SOLO', 'solo'), mute);
}

function fxStrip(f, sofKind, n) {
  const p = `fx.${f}`;
  let fpath = `${p}.ret`, mfn = () => levelToMeter(fxRet(f));
  if (sofKind === 'aux') { fpath = `${p}.aux.${n}`; mfn = () => levelToMeter(fxSend(f, n)); }
  return h('div', { class: 'strip fx' },
    head(`FX${f + 1}`, get(`${p}.type`), 'var(--fx)', '#/fx'),
    h('div', { class: 'st-sp' }),
    h('div', { class: 'st-fader' }, meter(mfn), vslider({ path: fpath, cls: 'fader' })),
    h('div', { class: 'st-sp2' }), tbtn(`${p}.mute`, 'MUTE', 'mute'));
}

function auxStrip(a) {
  const p = `aux.${a}`;
  return h('div', { class: 'strip' },
    head(`A${a + 1}`, get(`${p}.name`), get(`${p}.color`), `#/canal/aux/${a}`),
    h('a', { class: 'tb sm', href: `#/musico/${a}`, title: 'Abrir no Modo Músico' }, '🎧'),
    h('div', { class: 'st-fader' }, meter(() => levelToMeter(auxOut(a))), vslider({ path: `${p}.fader`, cls: 'fader' })),
    h('div', { class: 'st-sp2' }), tbtn(`${p}.mute`, 'MUTE', 'mute'));
}

function dcaStrip(d) {
  const p = `dca.${d}`;
  const count = get('ch').filter((c) => c.dca[d]).length;
  return h('div', { class: 'strip dca' },
    head(`DCA${d + 1}`, get(`${p}.name`), 'var(--dca)', '#/canal/dca/' + d),
    h('div', { class: 'st-info' }, `${count} canais`),
    h('div', { class: 'st-fader' }, h('div', { class: 'meter ghost' }), vslider({ path: `${p}.fader`, cls: 'fader' })),
    h('div', { class: 'st-sp2' }), tbtn(`${p}.mute`, 'MUTE', 'mute'));
}

function masterStrip(sofKind, n) {
  if (sofKind === 'aux') {
    const p = `aux.${n}`;
    return h('div', { class: 'strip master' },
      head(`A${n + 1}`, get(`${p}.name`), get(`${p}.color`), `#/canal/aux/${n}`),
      h('div', { class: 'st-sp' }),
      h('div', { class: 'st-fader' }, meter(() => levelToMeter(auxOut(n))), vslider({ path: `${p}.fader`, cls: 'fader' })),
      h('div', { class: 'st-sp2' }), tbtn(`${p}.mute`, 'MUTE', 'mute'));
  }
  return h('div', { class: 'strip master' },
    head('L/R', 'MAIN', '#f2f2f2', '#/canal/main'),
    h('div', { class: 'st-sp' }),
    h('div', { class: 'st-fader' }, meter(() => levelToMeter(mainOut(0))), meter(() => levelToMeter(mainOut(1))), vslider({ path: 'main.fader', cls: 'fader' })),
    h('div', { class: 'st-sp2' }), tbtn('main.mute', 'MUTE', 'mute'));
}

export function fmtPan(v) {
  if (Math.abs(v) < 0.01) return 'C';
  return (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100);
}
