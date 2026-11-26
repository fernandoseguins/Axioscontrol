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

// ---------- mesa AXIOS direto (WebSocket da própria mesa) ----------
import * as AX from './axios-protocol.js';

/** Medidores reais vindos da mesa (bytes por canal / por saída). */
export const liveMeters = { on: false, ch: new Uint8Array(AX.CH_COUNT), bus: new Uint8Array(14) };
export const deviceInfo = { name: '', fw: '' };

class AxiosTransport {
  constructor(host, onMsg, api) {
    this.kind = 'axios';
    this.host = host;
    this.onMsg = onMsg;
    this.api = api;
    this.map = AX.buildMap(api.CFG.CH, api.CFG.AUX, api.CFG.FX);
    this.byPath = new Map(this.map.map((m) => [m.path, m]));
    this.byId = new Map(this.map.map((m) => [m.id, m]));
    this.raw = new Map(); // último valor bruto conhecido de cada ID
    this.touched = new Map(); // ID → hora da última mudança feita aqui (evita "briga" com a leitura)
    this.pending = new Map();
    this.timers = [];
    this.closed = false;
    this.retry = 1000;
    this.ready = false;
    this.open();
  }
  open() {
    status({ kind: 'axios', state: 'wait', text: 'Conectando à mesa…' });
    let ws;
    try { ws = new WebSocket(`ws://${this.host}:${AX.PORT}/`); } catch {
      status({ kind: 'axios', state: 'err', text: 'Endereço da mesa inválido' });
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 1000;
      this.ready = false;
      status({ kind: 'axios', state: 'wait', text: 'Lendo a mesa…' });
      this.tx(AX.frame(AX.CMD.INFO, [0]));
      this.tx(AX.frame(AX.CMD.TEXT, [...new TextEncoder().encode('DEVNAME=\nFW_VER=\n')]));
      this.readNames();
      this.readAll();
      this.timers.push(setInterval(() => this.flush(), 40));
      this.timers.push(setInterval(() => this.readAll(), 1000));
      this.timers.push(setInterval(() => this.tx(AX.readFrame([...AX.METER_CH_IDS, ...AX.METER_BUS_IDS])), 150));
      this.timers.push(setInterval(() => this.readNames(), 15000));
    };
    ws.onmessage = (e) => {
      if (!(e.data instanceof ArrayBuffer)) return;
      for (const f of AX.parse(e.data)) this.handle(f.cmd, f.p);
    };
    ws.onclose = () => {
      this.stopTimers();
      liveMeters.on = false;
      if (this.closed) return;
      status({ kind: 'axios', state: 'err', text: 'Sem conexão com a mesa' });
      setTimeout(() => !this.closed && this.open(), this.retry);
      this.retry = Math.min(this.retry * 2, 10000);
    };
  }
  stopTimers() { this.timers.forEach(clearInterval); this.timers = []; }
  tx(bytes) { if (this.ws?.readyState === 1) this.ws.send(bytes); }

  readAll() {
    const ids = this.map.map((m) => m.id);
    for (let i = 0; i < ids.length; i += 60) this.tx(AX.readFrame(ids.slice(i, i + 60)));
  }
  readNames() {
    const { CFG } = this.api;
    for (let i = 0; i < CFG.CH; i++) this.tx(AX.frame(AX.CMD.NAME, [AX.NAME_IDX.ch + i]));
    for (let a = 0; a < CFG.AUX; a++) this.tx(AX.frame(AX.CMD.NAME, [AX.NAME_IDX.aux + a]));
  }

