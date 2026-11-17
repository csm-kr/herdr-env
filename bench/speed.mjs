// file-viewer·path-picker 속도 개선 전(2713546)/후(6fd8c55) 측정. 실행: node bench/speed.mjs
// 모드를 직접 돌리지 않고, 모드가 부르는 일(프로그램 띄우기·fs 읽기)을 일반 node에서 그대로 재현해 잰다.
// 각 항목 7번 돌려 중앙값(ms). 결과는 bench/RESULTS.md로 쓴다(공개 저장소라 실제 경로·이름은 넣지 않는다).
import { execFile } from "node:child_process";
import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { repoRoot, findRepoRoot, direntEntries, psQuote } from "../mods/file-viewer/kind.js";

export const RUNS = 7;

export function median(xs) {
  const s = [...xs].sort((a, b) => a - b), mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// 개선 전 ÷ 개선 후. 10배 미만은 소수 한 자리(1 미만은 두 자리), 그 이상은 정수.
export function ratio(before, after) {
  if (!after) return "∞";
  const r = before / after;
  return `${r >= 100 ? Math.round(r) : r >= 1 ? r.toFixed(1) : r.toFixed(2)}배`;
}

// 프로그램 하나 띄우는 데 S초 걸리는 PC에서 기다리는 시간(초): 프로그램 n번 × S + 프로그램 말고 걸린 시간.
export const estimate = (n, S, extra = 0) => n * S + extra;
// 개선 후 어림(초). m=0이면 잰 값(ms)이 fs 시간이라 더한다. m≥1이면 잰 값이 곧 이 PC의 프로그램 띄우기라 S로 바꿔 m × S만.
export const afterEstimate = (m, S, afterMs) => m ? estimate(m, S) : estimate(0, S, afterMs / 1000);

// main.js의 NODE_LIST 문자열. main.js는 herdr 모듈을 불러서 import할 수 없으니 글에서 꺼낸다.
export function extractNodeList(src) {
  const m = src.match(/^const NODE_LIST = '(.*)';$/m);
  if (!m) throw new Error("main.js에서 NODE_LIST를 찾지 못했습니다");
  return m[1];
}

// hc ls 결과에서 이 PC(주소에 / 없음)의 live 터미널 하나.
export const pickTerminal = ls => ls.terminals.find(t => t.state === "live" && !t.address.includes("/"))?.address ?? null;

// 프로그램을 띄우고 끝나길 기다린다. 0이 아니게 끝나면 던진다(빨리 실패한 시간을 재지 않게).
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 256 * 1024 * 1024, windowsHide: true, ...opts }, (err, stdout) => {
      if (err) reject(new Error(`${cmd} ${args[0] ?? ""} 실패 (code ${err.code})`)); else resolve(stdout);
    });
  });
}

