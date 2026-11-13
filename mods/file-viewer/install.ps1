# file-viewer 모드를 새 PC(Windows)에서 쓰기 위한 준비. 여러 번 실행해도 된다.
#   powershell -ExecutionPolicy Bypass -File install.ps1            # 등록 + 빠진 도구 알려 주기
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Install   # 빠진 도구까지 winget/npm으로 설치
# 하는 일
#   1. herdrview: 주소를 현재 사용자(HKCU)로 등록한다. Ctrl+클릭한 herdrview:// 링크를 이 폴더의 herdr-link.js가 받는다.
#   2. 미리보기에 쓰는 도구(ffmpeg·ffprobe·ffplay, mpv, node, mermaid-cli)가 있는지 본다.
param([switch]$Install)
$ErrorActionPreference = 'Stop'

# 1. herdrview: 등록 (관리자 권한 필요 없음)
$handler = Join-Path $PSScriptRoot 'herdr-link.js'
if (-not (Test-Path -LiteralPath $handler)) { throw "herdr-link.js가 없습니다: $handler" }
$key = 'HKCU:\Software\Classes\herdrview'
New-Item -Path "$key\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path $key -Name '(default)' -Value 'URL:Herdr viewer'
Set-ItemProperty -Path $key -Name 'URL Protocol' -Value ''
# //E:JScript: .js 연결이 다른 프로그램으로 바뀌어 있어도 JScript로 돌린다. //B: 창 없이.
Set-ItemProperty -Path "$key\shell\open\command" -Name '(default)' -Value ('wscript.exe //B //Nologo //E:JScript "{0}" "%1"' -f $handler)
Write-Host "herdrview: 등록 완료 → $handler"

# 1-2. 경로 열기 모드(path-picker)가 옆에 있는지
$picker = Join-Path (Split-Path $PSScriptRoot -Parent) 'path-picker\main.js'
if (Test-Path -LiteralPath $picker) { Write-Host '경로 열기 모드(path-picker) 있음' }
else { Write-Host '경로 열기 모드(path-picker)가 없습니다: mods\path-picker 폴더도 같이 복사하세요.' -ForegroundColor Yellow }

# 1-3. 단축키: 없으면 넣고, 다른 동작에 쓰이고 있으면 덮어쓰지 않고 알린다(Herdr가 1초 안에 다시 읽는다).
$keysPath = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'keys.json'
if (Test-Path -LiteralPath $keysPath) {
  $raw = [IO.File]::ReadAllText($keysPath, [Text.Encoding]::UTF8)
  $changed = $false
  foreach ($k in @(@{ key = 'ctrl-shift-g'; action = 'mod.open:file-viewer' }, @{ key = 'ctrl-shift-y'; action = 'mod.open:path-picker' })) {
    $m = [regex]::Match($raw, '"' + $k.key + '"\s*:\s*"([^"]*)"')
    if ($m.Success) {
      if ($m.Groups[1].Value -eq $k.action) { Write-Host "단축키 있음: $($k.key) → $($k.action)" }
      else { Write-Host "단축키 $($k.key)가 이미 '$($m.Groups[1].Value)'에 쓰이고 있어 넣지 않았습니다. keys.json에서 다른 키로 $($k.action)을 거세요." -ForegroundColor Yellow }
    } elseif ($raw -match '"global"\s*:\s*\{') {
      $raw = [regex]::Replace($raw, '("global"\s*:\s*\{)', ('$1' + "`n    `"$($k.key)`": `"$($k.action)`","), 1)
      $changed = $true; Write-Host "단축키 넣음: $($k.key) → $($k.action)"
    } else { Write-Host "keys.json에 global 섹션이 없어 $($k.key)를 넣지 못했습니다." -ForegroundColor Yellow }
  }
  if ($changed) { [IO.File]::WriteAllText($keysPath, $raw, (New-Object Text.UTF8Encoding $false)) }
} else { Write-Host "keys.json이 없습니다($keysPath). Herdr를 한 번 실행한 뒤 다시 돌리세요." -ForegroundColor Yellow }

# 2. 도구 확인
function Find-Tool($name, $extra) {
  $c = Get-Command $name -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  foreach ($p in $extra) { if ($p -and (Test-Path -LiteralPath $p)) { return $p } }
  return $null
}
$tools = @(
  @{ name = 'ffmpeg';  why = '그림·영상 장면, 정보';  winget = 'Gyan.FFmpeg' },
  @{ name = 'ffprobe'; why = '영상·소리 정보';        winget = 'Gyan.FFmpeg' },
  @{ name = 'ffplay';  why = '소리 재생, A/B 비교';    winget = 'Gyan.FFmpeg' },
  @{ name = 'mpv';     why = '영상 재생(장면 자리 창)'; winget = 'shinchiro.mpv'; extra = @("$env:ProgramFiles\MPV Player\mpv.exe", "$env:ProgramFiles\mpv\mpv.exe", "$env:USERPROFILE\scoop\apps\mpv\current\mpv.exe") },
  @{ name = 'node';    why = '목록·복사·캐시 정리';    winget = 'OpenJS.NodeJS.LTS' },
  @{ name = 'git';     why = 'git 표시·변경, 프로젝트 루트'; winget = 'Git.Git' },
  @{ name = 'ssh';     why = '다른 머신 파일(sftp 키 확인)'; winget = 'Microsoft.OpenSSH.Beta' },
  @{ name = 'scp';     why = '다른 머신 파일 가져오기';  winget = 'Microsoft.OpenSSH.Beta' },
  @{ name = 'mmdc';    why = 'Mermaid 다이어그램';     npm = '@mermaid-js/mermaid-cli' }
)
$missing = @()
foreach ($t in $tools) {
  $at = Find-Tool $t.name $t.extra
  if ($at) { Write-Host ("  있음  {0,-8} {1}" -f $t.name, $at) }
  else { Write-Host ("  없음  {0,-8} ({1})" -f $t.name, $t.why) -ForegroundColor Yellow; $missing += $t }
}
if (-not $missing) { Write-Host '필요한 도구가 모두 있습니다.'; return }

foreach ($t in ($missing | Sort-Object { $_.winget + $_.npm } -Unique)) {
  if ($t.winget) { $cmd = "winget install -e --id $($t.winget) --accept-package-agreements --accept-source-agreements" }
  else { $cmd = "`$env:PUPPETEER_SKIP_DOWNLOAD='1'; npm i -g $($t.npm)   # 브라우저는 그 PC의 Chrome·Edge·Chromium을 찾아 쓴다" }
  if ($Install) { Write-Host "설치: $cmd"; Invoke-Expression $cmd }
  else { Write-Host "  설치하려면: $cmd" }
}
if (-not $Install) { Write-Host '-Install을 붙여 다시 실행하면 위 명령을 직접 실행합니다.' }
