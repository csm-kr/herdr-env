// kind.js 테스트. 실행: node --test mods/file-viewer/test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { kindOf, psQuote, winPath } from "../kind.js";

test("이미지 확장자는 image", () => {
  for (const name of ["a.png", "b.JPG", "c.jpeg", "d.gif", "e.webp", "f.bmp", "g.svg", "h.ico", "폴더/사진 1.PNG"])
    assert.equal(kindOf(name), "image", name);
});

test("소리와 영상은 audio, video", () => {
  for (const name of ["a.mp3", "b.wav", "c.flac", "d.m4a", "e.ogg"]) assert.equal(kindOf(name), "audio", name);
  for (const name of ["a.mp4", "b.MOV", "c.mkv", "d.webm", "e.avi"]) assert.equal(kindOf(name), "video", name);
});

test("html과 htm은 html", () => {
  assert.equal(kindOf("index.html"), "html");
  assert.equal(kindOf("old/PAGE.HTM"), "html");
});

test("그 밖의 파일과 확장자 없는 파일은 other", () => {
  for (const name of ["main.js", "README.md", "Makefile", ".gitignore", "png", "a.png.txt", "dir.png/readme"])
    assert.equal(kindOf(name), "other", name);
});

test("psQuote는 작은따옴표로 감싸고 안쪽 따옴표를 두 번 쓴다", () => {
  assert.equal(psQuote("C:/a b/c.png"), "'C:/a b/c.png'");
  assert.equal(psQuote("it's"), "'it''s'");
  // PowerShell은 둥근 따옴표도 따옴표로 읽는다.
  assert.equal(psQuote("a‘b’c"), "'a‘‘b’’c'");
  assert.equal(psQuote("$env:X; rm *"), "'$env:X; rm *'");
});

test("winPath는 슬래시를 역슬래시로 바꾼다", () => {
  assert.equal(winPath("C:\\Users\\me/Desktop/a b/c.png"), "C:\\Users\\me\\Desktop\\a b\\c.png");
});

test("fit은 영역 안에 비율을 지켜 맞추고, 작은 그림은 키우지 않는다", async () => {
  const { fit } = await import("../kind.js");
  // 가로로 긴 그림은 너비에 맞춘다.
  assert.deepEqual(fit({ w: 600, h: 400 }, 900, 300), { w: 600, h: 200 });
  // 세로로 긴 그림은 높이에 맞춘다.
  assert.deepEqual(fit({ w: 600, h: 400 }, 300, 900), { w: 133, h: 400 });
  // 정사각형은 짧은 변에 맞춘다.
  assert.deepEqual(fit({ w: 600, h: 400 }, 500, 500), { w: 400, h: 400 });
  // 영역보다 작으면 원래 크기 그대로.
  assert.deepEqual(fit({ w: 600, h: 400 }, 32, 16), { w: 32, h: 16 });
  // 크기를 모르면(svg, webp) 영역의 짧은 변으로 정사각형을 잡는다.
  assert.deepEqual(fit({ w: 600, h: 400 }, 0, 0), { w: 400, h: 400 });
});

test("remoteName은 머신과 경로로 정해지는 파일 이름을 만들고 확장자를 소문자로 붙인다", async () => {
  const { remoteName } = await import("../kind.js");
  const a = remoteName("192.168.0.10", "/home/me/out/clip 1.MP4");
  assert.match(a, /^[0-9a-f]{8}\.mp4$/);
  // 같은 입력은 같은 이름.
  assert.equal(a, remoteName("192.168.0.10", "/home/me/out/clip 1.MP4"));
  // 머신이나 경로가 다르면 다른 이름.
  assert.notEqual(a, remoteName("other", "/home/me/out/clip 1.MP4"));
  assert.notEqual(a, remoteName("192.168.0.10", "/home/me/out/clip 2.MP4"));
  // 확장자가 없으면 이름만.
  assert.match(remoteName("m", "/tmp/Makefile"), /^[0-9a-f]{8}$/);
});

test("clock은 초를 m:ss, 한 시간이 넘으면 h:mm:ss로 쓴다", async () => {
  const { clock } = await import("../kind.js");
  assert.equal(clock(0), "0:00");
  assert.equal(clock(65.9), "1:05");
  assert.equal(clock(3725), "1:02:05");
  // 모르는 값이나 음수는 0:00.
  assert.equal(clock(NaN), "0:00");
  assert.equal(clock(-3), "0:00");
});

