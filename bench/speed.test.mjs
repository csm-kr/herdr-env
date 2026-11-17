// bench/speed.mjs의 계산 부분 테스트. 실행: node --test bench/speed.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { median, ratio, estimate, afterEstimate, extractNodeList, pickTerminal } from "./speed.mjs";

test("median: 홀수 개는 가운데 값, 정렬 안 된 입력도 된다", () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([7, 2, 9, 4, 1, 8, 3]), 4);
});

test("median: 짝수 개는 가운데 둘의 평균", () => {
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test("ratio: 개선 전 ÷ 개선 후, 1ms 미만인 개선 후도 0으로 나누지 않는다", () => {
  assert.equal(ratio(100, 10), "10.0배");
  assert.equal(ratio(120, 0.04), "3000배");
  assert.equal(ratio(50, 0), "∞");
  assert.equal(ratio(10, 20), "0.50배");
});

test("estimate: 프로그램 n번 × S초 + 프로그램 말고 걸린 시간", () => {
  assert.equal(estimate(3, 2), 6);
  assert.equal(estimate(0, 2), 0);
  assert.equal(estimate(1, 3, 0.25), 3.25);
});

test("afterEstimate: 프로그램을 안 띄우면(m=0) 잰 값이 fs 시간이라 더하고, 띄우면 잰 값이 곧 그 프로그램이라 m × S만", () => {
  assert.equal(afterEstimate(0, 3, 0.3), 0.0003);
  assert.equal(afterEstimate(1, 3, 54), 3);
  assert.equal(afterEstimate(2, 3, 120), 6);
});

test("extractNodeList: main.js 글에서 NODE_LIST 문자열을 꺼내고, 없으면 던진다", () => {
  const src = "x\nconst NODE_LIST = 'const fs=require(\"fs\");a';\ny";
  assert.equal(extractNodeList(src), 'const fs=require("fs");a');
  assert.throws(() => extractNodeList("nothing here"));
});

test("pickTerminal: 이 PC의 live 터미널(주소에 / 없음) 중 첫째, 없으면 null", () => {
  const ls = { terminals: [
    { address: "192.168.0.10/t2", state: "live" },
    { address: "t1", state: "finished" },
    { address: "t3", state: "live" },
  ] };
  assert.equal(pickTerminal(ls), "t3");
  assert.equal(pickTerminal({ terminals: [] }), null);
});
