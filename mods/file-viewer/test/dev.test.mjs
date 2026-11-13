// 개발용 기능 테스트: CSV 표, 파일 안 검색, 로그 따라가기, git diff. 실행: node --test test/dev.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, findLines, tailLines, parseDiff } from "../kind.js";

test("parseCsv: 쉼표·따옴표·따옴표 안 쉼표와 줄바꿈, 두 따옴표(\"\")", () => {
  assert.deepEqual(parseCsv('cut,start,note\nC01,0.0,"a, b"\nC02,5.2,"say ""hi""\nnext"\n'), [
    ["cut", "start", "note"], ["C01", "0.0", "a, b"], ["C02", "5.2", 'say "hi"\nnext'],
  ]);
});

test("parseCsv: 탭 구분(tsv), CRLF, 행 수 제한", () => {
  assert.deepEqual(parseCsv("a\tb\r\n1\t2\r\n", "\t"), [["a", "b"], ["1", "2"]]);
  assert.equal(parseCsv("x\n1\n2\n3\n4\n", ",", 3).length, 3);
});

test("findLines: 대소문자 무시, 줄 번호(1부터)와 찾은 자리들", () => {
  assert.deepEqual(findLines("alpha\nBeta beta\ngamma", "beta"), [{ line: 2, text: "Beta beta", at: [0, 5] }]);
  assert.deepEqual(findLines("abc", ""), []);
  // 너무 많으면 max개까지만.
  assert.equal(findLines("x\nx\nx\nx", "x", 2).length, 2);
});

test("tailLines: 끝의 n줄, 마지막 빈 줄은 빼고", () => {
  assert.deepEqual(tailLines("a\nb\nc\nd\n", 2), ["c", "d"]);
  assert.deepEqual(tailLines("a\r\nb", 5), ["a", "b"]);
});

test("parseDiff: 줄마다 종류(meta·hunk·add·del·ctx)", () => {
  const d = "diff --git a/x b/x\nindex 1..2 100644\n--- a/x\n+++ b/x\n@@ -1,2 +1,2 @@\n keep\n-old\n+new\n";
  assert.deepEqual(parseDiff(d).map(l => l.kind), ["meta", "meta", "meta", "meta", "hunk", "ctx", "del", "add"]);
  assert.deepEqual(parseDiff(""), []);
});

test("textWidth: 한글·한자·전각은 2칸, 영문·숫자는 1칸", async () => {
  const { textWidth } = await import("../kind.js");
  assert.equal(textWidth("abc"), 3);
  assert.equal(textWidth("덕수가"), 6);
  assert.equal(textWidth("C01 노"), 6);
});

test("showMediaBar: 아래 재생 막대는 A/B 비교(두 개)일 때만. 영상·소리 하나면 띄우지 않는다(화면이 밀린다는 요청)", async () => {
  const { showMediaBar } = await import("../kind.js");
  assert.equal(showMediaBar(null), false);
  assert.equal(showMediaBar({ items: [{}] }), false);
  assert.equal(showMediaBar({ items: [{}, {}] }), true);
});

test("clampTree: 트리 너비는 180px 이상, 미리보기가 320px은 남게", async () => {
  const { clampTree } = await import("../kind.js");
  assert.equal(clampTree(340, 1200), 340);
  assert.equal(clampTree(100, 1200), 180);
  assert.equal(clampTree(1100, 1200), 880);
  // 창이 아주 좁아도 180 아래로는 안 간다.
  assert.equal(clampTree(400, 400), 180);
});