test("position은 재생 중이면 시작 시각부터 흐른 만큼 더하고, 길이를 넘지 않는다", async () => {
  const { position } = await import("../kind.js");
  assert.equal(position(null, 0), 0);
  // 멈춰 있으면 멈춘 자리.
  assert.equal(position({ playing: false, offset: 42, startedAt: 0, duration: 100 }, 99999), 42);
  // 30초에서 시작해 5초 흘렀다.
  assert.equal(position({ playing: true, offset: 30, startedAt: 1000, duration: 100 }, 6000), 35);
  // 길이를 넘지 않는다. 길이를 모르면(0) 그대로 센다.
  assert.equal(position({ playing: true, offset: 90, startedAt: 0, duration: 100 }, 60000), 100);
  assert.equal(position({ playing: true, offset: 90, startedAt: 0, duration: 0 }, 60000), 150);
});

test("seekTo는 0과 끝 바로 앞 사이로 자른다", async () => {
  const { seekTo } = await import("../kind.js");
  assert.equal(seekTo(-10, 100), 0);
  assert.equal(seekTo(50, 100), 50);
  assert.equal(seekTo(130, 100), 99.75);
  // 길이를 모르면 아래만 막는다.
  assert.equal(seekTo(130, 0), 130);
});

test("clickToSeconds는 재생바에서 누른 자리를 초로 바꾼다", async () => {
  const { clickToSeconds } = await import("../kind.js");
  assert.equal(clickToSeconds(50, 200, 120), 30);
  // 막대 밖을 눌러도 0~길이 안으로.
  assert.equal(clickToSeconds(-5, 200, 120), 0);
  assert.equal(clickToSeconds(250, 200, 120), 120);
  // 너비를 모르면 0.
  assert.equal(clickToSeconds(50, 0, 120), 0);
});

test("ffplayArgs는 소리는 창 없이, 영상은 파일 이름을 제목으로 단 높이 720 창으로 띄우는 인자를 만든다", async () => {
  const { ffplayArgs } = await import("../kind.js");
  assert.equal(ffplayArgs("C:/음악/a b.mp3", 12.5, false), '-autoexit -loglevel quiet -ss 12.5 -nodisp -i "C:\\음악\\a b.mp3"');
  // 4K 영상도 화면을 넘지 않게 높이만 정하고 너비는 비율을 따른다.
  assert.equal(ffplayArgs("C:/v/clip 1.mp4", 0, true), '-autoexit -loglevel quiet -ss 0 -window_title "clip 1.mp4" -y 720 -i "C:\\v\\clip 1.mp4"');
});

test("parseSshG는 ssh -G 출력에서 user, hostname, port를 읽는다", async () => {
  const { parseSshG } = await import("../kind.js");
  const out = "user me\r\nhostname 192.168.0.10\r\nport 22\r\nidentityfile ~/.ssh/id_ed25519\r\n";
  assert.deepEqual(parseSshG(out), { user: "me", hostname: "192.168.0.10", port: 22 });
});

test("sftpUrl은 경로를 인코딩하지 않고 붙이고, 22번이 아닌 포트만 적는다", async () => {
  const { sftpUrl } = await import("../kind.js");
  // ffmpeg의 sftp는 %인코딩을 풀지 않아서 공백과 한글을 그대로 둬야 열린다.
  assert.equal(sftpUrl({ user: "me", hostname: "10.0.0.2", port: 22 }, "/tmp/a b/한글.mp4"), "sftp://me@10.0.0.2/tmp/a b/한글.mp4");
  assert.equal(sftpUrl({ user: "srv", hostname: "h.example", port: 7722 }, "/x.mp3"), "sftp://srv@h.example:7722/x.mp3");
});

test("ffplayArgs는 sftp 주소를 그대로 두고 마지막 이름을 제목으로 쓴다", async () => {
  const { ffplayArgs } = await import("../kind.js");
  assert.equal(ffplayArgs("sftp://me@h/v/clip 1.mp4", 3, true), '-autoexit -loglevel quiet -ss 3 -window_title "clip 1.mp4" -y 720 -i "sftp://me@h/v/clip 1.mp4"');
});

test("parseTime은 81, 1:21, 1:02:03, 81.5를 초로 읽고, 아니면 0", async () => {
  const { parseTime } = await import("../kind.js");
  assert.equal(parseTime("81"), 81);
  assert.equal(parseTime("1:21"), 81);
  assert.equal(parseTime("1:02:03"), 3723);
  assert.equal(parseTime("81.5"), 81.5);
  assert.equal(parseTime("abc"), 0);
  assert.equal(parseTime(undefined), 0);
});

