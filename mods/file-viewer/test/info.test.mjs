// 파일 정보(크기·날짜·해상도·미디어 요약)와 폴더 목록 읽기 테스트. 실행: node --test test/info.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSize, formatDate, parseFindListing, imageSize, mediaSummary } from "../kind.js";

test("formatSize는 B, KB, MB, GB로 짧게 쓴다", () => {
  assert.equal(formatSize(0), "0 B");
  assert.equal(formatSize(900), "900 B");
  assert.equal(formatSize(2476), "2.4 KB");
  assert.equal(formatSize(397618265), "379 MB");
  assert.equal(formatSize(2993650749), "2.8 GB");
});

test("formatDate는 올해면 월-일 시:분, 아니면 연-월-일", () => {
  const now = new Date(2026, 10, 13, 12, 0);
  assert.equal(formatDate(new Date(2026, 10, 13, 10, 35).getTime() / 1000, now), "11-13 10:35");
  assert.equal(formatDate(new Date(2025, 0, 2, 3, 4).getTime() / 1000, now), "2025-01-02");
  assert.equal(formatDate(0, now), "");
});

test("parseFindListing은 find -printf '%Y\\t%s\\t%T@\\t%f\\0' 출력을 읽는다", () => {
  const out = "f\t397618265\t1794250222.6584798990\tep1 v1.mp4\0d\t4096\t1794250000.1\tout\0";
  assert.deepEqual(parseFindListing(out), [
    { name: "ep1 v1.mp4", dir: false, size: 397618265, mtime: 1794250222 },
    { name: "out", dir: true, size: 4096, mtime: 1794250000 },
  ]);
});

test("imageSize는 PNG, GIF, BMP, JPEG, WebP 머리에서 너비와 높이를 읽는다", () => {
  const png = new Uint8Array(24); png.set([0x89, 0x50, 0x4e, 0x47], 0); png.set([0, 0, 3, 0xc0, 0, 0, 2, 0x1c], 16);
  assert.deepEqual(imageSize(png), { w: 960, h: 540 });
  const gif = new Uint8Array(10); gif.set([0x47, 0x49, 0x46, 0x38], 0); gif.set([0x40, 0x01, 0xf0, 0x00], 6);
  assert.deepEqual(imageSize(gif), { w: 320, h: 240 });
  const bmp = new Uint8Array(26); bmp.set([0x42, 0x4d], 0); bmp.set([0x80, 0x02, 0, 0, 0x20, 0xfe, 0xff, 0xff], 18);
  assert.deepEqual(imageSize(bmp), { w: 640, h: 480 });
  // JPEG: SOI, APP0(길이 4), SOF0(높이 538, 너비 960)
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x02, 0x1a, 0x03, 0xc0, 3, 0, 0, 0]);
  assert.deepEqual(imageSize(jpg), { w: 960, h: 538 });
  // WebP VP8X: 캔버스 너비-1, 높이-1이 24번째부터 3바이트씩
  const webp = new Uint8Array(30); webp.set([0x52, 0x49, 0x46, 0x46], 0); webp.set([0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58], 8); webp.set([0x7f, 0x02, 0, 0x67, 0x01, 0], 24);
  assert.deepEqual(imageSize(webp), { w: 640, h: 360 });
  assert.deepEqual(imageSize(new Uint8Array([1, 2, 3])), { w: 0, h: 0 });
});

test("mediaSummary는 ffprobe JSON을 한 줄로 요약한다", () => {
  const video = { format: { duration: "231.0", bit_rate: "103600000" }, streams: [
    { codec_type: "video", codec_name: "h264", pix_fmt: "yuv420p", width: 3840, height: 2160, avg_frame_rate: "48/1" },
    { codec_type: "audio", codec_name: "aac", sample_rate: "48000", channels: 2 },
  ] };
  assert.equal(mediaSummary(video), "3840×2160 · 48 fps · h264 yuv420p · 3:51 · 104 Mb/s · aac 48 kHz 2ch");
  // 소리 트랙이 없는 영상(edit/clean mkv)은 그렇다고 적는다.
  assert.equal(mediaSummary({ format: { duration: "4.4" }, streams: [{ codec_type: "video", codec_name: "prores", pix_fmt: "yuva444p12le", width: 1824, height: 1024, avg_frame_rate: "24/1" }] }),
    "1824×1024 · 24 fps · prores yuva444p12le · 0:04 · 소리 없음");
  const audio = { format: { duration: "81.5" }, streams: [{ codec_type: "audio", codec_name: "pcm_s16le", sample_rate: "44100", channels: 1 }] };
  assert.equal(mediaSummary(audio), "1:21 · pcm_s16le 44.1 kHz 1ch");
  // 29.97처럼 나누어떨어지지 않는 fps는 소수 둘째 자리까지.
  assert.match(mediaSummary({ format: {}, streams: [{ codec_type: "video", codec_name: "hevc", width: 1080, height: 1920, avg_frame_rate: "30000/1001" }] }), /^1080×1920 · 29\.97 fps · hevc · 소리 없음$/);
  assert.equal(mediaSummary(null), "");
});
