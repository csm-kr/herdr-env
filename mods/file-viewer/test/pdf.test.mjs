// PDF 미리보기: Poppler(pdfinfo·pdftoppm·pdftotext)로 쪽 그림과 글을 만든다. 실행: node --test test/pdf.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { kindOf, parsePdfInfo, pdfNext, pdfPageFile, pdftoppmArgs, popplerCandidates, pdfKey, htmlShotKey } from "../kind.js";

test("kindOf: .pdf는 pdf", () => {
  assert.equal(kindOf("a/b/Report.PDF"), "pdf");
});

test("parsePdfInfo: 쪽 수와 제목, 쪽 크기를 읽는다", () => {
  const out = "Title:           시험 문서\r\nCreator:         x\r\nPages:           25\r\nEncrypted:       no\r\nPage size:       612 x 792 pts (letter)\r\n";
  assert.deepEqual(parsePdfInfo(out), { pages: 25, title: "시험 문서", w: 612, h: 792 });
  assert.deepEqual(parsePdfInfo("Pages: 3\n"), { pages: 3, title: "", w: 0, h: 0 });
  assert.equal(parsePdfInfo("Syntax Error"), null);
});

test("pdfNext: 5쪽씩, 정한 한도(limit)까지 그리고, 다 그렸으면 null", () => {
  assert.deepEqual(pdfNext(25, 0, 20), { first: 1, last: 5 });
  assert.deepEqual(pdfNext(25, 15, 20), { first: 16, last: 20 });
  assert.equal(pdfNext(25, 20, 20), null);
  assert.deepEqual(pdfNext(25, 20, 40), { first: 21, last: 25 });
  assert.equal(pdfNext(25, 25, 40), null);
  assert.deepEqual(pdfNext(3, 0, 20), { first: 1, last: 3 });
});

test("pdfPageFile: pdftoppm은 쪽 번호를 전체 쪽 수의 자릿수로 0을 채워 붙인다", () => {
  assert.equal(pdfPageFile("c/pdf-1", 8, 25), "c/pdf-1-08.png");
  assert.equal(pdfPageFile("c/pdf-1", 3, 9), "c/pdf-1-3.png");
  assert.equal(pdfPageFile("c/pdf-1", 7, 120), "c/pdf-1-007.png");
});

test("pdftoppmArgs: PNG, 쪽 범위, 너비 맞춤(높이는 비율), 경고 끄기", () => {
  assert.deepEqual(pdftoppmArgs({ src: "C:\\a.pdf", prefix: "C:\\c\\pdf-1", first: 6, last: 10, width: 1100 }),
    ["-q", "-png", "-f", "6", "-l", "10", "-scale-to-x", "1100", "-scale-to-y", "-1", "C:\\a.pdf", "C:\\c\\pdf-1"]);
});

test("pdfKey: 경로·수정 시각·크기·너비로 정하고 HTML 캐시와 이름이 겹치지 않는다", () => {
  const k = pdfKey("C:/a.pdf", 10, 20, 1100);
  assert.match(k, /^pdf-[0-9a-f]+-w1100$/);
  assert.equal(k, pdfKey("C:/a.pdf", 10, 20, 1100));
  assert.notEqual(k, pdfKey("C:/a.pdf", 11, 20, 1100));
  assert.notEqual(k.replace(/^pdf-/, ""), htmlShotKey("C:/b.pdf", 10, 20, 1100).replace(/^html-/, ""));
});

test("popplerCandidates: PATH에 없을 때 찾아볼 pdftoppm 자리(scoop·choco·Homebrew)", () => {
  assert.ok(popplerCandidates("windows", "C:/Users/me").includes("C:/Users/me/scoop/apps/poppler/current/bin/pdftoppm.exe"));
  assert.ok(popplerCandidates("macos", "/Users/me").includes("/opt/homebrew/bin/pdftoppm"));
});
