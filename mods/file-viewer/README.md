# file-viewer (Herdr 모드)

Herdr 안에서 파일을 바로 보는 미리보기 탭. 왼쪽은 폴더 트리, 오른쪽은 미리보기이고, 둘은 한 탭 안에서 같이 움직인다.
이 PC의 파일과 다른 머신(`hc machine`)의 파일을 모두 연다. 원격 영상과 소리는 받지 않고 sftp로 바로 읽는다.

## 여는 법
- **Ctrl+Shift+G**: 지금 탭 바로 오른쪽에 미리보기 탭을 열고 그리로 간다. 미리보기 탭에서 다시 누르면 원래 탭으로 돌아간다.
- **경로 복사 → Ctrl+Shift+G**: `/절대경로#t=77` 한 줄을 복사해 두고 누르면 그 파일을 그 시각으로 연다. 두 줄이면 A/B 비교다. 화면 폭에서 꺾여 두 줄로 복사된 경로는 이어 붙인다.
- **링크 Ctrl+클릭**: `[이름](herdrview://<머신>/<절대경로>#t=초)` 형식의 마크다운 링크. 머신 칸이 비면 이 PC이고, `/`로 시작하는 경로면 연결된 머신에서 찾는다. 공백과 한글은 %인코딩한다.
  - 예: `[takes-so-far.mp4 1:17](herdrview://192.168.0.10/home/me/ep2/takes-so-far.mp4#t=77)`

- **경로 열기 Ctrl+Shift+Y** (`mods/path-picker`): 지금 터미널 화면에서 절대·상대 경로를 모두 찾아 목록으로 보여 준다. 에이전트 종류와 상관없이 쓸 수 있다. 상대 경로는 그 터미널 폴더 아래에서 찾고, 여럿이면 가장 최근 것을 연다. `~/`는 그 머신의 홈으로 펼친다.
- 복사 → Ctrl+Shift+G도 상대 경로(`output/html/detail-page.html`)를 같은 방식으로 연다.
- 위쪽 `⌂ 프로젝트 루트` / `↩ 원래 폴더`: git 저장소 맨 위와 원래 폴더를 오간다. 저장소가 아니면 Ctrl+Shift+G로 연 폴더가 루트다.

