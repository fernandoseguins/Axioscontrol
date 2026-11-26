// Modo Músico: cada músico controla apenas o próprio mix de retorno (AUX).
import { get, watch, CFG } from '../state.js';
import { h, hslider, tbtn, nudge, meter, levelToMeter, dialog } from '../ui.js';
import { auxOut } from '../levels.js';
import { rerender } from '../nav.js';

const LOCK = 'duon24.musAux';
export const musLock = () => { try { const v = sessionStorage.getItem(LOCK); return v == null ? null : +v; } catch { return null; } };
const setLock = (v) => { try { v == null ? sessionStorage.removeItem(LOCK) : sessionStorage.setItem(LOCK, String(v)); } catch { /* ignore */ } };

const FAV = 'duon24.fav';
const favs = () => { try { return JSON.parse(localStorage.getItem(FAV) || '{}'); } catch { return {}; } };
const saveFavs = (f) => { try { localStorage.setItem(FAV, JSON.stringify(f)); } catch { /* ignore */ } };

export function renderMusician(root, [idx]) {
  const a = idx === undefined || idx === '' ? null : Math.min(CFG.AUX - 1, Math.max(0, +idx || 0));
  if (a === null) return picker(root);
  setLock(a);

  const p = `aux.${a}`;
  const aux = get(p);
  const myFavs = favs();
  const key = String(a);
  const isFav = (id) => (myFavs[key] || []).includes(id);
  const toggleFav = (id) => {
    const l = new Set(myFavs[key] || []);
    l.has(id) ? l.delete(id) : l.add(id);
    myFavs[key] = [...l];
    saveFavs(myFavs);
    rerender();
  };

  const rows = [];
  for (let i = 0; i < CFG.CH; i++) {
    if (!aux.mus.show[i]) continue;
    rows.push({ id: `c${i}`, name: get(`ch.${i}.name`), color: get(`ch.${i}.color`), path: `ch.${i}.sends.${a}.level`, num: i + 1 });
  }
  const real = get('sys.mode') === 'axios';
  // Na mesa real, o retorno dos efeitos nos mixes ainda não está mapeado: some daqui.
  if (aux.mus.fx && !real) for (let f = 0; f < CFG.FX; f++) rows.push({ id: `f${f}`, name: get(`fx.${f}.type`), color: 'var(--fx)', path: `fx.${f}.aux.${a}`, num: `FX${f + 1}` });
  rows.sort((x, y) => isFav(y.id) - isFav(x.id));

  const list = h('div', { class: 'mus-list' }, rows.map((r) =>
    h('div', { class: 'mus-row' + (isFav(r.id) ? ' fav' : '') },
      h('div', { class: 'mus-h' },
        h('span', { class: 'mus-num', style: `--c:${r.color}` }, r.num),
        h('span', { class: 'mus-name' }, r.name),
        h('button', { class: 'star', 'aria-label': 'Favorito', 'aria-pressed': String(isFav(r.id)), onclick: () => toggleFav(r.id) }, isFav(r.id) ? '★' : '☆')),
      h('div', { class: 'mus-ctl' }, nudge(r.path)[0], hslider({ path: r.path, color: r.color }), nudge(r.path)[1]))));
  if (!rows.length) list.append(h('p', { class: 'hint' }, 'Nenhum canal liberado para este mix. Peça ao técnico de som.'));

  const title = h('h2', { class: 'mus-t', style: `--c:${aux.color}` }, aux.name);
  watch(`${p}.name`, () => { title.textContent = get(`${p}.name`); });

  root.append(h('div', { class: 'musician' },
    h('div', { class: 'mus-top' },
      h('div', null, h('small', null, 'MEU RETORNO'), title),
      h('button', { class: 'btn sm', onclick: () => exit() }, 'Sair')),
    h('div', { class: 'mus-master' },
      h('div', { class: 'mus-h' }, h('b', null, 'Volume geral'), aux.mus.master && !real ? tbtn(`${p}.mute`, 'MUTE', 'mute sm') : null),
      aux.mus.master
        ? h('div', { class: 'mus-ctl' }, nudge(`${p}.fader`)[0], hslider({ path: `${p}.fader`, color: aux.color, cls: 'big' }), nudge(`${p}.fader`)[1])
        : h('p', { class: 'hint' }, 'O volume geral é controlado pelo técnico.'),
      meter(() => levelToMeter(auxOut(a)), 'h')),
    h('p', { class: 'hint' }, 'Arraste a barra para ajustar. Toque duas vezes para voltar a 0 dB. ★ fixa o canal no topo.'),
    list));
}

function picker(root) {
  const locked = musLock();
  root.append(h('div', { class: 'musician' },
    h('div', { class: 'mus-top' }, h('div', null, h('small', null, 'MODO MÚSICO'), h('h2', { class: 'mus-t' }, 'Qual é o seu retorno?')),
      locked == null ? h('a', { class: 'btn sm', href: '#/mixer' }, 'Voltar') : null),
    h('div', { class: 'mus-pick' }, Array.from({ length: CFG.AUX }, (_, a) =>
      h('a', { class: 'mus-card', href: `#/musico/${a}`, style: `--c:${get(`aux.${a}.color`)}` },
        h('small', null, `AUX ${a + 1}`), h('b', null, get(`aux.${a}.name`)))))));
}

async function exit() {
  const pass = get('sys.adminPass');
  if (pass) {
    const p = await dialog({ title: 'Sair do Modo Músico', message: 'Digite a senha do técnico.', input: { type: 'password', maxlength: 8, validate: (v) => (v === pass ? '' : 'Senha incorreta.') }, okText: 'Sair' });
    if (p == null) return;
  }
  setLock(null);
  location.hash = '#/mixer';
}
