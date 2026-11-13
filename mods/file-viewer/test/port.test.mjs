// 5단계(이식성) 테스트. 실행: node --test test/port.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mpvCandidates } from "../kind.js";

test("mpvCandidates: Windows 흔한 설치 위치(winget·Program Files·scoop)", () => {
  const list = mpvCandidates("windows", "C:/Users/me");
  assert.ok(list.includes("C:/Program Files/MPV Player/mpv.exe"));
  assert.ok(list.includes("C:/Program Files/mpv/mpv.exe"));
  assert.ok(list.includes("C:/Users/me/scoop/apps/mpv/current/mpv.exe"));
});

test("mpvCandidates: macOS·리눅스", () => {
  assert.ok(mpvCandidates("macos", "/Users/me").includes("/opt/homebrew/bin/mpv"));
  assert.ok(mpvCandidates("linux", "/home/me").includes("/usr/bin/mpv"));
});
