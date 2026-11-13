# herdr-env 설치 안내 (Claude Code용)

사용자가 이 저장소로 "Herdr 환경을 설치해줘", "다시 설치해줘", "최신으로 받아줘"라고 하면 아래 순서를 따른다. 설명은 한국어로 한다.

## 1. 저장소 받기
- 이미 받아 둔 곳이 있으면(`~/herdr-env` 등) 그 폴더에서 `git pull`, 없으면 `git clone https://github.com/csm-kr/herdr-env.git ~/herdr-env`.

## 2. 먼저 확인
- **OS**: 모드 설치(`install.ps1`)는 Windows 전용이다. macOS면 `skills/herdr-shortcuts`만 `~/.claude/skills/`로 복사하고, 모드는 아직 Windows만 된다고 알린다.
- **Herdr 설정 폴더**: `~/.config/herdr-app`이 없으면 Herdr를 한 번 실행해 달라고 하고 멈춘다.
- **덮어쓸 파일**: `~/.config/herdr-app/mods/file-viewer`, `path-picker`가 이미 있으면 저장소 것과 비교한다(`gpui-kit.d.ts`는 빼고). 사용자가 직접 고친 흔적이 있으면 덮어쓰기 전에 묻는다.

## 3. 설치
저장소 폴더에서:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -Install
```

- 모드 두 개를 `~\.config\herdr-app\mods`로, 스킬을 `~\.claude\skills`로 복사한다.
- `herdrview:` 링크를 등록하고, 단축키 Ctrl+Shift+G·Y를 넣는다.
- 빠진 도구(ffmpeg, mpv, node, git, ssh, mermaid-cli)를 winget·npm으로 설치한다. winget이 동의나 권한 창을 띄우면 사용자에게 허용해 달라고 한다.
- 단축키가 다른 동작에 이미 쓰이고 있다는 노란 줄이 나오면, 무엇과 겹치는지 사용자에게 알리고 다른 키를 고르게 한다(`herdr-shortcuts` 스킬 절차).

## 4. 확인
- `~/.config/herdr-app/keys.error`가 없어야 한다.
- `herdr-app status`의 `errors`가 비어 있어야 한다.
- 각 모드 폴더에서 `herdr-app check .`가 통과해야 한다.
- `mods/file-viewer`와 `mods/path-picker`에서 `node --test test/*.mjs`가 모두 통과해야 한다.
- 레지스트리 `HKCU:\Software\Classes\herdrview\shell\open\command`가 설치된 `herdr-link.js`를 가리켜야 한다.

Herdr 안에서 탭을 열거나 단축키를 대신 눌러 보지 않는다. `tab.new` 같은 명령은 사용자가 보던 화면을 빼앗는다. 마지막에 사용자에게 Herdr 터미널에서 Ctrl+Shift+G와 Ctrl+Shift+Y를 눌러 봐 달라고 한다.

## 5. 다른 머신(선택)
`hc machine`으로 연결한 리눅스 머신의 영상·그림은 이 PC의 ffmpeg·mpv가 sftp로 읽는다. 그래서 `~/.ssh` 기본 키로 비밀번호 없이 접속돼야 한다. 사용자가 원격 파일도 볼 거라면 `ssh -o BatchMode=yes <머신> true`로 확인하고, 안 되면 키 설정을 안내한다.

## 6. 보고
설치한 것, 새로 설치한 도구, 건너뛴 것(이유), 확인 결과를 짧게 알린다.

## 저장소를 고칠 때
- 모드의 순수 로직은 `kind.js`에 두고 테스트를 먼저 쓴다(`node --test test/*.mjs`). 화면과 프로세스 처리는 `main.js`에 둔다.
- 고친 뒤 `herdr-app check .`로 검사한다.
- 이 저장소는 공개다. 테스트나 문서에 실제 IP, 사용자 이름, 프로젝트 이름을 넣지 않고 예시 값(`192.168.0.10`, `/home/me`)을 쓴다.
