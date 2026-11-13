// Ctrl+Shift+G(복사한 경로 없음)로 미리보기 탭을 오가는 규칙 테스트. 실행: node --test test/toggle.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { viewerToggle, rightOf } from "../kind.js";

test("터미널 탭에서 누르면 미리보기 탭으로 가고, 지금 탭을 돌아올 곳으로 기억한다", () => {
  assert.deepEqual(viewerToggle({ current: "t1", viewer: "v", back: null, tabs: ["t1", "v"] }), { action: "open", back: "t1" });
  // 미리보기 탭이 아직 없어도 같다(새로 만든다).
  assert.deepEqual(viewerToggle({ current: "t1", viewer: null, back: null, tabs: ["t1"] }), { action: "open", back: "t1" });
});

test("미리보기 탭에서 누르면 기억해 둔 탭으로 돌아간다", () => {
  assert.deepEqual(viewerToggle({ current: "v", viewer: "v", back: "t2", tabs: ["t1", "t2", "v"] }), { action: "back", tab: "t2" });
});

test("돌아갈 탭이 닫혔으면 tab은 null (바로 앞 탭으로 간다)", () => {
  assert.deepEqual(viewerToggle({ current: "v", viewer: "v", back: "gone", tabs: ["t1", "v"] }), { action: "back", tab: null });
});

test("rightOf는 지금 탭 바로 오른쪽 자리(1부터)", () => {
  assert.equal(rightOf(["a", "b", "c"], "a"), 2);
  assert.equal(rightOf(["a", "b", "c"], "c"), 4);
  // 모르는 탭이면 맨 끝.
  assert.equal(rightOf(["a", "b"], "x"), 3);
});

test("folderRequest: Ctrl+Shift+G로 갈 때 지금 터미널 폴더·머신을 미리보기에 보낸다 (파일은 열지 않음)", async () => {
  const { folderRequest } = await import("../kind.js");
  assert.deepEqual(folderRequest({ cwd: "C:\Users\me\Desktop\sm\apps\mindex", on: null }), { folder: "C:\Users\me\Desktop\sm\apps\mindex", on: null, file: null });
  assert.deepEqual(folderRequest({ cwd: "/home/me/ws", on: "192.168.0.10" }), { folder: "/home/me/ws", on: "192.168.0.10", file: null });
  // 폴더를 모르면 보내지 않는다(미리보기는 보던 곳 그대로).
  assert.equal(folderRequest({ cwd: "", on: null }), null);
  assert.equal(folderRequest(null), null);
});

test("rootStep: 루트가 아니면 루트로(지금 폴더를 기억), 루트면 기억한 폴더로 돌아간다", async () => {
  const { rootStep } = await import("../kind.js");
  assert.deepEqual(rootStep({ current: "/r/a/b", root: "/r", back: null }), { go: "/r", back: "/r/a/b", label: "⌂ 프로젝트 루트" });
  assert.deepEqual(rootStep({ current: "/r", root: "/r", back: "/r/a/b" }), { go: "/r/a/b", back: null, label: "↩ 원래 폴더" });
  // 루트에 있고 돌아갈 곳이 없으면 버튼이 필요 없다.
  assert.equal(rootStep({ current: "/r", root: "/r", back: null }), null);
  assert.equal(rootStep({ current: "/r", root: null, back: null }), null);
  // 끝의 / 나 \ 차이는 같은 폴더로 본다.
  assert.equal(rootStep({ current: "C:\\r\\", root: "C:/r", back: null }), null);
});
