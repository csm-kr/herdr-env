// 파일 종류 판별과 PowerShell 인자 만들기. herdr 모듈을 쓰지 않아 node로 테스트한다.
const KINDS = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico"],
  audio: ["mp3", "wav", "flac", "m4a", "ogg", "aac", "wma", "opus"],
  video: ["mp4", "mov", "mkv", "webm", "avi", "wmv", "m4v"],
  html: ["html", "htm"],
  mermaid: ["mmd", "mermaid"],
  pdf: ["pdf"],
};

// ── PDF: Poppler(pdfinfo·pdftoppm·pdftotext)로 쪽 그림과 글을 만든다. ──
// pdfinfo 출력에서 쪽 수, 제목, 첫 쪽 크기(pt)를 읽는다. 쪽 수가 없으면(PDF가 아님) null.
export function parsePdfInfo(out) {
  const pages = out?.match(/^Pages:\s+(\d+)/m);
  if (!pages) return null;
  const size = out.match(/^Page size:\s+([\d.]+) x ([\d.]+)/m);
  return { pages: Number(pages[1]), title: out.match(/^Title:\s+(.*?)\s*$/m)?.[1] ?? "", w: size ? Number(size[1]) : 0, h: size ? Number(size[2]) : 0 };
}

// 다음에 그릴 쪽 범위: 5쪽씩(먼저 보이게), 한도(limit, "더 보기"로 20쪽씩 늘린다)까지. 다 그렸으면 null.
export function pdfNext(pages, shown, limit, step = 5) {
  const last = Math.min(pages, limit, shown + step);
  return last > shown ? { first: shown + 1, last } : null;
}

// pdftoppm이 만드는 쪽 그림 이름: 쪽 번호를 전체 쪽 수의 자릿수만큼 0으로 채운다.
export function pdfPageFile(prefix, page, pages) {
  return `${prefix}-${String(page).padStart(String(pages).length, "0")}.png`;
}

export function pdftoppmArgs({ src, prefix, first, last, width }) {
  return ["-q", "-png", "-f", String(first), "-l", String(last), "-scale-to-x", String(width), "-scale-to-y", "-1", src, prefix];
}

export function pdfKey(path, mtime, size, width) {
  return htmlShotKey(path, mtime, size, width).replace(/^html-/, "pdf-");
}

// PATH에 pdftoppm이 없을 때 찾아볼 자리. winget(Poppler)은 버전 폴더라 main.js가 따로 찾는다.
export function popplerCandidates(platform, home) {
  if (platform === "windows") return [`${home}/scoop/apps/poppler/current/bin/pdftoppm.exe`, "C:/ProgramData/chocolatey/bin/pdftoppm.exe", "C:/Program Files/poppler/Library/bin/pdftoppm.exe"];
  if (platform === "macos") return ["/opt/homebrew/bin/pdftoppm", "/usr/local/bin/pdftoppm"];
  return ["/usr/bin/pdftoppm", "/usr/local/bin/pdftoppm"];
}

// CSV(또는 sep으로 나눈 TSV)를 행 배열로. 따옴표 안의 쉼표·줄바꿈과 ""(따옴표 하나)를 안다. 행은 max개까지.
export function parseCsv(text, sep = ",", max = 5000) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length && rows.length < max; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if ((cell || row.length) && rows.length < max) { row.push(cell); rows.push(row); }
  return rows;
}

// 모드가 다시 읽힐 때(파일 저장 등) 바로 전에 온 열기 요청을 놓치지 않는다: 10초 안의 요청은 아직 안 본 것(0)으로 둔다.
export function initialSeen(msg, now, window = 10000) {
  if (!msg) return 0;
  return now - msg.seq < window ? 0 : msg.seq;
}

// 지금 보고 있는 스페이스: focused().space가 먼저다. spaces()의 active는 머신마다 하나씩 있어서,
// 원격 스페이스에 있어도 이 PC 쪽 스페이스를 잡아 미리보기가 엉뚱한 스페이스(setting 등)에 열렸다.
export function currentSpace(focused, spaces) {
  return spaces.find(s => s.id === focused?.space) ?? spaces.find(s => s.active) ?? null;
}

// 경로를 찾아볼 다른 머신: 연결돼 준비된 것만(꺼진 머신은 exec가 타임아웃까지 기다린다).
export function readyRemotes(list) {
  return list.filter(m => m.name && m.layout === "ready").map(m => m.name);
}

// 트리와 미리보기 사이 경계를 끌 때 트리 너비: 180px 이상, 미리보기가 320px은 남게.
export function clampTree(w, total) {
  return Math.round(Math.max(180, Math.min(w, total - 320)));
}

// 아래 재생 막대(−10초·+10초·⇄)는 A/B 비교일 때만 띄운다. 영상 하나·소리 하나는 각자 화면에 조작이 있고,
// 막대가 올라오면 미리보기가 밀려 화면이 바뀐다는 요청이 있었다.
export function showMediaBar(track) {
  return Boolean(track && track.items.length === 2);
}

