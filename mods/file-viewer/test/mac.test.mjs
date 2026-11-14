// macOS에서도 돌게 한 부분: 경로 표기와 셸 없이 넘기는 ffplay 인자.
import test from "node:test";
import assert from "node:assert/strict";
import { localPath, ffplayArgv } from "../kind.js";

test("localPath: Windows만 \\ 로 바꾸고, macOS·리눅스 경로는 그대로 둔다", () => {
  assert.equal(localPath("C:/Users/me/a b/c.png", "windows"), "C:\\Users\\me\\a b\\c.png");
  assert.equal(localPath("/Users/me/a b/c.png", "macos"), "/Users/me/a b/c.png");
  assert.equal(localPath("/home/me/c.png", "linux"), "/home/me/c.png");
});

test("ffplayArgv: 소리는 창 없이, 영상은 파일 이름을 제목으로 단 높이 720 창으로 (인자 배열)", () => {
  assert.deepEqual(ffplayArgv("/Users/me/음악/a b.mp3", 12.5, false), ["-autoexit", "-loglevel", "quiet", "-ss", "12.5", "-nodisp", "-i", "/Users/me/음악/a b.mp3"]);
  assert.deepEqual(ffplayArgv("/v/clip 1.mp4", 0, true), ["-autoexit", "-loglevel", "quiet", "-ss", "0", "-window_title", "clip 1.mp4", "-y", "720", "-i", "/v/clip 1.mp4"]);
});

test("ffplayArgv: 배열로 넘기므로 큰따옴표나 옵션처럼 보이는 이름도 경로 한 칸에 그대로 들어간다", () => {
  const args = ffplayArgv('/v/a" -f lavfi -i x.mp4', 0, false);
  assert.equal(args.at(-1), '/v/a" -f lavfi -i x.mp4');
  assert.equal(args.at(-2), "-i");
  assert.equal(args.length, 8);
});

test("ffplayArgv: sftp 주소는 그대로 두고 마지막 이름을 제목으로 쓴다", () => {
  assert.deepEqual(ffplayArgv("sftp://me@h/v/clip 1.mp4", 3, true).slice(4), ["3", "-window_title", "clip 1.mp4", "-y", "720", "-i", "sftp://me@h/v/clip 1.mp4"]);
});
