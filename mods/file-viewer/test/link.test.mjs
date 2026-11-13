// herdrview: 링크(Ctrl+클릭) 해석 테스트. 실행: node --test test/link.test.mjs
// 처리기(herdr-link.js)는 "<받은 시각 ms>\n<주소>"를 link.txt에 UTF-8(BOM 포함)로 적는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLinkRequest } from "../kind.js";

const NOW = 1794548050000;
const rec = (url, stamp = NOW - 1000) => `\uFEFF${stamp}\n${url}`;

test("머신 칸이 비면 machine은 null이고, 경로와 #t= 시각을 읽는다", () => {
  assert.deepEqual(parseLinkRequest(rec("herdrview:///home/me/out/a.mp4#t=77"), NOW),
    { stamp: NOW - 1000, machine: null, path: "/home/me/out/a.mp4", t: 77 });
});

test("머신 칸이 있으면 그 머신이고, 1:17 같은 시각도 읽는다", () => {
  assert.deepEqual(parseLinkRequest(rec("herdrview://192.168.0.10/home/me/a.mp4#t=1:17"), NOW),
    { stamp: NOW - 1000, machine: "192.168.0.10", path: "/home/me/a.mp4", t: 77 });
});

test("%인코딩(띄어쓰기·한글)을 풀고, 인코딩 안 된 한글도 그대로 둔다", () => {
  assert.equal(parseLinkRequest(rec("herdrview:///home/me/a%20b/%EB%B7%B0%EC%96%B4.mp4"), NOW).path, "/home/me/a b/뷰어.mp4");
  assert.equal(parseLinkRequest(rec("herdrview:///home/me/뷰어.mp4"), NOW).path, "/home/me/뷰어.mp4");
});

test("Windows 경로는 앞의 / 를 떼고, 시각이 없으면 0", () => {
  assert.deepEqual(parseLinkRequest(rec("herdrview:///C:/Users/me/a.png"), NOW),
    { stamp: NOW - 1000, machine: null, path: "C:/Users/me/a.png", t: 0 });
});

test("Windows가 주소 이름을 대문자로 넘겨도 받는다", () => {
  assert.equal(parseLinkRequest(rec("HerdrView:///home/a.mp4"), NOW).path, "/home/a.mp4");
});

test("오래된 기록(10초 넘음)이나 망가진 기록은 null", () => {
  assert.equal(parseLinkRequest(rec("herdrview:///home/a.mp4", NOW - 11000), NOW), null);
  assert.equal(parseLinkRequest("", NOW), null);
  assert.equal(parseLinkRequest(rec("https://example.com/a.mp4"), NOW), null);
  assert.equal(parseLinkRequest(`abc\nherdrview:///home/a.mp4`, NOW), null);
  assert.equal(parseLinkRequest(rec("herdrview://host"), NOW), null);
});
