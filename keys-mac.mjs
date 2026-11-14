#!/usr/bin/env node
// 내 Herdr 단축키(skills/herdr-shortcuts/references/csm-kr-preset-mac.md)를 macOS의 keys.json에 맞춘다. 여러 번 돌려도 된다.
//   node keys-mac.mjs [herdr-app 설정 폴더]      (기본: $HERDR_APP_HOME 또는 ~/.config/herdr-app)
// 파일을 통째로 덮어쓰지 않고 해당 줄만 넣고 뺀다(통째로 덮으면 그 Mac 버전의 새 기본 단축키가 사라진다).
// 이미 다른 동작에 쓰이는 키는 덮어쓰지 않고 알린다. settings.json의 option_as_alt도 "on"으로 둔다.
// Windows의 keys.ps1과 같은 일을 한다. 목록을 바꾸면 csm-kr-preset-mac.md도 같이 바꾼다.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// 넣을 키 → 동작 (global 섹션). cmd 기본 키는 그대로 두고 Windows와 같은 ctrl-shift·alt 키를 얹는다.
export const ADD = [
  ["ctrl-shift-t", "tab.new"],
  ["ctrl-shift-w", "tab.close"],
  ["alt-[", "tab.prev"],
  ["alt-]", "tab.next"],
  ["ctrl-shift-up", "space.prev"],
  ["ctrl-shift-down", "space.next"],
  ["ctrl-shift-q", "space.close"],
  ["ctrl-shift-n", "space.new"],
  ["ctrl-shift-p", "app.palette"],
  ["ctrl-shift-o", "pane.split:right"],
  ["ctrl-shift-e", "pane.split:down"],
  ["ctrl-shift-x", "pane.close"],
  ["ctrl-shift-z", "pane.zoom"],
  ["alt-h", "pane.go:left"],
  ["alt-j", "pane.go:down"],
  ["alt-k", "pane.go:up"],
  ["alt-l", "pane.go:right"],
  ["ctrl-shift-g", "mod.open:file-viewer"],
  ["ctrl-shift-y", "mod.open:path-picker"],
];
// 뺄 키: 이 동작에 묶여 있을 때만 뺀다.
export const REMOVE = { "cmd-shift-l": "layout.switch", "cmd-shift-w": "pane.close" };

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// keys.json 글에서 해당 줄만 넣고 뺀다. log: [{ kind: "has" | "added" | "conflict" | "nosection" | "removed", key, action, current? }]
export function applyKeys(raw, add = ADD, remove = REMOVE) {
  const log = [], insert = [];
  const hasGlobal = /"global"\s*:\s*\{/.test(raw);
  for (const [key, action] of add) {
    const m = raw.match(new RegExp(`"${esc(key)}"\\s*:\\s*(?:"([^"]*)"|(\\{))`));
    if (m) log.push(m[1] === action ? { kind: "has", key, action } : { kind: "conflict", key, action, current: m[2] ? "(여러 인자를 쓰는 동작)" : m[1] });
    else if (!hasGlobal) log.push({ kind: "nosection", key, action });
    else { insert.push(`\n    "${key}": "${action}",`); log.push({ kind: "added", key, action }); }
  }
  if (insert.length) raw = raw.replace(/("global"\s*:\s*\{)/, `$1${insert.join("")}`);
  for (const [key, action] of Object.entries(remove)) {
    const pat = `"${esc(key)}"\\s*:\\s*"${esc(action)}"`;
    const line = new RegExp(`[ \\t]*${pat}\\s*,[ \\t]*\\r?\\n`), last = new RegExp(`,\\s*${pat}`);
    if (line.test(raw)) raw = raw.replace(line, "");
    else if (last.test(raw)) raw = raw.replace(last, "");   // 섹션의 마지막 줄
    else continue;
    log.push({ kind: "removed", key, action });
  }
  return { raw, log };
}

// settings.json 글에서 option_as_alt만 "on"으로. 한글 등 US가 아닌 자판에서도 Option을 Alt로 쓰려는 설정이다.
export function setOptionAsAlt(raw) {
  const m = raw.match(/"option_as_alt"\s*:\s*"([^"]*)"/);
  if (m) return m[1] === "on" ? { raw, changed: false } : { raw: raw.replace(m[0], '"option_as_alt": "on"'), changed: true };
  if (/^\s*\{\s*\}\s*$/.test(raw)) return { raw: '{\n  "option_as_alt": "on"\n}\n', changed: true };
  return { raw: raw.replace(/\{/, '{\n  "option_as_alt": "on",'), changed: true };
}

function main() {
  const dir = process.argv[2] || process.env.HERDR_APP_HOME || join(homedir(), ".config", "herdr-app");
  const keysPath = join(dir, "keys.json"), settingsPath = join(dir, "settings.json");
  const warn = text => console.log(`\x1b[33m${text}\x1b[0m`);
  if (!existsSync(keysPath)) { console.error(`keys.json이 없습니다(${keysPath}). Herdr를 한 번 실행한 뒤 다시 돌리세요.`); process.exit(1); }

  const before = readFileSync(keysPath, "utf8"), { raw, log } = applyKeys(before);
  for (const l of log) {
    if (l.kind === "has") console.log(`단축키 있음: ${l.key} → ${l.action}`);
    else if (l.kind === "added") console.log(`단축키 넣음: ${l.key} → ${l.action}`);
    else if (l.kind === "removed") console.log(`단축키 뺌: ${l.key} (${l.action})`);
    else if (l.kind === "conflict") warn(`단축키 ${l.key} 는 이미 '${l.current}'에 쓰이고 있어 그대로 둡니다. ${l.action} 은 다른 키로 거세요.`);
    else warn(`keys.json에 global 섹션이 없어 ${l.key} 를 넣지 못했습니다.`);
  }
  if (raw === before) console.log("keys.json: 바꿀 것 없음");
  else {
    try { JSON.parse(raw); } catch (e) { console.error(`고친 keys.json이 올바른 JSON이 아니라 저장하지 않았습니다: ${e.message}`); process.exit(1); }
    writeFileSync(keysPath, raw);
    console.log(`keys.json 저장: ${keysPath}`);
  }

  if (!existsSync(settingsPath)) { warn(`settings.json이 없어 option_as_alt를 맞추지 못했습니다(${settingsPath}).`); return; }
  const s = setOptionAsAlt(readFileSync(settingsPath, "utf8"));
  if (!s.changed) { console.log('settings.json: option_as_alt 이미 "on"'); return; }
  try { JSON.parse(s.raw); } catch (e) { console.error(`고친 settings.json이 올바른 JSON이 아니라 저장하지 않았습니다: ${e.message}`); process.exit(1); }
  writeFileSync(settingsPath, s.raw);
  console.log('settings.json 저장: option_as_alt → "on"');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
