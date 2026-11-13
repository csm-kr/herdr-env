// "경로 복사" 버튼이 복사할 경로 테스트. 실행: node --test test/copy.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyPath } from "../kind.js";

test("리눅스 폴더와 파일(하위 폴더 포함)은 / 로 잇는다", () => {
  assert.equal(copyPath("/home/me/out", "a.mp4"), "/home/me/out/a.mp4");
  assert.equal(copyPath("/home/me/out", "parts/b.mp4"), "/home/me/out/parts/b.mp4");
  assert.equal(copyPath("/", "a.txt"), "/a.txt");
});

test("Windows 폴더는 \\ 로 잇고, 파일 쪽 / 도 \\ 로 바꾼다", () => {
  assert.equal(copyPath("C:\\Users\\me", "docs/a.png"), "C:\\Users\\me\\docs\\a.png");
  assert.equal(copyPath("C:\\", "a.png"), "C:\\a.png");
});

test("파일이 없으면 폴더 경로, 폴더도 없으면 빈 글", () => {
  assert.equal(copyPath("/home/me", null), "/home/me");
  assert.equal(copyPath("", null), "");
});
