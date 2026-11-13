// "No folder" 막기 테스트. 실행: node --test test/folder.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { machineCandidates, pickFolder } from "../kind.js";

const remotes = ["192.168.0.10"];

test("Windows 경로는 이 PC(null)에서만 찾는다", () => {
  assert.deepEqual(machineCandidates("C:/Users/me/a.png", "192.168.0.10", remotes, true), [null]);
});

test("리눅스 경로: 링크·포커스가 정한 머신이 있으면 그 머신 먼저, 그다음 나머지", () => {
  assert.deepEqual(machineCandidates("/home/a.mp4", "192.168.0.10", remotes, true), ["192.168.0.10"]);
  assert.deepEqual(machineCandidates("/home/a.mp4", "m2", ["m1", "m2"], true), ["m2", "m1"]);
});

test("이 PC가 Windows면 리눅스 경로는 이 PC에 없으니 다른 머신들에서 찾는다", () => {
  assert.deepEqual(machineCandidates("/home/a.mp4", null, remotes, true), ["192.168.0.10"]);
  // 다른 머신이 없으면 어쩔 수 없이 이 PC.
  assert.deepEqual(machineCandidates("/home/a.mp4", null, [], true), [null]);
});

test("이 PC가 Windows가 아니면 리눅스 경로도 이 PC 먼저", () => {
  assert.deepEqual(machineCandidates("/home/a.mp4", null, remotes, false), [null, "192.168.0.10"]);
});

const space = { id: "sp1", folder: "C:\\Users\\me", machine: null };

test("트리 폴더: 이 스페이스에서 마지막으로 보낸 폴더가 먼저", () => {
  assert.deepEqual(pickFolder({ tree: { space: "sp1", cwd: "/home/x", on: "192.168.0.10" }, space, cwds: ["C:\\work"] }),
    { cwd: "/home/x", on: "192.168.0.10" });
});

test("트리 폴더: 다른 스페이스 기록은 무시하고, 이 스페이스 터미널의 폴더, 없으면 스페이스 폴더", () => {
  assert.deepEqual(pickFolder({ tree: { space: "sp2", cwd: "/home/x", on: null }, space, cwds: ["C:\\work"] }), { cwd: "C:\\work", on: null });
  assert.deepEqual(pickFolder({ tree: null, space, cwds: [] }), { cwd: "C:\\Users\\me", on: null });
  assert.deepEqual(pickFolder({ tree: null, space: { id: "r", folder: "", machine: "m" }, cwds: ["/srv"] }), { cwd: "/srv", on: "m" });
});
