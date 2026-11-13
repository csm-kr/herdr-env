// 화면 폭에서 "/" 자리로 꺾인 긴 경로와 심볼릭 링크 폴더 테스트. 실행: node --test test/wrap.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOpenRequest, remoteListArgs } from "../kind.js";

const full = "/home/me/workspace/video-project/docs/storyboard-video/projects/demo-ep2-20261112/review/preview/takes-so-far.txt";

test("두 번째 줄이 / 로 시작해도, 앞줄이 끝나지 않은 경로면 이어 붙인 후보(joined)를 먼저 낸다", () => {
  const r = parseOpenRequest("  /home/me\n  /workspace/video-project/docs/storyboard-video/projects/demo-ep2-20261112/review/preview/takes-so-far.txt\n");
  assert.deepEqual(r[0][0], { path: full, t: 0, joined: true });
  assert.deepEqual(r[0].at(-1), { path: "/home/me", t: 0 });
  // 붙인 게 없으면 A/B로 쓸 수 있게 두 번째 경로도 남긴다.
  assert.equal(r[1][0].path, "/workspace/video-project/docs/storyboard-video/projects/demo-ep2-20261112/review/preview/takes-so-far.txt");
});

test("#t= 가 뒷줄로 넘어가도 이어 붙인다", () => {
  const r = parseOpenRequest("/home/me/ep2\n/takes-so-far.mp4#t=77");
  assert.deepEqual(r[0][0], { path: "/home/me/ep2/takes-so-far.mp4", t: 77, joined: true });
});

test("앞줄이 #t= 나 닫는 따옴표·쉼표로 끝나면 끝난 경로라서 붙이지 않는다(A/B 그대로)", () => {
  assert.deepEqual(parseOpenRequest("/a/v1.mp4#t=81\n/a/v2.mp4#t=81"), [[{ path: "/a/v1.mp4", t: 81 }], [{ path: "/a/v2.mp4", t: 81 }]]);
  assert.deepEqual(parseOpenRequest("`/a/v1.mp4`,\n/a/v2.mp4"), [[{ path: "/a/v1.mp4", t: 0 }], [{ path: "/a/v2.mp4", t: 0 }]]);
});

test("원격 폴더 목록은 find -H 로 읽어서 심볼릭 링크 폴더(~/ep2)도 따라간다", () => {
  assert.deepEqual(remoteListArgs("/home/me/ep2"), ["-H", "/home/me/ep2", "-mindepth", "1", "-maxdepth", "1", "-not", "-name", ".git", "-printf", "%Y\\t%s\\t%T@\\t%f\\0"]);
});