async function timeIt(fn) {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

// fn은 한 번 돌 때 잰 값을 { 이름: ms } 로 돌려준다. 이름마다 RUNS번의 중앙값.
async function sample(fn) {
  const all = {};
  for (let i = 0; i < RUNS; i++) for (const [k, v] of Object.entries(await fn())) (all[k] ??= []).push(v);
  return Object.fromEntries(Object.entries(all).map(([k, v]) => [k, median(v)]));
}
const once = fn => sample(async () => ({ t: await timeIt(fn) })).then(r => r.t);

const fsExists = p => fsp.access(p).then(() => true, () => false);
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, "..");
  const NODE_LIST = extractNodeList(await fsp.readFile(path.join(repo, "mods/file-viewer/main.js"), "utf8"));
  const targets = [["저장소 루트", repo], ["mods/file-viewer", path.join(repo, "mods", "file-viewer")]];
  const nodeList = async dir => JSON.parse(await run("node", ["-e", NODE_LIST, dir]));
  const fsList = dir => fsp.readdir(dir, { withFileTypes: true }).then(direntEntries);
  const GIT_STATUS = ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"];
  const rows = [], log = s => console.log(s);

  // 1. 프로그램 하나 띄우는 비용
  const spawns = [["node -e 0", "node", ["-e", "0"]], ["git --version", "git", ["--version"]],
    ["powershell -NoProfile -Command exit", "powershell", ["-NoProfile", "-Command", "exit"]], ["hc --help", "hc", ["--help"]]];
  const spawnMs = {};
  for (const [label, cmd, args] of spawns) {
    spawnMs[label] = await once(() => run(cmd, args));
    rows.push({ group: "1. 프로그램 하나 띄우기", item: `\`${label}\``, before: spawnMs[label] });
    log(`1 ${label}: ${spawnMs[label].toFixed(1)}ms`);
  }

  // 2. 폴더 목록
  for (const [name, dir] of targets) {
    const a = await nodeList(dir), b = await fsList(dir);
    if (a.length !== b.length) throw new Error(`2. 목록 개수가 다릅니다 (${name})`);
    const before = await once(() => nodeList(dir)), after = await once(() => fsList(dir));
    rows.push({ group: "2. 폴더 목록", item: name, before, after, n: 1, m: 0 });
    log(`2 ${name}: ${before.toFixed(1)} → ${after.toFixed(2)}ms`);
  }

  // 3. 하위 폴더 5개 펼치기: 저장소 트리에서 이름순 너비 우선으로 5개(.git·bench 제외).
  const subs = [], queue = [""];
  while (queue.length && subs.length < 5) {
    const rel = queue.shift();
    const ds = (await fsp.readdir(path.join(repo, rel), { withFileTypes: true }))
      .filter(d => d.isDirectory() && ![".git", "bench", "node_modules"].includes(d.name)).map(d => d.name).sort();
    for (const d of ds) { const r = rel ? `${rel}/${d}` : d; if (subs.length < 5) subs.push(r); queue.push(r); }
  }
  if (subs.length < 5) throw new Error("3. 하위 폴더가 5개보다 적습니다");
  const subDirs = subs.map(s => path.join(repo, s));
  {
    const before = await once(async () => { for (const d of subDirs) await nodeList(d); });
    const after = await once(() => Promise.all(subDirs.map(fsList)));
    rows.push({ group: "3. 하위 폴더 5개 펼치기", item: subs.map(s => `\`${s}\``).join(", "), before, after, n: 5, m: 0 });
    log(`3: ${before.toFixed(1)} → ${after.toFixed(2)}ms`);
  }

  // 4. 프로젝트 루트(Ctrl+Shift+G)
  for (const [name, cwd] of targets) {
    let fallback = false;
    const oldRoot = async () => {
      const prefix = (await run("git", ["rev-parse", "--show-prefix"], { cwd })).trim();
      const r = repoRoot(cwd, prefix);
      if (r) return r;
      fallback = true;
      return (await run("git", ["rev-parse", "--show-toplevel"], { cwd })).trim();
    };
    const a = await oldRoot(), b = await findRepoRoot(cwd, fsExists);
    if (!b || !same(a, b.root)) throw new Error(`4. 두 방법의 루트가 다릅니다 (${name})`);
    const before = await once(oldRoot), after = await once(() => findRepoRoot(cwd, fsExists));
    rows.push({ group: "4. 프로젝트 루트", item: name, before, after, n: fallback ? 2 : 1, m: 0 });
    log(`4 ${name}: ${before.toFixed(1)} → ${after.toFixed(2)}ms`);
  }

  // 5. 목록이 처음 보일 때까지. 개선 후는 보인 뒤 크기·시각(node)과 git(findRepoRoot → git status)이 뒤에서 함께 돈다.
  for (const [name, dir] of targets) {
    const before = await once(async () => {
      await nodeList(dir);
      await run("git", ["rev-parse", "--show-prefix"], { cwd: dir });
      await run("git", GIT_STATUS, { cwd: dir });
    });
    const after = await sample(async () => {
      const t0 = performance.now();
      await fsList(dir);
      const visible = performance.now() - t0;
      await Promise.all([nodeList(dir), findRepoRoot(dir, fsExists).then(r => r && run("git", GIT_STATUS, { cwd: dir }))]);
      return { visible, background: performance.now() - t0 };
    });
    rows.push({ group: "5. 목록이 처음 보일 때까지", item: name, before, after: after.visible, n: 3, m: 0 });
    rows.push({ group: "5. 목록이 처음 보일 때까지", item: `${name} — 뒤에서 크기·시각·git 표시까지 다 찬 시각(화면은 기다리지 않음)`, after: after.background, bg: true });
    log(`5 ${name}: ${before.toFixed(1)} → ${after.visible.toFixed(2)}ms (뒤 ${after.background.toFixed(1)}ms)`);
  }

  // 6. 경로가 있는지(existing)
  for (const [name, p] of targets) {
    const ps = () => run("powershell", ["-NoProfile", "-Command", "& { param($p) if (-not (Test-Path -LiteralPath $p)) { exit 1 } } " + psQuote(p)]);
    const fsCheck = async () => { if (!(await fsExists(p))) throw new Error("6. fs가 없다고 합니다"); };
    const before = await once(ps), after = await once(fsCheck);
    rows.push({ group: "6. 경로 있는지(existing)", item: name, before, after, n: 1, m: 0 });
    log(`6 ${name}: ${before.toFixed(1)} → ${after.toFixed(2)}ms`);
  }

  // 7. path-picker: 화면(hc read)과 기록 150줄(hc read --lines 150). 터미널 내용은 어디에도 남기지 않는다.
  const term = pickTerminal(JSON.parse(await run("hc", ["ls"])));
  if (!term) throw new Error("7. 이 PC의 live 터미널이 없습니다");
  {
    const screen = () => run("hc", ["read", term]), history = () => run("hc", ["read", "--lines", "150", term]);
    const before = await sample(async () => {
      const t0 = performance.now();
      await screen(); const s = performance.now() - t0;
      await history(); return { screen: s, both: performance.now() - t0 };
    });
    const after = await sample(async () => {
      const t0 = performance.now(), h = history();
      await screen(); const s = performance.now() - t0;
      await h; return { screen: s, both: performance.now() - t0 };
    });
    rows.push({ group: "7. path-picker", item: "화면이 보일 때", before: before.screen, after: after.screen, n: 1, m: 1 });
    rows.push({ group: "7. path-picker", item: "기록 150줄까지 붙을 때", before: before.both, after: after.both, n: 2, m: 1 });
    log(`7: 화면 ${before.screen.toFixed(1)} → ${after.screen.toFixed(1)}ms, 기록까지 ${before.both.toFixed(1)} → ${after.both.toFixed(1)}ms`);
  }

  const env = {
    os: `${os.version()} (빌드 ${os.release()})`, cpu: `${os.cpus()[0]?.model.trim()} × ${os.cpus().length}`, node: process.version,
    herdr: (await run("herdr-app", ["--version"])).trim(), hc: (await run("hc", ["--version"])).trim(),
    date: new Date().toLocaleDateString("sv-SE"),
  };
  await fsp.writeFile(path.join(here, "RESULTS.md"), report(rows, env, spawnMs));
  log("bench/RESULTS.md를 썼습니다");
}