test("parseOpenRequest는 복사한 글에서 절대 경로 한두 개와 #t= 시각을 읽는다 (경로마다 후보 목록)", async () => {
  const { parseOpenRequest } = await import("../kind.js");
  const p = "/home/me/proj/out/deliver/ep1-v2.mp4";
  assert.deepEqual(parseOpenRequest(p), [[{ path: p, t: 0 }]]);
  assert.deepEqual(parseOpenRequest(`${p}#t=81`), [[{ path: p, t: 81 }]]);
  assert.deepEqual(parseOpenRequest(`${p}#t=1:21`), [[{ path: p, t: 81 }]]);
  // 두 줄이면 A/B. 앞뒤 공백, 따옴표, 백틱, 끝의 쉼표·마침표·괄호는 떼어 낸다.
  assert.deepEqual(parseOpenRequest(`  \`/a/v1.mp4#t=81\`,\r\n"/a/v2.mp4#t=81".\n`), [[{ path: "/a/v1.mp4", t: 81 }], [{ path: "/a/v2.mp4", t: 81 }]]);
  // 경로가 아닌 줄은 건너뛰고, 세 번째 경로부터는 버린다. 화면 폭에서 꺾였을 수도 있어서 붙인 후보(joined)가 먼저 온다.
  assert.deepEqual(parseOpenRequest("결과:\n/a/1.wav\n/a/2.wav\n/a/3.wav"), [[{ path: "/a/1.wav/a/2.wav", t: 0, joined: true }, { path: "/a/1.wav", t: 0 }], [{ path: "/a/2.wav", t: 0 }]]);
  // Windows 경로도 된다.
  assert.deepEqual(parseOpenRequest("C:\\Users\\me\\a b.mp3"), [[{ path: "C:\\Users\\me\\a b.mp3", t: 0 }]]);
  // 경로가 없거나, 상대 경로거나, 너무 길면 null.
  assert.equal(parseOpenRequest("hello world"), null);
  assert.equal(parseOpenRequest("out/deliver/ep1.mp4"), null);
  assert.equal(parseOpenRequest(undefined), null);
  assert.equal(parseOpenRequest("/" + "a".repeat(5000)), null);
});

test("parseOpenRequest는 터미널 폭에서 잘린 경로를 이어 붙인 후보를 먼저 내놓는다", async () => {
  const { parseOpenRequest } = await import("../kind.js");
  // Claude Code 화면은 긴 줄을 진짜 줄바꿈으로 자르고 들여쓴다. 잘린 자리가 마침표 뒤여도 지우지 않는다.
  const text = "  /home/a/out/de\n  liver/ep1-v1.\n  mp4#t=81\n  /home/a/out/de\n  liver/ep1-v2.mp4#t=81\n";
  assert.deepEqual(parseOpenRequest(text), [
    [{ path: "/home/a/out/deliver/ep1-v1.mp4", t: 81 }, { path: "/home/a/out/deliver/ep1-v1", t: 0 }, { path: "/home/a/out/de", t: 0 }],
    [{ path: "/home/a/out/deliver/ep1-v2.mp4", t: 81 }, { path: "/home/a/out/de", t: 0 }],
  ]);
  // 빈 줄이나 띄어쓰기가 있는 줄은 이어 붙이지 않는다.
  assert.deepEqual(parseOpenRequest("/a/1.wav\n결과 끝"), [[{ path: "/a/1.wav", t: 0 }]]);
  assert.deepEqual(parseOpenRequest("/a/x\n\nfoo"), [[{ path: "/a/x", t: 0 }]]);
  // 공백 없는 한 단어가 뒤에 오면 붙인 후보와 안 붙인 후보를 둘 다 낸다(실제로 있는 쪽을 고른다).
  assert.deepEqual(parseOpenRequest("/a/1.wav\n끝"), [[{ path: "/a/1.wav끝", t: 0 }, { path: "/a/1.wav", t: 0 }]]);
});

test("splitPath는 절대 경로를 폴더와 파일 이름으로 나눈다", async () => {
  const { splitPath } = await import("../kind.js");
  assert.deepEqual(splitPath("/home/me/out/a b.mp4"), { folder: "/home/me/out", file: "a b.mp4" });
  assert.deepEqual(splitPath("/x.mp4"), { folder: "/", file: "x.mp4" });
  assert.deepEqual(splitPath("C:\\v\\clip.mp4"), { folder: "C:\\v", file: "clip.mp4" });
});
