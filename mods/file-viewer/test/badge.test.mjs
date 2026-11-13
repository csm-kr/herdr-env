// 영상 장면 가운데 재생 버튼(동그라미 안 세모)의 크기와 자리 테스트. 실행: node --test test/badge.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { playBadge } from "../kind.js";

test("장면 한가운데에 놓는다", () => {
  const b = playBadge(675, 380);
  assert.equal(b.left, Math.round((675 - b.size) / 2));
  assert.equal(b.top, Math.round((380 - b.size) / 2));
});

test("크기는 장면 짧은 변의 10%, 32~48px 사이 (너무 크다는 요청으로 줄였다)", () => {
  assert.equal(playBadge(1000, 400).size, 40);
  assert.equal(playBadge(2000, 1200).size, 48);
  assert.equal(playBadge(120, 80).size, 32);
});
