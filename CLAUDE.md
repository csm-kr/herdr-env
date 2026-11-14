# herdr-env 설치 안내 (Claude Code용)

사용자가 이 저장소로 "Herdr 환경을 설치해줘", "다시 설치해줘", "최신으로 받아줘"라고 하면 아래 순서를 따른다. 설명은 한국어로 한다.

## 1. 저장소 받기
- 이미 받아 둔 곳이 있으면(`~/herdr-env` 등) 그 폴더에서 `git pull`, 없으면 `git clone https://github.com/csm-kr/herdr-env.git ~/herdr-env`.

## 2. 먼저 확인
- **OS를 스스로 알아낸다. 사용자에게 묻지 않는다.** `uname -s`를 돌린다.

  | `uname -s` 결과 | OS | 3번에서 돌릴 것 |
  |---|---|---|
  | `Darwin` | macOS | `./install.sh --install` |
  | `MINGW…`, `MSYS…`, `CYGWIN…`, 또는 `uname`이 없음(PowerShell) | Windows | `powershell -ExecutionPolicy Bypass -File install.ps1 -Install` |
  | `Linux` | 리눅스 | 설치 스크립트가 없다. 아직 지원하지 않는다고 알리고 멈춘다 |

- **Herdr 설정 폴더**: `~/.config/herdr-app`이 없으면 Herdr를 한 번 실행해 달라고 하고 멈춘다.
- **덮어쓸 파일**: `~/.config/herdr-app/mods/file-viewer`, `path-picker`가 이미 있으면 저장소 것과 비교한다(`gpui-kit.d.ts`는 빼고). 사용자가 직접 고친 흔적이 있으면 덮어쓰기 전에 묻는다.

## 3. 설치
저장소 폴더에서, 2번에서 알아낸 OS의 명령 하나를 돌린다. 두 스크립트는 같은 일을 한다.

| 하는 일 | Windows (`install.ps1 -Install`) | macOS (`install.sh --install`) |
|---|---|---|
| 모드 두 개 복사 | `~\.config\herdr-app\mods` | `~/.config/herdr-app/mods` |
| 스킬 복사 | `~\.claude\skills` | `~/.claude/skills` |
| 내 단축키 | `keys.ps1` (Ctrl+Shift+↑↓·Q·G·Y 넣기, L 빼기) | `keys-mac.mjs` (`references/csm-kr-preset-mac.md`의 19개 넣기, `cmd-shift-l`·`cmd-shift-w` 빼기, `option_as_alt`를 `"on"`으로) |
| 빠진 도구 설치 | winget·npm (ffmpeg, mpv, node, git, ssh, mermaid-cli, Poppler) | brew·npm (ffmpeg, mpv, node, mermaid-cli, Poppler) |
| `herdrview:` 링크 등록 | 한다 | 아직 안 한다 |

- 단축키는 파일을 통째로 덮지 않고 그 줄만 고친다. 다른 동작에 이미 쓰이고 있다는 노란 줄이 나오면, 무엇과 겹치는지 사용자에게 알리고 다른 키를 고르게 한다(`herdr-shortcuts` 스킬 절차).
- Windows: winget이 동의나 권한 창을 띄우면 사용자에게 허용해 달라고 한다.
- macOS: git·ssh·scp가 없으면 `xcode-select --install`을 안내만 하니 사용자에게 알린다. Homebrew가 없으면 brew로 넣는 도구는 건너뛰고 알려 준다.

## 4. 확인
두 OS 모두:
- 2초 기다린 뒤 `~/.config/herdr-app/keys.error`가 없어야 한다.
- `herdr-app status`의 `errors`가 비어 있어야 한다.
- `~/.config/herdr-app/mods/file-viewer`와 `path-picker`에서 `herdr-app check .`가 통과해야 한다.
- 저장소의 `mods/file-viewer`와 `mods/path-picker`에서 `node --test test/*.mjs`가 모두 통과해야 한다.

OS마다:
- Windows: 레지스트리 `HKCU:\Software\Classes\herdrview\shell\open\command`가 설치된 `herdr-link.js`를 가리켜야 한다.
- macOS: 저장소 맨 위에서도 `node --test test/*.mjs`(`keys-mac.mjs` 테스트)가 통과해야 한다. Mac에서 아직 안 되는 것을 알린다: 영상은 장면 자리에 붙지 않고 보통 mpv 창으로 뜬다. `herdrview:` 링크는 등록하지 않는다.

Herdr 안에서 탭을 열거나 단축키를 대신 눌러 보지 않는다. `tab.new` 같은 명령은 사용자가 보던 화면을 빼앗는다. 마지막에 사용자에게 Herdr 터미널에서 Ctrl+Shift+G와 Ctrl+Shift+Y를 눌러 봐 달라고 한다.

## 5. 다른 머신(선택)
`hc machine`으로 연결한 리눅스 머신의 영상·그림은 이 PC의 ffmpeg·mpv가 sftp로 읽는다. 그래서 `~/.ssh` 기본 키로 비밀번호 없이 접속돼야 한다. 사용자가 원격 파일도 볼 거라면 `ssh -o BatchMode=yes <머신> true`로 확인하고, 안 되면 키 설정을 안내한다.

## 6. 보고
설치한 것, 새로 설치한 도구, 건너뛴 것(이유), 확인 결과를 짧게 알린다.

## 저장소를 고칠 때
- 모드의 순수 로직은 `kind.js`에 두고 테스트를 먼저 쓴다(`node --test test/*.mjs`). 화면과 프로세스 처리는 `main.js`에 둔다.
- 고친 뒤 `herdr-app check .`로 검사한다.
- OS마다 다른 일(PowerShell·sh, 경로 표기, 창 띄우기)은 `main.js`의 `WIN()`으로 가른다. 한쪽 OS만 고칠 때 다른 쪽 가지는 건드리지 않는다.
- 이 저장소는 공개다. 테스트나 문서에 실제 IP, 사용자 이름, 프로젝트 이름을 넣지 않고 예시 값(`192.168.0.10`, `/home/me`)을 쓴다.
