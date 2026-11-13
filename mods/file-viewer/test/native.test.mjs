// 영상 재생: 미리보기 장면 자리에 Herdr에 딸린(owned) 테두리 없는 mpv 창을 붙인다. 실행: node --test test/native.test.mjs
// 장면 위치를 모르면(▶를 누르지 않고 명령으로 틀 때) 보통 mpv 창(화면 가운데, 70%)으로 튼다.
// Herdr 안 터미널(kitty) 재생은 1080p에서 끊겼고, 처음 만든 장면 자리 창은 커서 좌표로 위치를 구해 어긋났다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mpvWindowArgs, mpvDockArgs, quoteArgs, dockRect, dockLine } from "../kind.js";

test("mpvWindowArgs: 바로 창을 띄우고, 화면 가운데 70% 크기, 제목, 시작 시각", () => {
  assert.deepEqual(mpvWindowArgs({ src: "sftp://u@h/a.mp4", at: 77, title: "a.mp4" }), [
    "--force-window=immediate", "--keep-open=no", "--autofit=70%x70%", "--geometry=50%:50%", "--title=a.mp4", "--start=77", "sftp://u@h/a.mp4",
  ]);
  assert.ok(!mpvWindowArgs({ src: "C:\\a.mp4", at: 0, title: "a" }).some(a => a.startsWith("--start")));
});

test("mpvDockArgs: 테두리 없이, 창 크기를 영상에 맞춰 바꾸지 않고, 멈춤용 파이프를 연다", () => {
  assert.deepEqual(mpvDockArgs({ src: "C:\\a.mp4", at: 5, title: "a.mp4", ipc: "\\\\.\\pipe\\herdr-mpv-1" }), [
    "--force-window=immediate", "--keep-open=no", "--no-border", "--auto-window-resize=no", "--geometry=1x1+-32000+-32000",
    "--input-ipc-server=\\\\.\\pipe\\herdr-mpv-1", "--title=a.mp4", "--start=5", "C:\\a.mp4",
  ]);
});

test("quoteArgs: 모두 큰따옴표로 감싸 한 줄로, 큰따옴표가 든 인자는 거부", () => {
  assert.equal(quoteArgs(["--title=a b", "C:\\v\\x&y.mp4"]), '"--title=a b" "C:\\v\\x&y.mp4"');
  assert.throws(() => quoteArgs(['a"b']), /큰따옴표/);
});

// ▶를 누른 순간의 장면(창 좌표)을 기준으로, 그 뒤 바뀐 트리 너비·뷰어 크기·뷰어 위치만큼 옮긴다.
// 미리보기 칸은 [트리 끝, 뷰어 오른쪽] 사이 가운데에, 위아래로도 가운데에 장면을 놓는다.
const anchor = { poster: { x: 779, y: 287, width: 960, height: 540 }, root: { x: 400, y: 80, width: 1500, height: 900 }, tree: 345 };

test("dockRect: 아무것도 안 바뀌면 누른 그 자리", () => {
  assert.deepEqual(dockRect(anchor, { root: anchor.root, tree: 345, poster: { w: 960, h: 540 } }), { x: 779, y: 287, w: 960, h: 540 });
});

test("dockRect: 트리를 100 넓히면 미리보기 칸 가운데가 50 오른쪽으로, 장면은 줄어든 크기로", () => {
  assert.deepEqual(dockRect(anchor, { root: anchor.root, tree: 445, poster: { w: 860, h: 484 } }), { x: 879, y: 315, w: 860, h: 484 });
});

test("dockRect: 뷰어가 커지고(창 키움) 옮겨지면(사이드바 접힘) 그만큼 따라간다", () => {
  const root = { x: 300, y: 80, width: 1700, height: 1000 };
  assert.deepEqual(dockRect(anchor, { root, tree: 345, poster: { w: 960, h: 540 } }), { x: 779 - 100 + 100, y: 287 + 50, w: 960, h: 540 });
});

test("dockLine: 도우미가 읽는 한 줄 \"x y w h 보임\"", () => {
  assert.equal(dockLine({ x: 10.4, y: 20, w: 300, h: 200 }, true), "10 20 300 200 1");
  assert.equal(dockLine({ x: 10, y: 20, w: 300, h: 200 }, false), "10 20 300 200 0");
  assert.equal(dockLine(null, false), "0 0 0 0 0");
});
