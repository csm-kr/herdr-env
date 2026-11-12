# 기본값에서 바꾼 단축키 (macOS)

herdr-app 0.1.15, macOS, 2026-11-12 기준. 앱에 들어 있는 Mac 기본 `keys.json`과 비교했다. 바뀐 키는 모두 `global` 섹션이고, `terminal` 섹션은 기본값 그대로다.

Mac 기본값은 `cmd` 키 위주다. 우리 설정은 `cmd` 기본 키를 거의 그대로 두고, Windows에서 쓰는 `ctrl-shift` 키와 `alt` 키를 같은 동작으로 얹는다. 그래서 두 OS에서 같은 손가락으로 같은 일을 한다.

## 추가한 키 (17개)

| 키 | 동작 | 넣는 자리 (같은 동작의 기본 키 바로 아래) |
|---|---|---|
| `ctrl-shift-t` | `tab.new` | `cmd-t` |
| `ctrl-shift-w` | `tab.close` | `cmd-w` |
| `alt-[` | `tab.prev` | `ctrl-shift-w` 아래 |
| `alt-]` | `tab.next` | `alt-[` 아래 |
| `ctrl-shift-up` | `space.prev` | `cmd-alt-[` |
| `ctrl-shift-down` | `space.next` | `ctrl-shift-up` 아래 |
| `ctrl-shift-q` | `space.close` | `cmd-n` (확인 창이 뜬다) |
| `ctrl-shift-n` | `space.new` | `ctrl-shift-q` 아래 |
| `ctrl-shift-p` | `app.palette` | `cmd-shift-p` |
| `ctrl-shift-o` | `pane.split:right` | `cmd-shift-d` |
| `ctrl-shift-e` | `pane.split:down` | `ctrl-shift-o` 아래 |
| `ctrl-shift-x` | `pane.close` | `cmd-shift-w` |
| `ctrl-shift-z` | `pane.zoom` | `cmd-shift-enter` |
| `alt-h` | `pane.go:left` | `cmd-alt-down` |
| `alt-j` | `pane.go:down` | `alt-h` 아래 |
| `alt-k` | `pane.go:up` | `alt-j` 아래 |
| `alt-l` | `pane.go:right` | `alt-k` 아래 |

넣는 자리는 기능에 영향이 없다. 이 Mac의 파일과 같은 순서로 맞춰 두면 나중에 비교하기 쉬워서 적어 둔다.

## 뺀 키 (1개)

| 키 | 기본 동작 |
|---|---|
| `cmd-shift-l` | `layout.switch` (레이아웃 전환). Windows에서 `ctrl-shift-l`을 뺀 것과 같은 짝 |

## 닫기 키

닫는 범위가 작은 것부터 큰 것 순서로 `X` → `W` → `Q`다. Windows와 같고, 이 짝은 바꾸지 않는다.

| 키 | 동작 | 닫는 것 | Mac 기본 키 |
|---|---|---|---|
| `ctrl-shift-x` | `pane.close` | 창(pane) 하나 | `cmd-shift-w` |
| `ctrl-shift-w` | `tab.close` | 탭 하나 | `cmd-w` |
| `ctrl-shift-q` | `space.close` | 스페이스 전체 | 없음 |

`cmd-shift-w`(창 닫기)와 `ctrl-shift-w`(탭 닫기)는 글자가 같은데 닫는 범위가 다르다. 사용자가 헷갈려하면 이 차이를 먼저 말해 준다.

## 키 말고 같이 맞출 설정

`~/.config/herdr-app/settings.json`의 `"option_as_alt": "on"`. 기본값 `auto`는 US·ABC 자판에서만 Option을 Alt로 보내고, 한글 등 다른 자판에서는 Option이 글자를 입력한다. 위 `alt-` 키들을 자판과 상관없이 Alt로 쓰려고 켜 둔다. 앱의 Settings → Keyboard에서도 바꿀 수 있다.

## 반영하는 법

1. 대상 Mac의 `keys.json`을 읽고, 위 키가 이미 다른 동작에 묶여 있는지 본다. 묶여 있으면 사용자에게 묻는다.
2. 추가 17줄을 넣고 `cmd-shift-l` 줄을 뺀다. 파일을 통째로 덮어쓰지 않는다. 그 Mac의 버전에 새로 생긴 기본 단축키가 사라진다.
3. `settings.json`의 `option_as_alt`를 `"on"`으로 둔다.
4. 적용을 확인한다.

   ```bash
   sleep 2
   test -e ~/.config/herdr-app/keys.error && cat ~/.config/herdr-app/keys.error   # 아무것도 안 나와야 한다
   herdr-app status                                                                # "errors": [] 여야 한다
   ```

설정을 더 바꾸고 저장소에도 남겨 달라는 요청을 받으면 이 표를 고쳐 커밋한다.
