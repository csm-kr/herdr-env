// 터미널 화면 글에서 열 수 있는 경로 찾기 테스트. 실행: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPaths } from "../kind.js";

const texts = list => list.map(c => c.text);

test("절대(리눅스·Windows)·상대 경로를 찾고, 아래쪽(최근) 것부터", () => {
  const screen = [
    "결과는 /home/me/ep2/takes-so-far.mp4#t=77 에 있어요.",
    "본편: D:\\Uploads\\demo-ep2-v1.mp4",
    "│ 상세페이지 HTML │ output/html/detail-page.html │",
    "Wing 업로드용 output/wing/20261113-181310/ 폴더",
  ].join("\n");
  assert.deepEqual(texts(extractPaths(screen)), [
    "output/wing/20261113-181310/",
    "output/html/detail-page.html",
    "D:\\Uploads\\demo-ep2-v1.mp4",
    "/home/me/ep2/takes-so-far.mp4#t=77",
  ]);
});

test("따옴표·백틱·괄호·끝 문장부호는 떼고, 같은 경로는 한 번만", () => {
  const screen = "(`/a/b/c.txt`), 그리고 \"src/main.js\".\n다시 /a/b/c.txt";
  assert.deepEqual(texts(extractPaths(screen)), ["/a/b/c.txt", "src/main.js"]);
});

test("URL·분수·날짜·낱말은 경로가 아니다", () => {
  const screen = "https://example.com/a.html 1/2 2026/11/13 README.md and/or";
  assert.deepEqual(texts(extractPaths(screen)), []);
});

test("줄 끝에서 꺾인 경로는 다음 줄 첫 조각을 이어 붙인 후보도 낸다", () => {
  const screen = "  /home/me\n  /workspace/video-project/out/a.mp4\n";
  const got = texts(extractPaths(screen));
  assert.ok(got.includes("/home/me/workspace/video-project/out/a.mp4"));
  assert.ok(got.includes("/workspace/video-project/out/a.mp4"));
});

test("최대 개수", () => {
  const screen = Array.from({ length: 100 }, (_, i) => `/p/f${i}.txt`).join("\n");
  assert.equal(extractPaths(screen, 10).length, 10);
});

test("정규식 조각(^ $ * + ? | { } [ ])은 경로가 아니다", () => {
  const screen = "const ABS = /^\/[^/\s]+\/[^\s]*$/, R = /^[A-Za-z]:[\\/]/; s.replace(/^[`'\"(<\[{]+/, \"\")";
  assert.deepEqual(texts(extractPaths(screen)), []);
});

test("Write(경로)·Read(경로)처럼 이름 뒤 괄호 속 경로는 괄호 속만", () => {
  assert.deepEqual(texts(extractPaths("Write(~/.config/herdr-app/mods/path-picker/kind.js)")), ["~/.config/herdr-app/mods/path-picker/kind.js"]);
});

test(":줄[:칸] 번호가 붙은 경로도 잡고, 번호는 뗀다", () => {
  assert.deepEqual(texts(extractPaths("오류: src/a.ts:42 와 /home/x/b.ts:10:5")), ["/home/x/b.ts", "src/a.ts"]);
});

test("마크다운 링크 [이름](경로), 따옴표 안 띄어쓰기 경로, file:/// 주소", () => {
  assert.deepEqual(texts(extractPaths("[a.ts](src/a.ts)")), ["src/a.ts"]);
  assert.deepEqual(texts(extractPaths('저장: "C:\\Users\\me\\My Docs\\out.png"')), ["C:\\Users\\me\\My Docs\\out.png"]);
  assert.deepEqual(texts(extractPaths("file:///C:/Users/me/a%20b.png")), ["C:/Users/me/a b.png"]);
  assert.deepEqual(texts(extractPaths("file:///home/me/a.txt")), ["/home/me/a.txt"]);
});

test("~ 로 시작하면 홈 기준이라 절대 경로로 본다(home을 주면 펼친다)", async () => {
  const { expandHome } = await import("../kind.js");
  assert.equal(expandHome("~/.config/a.js", "C:/Users/me"), "C:/Users/me/.config/a.js");
  assert.equal(expandHome("~\\.config\\a.js", "C:\\Users\\me"), "C:\\Users\\me\\.config\\a.js");
  assert.equal(expandHome("src/a.js", "C:/Users/me"), "src/a.js");
});
