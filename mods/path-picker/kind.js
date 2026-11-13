// path-picker의 순수 로직(node --test로 시험한다).

// 경로 앞뒤에 붙은 따옴표·백틱·괄호와 끝 문장부호를 뗀다(#t= 시각은 남긴다).
function clean(s) {
  return s.replace(/^[`'"(<\[{]+/, "").replace(/[`'"),.;:!?>\]}]+$/, "");
}

const ABS_UNIX = /^\/[^/\s]+\/[^\s]*$/, ABS_WIN = /^[A-Za-z]:[\\/]/;
// 상대 경로: 폴더 하나 이상 + (확장자가 있는 파일 또는 /로 끝나는 폴더). 숫자만 있는 조각(1/2, 2026/11/13)은 아니다.
const REL = /^(?:\.{1,2}[\\/])?[^\s:\\/]+(?:[\\/][^\s:\\/]+)*(?:\.[A-Za-z0-9]{1,8}(?:#t=[\d:.]+)?|[\\/])$/;

function isPath(s) {
  if (!s || /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(s)) return false; // URL
  // 정규식·코드 조각: 경로에 거의 쓰지 않는 글자가 있으면 뺀다.
  if (/[\^$*+?|{}\[\]<>"`]/.test(s)) return false;
  if (/^~[\\/]/.test(s)) return true; // 홈 기준(~/.config/…)
  if (ABS_WIN.test(s)) return true;
  if (ABS_UNIX.test(s)) return true;
  if (!/[\\/]/.test(s) || /^[\d\\/.:-]+$/.test(s)) return false;
  return REL.test(s);
}

// 터미널 화면 글에서 열 수 있는 경로(절대·상대)를 찾는다. 아래쪽(최근) 줄부터, 한 줄 안에서는 뒤쪽부터.
// 줄 끝 조각과 다음 줄 첫 조각을 이어 붙인 후보도 낸다(화면 폭에서 꺾인 경로). [{ text }], 최대 max개.
export function extractPaths(text, max = 60) {
  const lines = (text ?? "").split(/\r?\n/), out = [], seen = new Set();
  // 끝의 :줄[:칸] 번호(src/a.ts:42)는 떼고 넣는다(드라이브 C: 는 그대로).
  const add = raw => { const s = raw.replace(/(.):(\d+)(?::\d+)?$/, "$1"); if (isPath(s) && !seen.has(s) && out.length < max) { seen.add(s); out.push({ text: s }); } };
  const tokens = line => [...line.matchAll(/[^\s│┃┆┊|]+/g)].map(m => m[0]);
  const blank = m => " ".repeat(m.length);
  for (let i = lines.length - 1; i >= 0 && out.length < max; i--) {
    // 띄어쓰기로 자르기 전에 통째로 뽑을 것: 마크다운 링크 (경로), file:/// 주소, 따옴표 안의 띄어쓰기 든 절대 경로.
    const special = [];
    const line = lines[i]
      .replace(/\]\(([^)\s]+)\)/g, (m, p) => { special.push(p); return blank(m); })
      .replace(/file:\/\/\/?([^\s"'<>)]+)/gi, (m, p) => { let d = p; try { d = decodeURIComponent(p); } catch {} special.push(/^[A-Za-z]:/.test(d) ? d : "/" + d.replace(/^\/+/, "")); return blank(m); })
      .replace(/"([^"]*\s[^"]*)"/g, (m, p) => (/^([A-Za-z]:[\\/]|\/)/.test(p) ? (special.push(p), blank(m)) : m));
    for (const p of special.reverse()) add(p);
    const toks = tokens(line);
    const next = i + 1 < lines.length ? tokens(lines[i + 1])[0] : null;
    for (let j = toks.length - 1; j >= 0; j--) {
      // Write(경로)·Read(경로)처럼 이름 뒤 괄호에 든 경로는 괄호 속만.
      const inner = toks[j].match(/^[A-Za-z]\w*\((.+?)\)?[,.;:]*$/);
      const t = clean(inner ? inner[1] : toks[j]);
      // 꺾인 경로: 줄 맨 끝에 걸쳐 있고(뒤에 │ 같은 기호 없음) 아직 확장자로 끝나지 않은 경로만 다음 줄과 이어 본다.
      const atEnd = lines[i].trimEnd().endsWith(toks[j]);
      if (j === toks.length - 1 && atEnd && next && /[\\/]/.test(t) && !/\.[A-Za-z0-9]{1,8}(#t=[\d:.]+)?$/.test(t)) add(clean(t + next));
      add(t);
    }
  }
  return out;
}

// ~ 로 시작하는 경로를 그 머신의 홈 폴더 기준 절대 경로로 펼친다. home의 구분자(\ /)를 따른다.
export function expandHome(path, home) {
  if (!home || !/^~[\\/]/.test(path)) return path;
  const sep = home.includes("\\") ? "\\" : "/";
  return home.replace(/[\\/]+$/, "") + sep + path.slice(2).replace(/[\\/]/g, sep);
}

// 거르기: 띄어쓴 낱말이 모두 들어 있는 것만(대소문자 무시).
export function filterPaths(list, query) {
  const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return words.length ? list.filter(c => words.every(w => c.text.toLowerCase().includes(w))) : list;
}
