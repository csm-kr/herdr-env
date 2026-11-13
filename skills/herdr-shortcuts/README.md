# herdr-shortcuts

Windows와 macOS에서 [Herdr 앱](https://herdr.dev)의 단축키를 보고 바꾸는 Claude Code 스킬입니다.

- `keys.json`을 읽어 스페이스·탭·창·에이전트·터미널·앱 묶음으로 정리해 보여 줍니다.
- 키를 추가하거나 지울 때 이미 쓰이는 키인지, 그 동작이 명령으로 있는지 먼저 확인합니다.
- 고친 뒤에는 `keys.error`와 `herdr-app status`로 적용됐는지 검증합니다.

두 OS는 기본 단축키가 달라서, 스킬이 OS를 먼저 확인하고 그 OS의 경로와 설정 목록을 씁니다.

## 들어 있는 것

```
herdr-shortcuts/
├── SKILL.md                      # Claude가 읽는 절차 (보여 주기, 바꾸기, 동작 쓰는 법, 조심할 것)
├── README.md
└── references/
    ├── csm-kr-preset.md          # Windows: 기본값에서 바꿔 쓰는 키 목록 (새 PC에 맞출 때 사용)
    └── csm-kr-preset-mac.md      # macOS: 기본값에서 바꿔 쓰는 키 목록
```

스크립트나 설치할 패키지는 없습니다.

## 설치

Claude Code 스킬 폴더에 그대로 둡니다.

이 폴더를 Claude Code 스킬 폴더로 복사합니다. 저장소 전체 설치는 맨 위 [README](../../README.md)를 봅니다.

```bash
git clone https://github.com/csm-kr/herdr-env.git
cp -r herdr-env/skills/herdr-shortcuts ~/.claude/skills/
```

Claude Code에서 "herdr 단축키 보자", "Ctrl+Shift+Q에 스페이스 닫기 걸어줘", "이 단축키 없애줘"처럼 말하면 스킬이 잡힙니다. `/herdr-shortcuts`로 직접 부를 수도 있습니다.

## 확인한 환경

herdr-app 0.1.15, Windows 11, macOS. 설치된 버전의 정확한 설명은 `~/.config/herdr-app/AGENTS.md`에 있고, 이 스킬과 다르면 그쪽이 맞습니다.
