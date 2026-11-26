import { get, set, CFG, FX_TYPES, fxDefaults } from '../state.js';
import { h, knob, tbtn, hslider, meter, levelToMeter, card, linkNote } from '../ui.js';
import { fxRet } from '../levels.js';
import { rerender } from '../nav.js';

export function renderFx(root) {
  const grid = h('div', { class: 'grid' });
  for (let f = 0; f < CFG.FX; f++) grid.append(fxCard(f));
  root.append(h('div', { class: 'page' },
    h('div', { class: 'bar' }, h('h2', null, 'Efeitos'), h('p', { class: 'hint' }, '2 processadores estéreo. Envie os canais pelo Mixer (sends on faders) ou pela tela do canal.')),
    linkNote('Os efeitos e os envios para REVERBE/DLEY ainda ficam só no app.'),
    grid));
}

function fxCard(f) {
  const p = `fx.${f}`;
  const type = get(`${p}.type`);
  const sel = h('select', { class: 'sel big', onchange: () => { set(`${p}.p`, fxDefaults(sel.value)); set(`${p}.type`, sel.value); rerender(); } },
    Object.keys(FX_TYPES).map((t) => h('option', { value: t, selected: t === type }, t)));
  const params = FX_TYPES[type].map((d) => knob({ path: `${p}.p.${d.k}`, label: d.label, min: d.min, max: d.max, def: d.def, step: d.step, unit: d.unit, log: d.log }));
  const hasTime = FX_TYPES[type].find((d) => d.k === 'time' && d.unit === 'ms');
  let taps = [];
  const tap = hasTime ? h('button', { class: 'btn tap', onclick: () => {
    const now = performance.now();
    taps = taps.filter((t) => now - t < 2500);
    taps.push(now);
    if (taps.length >= 2) {
      const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      set(`${p}.p.time`, Math.round(Math.min(hasTime.max, Math.max(hasTime.min, iv))));
    }
  } }, 'TAP') : null;

  return card(`FX ${f + 1}`,
    h('div', { class: 'row' }, sel, tbtn(`${p}.mute`, 'MUTE', 'mute')),
    h('div', { class: 'row wrap' }, params, tap),
    h('div', { class: 'send-row' }, h('span', { class: 'sr-name' }, 'Retorno MAIN'), hslider({ path: `${p}.ret`, color: 'var(--fx)' }), meter(() => levelToMeter(fxRet(f)), 'h')),
    h('details', { class: 'more' }, h('summary', null, 'Retorno nos AUX (monitores)'),
      h('div', { class: 'sends' }, Array.from({ length: CFG.AUX }, (_, a) =>
        h('div', { class: 'send-row' },
          h('span', { class: 'dot', style: `--c:${get(`aux.${a}.color`)}` }),
          h('span', { class: 'sr-name' }, get(`aux.${a}.name`)),
          hslider({ path: `${p}.aux.${a}`, color: get(`aux.${a}.color`) }))))));
}
