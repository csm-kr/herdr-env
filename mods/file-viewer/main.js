// A lazy file browser for the focused pane's folder, with bounded read-only previews.
// 기본 files 모드의 복제본. 이미지·영상 미리보기, 음악 재생, 기본 앱으로 열기를 더했고, 창(pane)으로도 열 수 있다.
// 다른 머신의 영상·소리는 sftp로 바로 읽고, 그 밖의 파일은 scp로 이 PC에 가져와서 보여 준다. 미리보기와 재생은 이 PC가 Windows일 때만 된다.
// props: { folder?: 고정해서 볼 폴더, on?: 그 폴더가 있는 머신, file?: 처음에 열 파일(폴더 기준 상대 경로),
//          t?: 그 파일을 틀 시작 시각(초), b?: A/B로 같이 비교할 다른 파일(같은 머신의 절대 경로) }
// 단축키는 mod.open:file-viewer 로 건다. 그때는 오버레이로 잠깐 불려서 현재 탭의 뷰어 창을 켜거나 끈다.
// 클립보드에 절대 경로가 있으면 그 파일로 연다: `/경로/파일.mp4#t=81` 한 줄, 또는 두 줄이면 A/B 비교.
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState, TextView, ScrollHandle, InputState, Input, Popup } from "gpui-base";
import * as fs from "fs/promises";
import { shared, setShared } from "herdr";
import { spaces, panes, focused, exec, readTextFile, writeTextFile, watchFolder, theme, settings, window, props, appHome, notify, run, closeOverlay, hc, machines, home, nextCommand } from "herdr";
import { kindOf, psQuote, winPath, fit, remoteName, clock, position, seekTo, clickToSeconds, ffplayArgs, parseSshG, sftpUrl, parseOpenRequest, parseLinkRequest, copyPath, playBadge, viewerToggle, rightOf, folderRequest, rootStep, repoRoot, parseRelative, pickNewest, machineCandidates, pickFolder, remoteListArgs, splitMermaid, mermaidName, browserCandidates, isDark, htmlShotKey, htmlWidth, isAnimatable, frameAt, zoomStep, parseCsv, findLines, tailLines, parseDiff, showMediaBar, mpvWindowArgs, mpvDockArgs, dockRect, dockLine, quoteArgs, clampTree, initialSeen, readyRemotes, currentSpace, cacheToDelete, csvWidths, extOf, gitMarks, mpvCandidates, splitPath, formatSize, formatDate, parseFindListing, mediaSummary, breadcrumbs, imageSize, discardGate, follows, freeName, treeMenu, parsePdfInfo, pdfNext, pdfPageFile, pdftoppmArgs, popplerCandidates, pdfKey } from "./kind.js";

function location(last) {
  const f = focused(), space = currentSpace(f, spaces());
  if (props()?.folder) return { cwd: props().folder, on: props().on ?? null, space: null };
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  // 이 모드 자신처럼 터미널이 없는 창이 포커스를 받으면 폴더를 알 수 없다.
  // 같은 탭에서 보던 곳을 그대로 두고, 없으면 그 탭의 첫 터미널을 따른다.
  if (pane && !pane.terminal) {
    if (last?.tab === pane.tab) return last;
    // 미리보기 탭처럼 터미널이 없으면: 이 스페이스에서 마지막으로 보던 폴더, 없으면 이 탭·이 스페이스 터미널의 폴더.
    const tabs = new Set((space?.tabs ?? []).map(t => t.id));
    const cwds = [...panes().filter(p => p.tab === pane.tab && p.cwd), ...panes().filter(p => tabs.has(p.tab) && p.cwd)].map(p => p.cwd);
    return { ...pickFolder({ tree: shared(TREE), space: space ?? { id: null, folder: "", machine: null }, cwds }), space: space?.id, tab: pane.tab };
  }
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on, space: space?.id, tab: f?.tab };
}

async function powershell(script, ...args) {
  const r = await exec("powershell", ["-NoProfile", "-Command", "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & { " + script + " } " + args.map(psQuote).join(" ")], { timeout: 600000 });
  if (r.code !== 0) throw new Error(r.stderr || "PowerShell failed");
  return r.stdout.trim();
}
// image()는 앱 폴더 안의 경로만 그린다. 그래서 볼 파일을 캐시 폴더로 복사하고 "이름|너비|높이"를 돌려받는다.
// 너비와 높이는 System.Drawing이 읽는 형식만 알 수 있고, 모르면(svg, webp) 0이다.
// 이름에 수정 시각을 넣어 파일이 바뀌면 새로 복사되고, 복사한 지 하루 지난 캐시는 지운다.
const CACHE = "cache/file-viewer", NAME = "file-viewer";
const cacheDir = () => winPath(`${appHome()}/${CACHE}`);
const cacheImage = path => powershell("param($src, $dir) $ErrorActionPreference = 'Stop'; $f = Get-Item -LiteralPath $src; New-Item -ItemType Directory -Force -Path $dir | Out-Null; Get-ChildItem -LiteralPath $dir -File -Recurse | Where-Object CreationTime -lt (Get-Date).AddDays(-1) | Remove-Item -Force; $name = '{0:x8}-{1:x}{2}' -f $f.FullName.ToLower().GetHashCode(), $f.LastWriteTimeUtc.Ticks, $f.Extension.ToLower(); $dst = Join-Path $dir $name; if (-not (Test-Path -LiteralPath $dst)) { Copy-Item -LiteralPath $f.FullName -Destination $dst }; $w = 0; $h = 0; try { Add-Type -AssemblyName System.Drawing; $img = [System.Drawing.Image]::FromFile($f.FullName); $w = $img.Width; $h = $img.Height; $img.Dispose() } catch {}; \"$name|$w|$h\"", winPath(path), cacheDir());
const openFile = path => powershell("param($p) Invoke-Item -LiteralPath $p", winPath(path));
// 영상은 1초 지점의 한 장면(1초보다 짧으면 첫 장면)을 JPG로 캐시에 두고 "이름|너비|높이"를 돌려받는다. ffmpeg가 있어야 한다.
// 예전에는 앞 12초를 움직이는 WebP로 만들었는데, 프레임이 많으면 image()가 그리다 렌더가 중단돼(interrupted) 화면에 안 떴다.
// 영상 전체는 ▶를 누르면 장면 자리의 mpv 창으로 튼다(mpv가 없거나 A/B 비교면 ffplay).
// src는 이 PC의 경로, 또는 다른 머신 파일의 sftp 주소다. 주소는 Get-Item으로 볼 수 없어서 key(머신·경로·수정 시각)로 이름을 정한다.
const cacheVideo = (src, key = "") => powershell("param($src, $dir, $key) $ErrorActionPreference = 'Stop'; New-Item -ItemType Directory -Force -Path $dir | Out-Null; if ($key) { $name = $key + '.jpg'; $in = $src } else { $f = Get-Item -LiteralPath $src; $name = '{0:x8}-{1:x}.jpg' -f $f.FullName.ToLower().GetHashCode(), $f.LastWriteTimeUtc.Ticks; $in = $f.FullName }; $dst = Join-Path $dir $name; if (-not (Test-Path -LiteralPath $dst)) { $part = $dst + '.part'; foreach ($at in '1', '0') { ffmpeg -y -v error -ss $at -i $in -frames:v 1 -vf \"scale='min(960,iw)':-2\" -pix_fmt yuvj420p -c:v mjpeg -q:v 3 -f image2 $part; if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $part)) { break } }; if (-not (Test-Path -LiteralPath $part)) { throw 'ffmpeg failed' }; Move-Item -LiteralPath $part -Destination $dst -Force }; Add-Type -AssemblyName System.Drawing; $img = [System.Drawing.Image]::FromFile($dst); \"$name|$($img.Width)|$($img.Height)\"; $img.Dispose()", src.startsWith("sftp://") ? src : winPath(src), cacheDir(), key);
// ffplay를 띄우고 프로세스 번호를 돌려받는다. Start-Process로 띄우면 콘솔 창이 같이 뜨고, 숨기면 영상 창까지 숨는다.
// 그래서 WMI로 콘솔 없이(DETACHED_PROCESS) 띄운다. 이렇게 하면 exec의 출력 파이프도 물려주지 않아 exec가 바로 돌아온다.
// WMI는 사용자 PATH를 보지 않아 ffplay의 전체 경로를 넘긴다.
const launchPlayer = (src, at, video) => powershell("param($a) $s = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ CreateFlags = [uint32]8 }; $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '\"' + (Get-Command ffplay -ErrorAction Stop).Source + '\" ' + $a; ProcessStartupInformation = $s }; if ($r.ReturnValue -ne 0) { throw ('ffplay를 띄우지 못했습니다 (' + $r.ReturnValue + ')') }; $r.ProcessId", ffplayArgs(src, at, video));
const isRunning = async pid => (await exec("tasklist", ["/FI", `PID eq ${pid}`, "/NH", "/FO", "CSV"]).catch(() => null))?.stdout.includes(`"${pid}"`) ?? false;
const stopPlayer = pid => pid && exec("taskkill", ["/PID", String(pid), "/F"]).catch(() => null);
const probeDuration = async src => Number((await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", "-i", src.startsWith("sftp://") ? src : winPath(src)], { timeout: 60000 }).catch(() => null))?.stdout.trim()) || 0;
async function machineTarget(on) {
  const target = JSON.parse((await hc(["machine", "ls", "--json"])).stdout).machines.find(m => m.name === on)?.target;
  if (!target) throw new Error(`${on}: 머신 목록에 없습니다`);
  return target;
}
// 다른 머신의 파일은 scp로 이 PC의 캐시에 가져와서 이 PC의 파일처럼 다룬다. ssh 대상 이름으로 닿는 머신만 된다.
async function fetchRemote(on, path) {
  const target = await machineTarget(on);
  const dir = `${cacheDir()}\\remote`, local = `${dir}\\${remoteName(on, path)}`;
  await powershell("param($d) New-Item -ItemType Directory -Force -Path $d | Out-Null", dir);
  const r = await exec("scp", ["-p", "-q", "-o", "BatchMode=yes", `${target}:${path}`, local], { timeout: 600000 });
  if (r.code !== 0) throw new Error(r.stderr || "scp failed");
  return local;
}
// 트리 우클릭 "다운로드 폴더로 받기": 이 PC의 다운로드 폴더(사용자가 옮겼어도 그 자리)에 받고, 받은 경로를 돌려준다.
// 같은 이름이 있으면 "이름 (1)"로 비켜 간다. 폴더도 통째로 받는다(다른 머신은 scp -r, 이 PC는 node cpSync).
async function download(on, path) {
  const { dir, names } = JSON.parse(await powershell("$d = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path; ConvertTo-Json -Compress @{ dir = $d; names = [string[]]@(Get-ChildItem -LiteralPath $d -Force -Name) }"));
  const dst = `${dir}\\${freeName(splitPath(path).file, names ?? [])}`;
  const r = on
    ? await exec("scp", ["-r", "-p", "-q", "-o", "BatchMode=yes", `${await machineTarget(on)}:${path}`, dst], { timeout: 3600000 })
    : await exec("node", ["-e", "require('fs').cpSync(process.argv[1], process.argv[2], { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true })", winPath(path), dst], { timeout: 3600000 });
  if (r.code !== 0) throw new Error(r.stderr || "복사 실패");
  return dst;
}
// 영상과 소리는 받지 않고 ffmpeg·ffplay가 sftp로 필요한 만큼만 읽는다. 큰 영상도 앞부분만 읽어서 바로 뜬다.
// 사용자·호스트·포트는 ssh 설정을 따르도록 `ssh -G`로 읽는다.
const sshInfo = new Map();
async function remoteUrl(on, path) {
  if (!sshInfo.has(on)) {
    const r = await exec("ssh", ["-G", await machineTarget(on)]);
    if (r.code !== 0) throw new Error(r.stderr || "ssh -G failed");
    sshInfo.set(on, parseSshG(r.stdout));
  }
  return sftpUrl(sshInfo.get(on), path);
}
// 후보(긴 것부터) 가운데 그 머신에 실제로 있는 첫 경로. 하나도 없으면 가장 긴 것을 열어 뷰어가 없다고 보여 준다.
async function existing(candidates, on, strict = false) {
  for (const c of candidates) {
    const r = on ? await exec("test", ["-e", c.path], { on, timeout: 8000 }).catch(() => null)
      : await exec("powershell", ["-NoProfile", "-Command", "& { param($p) if (-not (Test-Path -LiteralPath $p)) { exit 1 } } " + psQuote(c.path)]).catch(() => null);
    if (r?.code === 0) return c;
  }
  return strict ? null : candidates[0];
}
// Mermaid를 그릴 브라우저: 그 PC에 있는 첫 Chrome·Edge·Chromium (한 번만 찾는다). 없으면 null(mermaid-cli 기본값).
let mermaidBrowser;
async function findBrowser() {
  if (mermaidBrowser !== undefined) return mermaidBrowser;
  const list = browserCandidates(window()?.platform, home());
  const r = await exec("node", ["-e", "const fs=require('fs');process.stdout.write(JSON.parse(process.argv[1]).find(p=>fs.existsSync(p))||'')", JSON.stringify(list)]).catch(() => null);
  return mermaidBrowser = r?.stdout.trim() || null;
}

// Mermaid 코드를 PNG로 그려 캐시에 두고 { path, w, h }를 돌려준다(2배로 그려 반 크기로 보여 준다).
async function renderMermaid(code, dark) {
  const dir = `${appHome()}/${CACHE}`, name = mermaidName(code, dark), out = `${dir}/${name}`;
  await fs.mkdir(dir, { recursive: true });
  if (!(await fs.exists(out)) || !(await fs.readFile(out)).length) {
    const input = out.replace(/\.png$/, ".mmd");
    await fs.writeFile(input, code);
    const args = ["-q", "-i", input, "-o", out, "-t", dark ? "dark" : "default", "-b", "transparent", "-s", "2"];
    const browser = await findBrowser();
    if (browser) {
      const cfg = `${dir}/mmd-puppeteer.json`;
      await fs.writeFile(cfg, JSON.stringify({ executablePath: browser, args: ["--no-sandbox"] }));
      args.unshift("-p", cfg);
    }
    // Windows의 mmdc는 mmdc.cmd라서 cmd로 부른다.
    const win = window()?.platform === "windows";
    const r = await exec(win ? "cmd" : "mmdc", win ? ["/d", "/c", "mmdc", ...args] : args, { timeout: 90000 }).catch(e => ({ code: -1, stderr: String(e) }));
    if (r.code !== 0 || !(await fs.exists(out))) {
      const why = (r.stderr || r.stdout || "").split(/\r?\n/).filter(Boolean).slice(-3).join("\n");
      throw new Error(/not recognized|not found|ENOENT/i.test(why) ? "mermaid-cli가 없습니다: npm i -g @mermaid-js/mermaid-cli" : why || "mmdc failed");
    }
  }
  const s = imageSize(await fs.readFile(out));
  return { path: `${CACHE}/${name}`, w: Math.round(s.w / 2), h: Math.round(s.h / 2) };
}

// HTML을 실제 브라우저로 그린다(Herdr의 HTML 보기는 CSS·그림·스크립트를 못 그린다). puppeteer는 mermaid-cli에 들어 있는 것을,
// 브라우저는 findBrowser()가 찾은 것을 쓴다. 긴 페이지는 2000px 조각 PNG로 나눠 캐시에 둔다(큰 그림 하나는 GPU가 못 그린다).
const HTML_SHOT = `const [pp, exe, file, width, out, tile] = process.argv.slice(2);
const puppeteer = require(pp), { pathToFileURL } = require("url");
(async () => {
  const b = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--hide-scrollbars"] });
  try {
    const page = await b.newPage();
    await page.setViewport({ width: Number(width), height: 900, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle0", timeout: 30000 }).catch(() => null);
    const h = Math.min(30000, await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)));
    const t = Number(tile), n = Math.max(1, Math.ceil(h / t));
    for (let i = 0; i < n; i++) await page.screenshot({ path: out + "-" + i + ".png", clip: { x: 0, y: i * t, width: Number(width), height: Math.min(t, h - i * t) }, captureBeyondViewport: true });
    process.stdout.write(JSON.stringify({ width: Number(width), height: h, tiles: n }));
  } finally { await b.close().catch(() => null); }
})().catch(e => { process.stderr.write(String(e && e.message || e)); process.exit(1); });
`;
let puppeteerDir;
async function findPuppeteer() {
  if (puppeteerDir !== undefined) return puppeteerDir;
  const win = window()?.platform === "windows";
  const r = await exec(win ? "cmd" : "npm", win ? ["/d", "/c", "npm", "root", "-g"] : ["root", "-g"]).catch(() => null);
  const dir = r?.code === 0 && r.stdout.trim() ? `${r.stdout.trim()}/@mermaid-js/mermaid-cli/node_modules/puppeteer` : "";
  const ok = dir && (await exec("node", ["-e", "process.exit(require('fs').existsSync(process.argv[1])?0:1)", dir]).catch(() => null))?.code === 0;
  return puppeteerDir = ok ? dir : null;
}
async function renderHtml(full, entry, width) {
  const dir = `${appHome()}/${CACHE}`, key = htmlShotKey(full, entry?.mtime ?? 0, entry?.size ?? 0, width), meta = `${dir}/${key}.json`;
  const p = path => window()?.platform === "windows" ? winPath(path) : path;
  const cached = await readTextFile(meta).catch(() => null);
  if (cached && await fs.exists(`${dir}/${key}-0.png`)) { try { return JSON.parse(cached); } catch {} }
  const pp = await findPuppeteer();
  if (!pp) throw new Error("mermaid-cli(puppeteer)가 없습니다: npm i -g @mermaid-js/mermaid-cli");
  const browser = await findBrowser();
  if (!browser) throw new Error("Chrome·Edge·Chromium을 찾지 못했습니다");
  await fs.mkdir(dir, { recursive: true });
  const script = `${dir}/html-shot.js`;
  await fs.writeFile(script, HTML_SHOT);
  const r = await exec("node", [p(script), p(pp), browser, p(full), String(width), p(`${dir}/${key}`), "2000"], { timeout: 120000 });
  if (r.code !== 0) throw new Error((r.stderr || "").split(/\r?\n/).filter(Boolean)[0] || "페이지를 그리지 못했습니다");
  const m = JSON.parse(r.stdout);
  const out = { width: m.width, height: m.height, tiles: Array.from({ length: m.tiles }, (_, i) => `${CACHE}/${key}-${i}.png`) };
  await fs.writeFile(meta, JSON.stringify(out));
  return out;
}

// 상대 경로(rel)로 끝나는 파일·폴더를 base 아래(8단계까지, .git·node_modules 등 제외)에서 찾는다: [{ path, mtime, dir }].
// 이 PC는 node로, 다른 머신은 그 머신의 find로.
const FIND_REL = "const fs=require('fs'),path=require('path'),[base,rel]=process.argv.slice(1),want=rel.toLowerCase(),skip=new Set(['.git','node_modules','.venv','__pycache__']),out=[];let seen=0;const d0=path.resolve(base,rel);if(fs.existsSync(d0)){const s=fs.statSync(d0);process.stdout.write(JSON.stringify([{path:d0,mtime:s.mtimeMs/1000,dir:s.isDirectory()}]));process.exit(0)}const walk=(d,k)=>{if(k>8||out.length>=50||seen>60000)return;let es=[];try{es=fs.readdirSync(d,{withFileTypes:true})}catch{return}for(const e of es){seen++;if(skip.has(e.name))continue;const p=path.join(d,e.name),n=p.split(path.sep).join('/').toLowerCase();if(n.endsWith('/'+want)){try{const s=fs.statSync(p);out.push({path:p,mtime:s.mtimeMs/1000,dir:s.isDirectory()})}catch{}}if(e.isDirectory())walk(p,k+1)}};walk(base,0);process.stdout.write(JSON.stringify(out))";
// 폴더인가(다른 머신은 test -d, 이 PC는 node).
async function isDirectory(path, on) {
  const r = on ? await exec("test", ["-d", path], { on, timeout: 8000 }).catch(() => null)
    : await exec("node", ["-e", "process.exit(require('fs').statSync(process.argv[1]).isDirectory()?0:1)", winPath(path)]).catch(() => null);
  return r?.code === 0;
}

// 먼저 base/rel(../ 포함)이 실제로 있으면 그것 하나만 쓴다(같은 끝 경로의 더 최근 파일을 잘못 고르지 않게).
async function findRelative(base, on, rel) {
  if (on) {
    const direct = await exec("sh", ["-c", 'cd "$1" 2>/dev/null && p=$(realpath -e -- "$2" 2>/dev/null) && { [ -d "$p" ] && y=d || y=f; printf "%s\t%s\t%s" "$(stat -c %Y "$p" 2>/dev/null || stat -f %m "$p")" "$y" "$p"; }', "sh", base, rel], { on, timeout: 10000 }).catch(() => null);
    if (direct?.code === 0 && direct.stdout.trim()) { const [t, y, ...p] = direct.stdout.trim().split("\t"); return [{ path: p.join("\t"), mtime: Number(t), dir: y === "d" }]; }
    const r = await exec("find", [base, "-maxdepth", "8", "(", "-name", ".git", "-o", "-name", "node_modules", ")", "-prune", "-o", "-path", `*/${rel}`, "-printf", "%T@\t%y\t%p\n"], { on, timeout: 20000 }).catch(() => null);
    return (r?.stdout ?? "").split("\n").filter(Boolean).slice(0, 50).map(l => { const [t, y, ...p] = l.split("\t"); return { path: p.join("\t"), mtime: Number(t), dir: y === "d" }; });
  }
  const r = await exec("node", ["-e", FIND_REL, winPath(base), rel], { timeout: 20000 }).catch(() => null);
  try { return JSON.parse(r?.stdout || "[]"); } catch { return []; }
}

// 폴더가 속한 프로젝트(git 저장소) 루트. prefix로 지금 표기 그대로 올라가 보고, 안 맞으면(심볼릭 링크 등) git이 주는 실제 경로.
async function projectRootOf(cwd, on, prefix) {
  const r = repoRoot(cwd, prefix);
  if (r) return r;
  const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on, timeout: 5000 }).catch(() => null);
  return top?.code === 0 ? top.stdout.trim() : null;
}

