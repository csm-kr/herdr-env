// 4단계(사용성) 테스트. 실행: node --test test/ux.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { gitMarks, findLines } from "../kind.js";

test("gitMarks: 저장소 기준 경로에서 지금 폴더 앞부분(prefix)을 떼고, 보는 폴더 문자열(root) 그대로 키를 만든다", () => {
  const z = " M sub/a.txt\0?? sub/new.md\0 D other/x.js\0";
  // Windows 터미널 경로(역슬래시)와 git 경로(슬래시)가 달라도 맞는다.
  assert.deepEqual(gitMarks(z, "sub/", "C:\Users\me\repo\sub"), {
    "C:\Users\me\repo\sub/a.txt": "M",
    "C:\Users\me\repo\sub/new.md": "A",
  });
  // prefix가 없으면(저장소 최상위) 전부.
  assert.equal(Object.keys(gitMarks(z, "", "/home/me/ep2")).length, 3);
});

test("findLines: 소문자로 바꿀 때 길이가 바뀌는 글자(İ)가 있어도 강조 위치가 맞는다", () => {
  const [hit] = findLines("xİstanbul foo", "foo");
  assert.equal("xİstanbul foo".slice(hit.at[0], hit.at[0] + 3), "foo");
});
