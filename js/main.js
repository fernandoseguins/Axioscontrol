import { newScope, subscribe, get, watch } from './state.js';
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

setRerender(route);
window.addEventListener('hashchange', route);
subscribe((p) => { if (p === '*') route(); });

const pill = document.getElementById('status');
const drawStatus = (s) => { pill.textContent = s.text; pill.dataset.state = s.state; };
drawStatus(currentStatus());
onStatus(drawStatus);

route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
