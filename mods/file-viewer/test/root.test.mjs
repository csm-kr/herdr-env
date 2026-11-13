// 프로젝트 루트 구하기 테스트. 실행: node --test test/root.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { repoRoot } from "../kind.js";

test("repoRoot: 지금 폴더 끝이 저장소 안 위치(prefix)와 맞으면 그만큼 올라간 곳, 경로 표기는 그대로", () => {
  assert.equal(repoRoot("/home/me/ws/proj/src/lib", "src/lib/"), "/home/me/ws/proj");
  assert.equal(repoRoot("C:\\Users\\me\\proj\\docs", "docs/"), "C:\\Users\\me\\proj");
  assert.equal(repoRoot("C:\\Users\\me\\Proj\\Docs", "docs/"), "C:\\Users\\me\\Proj");
  // 저장소 맨 위면 그대로.
  assert.equal(repoRoot("/home/me/proj", ""), "/home/me/proj");
});

test("repoRoot: 심볼릭 링크 폴더(~/ep2)처럼 끝이 prefix와 안 맞으면 null (git --show-toplevel의 실제 경로를 쓴다)", () => {
  assert.equal(repoRoot("/home/me/ep2", "docs/review/preview/"), null);
});
