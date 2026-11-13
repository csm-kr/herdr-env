# 기본값에서 바꾼 단축키

herdr-app 0.1.15, Windows, 2026-11-12 기준. 모두 `keys.json`의 `global` 섹션이다.

| 키 | 동작 | 기본값 대비 |
|---|---|---|
| `ctrl-shift-up` | `space.prev` | 추가. 위(이전) 스페이스로 전환 |
| `ctrl-shift-down` | `space.next` | 추가. 아래(다음) 스페이스로 전환 |
| `ctrl-shift-q` | `space.close` | 추가. 현재 스페이스 닫기 (확인 창이 뜬다) |
| `ctrl-shift-l` | 없음 | 삭제. 기본값은 `layout.switch`(레이아웃 전환) |
| `ctrl-shift-g` | `mod.open:file-viewer` | 추가. 미리보기 탭 열기/돌아가기 (이 저장소의 `mods/file-viewer` 필요) |
| `ctrl-shift-y` | `mod.open:path-picker` | 추가. 터미널 화면의 경로 골라 열기 (`mods/path-picker` 필요) |

기본값의 `ctrl-shift-pageup` / `ctrl-shift-pagedown`(`space.prev` / `space.next`)은 그대로 둔다.

## 닫기 키 세 개

닫는 범위가 작은 것부터 큰 것 순서로 `X` → `W` → `Q`다. 이 짝은 바꾸지 않는다.

| 키 | 동작 | 닫는 것 | 출처 |
|---|---|---|---|
| `ctrl-shift-x` | `pane.close` | 창(pane) 하나 | 기본값 |
| `ctrl-shift-w` | `tab.close` | 탭 하나 | 기본값 |
| `ctrl-shift-q` | `space.close` | 스페이스 전체 | 추가 |

## 반영하는 법

Windows에서는 저장소 루트의 `keys.ps1`이 아래 일을 대신 한다(`install.ps1`이 부른다). 이 표를 바꾸면 `keys.ps1`의 목록도 같이 바꾼다.

1. 대상 PC의 `keys.json`을 읽고, 위 키가 이미 다른 동작에 묶여 있는지 본다. 묶여 있으면 사용자에게 묻는다.
2. 추가 줄을 넣고 `ctrl-shift-l` 줄을 뺀다. 모드 키 두 개는 그 모드를 `~/.config/herdr-app/mods/`에 넣은 PC에서만 넣는다(`mods/file-viewer/install.ps1`이 대신 넣어 준다).
3. `keys.error`가 없고 `herdr-app status`의 `errors`가 비어 있는지 확인한다.

설정을 더 바꾸고 저장소에도 남겨 달라는 요청을 받으면 이 표를 고쳐 커밋한다.
