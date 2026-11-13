// Mermaid 다이어그램 테스트. 실행: node --test test/mermaid.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { kindOf, splitMermaid, mermaidName, browserCandidates, isDark } from "../kind.js";

test(".mmd 와 .mermaid 는 mermaid, .md 는 그대로 other(마크다운으로 렌더)", () => {
  assert.equal(kindOf("a/flow.mmd"), "mermaid");
  assert.equal(kindOf("b.MERMAID"), "mermaid");
  assert.equal(kindOf("c.md"), "other");
});

test("splitMermaid는 마크다운을 글 조각과 ```mermaid 조각으로 나눈다", () => {
  const md = "# 제목\n\n앞 글\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\n뒤 글\n\n```python\nprint(1)\n```\n";
  assert.deepEqual(splitMermaid(md), [
    { md: "# 제목\n\n앞 글\n\n" },
    { mermaid: "flowchart LR\n  A --> B" },
    { md: "\n\n뒤 글\n\n```python\nprint(1)\n```\n" },
  ]);
});

test("splitMermaid: mermaid 블록이 없으면 null (그냥 마크다운), 닫히지 않은 블록은 글로 둔다", () => {
  assert.equal(splitMermaid("# 제목\n```js\nx\n```"), null);
  assert.equal(splitMermaid("```mermaid\nflowchart LR\n"), null);
  // CRLF 파일도 된다.
  assert.deepEqual(splitMermaid("```mermaid\r\nA-->B\r\n```"), [{ mermaid: "A-->B" }]);
});

test("mermaidName: 같은 코드·같은 색이면 같은 이름, 다르면 다른 이름", () => {
  assert.equal(mermaidName("A-->B", true), mermaidName("A-->B", true));
  assert.notEqual(mermaidName("A-->B", true), mermaidName("A-->B", false));
  assert.notEqual(mermaidName("A-->B", true), mermaidName("A-->C", true));
  assert.match(mermaidName("A-->B", true), /^mmd-[0-9a-f]+-\d+-d\.png$/);
});

test("browserCandidates: 운영체제마다 Chrome·Edge·Chromium 자리", () => {
  const win = browserCandidates("windows", "C:/Users/me");
  assert.ok(win.includes("C:/Program Files/Google/Chrome/Application/chrome.exe"));
  assert.ok(win.includes("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"));
  assert.ok(win.includes("C:/Users/me/AppData/Local/Google/Chrome/Application/chrome.exe"));
  assert.ok(browserCandidates("macos", "/Users/me").includes("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"));
  assert.ok(browserCandidates("linux", "/home/me").includes("/usr/bin/chromium"));
});

test("isDark: 배경색이 어두우면 true", () => {
  assert.equal(isDark("#1a1b1e"), true);
  assert.equal(isDark("#ffffff"), false);
  assert.equal(isDark("rgb(0,0,0)"), true);
});
