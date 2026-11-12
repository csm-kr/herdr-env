---
name: herdr-shortcuts
description: Windows와 macOS에서 Herdr 앱(herdr-app)의 단축키를 보여 주거나 바꿀 때 쓴다. "herdr 단축키 보자", "이 키 뭐 하는 거야", "Ctrl+Shift+↑에 스페이스 전환 걸어줘", "이 단축키 없애줘", "스페이스 닫는 키는?", "keys.json 고쳐줘", "새 PC에 내 herdr 키 설정 맞춰줘" 같은 요청이면 herdr라는 말만 나와도 이 스킬을 쓴다. keys.json을 읽어 표로 정리하고, 키 충돌을 확인한 뒤 추가·삭제하고, keys.error와 herdr-app status로 적용 여부를 검증하는 절차다.
---

# Herdr 단축키 (Windows, macOS)

Herdr 앱은 단축키를 파일 하나로 정한다. 그 파일을 읽어 보여 주고, 고치고, 제대로 적용됐는지 확인하는 것이 이 스킬의 전부다.

**먼저 OS를 본다.** Windows와 macOS는 기본 단축키가 다르다. `uname`이 `Darwin`이면 Mac이다. Mac이면 아래 절차는 그대로 따르되, 경로·확인 명령·조심할 것은 맨 아래 "macOS" 절을 쓰고, 우리 설정은 `references/csm-kr-preset-mac.md`를 쓴다.

## 파일

| 경로 | 쓰임 |
|---|---|
| `%USERPROFILE%\.config\herdr-app\keys.json` | 모든 단축키. 저장하면 1초 안에 앱에 반영된다 |
| `%USERPROFILE%\.config\herdr-app\keys.error` | 파일이 잘못됐을 때만 생긴다. 이유가 적혀 있다 |
| `%USERPROFILE%\.config\herdr-app\AGENTS.md` | 설치된 버전의 공식 설명서. 이 스킬과 다르면 저쪽이 맞다 |

`herdr-app commands`는 창이 닫혀 있어도 쓸 수 있고, 키에 걸 수 있는 명령과 인자를 전부 보여 준다.

## 단축키 보여 주기

`keys.json`을 읽고 아래 묶음으로 나눠 표로 보여 준다. 앱의 단축키 화면(Windows `Ctrl+Shift+/`, Mac `Cmd+/`)과 같은 묶음이라 사용자가 화면과 맞춰 보기 쉽다.

| 묶음 | 해당하는 동작 |
|---|---|
| 스페이스 | `space.*` |
| 탭 | `tab.*` |
| 창(pane) | `pane.*` |
| 에이전트 | `agent.*` |
| 터미널 | `terminal.*`, `send:*` |
| 앱·화면 | 나머지 (`app.*`, `layout.*`, `mod.*`, `window.*`) |

- 표기는 사람이 읽는 식으로 바꾼다: `ctrl-shift-pagedown` → `Ctrl+Shift+PageDown`, `alt-up` → `Alt+↑`.
- 같은 동작에 키가 여러 개면 한 줄로 합친다 (`Alt+1` ~ `Alt+9`, 다음 탭 키 세 개 등).
- `terminal` 섹션의 키는 터미널에 포커스가 있을 때만 듣는다고 적는다.
- `Ctrl+Alt+Shift+Esc`는 파일에 없어도 항상 동작하는 비상 탈출 키다. 레이아웃과 `keys.json`을 따로 치워 두고 기본 화면으로 돌아가며, 다른 동작으로 바꿀 수 없다.

## 단축키 바꾸기