  handle(cmd, p) {
    if (cmd === AX.CMD.READ) {
      const now = performance.now();
      for (let k = 0; k + 3 < p.length; k += 4) {
        const id = (p[k] << 8) | p[k + 1];
        const v = (p[k + 2] << 8) | p[k + 3];
        const mi = AX.METER_CH_IDS.indexOf(id);
        if (mi >= 0) {
          // byte alto do ID (0x01 + mi) = canal 2·mi − 1, byte baixo = canal 2·mi
          const hi = 2 * mi - 1, lo = 2 * mi;
          if (hi >= 0 && hi < AX.CH_COUNT) liveMeters.ch[hi] = p[k + 2];
          if (lo < AX.CH_COUNT) liveMeters.ch[lo] = p[k + 3];
          liveMeters.on = true;
          continue;
        }
        const bi = AX.METER_BUS_IDS.indexOf(id);
        if (bi >= 0) { liveMeters.bus[bi * 2] = p[k + 2]; liveMeters.bus[bi * 2 + 1] = p[k + 3]; continue; }
        const m = this.byId.get(id);
        if (!m) continue;
        if (now - (this.touched.get(id) || -1e9) < 1500 || this.pending.has(id)) continue;
        this.raw.set(id, v);
        this.onMsg({ t: 'set', path: m.path, value: m.from(v) });
      }
      if (!this.ready) {
        this.ready = true;
        status({ kind: 'axios', state: 'ok', text: 'Mesa conectada' + (deviceInfo.name ? ' · ' + deviceInfo.name : '') });
      }
    } else if (cmd === AX.CMD.NAME && p.length >= 1) {
      const idx = p[0];
      const name = new TextDecoder('latin1').decode(p.subarray(1)).replace(/\0.*$/, '').trim();
      const { CFG } = this.api;
      if (idx < CFG.CH) this.onMsg({ t: 'set', path: `ch.${idx}.name`, value: name || `CH ${idx + 1}` });
      else if (idx >= AX.NAME_IDX.aux && idx < AX.NAME_IDX.aux + CFG.AUX) this.onMsg({ t: 'set', path: `aux.${idx - AX.NAME_IDX.aux}.name`, value: name || `AUX ${idx - AX.NAME_IDX.aux + 1}` });
    } else if (cmd === AX.CMD.INFO && p.length > 5) {
      deviceInfo.name = new TextDecoder('latin1').decode(p.subarray(5)).replace(/\0.*$/, '').trim();
    } else if (cmd === AX.CMD.TEXT) {
      const txt = new TextDecoder('latin1').decode(p);
      const fw = /FW_VER=([^\n]*)/.exec(txt);
      if (fw && fw[1]) deviceInfo.fw = fw[1].trim();
      const dn = /DEVNAME=([^\n]*)/.exec(txt);
      if (dn && dn[1]) deviceInfo.name = dn[1].trim();
    }
  }

  send(msg) {
    if (msg.t === 'set') this.queue(msg.path);
    else if (msg.t === 'all') for (const m of this.map) this.queue(m.path);
  }
  queue(path) {
    const m = this.byPath.get(path);
    if (!m) return;
    const v = this.api.get(path);
    if (v === undefined) return;
    const raw = m.to(v, this.raw.get(m.id) ?? 0x8000);
    if (this.raw.get(m.id) === raw && !this.pending.has(m.id)) return;
    this.raw.set(m.id, raw);
    this.touched.set(m.id, performance.now());
    this.pending.set(m.id, raw);
  }
  flush() {
    if (!this.pending.size || this.ws?.readyState !== 1) return;
    for (const [id, v] of this.pending) this.tx(AX.setFrame(id, v));
    this.pending.clear();
  }
  close() {
    this.closed = true;
    this.stopTimers();
    liveMeters.on = false;
    try { this.ws?.close(); } catch { /* ignore */ }
  }
}

/** Paths que a mesa de verdade controla (o resto fica só no app). */
export const LINKED = /^(ch\.\d+\.(fader|mute|gain|sends\.\d+\.level)|aux\.\d+\.fader|main\.fader)$/;

export function createTransport(sys, onMsg, api) {
  if (sys.mode === 'axios' && sys.host) return new AxiosTransport(sys.host.trim(), onMsg, api);
  if (sys.mode === 'bridge' && sys.bridge) return new BridgeTransport(sys.bridge, onMsg);
  return new DemoTransport(onMsg);
}
