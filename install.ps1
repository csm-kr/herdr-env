# herdr-env 설치 (Windows). 여러 번 돌려도 된다.
#   powershell -ExecutionPolicy Bypass -File install.ps1            # 복사 + 등록 + 빠진 도구 알려 주기
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Install   # 빠진 도구까지 winget/npm으로 설치
# 하는 일
#   1. mods\file-viewer, mods\path-picker를 ~\.config\herdr-app\mods 로 복사한다(같은 파일은 덮어쓴다).
#   2. keys.ps1로 내 단축키(Ctrl+Shift+↑↓ 스페이스 전환, Q 스페이스 닫기, G·Y 모드, L 빼기)를 맞춘다.
#   3. file-viewer\install.ps1을 돌린다: herdrview: 링크 등록, 단축키 Ctrl+Shift+G·Y, 도구 확인.
#   4. skills\herdr-shortcuts를 ~\.claude\skills 로 복사한다.
param([switch]$Install)
$ErrorActionPreference = 'Stop'

$mods = Join-Path $env:USERPROFILE '.config\herdr-app\mods'
if (-not (Test-Path -LiteralPath $mods)) { throw "Herdr 설정 폴더가 없습니다($mods). Herdr를 한 번 실행한 뒤 다시 돌리세요." }
foreach ($m in 'file-viewer', 'path-picker') {
  Copy-Item -Recurse -Force -LiteralPath (Join-Path $PSScriptRoot "mods\$m") -Destination $mods
  Write-Host "모드 복사: $m → $mods\$m"
}

& (Join-Path $PSScriptRoot 'keys.ps1')
& (Join-Path $mods 'file-viewer\install.ps1') -Install:$Install

$skills = Join-Path $env:USERPROFILE '.claude\skills'
New-Item -ItemType Directory -Force -Path $skills | Out-Null
Copy-Item -Recurse -Force -LiteralPath (Join-Path $PSScriptRoot 'skills\herdr-shortcuts') -Destination $skills
Write-Host "스킬 복사: herdr-shortcuts → $skills\herdr-shortcuts"
Write-Host '끝. Herdr는 모드와 단축키를 1초 안에 다시 읽습니다. Claude Code는 새 세션부터 스킬을 씁니다.'