1. **무슨 동작인지 확정한다.** 사용자가 부르는 이름과 실제 명령이 다를 때가 많다. "스페이스 올리고 내리기"는 위아래 스페이스로 넘어가는 것(`space.next` / `space.prev`)일 수도, 목록에서 순서를 옮기는 것일 수도 있다. 해석이 갈리면 한 번 묻는다.
2. **그 동작이 명령으로 있는지 본다.** `herdr-app commands`에 없으면 키만으로는 안 된다. 예를 들어 `space.move`는 `{id, index}`로 절대 위치만 받아서, "한 칸 위로" 같은 상대 이동은 현재 위치를 계산해 주는 모드(mod)를 따로 만들어야 한다. 이럴 때는 키만 추가하지 말고 필요한 작업을 먼저 알린다.
3. **키가 비어 있는지 본다.** `global`과 `terminal` 양쪽에서 같은 키를 찾는다. 이미 쓰이고 있으면 무엇을 덮어쓰는지 말하고 진행 여부를 묻는다.
4. **고친다.** 해당 줄만 넣거나 뺀다. 줄 순서나 들여쓰기 같은 주변은 건드리지 않는다.
5. **적용을 확인한다.** 반영에 1초쯤 걸리니 잠깐 기다린 뒤 본다.

   ```powershell
   Start-Sleep -Seconds 2
   Test-Path "$env:USERPROFILE\.config\herdr-app\keys.error"   # False 여야 한다
   herdr-app status                                             # "errors": [] 여야 한다
   ```

   `keys.error`가 생겼다면 앱은 고치기 전 설정으로 계속 돌고 있다. 내용을 읽고 바로 고친다.
6. **결과를 알린다.** 바뀐 키와 동작을 표로 적는다. 실제 키 입력은 에이전트가 눌러 볼 수 없으니, 파일과 상태만 확인했다는 점도 같이 적는다.

키를 지울 때는 그 키가 원래 하던 일을 정확히 말해 준다. 사용자가 기억하는 것과 다를 수 있다 (`Ctrl+Shift+L`은 레이아웃을 지우는 게 아니라 전환하는 키다). 지운 키는 Herdr가 가로채지 않고 터미널 안 프로그램으로 넘어간다.

## 동작 쓰는 법

```json
{
  "global":   { "ctrl-shift-t": "tab.new", "ctrl-shift-o": "pane.split:right", "alt-1": "space.select:1" },
  "terminal": { "ctrl-shift-c": "terminal.copy", "ctrl-left": "send:\u001bb", "ctrl-1": "terminal" }
}
```

- 섹션: `global`(어디서나), `terminal`(터미널에 포커스), `layout:<이름>`(그 레이아웃이 보일 때), `mod:<이름>`. 더 좁은 섹션이 이긴다. `terminal`이 `global`보다 우선이다.
- 키 이름은 소문자를 `-`로 잇는다. 기존 줄의 표기를 그대로 따른다 (`ctrl-shift-up`, `alt-]`, `shift-f2`, `ctrl-pagedown`).
- 동작은 네 가지다.
  - `명령` 또는 `명령:값`. 값은 명령의 첫 번째 인자로 들어간다.
  - `send:<글자>`. 터미널에 그대로 입력한다.
  - `terminal`. Herdr가 가로채지 않고 프로그램에 키를 넘긴다. `global`에 묶인 키를 터미널 안에서만 풀어 줄 때 쓴다.
  - 인자가 여럿이거나 숫자·불리언이면 객체로 쓴다: `{"command": "layout.resize", "args": {"id": "sidebar", "px": 240}}`

자주 거는 명령:

| 명령 | 하는 일 |
|---|---|
| `space.new`, `space.close`, `space.rename` | 스페이스 만들기 / 닫기 / 이름 바꾸기 |
| `space.next`, `space.prev`, `space.select:N` | 다음 / 이전 / N번째 스페이스 |
| `tab.new`, `tab.close`, `tab.rename` | 탭 만들기 / 닫기 / 이름 바꾸기 |
| `tab.next`, `tab.prev`, `tab.select:N` | 다음 / 이전 / N번째 탭 |
| `pane.split:right`, `pane.split:down` | 오른쪽 / 아래로 분할 |
| `pane.go:<방향>`, `pane.swap:<방향>` | 포커스 이동 / 자리 바꾸기 (`left` `right` `up` `down`) |
| `pane.zoom`, `pane.close` | 창 확대 토글 / 닫기 |
| `agent.next`, `agent.prev` | 다음 / 이전 에이전트 |
| `terminal.copy`, `terminal.paste`, `terminal.search` | 복사 / 붙여넣기 / 터미널 안 검색 |
| `app.palette`, `app.settings`, `app.help` | 명령 팔레트 / 설정 / 단축키 목록 |
| `layout.toggle:sidebar`, `layout.switch` | 사이드바 접기 / 레이아웃 전환 |

