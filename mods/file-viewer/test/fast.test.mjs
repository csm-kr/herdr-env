// 프로그램을 띄우지 않고(fs만으로) 하는 일 테스트. 실행: node --test test/fast.test.mjs
// 회사 PC처럼 프로그램 하나 띄우는 데 2~4초 걸리는 곳에서 목록·프로젝트 루트를 바로 보이게 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findRepoRoot, direntEntries, mergeStats } from "../kind.js";

const fakeExists = paths => async p => paths.includes(p.replace(/\\/g, "/"));

test("findRepoRoot: 위로 올라가며 .git이 있는 첫 폴더와 git의 --show-prefix 같은 prefix", async () => {
  const exists = fakeExists(["/home/me/proj/.git"]);
  assert.deepEqual(await findRepoRoot("/home/me/proj/src/lib", exists), { root: "/home/me/proj", prefix: "src/lib/" });
  assert.deepEqual(await findRepoRoot("/home/me/proj", exists), { root: "/home/me/proj", prefix: "" });
  assert.deepEqual(await findRepoRoot("/home/me/proj/src/", exists), { root: "/home/me/proj", prefix: "src/" });
});

test("findRepoRoot: Windows 경로는 표기(\\)를 그대로 두고, 드라이브 맨 위에서 멈춘다", async () => {
  const exists = fakeExists(["C:/Users/me/Proj/.git"]);
  assert.deepEqual(await findRepoRoot("C:\\Users\\me\\Proj\\Docs", exists), { root: "C:\\Users\\me\\Proj", prefix: "Docs/" });
  assert.deepEqual(await findRepoRoot("C:/Users/me/Proj/Docs", exists), { root: "C:/Users/me/Proj", prefix: "Docs/" });
  const seen = [];
  assert.equal(await findRepoRoot("C:\\Users\\me\\other", async p => { seen.push(p); return false; }), null);
  assert.deepEqual(seen, ["C:\\Users\\me\\other\\.git", "C:\\Users\\me\\.git", "C:\\Users\\.git", "C:\\.git"]);
});

test("findRepoRoot: 저장소 밖이면 null, fs가 못 읽는 곳(홈 밖)이면 예외를 그대로 던져 git으로 넘기게 한다", async () => {
  assert.equal(await findRepoRoot("/tmp/x", fakeExists([])), null);
  await assert.rejects(findRepoRoot("D:\\data", async () => { throw new TypeError("outside every granted read root"); }));
  assert.equal(await findRepoRoot("", fakeExists([])), null);
});

test("direntEntries: fs.readdir 결과를 { name, dir }로, .git은 빼고 501개까지", () => {
  const d = (name, dir) => ({ name, isDirectory: () => dir });
  assert.deepEqual(direntEntries([d("src", true), d(".git", true), d("a.txt", false)]), [{ name: "src", dir: true }, { name: "a.txt", dir: false }]);
  assert.equal(direntEntries(Array.from({ length: 600 }, (_, i) => d(`f${i}`, false))).length, 501);
});

test("mergeStats: 나중에 받은 [이름, 폴더인지, 크기, 시각]을 같은 항목에 채워 넣고, 바뀐 게 있으면 true", () => {
  const entries = [{ name: "a.txt", dir: false }, { name: "link", dir: false }, { name: "gone", dir: false }];
  assert.equal(mergeStats(entries, [["a.txt", false, 12, 1700000000], ["link", true, 0, 1700000001]]), true);
  assert.deepEqual(entries, [
    { name: "a.txt", dir: false, size: 12, mtime: 1700000000 },
    { name: "link", dir: true, size: 0, mtime: 1700000001 },
    { name: "gone", dir: false },
  ]);
  assert.equal(mergeStats(entries, [["a.txt", false, 12, 1700000000]]), false);
});
