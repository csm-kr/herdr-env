// 움직이는 WebP(와 ffmpeg가 못 푼 GIF·APNG)를 Chrome의 ImageDecoder로 프레임 WebP와 프레임별 간격(ms)으로 푼다(ffmpeg는 움직이는 WebP를 못 푼다).
// node anim-frames.js <puppeteer 폴더> <브라우저 exe> <그림 파일> <출력 접두어> <최대 폭>  → 출력: {"w","h","durations":[…]}, 파일: 접두어-000.webp …
// 빠르게: 프레임 변환은 한꺼번에 돌리고, PNG(60장 34MB) 대신 WebP(4.6MB)로 옮기고, 끝나면 Chrome 닫기를 기다리지 않고 끝낸다.
// (780×780 60장: 17~27초 → 5~7초, 다른 일이 도는 PC에서 잰 값)
const [pp, exe, file, out, maxW] = process.argv.slice(2);
const puppeteer = require(pp), fs = require("fs"), path = require("path"), os = require("os");
const mime = { gif: "image/gif", webp: "image/webp", apng: "image/apng", png: "image/png" }[path.extname(file).slice(1).toLowerCase()] || "image/gif";
let browser = null;
const quit = code => { try { browser?.process()?.kill(); } catch {} process.exit(code); };
// Chrome 닫기를 기다리지 않으니 프로필 폴더는 우리 이름으로 만들고, 1분 넘게 지난 예전 것을 다음 실행 때 치운다(하나에 5~10MB).
const tmp = os.tmpdir(), PREFIX = "herdr-anim-";
for (const n of fs.readdirSync(tmp)) {
  if (!n.startsWith(PREFIX)) continue;
  const d = path.join(tmp, n);
  try { if (Date.now() - fs.statSync(d).mtimeMs > 60000) fs.rmSync(d, { recursive: true, force: true }); } catch {}
}
(async () => {
  const userDataDir = fs.mkdtempSync(path.join(tmp, PREFIX));
  browser = await puppeteer.launch({ executablePath: exe, headless: true, userDataDir, args: ["--disable-gpu", "--disable-extensions", "--no-first-run"] });
  const page = await browser.newPage();
  // ImageDecoder는 보안 문맥에서만 있다: file:// 페이지로 간다.
  await page.goto(require("url").pathToFileURL(path.dirname(file)).href).catch(() => null);
  const data = fs.readFileSync(file).toString("base64");
  const r = await page.evaluate(async (data, mime, maxW) => {
    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    const dec = new ImageDecoder({ data: bytes, type: mime });
    await dec.tracks.ready;
    const n = Math.min(150, dec.tracks.selectedTrack.frameCount);
    const jobs = [], durations = [];
    let w = 0, h = 0;
    for (let i = 0; i < n; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      const s = Math.min(1, maxW / image.displayWidth);
      w = Math.round(image.displayWidth * s); h = Math.round(image.displayHeight * s);
      const c = new OffscreenCanvas(w, h); c.getContext("2d").drawImage(image, 0, 0, w, h);
      durations.push(Math.round((image.duration ?? 0) / 1000));
      image.close();
      jobs.push(c.convertToBlob({ type: "image/webp", quality: 0.95 }));
    }
    const frames = await Promise.all(jobs.map(async job => {
      const buf = new Uint8Array(await (await job).arrayBuffer());
      let bin = ""; for (let k = 0; k < buf.length; k += 0x8000) bin += String.fromCharCode(...buf.subarray(k, k + 0x8000));
      return btoa(bin);
    }));
    return { w, h, frames, durations };
  }, data, mime, Number(maxW));
  r.frames.forEach((f, i) => fs.writeFileSync(`${out}-${String(i).padStart(3, "0")}.webp`, Buffer.from(f, "base64")));
  process.stdout.write(JSON.stringify({ w: r.w, h: r.h, durations: r.durations }), () => quit(0));
})().catch(e => { process.stderr.write(String(e && e.message || e)); quit(1); });