// 글의 보이는 폭(칸): 한글·한자·가나·전각은 2칸, 나머지는 1칸. CSV 열 너비에 쓴다.
export function textWidth(s) {
  let w = 0;
  for (const ch of s) w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1;
  return w;
}

// CSV 열 너비(px): 앞 500행에서 열마다 가장 넓은 글(최대 48칸). 불러올 때 한 번만 계산한다.
export function csvWidths(rows) {
  const cols = Math.max(0, ...rows.map(r => r.length)), sample = rows.slice(0, 500);
  return Array.from({ length: cols }, (_, c) => Math.min(48, Math.max(3, ...sample.map(r => textWidth(r[c] ?? "")))) * 7.4 + 18);
}

// 캐시 정리: maxAge(기본 3일)보다 오래된 파일, 그리고 남은 합이 maxBytes(기본 500MB)를 넘으면 오래된 것부터. 지울 경로 목록.
export function cacheToDelete(files, now, { maxAge = 3 * 86400000, maxBytes = 500 * 1048576 } = {}) {
  const out = [], keep = [];
  for (const f of files) (now - f.mtime > maxAge ? out : keep).push(f);
  keep.sort((a, b) => a.mtime - b.mtime);
  let total = keep.reduce((n, f) => n + f.size, 0);
  for (const f of keep) { if (total <= maxBytes) break; out.push(f); total -= f.size; }
  return out.map(f => f.path);
}

// 파일 안 검색(대소문자 무시): [{ line(1부터), text, at: 찾은 자리들 }], max줄까지.
export function findLines(text, query, max = 500) {
  if (!query) return [];
  const q = query.toLowerCase(), out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length && out.length < max; i++) {
    // 소문자로 바꿀 때 길이가 바뀌는 글자(İ 등)가 있으면 원래 자리로 되돌리는 표를 만든다.
    let low = lines[i].toLowerCase(), map = null;
    if (low.length !== lines[i].length) {
      low = ""; map = [];
      for (let j = 0; j < lines[i].length; j++) { const l = lines[i][j].toLowerCase(); low += l; for (let n = 0; n < l.length; n++) map.push(j); }
    }
    const at = [];
    for (let k = low.indexOf(q); k >= 0; k = low.indexOf(q, k + q.length)) at.push(map ? map[k] : k);
    if (at.length) out.push({ line: i + 1, text: lines[i], at });
  }
  return out;
}

// git status --porcelain=v1 -z 출력을 트리 표시(A·U·D·M)로. 경로는 저장소 기준이라, 지금 폴더의 저장소 안 위치(prefix,
// `git rev-parse --show-prefix`)를 떼고 보는 폴더 문자열(root) 그대로 키를 만든다. 그래야 Windows의 \ 경로나 심볼릭 링크 폴더에서도 맞는다.
export function gitMarks(statusZ, prefix, root, max = 5000) {
  const marks = {};
  for (const entry of statusZ.split("\0").filter(Boolean).slice(0, max)) {
    const xy = entry.slice(0, 2), path = entry.slice(3);
    if (prefix && !path.startsWith(prefix)) continue;
    marks[`${root}/${path.slice(prefix.length)}`] = xy === "??" || xy.includes("A") ? "A" : xy.includes("U") ? "U" : xy.includes("D") ? "D" : "M";
  }
  return marks;
}

// 로그 따라가기: 끝의 n줄(마지막 빈 줄 제외).
export function tailLines(text, n) {
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines.slice(-n);
}

// git diff 출력을 줄마다 { kind: meta | hunk | add | del | ctx, text }로.
export function parseDiff(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines.map(l => ({
    kind: /^(diff |index |--- |\+\+\+ |new file|deleted file|similarity|rename |old mode|new mode)/.test(l) ? "meta"
      : l.startsWith("@@") ? "hunk" : l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : "ctx",
    text: l,
  }));
}