## 보이는 것
그림(움직이는 GIF·WebP·APNG는 Chrome으로 프레임을 풀어 움직인다, `anim-frames.js`), 영상(▶를 누르면 장면 자리에 mpv 창이 붙어서 튼다), 소리(재생 막대), 마크다운, HTML(이 PC의 파일은 Chrome·Edge로 그린 실제 모습), Mermaid(`.mmd`와 `.md` 속 ```mermaid 블록), CSV·TSV 표, PDF(쪽 그림을 5쪽씩 그려 20쪽까지 먼저, "다음 쪽 그리기"로 더, 확대·축소, "글 보기"와 Ctrl+F는 뽑은 글로), 코드(고치고 Ctrl+S로 저장), Ctrl+F 찾기, 로그 따라가기, git 변경(diff), 경로 복사, 트리 너비 끌기.

## 트리 우클릭
- **다운로드 폴더로 받기**: 이 PC의 다운로드 폴더(옮겨 두었으면 그 자리)로 받는다. 다른 머신의 파일·폴더는 scp로 받는다. 같은 이름이 있으면 `이름 (1)`로 받는다.
- **다운로드 폴더 열기**: 탐색기로 다운로드 폴더를 연다.
- **경로 복사**, 파일은 **기본 앱으로 열기**, 폴더는 **이 폴더를 루트로**. 바깥을 누르거나 Esc를 누르면 닫힌다.

## 영상 재생
- 장면을 누르면 그 자리에 테두리 없는 mpv 창을 붙인다. 이 창은 Herdr 창에 딸린 창이라 Herdr를 옮기면 따라가고, 최소화하거나 다른 프로그램이 덮으면 같이 가려지며, 작업 표시줄에 따로 나오지 않는다.
- 붙여 두는 일은 `mpv-dock.ps1`(숨은 PowerShell)이 한다. 뷰어가 `data/file-viewer/dock.txt`에 놓일 자리("x y w h 보임")를 0.1초마다 바뀔 때만 쓰고, 도우미가 15ms마다 읽어 옮긴다. 다른 탭으로 가면 숨기고 멈춘다(mpv 파이프).
- 트리 너비를 끌거나 창 크기를 바꾸면, 누른 순간의 장면 자리에서 바뀐 만큼 옮긴다(`dockRect`).
- Herdr는 DirectComposition으로 그려서 자식 창(SetParent)으로 넣으면 화면 아래에 깔릴 수 있어 딸린 창을 쓴다.
- 명령으로 틀 때(`herdr-app do file-viewer.play`)는 장면 자리를 몰라 화면 가운데 보통 mpv 창으로 튼다. A/B 비교는 ffplay.

## macOS에서 다른 점
- 설치는 저장소 맨 위의 `./install.sh --install`로 한다(모드 복사, 단축키, 도구).
- PowerShell 대신 `sh`·`node`·`open`·`kill`을 쓴다. `main.js`의 `WIN()`으로 가른다.
- 영상은 장면 자리에 붙지 않고 화면 가운데 보통 mpv 창으로 뜬다(붙이기 도우미 `mpv-dock.ps1`이 Windows 전용). mpv가 없으면 ffplay 창.
- `herdrview:` 링크 등록은 아직 없다. 경로 복사 → Ctrl+Shift+G와 Ctrl+Shift+Y는 된다.
- 확대·축소는 Ctrl+휠과 Cmd+휠 모두 된다. 저장은 Cmd+S, 찾기는 Cmd+F도 된다.
- 다운로드 폴더는 `~/Downloads`다. 처음 받을 때 macOS가 폴더 접근을 허용할지 물을 수 있다.
- 필요한 도구: `brew install ffmpeg mpv poppler node`, `PUPPETEER_SKIP_DOWNLOAD=1 npm i -g @mermaid-js/mermaid-cli`.

## 새 PC에서 준비 (Windows)
```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -Install
```
- `herdrview:` 주소를 현재 사용자로 등록한다. 링크 처리기는 `herdr-link.js`이고 UTF-16으로 저장돼 있다. Windows 스크립트 엔진이 UTF-8 한글을 CP949로 잘못 읽기 때문이다.
- 필요한 도구: ffmpeg·ffprobe·ffplay(`Gyan.FFmpeg`, sftp가 되는 full 빌드), mpv(`shinchiro.mpv`), Poppler(`oschwartz10612.Poppler`, PDF), node, mermaid-cli(`npm i -g @mermaid-js/mermaid-cli`). mermaid-cli는 그 PC의 Chrome·Edge·Chromium을 찾아 쓴다.
- `mods\path-picker` 폴더도 같이 복사한다. `install.ps1`이 단축키 Ctrl+Shift+G(미리보기)와 Ctrl+Shift+Y(경로 열기)를 넣는다. 다른 동작에 이미 쓰이는 키는 덮어쓰지 않고 알려 준다.
- 원격 영상·그림은 ffmpeg·mpv가 sftp로 직접 읽는다. 그래서 `~/.ssh` 기본 키로 비밀번호 없이 접속돼야 한다. `hc`가 되어도 키 조건이 다르면 영상만 안 될 수 있다.
- 원격 머신에 필요한 것: `sh`, `find`(GNU), `test`, `head`, `tail`, `git`. stat은 GNU와 BSD 모두 된다.

## 개발
- 순수 로직은 `kind.js`에 두고, 테스트는 `node --test test/*.mjs`로 돌린다. 화면과 프로세스 처리는 `main.js`에 있다.
- 모드를 고친 뒤 `herdr-app check .`로 검사한다. 앱 안에서 시험하려면 `herdr-app do file-viewer.play`를 보내면 지금 영상을 튼다. 붙이기 도우미는 `-Owner <창 핸들>`로 다른 창에 붙여 따로 시험할 수 있다. 붙인 자리는 `data/file-viewer/debug.log`에 남는다.
- 캐시는 `~/.config/herdr-app/cache/file-viewer`에 쌓인다. 하루 한 번, 3일 넘은 파일과 500MB를 넘는 부분을 지운다.
