// keys-mac.mjs: macOS의 keys.json·settings.json을 내 설정에 맞추는 글 바꾸기.
import test from "node:test";
import assert from "node:assert/strict";
import { ADD, REMOVE, applyKeys, setOptionAsAlt } from "../keys-mac.mjs";

const BASE = `{
  "global": {
    "cmd-t": "tab.new",
    "cmd-shift-l": "layout.switch",
    "cmd-shift-w": "pane.close",
    "cmd-w": "tab.close"
  },
  "terminal": {
    "cmd-f": "terminal.search"
  }
}`;

test("목록: 넣을 키 19개(기존 17개 + 미리보기 G, 경로 열기 Y), 뺄 키 2개", () => {
  assert.equal(ADD.length, 19);
  assert.deepEqual(ADD.filter(([, a]) => a.startsWith("mod.open:")), [["ctrl-shift-g", "mod.open:file-viewer"], ["ctrl-shift-y", "mod.open:path-picker"]]);
  assert.deepEqual(REMOVE, { "cmd-shift-l": "layout.switch", "cmd-shift-w": "pane.close" });
});

test("applyKeys: 없는 키는 global 맨 앞에 목록 순서대로 넣고, 뺄 키 줄을 뺀다. 결과는 올바른 JSON이다", () => {
  const { raw, log } = applyKeys(BASE);
  const keys = JSON.parse(raw);
  for (const [k, a] of ADD) assert.equal(keys.global[k], a);
  assert.equal(keys.global["cmd-shift-l"], undefined);
  assert.equal(keys.global["cmd-shift-w"], undefined);
  assert.equal(keys.global["cmd-t"], "tab.new");
  assert.equal(keys.terminal["cmd-f"], "terminal.search");
  assert.deepEqual(Object.keys(keys.global).slice(0, 2), [ADD[0][0], ADD[1][0]]);
  assert.equal(log.filter(l => l.kind === "added").length, 19);
  assert.equal(log.filter(l => l.kind === "removed").length, 2);
});

test("applyKeys: 두 번 돌려도 같다(이미 있는 키는 건드리지 않는다)", () => {
  const once = applyKeys(BASE).raw, twice = applyKeys(once);
  assert.equal(twice.raw, once);
  assert.equal(twice.log.filter(l => l.kind === "has").length, 19);
  assert.equal(twice.log.filter(l => l.kind === "added" || l.kind === "removed").length, 0);
});

test("applyKeys: 다른 동작에 쓰이는 키는 덮어쓰지 않고 알린다(문자열·객체 동작, terminal 섹션 모두)", () => {
  const raw = BASE.replace('"cmd-t": "tab.new",', '"cmd-t": "tab.new",\n    "ctrl-shift-g": "app.palette",\n    "ctrl-shift-z": {"command": "layout.resize", "args": {"px": 240}},')
    .replace('"cmd-f": "terminal.search"', '"cmd-f": "terminal.search",\n    "alt-h": "terminal"');
  const out = applyKeys(raw), keys = JSON.parse(out.raw);
  assert.equal(keys.global["ctrl-shift-g"], "app.palette");
  assert.equal(keys.global["ctrl-shift-z"].command, "layout.resize");
  assert.equal(keys.global["alt-h"], undefined);
  assert.deepEqual(out.log.filter(l => l.kind === "conflict").map(l => l.key).sort(), ["alt-h", "ctrl-shift-g", "ctrl-shift-z"]);
  assert.equal(out.log.find(l => l.key === "ctrl-shift-g").current, "app.palette");
});

test("applyKeys: 뺄 키가 다른 동작에 묶여 있으면 빼지 않는다. 섹션의 마지막 줄이어도 뺀다", () => {
  const other = applyKeys(BASE.replace('"cmd-shift-w": "pane.close"', '"cmd-shift-w": "tab.close"'));
  assert.equal(JSON.parse(other.raw).global["cmd-shift-w"], "tab.close");
  const last = applyKeys(`{\n  "global": {\n    "cmd-t": "tab.new",\n    "cmd-shift-l": "layout.switch"\n  }\n}`);
  assert.equal(JSON.parse(last.raw).global["cmd-shift-l"], undefined);
});

test("applyKeys: global 섹션이 없으면 넣지 못했다고 알리고 글은 그대로 둔다", () => {
  const out = applyKeys(`{\n  "terminal": {}\n}`);
  assert.equal(out.raw, `{\n  "terminal": {}\n}`);
  assert.equal(out.log.filter(l => l.kind === "nosection").length, 19);
});

test("setOptionAsAlt: 값을 on으로 바꾸고 다른 설정은 건드리지 않는다. 없으면 넣는다", () => {
  const a = setOptionAsAlt(`{\n  "zoom": 1,\n  "option_as_alt": "auto"\n}`);
  assert.deepEqual(JSON.parse(a.raw), { zoom: 1, option_as_alt: "on" });
  assert.equal(a.changed, true);
  const b = setOptionAsAlt(a.raw);
  assert.equal(b.raw, a.raw);
  assert.equal(b.changed, false);
  assert.deepEqual(JSON.parse(setOptionAsAlt(`{\n  "zoom": 1\n}`).raw), { option_as_alt: "on", zoom: 1 });
  assert.deepEqual(JSON.parse(setOptionAsAlt("{}").raw), { option_as_alt: "on" });
});