// 마크다운을 글 조각({md})과 ```mermaid 조각({mermaid})으로 나눈다. mermaid 블록이 없으면 null(그냥 마크다운으로 그린다).
export function splitMermaid(text) {
  const re = /^```mermaid[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm, parts = [];
  let at = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > at) parts.push({ md: text.slice(at, m.index) });
    parts.push({ mermaid: m[1] });
    at = m.index + m[0].length;
  }
  if (!parts.length) return null;
  if (at < text.length) parts.push({ md: text.slice(at) });
  return parts;
}

// 사진 확대 단계. zoom이 null이면 "맞춤"이고 fit은 그때의 배율이다. dir: +1 키우기, -1 줄이기.
const ZOOMS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
export function zoomStep(zoom, dir, fit) {
  const now = zoom ?? fit;
  if (dir > 0) return ZOOMS.find(z => z > now + 1e-9) ?? ZOOMS.at(-1);
  return [...ZOOMS].reverse().find(z => z < now - 1e-9) ?? ZOOMS[0];
}

// 움직일 수 있는 그림인가(GIF·WebP·APNG). Herdr의 image()는 첫 장면만 그려서, 프레임으로 풀어 직접 넘긴다.
export function isAnimatable(path) {
  return ["gif", "webp", "apng"].includes(extOf(path));
}

// 지난 시간(elapsed ms)에 보여 줄 프레임 번호. durations: 프레임별 간격(ms), 끝나면 처음부터. 0 이하 간격은 100ms(브라우저와 같게).
export function frameAt(durations, elapsed) {
  if (!durations.length) return 0;
  const d = durations.map(x => (x > 0 ? x : 100)), total = d.reduce((a, b) => a + b, 0);
  let t = elapsed % total;
  for (let i = 0; i < d.length; i++) { if (t < d[i]) return i; t -= d[i]; }
  return 0;
}

// HTML을 브라우저로 그린 그림의 캐시 이름(조각은 -0.png, -1.png …). 파일·수정 시각·크기·너비가 같으면 다시 그리지 않는다.
export function htmlShotKey(path, mtime, size, width) {
  let h = 5381;
  for (const ch of `${path}|${mtime}|${size}`) h = (h * 33 + ch.codePointAt(0)) >>> 0;
  return `html-${h.toString(16)}-w${width}`;
}

// HTML을 그릴 너비: 미리보기 폭을 100px 단위로 내리고 480~1280px 사이로.
export function htmlWidth(box) {
  return Math.max(480, Math.min(1280, Math.floor(box / 100) * 100));
}

// 그린 다이어그램 캐시 이름: 코드 해시·길이·색(d 어두움/l 밝음).
export function mermaidName(code, dark) {
  let h = 5381;
  for (const ch of code) h = (h * 33 + ch.codePointAt(0)) >>> 0;
  return `mmd-${h.toString(16)}-${code.length}-${dark ? "d" : "l"}.png`;
}

// Mermaid를 그릴 브라우저 자리(있는 첫 것을 쓴다). 다른 PC에도 옮길 모드라 Edge 하나에 묶지 않는다.
// 하나도 없으면 mermaid-cli가 받아 둔 Chromium(puppeteer)을 쓴다.
export function browserCandidates(platform, home) {
  if (platform === "windows") return [
    "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    `${home}/AppData/Local/Google/Chrome/Application/chrome.exe`,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ];
  if (platform === "macos") return [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  return ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium", "/usr/bin/microsoft-edge"];
}

// mpv 자리(PATH에 없을 때 찾아볼 곳). winget(shinchiro)은 PATH에 넣지 않는다.
export function mpvCandidates(platform, home) {
  if (platform === "windows") return [
    "C:/Program Files/MPV Player/mpv.exe", "C:/Program Files/mpv/mpv.exe", `${home}/AppData/Local/Programs/mpv/mpv.exe`,
    `${home}/scoop/apps/mpv/current/mpv.exe`, "C:/ProgramData/chocolatey/lib/mpvio.install/tools/mpv.exe",
  ];
  if (platform === "macos") return ["/opt/homebrew/bin/mpv", "/usr/local/bin/mpv", "/Applications/mpv.app/Contents/MacOS/mpv"];
  return ["/usr/bin/mpv", "/usr/local/bin/mpv", "/snap/bin/mpv"];
}

// 테마 배경색(#rrggbb 또는 rgb(...))이 어두우면 true.
export function isDark(color) {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(color ?? ""), rgb = /rgba?\((\d+)\D+(\d+)\D+(\d+)/.exec(color ?? "");
  const [r, g, b] = hex ? hex.slice(1).map(x => parseInt(x, 16)) : rgb ? rgb.slice(1).map(Number) : [0, 0, 0];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

// 경로의 마지막 이름에서만 확장자를 소문자로(없으면 ""). 폴더 이름의 점(proj.v2/Makefile)이나 점으로 시작하는 이름(.gitignore)은 확장자가 아니다.
export function extOf(path) {
  const name = path.split(/[\\/]/).pop(), dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

// 경로의 마지막 이름에서 확장자를 보고 "image" | "audio" | "video" | "html" | "other"를 돌려준다.
export function kindOf(path) {
  const name = path.split(/[\\/]/).pop(), dot = name.lastIndexOf(".");
  if (dot <= 0) return "other";
  const ext = name.slice(dot + 1).toLowerCase();
  return Object.keys(KINDS).find(kind => KINDS[kind].includes(ext)) ?? "other";
}

// PowerShell 작은따옴표 문자열. PowerShell은 둥근 따옴표도 따옴표로 읽어서 같이 두 번 쓴다.
export function psQuote(text) {
  return "'" + text.replace(/['‘’‚‛]/g, "$&$&") + "'";
}

export function winPath(path) {
  return path.replace(/\//g, "\\");
}

// 그림(w×h)을 영역 box 안에 비율을 지켜 맞춘 크기. 영역보다 작은 그림은 키우지 않는다.
// 크기를 모르면(0) 영역의 짧은 변으로 정사각형을 잡는다.
export function fit(box, w, h) {
  if (!w || !h) { const side = Math.min(box.w, box.h); return { w: side, h: side }; }
  const scale = Math.min(box.w / w, box.h / h, 1);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

// 다른 머신에서 가져온 파일을 이 PC에 둘 때 쓰는 이름. 머신과 경로가 같으면 같은 이름이라 다시 가져오면 덮어쓴다.
export function remoteName(on, path) {
  let hash = 5381;
  for (const ch of `${on}:${path}`) hash = (hash * 33 + ch.codePointAt(0)) >>> 0;
  const name = path.split("/").pop(), dot = name.lastIndexOf(".");
  return hash.toString(16).padStart(8, "0") + (dot > 0 ? name.slice(dot).toLowerCase() : "");
}

// 재생바에 쓰는 시간 표시. 한 시간이 넘으면 h:mm:ss.
export function clock(s) {
  s = Number.isFinite(s) ? Math.max(0, Math.floor(s)) : 0;
  const m = Math.floor(s / 60), h = Math.floor(m / 60), ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m % 60).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// 지금 재생 위치(초). ffplay는 위치를 알려 주지 않아서, 시작한 자리와 흐른 시간으로 센다.
export function position(track, now) {
  if (!track) return 0;
  const p = track.playing ? track.offset + (now - track.startedAt) / 1000 : track.offset;
  return track.duration ? Math.min(p, track.duration) : p;
}

// 옮길 위치. 끝에 딱 붙이면 ffplay가 바로 끝나서 0.25초 앞에서 멈춘다.
export function seekTo(seconds, duration) {
  return Math.max(0, duration ? Math.min(seconds, duration - 0.25) : seconds);
}

// 재생바에서 누른 자리(x, 막대 너비)를 초로 바꾼다.
export function clickToSeconds(x, width, duration) {
  if (!width) return 0;
  return duration * Math.min(1, Math.max(0, x / width));
}

// ffplay에 넘길 인자 한 줄. 소리는 창 없이, 영상은 파일 이름을 제목으로 단 창으로 띄운다.
// 영상 창은 높이만 720으로 정해 4K도 화면을 넘지 않게 하고, 너비는 ffplay가 비율대로 맞춘다.
// 다른 머신의 파일은 sftp 주소로 받아 그대로 둔다.
export function ffplayArgs(path, at, video) {
  const p = path.startsWith("sftp://") ? path : winPath(path);
  // 명령줄 한 줄로 넘기므로 "가 있으면 인자가 깨지고 ffplay 옵션이 끼어든다. 그런 이름은 틀지 않는다.
  if (p.includes('"')) throw new Error('파일 이름에 큰따옴표(")가 있어 재생할 수 없습니다');
  const view = video ? `-window_title "${p.split(/[\\/]/).pop()}" -y 720` : "-nodisp";
  return `-autoexit -loglevel quiet -ss ${at} ${view} -i "${p}"`;
}

// `ssh -G <대상>` 출력에서 실제로 붙을 사용자, 호스트, 포트를 읽는다.
export function parseSshG(text) {
  const get = key => text.match(new RegExp(`^${key} (.+?)\\r?$`, "m"))?.[1];
  return { user: get("user"), hostname: get("hostname"), port: Number(get("port") ?? 22) };
}

// ffmpeg·ffplay가 다른 머신의 파일을 받지 않고 바로 읽는 주소.
// ffmpeg의 sftp는 %인코딩을 풀지 않아서 경로를 그대로 붙인다.
export function sftpUrl({ user, hostname, port }, path) {
  return `sftp://${user}@${hostname}${port && port !== 22 ? `:${port}` : ""}${path}`;
}

