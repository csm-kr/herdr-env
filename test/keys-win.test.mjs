// keys.ps1: Windows keys.json을 내 설정에 맞춘다. 임시 keys.json에 돌려 결과를 본다.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "keys.ps1");
const skip = process.platform !== "win32" && "Windows 전용";

// herdr-app 기본값 중 이번 변경과 관련된 줄
const BASE = `{
  "global": {
    "alt-h": "pane.go:left",
    "alt-j": "pane.go:down",
    "alt-k": "pane.go:up",
    "alt-l": "pane.go:right",
    "alt-left": "pane.go:left",
    "alt-right": "pane.go:right",
    "alt-shift-h": "pane.swap:left",
    "alt-shift-j": "pane.swap:down",
    "alt-shift-k": "pane.swap:up",
    "alt-shift-l": "pane.swap:right",
    "alt-down": "agent.next",
    "alt-up": "agent.prev",
    "ctrl-shift-l": "layout.switch",
    "ctrl-shift-t": "tab.new"
  },
  "terminal": {
    "ctrl-shift-c": "terminal.copy"
  }
}`;

function run(raw) {
  const dir = mkdtempSync(join(tmpdir(), "keys-win-"));
  const path = join(dir, "keys.json");
  writeFileSync(path, raw);
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SCRIPT, "-KeysPath", path], { encoding: "utf8" });
  return readFileSync(path, "utf8");
}

test("pane 이동·자리 바꾸기를 화살표로 통일하고 HJKL과 에이전트 전환 키를 뺀다", { skip }, () => {
  const g = JSON.parse(run(BASE)).global;
  assert.equal(g["alt-left"], "pane.go:left");
  assert.equal(g["alt-right"], "pane.go:right");
  assert.equal(g["alt-up"], "pane.go:up");
  assert.equal(g["alt-down"], "pane.go:down");
  assert.equal(g["alt-shift-left"], "pane.swap:left");
  assert.equal(g["alt-shift-right"], "pane.swap:right");
  assert.equal(g["alt-shift-up"], "pane.swap:up");
  assert.equal(g["alt-shift-down"], "pane.swap:down");
  for (const k of ["alt-h", "alt-j", "alt-k", "alt-l", "alt-shift-h", "alt-shift-j", "alt-shift-k", "alt-shift-l", "ctrl-shift-l"])
    assert.equal(g[k], undefined, k);
  assert.equal(g["ctrl-shift-t"], "tab.new");
});

test("두 번 돌려도 같다", { skip }, () => {
  const once = run(BASE);
  assert.equal(run(once), once);
});

test("사용자가 다른 동작에 묶은 키는 빼지도 덮어쓰지도 않는다", { skip }, () => {
  const raw = BASE.replace('"alt-up": "agent.prev"', '"alt-up": "app.palette"').replace('"alt-h": "pane.go:left"', '"alt-h": "tab.new"');
  const g = JSON.parse(run(raw)).global;
  assert.equal(g["alt-up"], "app.palette");
  assert.equal(g["alt-h"], "tab.new");
});
