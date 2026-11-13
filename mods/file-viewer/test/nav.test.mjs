// 경로 막대(탐색기처럼 눌러서 그 폴더로 가기) 테스트. 실행: node --test test/nav.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { breadcrumbs } from "../kind.js";

test("breadcrumbs는 리눅스 경로를 / 부터 한 칸씩 갈 수 있는 경로로 나눈다", () => {
  assert.deepEqual(breadcrumbs("/home/me/out"), [
    { label: "/", path: "/" }, { label: "home", path: "/home" }, { label: "me", path: "/home/me" }, { label: "out", path: "/home/me/out" },
  ]);
  assert.deepEqual(breadcrumbs("/"), [{ label: "/", path: "/" }]);
  // 끝의 / 는 무시한다.
  assert.deepEqual(breadcrumbs("/a/"), [{ label: "/", path: "/" }, { label: "a", path: "/a" }]);
});

test("breadcrumbs는 Windows 경로를 드라이브부터 나누고, 원래 쓰던 구분자를 따른다", () => {
  assert.deepEqual(breadcrumbs("C:\\Users\\me"), [
    { label: "C:", path: "C:\\" }, { label: "Users", path: "C:\\Users" }, { label: "me", path: "C:\\Users\\me" },
  ]);
  assert.deepEqual(breadcrumbs("C:/Users"), [{ label: "C:", path: "C:/" }, { label: "Users", path: "C:/Users" }]);
  assert.deepEqual(breadcrumbs(""), []);
  assert.deepEqual(breadcrumbs(undefined), []);
});
