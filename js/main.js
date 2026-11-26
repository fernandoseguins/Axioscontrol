import { newScope, subscribe, get, set, watch, reconnect } from './state.js';
import { onStatus, currentStatus } from './transport.js';
import { setRerender } from './nav.js';
import { renderMixer } from './views/mixer.js';
import { renderChannel } from './views/channel.js';
import { renderFx } from './views/fx.js';
import { renderScenes } from './views/scenes.js';
import { renderRouting } from './views/routing.js';
import { renderTools } from './views/tools.js';
import { renderSystem } from './views/system.js';
import { renderMusician, musLock } from './views/musician.js';

const ROUTES = {
  mixer: renderMixer, canal: renderChannel, fx: renderFx, cenas: renderScenes,
  rotas: renderRouting, ferramentas: renderTools, sistema: renderSystem, musico: renderMusician,
};

const main = document.getElementById('main');
const nav = document.getElementById('nav');

function route() {
  let [name, ...args] = location.hash.replace(/^#\/?/, '').split('/');
  if (!ROUTES[name]) name = 'mixer';
  const lock = musLock();
  if (lock != null && (name !== 'musico' || args[0] !== String(lock))) {
    location.replace(`#/musico/${lock}`);
    return;
  }
  const y = sameRoute(name, args) ? main.scrollTop : 0;
  newScope();
  main.replaceChildren();
  document.body.classList.toggle('mus-mode', name === 'musico');
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.r === name));
  ROUTES[name](main, args);
  scopeHeader();
  main.scrollTop = y;
  lastRoute = name + '/' + args.join('/');
}
let lastRoute = '';
const sameRoute = (n, a) => lastRoute === n + '/' + a.join('/');

function scopeHeader() {
  const dn = document.getElementById('devname');
  const draw = () => { dn.textContent = get('sys.name'); };
  watch('sys.name', draw);
  draw();
}

// Link do músico / do técnico: ?mesa=IP já liga ao modo Mesa AXIOS
const qs = new URLSearchParams(location.search);
if (qs.get('mesa')) {
  const host = qs.get('mesa').trim();
  if (/^[\w.-]{1,60}$/.test(host) && (get('sys.mode') !== 'axios' || get('sys.host') !== host)) {
    set('sys.host', host);
    set('sys.mode', 'axios');
    reconnect();
  }
}

setRerender(route);
window.addEventListener('hashchange', route);
subscribe((p) => { if (p === '*') route(); });
// Nomes que chegam da mesa: redesenha a tela (sem atrapalhar quem está digitando).
let nameTimer = 0;
subscribe((p) => {
  if (!/^(ch|aux)\.\d+\.name$/.test(p)) return;
  clearTimeout(nameTimer);
  nameTimer = setTimeout(() => {
    const a = document.activeElement;
    if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;
    if (document.querySelector('dialog[open]') || document.querySelector('.active')) return;
    route();
  }, 400);
});

const pill = document.getElementById('status');
const drawStatus = (s) => { pill.textContent = s.text; pill.dataset.state = s.state; };
drawStatus(currentStatus());
onStatus(drawStatus);

route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