// 움직이는 GIF·WebP·APNG를 프레임 PNG와 프레임별 간격으로 풀어 캐시에 둔다(anim-frames.js, Chrome의 ImageDecoder).
// 다른 머신의 그림은 먼저 이 PC로 가져온다. { w, h, durations, frames: [캐시 경로] }
async function animFrames(full, entry, on) {
  const dir = `${appHome()}/${CACHE}`, key = `anim-${htmlShotKey(`${on ?? ""}:${full}`, entry?.mtime ?? 0, entry?.size ?? 0, 800).slice(5)}`, meta = `${dir}/${key}.json`;
  const p = path => window()?.platform === "windows" ? winPath(path) : path;
  const cached = await readTextFile(meta).catch(() => null);
  if (cached && await fs.exists(`${dir}/${key}-000.png`)) { try { return JSON.parse(cached); } catch {} }
  const pp = await findPuppeteer(), browser = await findBrowser();
  if (!pp || !browser) throw new Error("mermaid-cli(puppeteer)와 Chrome·Edge가 있어야 움직입니다");
  const src = on ? await fetchRemote(on, full) : full;
  await fs.mkdir(dir, { recursive: true });
  const r = await exec("node", [p(`${appHome()}/mods/${NAME}/anim-frames.js`), p(pp), browser, p(src), p(`${dir}/${key}`), "800"], { timeout: 120000 });
  if (r.code !== 0) throw new Error((r.stderr || "").trim() || "프레임을 풀지 못했습니다");
  const m = JSON.parse(r.stdout);
  const out = { w: m.w, h: m.h, durations: m.durations, frames: m.durations.map((_, i) => `${CACHE}/${key}-${String(i).padStart(3, "0")}.png`) };
  await fs.writeFile(meta, JSON.stringify(out));
  return out;
}

// 후보 경로를 어느 머신에서 찾을지 정하고(machineCandidates), 실제로 있는 첫 머신·경로를 고른다.
// 하나도 없으면 첫 머신의 가장 긴 후보를 열어 뷰어가 없다고 보여 준다.
async function locate(candidates, first) {
  const remotes = readyRemotes(machines());
  const list = machineCandidates(candidates[0].path, first, remotes, window()?.platform === "windows");
  for (const on of list) {
    const c = await existing(candidates, on, true);
    if (c) return { c, on };
  }
  return { c: candidates[0], on: list[0] };
}

// 다른 머신 영상의 미리보기 이름. 파일이 바뀌면 수정 시각이 달라져 새로 만든다.
async function remoteVideoKey(on, path) {
  // GNU stat(-c %Y)이 없으면(macOS 원격) BSD stat(-f %m)으로. 둘 다 안 되면 "0"이라 캐시가 갱신되지 않던 것을 막는다.
  const r = await exec("sh", ["-c", 'stat -c %Y "$1" 2>/dev/null || stat -f %m "$1"', "sh", path], { on }).catch(() => null);
  return `${remoteName(on, path).replace(/\.[^.]*$/, "")}-${r?.code === 0 ? r.stdout.trim() : "0"}`;
}

// 소리나 영상 하나를 ffplay로 튼다. ffplay는 밖에서 일시정지나 위치 이동을 받지 않아서,
// 멈추면 프로세스를 끝내고 다시 틀 때 그 자리(-ss)에서 새로 띄운다 (Files+ 모드의 방식).
// 위치도 알려 주지 않아 시작한 자리와 흐른 시간으로 센다. 영상 창 안에서 멈추면 재생바와 어긋난다.
class Player {
  constructor() { this.track = null; }

  pos() { return position(this.track, Date.now()); }

  // items: [{ name, source }] 하나, 또는 A/B 비교면 둘. source(): 틀 경로나 sftp 주소를 돌려주는 async 함수.
  // at초부터 튼다. A/B는 같은 시각에서 소리만 번갈아 듣는 용도라 영상 창을 띄우지 않는다.
  start(items, video, at, cx) {
    this.stop();
    const track = this.track = { items, side: 0, name: items[0].name, video: video && items.length === 1, src: null, duration: 0, offset: at, startedAt: 0, playing: false, pid: null, status: "준비 중…", error: null };
    cx.notify();
    cx.spawn(async cx => {
      try {
        await this.load(track);
        if (this.track !== track) return;
        track.status = null;
        await this.launch(track, seekTo(at, track.duration));
      } catch (e) { if (this.track === track) { track.error = String(e?.message ?? e); track.status = null; } }
      finally { cx.notify(); }
    });
  }

  // 지금 쪽(A 또는 B)의 주소와 길이를 한 번만 구해 둔다.
  async load(track) {
    const item = track.items[track.side];
    item.src ??= await item.source();
    item.duration ||= await probeDuration(item.src);
    Object.assign(track, { name: item.name, src: item.src, duration: item.duration });
  }

  // A/B 전환: 지금 위치 그대로 다른 쪽으로 바꾼다. 멈춰 있었으면 멈춘 채로 바꾼다.
  swap(cx) {
    const t = this.track;
    if (!t || t.items.length < 2 || t.launching || !t.src) return;
    const at = this.pos(), was = t.playing;
    stopPlayer(t.pid);
    Object.assign(t, { pid: null, playing: false, offset: at, side: 1 - t.side, src: null, launching: true });
    cx.notify();
    cx.spawn(async cx => {
      try { await this.load(t); t.launching = false; if (was && this.track === t) await this.launch(t, seekTo(at, t.duration)); }
      catch (e) { t.error = String(e?.message ?? e); }
      finally { t.launching = false; cx.notify(); }
    });
  }

  async launch(track, at) {
    track.launching = true;
    try {
      const pid = Number(await launchPlayer(track.src, at, track.video));
      if (!pid) throw new Error("ffplay를 띄우지 못했습니다");
      if (this.track !== track) { stopPlayer(pid); return; }
      Object.assign(track, { pid, offset: at, startedAt: Date.now(), playing: true, error: null });
    } finally { track.launching = false; }
  }

  relaunch(track, at, cx) {
    cx.spawn(async cx => { try { await this.launch(track, at); } catch (e) { track.error = String(e?.message ?? e); } finally { cx.notify(); } });
  }

  toggle(cx) {
    const t = this.track;
    if (!t?.src || t.launching) return;
    if (t.playing) { stopPlayer(t.pid); Object.assign(t, { offset: this.pos(), playing: false, pid: null }); cx.notify(); return; }
    this.relaunch(t, t.duration && t.offset >= t.duration - 0.5 ? 0 : t.offset, cx);
  }

  seek(seconds, cx) {
    const t = this.track;
    if (!t?.src || t.launching) return;
    const at = seekTo(seconds, t.duration);
    if (!t.playing) { t.offset = at; cx.notify(); return; }
    stopPlayer(t.pid);
    Object.assign(t, { pid: null, playing: false, offset: at });
    this.relaunch(t, at, cx);
  }

  stop() {
    stopPlayer(this.track?.pid);
    this.track = null;
  }

  // 1초마다: 재생바를 움직이고, ffplay가 끝났는지(끝까지 틀었거나 영상 창을 닫았는지) 본다.
  tick(cx) {
    const t = this.track;
    if (!t?.playing || this.checking) return;
    this.checking = true;
    const pid = t.pid;
    cx.spawn(async cx => {
      try {
        const alive = await isRunning(pid);
        if (this.track === t && t.pid === pid && !alive) Object.assign(t, { offset: this.pos(), playing: false, pid: null });
      } finally { this.checking = false; cx.notify(); }
    });
  }

