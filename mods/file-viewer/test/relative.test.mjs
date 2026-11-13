// 상대 경로(output/html/detail-page.html) 열기 테스트. 실행: node --test test/relative.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRelative, pickNewest } from "../kind.js";

test("parseRelative: 한 줄짜리 상대 경로(폴더/파일.확장자)를 읽는다. 따옴표·백틱과 #t= 시각도", () => {
  assert.deepEqual(parseRelative("output/html/detail-page.html"), { rel: "output/html/detail-page.html", t: 0 });
  assert.deepEqual(parseRelative("  `output/wing/20261113-181310/`  "), { rel: "output/wing/20261113-181310", t: 0 });
  assert.deepEqual(parseRelative("out/a.mp4#t=1:17"), { rel: "out/a.mp4", t: 77 });
  assert.deepEqual(parseRelative("./docs/README.md"), { rel: "docs/README.md", t: 0 });
});

test("parseRelative: 절대 경로·띄어쓰기 있는 글·여러 줄·슬래시 없는 단어는 null", () => {
  assert.equal(parseRelative("/home/me/a.mp4"), null);
  assert.equal(parseRelative("C:\\a\\b.txt"), null);
  assert.equal(parseRelative("상세페이지 HTML 입니다"), null);
  assert.equal(parseRelative("a/b.txt\nc/d.txt"), null);
  assert.equal(parseRelative("README.md"), null);
  assert.equal(parseRelative("https://example.com/a.html"), null);
});

test("pickNewest: 그 경로로 끝나는 파일이 여럿이면 가장 최근에 바뀐 것", () => {
  assert.equal(pickNewest([{ path: "/p/a/output/x.html", mtime: 10 }, { path: "/p/b/output/x.html", mtime: 30 }, { path: "/p/c/output/x.html", mtime: 20 }]), "/p/b/output/x.html");
  assert.equal(pickNewest([]), null);
});

test("parseRelative: 끝의 :줄[:칸] 번호는 떼고 line으로", () => {
  assert.deepEqual(parseRelative("src/a.ts:42"), { rel: "src/a.ts", t: 0, line: 42 });
  assert.deepEqual(parseRelative("src/a.ts:10:5"), { rel: "src/a.ts", t: 0, line: 10 });
  assert.deepEqual(parseRelative("../docs/a.md"), { rel: "../docs/a.md", t: 0 });
});

test("parseOpenRequest: 절대 경로 끝의 :줄 번호도 뗀다", async () => {
  const { parseOpenRequest } = await import("../kind.js");
  assert.equal(parseOpenRequest("/home/x/b.ts:10:5")[0][0].path, "/home/x/b.ts");
  assert.equal(parseOpenRequest("C:\\p\\a.txt:12")[0][0].path, "C:\\p\\a.txt");
});