// "81", "1:21", "1:02:03", "81.5"를 초로. 읽을 수 없으면 0.
export function parseTime(text) {
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(text ?? "")) return 0;
  return text.split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
}

// Ctrl+Shift+G(복사한 경로 없음): 미리보기 탭이 아니면 그리로 가고(지금 탭을 기억), 미리보기 탭이면 기억한 탭으로 돌아간다.
// current: 지금 탭, viewer: 이 스페이스의 미리보기 탭(없으면 null), back: 기억한 탭, tabs: 이 스페이스의 탭들.
export function viewerToggle({ current, viewer, back, tabs }) {
  if (viewer && current === viewer) return { action: "back", tab: tabs.includes(back) ? back : null };
  return { action: "open", back: current };
}

// 경로를 찾아볼 머신 순서(null = 이 PC). Windows 경로는 이 PC에만 있다. 리눅스 경로는 정해진 머신(first) 먼저,
// 이 PC가 Windows면 이 PC는 빼고 다른 머신들에서 찾는다 (이 PC 스페이스에서 우분투 경로를 열 때 "No folder"가 났다).
export function machineCandidates(path, first, remotes, localIsWindows) {
  if (/^[A-Za-z]:[\\/]/.test(path)) return [null];
  const rest = remotes.filter(m => m !== first);
  if (first) return [first, ...rest];
  if (localIsWindows) return rest.length ? rest : [null];
  return [null, ...rest];
}