  // 패널 아래의 재생바: 재생/일시정지, −10초/+10초, (A/B면) 전환, 이름, 시간, 닫기, 눌러서 옮기는 막대.
  view(t, button) {
    const tr = this.track, ab = tr.items.length === 2;
    const pos = this.pos(), frac = tr.duration ? Math.min(1, pos / tr.duration) : 0;
    return v_flex().id("media-bar").flex_none().gap(6).px(12).py(8).border_t(1).border_color(t.border).bg(t.surface)
      .child(h_flex().gap(6).items_center()
        .child(button("media-play", tr.playing ? "❚❚" : "▶", cx => this.toggle(cx)))
        .child(button("media-back", "−10초", cx => this.seek(pos - 10, cx)))
        .child(button("media-fwd", "+10초", cx => this.seek(pos + 10, cx)))
        .when(ab, el => el.child(button("media-swap", tr.side ? "⇄ A로" : "⇄ B로", cx => this.swap(cx))))
        .child(div().flex_1().min_w(0).truncate().text_size(12).child(`${ab ? (tr.side ? "B" : "A") : tr.video ? "영상" : "소리"} · ${tr.name}`))
        .child(div().flex_none().text_size(11).text_color(t.dim).child(tr.status || `${clock(pos)} / ${tr.duration ? clock(tr.duration) : "–:––"}`))
        .child(button("media-stop", "✕", cx => { this.stop(); cx.notify(); })))
      .child(div().id("media-progress").h(6).w_full().rounded(3).bg(t.border).cursor_pointer()
        .on_mouse_down("left", (e, cx) => { if (tr.duration && e.local_position && e.bounds?.width) this.seek(clickToSeconds(e.local_position.x, e.bounds.width, tr.duration), cx); })
        .child(div().h(6).rounded(3).bg(t.accent).w(`${(frac * 100).toFixed(2)}%`)))
      .when(Boolean(tr.error), el => el.child(div().text_size(11.5).text_color(t.ansi1).child(tr.error)));
  }
}
// 그림을 image()가 그릴 수 있는 앱 폴더 캐시로 옮기고 "이름|그릴 너비|그릴 높이|원본 너비|원본 높이"를 돌려준다.
// 이 PC의 작은 그림은 그대로 복사하고(PowerShell 없이 fs로), 2MB가 넘거나 2400px보다 크면 ffmpeg로 1600px 안으로 줄인다.
// 큰 원본(최대 3648×2048, 14.8MB)을 그대로 그리면 느리다. 다른 머신의 그림은 ffmpeg가 sftp로 읽어 줄인다(scp 없이).
// svg나 홈 밖의 파일처럼 이 길로 안 되는 것은 null을 돌려 예전 방식(PowerShell)으로 넘긴다.
const sampleHash = (bytes, seed) => { let h = 5381; for (const ch of seed) h = (h * 33 + ch.codePointAt(0)) >>> 0; for (let i = 0; i < bytes.length; i += 997) h = (h * 33 + bytes[i]) >>> 0; return `${h.toString(16)}-${bytes.length}`; };
async function cacheImageFast(on, path) {
  if (/\.svg$/i.test(path)) return null;
  const dir = `${appHome()}/${CACHE}`;
  await fs.mkdir(dir, { recursive: true });
  let src = path, name, w = 0, h = 0;
  if (on) {
    src = await remoteUrl(on, path);
    const v = (await probeInfo(src))?.streams?.find(s => s.width);
    w = v?.width ?? 0; h = v?.height ?? 0;
    name = `${await remoteVideoKey(on, path)}-img.png`;
  } else {
    const bytes = await fs.readFile(path);
    ({ w, h } = imageSize(bytes));
    name = sampleHash(bytes, path);
    if (bytes.length <= 2 * 1048576 && Math.max(w, h) <= 2400) {
      name += path.slice(path.lastIndexOf(".")).toLowerCase();
      // fs.writeFile은 바이트 배열을 0바이트로 써서(모드 런타임 문제) 그림이 빈 화면이 됐다. 복사는 cmd로 하고, 0바이트 캐시는 다시 만든다.
      const dst = `${dir}/${name}`;
      if (!(await fs.exists(dst)) || !(await fs.readFile(dst)).length) {
        // cmd copy는 파일 이름의 &·% 를 명령으로 읽을 수 있어서, 셸 없이 node로 복사한다.
        const r = await exec("node", ["-e", "require('fs').copyFileSync(process.argv[1], process.argv[2])", winPath(path), winPath(dst)]);
        if (r.code !== 0) throw new Error(r.stderr || "copy failed");
      }
      return `${name}|${w}|${h}|${w}|${h}`;
    }
    name += ".png";
  }
  if (!(await fs.exists(`${dir}/${name}`))) {
    const r = await exec("ffmpeg", ["-y", "-v", "error", "-i", on ? src : winPath(src), "-frames:v", "1", "-vf", "scale='min(1600,iw)':'min(1600,ih)':force_original_aspect_ratio=decrease", "-update", "1", winPath(`${dir}/${name}`)], { timeout: 120000 });
    if (r.code !== 0) throw new Error(r.stderr || "ffmpeg failed");
  }
  const out = imageSize(await fs.readFile(`${dir}/${name}`));
  return `${name}|${out.w}|${out.h}|${w || out.w}|${h || out.h}`;
}
// 캐시 이름: 다른 머신은 경로·수정 시각, 이 PC는 목록에서 아는 크기·수정 시각으로 정해 파일이 바뀌면 새로 만든다.
const mediaKey = async (on, path, entry) => on ? remoteVideoKey(on, path) : `${remoteName("", path).replace(/\.[^.]*$/, "")}-${entry?.mtime ?? 0}-${entry?.size ?? 0}`;
// ffmpeg로 캐시 그림 하나를 만든다(이미 있으면 그대로). PowerShell을 거치지 않아 0.4초쯤 빠르다.
async function ffmpegToCache(name, inputArgs, outputArgs) {
  const dir = `${appHome()}/${CACHE}`;
  await fs.mkdir(dir, { recursive: true });
  if (!(await fs.exists(`${dir}/${name}`))) {
    const part = `${dir}/part-${name}`;
    const r = await exec("ffmpeg", ["-y", "-v", "error", ...inputArgs, ...outputArgs, "-frames:v", "1", "-update", "1", winPath(part)], { timeout: 300000 });
    if (r.code !== 0 || !(await fs.exists(part))) throw new Error(r.stderr || "ffmpeg failed");
    await finishPart(part, `${dir}/${name}`);
  }
  return imageSize(await fs.readFile(`${dir}/${name}`));
}
// 캐시 정리(하루 한 번): 캐시 폴더(받아 둔 원격 파일 remote/ 포함)에서 3일 넘은 것, 그리고 합이 500MB를 넘으면 오래된 것부터 지운다.
// 지울 목록은 명령줄 길이 제한을 피해 파일로 넘긴다.
async function cleanCache() {
  const dir = winPath(`${appHome()}/${CACHE}`);
  const list = await exec("node", ["-e", "const fs=require('fs'),path=require('path'),o=[];const walk=(d,k)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(k<2)walk(p,k+1)}else{const s=fs.statSync(p);o.push({path:p,size:s.size,mtime:s.mtimeMs})}}};walk(process.argv[1],0);process.stdout.write(JSON.stringify(o))", dir]);
  if (list.code !== 0) return;
  const del = cacheToDelete(JSON.parse(list.stdout || "[]"), Date.now());
  if (!del.length) return;
  const file = `${appHome()}/data/file-viewer/clean.json`;
  await fs.mkdir(`${appHome()}/data/file-viewer`, { recursive: true });
  await fs.writeFile(file, JSON.stringify(del));
  await exec("node", ["-e", "const fs=require('fs');for(const p of JSON.parse(fs.readFileSync(process.argv[1],'utf8')))try{fs.unlinkSync(p)}catch{}", winPath(file)], { timeout: 120000 });
}

// 모드의 console.log는 볼 곳이 없어서, 문제를 data/file-viewer/debug.log에 덧붙인다(끝 50KB만 남긴다).
async function logDebug(text) {
  try {
    const dir = `${appHome()}/data/file-viewer`, file = `${dir}/debug.log`;
    await fs.mkdir(dir, { recursive: true });
    const old = (await readTextFile(file).catch(() => null)) ?? "";
    await fs.writeFile(file, (old + `${new Date().toISOString()} ${text}\n`).slice(-50000));
  } catch {}
}

