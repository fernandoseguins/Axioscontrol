import { get, set, watch, CFG, applyAll, snapshot, factoryReset, reconnect } from '../state.js';
import { h, tbtn, textInput, selectBox, card, dialog, toast, download, pickJson } from '../ui.js';
import { currentStatus, onStatus, deviceInfo } from '../transport.js';
import { onCleanup } from '../state.js';
import { copy } from './channel.js';
import { rerender } from '../nav.js';

const ipOk = (v) => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(v);
export const APP_VERSION = '1.0.0';

export function renderSystem(root) {
  const st = h('span', { class: 'conn' });
  const drawSt = (s) => { st.textContent = s.text; st.dataset.state = s.state; };
  drawSt(currentStatus());
  onCleanup(onStatus(drawSt));

  const ipFields = h('div', { class: 'form' },
    field('IP', 'sys.ip', ipOk), field('Máscara', 'sys.mask', ipOk), field('Gateway', 'sys.gw', ipOk));
  const drawDhcp = () => ipFields.classList.toggle('disabled', get('sys.dhcp'));
  watch('sys.dhcp', drawDhcp);
  drawDhcp();

  const bridgeRow = h('label', { class: 'fld' }, h('span', null, 'Endereço da ponte'), textInput('sys.bridge', { maxlength: 80, placeholder: 'ws://192.168.1.100:8080' }));
  const hostRow = h('label', { class: 'fld' }, h('span', null, 'Endereço (IP) da mesa'), textInput('sys.host', { maxlength: 60, placeholder: '10.0.0.119' }));
  hostRow.querySelector('input').inputMode = 'decimal';
  const httpsWarn = h('div', { class: 'warnbox' }, '⚠ Este app foi aberto por um endereço https:// (ex.: Netlify). O navegador bloqueia a conexão com a mesa a partir dele. Abra o app pelo computador da igreja: http://IP-DO-COMPUTADOR:8080');
  const drawMode = () => {
    const m = get('sys.mode');
    bridgeRow.hidden = m !== 'bridge';
    hostRow.hidden = m !== 'axios';
    httpsWarn.hidden = !(m === 'axios' && location.protocol === 'https:');
  };
  watch('sys.mode', drawMode);
  drawMode();

  const base = () => `${location.origin}${location.pathname}${get('sys.mode') === 'axios' ? '?mesa=' + encodeURIComponent(get('sys.host')) : ''}#/musico/`;
  const fw = h('dd', null, deviceInfo.fw || '— (sem conexão)');
  const devn = h('dd', null, deviceInfo.name || '—');
  const infoTimer = setInterval(() => { fw.textContent = deviceInfo.fw || '— (sem conexão)'; devn.textContent = deviceInfo.name || '—'; }, 1000);
  onCleanup(() => clearInterval(infoTimer));

  root.append(h('div', { class: 'page' },
    h('div', { class: 'bar' }, h('h2', null, 'Sistema')),
    h('div', { class: 'grid two' },
      card('Dispositivo',
        h('label', { class: 'fld' }, h('span', null, 'Nome'), textInput('sys.name', { maxlength: 20 })),
        h('dl', { class: 'info' },
          h('dt', null, 'Modelo'), h('dd', null, 'AXIOS DUON 24'),
          h('dt', null, 'Canais'), h('dd', null, `${CFG.CH} entradas · ${CFG.AUX} AUX · ${CFG.FX} FX · ${CFG.DCA} DCA`),
          h('dt', null, 'Mesa'), devn,
          h('dt', null, 'Firmware'), fw,
          h('dt', null, 'App'), h('dd', null, APP_VERSION))),
      card('Conexão com o mixer',
        h('div', { class: 'row' }, h('span', { class: 'k-l' }, 'Status'), st),
        h('label', { class: 'fld' }, h('span', null, 'Modo'), selectBox('sys.mode', [['demo', 'Demonstração (sem mesa)'], ['axios', 'Mesa AXIOS (rede / Wi‑Fi)'], ['bridge', 'Ponte de rede (avançado)']])),
        hostRow, bridgeRow, httpsWarn,
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { reconnect(); toast('Reconectando…'); } }, 'Aplicar / reconectar')),
        h('p', { class: 'hint' }, 'No modo Mesa AXIOS, este aparelho fala direto com a mesa (porta 8088). Ligados à mesa: nomes, fader, mute, ganho, envios para os 8 retornos e medidores. O resto (EQ, gate, compressor, efeitos, DCA, rotas) por enquanto fica só no app. No modo demo nada sai do aparelho.')),
      card('Rede do mixer',
        h('p', { class: 'hint' }, 'Por enquanto a rede da mesa é configurada na tela da própria mesa. Estes campos ficam só no app.'),
        h('div', { class: 'row' }, tbtn('sys.dhcp', 'Obter IP automaticamente (DHCP)')),
        ipFields,
        h('div', { class: 'k-l' }, 'Wi-Fi'),
        h('div', { class: 'form' },
          h('label', { class: 'fld' }, h('span', null, 'SSID'), textInput('sys.ssid', { maxlength: 32 })),
          h('label', { class: 'fld' }, h('span', null, 'Senha Wi-Fi'), textInput('sys.wifiPass', { maxlength: 63, type: 'password' })))),
      card('Segurança',
        h('p', { class: 'hint' }, 'A senha de administrador é pedida para sair do Modo Músico. Deixe vazia para não pedir.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: changePass }, get('sys.adminPass') ? 'Trocar senha' : 'Criar senha'),
          get('sys.adminPass') ? h('button', { class: 'btn danger', onclick: removePass }, 'Remover senha') : null),
        h('div', { class: 'row' }, tbtn('sys.sceneLock', '🔒 Travar cenas'))),
      card('Links do Modo Músico',
        h('p', { class: 'hint' }, 'Mande o link para cada músico abrir no próprio celular. Ele só vai controlar o próprio retorno.'),
        h('div', { class: 'links' }, Array.from({ length: CFG.AUX }, (_, a) =>
          h('div', { class: 'link-r' },
            h('span', { class: 'dot', style: `--c:${get(`aux.${a}.color`)}` }),
            h('b', null, get(`aux.${a}.name`)),
            h('button', { class: 'btn sm', onclick: () => copy(base() + a) }, 'Copiar link'),
            h('a', { class: 'btn sm', href: `#/canal/aux/${a}` }, 'Permissões'))))),
      card('Backup e reset',
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn', onclick: () => download('backup-axios-duon24.json', { app: 'axios-duon24', kind: 'backup', state: snapshot([...Object.keys(get())]) }) }, 'Exportar backup'),
          h('button', { class: 'btn', onclick: importBackup }, 'Importar backup'),
          h('button', { class: 'btn danger', onclick: reset }, 'Reset de fábrica'))))));
}

