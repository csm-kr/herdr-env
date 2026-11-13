// 1단계(데이터 손실·주입) 테스트. 실행: node --test test/safety.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { ffplayArgs } from "../kind.js";

test("ffplayArgs: 이름에 큰따옴표가 있으면 인자가 깨지므로 거부한다", () => {
  assert.throws(() => ffplayArgs('C:/v/a" -f lavfi -i x.mp4', 0, true), /큰따옴표/);
  assert.ok(ffplayArgs("C:/v/a b.mp4", 5, false).endsWith(`-ss 5 -nodisp -i "C:${String.fromCharCode(92)}v${String.fromCharCode(92)}a b.mp4"`));
});
