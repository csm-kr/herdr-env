// 3단계(성능) 테스트. 실행: node --test test/perf.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { cacheToDelete, csvWidths } from "../kind.js";

const DAY = 86400000, now = 100 * DAY;

test("cacheToDelete: 3일 넘은 파일은 지운다", () => {
  const files = [{ path: "a", size: 10, mtime: now - 4 * DAY }, { path: "b", size: 10, mtime: now - DAY }];
  assert.deepEqual(cacheToDelete(files, now), ["a"]);
});

test("cacheToDelete: 그래도 상한을 넘으면 오래된 것부터 지운다", () => {
  const files = [
    { path: "old", size: 300, mtime: now - 2 * DAY },
    { path: "mid", size: 300, mtime: now - DAY },
    { path: "new", size: 300, mtime: now - 1000 },
  ];
  assert.deepEqual(cacheToDelete(files, now, { maxBytes: 700 }), ["old"]);
  assert.deepEqual(cacheToDelete(files, now, { maxBytes: 300 }), ["old", "mid"]);
});

test("csvWidths: 열마다 가장 넓은 글(한글 2칸, 최대 48칸)로 너비를 한 번만 계산", () => {
  const w = csvWidths([["cut", "note"], ["C01", "배 위"]]);
  assert.equal(w.length, 2);
  assert.equal(w[0], 3 * 7.4 + 18);
  assert.equal(w[1], 5 * 7.4 + 18);
});

test("extOf: 마지막 이름에서만 확장자를 소문자로 (폴더 이름의 점은 무시)", async () => {
  const { extOf } = await import("../kind.js");
  assert.equal(extOf("out/a.CSV"), "csv");
  assert.equal(extOf("proj.v2/Makefile"), "");
  assert.equal(extOf("report_csv"), "");
  assert.equal(extOf(".gitignore"), "");
  assert.equal(extOf("a/b.tar.gz"), "gz");
});
