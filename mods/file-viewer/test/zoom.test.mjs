// 사진 확대·축소 테스트. 실행: node --test test/zoom.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { zoomStep } from "../kind.js";

test("zoomStep: 정해진 단계로 한 칸씩 키우고 줄인다", () => {
  assert.equal(zoomStep(1, 1, 0.5), 1.5);
  assert.equal(zoomStep(1, -1, 0.5), 0.75);
  assert.equal(zoomStep(8, 1, 0.5), 8);
  assert.equal(zoomStep(0.1, -1, 0.5), 0.1);
});

test("zoomStep: 맞춤(null)에서는 지금 맞춤 배율 바로 다음 단계로", () => {
  assert.equal(zoomStep(null, 1, 0.42), 0.5);
  assert.equal(zoomStep(null, -1, 0.42), 0.25);
  assert.equal(zoomStep(null, 1, 1), 1.5);
});
