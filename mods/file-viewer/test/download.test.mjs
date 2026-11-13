// 트리 우클릭 메뉴와 다운로드 이름 정하기. 실행: node --test test/download.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { freeName, treeMenu } from "../kind.js";

test("freeName: 다운로드 폴더에 같은 이름이 있으면 Windows처럼 (1), (2)를 붙인다", () => {
  assert.equal(freeName("a.mp4", []), "a.mp4");
  assert.equal(freeName("a.mp4", ["a.mp4"]), "a (1).mp4");
  assert.equal(freeName("a.mp4", ["A.MP4", "a (1).mp4"]), "a (2).mp4");
  assert.equal(freeName("ep2", ["ep2"]), "ep2 (1)");
  assert.equal(freeName(".env", [".env"]), ".env (1)");
  assert.equal(freeName("x.tar.gz", ["x.tar.gz"]), "x.tar (1).gz");
});

test("treeMenu: 다운로드·다운로드 폴더 열기·경로 복사, 그리고 파일은 기본 앱으로 열기, 폴더는 여기를 루트로", () => {
  assert.deepEqual(treeMenu({ dir: false }).map(m => m.id), ["download", "downloads", "copy", "open"]);
  assert.deepEqual(treeMenu({ dir: true }).map(m => m.id), ["download", "downloads", "copy", "root"]);
  assert.ok(treeMenu({ dir: false }).every(m => m.label));
});
