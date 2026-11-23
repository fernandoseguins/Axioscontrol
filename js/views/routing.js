import { get, set, CFG, OUT_NAMES, inSources, outSources, defaults } from '../state.js';
import { h, selectBox, card, dialog, toast } from '../ui.js';

export function renderRouting(root) {
  const ins = inSources();
  const outs = outSources();
  root.append(h('div', { class: 'page' },
    h('div', { class: 'bar' }, h('h2', null, 'Roteamento'),
      h('button', { class: 'btn sm', onclick: reset }, 'Restaurar padrão')),
    h('div', { class: 'grid two' },
      card('Entradas → canais',
        h('p', { class: 'hint' }, 'Qual entrada física (ou USB / gerador) alimenta cada canal lógico.'),
        h('div', { class: 'route' }, Array.from({ length: CFG.CH }, (_, i) =>
          h('label', { class: 'route-r' }, h('span', null, h('b', null, `CH ${i + 1}`), ' ', get(`ch.${i}.name`)), selectBox(`routing.in.${i}`, ins))))),
      card('Mixes → saídas físicas',
        h('p', { class: 'hint' }, 'O que sai em cada conector de saída, no fone e na gravação USB.'),
        h('div', { class: 'route' }, OUT_NAMES.map((name, o) =>
          h('label', { class: 'route-r' }, h('b', null, name), selectBox(`routing.out.${o}`, outs))))))));
}

async function reset() {
  const ok = await dialog({ title: 'Restaurar roteamento padrão?', message: 'Entradas 1:1 e saídas MAIN + AUX.', okText: 'Restaurar' });
  if (!ok) return;
  const d = defaults().routing;
  d.in.forEach((v, i) => set(`routing.in.${i}`, v));
  d.out.forEach((v, i) => set(`routing.out.${i}`, v));
  toast('Roteamento restaurado');
}
