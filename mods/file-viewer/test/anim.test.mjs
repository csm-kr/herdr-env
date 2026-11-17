// 움직이는 GIF·WebP 테스트. 실행: node --test test/anim.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { frameAt, isAnimatable, animByFfmpeg, animFfmpegArgs, animDurations } from "../kind.js";

test("frameAt: 프레임별 간격(ms)을 따라 지난 시간에 맞는 프레임, 끝나면 처음부터", () => {
  const d = [100, 200, 100]; // 합 400
  assert.equal(frameAt(d, 0), 0);
  assert.equal(frameAt(d, 99), 0);
  assert.equal(frameAt(d, 100), 1);
  assert.equal(frameAt(d, 299), 1);
  assert.equal(frameAt(d, 300), 2);
  assert.equal(frameAt(d, 400), 0);
  assert.equal(frameAt(d, 1350), 1);
});

test("frameAt: 간격이 0이거나 없으면 100ms로 본다(브라우저와 같은 처리)", () => {
  assert.equal(frameAt([0, 0], 150), 1);
  assert.equal(frameAt([], 500), 0);
});

test("isAnimatable: gif·webp·apng만", () => {
  assert.equal(isAnimatable("a/b.GIF"), true);
  assert.equal(isAnimatable("x.webp"), true);
  assert.equal(isAnimatable("x.apng"), true);
  assert.equal(isAnimatable("x.png"), false);
});

test("animByFfmpeg: GIF·APNG는 ffmpeg로 푼다(Chrome보다 8~10배 빠르다). 움직이는 WebP는 ffmpeg가 못 풀어 Chrome으로", () => {
  assert.equal(animByFfmpeg("a/b.GIF"), true);
  assert.equal(animByFfmpeg("x.apng"), true);
  assert.equal(animByFfmpeg("x.webp"), false);
});

test("animFfmpegArgs: 프레임마다 PNG 하나(000부터), 폭은 800까지 줄이고 비율은 그대로, 150장까지", () => {
  const args = animFfmpegArgs("C:\Users\me\a.gif", "C:\Users\me\cache\anim-1-w800", 800);
  assert.deepEqual(args, ["-y", "-v", "error", "-i", "C:\Users\me\a.gif", "-frames:v", "150", "-fps_mode", "passthrough",
    "-vf", "scale='min(800,iw)':-1", "-start_number", "0", "C:\Users\me\cache\anim-1-w800-%03d.png"]);
});

test("animDurations: ffprobe의 프레임별 duration_time(초)을 ms로, 못 읽은 줄은 0(frameAt이 100ms로 본다)", () => {
  assert.deepEqual(animDurations("0.070000\r\n0.060000\nN/A\n\n"), [70, 60, 0]);
  assert.deepEqual(animDurations(""), []);
  assert.equal(animDurations(Array(200).fill("0.1").join("\n")).length, 150);
});
