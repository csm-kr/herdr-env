// 고친 내용이 조용히 버려지지 않게 막는 판단 테스트. 실행: node --test test/edit.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { discardGate } from "../kind.js";

test("discardGate는 고친 게 없으면 바로 넘어간다", () => {
  assert.deepEqual(discardGate(false, null, "b.txt"), { allow: true, armed: null });
});

test("discardGate는 고친 채로 처음 다른 곳을 누르면 막고 그곳을 기억한다", () => {
  assert.deepEqual(discardGate(true, null, "b.txt"), { allow: false, armed: "b.txt" });
});

test("discardGate는 같은 곳을 한 번 더 누르면 버리고 넘어간다", () => {
  assert.deepEqual(discardGate(true, "b.txt", "b.txt"), { allow: true, armed: null });
});

test("discardGate는 다른 곳을 누르면 처음부터 다시 막는다", () => {
  assert.deepEqual(discardGate(true, "b.txt", "c.txt"), { allow: false, armed: "c.txt" });
});
