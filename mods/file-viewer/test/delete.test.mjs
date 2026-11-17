// 트리 우클릭 → 삭제. 이 PC는 휴지통으로, 다른 머신은 rm -r. 실행: node --test test/delete.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { deleteCommand, deleteNotice, psQuote } from "../kind.js";

test("deleteCommand: Windows는 PowerShell로 휴지통(SendToRecycleBin)에, 폴더·파일을 가른다", () => {
  const [cmd, args] = deleteCommand("C:\Users\me\proj\it's.txt", null, "windows");
  assert.equal(cmd, "powershell");
  assert.deepEqual(args.slice(0, 2), ["-NoProfile", "-Command"]);
  assert.match(args[2], /SendToRecycleBin/);
  assert.match(args[2], /DeleteDirectory/);
  assert.match(args[2], /DeleteFile/);
  assert.ok(args[2].endsWith(" " + psQuote("C:\Users\me\proj\it's.txt")));
});

test("deleteCommand: macOS는 Finder 휴지통으로, 경로는 인자로 넘긴다", () => {
  const [cmd, args] = deleteCommand("/Users/me/proj/a b.txt", null, "macos");
  assert.equal(cmd, "osascript");
  assert.match(args.join(" "), /Finder/);
  assert.equal(args.at(-1), "/Users/me/proj/a b.txt");
});

test("deleteCommand: 다른 머신은 휴지통이 없어 rm -r, 경로는 인자로", () => {
  assert.deepEqual(deleteCommand("/home/me/proj/old", "192.168.0.10", "windows"), ["sh", ["-c", 'rm -r -- "$1"', "sh", "/home/me/proj/old"]]);
});

test("deleteCommand: 경로가 비었거나 맨 위(/, 드라이브)면 만들지 않는다", () => {
  for (const bad of ["", "/", "C:\\", "C:/", "C:"]) assert.throws(() => deleteCommand(bad, null, "windows"), bad);
});

test("deleteNotice: 확인 창 글. 이 PC는 휴지통, 다른 머신은 되돌릴 수 없다고", () => {
  assert.match(deleteNotice("a.txt", false, null), /휴지통/);
  assert.match(deleteNotice("old", true, "192.168.0.10"), /되돌릴 수 없/);
  assert.match(deleteNotice("old", true, "192.168.0.10"), /폴더/);
});
