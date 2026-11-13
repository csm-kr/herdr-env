# 내 Herdr 단축키(skills/herdr-shortcuts/references/csm-kr-preset.md)를 keys.json에 맞춘다. 여러 번 돌려도 된다.
#   powershell -ExecutionPolicy Bypass -File keys.ps1 [-KeysPath <keys.json>]
# 파일을 통째로 덮어쓰지 않고 해당 줄만 넣고 뺀다(통째로 덮으면 그 PC 버전의 새 기본 단축키가 사라진다).
# 이미 다른 동작에 쓰이는 키는 덮어쓰지 않고 알린다. Herdr는 저장하면 1초 안에 다시 읽는다.
param([string]$KeysPath = (Join-Path $env:USERPROFILE '.config\herdr-app\keys.json'))
$ErrorActionPreference = 'Stop'

# 넣을 키 → 동작 (global 섹션)
$add = [ordered]@{
  'ctrl-shift-up'   = 'space.prev'            # 위(이전) 스페이스
  'ctrl-shift-down' = 'space.next'            # 아래(다음) 스페이스
  'ctrl-shift-q'    = 'space.close'           # 스페이스 닫기(확인 창이 뜬다)
  'ctrl-shift-g'    = 'mod.open:file-viewer'  # 미리보기 탭
  'ctrl-shift-y'    = 'mod.open:path-picker'  # 경로 열기
}
# 뺄 키: 이 동작에 묶여 있을 때만 뺀다
$remove = @{ 'ctrl-shift-l' = 'layout.switch' }

if (-not (Test-Path -LiteralPath $KeysPath)) { throw "keys.json이 없습니다($KeysPath). Herdr를 한 번 실행한 뒤 다시 돌리세요." }
$raw = [IO.File]::ReadAllText($KeysPath, [Text.Encoding]::UTF8)
$orig = $raw

foreach ($k in $add.Keys) {
  $want = $add[$k]
  $m = [regex]::Match($raw, '"' + [regex]::Escape($k) + '"\s*:\s*"([^"]*)"')
  if ($m.Success) {
    if ($m.Groups[1].Value -eq $want) { Write-Host "단축키 있음: $k → $want" }
    else { Write-Host "단축키 $k 는 이미 '$($m.Groups[1].Value)'에 쓰이고 있어 그대로 둡니다. $want 은 다른 키로 거세요." -ForegroundColor Yellow }
  } elseif ($raw -match '"global"\s*:\s*\{') {
    $raw = [regex]::Replace($raw, '("global"\s*:\s*\{)', ('$1' + "`n    `"$k`": `"$want`","), 1)
    Write-Host "단축키 넣음: $k → $want"
  } else { Write-Host "keys.json에 global 섹션이 없어 $k 를 넣지 못했습니다." -ForegroundColor Yellow }
}

foreach ($k in $remove.Keys) {
  $pat = '"' + [regex]::Escape($k) + '"\s*:\s*"' + [regex]::Escape($remove[$k]) + '"'
  if ($raw -match ('[ \t]*' + $pat + '\s*,[ \t]*\r?\n')) { $raw = [regex]::Replace($raw, '[ \t]*' + $pat + '\s*,[ \t]*\r?\n', '', 1) }
  elseif ($raw -match (',\s*' + $pat)) { $raw = [regex]::Replace($raw, ',(\s*)' + $pat, '', 1) }   # 섹션의 마지막 줄
  else { continue }
  Write-Host "단축키 뺌: $k ($($remove[$k]))"
}

if ($raw -eq $orig) { Write-Host 'keys.json: 바꿀 것 없음'; return }
try { $null = $raw | ConvertFrom-Json } catch { throw "고친 keys.json이 올바른 JSON이 아니라 저장하지 않았습니다: $_" }
[IO.File]::WriteAllText($KeysPath, $raw, (New-Object Text.UTF8Encoding $false))
Write-Host "keys.json 저장: $KeysPath"