// 트리가 처음 뜰 때 미리보기 탭처럼 터미널이 없는 곳이면 폴더를 정할 수 없다.
// 이 스페이스에 마지막으로 보낸 폴더(tree 메시지), 없으면 이 스페이스 터미널의 폴더, 그것도 없으면 스페이스 폴더.
export function pickFolder({ tree, space, cwds }) {
  if (tree?.space === space.id && tree.cwd) return { cwd: tree.cwd, on: tree.on ?? null };
  return { cwd: cwds[0] || space.folder, on: space.machine ?? null };
}

// Ctrl+Shift+G로 미리보기 탭에 갈 때 보낼 열기 요청: 떠나는 탭의 터미널 폴더·머신(파일은 열지 않는다).
// 그래야 미리보기가 예전에 보던 폴더(D:\Uploads 등)에 머물지 않고 그 스페이스의 폴더를 보여 준다. 폴더를 모르면 null.
export function folderRequest(loc) {
  return loc?.cwd ? { folder: loc.cwd, on: loc.on ?? null, file: null } : null;
}

// 프로젝트(git 저장소) 루트: 지금 폴더(cwd) 끝이 저장소 안 위치(prefix, `git rev-parse --show-prefix`)와 맞으면 그만큼 올라간 곳.
// 지금 경로 표기(\, 심볼릭 링크 없는 경로)를 그대로 둔다. 끝이 안 맞으면(심볼릭 링크 폴더 등) null.
export function repoRoot(cwd, prefix) {
  const parts = prefix.split("/").filter(Boolean);
  if (!parts.length) return cwd;
  const sep = cwd.includes("\\") && !cwd.includes("/") ? "\\" : "/", segs = cwd.replace(/[\\/]+$/, "").split(/[\\/]/);
  const tail = segs.slice(-parts.length).map(s => s.toLowerCase()).join("/");
  if (segs.length <= parts.length || tail !== parts.map(s => s.toLowerCase()).join("/")) return null;
  return segs.slice(0, -parts.length).join(sep);
}

