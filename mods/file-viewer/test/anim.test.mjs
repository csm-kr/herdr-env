// 움직이는 GIF·WebP 테스트. 실행: node --test test/anim.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { frameAt, isAnimatable } from "../kind.js";

test("frameAt: 프레임별 간격(ms)을 따라 지난 시간에 맞는 프레임, 끝나면 처음부터", () => {
  const d = [100, 200, 100]; // 합 400
  assert.equal(frameAt(d, 0), 0);
  assert.equal(frameAt(d, 99), 0);
  assert.equal(frameAt(d, 100), 1);
  assert.equal(frameAt(d, 299), 1);
  assert.equal(frameAt(d, 300), 2);
  assert.equal(frameAt(d, 400), 0);
  assert.equal(frameAt(d, 1350), 1);
});

test("frameAt: 간격이 0이거나 없으면 100ms로 본다(브라우저와 같은 처리)", () => {
  assert.equal(frameAt([0, 0], 150), 1);
  assert.equal(frameAt([], 500), 0);
});

test("isAnimatable: gif·webp·apng만", () => {
  assert.equal(isAnimatable("a/b.GIF"), true);
  assert.equal(isAnimatable("x.webp"), true);
  assert.equal(isAnimatable("x.apng"), true);
  assert.equal(isAnimatable("x.png"), false);
});
