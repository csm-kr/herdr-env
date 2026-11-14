#!/bin/bash
# herdr-env 설치 (macOS). 여러 번 돌려도 된다. Windows는 install.ps1을 쓴다.
#   ./install.sh             # 복사 + 단축키 + 빠진 도구 알려 주기
#   ./install.sh --install   # 빠진 도구까지 brew/npm으로 설치
# 하는 일
#   1. mods/file-viewer, mods/path-picker를 ~/.config/herdr-app/mods 로 복사한다(같은 파일은 덮어쓴다).
#   2. 미리보기에 쓰는 도구(ffmpeg·ffprobe·ffplay, mpv, node, git, ssh·scp, mermaid-cli, Poppler)가 있는지 본다.
#   3. keys-mac.mjs로 내 단축키(Ctrl+Shift·Option 키 19개 넣기, Cmd+Shift+L·W 빼기)와 option_as_alt를 맞춘다.
#   4. skills/herdr-shortcuts를 ~/.claude/skills 로 복사한다.
# herdrview: 링크 등록과 장면 자리에 붙는 mpv 창은 아직 Windows에서만 된다.
set -euo pipefail

install=0
[ "${1:-}" = "--install" ] && install=1
here="$(cd "$(dirname "$0")" && pwd)"
app="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }

if [ "$(uname)" != "Darwin" ]; then echo "이 스크립트는 macOS용입니다. Windows는 install.ps1을 쓰세요." >&2; exit 1; fi
if [ ! -d "$app/mods" ]; then echo "Herdr 설정 폴더가 없습니다($app/mods). Herdr를 한 번 실행한 뒤 다시 돌리세요." >&2; exit 1; fi

# 1. 모드 복사
for m in file-viewer path-picker; do
  cp -R "$here/mods/$m" "$app/mods/"
  echo "모드 복사: $m → $app/mods/$m"
done

# 2. 도구 확인. 빠진 도구의 설치 명령을 모은다(같은 명령은 한 번만).
cmds=()
need() {  # 이름, 쓰임, 설치 명령
  if command -v "$1" >/dev/null 2>&1; then printf '  있음  %-8s %s\n' "$1" "$(command -v "$1")"; return; fi
  yellow "$(printf '  없음  %-8s (%s)' "$1" "$2")"
  for c in ${cmds[@]+"${cmds[@]}"}; do [ "$c" = "$3" ] && return; done
  cmds+=("$3")
}
need ffmpeg   '그림·영상 장면, 정보'          'brew install ffmpeg'
need ffprobe  '영상·소리 정보'                'brew install ffmpeg'
need ffplay   '소리 재생, A/B 비교'           'brew install ffmpeg'
need mpv      '영상 재생'                     'brew install mpv'
need node     '목록·복사·캐시 정리, 단축키'   'brew install node'
need git      'git 표시·변경, 프로젝트 루트'  'xcode-select --install'
need ssh      '다른 머신 파일(sftp 키 확인)'  'xcode-select --install'
need scp      '다른 머신 파일 가져오기'       'xcode-select --install'
need mmdc     'Mermaid·HTML·움직이는 그림'    'PUPPETEER_SKIP_DOWNLOAD=1 npm i -g @mermaid-js/mermaid-cli'
need pdftoppm 'PDF 쪽 그림·글(Poppler)'       'brew install poppler'

if [ ${#cmds[@]} -eq 0 ]; then echo '필요한 도구가 모두 있습니다.'
else
  for c in "${cmds[@]}"; do
    # xcode-select는 창을 띄워 사용자가 눌러야 하므로 직접 돌리지 않는다.
    if [ "$install" = 1 ] && [ "$c" != 'xcode-select --install' ]; then
      if [ "${c#brew }" != "$c" ] && ! command -v brew >/dev/null 2>&1; then yellow "  Homebrew가 없어 설치하지 못했습니다: $c  (https://brew.sh)"; continue; fi
      echo "설치: $c"; bash -c "$c"
    else echo "  설치하려면: $c"; fi
  done
  [ "$install" = 1 ] || echo '--install을 붙여 다시 실행하면 위 명령을 직접 실행합니다.'
fi
# mermaid-cli는 그 Mac의 Chrome·Edge·Chromium을 찾아 쓴다(PUPPETEER_SKIP_DOWNLOAD로 따로 받지 않는다).

# 3. 단축키와 option_as_alt
if command -v node >/dev/null 2>&1; then node "$here/keys-mac.mjs" "$app"
else yellow 'node가 없어 단축키를 맞추지 못했습니다. node를 설치한 뒤 다시 돌리세요.'; fi

# 4. 스킬 복사
skills="$HOME/.claude/skills"
mkdir -p "$skills"
cp -R "$here/skills/herdr-shortcuts" "$skills/"
echo "스킬 복사: herdr-shortcuts → $skills/herdr-shortcuts"
echo '끝. Herdr는 모드와 단축키를 1초 안에 다시 읽습니다. Claude Code는 새 세션부터 스킬을 씁니다.'
