// Camada de comunicação com o mixer.
//
// "demo": nada sai do aparelho. Abas/janelas do mesmo navegador ficam sincronizadas
//         via BroadcastChannel (útil para testar o Modo Músico ao lado do Mixer).
// "bridge": envia/recebe JSON { t:'set', path, value } / { t:'all', state } por WebSocket
//         para um programa-ponte que traduz para o protocolo da DUON 24.
//         O protocolo do mixer ainda não está documentado; quando estiver, só a ponte
//         (ou esta classe) precisa ser adaptada — as telas não mudam.

const listeners = new Set();
export function onStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
let lastStatus = { kind: 'demo', state: 'ok', text: 'Modo demo' };
export const currentStatus = () => lastStatus;
function status(s) {
  lastStatus = s;
  listeners.forEach((fn) => fn(s));
}

class DemoTransport {
  constructor(onMsg) {
    this.kind = 'demo';
    try {
      this.bc = new BroadcastChannel('axios-duon24');
      this.bc.onmessage = (e) => onMsg(e.data);
    } catch { this.bc = null; }
    status({ kind: 'demo', state: 'ok', text: 'Modo demo' });
  }
  send(msg) { try { this.bc?.postMessage(msg); } catch { /* ignore */ } }
  close() { try { this.bc?.close(); } catch { /* ignore */ } }
}

class BridgeTransport {
  constructor(url, onMsg) {
    this.kind = 'bridge';
    this.url = url;
    this.onMsg = onMsg;
    this.queue = [];
    this.closed = false;
    this.retry = 1000;
    this.open();
  }
  open() {
    status({ kind: 'bridge', state: 'wait', text: 'Conectando…' });
    let ws;
    try { ws = new WebSocket(this.url); } catch {
      status({ kind: 'bridge', state: 'err', text: 'Endereço inválido' });
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 1000;
      status({ kind: 'bridge', state: 'ok', text: 'Conectado' });
      ws.send(JSON.stringify({ t: 'hello', app: 'axios-duon24' }));
      this.queue.splice(0).forEach((m) => ws.send(m));
    };
    ws.onmessage = (e) => {
      try { this.onMsg(JSON.parse(e.data)); } catch { /* ignora mensagens inválidas */ }
    };
    ws.onclose = () => {
      if (this.closed) return;
      status({ kind: 'bridge', state: 'err', text: 'Desconectado' });
      setTimeout(() => !this.closed && this.open(), this.retry);
      this.retry = Math.min(this.retry * 2, 15000);
    };
  }
  send(msg) {
    const s = JSON.stringify(msg);
    if (this.ws?.readyState === 1) this.ws.send(s);
    else if (this.queue.length < 500) this.queue.push(s);
  }
  close() {
    this.closed = true;
    try { this.ws?.close(); } catch { /* ignore */ }
  }
}

export function createTransport(sys, onMsg) {
  if (sys.mode === 'bridge' && sys.bridge) return new BridgeTransport(sys.bridge, onMsg);
  return new DemoTransport(onMsg);
}
