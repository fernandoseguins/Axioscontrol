# Servidor do app AXIOS DUON 24 para o computador da igreja (Windows).
# Serve os arquivos do app por http:// na rede local, para o iPad e os celulares
# abrirem o app e falarem direto com a mesa (o navegador bloqueia isso a partir de https://).
# Não precisa instalar nada nem rodar como administrador.
param([int]$Porta = 8080)

$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$tipos = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.ico' = 'image/x-icon'; '.md' = 'text/plain; charset=utf-8'
}

$ouvinte = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Any, $Porta)
try { $ouvinte.Start() } catch {
  Write-Host "Nao consegui abrir a porta $Porta. Talvez o app ja esteja aberto em outra janela." -ForegroundColor Red
  Read-Host 'Aperte Enter para fechar'
  exit 1
}

$ips = @([System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
  Where-Object { $_.AddressFamily -eq 'InterNetwork' -and -not $_.ToString().StartsWith('127.') } |
  ForEach-Object { $_.ToString() })

Write-Host ''
Write-Host '  AXIOS DUON 24 - app ligado' -ForegroundColor Green
Write-Host '  Deixe esta janela aberta durante o culto.'
Write-Host ''
Write-Host '  No iPad / celular (na mesma rede da mesa), abra no navegador:' -ForegroundColor Yellow
foreach ($ip in $ips) { Write-Host "     http://$($ip):$Porta" -ForegroundColor Cyan }
Write-Host ''
Write-Host '  Se o Windows perguntar sobre o Firewall, clique em "Permitir acesso".'
Write-Host '  Para desligar, feche esta janela.'
Write-Host ''

function Responder($fluxo, [int]$codigo, [string]$status, [string]$tipo, [byte[]]$corpo) {
  $cab = "HTTP/1.1 $codigo $status`r`nContent-Type: $tipo`r`nContent-Length: $($corpo.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
  $b = [System.Text.Encoding]::ASCII.GetBytes($cab)
  $fluxo.Write($b, 0, $b.Length)
  if ($corpo.Length) { $fluxo.Write($corpo, 0, $corpo.Length) }
}

while ($true) {
  $cliente = $ouvinte.AcceptTcpClient()
  try {
    $cliente.ReceiveTimeout = 3000
    $fluxo = $cliente.GetStream()
    $leitor = New-Object System.IO.StreamReader($fluxo, [System.Text.Encoding]::ASCII, $false, 4096, $true)
    $linha = $leitor.ReadLine()
    while ($true) { $h = $leitor.ReadLine(); if ($null -eq $h -or $h -eq '') { break } }
    if (-not $linha) { continue }
    $partes = $linha.Split(' ')
    $caminho = [System.Uri]::UnescapeDataString(($partes[1] -split '[?#]')[0])
    if ($caminho -eq '/' -or $caminho -eq '') { $caminho = '/index.html' }
    $arquivo = [System.IO.Path]::GetFullPath((Join-Path $raiz $caminho.TrimStart('/')))
    if (-not $arquivo.StartsWith($raiz, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $arquivo -PathType Leaf)) {
      Responder $fluxo 404 'Not Found' 'text/plain' ([System.Text.Encoding]::UTF8.GetBytes('Arquivo nao encontrado'))
    } else {
      $ext = [System.IO.Path]::GetExtension($arquivo).ToLower()
      $tipo = $tipos[$ext]; if (-not $tipo) { $tipo = 'application/octet-stream' }
      Responder $fluxo 200 'OK' $tipo ([System.IO.File]::ReadAllBytes($arquivo))
    }
  } catch {
    # cliente desconectou no meio; segue o baile
  } finally {
    $cliente.Close()
  }
}