// 다 쓴 .part 파일을 제 이름으로 바꾼다. fs.rename이 막혀 있으면 node로.
async function finishPart(part, final) {
  try { await fs.rename(part, final); }
  catch { const r = await exec("node", ["-e", "require('fs').renameSync(process.argv[1], process.argv[2])", winPath(part), winPath(final)]); if (r.code !== 0) throw new Error(r.stderr || "rename failed"); }
}
// 영상 미리보기 장면: 1초 지점(그보다 짧으면 첫 장면)을 960px 안의 JPG로. "이름|너비|높이".
async function cachePoster(on, path, entry) {
  const name = `${await mediaKey(on, path, entry)}.jpg`, src = on ? await remoteUrl(on, path) : winPath(path);
  const out = ["-vf", "scale='min(960,iw)':-2", "-pix_fmt", "yuvj420p", "-c:v", "mjpeg", "-q:v", "3", "-f", "image2"];
  const size = await ffmpegToCache(name, ["-ss", "1", "-i", src], out).catch(() => ffmpegToCache(name, ["-i", src], out));
  return `${name}|${size.w}|${size.h}`;
}
// 1MiB가 넘는 텍스트(7.8~11MB json 등)는 readTextFile이 못 읽어서 앞 1MB만 가져온다. 이렇게 연 파일은 고칠 수 없다.
async function textHead(on, path) {
  if (on) { const r = await exec("head", ["-c", "1000000", path], { on }); if (r.code !== 0) throw new Error(r.stderr); return r.stdout; }
  // 이 PC도 앞 1MB만 읽는다(예전에는 2GB 로그도 통째로 읽은 뒤 잘랐다). 홈 밖(D:\ 등)의 파일도 된다.
  const r = await exec("node", ["-e", "const fs=require('fs'),fd=fs.openSync(process.argv[1],'r'),b=Buffer.alloc(1000000),n=fs.readSync(fd,b,0,b.length,0);process.stdout.write(b.subarray(0,n).toString('utf8'))", winPath(path)]);
  if (r.code !== 0) throw new Error(r.stderr || "read failed");
  return r.stdout;
}
// 다른 머신에 텍스트를 쓴다: hc file write는 표준 입력을 받으므로 임시 파일을 node로 흘려 넣는다(exec는 표준 입력을 못 준다).
async function writeRemote(on, path, text) {
  const tmp = `${appHome()}/data/file-viewer/save-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
  await fs.mkdir(`${appHome()}/data/file-viewer`, { recursive: true });
  await fs.writeFile(tmp, text);
  const r = await exec("node", ["-e", 'const r=require("child_process").spawnSync("hc",["file","write","--on",process.argv[1],process.argv[2]],{input:require("fs").readFileSync(process.argv[3])});process.stderr.write(String(r.stderr||r.error||""));process.exit(r.status??1)', on, path, tmp], { timeout: 120000 });
  try { await fs.rm(tmp); } catch {}
  if (r.code !== 0) throw new Error(r.stderr || "hc file write failed");
}
// 이 PC의 폴더 목록을 [이름, 폴더인지, 크기, 수정 시각(초)]로 내는 node 스크립트. 링크는 가리키는 쪽을 따른다.
const NODE_LIST = 'const fs=require("fs"),p=process.argv[1],o=[];for(const d of fs.readdirSync(p,{withFileTypes:true})){if(d.name===".git")continue;if(o.length>500)break;let s=null;try{s=fs.statSync(p+"/"+d.name)}catch{}o.push([d.name,s?s.isDirectory():d.isDirectory(),s?s.size:0,s?Math.floor(s.mtimeMs/1000):0])}process.stdout.write(JSON.stringify(o))';
// 영상·소리의 해상도·fps·코덱·길이·소리 정보. 다른 머신의 파일은 sftp 주소로 앞부분만 읽는다.
async function probeInfo(src) {
  const r = await exec("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", "-i", src.startsWith("sftp://") ? src : winPath(src)], { timeout: 60000 }).catch(() => null);
  try { return r?.code === 0 ? JSON.parse(r.stdout) : null; } catch { return null; }
}
const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };
const PER_FOLDER = 500, TOTAL = 5000;

async function directory(path, on) {
  const windowsDirectory = async () => {
    // Windows PowerShell otherwise uses the console code page; exec decodes UTF-8.
    // Links keep directory attributes even when dangling; check their target.
    // Other reparse points (OneDrive's folders) have no LinkType and are folders.
    // PowerShell reads curly single quotes as quotes too, so they're doubled like '.
    const r = await exec("powershell", ["-NoProfile", "-Command", "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & { param($p) @(Get-ChildItem -LiteralPath $p -Force -ErrorAction Stop | Where-Object Name -ne '.git' | Select-Object -First 501 | ForEach-Object { @{ name=$_.Name; dir=($_.PSIsContainer -and (-not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not $_.LinkType -or ($_.Target -and [IO.Directory]::Exists(([IO.Path]::Combine([IO.Path]::GetDirectoryName($_.FullName), $_.Target[0])))))) } }) | ConvertTo-Json -Compress } '" + path.replace(/['‘’‚‛]/g, "$&$&") + "'"], { on });
    if (r.code !== 0) throw new Error(r.stderr || "이 폴더를 읽지 못했습니다");
    const result = JSON.parse(r.stdout || "[]");
    return Array.isArray(result) ? result : [result];
  };
  // 이 PC: node 한 번으로 이름·종류·크기·수정 시각까지 (136ms). PowerShell Get-ChildItem은 1.7초가 걸렸다. node가 없으면 PowerShell로.
  if (!on && window()?.platform === "windows") {
    const r = await exec("node", ["-e", NODE_LIST, path]).catch(() => null);
    if (r?.code === 0) return JSON.parse(r.stdout).map(([name, dir, size, mtime]) => ({ name, dir, size, mtime }));
    return windowsDirectory();
  }
  // 다른 머신: GNU find 한 번으로 크기·시각까지 (124ms). find가 다르면(macOS) 아래 sh 스크립트로.
  if (on) {
    const r = await exec("find", remoteListArgs(path), { on }).catch(() => null);
    if (r?.code === 0) return parseFindListing(r.stdout).slice(0, 501);
  }
  const script = 'n=0; for p in "$1"/* "$1"/.[!.]* "$1"/..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; name=${p##*/}; [ "$name" = .git ] && continue; if [ -d "$p" ]; then kind=d; else kind=f; fi; printf "%s\\0%s\\0" "$kind" "$name"; n=$((n+1)); [ "$n" -gt 500 ] && break; done; test -d "$1"';
  let r;
  try { r = await exec("sh", ["-c", script, "files", path], { on }); }
  catch (e) {
    if (on && String(e).includes("cannot start sh: program not found")) return windowsDirectory();
    throw e;
  }
  if (r.code !== 0) throw new Error(r.stderr || "이 폴더를 읽지 못했습니다");
  const fields = r.stdout.split("\0"), out = [];
  for (let i = 0; i + 1 < fields.length; i += 2) out.push({ name: fields[i + 1], dir: fields[i] === "d" });
  return out;
}

// Orca·VS Code처럼: 오른쪽 패널의 트리(role "tree")에서 파일을 누르면 가운데 미리보기 탭(role "viewer")에 크게 연다.
// 미리보기 탭은 스페이스마다 하나를 계속 쓰고(VS Code의 미리보기 탭처럼), 둘은 shared 메시지로 주고받는다.
const DOCK_FILE = () => `${appHome()}/data/file-viewer/dock.txt`;
const COPIED = "file-viewer.copied", TREEW = "file-viewer.treeWidth", REQUEST = "file-viewer.request", PLAYING = "file-viewer.playing", CLEANED = "file-viewer.cleaned";
const OPEN = "file-viewer.open", TREE = "file-viewer.tree", VIEWERS = "file-viewer.viewers", BACK = "file-viewer.back";
// herdrview: 링크 처리기(herdr-link.js)가 Ctrl+클릭한 주소를 적어 두는 곳.
const LINK = "data/file-viewer/link.txt";
// 영상 재생에 쓰는 mpv: PATH(where mpv)를 먼저, 없으면 흔한 설치 위치(mpvCandidates)에서 찾는다(한 번만).
// GUI용 mpv.exe를 장면 자리에 테두리 없이 띄운다. 없으면 ffplay로 넘어간다.
// Poppler(pdftoppm·pdfinfo·pdftotext)가 든 폴더. winget으로 막 설치하면 이미 떠 있는 Herdr의 PATH에는 없어서,
// PATH → scoop·choco·Homebrew 자리 → winget 패키지 폴더(버전 이름이라 찾아본다) 순으로 찾는다. 못 찾은 결과는 기억하지 않는다(설치 뒤 바로 되게).
let popplerBin;
const FIND_POPPLER = "const fs=require('fs'),p=require('path'),[l,w]=process.argv.slice(1);let f=JSON.parse(l).find(x=>fs.existsSync(x));if(!f&&w&&fs.existsSync(w))for(const a of fs.readdirSync(w).filter(n=>n.startsWith('oschwartz10612.Poppler'))){for(const b of fs.readdirSync(p.join(w,a)).filter(n=>n.startsWith('poppler-'))){const e=p.join(w,a,b,'Library','bin','pdftoppm.exe');if(fs.existsSync(e)){f=e;break}}if(f)break}process.stdout.write(f||'')";
async function findPoppler() {
  if (popplerBin) return popplerBin;
  const win = window()?.platform === "windows";
  const where = await exec(win ? "where" : "which", ["pdftoppm"]).catch(() => null);
  const found = where?.code === 0 ? where.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean) : [];
  const list = [...found, ...popplerCandidates(window()?.platform, home())];
  const r = await exec("node", ["-e", FIND_POPPLER, JSON.stringify(list), win ? `${home()}/AppData/Local/Microsoft/WinGet/Packages` : ""]).catch(() => null);
  const exe = r?.stdout.trim();
  return popplerBin = exe ? exe.replace(/[\\/][^\\/]+$/, "") : null;
}

let mpvPath;
async function findMpv() {
  if (mpvPath !== undefined) return mpvPath;
  const where = await exec(window()?.platform === "windows" ? "where" : "which", ["mpv"]).catch(() => null);
  const found = where?.code === 0 ? where.stdout.split(/\r?\n/).map(l => l.trim()).filter(l => /mpv(\.exe)?$/i.test(l)) : [];
  const list = [...found, ...mpvCandidates(window()?.platform, home())];
  const r = await exec("node", ["-e", "const fs=require('fs');process.stdout.write(JSON.parse(process.argv[1]).find(p=>fs.existsSync(p))||'')", JSON.stringify(list)]).catch(() => null);
  return mpvPath = r?.stdout.trim() || null;
}
const activeSpace = () => currentSpace(focused(), spaces())?.id ?? null;
const viewerAlive = tab => panes().some(p => p.tab === tab && p.mod === NAME);
const tabIds = space => (spaces().find(s => s.id === space)?.tabs ?? []).map(t => t.id);
const wait = (cx, ms) => new Promise(resolve => cx.timer.after(ms, () => resolve()));
// msg: { folder, on, file(폴더 기준 상대 경로), t?, b? }. 미리보기 탭이 살아 있으면 메시지로 바꾸고, 없으면 새로 만든다.
// msg가 null이면 파일 없이 미리보기 탭으로 가기만 한다(Ctrl+Shift+G).
// 열기 창(overlay)을 닫으면 Herdr가 그 아래 원래 탭으로 포커스를 돌려놓아, 이미 있는 미리보기 탭을 골라도 화면이 안 넘어갔다.
// 그래서 고른 탭을 기억해 두었다가 창을 닫은 뒤에 한 번 더 고른다(closeAndShow).
let showAfterClose = null;
function closeAndShow(overlay) {
  closeOverlay(overlay);
  if (showAfterClose) { run("tab.select", { id: showAfterClose }); showAfterClose = null; }
}
async function openInViewer(msg, cx) {
  const space = activeSpace(), name = msg?.file ? msg.file.split("/").pop() : "미리보기", tab = (shared(VIEWERS) ?? {})[space];
  // 미리보기 탭이 아닌 곳에서 왔으면, Ctrl+Shift+G로 돌아갈 탭으로 기억한다.
  const current = focused()?.tab;
  if (current && current !== tab) setShared(BACK, { ...(shared(BACK) ?? {}), [space]: current });
  if (tab && viewerAlive(tab)) {
    if (msg) setShared(OPEN, { ...msg, space, seq: Date.now() });
    run("tab.select", { id: tab });
    if (msg?.file) run("tab.rename", { id: tab, name });
    showAfterClose = tab;
    return;
  }
  const before = new Set(tabIds(space)), at = rightOf(tabIds(space), current);
  // space: 이 탭이 속한 스페이스. 모드가 다시 읽힐 때 그 순간 보이던 스페이스로 잘못 기억하지 않게 속성으로 남긴다.
  run("tab.new", { name, mod: NAME, props: { role: "viewer", space, ...msg } });
  // tab.new는 새 탭 id를 돌려주지 않아서, 잠깐 기다리며 새로 생긴 탭을 찾아 기억한다 (Orca의 방식).
  // 새 탭은 맨 끝에 생기므로 지금 탭 바로 오른쪽으로 옮긴다.
  for (let i = 0; i < 40; i++) {
    const made = tabIds(space).find(id => !before.has(id) && viewerAlive(id));
    if (made) { setShared(VIEWERS, { ...(shared(VIEWERS) ?? {}), [space]: made }); run("tab.move", { id: made, index: at }); showAfterClose = made; return; }
    await wait(cx, 50);
  }
}

// Ctrl+Shift+G(복사한 경로 없음): 미리보기 탭이 아니면 그리로 가고, 미리보기 탭이면 원래 탭으로 돌아간다.
// 트리는 미리보기 탭 안에 있어서 탭과 같이 오간다.
async function toggleViewer(cx) {
  const space = activeSpace(), viewer = (shared(VIEWERS) ?? {})[space];
  const step = viewerToggle({ current: focused()?.tab, viewer: viewer && viewerAlive(viewer) ? viewer : null, back: (shared(BACK) ?? {})[space], tabs: tabIds(space) });
  // 떠나는 탭(터미널)의 폴더·머신을 같이 보내 트리가 그 스페이스의 폴더를 보여 주게 한다.
  if (step.action === "open") {
    const loc = location(), msg = folderRequest(loc);
    if (msg) {
      const top = await exec("git", ["rev-parse", "--show-prefix"], { cwd: loc.cwd, on: loc.on ?? null, timeout: 5000 }).catch(() => null);
      const root = top?.code === 0 ? await projectRootOf(loc.cwd, loc.on ?? null, top.stdout.trim()) : null;
      if (root) Object.assign(msg, { folder: root, back: root === loc.cwd ? null : loc.cwd });
    }
    return openInViewer(msg, cx);
  }
  if (step.tab) run("tab.select", { id: step.tab }); else run("tab.prev");
}

// 단축키(Ctrl+Shift+G)로 불렸을 때: 터미널에서 복사해 둔 경로가 있으면 그 파일로 연다.
// 같은 복사본으로 두 번째 누르면 예전처럼 닫히도록, 한 번 쓴 글은 기억해 둔다.
// base: 경로 열기(path-picker)에서 온 요청이면 그 터미널의 폴더·머신. 이때는 "한 번 쓴 글" 검사를 건너뛴다.
async function openFromClipboard(clip, cx, base = null) {
  // shown: 예전 방식으로 터미널 옆에 분할해 연 뷰어. 미리보기 탭 자체는 아니다(그걸 닫으면 탭이 사라진다).
  const overlay = props().overlay, tab = focused()?.tab, viewer = (shared(VIEWERS) ?? {})[activeSpace()];
  const shown = tab !== viewer && panes().find(p => p.mod === NAME && p.tab === tab);
  let used = "";
  try { used = localStorage.getItem("opened-clipboard") ?? ""; } catch {}
  const fresh = base || (clip !== used && clip !== shared(COPIED)), request = fresh ? parseOpenRequest(clip) : null;
  try {
    if (request) {
      try { localStorage.setItem("opened-clipboard", clip); } catch {}
      // 줄바꿈으로 잘린 경로는 후보가 여럿이다. 실제로 있는 머신과 가장 긴 후보를 고른다. B는 A와 같은 머신에서 찾는다.
      const { c: a, on } = await locate(request[0], base ? base.on : location().on);
      // A가 다음 줄까지 이어 붙인 경로(꺾인 경로)로 있으면 B는 없다.
      const b = request[1] && !a.joined ? await existing(request[1], on) : null;
      // 폴더면 그 폴더를 트리로 연다(파일로 미리보려다 실패하던 것).
      if (!b && await isDirectory(a.path, on)) { await openInViewer({ folder: a.path, on, file: null }, cx); return; }
      const { folder, file } = splitPath(a.path);
      setShared(TREE, { seq: Date.now(), space: activeSpace(), cwd: folder, on });
      await openInViewer({ folder, on, file, t: a.t, b: b?.path ?? null }, cx);
      return;
    }
    // 상대 경로(output/html/detail-page.html)면 지금 터미널 폴더 아래에서 그 경로로 끝나는 것을 찾아, 가장 최근 것을 연다.
    const rel = fresh ? parseRelative(clip) : null;
    if (rel) {
      try { localStorage.setItem("opened-clipboard", clip); } catch {}
      const loc = base ?? location(), on = loc?.on ?? null, found = loc?.cwd ? await findRelative(loc.cwd, on, rel.rel) : [];
      const hit = found.find(f => f.path === pickNewest(found));
      if (!hit) { notify({ title: "그 경로를 찾지 못했습니다", body: `${rel.rel} (${loc?.cwd ?? "폴더 모름"} 아래)`, level: "warning" }); return; }
      if (hit.dir) { await openInViewer({ folder: hit.path, on, file: null }, cx); return; }
      const { folder, file } = splitPath(hit.path);
      await openInViewer({ folder, on, file, t: rel.t, b: null }, cx);
      return;
    }
    // 경로가 없으면 미리보기 탭을 오간다. 예전에 분할 창으로 연 뷰어가 이 탭에 있으면 그것을 닫는다.
    if (shown) run("pane.close", { pane: shown.pane }); else await toggleViewer(cx);
  } finally { closeAndShow(overlay); }
}

export default class Files extends View {
  init(_props, cx) {
    if (props()?.overlay) {
      // herdrview: 링크를 Ctrl+클릭하면 처리기(herdr-link.js)가 link.txt에 적고 이 모드를 부른다. 방금 들어온 링크가 먼저다.
      let clip = "";
      try { clip = cx.read_from_clipboard() ?? ""; } catch {}
      cx.spawn(async cx => {
        // 경로 열기(path-picker)에서 방금 고른 경로가 먼저다.
        const req = shared(REQUEST);
        let usedReq = "";
        try { usedReq = localStorage.getItem("opened-request") ?? ""; } catch {}
        if (req && Date.now() - req.seq < 10000 && String(req.seq) !== usedReq) {
          try { localStorage.setItem("opened-request", String(req.seq)); } catch {}
          return openFromClipboard(req.text, cx, { cwd: req.cwd, on: req.on ?? null });
        }
        const link = parseLinkRequest(await readTextFile(`${appHome()}/${LINK}`).catch(() => null), Date.now());
        let used = "";
        try { used = localStorage.getItem("opened-link") ?? ""; } catch {}
        if (!link || String(link.stamp) === used) return openFromClipboard(clip, cx);
        try { localStorage.setItem("opened-link", String(link.stamp)); } catch {}
        try {
          const { on } = await locate([{ path: link.path, t: link.t }], link.machine ?? location().on);
          const { folder, file } = splitPath(link.path);
          setShared(TREE, { seq: Date.now(), space: activeSpace(), cwd: folder, on });
          await openInViewer({ folder, on, file, t: link.t, b: null }, cx);
        } finally { closeAndShow(props().overlay); }
      });
      return;
    }
    this.saved = new Map();
    // 개발용: Ctrl+F 찾기(find), 로그 따라가기(following), git 변경(diff). 따라가기는 1초마다 끝을 다시 읽는다.
    this.treeW = Number(shared(TREEW)) || undefined;
    this.scroll = ScrollHandle.new(); this.find = null; this.following = false; this.diff = null;
    cx.timer.every(1000, cx => this.followTick(cx));
    // 장면 자리에 붙인 mpv 창: 0.1초마다 놓일 자리와 보일지(이 탭이 앞에 있는지)를 도우미에게 알린다.
    cx.timer.every(100, () => this.dockTick());
    // 움직이는 그림: 보이는 동안만 원래 프레임 간격대로 넘긴다(프레임이 바뀔 때만 다시 그린다).
    cx.timer.every(50, cx => {
      const a = this.anim;
      if (!a || (this.role === "viewer" && focused()?.tab !== (shared(VIEWERS) ?? {})[this.space])) return;
      const i = frameAt(a.durations, Date.now() - a.start);
      if (i !== a.i) { a.i = i; cx.notify(); }
    });
    // 미리보기 탭은 "file-viewer.play" 명령(keys.json이나 `herdr-app do file-viewer.play`)으로 지금 영상을 튼다.
    if (props()?.role === "viewer") cx.spawn(async cx => { for (;;) { const c = await nextCommand(); if (c === "play" && this.file && kindOf(this.file) === "video") this.play(cx); cx.notify(); } });
    this.entries = new Map(); this.folders = new Set(); this.pending = new Set(); this.marks = {};
    this.player = new Player();
    // tree: 오른쪽 패널의 폴더 트리, viewer: 가운데 미리보기 탭, 없으면 예전처럼 둘 다 한 창에.
    this.role = props()?.role ?? null;
    this.space = props()?.space ?? activeSpace();
    this.seen = initialSeen(shared(OPEN), Date.now()); this.seenTree = shared(TREE)?.seq ?? 0;
    // 복사한 경로로 열렸으면: 그 파일의 시작 시각과 A/B로 비교할 다른 파일(절대 경로).
    this.request = props()?.file ? { file: props().file, t: props().t ?? 0, b: props().b ?? null } : null;
    this.refresh(cx);
    this.pendingShow = props()?.file ?? null;
    if (this.role) cx.timer.every(300, cx => this.follow(cx));
    // 10초 새로고침: 보이지 않는 미리보기 탭은 건너뛴다(숨은 탭마다 폴더 목록과 git을 다시 읽었다).
    cx.timer.every(10000, cx => { if (this.role === "viewer" && focused()?.tab !== (shared(VIEWERS) ?? {})[this.space]) return; this.refresh(cx); });
    // 캐시 정리: 하루에 한 번, 모든 뷰어 중 하나만.
    if (shared(CLEANED) !== new Date().toDateString()) { setShared(CLEANED, new Date().toDateString()); cx.spawn(async () => cleanCache().catch(() => null)); }
    cx.timer.every(1000, cx => this.player.tick(cx));
  }

  key() {
    // 경로 막대나 더블클릭으로 옮겨 간 폴더(nav)가 있으면 그곳에 머문다.
    const { cwd, on, space } = this.last = this.nav ?? location(this.last);
    return JSON.stringify({ cwd, on, space });
  }

  // 탐색기처럼 그 폴더로 간다. 같은 머신 안에서만 움직인다.
  navigate(path, cx, on = this.on) {
    if (!this.leave(`folder:${path}`)) return;
    this.dirty = false;
    this.nav = { cwd: path, on, space: null };
    this.refresh(cx);
    cx.notify();
  }

  open(cx) {
    const path = `${this.fileRoot}/${this.file}`, on = this.fileOn;
    cx.spawn(async () => {
      try { await openFile(on ? await fetchRemote(on, path) : path); }
      catch (e) { notify({ title: "파일을 열지 못했습니다", body: String(e), level: "error" }); }
    });
  }

  // 소리는 아래 재생바로, 영상은 ffplay 창으로 튼다. 다른 머신의 파일은 받지 않고 sftp로 바로 읽는다.
  // 복사한 경로로 연 파일이면 그 시각부터, 두 번째 경로가 있었으면 A/B로 튼다.
  play(cx, at) {
    const on = this.fileOn, req = this.request?.file === this.file ? this.request : null;
    const item = path => ({ name: splitPath(path).file, path, source: async () => on ? remoteUrl(on, path) : path });
    const items = [item(`${this.fileRoot}/${this.file}`), ...(req?.b ? [item(req.b)] : [])];
    const start = at ?? req?.t ?? 0, video = kindOf(this.file) === "video";
    // 영상 하나(A/B 아님)는 Herdr 안 창에서 mpv로 튼다. 안 되면 예전처럼 ffplay 새 창.
    if (video && items.length === 1) {
      cx.spawn(async cx => {
        try { await this.playWindow(await items[0].source(), start); }
        catch (e) {
          // 모드의 console.log는 볼 곳이 없어서, 왜 창 안 재생이 안 됐는지 파일로 남긴다.
          await logDebug(`mpv 창 재생 실패, ffplay로: ${e?.stack ?? e}`);
          this.player.start(items, true, start, cx);
        }
      });
      return;
    }
    this.player.start(items, video, start, cx);
  }

  // 영상은 mpv로 튼다. GPU로 그려 끊기지 않고 mpv 재생 막대·스페이스·←→·q를 그대로 쓴다.
  // 장면을 눌러 틀면 장면 자리에 Herdr에 딸린 테두리 없는 창으로 붙이고(mpv-dock.ps1), 장면 위치를 모르면 화면 가운데 보통 창으로 튼다.
  // 예전 장면 자리 창은 커서 좌표로 위치를 구해 어긋났다. 지금은 누른 요소의 bounds(창 좌표)를 쓴다.
  // Herdr 안 터미널(kitty) 재생은 1080p에서 끊겼다.
  async playWindow(src, at) {
    this.player.stop(); this.stopMpv();
    // 다른 뷰어(다른 스페이스)가 틀던 창도 끈다.
    const other = shared(PLAYING);
    if (other?.pid) { stopPlayer(other.pid); setShared(PLAYING, null); }
    const exe = await findMpv();
    if (!exe) throw new Error("mpv가 없습니다: winget install shinchiro.mpv");
    const title = splitPath(this.file ?? "mpv").file;
    let pid;
    if (this.anchor) {
      // ▶로 튼 영상: 장면 자리에 붙인다. 놓일 자리를 먼저 써 두고, mpv를 화면 밖에 띄운 뒤 도우미가 Herdr에 딸리게 해 옮긴다.
      const ipc = `\\\\.\\pipe\\herdr-mpv-${Date.now()}`;
      await fs.mkdir(`${appHome()}/data/file-viewer`, { recursive: true });
      this.docked = true; this.dockSent = null; this.dockTick();
      // 자리가 어긋나면 고칠 수 있게, 누른 장면의 bounds와 마우스 좌표로 구한 값, 처음 보낸 자리를 남긴다.
      logDebug(`mpv 붙이기: anchor=${JSON.stringify(this.anchor)} → ${this.dockSent}`);
      pid = Number(await powershell("param($exe, $a, $dock, $file, $ipc) $p = Start-Process -FilePath $exe -ArgumentList $a -PassThru; Start-Process powershell -WindowStyle Hidden -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File \"{0}\" -MpvPid {1} -DockFile \"{2}\" -Ipc \"{3}\"' -f $dock, $p.Id, $file, $ipc); $p.Id",
        exe, quoteArgs(mpvDockArgs({ src, at, title, ipc })), winPath(`${appHome()}/mods/file-viewer/mpv-dock.ps1`), winPath(DOCK_FILE()), ipc));
    } else {
      pid = Number(await powershell("param($exe, $a) (Start-Process -FilePath $exe -ArgumentList $a -PassThru).Id", exe, quoteArgs(mpvWindowArgs({ src, at, title }))));
    }
    if (!pid) { this.native = null; this.docked = false; throw new Error("mpv를 띄우지 못했습니다"); }
    this.native = pid;
    setShared(PLAYING, { pid });
  }

  // 재생 창을 끈다.
  stopMpv() {
    if (this.native) { stopPlayer(this.native); if (shared(PLAYING)?.pid === this.native) setShared(PLAYING, null); }
    this.native = null; this.docked = false;
  }

  rootNow() {
    return { x: this.rootBounds?.x ?? 0, y: this.rootBounds?.y ?? 0, width: this.size?.width ?? 0, height: this.size?.height ?? 0 };
  }

  // 붙인 mpv 창이 놓일 자리를 도우미(mpv-dock.ps1)가 읽는 dock.txt에 쓴다. 바뀔 때만 쓴다.
  // 장면이 안 그려졌거나(찾기·diff 화면) 이 미리보기 탭이 앞에 없으면 숨긴다(도우미가 멈춤도 건다).
  dockTick() {
    if (!this.docked) return;
    const g = this.dockGeom, own = (shared(VIEWERS) ?? {})[this.space];
    const visible = Boolean(g && this.anchor) && (this.role !== "viewer" || focused()?.tab === own);
    const line = dockLine(visible ? dockRect(this.anchor, { root: this.rootNow(), tree: g.tree, poster: g.poster }) : null, visible);
    if (line === this.dockSent) return;
    this.dockSent = line;
    fs.writeFile(DOCK_FILE(), line).catch(() => { this.dockSent = null; });
  }

  // ── Ctrl+F: 파일 안 찾기. 편집기가 줄로 스크롤하는 기능이 없어서, 찾은 줄을 목록으로 보여 준다. ──
  openFind(cx) {
    if (!this.find) {
      const state = InputState.new({ placeholder: "찾을 글 (Esc 닫기)" });
      this.find = { state, query: "", hits: [], sel: 0 };
      state.on("change", (_e, cx) => { const q = state.value(); this.find.query = q; this.find.hits = findLines(this.text ?? "", q); this.find.sel = 0; cx.notify(); });
      state.on("submit", (_e, cx) => this.moveFind(1, cx));
    }
    this.find.state.focus();
  }
  closeFind() { this.find?.state.release(); this.find = null; }
  moveFind(step, cx) {
    const f = this.find;
    if (!f?.hits.length) return;
    f.sel = (f.sel + step + f.hits.length) % f.hits.length;
    this.scroll.scroll_to_item(f.sel);
    cx.notify();
  }
  findBar(t) {
    const f = this.find, n = f.hits.length;
    return h_flex().h(36).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
      .on_key_down((e, cx) => { if (e.key === "down") this.moveFind(1, cx); else if (e.key === "up") this.moveFind(-1, cx); })
      .child(div().flex_1().min_w(0).child(Input.new(f.state)))
      .child(div().flex_none().text_size(11.5).text_color(t.dim).child(f.query ? (n ? `${f.sel + 1} / ${n}${n >= 500 ? "+" : ""}줄` : "없음") : ""))
      .child(div().id("find-close").flex_none().px(6).cursor_pointer().text_color(t.muted).on_click((_e, cx) => { this.closeFind(); cx.notify(); }).child("✕"));
  }
  findView(t) {
    const f = this.find, mono = settings().font_family;
    return v_flex().id("find-hits").flex_1().min_h(0).p(6).overflow_y_scrollbar().track_scroll(this.scroll).font_family(mono).text_size(12)
      .children(f.hits.map((h, i) => {
        // 찾은 글자만 강조: 글을 찾은 자리마다 잘라 붙인다.
        const pieces = []; let at = 0;
        for (const k of h.at) { pieces.push(div().child(h.text.slice(at, k))); pieces.push(div().bg(t.selection).text_color(t.foreground).child(h.text.slice(k, k + f.query.length))); at = k + f.query.length; }
        pieces.push(div().child(h.text.slice(at)));
        return h_flex().id(`hit-${i}`).px(6).py(2).rounded(4).when(i === f.sel, el => el.bg(t.selected))
          .on_click((_e, cx) => { f.sel = i; cx.notify(); })
          .child(div().flex_none().w(52).text_color(t.dim).child(String(h.line)))
          .child(h_flex().flex_1().min_w(0).overflow_hidden().whitespace_nowrap().children(pieces));
      }));
  }

  // ── CSV·TSV 표: 열 너비는 그 열의 가장 긴 글(최대 48칸)에 맞춘다. 칸을 다 그리면 무거워서 앞 2000행만 그리고 알린다. ──
  csvView(t) {
    const all = this.rendered.csv, rows = all.slice(0, 2000), widths = this.rendered.widths, cols = widths.length;
    const note = all.length > rows.length ? `앞 ${rows.length.toLocaleString()}행만 보여 줍니다 (읽은 행 ${all.length.toLocaleString()}${all.length >= 5000 ? "개 이상" : "개"}) · 전체는 ‘원문 보기’` : null;
    return div().id("files-csv").flex_1().min_w(0).min_h(0).overflow_scrollbar().text_size(12)
      .when(Boolean(note), el => el.child(div().px(10).py(5).text_size(11.5).text_color(t.dim).child(note)))
      .child(v_flex().children(rows.map((r, i) => h_flex().id(`csv-${i}`).border_b(1).border_color(t.border).when(i === 0, el => el.font_semibold().bg(t.surface))
        .children(Array.from({ length: cols }, (_, c) => div().flex_none().w(widths[c]).px(8).py(4).truncate().border_r(1).border_color(t.border).child(r[c] ?? ""))))));
  }

  // ── 로그 따라가기(tail -f): 켜면 1초마다 끝 256KB를 다시 읽어 마지막 1000줄을 보여 주고 맨 아래로 간다. ──
  followTick(cx) {
    if (this.native && !this.checking) {
      // 창이 닫혔으면(q, 끝까지 재생, 창 닫기) ■ 재생 끄기 버튼을 내린다.
      const pid = this.checking = this.native;
      cx.spawn(async cx => { const alive = await isRunning(pid); this.checking = null; if (!alive && this.native === pid) { this.native = null; this.docked = false; cx.notify(); } });
    }
    if (!this.following || this.reading) return;
    const full = `${this.fileRoot}/${this.file}`, on = this.fileOn, file = this.file;
    this.reading = true;
    cx.spawn(async cx => {
      try {
        const r = on ? await exec("tail", ["-c", "262144", full], { on })
          : await exec("node", ["-e", "const fs=require('fs'),p=process.argv[1],n=262144,fd=fs.openSync(p,'r'),s=fs.fstatSync(fd).size,b=Buffer.alloc(Math.min(n,s));fs.readSync(fd,b,0,b.length,Math.max(0,s-n));process.stdout.write(b.toString('utf8'))", winPath(full)]);
        if (this.file !== file || !this.following) return;
        if (r.code !== 0) { this.tail = [`끝을 읽지 못했습니다: ${(r.stderr || "").trim() || r.code}`]; return; }
        const lines = tailLines(r.stdout, 1000);
        if (lines.join("\n") !== this.tail?.join("\n")) { this.tail = lines; this.scroll.scroll_to_item(lines.length - 1); }
      } finally { this.reading = false; cx.notify(); }
    });
  }
  followView(t) {
    return v_flex().id("files-tail").flex_1().min_h(0).p(8).overflow_y_scrollbar().track_scroll(this.scroll).font_family(settings().font_family).text_size(12)
      .children((this.tail ?? ["불러오는 중…"]).map((l, i) => div().id(`tail-${i}`).whitespace_nowrap().child(l || " ")));
  }

  // ── git 변경: 마지막 커밋(HEAD)과 비교한 diff를 줄마다 색으로. ──
  loadDiff(cx) {
    const { folder, file: name } = splitPath(`${this.fileRoot}/${this.file}`), on = this.fileOn, file = this.file;
    this.diff = { lines: null, note: "비교하는 중…" };
    cx.spawn(async cx => {
      const r = await exec("git", ["-C", on ? folder : winPath(folder), "diff", "--no-color", "HEAD", "--", name], { on }).catch(e => ({ code: -1, stderr: String(e) }));
      if (this.file !== file || !this.diff) return;
      this.diff = r.code !== 0 ? { lines: [], note: /not a git repository|Could not access 'HEAD'/i.test(r.stderr) ? "git 저장소 안의 파일이 아닙니다." : (r.stderr || "git diff 실패").trim() }
        // 큰 diff는 앞 3000줄만 그린다(줄마다 칸을 만들어 느려진다).
        : r.stdout.trim() ? (lines => ({ lines: lines.slice(0, 3000), note: lines.length > 3000 ? `앞 3000줄만 보여 줍니다 (전체 ${lines.length}줄)` : null }))(parseDiff(r.stdout))
        : await exec("git", ["-C", on ? folder : winPath(folder), "ls-files", "--error-unmatch", "--", name], { on }).then(x => x.code === 0).catch(() => true)
          ? { lines: [], note: "마지막 커밋과 같습니다 (바뀐 줄 없음)." }
          : { lines: (this.text ?? "").split(/\r?\n/).slice(0, 3000).map(l => ({ kind: "add", text: "+" + l })), note: "새 파일입니다 (아직 커밋 전). 모든 줄이 추가된 줄입니다." };
      cx.notify();
    });
  }
  diffView(t) {
    const color = { add: t.ansi2, del: t.ansi1, hunk: t.ansi6, meta: t.dim, ctx: t.foreground };
    const bg = { add: "#2ea04326", del: "#f8514926" };
    return v_flex().id("files-diff").flex_1().min_h(0).p(8).overflow_y_scrollbar().font_family(settings().font_family).text_size(12)
      .when(Boolean(this.diff.note), el => el.child(div().p(6).text_color(t.dim).child(this.diff.note)))
      .children((this.diff.lines ?? []).map((l, i) => div().id(`diff-${i}`).px(6).whitespace_nowrap().text_color(color[l.kind]).when(Boolean(bg[l.kind]), el => el.bg(bg[l.kind])).child(l.text || " ")));
  }

  // 마크다운·.mmd 속 Mermaid를 하나씩 그린다. 그리는 동안·실패하면 diagramView가 알려 준다.
  // 사진 확대·축소: 맞춤(null) ↔ 정해진 단계. box: 미리보기 칸 크기(맞춤 배율을 구한다).
  fitScale(box) {
    if (this.pdf) return 1; // PDF는 미리보기 폭에 맞춘 것이 100%
    const p = this.picture;
    return p?.w ? fit({ w: box.w, h: box.h }, p.w, p.h).w / p.w : 1;
  }
  zoomBy(dir, box) { this.zoom = zoomStep(this.zoom, dir, this.fitScale(box)); }

  // 움직이는 그림을 프레임으로 푼다. 프레임이 둘 이상이면 this.anim에 두고 1초 타이머 대신 50ms 타이머가 보이는 동안만 넘긴다.
  drawAnim(full, entry, on, cx) {
    const seq = this.showSeq;
    cx.spawn(async cx => {
      try {
        const a = await animFrames(full, entry, on);
        if (this.showSeq === seq && a.frames.length > 1) { this.anim = { ...a, start: Date.now(), i: 0 }; cx.notify(); }
      } catch (e) { await logDebug(`움직이는 그림 풀기 실패: ${e?.stack ?? e}`); }
    });
  }

  // HTML을 브라우저로 그린다. 그리는 동안은 글 버전을 보여 주고, 다 되면 실제 모습으로 바꾼다.
  drawHtml(full, entry, cx) {
    const seq = this.showSeq, tree = this.wide && !this.treeHidden ? (this.treeW ?? 340) : 0;
    const width = htmlWidth((this.size?.width ?? 1200) - tree - 40);
    this.htmlShot = { pending: true };
    cx.spawn(async cx => {
      try { const s = await renderHtml(full, entry, width); if (this.showSeq === seq) this.htmlShot = s; }
      catch (e) { if (this.showSeq === seq) this.htmlShot = { error: String(e?.message ?? e) }; await logDebug(`HTML 그리기 실패: ${e?.stack ?? e}`); }
      cx.notify();
    });
  }

  // PDF: 쪽 수·제목을 읽고 쪽 그림을 그리기 시작한다. 글(pdftotext)은 Ctrl+F와 "글 보기"에 쓴다.
  // 다른 머신의 PDF는 scp로 가져와서 다룬다. 쪽 그림은 미리보기 폭(480~1280px)으로 캐시에 만든다.
  loadPdf(root, path, entry, on, seq, cx) {
    const shown = () => this.showSeq === seq, full = `${root}/${path}`, win = window()?.platform === "windows";
    this.fileError = on ? `${on}에서 PDF를 가져오는 중…` : "PDF를 여는 중…";
    cx.notify();
    cx.spawn(async cx => {
      try {
        const bin = await findPoppler();
        if (!bin) throw new Error("PDF를 보려면 Poppler가 필요합니다: winget install oschwartz10612.Poppler");
        const exe = name => `${bin}/${name}${win ? ".exe" : ""}`, os = p => win ? winPath(p) : p;
        const src = os(on ? await fetchRemote(on, full) : full);
        const info = parsePdfInfo((await exec(exe("pdfinfo"), ["-enc", "UTF-8", src], { timeout: 30000 }).catch(() => null))?.stdout);
        if (!info) throw new Error("PDF를 열 수 없습니다 (깨졌거나 암호가 걸렸을 수 있음)");
        if (!shown()) return;
        const tree = this.wide && !this.treeHidden ? (this.treeW ?? 340) : 0, width = htmlWidth((this.size?.width ?? 1200) - tree - 40);
        await fs.mkdir(`${appHome()}/${CACHE}`, { recursive: true });
        this.pdf = { src, exe, os, pages: info.pages, width, prefix: `${CACHE}/${pdfKey(full, entry?.mtime ?? 0, entry?.size ?? 0, width)}`, shown: 0, limit: 20, list: [], busy: false, error: null };
        this.showSource = false; this.fileError = null;
        this.info = [this.info, `${info.pages}쪽`, info.title && `“${info.title}”`].filter(Boolean).join(" · ");
        cx.notify();
        this.pdfMore(cx);
        const t = await exec(exe("pdftotext"), ["-q", "-layout", "-enc", "UTF-8", src, "-"], { timeout: 60000 }).catch(() => null);
        if (shown() && t?.code === 0) this.text = t.stdout;
      } catch (e) { if (shown()) this.fileError = String(e?.message ?? e); }
      finally { cx.notify(); }
    });
  }

  // 쪽 그림을 5쪽씩 그려 바로바로 보여 준다. 한도(처음 20쪽)까지 그리고, "다음 20쪽"을 누르면 한도를 늘린다. 이미 캐시에 있으면 다시 그리지 않는다.
  pdfMore(cx) {
    const d = this.pdf, seq = this.showSeq;
    if (!d || d.busy) return;
    d.busy = true;
    cx.spawn(async cx => {
      try {
        for (let r; this.showSeq === seq && (r = pdfNext(d.pages, d.shown, d.limit));) {
          const pages = Array.from({ length: r.last - r.first + 1 }, (_, i) => r.first + i);
          const ready = await Promise.all(pages.map(i => fs.exists(`${appHome()}/${pdfPageFile(d.prefix, i, d.pages)}`)));
          if (!ready.every(Boolean)) {
            const res = await exec(d.exe("pdftoppm"), pdftoppmArgs({ src: d.src, prefix: d.os(`${appHome()}/${d.prefix}`), first: r.first, last: r.last, width: d.width }), { timeout: 120000 });
            if (res.code !== 0) throw new Error((res.stderr || "").trim().split(/\r?\n/)[0] || "쪽을 그리지 못했습니다");
          }
          for (const i of pages) {
            const path = pdfPageFile(d.prefix, i, d.pages), { w, h } = imageSize(await fs.readFile(`${appHome()}/${path}`));
            d.list.push({ path, w, h });
          }
          d.shown = r.last;
          cx.notify();
        }
      } catch (e) { d.error = String(e?.message ?? e); await logDebug(`PDF 그리기 실패: ${e?.stack ?? e}`); }
      finally { d.busy = false; cx.notify(); }
    });
  }

  // PDF 쪽들: 미리보기 폭에 맞춘 것이 100%. Ctrl+휠과 정보 줄의 − / +로 키우고 줄인다.
  pdfView(w, t, box) {
    const d = this.pdf, width = Math.round(Math.max(40, w - 32) * (this.zoom ?? 1)), next = Math.min(d.pages, d.limit + 20);
    return div().id("files-pdf").flex_1().min_w(0).min_h(0).p(16).overflow_scrollbar()
      .on_scroll_wheel((e, cx) => { if (!e.modifiers?.control) return; this.zoomBy(e.delta.y > 0 ? 1 : -1, box); cx.stop_propagation(); cx.notify(); })
      .child(v_flex().gap(6)
        .children(d.list.map((p, i) => v_flex().gap(4).mb(10)
          .child(div().w(width).h(Math.round(width * p.h / p.w)).border_1().border_color(t.border).child(image(p.path).w(width).h(Math.round(width * p.h / p.w))))
          .child(div().text_size(11).text_color(t.dim).child(`${i + 1} / ${d.pages}`))))
        .when(Boolean(d.error), el => el.child(div().text_size(12).text_color(t.ansi1).child(`쪽을 그리지 못했습니다: ${d.error}`)))
        .when(d.busy, el => el.child(div().text_size(12).text_color(t.dim).child(`쪽을 그리는 중… (${d.shown}/${Math.min(d.pages, d.limit)})`)))
        .when(!d.busy && !d.error && d.shown < d.pages, el => el.child(div().id("files-pdf-more").flex_none().px(10).py(5).rounded(6).border_1().border_color(t.border).cursor_pointer().hover(s => s.bg(t.hover)).text_size(12)
          .on_click((_e, cx) => { d.limit = next; this.pdfMore(cx); cx.notify(); }).child(`다음 쪽 그리기 (${d.shown + 1}–${next}쪽)`))));
  }

  // "글 보기": pdftotext로 뽑은 글을 읽기 전용 편집기로. 그림으로만 된 PDF는 글이 없다.
  togglePdfText(cx) {
    this.showSource = !this.showSource;
    if (this.showSource && !this.code) this.code = EditorState.new({ language: "text", readonly: true, value: this.text?.trim() ? this.text : "(뽑을 글이 없습니다. 스캔한 그림으로만 된 PDF일 수 있습니다)", font_family: settings().font_family, font_size: 12 });
    cx.notify();
  }

  // 그린 HTML: 조각 그림을 미리보기 폭에 맞춰 위아래로 이어 붙인다(크게는 키우지 않는다).
  htmlView(w) {
    const s = this.htmlShot, scale = Math.min(1, Math.max(40, w - 32) / s.width);
    return div().id("files-html").flex_1().min_w(0).min_h(0).p(16).overflow_y_scrollbar()
      .child(v_flex().children(s.tiles.map((tile, i) => image(tile).w(Math.round(s.width * scale)).h(Math.round(Math.min(2000, s.height - i * 2000) * scale)))));
  }

  drawDiagrams(parts, cx) {
    const file = this.file, dark = isDark(theme().background), diagrams = this.diagrams = new Map();
    cx.spawn(async cx => {
      for (const p of parts) {
        if (p.mermaid == null || diagrams.has(p.mermaid)) continue;
        diagrams.set(p.mermaid, { pending: true });
        cx.notify();
        try { diagrams.set(p.mermaid, await renderMermaid(p.mermaid, dark)); }
        catch (e) { diagrams.set(p.mermaid, { error: String(e?.message ?? e) }); }
        if (this.file === file) cx.notify();
      }
    });
  }

  diagramView(code, t, w) {
    const d = this.diagrams?.get(code);
    if (!d || d.pending) return div().p(12).rounded(6).bg(t.surface).text_size(12).text_color(t.dim).child("다이어그램 그리는 중…");
    if (d.error) return v_flex().gap(6).p(12).rounded(6).bg(t.surface).text_size(12)
      .child(div().text_color(t.ansi1).child(`다이어그램을 그리지 못했습니다: ${d.error}`))
      .child(div().font_family(settings().font_family).text_color(t.dim).child(code));
    const size = fit({ w: Math.max(40, w - 32), h: 4000 }, d.w, d.h);
    return image(d.path).w(size.w).h(size.h);
  }

  // 소리: VS Code·Orca처럼 가운데에 파일 이름, ▶/❚❚, 진행 막대(누르면 그 자리로), 시간.
  audioView(t, w) {
    const full = `${this.fileRoot}/${this.file}`, tr = this.player.track, mine = Boolean(tr && tr.items[tr.side]?.path === full);
    const dur = mine ? tr.duration : this.mediaDuration, pos = mine ? this.player.pos() : 0, frac = dur ? Math.min(1, pos / dur) : 0;
    return v_flex().flex_1().min_w(0).h_full().gap(14).items_center().justify_center()
      .child(div().text_size(15).font_semibold().child(splitPath(full).file))
      .child(h_flex().w(Math.max(200, Math.min(560, w - 40))).gap(12).items_center()
        .child(h_flex().id("audio-play").flex_none().w(44).h(44).rounded_full().bg(t.accent).text_color("#ffffff").text_size(17)
          .items_center().justify_center().cursor_pointer().on_click((_e, cx) => mine ? this.player.toggle(cx) : this.play(cx))
          .child(mine && tr.playing ? "❚❚" : "▶"))
        .child(div().id("audio-progress").flex_1().h(6).rounded(3).bg(t.border).cursor_pointer()
          .on_mouse_down("left", (e, cx) => {
            if (!dur || !e.local_position || !e.bounds?.width) return;
            const sec = clickToSeconds(e.local_position.x, e.bounds.width, dur);
            if (mine) this.player.seek(sec, cx); else this.play(cx, sec);
          })
          .child(div().h(6).rounded(3).bg(t.accent).w(`${(frac * 100).toFixed(2)}%`)))
        .child(div().flex_none().text_size(12).text_color(t.dim).child(mine && tr.status || `${clock(pos)} / ${dur ? clock(dur) : "–:––"}`)))
      .when(Boolean(mine && tr.error), el => el.child(div().text_size(11.5).text_color(t.ansi1).child(tr.error)));
  }

  async close() {
    this.player.stop(); this.stopMpv();
  }

  // 고친 텍스트를 저장한다. 연 뒤에 파일이 바뀌었으면 덮어쓰지 않고 알린다.
  save(cx) {
    if (!this.dirty || this.saving || this.original == null || !this.code) return;
    const file = this.file, path = `${this.fileRoot}/${file}`, on = this.fileOn, text = this.code.value(), original = this.original;
    this.saving = true;
    cx.notify();
    cx.spawn(async cx => {
      try {
        if (on) {
          if (await readTextFile(path, { on }) !== original) throw new Error("연 뒤에 파일이 바뀌었습니다. 다시 열어서 고쳐 주세요.");
          await writeRemote(on, path, text);
        } else await writeTextFile(path, text, original);
        if (this.file === file) {
          this.original = text; this.dirty = false;
          if (this.htmlShot && !on) this.drawHtml(path, { mtime: Date.now(), size: text.length }, cx);
          // 저장한 내용으로 표(CSV)와 Mermaid 그림도 다시 만든다(예전에는 글만 바뀌고 표·그림은 옛 내용이었다).
          if (this.rendered?.csv) { const csv = parseCsv(text, extOf(file) === "tsv" ? String.fromCharCode(9) : ","); this.rendered = { ...this.rendered, csv, widths: csvWidths(csv), text }; }
          else if (this.rendered?.parts) { const parts = kindOf(file) === "mermaid" ? [{ mermaid: text }] : splitMermaid(text) ?? [{ md: text }]; this.rendered = { ...this.rendered, parts, text }; this.drawDiagrams(parts, cx); }
          else if (this.rendered) this.rendered.text = text;
        }
      } catch (e) { notify({ title: "저장하지 못했습니다", body: String(e?.message ?? e), level: "error" }); }
      finally { this.saving = false; cx.notify(); }
    });
  }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    const context = this.context;
    cx.spawn(async cx => {
      try { while (this.context === context) { await watchFolder(root); if (this.current(context)) this.refresh(cx); } }
      catch { if (this.context === context) this.watched = null; }
    });
  }

  current(context) {
    return this.context === context && this.key() === context.key;
  }

  async loadFolder(path, context) {
    const { on, cwd: root } = context;
    const entries = await directory(path ? `${root}/${path}` : root, on);
    if (!this.current(context) || (path && !this.folders.has(path))) return;
    const used = [...this.entries.entries()].filter(([p]) => p !== path).reduce((n, [, e]) => n + e.length, 0);
    this.entries.set(path, entries.slice(0, Math.max(0, Math.min(PER_FOLDER, TOTAL - used))).sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)));
    if (entries.length > PER_FOLDER || used + entries.length > TOTAL) this.limited = true;
  }

  refresh(cx) {
    const next = this.key(), { cwd, on } = this.last;
    // 트리 루트가 바뀌어도(폴더 이동·프로젝트 루트·Ctrl+Shift+G) 열린 파일은 닫지 않는다. 파일은 연 시점의 fileRoot 기준이다.
    if (next !== this.context?.key) {
      if (this.context) this.saved.set(this.context.key, { folders: this.folders });
      const saved = this.saved.get(next);
      this.context = { key: next, cwd, on }; this.root = cwd; this.on = on; this.entries = new Map(); this.folders = new Set(saved?.folders);
      this.pending = new Set(); this.marks = {}; this.watched = null; this.error = null; this.limited = false;
      this.loading = false;
    }
    if (!cwd || this.loading) return;
    const context = this.context;
    this.loading = true;
    this.limited = false;
    cx.spawn(async cx => {
      try {
        for (const path of ["", ...this.folders]) {
          if (!this.current(context)) return;
          await this.loadFolder(path, context);
        }
        // 저장소 안 위치(prefix)를 알아내 git 경로를 지금 폴더 기준으로 바꾼다(Windows \ 경로·심볼릭 링크에서도 표시가 맞게).
        const top = await exec("git", ["rev-parse", "--show-prefix"], { cwd, on }).catch(() => null);
        let marks = {};
        if (top?.code === 0) {
          // Writes nothing under .git (index lock, fsmonitor cookie): the folder watch would refresh again.
          const status = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"], { cwd, on }).catch(() => null);
          if (status?.code === 0) marks = gitMarks(status.stdout, top.stdout.trim(), cwd, TOTAL);
        }
        if (!this.current(context)) return;
        // 프로젝트 루트: 저장소 안이면 그 맨 위, 아니면 Ctrl+Shift+G로 연 폴더(baseRoot).
        let projectRoot = this.baseRoot ?? null;
        if (top?.code === 0) projectRoot = await projectRootOf(cwd, on, top.stdout.trim());
        if (!this.current(context)) return;
        this.marks = marks; this.inRepo = top?.code === 0; this.projectRoot = projectRoot; this.error = null; this.watch(cwd, cx);
      } catch (e) { if (this.current(context)) this.error = String(e); }
      finally {
        if (this.context === context) this.loading = false;
        // 목록을 읽은 뒤에 열어야 정보 줄에 크기·날짜가 들어가고 캐시 이름에 수정 시각이 들어간다.
        if (this.pendingShow && this.context === context) { const f = this.pendingShow; this.pendingShow = null; this.show(f, cx); }
        else if (this.file && this.fileRoot === this.root && this.context === context) {
          // 열린 파일이 바깥에서 바뀌었으면(에이전트가 고침) 다시 읽는다. 고치는 중이면 덮지 않고 알린다.
          const cut = this.file.lastIndexOf("/"), e = this.entries.get(cut < 0 ? "" : this.file.slice(0, cut))?.find(x => x.name === this.file.slice(cut + 1));
          const stamp = e ? `${e.mtime}|${e.size}` : null;
          if (stamp && this.fileStamp && stamp !== this.fileStamp) { if (this.dirty) this.external = true; else this.show(this.file, cx); }
        }
        cx.notify();
      }
    });
  }

  toggle(path, cx) {
    if (this.folders.has(path)) {
      for (const folder of [...this.folders]) if (folder === path || folder.startsWith(path + "/")) {
        this.folders.delete(folder);
        this.entries.delete(folder);
      }
    } else {
      this.folders.add(path);
      if (!this.entries.has(path) && !this.pending.has(path)) {
        const context = this.context;
        this.pending.add(path);
        cx.spawn(async cx => {
          try { await this.loadFolder(path, context); }
          catch (e) { if (this.current(context)) this.error = String(e); }
          finally { if (this.context === context) this.pending.delete(path); cx.notify(); }
        });
      }
    }
    cx.notify();
  }

  menuView(path, entry, t) {
    const close = cx => { this.menu = null; cx.notify(); };
    return v_flex().id("tree-menu").w(190).mt(28).p(4).rounded(8).border_1().border_color(t.border).bg(t.raised).shadow_md().text_size(13)
      .on_mouse_down_out((_e, cx) => close(cx))
      .children(treeMenu(entry).map(m => div().id(`tree-menu-${m.id}`).px(10).py(5).rounded(6).cursor_pointer().hover(s => s.bg(t.hover))
        .on_click((_e, cx) => { close(cx); this.menuAction(m.id, path, cx); }).child(m.label)));
  }

  menuAction(id, path, cx) {
    const full = `${this.root}/${path}`, on = this.on;
    if (id === "copy") { const p = copyPath(this.root, path); cx.write_to_clipboard(p); setShared(COPIED, p); }
    else if (id === "root") this.navigate(full, cx);
    // 탐색기로 다운로드 폴더를 연다(사용자가 옮겨 둔 자리도 shell:Downloads가 따라간다). explorer는 성공해도 1을 돌려준다.
    else if (id === "downloads") exec("explorer", ["shell:Downloads"]).catch(() => null);
    else if (id === "open") cx.spawn(async () => {
      try { await openFile(on ? await fetchRemote(on, full) : full); }
      catch (e) { notify({ title: "파일을 열지 못했습니다", body: String(e?.message ?? e), level: "error" }); }
    });
    else if (id === "download") cx.spawn(async () => {
      try { notify({ title: "받았습니다", body: await download(on, full) }); }
      catch (e) { notify({ title: "받지 못했습니다", body: String(e?.message ?? e), level: "error" }); }
    });
  }

  // 트리에서 파일을 눌렀을 때: 패널의 트리면 가운데 미리보기 탭에 열고, 아니면 이 창에서 연다.
  pick(path, cx) {
    if (this.role !== "tree") return this.show(path, cx);
    this.file = path;
    cx.spawn(async cx => openInViewer({ folder: this.root, on: this.on, file: path }, cx));
    cx.notify();
  }

  // 다른 쪽이 보낸 메시지를 받는다: 미리보기 탭은 열 파일을, 트리는 갈 폴더를.
  follow(cx) {
    const open = shared(OPEN), tree = shared(TREE);
    // 방금(3초 안) 온 열기 요청이면 이 미리보기 탭을 스스로 앞으로 가져온다. 열기 창을 닫을 때 Herdr가
    // 원래 탭으로 포커스를 돌려놓아서, 보내는 쪽에서 고른 것만으로는 화면이 안 넘어갔다.
    const own = (shared(VIEWERS) ?? {})[this.space];
    if (this.role === "viewer" && follows(open, this.seen, this.space) && Date.now() - open.seq < 3000 && own && focused()?.tab !== own) run("tab.select", { id: own });
    if (this.role === "viewer" && follows(open, this.seen, this.space) && open.file == null) {
      // 폴더만 온 요청(Ctrl+Shift+G): 트리 루트만 옮기고 보던 파일은 그대로 둔다.
      this.seen = open.seq;
      this.nav = { cwd: open.folder, on: open.on ?? null, space: null };
      this.rootBack = open.back ?? null; this.baseRoot = open.folder;
      this.refresh(cx);
      cx.notify();
    } else if (this.role === "viewer" && follows(open, this.seen, this.space)) {
      this.seen = open.seq;
      if (!this.leave(`file:${open.folder}/${open.file}`)) return;
      this.dirty = false;
      this.request = { file: open.file, t: open.t ?? 0, b: open.b ?? null };
      this.nav = { cwd: open.folder, on: open.on ?? null, space: null };
      // 프로젝트 루트 버튼: 돌아갈 곳(back), 저장소가 아닐 때 기준이 되는 폴더(Ctrl+Shift+G로 연 폴더).
      this.rootBack = open.back ?? null; this.baseRoot = open.file == null ? open.folder : null;
      this.show(null);
      this.pendingShow = open.file;
      this.refresh(cx);
      cx.notify();
    }
    if (this.role === "tree" && follows(tree, this.seenTree, activeSpace())) {
      this.seenTree = tree.seq;
      this.navigate(tree.cwd, cx, tree.on ?? null);
    }
  }

  // 고친 채로 다른 곳으로 가려 하면 한 번 막는다. 같은 곳을 한 번 더 누르면 버리고 넘어간다.
  leave(target) {
    const g = discardGate(this.dirty, this.armed, target);
    this.armed = g.armed;
    if (!g.allow) notify({ title: "저장하지 않은 수정이 있습니다", body: "Ctrl+S로 저장하거나, 한 번 더 누르면 버리고 넘어갑니다.", level: "warning" });
    return g.allow;
  }

  show(path, cx) {
    if (cx && path !== this.file && !this.leave(`file:${path}`)) return;
    // 다른 파일로 옮기면 창 안 재생을 끈다(this.file을 바꾸기 전에 비교).
    if (path !== this.file) { this.stopMpv(); this.player.stop(); this.anchor = null; }
    this.code?.release(); this.code = null; this.file = path; this.fileError = null; this.picture = null; this.rendered = null; this.audio = null;
    this.text = null; this.tail = null; this.htmlShot = null; this.pdf = null; this.anim = null; this.zoom = null; this.following = false; this.diff = null; this.closeFind();
    // 정보 줄: 목록에서 이미 아는 크기·수정 시각, 그 뒤에 해상도나 영상·소리 정보를 붙인다.
    const cut = path?.lastIndexOf("/") ?? -1, entry = path && this.entries.get(cut < 0 ? "" : path.slice(0, cut))?.find(e => e.name === path.slice(cut + 1));
    this.info = path ? [path.slice(cut + 1), entry?.size != null && formatSize(entry.size), formatDate(entry?.mtime)].filter(Boolean).join(" · ") : "";
    this.dirty = false; this.saving = false; this.external = false;
    this.fileRoot = this.root; this.fileOn = this.on; this.fileStamp = entry ? `${entry.mtime}|${entry.size}` : null;
    // 같은 파일을 두 번 열면(폴더 복원 + 열기 요청) 앞의 비동기 결과가 편집기를 덮어써 새던 것을 막는다: 경로 대신 이 번호로 비교한다.
    const seq = this.showSeq = (this.showSeq ?? 0) + 1;
    if (!path || !cx) return;
    const root = this.root, on = this.on, kind = kindOf(path);
    const addInfo = text => { if (text && this.showSeq === seq) { this.info = [this.info, text].filter(Boolean).join(" · "); cx.notify(); } };
    this.mediaDuration = 0;
    if (kind === "pdf") return this.loadPdf(root, path, entry, on, seq, cx);
    if (kind === "video" || kind === "audio") cx.spawn(async () => {
      const p = await probeInfo(on ? await remoteUrl(on, `${root}/${path}`) : `${root}/${path}`);
      if (this.showSeq === seq) this.mediaDuration = Number(p?.format?.duration) || 0;
      addInfo(mediaSummary(p));
    });
    if (kind === "image" || kind === "video" || kind === "audio") {
      if (window()?.platform !== "windows") { this.fileError = "이 미리보기는 Windows에서만 됩니다."; cx.notify(); return; }
      if (kind === "audio") {
        // VS Code·Orca처럼 파형 없이 가운데 재생 막대만 보여 준다(audioView).
        this.audio = path;
        cx.notify();
        return;
      }
      this.fileError = kind === "video" ? "영상 미리보기를 만드는 중…" : on ? `${on}에서 파일을 가져오는 중…` : "여는 중…";
      cx.notify();
      cx.spawn(async cx => {
        const shown = () => this.showSeq === seq, full = `${root}/${path}`;
        try {
          // 영상 장면은 ffmpeg를 바로 불러 만든다(다른 머신은 sftp로 앞부분만). 안 되면 예전처럼 가져와서 PowerShell로.
          let result = kind === "video" ? await cachePoster(on, full, entry).catch(() => null)
            : kind === "image" ? await cacheImageFast(on, full).catch(() => null) : null;
          if (!result) {
            if (on && shown()) { this.fileError = `${on}에서 파일을 가져오는 중…`; cx.notify(); }
            const local = on ? await fetchRemote(on, full) : full;
            if (on && kind === "video" && shown()) { this.fileError = "영상 미리보기를 만드는 중…"; cx.notify(); }
            result = await (kind === "video" ? cacheVideo : cacheImage)(local);
          }
          const [name, w, h, ow = w, oh = h] = result.split("|");
          if (shown()) { this.picture = { path: `${CACHE}/${name}`, w: Number(w), h: Number(h), clip: kind === "video" }; this.fileError = null; }
          // 움직이는 GIF·WebP: image()는 첫 장면만 그려서, 프레임으로 풀어 보이는 동안 직접 넘긴다.
          if (shown() && kind === "image" && isAnimatable(path)) this.drawAnim(full, entry, on, cx);
          if (kind === "image" && Number(ow)) addInfo(`${ow}×${oh}${ow !== w ? ` (${w}×${h}로 줄여 보기)` : ""}`);
        } catch { if (shown()) this.fileError = kind === "video" ? "영상 미리보기를 만들지 못했습니다. 이 PC에 ffmpeg가 설치돼 있어야 합니다." : "이미지를 불러오지 못했습니다."; }
        finally { cx.notify(); }
      });
      return;
    }
    cx.spawn(async cx => {
      try {
        const full = `${root}/${path}`;
        // 목록에서 아는 크기로 먼저 거른다: readTextFile이 1MiB 넘는 파일을 잘라서 돌려주면, 그대로 저장할 때 뒷부분이 날아간다.
        const big = (entry?.size ?? 0) > 1000000;
        let text = big ? undefined : await readTextFile(full, { on }).catch(() => undefined), partial = big;
        if (text === undefined) { text = await textHead(on, full); partial = true; }
        if (this.showSeq !== seq) return;
        if (text === null) { this.fileError = "파일이 없어졌습니다"; return; }
        if (text.includes("\0")) { this.fileError = "글 파일이 아니라 미리 볼 수 없습니다"; return; }
        if (partial) this.info = [this.info, "앞 1MB만 보여 줍니다 · 고칠 수 없음"].join(" · ");
        // 고칠 수 있게 연다. Ctrl+S로 저장하고, 그 사이 파일이 바뀌었으면 저장을 거부한다(original과 비교).
        this.original = partial ? null : text;
        this.text = text;
        // CSV·TSV는 표로 보여 주고, ‘소스’로 원문을 본다.
        // 확장자는 마지막 이름에서만 본다(report_csv나 proj.v2/Makefile을 잘못 읽던 것을 고침). 열 너비는 여기서 한 번만 잰다.
        const t = theme(), ext = extOf(path) || "txt";
        if (ext === "csv" || ext === "tsv") { const csv = parseCsv(text, ext === "tsv" ? "\t" : ","); this.rendered = { csv, widths: csvWidths(csv), text }; this.showSource = false; }
        // 마크다운과 HTML은 그려서 보여 주고, ‘소스’로 원문을 본다. HTML의 CSS는 Herdr가 그리지 못한다.
        if (["md", "markdown", "html", "htm"].includes(ext) && text.length <= 400000) { this.rendered = { md: ext.startsWith("m"), text }; this.showSource = false; }
        // 이 PC의 HTML은 실제 브라우저로 그려 보여 준다(원격은 그림·CSS 같은 관련 파일이 없어 글 버전만).
        if ((ext === "html" || ext === "htm") && !on) this.drawHtml(full, entry, cx);
        // Mermaid: .mmd는 통째로, .md는 ```mermaid 블록만 그림으로 바꿔 그린다(mermaid-cli + 그 PC의 브라우저).
        const parts = kindOf(path) === "mermaid" ? [{ mermaid: text }] : this.rendered?.md ? splitMermaid(text) : null;
        if (parts && text.length <= 400000) { this.rendered = { md: true, text, parts }; this.showSource = false; this.drawDiagrams(parts, cx); }
        // 크기를 모르는 파일(맥 등 예전 목록)은 1MiB에 거의 닿으면 잘렸을 수 있어 고치지 못하게 한다.
        // UTF-8이 아닌 파일(CP949 등)은 읽을 때 깨진 글자(U+FFFD)가 생긴다. 고쳐 저장하면 원본이 망가지니 읽기 전용으로 연다.
        const broken = text.includes("�");
        if (broken) this.info = [this.info, "UTF-8이 아니라 고칠 수 없음"].join(" · ");
        const editable = !partial && !broken && text.length <= 400000 && (entry?.size != null || text.length < 900000);
        this.code = EditorState.new({ language: LANG[ext] ?? ext, readonly: !editable,
          value: text.length > 400000 ? text.slice(0, 400000) + "\n… (file truncated)" : text,
          font_family: settings().font_family, font_size: 12,
          syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
        if (editable) this.code.on("change", (_e, cx) => {
          // 찾기(Ctrl+F)가 고친 내용을 보도록 글을 따라 바꾼다.
          this.text = this.code.value();
          if (this.find?.query) this.find.hits = findLines(this.text, this.find.query);
          if (!this.dirty) this.dirty = true;
          cx.notify();
        });
      } catch { if (this.showSeq === seq) this.fileError = "미리 볼 수 없는 파일입니다 (글이 아니거나, 너무 크거나, 읽을 수 없음)"; }
      finally { cx.notify(); }
    });
  }

  rows(prefix, depth, out, t) {
    if (out.length >= TOTAL || depth > 40) return out;
    for (const entry of this.entries.get(prefix) ?? []) {
      if (out.length >= TOTAL) break;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name, open = this.folders.has(path), mark = this.marks[`${this.root}/${path}`];
      const row = h_flex().id(`file-${path}`).h(28).flex_none().pl(8 + depth * 18).pr(8).gap(7).items_center().rounded(7).cursor_pointer().hover(s => s.bg(t.hover))
        .when(path === this.file && this.fileRoot === this.root || this.menu?.path === path, el => el.bg(t.selected))
        .on_click((_e, cx) => entry.dir ? this.toggle(path, cx) : this.pick(path, cx))
        .on_mouse_down("right", (_e, cx) => { this.menu = { path, dir: entry.dir }; cx.notify(); })
        .when(entry.dir, el => el.on_mouse_down("left", (e, cx) => { if (e.click_count === 2) this.navigate(`${this.root}/${path}`, cx); }))
        .child(entry.dir ? svg(`mods/file-viewer/chevron-${open ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.dim) : div().w(12).flex_none())
        .child(svg(`mods/file-viewer/${entry.dir ? "folder" : "file"}.svg`).size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().child(entry.name))
        .when(!entry.dir && entry.size != null, el => el.child(div().flex_none().text_size(11).text_color(t.dim).child(`${formatSize(entry.size)}${entry.mtime ? " · " + formatDate(entry.mtime).split(" ")[0] : ""}`)))
        .when(Boolean(mark), el => el.child(div().text_size(11).text_color(mark === "A" ? t.ansi2 : mark === "D" || mark === "U" ? t.ansi1 : t.blocked).child(mark)));
      // 우클릭 메뉴: 그 행에 붙어 뜨고, 바깥을 누르거나 Esc를 누르면 닫힌다.
      out.push(this.menu?.path === path ? Popup.new(`menu-${path}`, row).anchor("top_left").content(this.menuView(path, entry, t)) : row);
      if (entry.dir && open) this.rows(path, depth + 1, out, t);
    }
    return out;
  }

  render(cx) {
    if (props()?.overlay) return div();
    if (this.key() !== this.context?.key) this.refresh(cx);
    const t = theme(), wide = this.wide, windows = window()?.platform === "windows", kind = this.file ? kindOf(this.file) : null;
    const button = (id, label, act) => div().id(id).flex_none().px(8).py(3).rounded(6).border_1().border_color(t.border).text_size(12).cursor_pointer().hover(s => s.bg(t.hover)).on_click((_e, cx) => act(cx)).child(label);
    const tree = () => v_flex().id("files-tree").min_h(0).overflow_y_scrollbar().p(6).children(this.rows("", 0, [], t))
      .when(Boolean(this.error) || !this.entries.get("")?.length, el => el.child(div().p(8).text_size(12).text_color(t.dim).child(this.error || (this.loading ? "목록을 읽는 중…" : this.root ? "파일이 없습니다" : "터미널에서 Ctrl+Shift+G를 누르면 그 폴더가 열립니다"))))
      .when(this.limited, el => el.child(div().p(8).text_size(11).text_color(t.dim).child("목록은 폴더마다 500개, 모두 5,000개까지만 보여 줍니다")));
    // 이미지는 너비에 맞춰 그려지고 높이는 비율을 따라가서, 영역에 맞는 크기를 직접 계산해 준다.
    // 미리보기 탭은 넓으면 왼쪽 트리 + 오른쪽 미리보기를 한 화면에 그린다(탭과 트리가 같이 움직인다). "트리" 버튼으로 접을 수 있다.
    // 트리 너비: 경계를 끌어 바꾸고(localStorage에 기억), 창 크기에 맞춰 제한한다.
    const treeW = clampTree(this.treeW ?? 340, this.size?.width ?? 1200);
    this.dockGeom = null;
    const role = this.role, sideTree = (role === null || role === "viewer") && wide && !this.treeHidden;
    const box = this.size && { w: Math.max(40, this.size.width - (sideTree ? treeW + 5 : 0) - 26), h: Math.max(40, this.size.height - 42 - 26 - (this.info ? 24 : 0) - (showMediaBar(this.player.track) ? 60 : 0)) };
    // 개발용 보기가 켜져 있으면 그게 먼저다: 찾기 결과 > git 변경 > 따라가기 > CSV 표 > 보통 미리보기.
    const preview = () => this.find?.query ? this.findView(t) : this.diff ? this.diffView(t) : this.following ? this.followView(t)
      : this.rendered?.csv && !this.showSource ? this.csvView(t)
      : this.htmlShot?.tiles && !this.showSource ? this.htmlView(box?.w ?? 900)
      : this.pdf && !this.showSource ? this.pdfView(box?.w ?? 900, t, box) : basePreview();
    const basePreview = () => this.rendered && !this.rendered.csv && !this.showSource ? div().id("files-rendered").flex_1().min_w(0).min_h(0).p(16).overflow_y_scrollbar()
        // HTML을 브라우저로 그리는 중이거나 실패했으면 위에 알리고, 그동안은 글 버전을 보여 준다.
        .when(Boolean(this.htmlShot?.pending || this.htmlShot?.error), el => el.child(div().mb(10).px(10).py(6).rounded(6).bg(t.surface).text_size(12)
          .text_color(this.htmlShot?.error ? t.ansi1 : t.dim).child(this.htmlShot?.error ? `실제 모습으로 그리지 못했습니다: ${this.htmlShot.error}` : "실제 모습으로 그리는 중… (처음 한 번만 몇 초 걸립니다)")))
        .child(this.rendered.parts
          // Mermaid가 섞인 마크다운: 글 조각은 마크다운, mermaid 조각은 그린 그림.
          ? v_flex().gap(12).children(this.rendered.parts.map((p, i) => p.md != null
            ? TextView.markdown(`files-doc-${this.file}-${i}`, p.md).selectable(true)
            : this.diagramView(p.mermaid, t, box?.w ?? 600)))
          : (this.rendered.md ? TextView.markdown : TextView.html)(`files-doc-${this.file}`, this.rendered.text).selectable(true))
      : this.code ? Editor.new(this.code).flex_1().min_h(0)
      : this.audio && box ? this.audioView(t, box.w)
      // 확대한 사진: 실제 배율로 그리고 스크롤로 움직인다. Ctrl+휠로 키우고 줄인다.
      : this.picture && box && !this.picture.clip && this.zoom != null ? div().id("files-zoom").flex_1().min_w(0).min_h(0).overflow_scrollbar()
        .on_scroll_wheel((e, cx) => { if (!e.modifiers?.control) return; this.zoomBy(e.delta.y > 0 ? 1 : -1, box); cx.stop_propagation(); cx.notify(); })
        .child(image(this.anim ? this.anim.frames[this.anim.i] : this.picture.path).w(Math.round(this.picture.w * this.zoom)).h(Math.round(this.picture.h * this.zoom)))
      : this.picture && box ? v_flex().flex_1().min_w(0).h_full().gap(8).items_center().justify_center().overflow_hidden()
        .when(!this.picture.clip, el => el.id("files-fit").on_scroll_wheel((e, cx) => { if (!e.modifiers?.control) return; this.zoomBy(e.delta.y > 0 ? 1 : -1, box); cx.stop_propagation(); cx.notify(); }))
        .map(el => { const size = fit({ w: box.w, h: box.h - (this.picture.clip ? 26 : 0) }, this.picture.w, this.picture.h); if (!this.picture.clip || !windows) return el.child(image(this.anim ? this.anim.frames[this.anim.i] : this.picture.path).w(size.w).h(size.h));
          // 영상은 장면 한가운데에 동그라미 안 세모를 올린다. 장면 어디를 눌러도 ‘▶ 재생’과 같다.
          const b = playBadge(size.w, size.h);
          this.dockGeom = { tree: sideTree ? treeW + 5 : 0, poster: size };
          return el.child(div().id("files-poster").relative().w(size.w).h(size.h).cursor_pointer()
            .on_mouse_down("left", (e, cx) => { this.anchor = e.bounds ? { poster: e.bounds, root: this.rootNow(), tree: this.dockGeom.tree, check: e.local_position && { x: e.position.x - e.local_position.x, y: e.position.y - e.local_position.y } } : null; this.play(cx); })
            .child(image(this.picture.path).w(size.w).h(size.h))
            .child(h_flex().absolute().left(b.left).top(b.top).w(b.size).h(b.size).rounded_full().bg("#000000a0").border_2().border_color("#ffffffe0")
              .items_center().justify_center().pl(Math.round(b.size * 0.08)).text_size(Math.round(b.size * 0.42)).text_color("#ffffff").child("▶"))); })
        .when(this.picture.clip, el => el.child(div().text_size(12).text_color(t.dim).child("미리보기 장면 · ▶를 누르면 이 자리에서 mpv로 틉니다 (스페이스 멈춤 · ←→ 이동 · q 닫기 · 다른 탭으로 가면 멈춤)")))
      : div().flex_1().min_w(0).h_full().p(12).text_color(t.dim).child(this.fileError || (this.file ? "여는 중…" : "파일을 고르면 여기에 보입니다."));
    // 레이아웃 패널의 트리(role "tree")는 트리만. 미리보기 탭과 예전 창은 넓으면 나란히, 좁으면 하나씩.
    const body = role === "tree" ? tree().flex_1()
      : sideTree ? h_flex().flex_1().min_h(0).child(tree().w(treeW).h_full().flex_none())
        // 트리와 미리보기 사이 경계: 누른 채 좌우로 끌면 너비가 바뀐다.
        .child(div().id("files-split").w(5).h_full().flex_none().cursor_col_resize().border_l(1).border_color(t.border).hover(s => s.bg(t.hover))
          .when(Boolean(this.dragging), el => el.bg(t.hover))
          .on_mouse_down("left", (e, cx) => { this.dragging = { x0: e.position.x, w0: treeW }; cx.stop_propagation?.(); cx.notify(); }))
        .child(preview())
      : this.file || role === "viewer" && this.treeHidden ? preview() : tree().flex_1();
    const tools = role !== "tree";
    return v_flex().id("files").size_full().min_h(0).when(role !== "tree", el => el.rounded(10).border_1().border_color(t.border)).overflow_hidden().bg(t.background).text_color(t.foreground).text_size(13)
      .on_size_change((size, cx) => { this.size = size; this.wide = size.width >= 720; cx.notify(); })
      .on_mouse_move((e, cx) => { if (e.bounds) this.rootBounds = e.bounds; if (!this.dragging) return; this.treeW = clampTree(this.dragging.w0 + e.position.x - this.dragging.x0, this.size?.width ?? 1200); cx.notify(); })
      .on_mouse_up("left", (_e, cx) => { if (!this.dragging) return; this.dragging = null; setShared(TREEW, this.treeW); cx.notify(); })
      .on_key_down((e, cx) => {
        if (e.keystroke === "ctrl-s" || e.keystroke === "cmd-s") this.save(cx);
        else if ((e.keystroke === "ctrl-f" || e.keystroke === "cmd-f") && this.text != null) { this.openFind(cx); cx.notify(); }
        else if (e.keystroke === "escape" && this.menu) { this.menu = null; cx.notify(); }
        else if (e.keystroke === "escape" && this.find) { this.closeFind(); cx.notify(); }
      })
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .when(role !== "tree" && Boolean(this.file) && !wide, el => el.child(div().id("files-back").w(20).cursor_pointer().text_color(t.muted).on_click((_e, cx) => { this.show(null, cx); cx.notify(); }).child("←")))
        // 트리 접기/펴기 (미리보기 탭).
        .when(role === "viewer" && wide, el => el.child(button("files-tree-toggle", this.treeHidden ? "트리 보이기" : "트리 숨기기", cx => { this.treeHidden = !this.treeHidden; cx.notify(); })))
        // 프로젝트 루트 ↔ 원래 폴더.
        .map(el => { const step = tools ? rootStep({ current: this.root, root: this.projectRoot, back: this.rootBack }) : null;
          return el.when(Boolean(step), e => e.child(button("files-root", step?.label ?? "", cx => { this.rootBack = step.back; this.navigate(step.go, cx); }))); })
        // 경로 막대: 누르면 그 폴더로 간다. 길면 마지막 네 칸만 보이고 …는 그 앞 폴더로 간다. ↑는 상위 폴더.
        .map(el => {
          const crumbs = breadcrumbs(this.root), shown = crumbs.slice(-4), hidden = crumbs.length - shown.length;
          const crumb = (id, label, path, last) => div().id(id).flex_none().px(4).py(2).rounded(5).text_size(12).cursor_pointer().hover(s => s.bg(t.hover))
            .text_color(last ? t.foreground : t.muted).when(last, d => d.font_semibold()).on_click((_e, cx) => this.navigate(path, cx)).child(label);
          return el.when(crumbs.length > 1, e => e.child(button("files-up", "↑ 상위 폴더", cx => this.navigate(crumbs.at(-2).path, cx))))
            .child(h_flex().flex_1().min_w(0).overflow_hidden().gap(1).items_center()
              .when(hidden > 0, e => e.child(crumb("crumb-more", "…", crumbs[hidden - 1].path, false)))
              .children(shown.flatMap((c, i) => [...(i || hidden ? [div().flex_none().text_size(11).text_color(t.dim).child("›")] : []), crumb(`crumb-${i}`, c.label, c.path, i === shown.length - 1)])));
        })
        // 경로 복사: 미리보기는 보고 있는 파일, 트리는 지금 폴더. 복사한 경로는 Ctrl+Shift+G로 다시 열 수 있다.
        .when(tools && Boolean(this.dirty), el => el.child(button("files-save", this.saving ? "저장 중…" : "● 저장 (Ctrl+S)", cx => this.save(cx))))
        // 원문 ↔ 렌더링(마크다운·HTML·CSV·Mermaid).
        .when(tools && Boolean(this.rendered), el => el.child(button("files-source", this.showSource ? "렌더링 보기" : "원문 보기", cx => { this.showSource = !this.showSource; cx.notify(); })))
        // 끝 따라가기: 그려 보여 주는 파일(마크다운·HTML·CSV)이 아닌 글·로그 파일에만.
        // PDF: 쪽 그림 ↔ 뽑은 글.
        .when(tools && Boolean(this.pdf), el => el.child(button("files-pdf-text", this.showSource ? "쪽 보기" : "글 보기", cx => this.togglePdfText(cx))))
        .when(tools && Boolean(this.code) && !this.rendered && !this.pdf, el => el.child(button("files-follow", this.following ? "따라가기 끄기" : "끝 따라가기", cx => { this.following = !this.following; this.tail = null; if (this.following) this.followTick(cx); cx.notify(); })))
        // git 변경: 저장소 안의 파일일 때만.
        .when(tools && Boolean(this.file) && Boolean(this.inRepo) && kind !== "image" && kind !== "video" && kind !== "audio" && kind !== "pdf", el => el.child(button("files-diff", this.diff ? "git 변경 닫기" : "git 변경", cx => { if (this.diff) this.diff = null; else this.loadDiff(cx); cx.notify(); })))
        // 창 안 재생 중이면 끄는 버튼. mpv가 스스로 끝나면 1초 안에 사라진다.
        .when(Boolean(this.native), el => el.child(button("files-mpv-stop", "■ 재생 끄기", cx => { this.stopMpv(); cx.notify(); })))
        .when(Boolean(this.root), el => el.child(button("files-copy", this.copied ? "복사됨 ✓" : "경로 복사", cx => {
          cx.write_to_clipboard(tools && this.file ? copyPath(this.fileRoot, this.file) : copyPath(this.root, null));
          // 방금 이 버튼으로 복사한 글은 Ctrl+Shift+G가 다시 열지 않고 토글로 둔다.
          setShared(COPIED, tools && this.file ? copyPath(this.fileRoot, this.file) : copyPath(this.root, null));
          this.copied = true; cx.notify();
          cx.timer.after(1500, cx => { this.copied = false; cx.notify(); });
        })))
        .when(tools && Boolean(this.file) && windows, el => el.child(button("files-open", kind === "html" ? "브라우저에서 열기" : this.fileOn ? "복사본을 기본 앱으로 열기" : "기본 앱으로 열기", cx => this.open(cx)))))
      .when(tools && Boolean(this.info) && Boolean(this.file), el => el.child(h_flex().id("files-info").h(24).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border).text_size(11.5).text_color(t.dim)
        .child(div().flex_1().min_w(0).truncate().child(this.info))
        // 사진 확대·축소: − [맞춤/NN%] +. 가운데를 누르면 맞춤으로 돌아간다. Ctrl+휠도 된다.
        .when(Boolean((this.picture && !this.picture.clip || this.pdf && !this.showSource) && box), e => {
          const zb = (id, label, act) => div().id(id).flex_none().px(6).rounded(4).border_1().border_color(t.border).cursor_pointer().hover(s => s.bg(t.hover)).on_click((_e, cx) => { act(); cx.notify(); }).child(label);
          return e.child(zb("zoom-out", "−", () => this.zoomBy(-1, box)))
            .child(zb("zoom-fit", this.zoom == null ? `맞춤 ${Math.round(this.fitScale(box) * 100)}%` : `${Math.round(this.zoom * 100)}%`, () => { this.zoom = null; }))
            .child(zb("zoom-in", "+", () => this.zoomBy(1, box)));
        })))
      // 고치는 중에 바깥(에이전트 등)에서 파일이 바뀌었으면 알린다. 다시 읽으면 지금 고친 내용은 버려진다.
      .when(Boolean(this.external && this.file), el => el.child(h_flex().h(30).flex_none().px(14).gap(10).items_center().bg(t.surface).border_b(1).border_color(t.border).text_size(12)
        .child(div().flex_1().text_color(t.ansi3).child("바깥에서 이 파일이 바뀌었습니다. 다시 읽으면 지금 고친 내용은 버려집니다."))
        .child(button("files-reload", "다시 읽기", cx => { this.dirty = false; this.show(this.file, cx); cx.notify(); }))))
      .when(Boolean(this.find), el => el.child(this.findBar(t)))
      .child(body)
      .when(tools && showMediaBar(this.player.track), el => el.child(this.player.view(t, button)));
  }
}
