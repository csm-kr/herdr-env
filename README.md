# herdr-env

[Herdr 앱](https://herdr.dev)을 쓰는 데 필요한 내 환경을 한곳에 모았습니다. 새 PC에 옮길 때 이 저장소 하나만 받으면 됩니다.

```
herdr-env/
├── skills/
│   └── herdr-shortcuts/     # Claude Code 스킬: 단축키 보기·바꾸기·검증, 내 단축키 목록(Windows·macOS)
└── mods/
    ├── file-viewer/         # 미리보기 탭: 왼쪽 폴더 트리 + 오른쪽 미리보기 (Ctrl+Shift+G)
    └── path-picker/         # 경로 열기: 터미널 화면의 경로를 골라 미리보기로 연다 (Ctrl+Shift+Y)
```

## Claude Code로 세팅하기 (권장)

1. [Herdr](https://herdr.dev)와 [Claude Code](https://claude.com/claude-code)를 설치하고, Herdr를 한 번 실행해 둡니다(설정 폴더가 생깁니다).
2. 아무 폴더에서 Claude Code를 열고 아래 문장을 그대로 붙여 넣습니다.

   > https://github.com/csm-kr/herdr-env 를 받아서 저장소의 CLAUDE.md 순서대로 Herdr 환경을 설치해줘.

3. Claude Code가 저장소를 받고, `install.ps1 -Install`로 모드·내 단축키·스킬·도구를 설치한 뒤 제대로 됐는지 확인합니다. winget 설치 중에 권한 확인 창이 뜨면 허용합니다.
4. 끝나면 Herdr 터미널에서 **Ctrl+Shift+G**(미리보기 탭), **Ctrl+Shift+Y**(경로 열기)를 눌러 봅니다. 단축키 스킬은 Claude Code를 새로 열면 잡힙니다.

업데이트도 같은 방법으로 합니다: "herdr-env를 최신으로 받아서 다시 설치해줘".

**Mac**에서도 같은 문장을 쓰면 됩니다. Mac에서는 Claude Code가 이렇게 합니다.
- 단축키 스킬을 설치합니다.
- [Mac용 단축키 목록](skills/herdr-shortcuts/references/csm-kr-preset-mac.md)대로 `keys.json`을 맞춥니다. Ctrl+Shift·Alt 키 17개를 넣고 Cmd+Shift+L·W를 뺍니다.
- `option_as_alt`를 켭니다.

미리보기·경로 열기 모드는 아직 Windows에서만 됩니다.

Claude Code가 하는 순서는 [CLAUDE.md](CLAUDE.md)에 적어 두었습니다.

## file-viewer

Herdr 안에서 VS Code를 열지 않고 파일을 바로 보는 미리보기 탭입니다. 이 PC의 파일과 `hc machine`으로 연결한 다른 머신(ssh)의 파일을 모두 엽니다.

- 그림(확대·축소, 움직이는 GIF·WebP), 영상(장면 자리에 붙는 mpv 창), 소리(재생 막대), 마크다운, Mermaid, HTML(Chrome·Edge로 그린 실제 모습), CSV 표, PDF(쪽 그림·확대·글 찾기), 코드 편집·저장
- Ctrl+F 찾기, 로그 따라가기, git 변경(diff), 경로 복사, 프로젝트 루트 오가기, 트리 너비 끌기
- 트리 우클릭: 다운로드 폴더로 받기(다른 머신은 scp), 다운로드 폴더 열기, 경로 복사, 기본 앱으로 열기
- `herdrview://` 링크를 Ctrl+클릭하면 그 파일을 그 시각으로 엽니다.

자세한 내용은 [mods/file-viewer/README.md](mods/file-viewer/README.md)를 봅니다.

## path-picker

터미널 화면에서 절대·상대 경로를 모두 찾아 목록으로 보여 주고, 고르면 file-viewer로 엽니다. 어떤 에이전트(Claude Code, Codex 등)가 찍은 경로든 됩니다. 화면 폭에서 꺾여 두 줄이 된 경로도 이어 붙입니다.

## 직접 설치 (Windows)

Herdr를 한 번 실행해 둔 뒤, PowerShell에서:

```powershell
git clone https://github.com/csm-kr/herdr-env.git
cd herdr-env
powershell -ExecutionPolicy Bypass -File install.ps1 -Install
```

`install.ps1`이 모드 두 개를 `~\.config\herdr-app\mods`로, 스킬을 `~\.claude\skills`로 복사하고 `mods\file-viewer\install.ps1`(링크 등록·단축키·도구)을 돌립니다. 여러 번 돌려도 되고, 업데이트할 때는 `git pull` 뒤 다시 돌리면 됩니다.

- `install.ps1`은 ffmpeg·ffprobe·ffplay(`Gyan.FFmpeg`), mpv(`shinchiro.mpv`), Poppler(PDF), node, git, ssh, mermaid-cli를 확인하고 `-Install`이면 winget·npm으로 설치합니다.
- 단축키는 `keys.ps1`이 맞춥니다. Ctrl+Shift+↑/↓(스페이스 전환), Ctrl+Shift+Q(스페이스 닫기), Ctrl+Shift+G·Y(모드)를 넣고 Ctrl+Shift+L(레이아웃 전환)을 뺍니다. `keys.json`을 통째로 덮지 않고 그 줄만 고치며, 다른 동작에 이미 쓰이는 키는 그대로 두고 알려 줍니다.
- Herdr 설정(`settings.json`)과 레이아웃은 기본값을 쓰므로 저장소에 넣지 않았습니다.
- 다른 머신의 영상·그림은 ffmpeg·mpv가 sftp로 읽습니다. 그래서 `~/.ssh` 기본 키로 비밀번호 없이 접속돼야 합니다.
- `gpui-kit.d.ts`(모드 API 설명)는 Herdr가 모드 폴더에 만들어 주므로 저장소에 넣지 않았습니다.

## 개발

```bash
cd mods/file-viewer && node --test test/*.mjs   # 순수 로직(kind.js) 테스트
herdr-app check .                              # 모드 검사
```

확인한 환경: herdr-app 0.1.15, Windows 11. 스킬은 macOS도 지원합니다.
