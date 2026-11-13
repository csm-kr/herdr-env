// 트리 패널과 미리보기 탭이 shared 메시지로 주고받을 때, 받을지 말지 판단하는 테스트. 실행: node --test test/role.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { follows } from "../kind.js";

test("follows는 처음 보는(더 새로운) 메시지만 받는다", () => {
  assert.equal(follows({ seq: 5, space: "s1" }, 4, "s1"), true);
  assert.equal(follows({ seq: 5, space: "s1" }, 5, "s1"), false);
  assert.equal(follows(undefined, 0, "s1"), false);
});

test("follows는 다른 스페이스로 보낸 메시지는 받지 않는다. 스페이스가 없는 메시지는 누구나 받는다", () => {
  assert.equal(follows({ seq: 9, space: "s2" }, 0, "s1"), false);
  assert.equal(follows({ seq: 9, space: null }, 0, "s1"), true);
});
