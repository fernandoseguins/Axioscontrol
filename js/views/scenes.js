import { get, set, applyAll, snapshot, CFG } from '../state.js';
import { h, tbtn, dialog, toast, download, pickJson } from '../ui.js';
import { rerender } from '../nav.js';

const fmtDate = (t) => (t ? new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const locked = () => get('sys.sceneLock');

export function renderScenes(root) {
  const cur = get('curScene');
  const list = h('div', { class: 'scene-list' });
  for (let n = 0; n < CFG.SCENES; n++) list.append(row(n, cur));

  root.append(h('div', { class: 'page' },
    h('div', { class: 'bar' },
      h('h2', null, 'Cenas'),
      h('div', { class: 'row' },
        tbtn('sys.sceneLock', '🔒 Travar cenas', 'sm'),
        h('button', { class: 'btn sm', onclick: importScene }, 'Importar'),
        h('button', { class: 'btn sm', onclick: exportAll }, 'Exportar todas'))),
    h('p', { class: 'hint' }, cur >= 0 ? `Última cena chamada: ${cur + 1} · ${get(`scenes.${cur}.name`) ?? ''}` : 'Nenhuma cena chamada ainda.'),
    list));
}

function row(n, cur) {
  const s = get(`scenes.${n}`);
  return h('div', { class: 'scene' + (n === cur ? ' cur' : '') + (s ? '' : ' empty') },
    h('span', { class: 'sc-n' }, String(n + 1).padStart(2, '0')),
    h('div', { class: 'sc-info' }, h('b', null, s ? s.name : 'Vazia'), s ? h('small', null, fmtDate(s.t)) : null),
    h('div', { class: 'sc-act' },
      s ? h('button', { class: 'btn sm primary', onclick: () => recall(n) }, 'Chamar') : null,
      h('button', { class: 'btn sm', onclick: () => save(n) }, s ? 'Salvar' : 'Salvar aqui'),
      s ? h('button', { class: 'btn sm', onclick: () => rename(n) }, 'Renomear') : null,
      s ? h('button', { class: 'btn sm', onclick: () => download(`cena-${n + 1}-${slug(s.name)}.json`, { app: 'axios-duon24', kind: 'scene', ...s }) }, 'Exportar') : null,
      s ? h('button', { class: 'btn sm danger', onclick: () => del(n) }, 'Apagar') : null));
}

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cena';

function guard() {
  if (locked()) { toast('Cenas travadas. Destrave para alterar.'); return true; }
  return false;
}

async function recall(n) {
  const s = get(`scenes.${n}`);
  const ok = await dialog({ title: `Chamar cena ${n + 1}?`, message: `"${s.name}" vai substituir todos os ajustes atuais do mixer.`, okText: 'Chamar' });
  if (!ok) return;
  applyAll(s.data);
  set('curScene', n);
  toast(`Cena ${n + 1} chamada`);
}

async function save(n) {
  if (guard()) return;
  const s = get(`scenes.${n}`);
  const name = await dialog({
    title: `Salvar na cena ${n + 1}`, message: s ? `Isso substitui "${s.name}".` : null,
    input: { value: s?.name || `Cena ${n + 1}`, maxlength: 24, validate: (v) => (v.trim() ? '' : 'Digite um nome') }, okText: 'Salvar',
  });
  if (name == null) return;
  set(`scenes.${n}`, { name: name.trim(), t: Date.now(), data: snapshot() });
  set('curScene', n);
  toast('Cena salva');
  rerender();
}

async function rename(n) {
  if (guard()) return;
  const s = get(`scenes.${n}`);
  const name = await dialog({ title: 'Renomear cena', input: { value: s.name, maxlength: 24, validate: (v) => (v.trim() ? '' : 'Digite um nome') } });
  if (name == null) return;
  set(`scenes.${n}`, { ...s, name: name.trim() });
  rerender();
}

async function del(n) {
  if (guard()) return;
  const ok = await dialog({ title: `Apagar cena ${n + 1}?`, message: 'Não dá para desfazer.', okText: 'Apagar', danger: true });
  if (!ok) return;
  set(`scenes.${n}`, null);
  if (get('curScene') === n) set('curScene', -1);
  rerender();
}

function exportAll() {
  download('cenas-axios-duon24.json', { app: 'axios-duon24', kind: 'scenes', scenes: get('scenes') });
}

async function importScene() {
  if (guard()) return;
  const d = await pickJson();
  if (!d) return;
  if (d.kind === 'scenes' && Array.isArray(d.scenes)) {
    const ok = await dialog({ title: 'Importar todas as cenas?', message: 'As cenas atuais serão substituídas.', okText: 'Importar', danger: true });
    if (!ok) return;
    const all = Array.from({ length: CFG.SCENES }, (_, i) => d.scenes[i] ?? null);
    set('scenes', all);
    toast('Cenas importadas');
    return rerender();
  }
  if (d.kind !== 'scene' || !d.data) { toast('Arquivo não é uma cena da DUON 24'); return; }
  const empty = get('scenes').findIndex((s) => !s);
  const slot = await dialog({
    title: `Importar "${d.name}"`, message: 'Em qual número de cena salvar?',
    input: { type: 'number', value: String((empty < 0 ? 0 : empty) + 1), validate: (v) => (+v >= 1 && +v <= CFG.SCENES ? '' : `Escolha de 1 a ${CFG.SCENES}`) },
    okText: 'Importar',
  });
  if (slot == null) return;
  set(`scenes.${+slot - 1}`, { name: d.name || 'Importada', t: Date.now(), data: d.data });
  toast('Cena importada');
  rerender();
}