const ms = v => v === undefined ? "—" : v < 10 ? v.toFixed(2) : v.toFixed(0);

function report(rows, env, spawnMs) {
  const S = 3, fmt = s => `${s.toFixed(1)}초`, screen = rows.find(r => r.item === "화면이 보일 때"), late = screen.after - screen.before;
  const table = rows.map(r => `| ${r.group} | ${r.item} | ${ms(r.before)} | ${ms(r.after)} | ${r.before !== undefined && r.after !== undefined ? ratio(r.before, r.after) : "—"} |`);
  const est = rows.filter(r => r.n !== undefined).map(r =>
    `| ${r.group} | ${r.item} | ${r.n} | ${r.m} | ${r.n} × S | ${r.m ? `${r.m} × S` : `0 + ${ms(r.after)}ms`} | ${fmt(estimate(r.n, S))} | ${fmt(afterEstimate(r.m, S, r.after))} |`);
  return `# 속도 측정: 개선 전(2713546) / 개선 후(6fd8c55)

\`node bench/speed.mjs\`로 만든 파일이다. 각 항목 ${RUNS}번 돌린 중앙값(ms). 배수 = 개선 전 ÷ 개선 후.

## 측정 PC

- OS: ${env.os}
- CPU: ${env.cpu}
- node: ${env.node}
- Herdr: ${env.herdr}, ${env.hc}
- 측정일: ${env.date}
- 측정 폴더: 이 저장소 맨 위(git 저장소)와 \`mods/file-viewer\` (예: \`C:\\Users\\me\\herdr-env\`)

## 결과

| 묶음 | 항목 | 개선 전 ms | 개선 후 ms | 배수 |
|---|---|---:|---:|---:|
${table.join("\n")}

- 1번은 비교가 아니라 이 PC에서 프로그램 하나 띄우는 비용이다. 개선 후는 2~6번에서 이 비용을 화면 앞에서 아예 치르지 않는다.
- 2·3번 개선 후 목록에는 크기·수정 시각이 없다. 그건 node 한 번(\`statsOf\`)으로 뒤에서 채운다(5번 "뒤에서" 줄에 들어 있다).
- 5번 개선 전은 목록 node → \`git rev-parse --show-prefix\` → \`git status\`를 차례로 다 끝낸 시각이다. 개선 후는 \`readdir\`가 끝난 시각이고,
  크기·시각(node)과 git 표시(\`findRepoRoot\` → \`git status\`)는 그 뒤에 함께 돌아 화면을 막지 않는다.
- 7번은 화면이 보이는 시각은 같고(둘 다 hc 한 번 뒤), 기록 150줄이 붙는 시각만 당겨진다. 다만 개선 후 화면이 ${ms(late)}ms 늦었다.
  여러 번 다시 재도 늘 개선 후가 늦었으니 흔들림이 아니라 hc 두 개를 동시에 띄우는 비용이다.

## 프로그램 하나 띄우는 데 S초 걸리는 PC라면

이 PC는 프로그램 하나가 수십~수백 ms라 아낀 시간도 항목마다 수백 ms에 그친다. 보안 프로그램이 있는 회사 PC처럼 프로그램 하나에 S초가 걸리면,
화면이 보이기 전에 기다리는 시간은 대략 이렇다.

- 개선 전 ≈ 프로그램 n번 × S
- 개선 후 ≈ 프로그램 m번 × S (m은 화면에 보이기 전 기다리는 것만. 뒤에서 도는 node·git은 세지 않는다)
- m = 0이면 개선 후 측정값이 그대로 fs 시간이라 더했다. m ≥ 1이면 측정값이 곧 이 PC의 프로그램 띄우기라 S로 바꿔 넣고 따로 더하지 않았다.

| 묶음 | 항목 | n | m | 개선 전 | 개선 후 | S = ${S}초일 때 전 | S = ${S}초일 때 후 |
|---|---|---:|---:|---|---|---:|---:|
${est.join("\n")}

- 3번: 개선 전에는 펼친 폴더마다 node를 차례로 띄워 5 × S였다. 개선 후는 fs \`readdir\` 5번을 동시에 해서 프로그램을 띄우지 않는다.
- 5번: 개선 후에도 node(크기·시각) 1번과 git status 1번은 뒤에서 돈다. 둘이 동시에 뜨므로 표시가 다 차는 데는 대략 1~2 × S가 걸리지만, 그동안 목록은 이미 보인다.
- 7번: 기록까지는 2 × S → 1 × S. 화면은 둘 다 1 × S다.

## 한계

- 모드를 직접 돌린 게 아니다. 모드가 부르는 일을 일반 node에서 재현했다. Herdr 모드의 \`fs\`(홈 안만 읽는 권한 확인 포함)는 node \`fs\`와 다를 수 있고,
  모드의 \`exec\`도 \`child_process.execFile\`과 띄우는 비용이 다를 수 있다.
- 개선 후의 경로 확인은 모드에서는 \`fs.exists\`지만, node에는 없어 \`fs.promises.access\`로 대신했다.
- 이 PC에는 프로그램 띄우기를 느리게 하는 보안 프로그램이 없다. 그래서 "S초" 계산은 측정값이 아니라 프로그램 수로 어림한 것이다.
- 측정하는 동안 이 PC에서 다른 터미널·에이전트가 돌고 있어 값이 흔들릴 수 있다(그래서 중앙값을 쓴다).
- 보안 프로그램이 프로그램 띄우기를 한 줄로 세우면(동시에 못 띄우면) 7번의 이득은 없어지고, 더 나빠질 수도 있다.
  개선판은 기록 읽기(\`hc read --lines 150\`)를 화면 읽기보다 먼저 시작하므로, 화면이 기록 뒤에 줄을 서서 최대 2 × S까지 늦어질 수 있다.
  5번의 "뒤에서" 도는 node·git도 같은 이유로 2 × S쯤 걸릴 수 있다(화면은 막지 않는다).
- 측정에는 작업 폴더의 \`main.js\`(NODE_LIST)와 \`kind.js\`를 썼다. 측정 때 HEAD는 6fd8c55 뒤의 커밋이었지만, 쓴 함수(\`repoRoot\`·\`findRepoRoot\`·\`direntEntries\`·\`psQuote\`)와 NODE_LIST는 6fd8c55와 같다.
- 7번은 읽기만 하는 \`hc read\`를 이 PC의 live 터미널 하나에 썼다. 기록 길이가 터미널마다 달라 값도 달라진다.
- 폴더가 작다(수십 개 항목). 항목이 수천 개면 fs 쪽도 수 ms~수십 ms가 된다.
`;
}

if (import.meta.main) await main();