## 조심할 것

- **한 번 고치면 그 파일은 사용자 것이 된다.** 손대지 않은 `keys.json`은 업데이트 때 새 기본 단축키를 받지만, 공백 하나라도 바꾸면 그 뒤로는 자동으로 들어오지 않는다. 처음 고칠 때 알려 준다.
- **`Ctrl+글자` 하나짜리는 먼저 권하지 않는다.** 터미널 프로그램이 `Ctrl+C`, `D`, `L`, `R`, `W`, `A`, `E`, `U`, `K`, `Z`를 쓴다. 사용자가 꼭 원하면 걸되, 터미널에서 그 키를 못 쓰게 된다고 말한다.
- **`Ctrl+Alt` 조합은 피한다.** Windows에서는 AltGr로 처리된다.
- **닫는 명령은 터미널을 끝낸다.** `space.close`는 그 스페이스의 터미널과 실행 중인 에이전트를 모두 종료한다. 키로 누르면 확인 창이 뜨니 그대로 둔다. 사용자가 이 대화를 돌리는 스페이스에서 시험하면 대화도 같이 끝난다고 알려 준다.
- **기본 제공 파일은 고치지 않는다.** `frame/`과 기본 레이아웃·모드는 앱이 시작할 때마다 덮어쓴다. 단축키는 `keys.json`만 고치면 된다.
- **스페이스는 경로에 묶이지 않는다.** 이름을 붙이지 않은 스페이스는 첫 터미널이 지금 있는 폴더(저장소 안이면 저장소 이름, 홈이면 `~`)로 불리고, `cd`하면 따라 바뀐다. `space.rename`으로 이름을 붙이면 고정된다.

## 내 설정

기본값에서 바꿔 쓰는 키는 Windows는 `references/csm-kr-preset.md`, macOS는 `references/csm-kr-preset-mac.md`에 있다. 두 OS의 기본값이 달라 목록도 따로다. 새 PC에 같은 설정을 맞춰 달라는 요청일 때만 읽고, 파일을 통째로 덮어쓰지 말고 거기 적힌 줄만 위 절차대로 하나씩 반영한다. 통째로 덮으면 그 PC의 버전에 새로 생긴 기본 단축키가 사라진다.

## macOS

위 절차와 동작 쓰는 법은 같다. 다른 점만 적는다.

| 경로 | 쓰임 |
|---|---|
| `~/.config/herdr-app/keys.json` | 모든 단축키. 저장하면 1초 안에 앱에 반영된다 |
| `~/.config/herdr-app/keys.error` | 파일이 잘못됐을 때만 생긴다. 이유가 적혀 있다 |
| `~/.config/herdr-app/settings.json` | 앱 설정. 단축키와 관련된 것은 `option_as_alt` |
| `~/.config/herdr-app/AGENTS.md` | 설치된 버전의 공식 설명서. 이 스킬과 다르면 저쪽이 맞다 |

- **키 이름에 `cmd`가 있다.** 보여 줄 때는 `cmd-shift-w` → `Cmd+Shift+W`, `alt-h` → `Option+H`로 적는다.
- **적용 확인(5단계)은 bash로 한다.**

  ```bash
  sleep 2
  test -e ~/.config/herdr-app/keys.error && cat ~/.config/herdr-app/keys.error   # 아무것도 안 나와야 한다
  herdr-app status                                                                # "errors": [] 여야 한다
  ```

- **`alt-` 키는 Option 설정을 먼저 본다.** `settings.json`의 `option_as_alt`가 기본값 `auto`면 US·ABC 자판에서만 Option이 Alt로 간다. 한글 등 다른 자판에서는 Option이 글자를 입력하므로 `"on"`이어야 한다.
- **`Ctrl+Alt`(AltGr) 주의는 Mac에는 없다.** 대신 Option+글자·숫자는 많은 Mac 자판에서 `[`, `@` 같은 글자를 입력하니 먼저 권하지 않는다.
- **`Ctrl+Alt+Shift+Esc` 비상 탈출 키는 Mac에서도 같다.**
