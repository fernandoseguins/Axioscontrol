# AXIOS DUON 24 — app de controle

Aplicativo web (PWA) para controlar o mixer digital **AXIOS DUON 24** pelo celular, tablet ou computador.
Foi inspirado no app do AXIOS 32 (`AX32 .25.12.30.03.APP`) e pode ser instalado na tela inicial como um app.

> **Situação atual:** o app já conversa com a mesa de verdade (modo **Mesa AXIOS**) para nomes, fader, mute,
> ganho, envios para os 8 retornos e medidores. EQ, gate, compressor, efeitos, DCA e rotas ainda ficam só no app.
> Veja [Usar com a mesa](#usar-com-a-mesa).

## Funções

| Tela | O que faz |
|---|---|
| **Mixer** | 24 canais em 2 camadas, retornos de FX, masters AUX, DCA; fader, pan, mute, solo, medidores; *sends on faders* (os faders passam a controlar o envio para um AUX ou FX); botões de mute group |
| **Canal** | Nome e cor, ganho, +48V, fase, link estéreo (1-2, 3-4…), HPF, EQ paramétrico de 4 bandas com curva e **analisador de espectro ao vivo** (antes e depois do EQ) e pontos que se arrastam direto no gráfico, gate, compressor com curva, envios AUX (pre/post) e FX, atribuição a DCA e mute groups |
| **AUX / DCA / MAIN** | Master e EQ gráfico de 15 bandas (AUX e MAIN), canais de cada DCA, nomes dos mute groups, **permissões do Modo Músico** |
| **Efeitos** | 4 processadores: Reverb Hall/Plate/Room/Vocal/Gate, Delay, Tap Delay (botão TAP), Echo, Chorus, Flanger, Phaser, Tremolo, Pitch, Vocal Doubler, Distortion; retorno no MAIN e nos AUX |
| **Cenas** | 30 cenas: salvar, chamar, renomear, apagar, exportar/importar (.json), travar cenas |
| **Rotas** | Entradas físicas/USB/gerador → canais; MAIN/AUX/FX/direct out → saídas físicas, fone e gravação USB |
| **Ferramentas** | Gerador de sinal (seno, ruído rosa, ruído branco), monitor de fone, **RTA** de 1/3 de oitava (simulado ou usando o **microfone do aparelho** para medir a sala) |
| **Sistema** | Nome do mixer, modo de conexão, rede (DHCP/IP/máscara/gateway, Wi-Fi), senha de administrador, links do Modo Músico, backup/restauração, reset de fábrica |
| **🎧 Modo Músico** | Tela simples para cada músico controlar **só o próprio retorno** (ver abaixo) |

### Modo Músico

1. Em **Canal → AUX**, dê o nome do músico ao mix (ex.: "Baterista") e escolha quais canais ele pode ver,
   se pode mudar o volume geral e os efeitos.
2. Em **Sistema → Links do Modo Músico**, copie o link daquele mix e mande para o músico.
3. O músico abre o link no celular e vê só o seu mix: barras grandes, botões −/+ de 1 dB e ★ para fixar
   os canais mais usados no topo.
4. O aparelho fica travado naquele mix. Para sair, é preciso a **senha de administrador** (se você criou uma em Sistema).

A trava funciona no app. Ela evita mudanças por engano, mas não é uma barreira de segurança: a proteção de
verdade precisa vir do mixer ou da ponte quando a conexão real existir.

## Como usar

O app é só HTML/CSS/JavaScript, sem etapa de build. Ele precisa ser servido por HTTP, não aberto como arquivo:

```bash
# na pasta do projeto
python3 -m http.server 8080
# depois abra http://localhost:8080
```

Para usar em outros aparelhos, publique no **Netlify**: o `netlify.toml` já está pronto (sem build, pasta publicada = raiz
do projeto, cache certo para o service worker e microfone liberado para o RTA). Ligue o repositório em
*Add new site → Import an existing project* ou arraste a pasta em *Deploy manually*.
A instalação como app e o microfone do RTA exigem **HTTPS** (ou `localhost`).
Depois do primeiro acesso, o app abre mesmo sem internet.

No modo demo, abas abertas **no mesmo navegador** ficam sincronizadas. Abra o Mixer numa aba e o Modo Músico
em outra para ver os dois funcionando juntos. Aparelhos diferentes só vão se sincronizar quando houver conexão real.

## Usar com a mesa

A mesa tem uma página de controle própria (`http://IP-DA-MESA/`) e um WebSocket na porta **8088**.
O app fala direto com esse WebSocket. Como a mesa usa `http://`, o app também precisa ser aberto por `http://`:
o navegador bloqueia a conexão se o app vier de um site `https://` (Netlify, GitHub Pages).

1. No computador da igreja (Windows), baixe esta pasta e dê dois cliques em **`INICIAR-APP.bat`**.
   Se o Windows perguntar sobre o Firewall, clique em **Permitir acesso**. A janela mostra o endereço, por exemplo
   `http://10.0.0.50:8080`. Deixe a janela aberta.
2. No iPad (na mesma rede da mesa), abra esse endereço no Safari.
3. Em **Sistema → Conexão com o mixer**, escolha **Mesa AXIOS** e coloque o IP da mesa (tela NETWORK da mesa:
   `10.0.0.119` pelo cabo, ou `172.14.51.1` pelo Wi‑Fi da própria mesa). Toque em **Aplicar / reconectar**.
4. Os links do **Modo Músico** (em Sistema) já levam o IP da mesa: o celular do músico abre e conecta sozinho.

Pelo `http://`, o microfone do RTA e o botão "Copiar link" não funcionam (o navegador só libera em `https://`).

### Protocolo (decifrado da captura)

Quadro binário: `0x80 · LEN · CMD · dados · CRC16` (CRC-16/MODBUS, byte alto primeiro; LEN = bytes depois dele).

| CMD | Função |
|---|---|
| `0x03` | gravar parâmetro: ID (2 bytes) + valor (2 bytes); a mesa devolve o mesmo quadro |
| `0x06` | ler parâmetros: lista de IDs → resposta ID + valor para cada um |
| `0x2E` | nome: índice → índice + texto (0–23 canais, 26–27 efeitos, 28–35 retornos) |
| `0x00` / `0x39` | informações do aparelho / texto `CHAVE=valor` (DEVNAME, FW_VER…) |

Canal *n* (0–25): bloco de 62 IDs a partir de `0x42`. Ganho `+6` (dB, 0–48), mute `+8`, fader `+10`,
envios para os retornos 1–8 `+11…+18` (bit 15 preservado), envios para os efeitos 1–2 `+19/+20`.
Escala de fader e envio: `valor = (dB + 120) × 10` (1200 = 0 dB, 0 = −∞).
Masters dos retornos: `0x06F9 + k × 109` (*k* = 0–7; *k* = 8 provavelmente MAIN), ainda em teste.
Medidores: IDs `0x02–0x0E` (canais) e `0x29–0x2F` (saídas), 1 byte por sinal.
O mapa fica em `js/axios-protocol.js`.

## Estrutura

```
index.html, manifest.webmanifest, sw.js   app, instalação e funcionamento offline
css/app.css                               visual
js/state.js                               estado do mixer, cenas, link estéreo, conversões de dB
js/transport.js                           comunicação (demo / mesa AXIOS / ponte WebSocket)
js/axios-protocol.js                      protocolo e mapa de parâmetros da mesa
INICIAR-APP.bat, servidor/servidor.ps1    servidor http para o computador da igreja (Windows)
js/ui.js                                  faders, knobs, botões, medidores, diálogos
js/levels.js                              medidores simulados
js/eq.js                                  curva do EQ (biquad)
js/views/*.js                             uma tela por arquivo
```

## Configuração assumida

24 entradas, 8 AUX, 2 FX, 8 DCA, 6 mute groups, 12 saídas físicas, fone e gravação USB.
Se a DUON 24 tiver outra configuração, ajuste `CFG` em `js/state.js`.