function field(label, path, valid) {
  const i = textInput(path, { maxlength: 15 });
  i.inputMode = 'decimal';
  i.addEventListener('input', () => i.classList.toggle('bad', !valid(i.value)));
  return h('label', { class: 'fld' }, h('span', null, label), i);
}

const passRule = (v) => (/\s/.test(v) ? 'A senha não pode ter espaços.' : v.length > 8 ? 'A senha pode ter no máximo 8 caracteres.' : !v ? 'Digite uma senha.' : '');

async function changePass() {
  const cur = get('sys.adminPass');
  if (cur) {
    const p = await dialog({ title: 'Senha atual', input: { type: 'password', maxlength: 8, validate: (v) => (v === cur ? '' : 'Senha incorreta.') } });
    if (p == null) return;
  }
  const p1 = await dialog({ title: 'Nova senha', message: 'Até 8 caracteres, sem espaços.', input: { type: 'password', maxlength: 8, validate: passRule } });
  if (p1 == null) return;
  const p2 = await dialog({ title: 'Confirme a senha', input: { type: 'password', maxlength: 8, validate: (v) => (v === p1 ? '' : 'As senhas não conferem. Tente de novo.') } });
  if (p2 == null) return;
  set('sys.adminPass', p1);
  toast('Senha salva');
  rerender();
}

async function removePass() {
  const cur = get('sys.adminPass');
  const p = await dialog({ title: 'Remover senha', input: { type: 'password', maxlength: 8, validate: (v) => (v === cur ? '' : 'Senha incorreta.') }, okText: 'Remover', danger: true });
  if (p == null) return;
  set('sys.adminPass', '');
  toast('Senha removida');
  rerender();
}

async function importBackup() {
  const d = await pickJson();
  if (!d) return;
  if (d.kind !== 'backup' || !d.state) { toast('Arquivo não é um backup da DUON 24'); return; }
  const ok = await dialog({ title: 'Importar backup?', message: 'Todos os ajustes e cenas atuais serão substituídos.', okText: 'Importar', danger: true });
  if (!ok) return;
  applyAll(d.state);
  reconnect();
  toast('Backup importado');
}

async function reset() {
  const ok = await dialog({ title: 'Reset de fábrica?', message: 'Apaga todos os ajustes, cenas e senha deste app. Não dá para desfazer.', okText: 'Resetar', danger: true });
  if (!ok) return;
  factoryReset();
  reconnect();
  toast('Reset concluído');
}
