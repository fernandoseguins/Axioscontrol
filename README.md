# AXIOS DUON 24 — app de controle

Aplicativo web (PWA) para controlar o mixer digital **AXIOS DUON 24** pelo celular, tablet ou computador.
Foi inspirado no app do AXIOS 32 (`AX32 .25.12.30.03.APP`) e pode ser instalado na tela inicial como um app.

> **Situação atual: modo demonstração.** Todas as telas funcionam e guardam os ajustes no aparelho,
> mas ainda **não falam com o mixer de verdade**: o protocolo de comunicação da DUON 24 não está documentado.
> Veja [Ligar ao mixer de verdade](#ligar-ao-mixer-de-verdade).

## Funções

| Tela | O que faz |
|---|---|
| **Mixer** | 24 canais em 2 camadas, retornos de FX, masters AUX, DCA; fader, pan, mute, solo, medidores; *sends on faders* (os faders passam a controlar o envio para um AUX ou FX); botões de mute group |
| **Canal** | Nome e cor, ganho, +48V, fase, link estéreo (1-2, 3-4…), HPF, EQ paramétrico de 4 bandas com curva, gate, compressor com curva, envios AUX (pre/post) e FX, atribuição a DCA e mute groups |
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

## Ligar ao mixer de verdade

Toda a comunicação passa por `js/transport.js`. As telas só leem e gravam valores por *path*
(ex.: `ch.3.mute`, `ch.0.sends.2.level`, `fx.1.p.time`), e cada mudança vira uma mensagem:

```json
{ "t": "set", "path": "ch.3.mute", "value": true }
{ "t": "all", "state": { "...": "..." } }
```

O modo **Ponte de rede (WebSocket)**, em Sistema, já envia e recebe essas mensagens. Falta:

1. Descobrir o protocolo da DUON 24: documentação do fabricante ou captura do tráfego entre o app
   oficial e o mixer (Wireshark, para rede; monitor serial, para COM/USB).
2. Escrever a ponte, um pequeno programa (Node.js, Python ou firmware) que traduz o JSON acima para os comandos do mixer
   e devolve as mudanças feitas no próprio mixer.

Valores: os faders e envios são guardados como posição de 0 a 1 (0,75 = 0 dB). Use `posToDb()` em `js/state.js` para converter.

## Estrutura

```
index.html, manifest.webmanifest, sw.js   app, instalação e funcionamento offline
css/app.css                               visual
js/state.js                               estado do mixer, cenas, link estéreo, conversões de dB
js/transport.js                           comunicação (demo / ponte WebSocket)
js/ui.js                                  faders, knobs, botões, medidores, diálogos
js/levels.js                              medidores simulados
js/eq.js                                  curva do EQ (biquad)
js/views/*.js                             uma tela por arquivo
```

## Configuração assumida

24 entradas, 8 AUX, 4 FX, 8 DCA, 6 mute groups, 12 saídas físicas, fone e gravação USB.
Se a DUON 24 tiver outra configuração, ajuste `CFG` em `js/state.js`.
