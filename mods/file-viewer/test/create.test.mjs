// 트리 우클릭 → 새 파일·새 폴더. 실행: node --test test/create.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createParent, checkNewName, newName, createCommand } from "../kind.js";

test("createParent: 폴더를 우클릭하면 그 안, 파일이면 그 파일이 있는 폴더, 맨 위는 \"\"", () => {
  assert.equal(createParent("src", true), "src");
  assert.equal(createParent("src/lib/a.js", false), "src/lib");
  assert.equal(createParent("a.js", false), "");
  assert.equal(createParent("", true), "");
});

test("newName: 처음 이름은 '새 파일.txt'·'새 폴더', 같은 이름이 있으면 (1)을 붙인다", () => {
  assert.equal(newName("file", []), "새 파일.txt");
  assert.equal(newName("folder", []), "새 폴더");
  assert.equal(newName("file", ["새 파일.txt"]), "새 파일 (1).txt");
  assert.equal(newName("folder", ["새 폴더", "새 폴더 (1)"]), "새 폴더 (2)");
});

test("checkNewName: 괜찮으면 null", () => {
  assert.equal(checkNewName("notes.md", ["a.js"]), null);
  assert.equal(checkNewName(".env", []), null);
  assert.equal(checkNewName("한글 이름.txt", []), null);
});

test("checkNewName: 빈 이름, 경로 구분자, Windows에서 못 쓰는 글자·이름, 끝의 점·공백은 막는다", () => {
  for (const bad of ["", "   ", "a/b", "a\\b", "a:b", "a*b", "a?b", 'a"b', "a<b", "a>b", "a|b", "a\u0001b", ".", "..", "con", "CON.txt", "Lpt1", "nul.md", "a.", "a "]) {
    assert.equal(typeof checkNewName(bad, []), "string", bad);
  }
});

test("checkNewName: 같은 이름이 있으면(대소문자 무시) 막는다", () => {
  assert.match(checkNewName("README.md", ["readme.md"]), /이미/);
});

test("createCommand: 이 PC는 node로, 있는 것은 덮지 않는다(mkdir, wx)", () => {
  const [cmd, args] = createCommand("folder", "C:\\Users\\me\\proj\\새 폴더", null);
  assert.equal(cmd, "node");
  assert.equal(args[0], "-e");
  assert.match(args[1], /mkdirSync/);
  assert.match(args[1], /wx/);
  assert.deepEqual(args.slice(2), ["folder", "C:\\Users\\me\\proj\\새 폴더"]);
});

test("createCommand: 다른 머신은 sh로, 경로는 인자로 넘겨 따옴표 문제가 없게 한다", () => {
  const [cmd, args] = createCommand("file", "/home/me/proj/it's.txt", "192.168.0.10");
  assert.equal(cmd, "sh");
  assert.equal(args[0], "-c");
  assert.match(args[1], /set -C/);
  assert.match(args[1], /mkdir --/);
  assert.deepEqual(args.slice(2), ["sh", "file", "/home/me/proj/it's.txt"]);
});
