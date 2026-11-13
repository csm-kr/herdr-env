// 2단계(안정성) 테스트. 실행: node --test test/stable.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { initialSeen, readyRemotes } from "../kind.js";

test("initialSeen: 다시 읽힐 때 10초 안에 온 열기 요청은 아직 안 본 것으로(0) 두어 처리한다", () => {
  const now = 1_000_000;
  assert.equal(initialSeen({ seq: now - 3000 }, now), 0);
  assert.equal(initialSeen({ seq: now - 20000 }, now), now - 20000);
  assert.equal(initialSeen(null, now), 0);
});

test("readyRemotes: 이 PC(null)와 연결 안 된 머신은 빼고 찾는다 (꺼진 머신에서 30초 기다리지 않게)", () => {
  assert.deepEqual(readyRemotes([{ name: null, layout: "ready" }, { name: "a", layout: "ready" }, { name: "b", layout: "unavailable" }, { name: "c", layout: "loading" }]), ["a"]);
});

test("currentSpace: 포커스된 스페이스가 먼저 (머신마다 active가 하나씩 있어 원격 스페이스에서 이 PC 스페이스를 잡던 문제)", async () => {
  const { currentSpace } = await import("../kind.js");
  const spaces = [{ id: "local-a", active: true }, { id: "m/remote-b", active: true }];
  assert.equal(currentSpace({ space: "m/remote-b" }, spaces).id, "m/remote-b");
  // 포커스를 모르면 예전처럼 첫 active.
  assert.equal(currentSpace(null, spaces).id, "local-a");
  assert.equal(currentSpace({ space: "gone" }, spaces).id, "local-a");
});
