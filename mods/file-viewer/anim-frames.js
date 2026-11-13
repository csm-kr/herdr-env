// 움직이는 GIF·WebP·APNG를 Chrome의 ImageDecoder로 프레임 PNG와 프레임별 간격(ms)으로 푼다(ffmpeg는 움직이는 WebP를 못 푼다).
// node anim-frames.js <puppeteer 폴더> <브라우저 exe> <그림 파일> <출력 접두어> <최대 폭>  → 출력: {"w","h","durations":[…]}, 파일: 접두어-000.png …
const [pp, exe, file, out, maxW] = process.argv.slice(2);
const puppeteer = require(pp), fs = require("fs"), path = require("path");
const mime = { gif: "image/gif", webp: "image/webp", apng: "image/apng", png: "image/png" }[path.extname(file).slice(1).toLowerCase()] || "image/gif";
(async () => {
  const b = await puppeteer.launch({ executablePath: exe, headless: true });
  try {
    const page = await b.newPage();
    // ImageDecoder는 보안 문맥에서만 있다: file:// 페이지로 간다.
    await page.goto(require("url").pathToFileURL(path.dirname(file)).href).catch(() => null);
    const data = fs.readFileSync(file).toString("base64");
    const r = await page.evaluate(async (data, mime, maxW) => {
      const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
      const dec = new ImageDecoder({ data: bytes, type: mime });
      await dec.tracks.ready;
      const n = Math.min(150, dec.tracks.selectedTrack.frameCount);
      const frames = [], durations = [];
      let w = 0, h = 0;
      for (let i = 0; i < n; i++) {
        const { image } = await dec.decode({ frameIndex: i });
        const s = Math.min(1, maxW / image.displayWidth);
        w = Math.round(image.displayWidth * s); h = Math.round(image.displayHeight * s);
        const c = new OffscreenCanvas(w, h); c.getContext("2d").drawImage(image, 0, 0, w, h);
        const blob = await c.convertToBlob({ type: "image/png" });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = ""; for (let k = 0; k < buf.length; k += 0x8000) bin += String.fromCharCode(...buf.subarray(k, k + 0x8000));
        frames.push(btoa(bin)); durations.push(Math.round((image.duration ?? 0) / 1000));
        image.close();
      }
      return { w, h, frames, durations };
    }, data, mime, Number(maxW));
    r.frames.forEach((f, i) => fs.writeFileSync(`${out}-${String(i).padStart(3, "0")}.png`, Buffer.from(f, "base64")));
    process.stdout.write(JSON.stringify({ w: r.w, h: r.h, durations: r.durations }));
  } finally { await b.close().catch(() => null); }
})().catch(e => { process.stderr.write(String(e && e.message || e)); process.exit(1); });
