// HTML을 실제 브라우저로 그려 보여 주기 테스트. 실행: node --test test/html.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlShotKey, htmlWidth } from "../kind.js";

test("htmlShotKey: 같은 파일·수정 시각·크기·너비면 같은 이름, 하나라도 다르면 다른 이름", () => {
  const a = htmlShotKey("C:/p/detail-page.html", 100, 16000, 900);
  assert.equal(a, htmlShotKey("C:/p/detail-page.html", 100, 16000, 900));
  assert.notEqual(a, htmlShotKey("C:/p/detail-page.html", 101, 16000, 900));
  assert.notEqual(a, htmlShotKey("C:/p/detail-page.html", 100, 16000, 1000));
  assert.match(a, /^html-[0-9a-f]+-w900$/);
});

test("htmlWidth: 미리보기 폭을 100px 단위로, 480~1280 사이 (창 크기를 조금 바꿔도 다시 그리지 않게)", () => {
  assert.equal(htmlWidth(937), 900);
  assert.equal(htmlWidth(300), 480);
  assert.equal(htmlWidth(2000), 1280);
});