// 프로젝트 루트 버튼: 루트가 아니면 루트로 가며 지금 폴더를 기억하고, 루트에 있으면 기억한 폴더로 돌아간다.
// 필요 없으면(루트를 모르거나, 루트에 있고 돌아갈 곳이 없으면) null. 구분자(\ /)와 끝의 구분자는 같은 폴더로 본다.
export function rootStep({ current, root, back }) {
  const norm = p => (p ?? "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  if (!root || !current) return null;
  if (norm(current) !== norm(root)) return { go: root, back: current, label: "⌂ 프로젝트 루트" };
  return back ? { go: back, back: null, label: "↩ 원래 폴더" } : null;
}

// 새 미리보기 탭을 둘 자리: 지금 탭 바로 오른쪽(1부터). 모르는 탭이면 맨 끝.
export function rightOf(tabs, current) {
  const i = tabs.indexOf(current);
  return i < 0 ? tabs.length + 1 : i + 2;
}

// 영상 재생 창(mpv.exe): 바로 창을 띄우고 화면 가운데에 화면의 70% 크기로. Herdr 안 터미널(kitty) 재생은 1080p에서 끊겼다.
export function mpvWindowArgs({ src, at, title }) {
  return ["--force-window=immediate", "--keep-open=no", "--autofit=70%x70%", "--geometry=50%:50%", `--title=${title}`,
    ...(at > 0 ? [`--start=${at}`] : []), src];
}

// 장면 자리에 붙일 mpv 창: 테두리 없이 화면 밖에서 띄우고, 도우미(mpv-dock.ps1)가 Herdr에 딸리게 한 뒤 장면 자리로 옮긴다.
// 영상을 읽을 때 창 크기를 영상에 맞춰 바꾸지 않게 하고, 탭을 떠나면 멈출 수 있도록 파이프를 연다.
export function mpvDockArgs({ src, at, title, ipc }) {
  return ["--force-window=immediate", "--keep-open=no", "--no-border", "--auto-window-resize=no", "--geometry=1x1+-32000+-32000",
    `--input-ipc-server=${ipc}`, `--title=${title}`, ...(at > 0 ? [`--start=${at}`] : []), src];
}

// 붙인 mpv 창이 놓일 자리(Herdr 창 안 좌표, 논리 px). ▶를 누른 순간의 장면 자리(anchor.poster)를 기준으로
// 그 뒤 바뀐 뷰어 위치·크기와 트리 너비(트리+경계, 접었으면 0)만큼 옮긴다. 장면은 미리보기 칸 가운데에 있다.
export function dockRect(anchor, now) {
  const cx = anchor.poster.x + anchor.poster.width / 2 + (now.root.x - anchor.root.x) + (now.tree - anchor.tree + now.root.width - anchor.root.width) / 2;
  const cy = anchor.poster.y + anchor.poster.height / 2 + (now.root.y - anchor.root.y) + (now.root.height - anchor.root.height) / 2;
  return { x: Math.round(cx - now.poster.w / 2), y: Math.round(cy - now.poster.h / 2), w: Math.round(now.poster.w), h: Math.round(now.poster.h) };
}

// 도우미에게 넘기는 한 줄: "x y w h 보임(1/0)".
export function dockLine(rect, visible) {
  const r = rect ?? { x: 0, y: 0, w: 0, h: 0 };
  return [r.x, r.y, r.w, r.h].map(Math.round).join(" ") + (visible ? " 1" : " 0");
}

// Start-Process에 넘길 한 줄: 인자마다 큰따옴표로 감싼다(PowerShell 5는 배열을 따옴표 없이 이어 붙인다).
export function quoteArgs(args) {
  if (args.some(a => a.includes('"'))) throw new Error('인자에 큰따옴표(")가 있어 재생할 수 없습니다');
  return args.map(a => `"${a}"`).join(" ");
}

// 영상 장면(w×h) 한가운데 놓을 재생 버튼: 짧은 변의 10%, 32~48px.
export function playBadge(w, h) {
  const size = Math.round(Math.min(48, Math.max(32, Math.min(w, h) * 0.1)));
  return { size, left: Math.round((w - size) / 2), top: Math.round((h - size) / 2) };
}

// "경로 복사" 버튼이 복사할 경로: 보고 있는 파일(폴더 기준 상대 경로)이 있으면 그 파일, 없으면 폴더.
// Windows 폴더(C:\…)면 \ 로 잇는다.
export function copyPath(root, file) {
  if (!file) return root ?? "";
  const win = /^[A-Za-z]:[\\/]/.test(root), sep = win ? "\\" : "/";
  return root.replace(/[\\/]+$/, "") + sep + (win ? file.replace(/\//g, "\\") : file);
}

// 다운로드 폴더에 이미 같은 이름이 있으면 Windows 탐색기처럼 "이름 (1).확장자"로 비켜 간다(대소문자 무시).
// 점으로 시작하는 이름(.env)과 확장자 없는 폴더는 끝에 붙인다.
export function freeName(name, taken) {
  const used = new Set(taken.map(n => n.toLowerCase()));
  const dot = name.lastIndexOf("."), base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : "";
  let out = name;
  for (let i = 1; used.has(out.toLowerCase()); i++) out = `${base} (${i})${ext}`;
  return out;
}

// 트리에서 우클릭하면 뜨는 메뉴. 다운로드는 이 PC의 다운로드 폴더로 가져온다(다른 머신은 scp).
export function treeMenu(entry) {
  return [
    { id: "download", label: "다운로드 폴더로 받기" },
    { id: "downloads", label: "다운로드 폴더 열기" },
    { id: "copy", label: "경로 복사" },
    entry.dir ? { id: "root", label: "이 폴더를 루트로" } : { id: "open", label: "기본 앱으로 열기" },
  ];
}

// 다른 머신의 폴더 목록(GNU find). -H: 시작 폴더가 심볼릭 링크(~/ep2)여도 따라간다. 없으면 목록이 빈다.
export function remoteListArgs(path) {
  return ["-H", path, "-mindepth", "1", "-maxdepth", "1", "-not", "-name", ".git", "-printf", "%Y\\t%s\\t%T@\\t%f\\0"];
}

// Ctrl+클릭한 herdrview: 링크의 기록(link.txt: "<받은 시각 ms>\n<주소>")을 읽는다.
// 주소는 herdrview://<머신>/<절대 경로>#t=<시각>. 머신 칸이 비면 machine은 null(뷰어가 정한다).
// Windows 경로는 herdrview:///C:/… 로 쓴다. maxAge(ms)보다 오래됐거나 읽을 수 없으면 null.
export function parseLinkRequest(text, now, maxAge = 10000) {
  const [head, url = ""] = (text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const stamp = /^\d+$/.test(head) ? Number(head) : NaN;
  if (!(now - stamp <= maxAge)) return null;
  const m = url.trim().match(/^herdrview:\/\/([^/#]*)(\/[^#]*)(?:#t=(.*))?$/i);
  if (!m) return null;
  let path = m[2];
  try { path = decodeURIComponent(path); } catch {}
  if (/^\/[A-Za-z]:\//.test(path)) path = path.slice(1);
  return { stamp, machine: m[1] || null, path, t: parseTime(m[3]) };
}

// 복사한 글이 한 줄짜리 상대 경로(output/html/detail-page.html, 끝에 #t= 가능)면 { rel, t }, 아니면 null.
// 에이전트가 프로젝트 기준 상대 경로로 결과물을 알릴 때 쓴다. 폴더가 하나 이상 있어야 한다(README.md 같은 낱말은 아님).
export function parseRelative(text) {
  const line = (text ?? "").trim();
  if (!line || /[\r\n]/.test(line) || line.length > 1024) return null;
  const s = line.replace(/^[`'"(<]+/, "").replace(/[`'"),.;>]+$/, "").replace(/^\.\//, "");
  if (/\s/.test(s) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(s) || s.startsWith("/") || s.startsWith("\\")) return null;
  const m = s.match(/^(.+?)(?:#t=([\d:.]+))?$/);
  // 에이전트가 흔히 붙이는 :줄[:칸] 번호(src/a.ts:42)는 떼어 line으로 둔다.
  const lm = m[1].match(/^(.*?):(\d+)(?::\d+)?$/), rel = (lm ? lm[1] : m[1]).replace(/[\\/]+$/, "");
  if (!/[\\/]/.test(rel)) return null;
  return { rel: rel.replace(/\\/g, "/"), t: parseTime(m[2]), ...(lm ? { line: Number(lm[2]) } : {}) };
}

// 그 상대 경로로 끝나는 파일이 여럿이면 가장 최근에 바뀐 것(방금 만든 결과물일 가능성이 크다).
export function pickNewest(found) {
  return found.length ? found.reduce((a, b) => (b.mtime > a.mtime ? b : a)).path : null;
}

// 터미널에서 복사한 글에서 열 파일을 읽는다: 절대 경로 줄 한두 개, 각각 끝에 #t=<시각>을 붙일 수 있다.
// 두 개면 A/B 비교다. 따옴표·백틱과 끝의 쉼표·마침표·괄호는 떼어 낸다. 경로가 없으면 null.
// Claude Code 화면은 긴 경로를 터미널 폭에서 진짜 줄바꿈으로 자르므로, 경로 줄 뒤에 띄어쓰기 없는 줄이 이어지면
// 붙여 본다. 어디까지가 경로인지 글만으로는 알 수 없어서, 경로마다 후보를 긴 것부터 돌려준다: [[{path, t}, …], …].
// 실제로 있는 파일은 뷰어가 머신에 물어 고른다.
const START = /^[`'"(<]*(?:\/|[A-Za-z]:[\\/])/;
export function parseOpenRequest(text) {
  if (!text || text.length > 4096) return null;
  const groups = [], joins = new Set();
  let open = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (START.test(line)) {
      if (groups.length === 2) break;
      // 화면 폭에서 "/" 자리로 꺾이면 다음 줄도 / 로 시작한다. 앞줄이 아직 끝나지 않은 경로면 이어 붙일 수도 있다고 표시한다.
      const last = open ? groups.at(-1).at(-1) : null;
      if (last && !/\s|#t=/.test(last) && !/[`'"),;>]$/.test(last)) joins.add(groups.length - 1);
      groups.push([line]); open = true;
    }
    else if (open && line && !/\s/.test(line)) groups.at(-1).push(line);
    else open = false;
  }
  const out = groups.map((parts, i) => {
    const seen = new Set(), candidates = [];
    const add = (text, joined) => {
      const m = text.replace(/^[`'"(<]+/, "").replace(/[`'"),.;>]+$/, "").match(/^(.+?)(?:#t=([\d:.]+))?$/);
      // 끝의 :줄[:칸] 번호(/home/x/b.ts:10:5)는 뗀다.
      const p = m ? m[1].replace(/(.):(\d+)(?::\d+)?$/, "$1") : null;
      if (p && !seen.has(p)) { seen.add(p); candidates.push({ path: p, t: parseTime(m[2]), ...(joined ? { joined: true } : {}) }); }
    };
    // 다음 경로 줄까지 이어 붙인 후보(joined)가 먼저다. 이게 실제로 있으면 두 번째 경로(B)는 없는 것이다.
    const next = joins.has(i) ? groups[i + 1] : null;
    for (let n = next?.length ?? 0; n > 0; n--) add([...parts, ...next.slice(0, n)].join(""), true);
    for (let n = parts.length; n > 0; n--) add(parts.slice(0, n).join(""), false);
    return candidates;
  });
  return out.length ? out : null;
}

// 파일 크기를 짧게: 900 B, 2.4 KB, 379 MB, 2.8 GB.
export function formatSize(n) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return i === 0 ? `${n} B` : `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

// 수정 시각(초): 올해면 "11-13 10:35", 아니면 "2025-01-02". 모르면(0) 빈 글.
export function formatDate(sec, now = new Date()) {
  if (!sec) return "";
  const d = new Date(sec * 1000), p = n => String(n).padStart(2, "0");
  return d.getFullYear() === now.getFullYear() ? `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
    : `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 다른 머신의 폴더 목록: find -mindepth 1 -maxdepth 1 -printf '%Y\t%s\t%T@\t%f\0' 출력. %Y는 링크면 가리키는 쪽 종류.
export function parseFindListing(out) {
  return out.split("\0").filter(Boolean).map(rec => {
    const [type, size, mtime, ...name] = rec.split("\t");
    return { name: name.join("\t"), dir: type === "d", size: Number(size) || 0, mtime: Math.floor(Number(mtime)) || 0 };
  });
}

// 그림 파일 앞부분 바이트에서 너비·높이를 읽는다. 모르는 형식은 0.
export function imageSize(b) {
  const be16 = i => (b[i] << 8) | b[i + 1], le16 = i => b[i] | (b[i + 1] << 8);
  const le32 = i => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24));
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50) return { w: (be16(16) << 16) | be16(18), h: (be16(20) << 16) | be16(22) };
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { w: le16(6), h: le16(8) };
  if (b.length >= 26 && b[0] === 0x42 && b[1] === 0x4d) return { w: le32(18), h: Math.abs(le32(22)) };
  if (b.length >= 30 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const kind = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (kind === "VP8X") return { w: 1 + b[24] + (b[25] << 8) + (b[26] << 16), h: 1 + b[27] + (b[28] << 8) + (b[29] << 16) };
    if (kind === "VP8 ") return { w: le16(26) & 0x3fff, h: le16(28) & 0x3fff };
    if (kind === "VP8L") { const v = le32(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: be16(i + 7), h: be16(i + 5) };
      i += 2 + be16(i + 2);
    }
  }
  return { w: 0, h: 0 };
}

// ffprobe -show_format -show_streams JSON을 한 줄로: 해상도 · fps · 코덱 · 길이 · 비트레이트 · 소리.
export function mediaSummary(probe) {
  if (!probe) return "";
  const v = probe.streams?.find(s => s.codec_type === "video"), a = probe.streams?.find(s => s.codec_type === "audio"), out = [];
  if (v) {
    out.push(`${v.width}×${v.height}`);
    const [n, d] = (v.avg_frame_rate || "0/1").split("/").map(Number), fps = d ? n / d : 0;
    if (fps) out.push(`${Number.isInteger(fps) ? fps : fps.toFixed(2)} fps`);
    out.push(v.pix_fmt ? `${v.codec_name} ${v.pix_fmt}` : v.codec_name);
  }
  const dur = Number(probe.format?.duration);
  if (dur) out.push(clock(dur));
  const rate = Number(probe.format?.bit_rate);
  if (v && rate) out.push(`${Math.round(rate / 1e6)} Mb/s`);
  if (a) out.push(`${a.codec_name} ${Number(a.sample_rate) / 1000} kHz ${a.channels}ch`);
  else if (v) out.push("소리 없음");
  return out.join(" · ");
}

// 경로 막대: 루트부터 한 칸씩, 누르면 그 폴더로 가는 경로들. Windows는 드라이브부터, 원래 쓰던 구분자를 따른다.
export function breadcrumbs(root) {
  if (!root) return [];
  const sep = root.includes("\\") ? "\\" : "/", parts = root.split(/[\\/]/).filter(Boolean);
  if (/^[A-Za-z]:$/.test(parts[0] ?? "")) {
    return parts.map((label, i) => ({ label, path: i === 0 ? label + sep : parts.slice(0, i + 1).join(sep) }));
  }
  return [{ label: "/", path: "/" }, ...parts.map((label, i) => ({ label, path: "/" + parts.slice(0, i + 1).join("/") }))];
}

// 고친 채로 다른 파일·폴더로 가려 할 때: 처음엔 막고(armed에 기억), 같은 곳을 한 번 더 누르면 버리고 넘어간다.
export function discardGate(dirty, armed, target) {
  if (!dirty) return { allow: true, armed: null };
  return armed === target ? { allow: true, armed: null } : { allow: false, armed: target };
}

// 트리 패널과 미리보기 탭은 shared 메시지({seq, space, …})로 주고받는다. 처음 보는 것이고 내 스페이스(또는 스페이스 없음)로 온 것만 받는다.
export function follows(msg, seen, space) {
  return Boolean(msg) && msg.seq > seen && (!msg.space || msg.space === space);
}

// 절대 경로를 폴더와 파일 이름으로 나눈다. 뷰어는 폴더를 열고 그 안의 파일을 고른다.
export function splitPath(path) {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return { folder: path.slice(0, cut) || "/", file: path.slice(cut + 1) };
}
