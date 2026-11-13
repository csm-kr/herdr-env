// 경로 열기: 지금 터미널 화면(과 최근 기록)에서 절대·상대 경로를 모두 찾아 목록으로 보여 주고, 고르면 file-viewer 미리보기로 연다.
// Herdr는 터미널의 글자 경로를 Ctrl+클릭 링크로 잡지 않아서, 에이전트(Claude·Codex 등)나 셸이 무엇을 찍든 이걸로 연다.
// 단축키는 keys.json에서 mod.open:path-picker로 건다(Ctrl+Shift+Y). 고른 경로는 shared "file-viewer.request"로 넘긴다
// (그 터미널 폴더를 기준으로 상대 경로를 찾고, 꺾인 경로·#t= 시각도 file-viewer가 처리한다).
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, ScrollHandle } from "gpui-base";
import { props, closeOverlay, focused, hc, theme, run, setShared, shared, home, exec, panes } from "herdr";
import { extractPaths, filterPaths, expandHome } from "./kind.js";

const ABSOLUTE = /^([A-Za-z]:[\\/]|\/|~[\\/])/;

export default class Picker extends View {
  init(_props, cx) {
    this.all = null; this.sel = 0; this.err = null;
    this.input = InputState.new({ placeholder: "거를 글 · ↑↓ Enter · Esc" });
    this.scroll = ScrollHandle.new();
    this.input.on("change", (_e, cx) => { this.sel = 0; cx.notify(); });
    this.input.on("submit", (_e, cx) => this.choose(this.sel, cx));
    this.input.focus();
    const f = focused();
    this.term = f?.terminal ?? null; this.cwd = f?.cwd ?? null;
    // 미리보기 탭(터미널 없음)에서 열었으면, Ctrl+Shift+G로 오기 전의 탭(file-viewer.back)의 터미널을 읽는다.
    if (!this.term && f?.space) {
      const back = (shared("file-viewer.back") ?? {})[f.space], pane = back && panes().find(p => p.tab === back && p.terminal);
      if (pane) { this.term = pane.terminal; this.cwd = pane.cwd ?? null; }
    }
    // 다른 머신의 터미널은 주소가 "머신/t7"이다.
    this.on = this.term?.includes("/") ? this.term.split("/")[0] : null;
    if (!this.term) { this.err = "터미널에 포커스가 없습니다. 경로가 찍힌 터미널을 누른 뒤 다시 여세요."; return; }
    // 화면부터 바로(0.15초쯤) 보여 주고, 위쪽 기록 150줄은 뒤에서 읽어 덧붙인다(기록이 긴 터미널은 수 초 걸린다).
    cx.spawn(async cx => {
      const r = await hc(["read", this.term]).catch(e => ({ code: 1, stderr: String(e) }));
      if (r.code !== 0) { this.err = (r.stderr || "").trim() || "화면을 읽지 못했습니다"; cx.notify(); return; }
      this.all = extractPaths(r.stdout, 80);
      cx.notify();
      const h = await hc(["read", "--lines", "150", this.term]).catch(() => null);
      if (h?.code !== 0) return;
      const seen = new Set(this.all.map(c => c.text));
      this.all = [...this.all, ...extractPaths(h.stdout, 120).filter(c => !seen.has(c.text))].slice(0, 120);
      cx.notify();
    });
  }

  list() { return filterPaths(this.all ?? [], this.input.value()); }

  choose(i, cx) {
    const c = this.list()[i];
    if (!c) return;
    const send = text => {
      setShared("file-viewer.request", { text, cwd: this.cwd, on: this.on, seq: Date.now() });
      closeOverlay(props().overlay);
      run("mod.open", { name: "file-viewer" });
    };
    // ~ 로 시작하면 그 머신의 홈 폴더로 펼친다(이 PC는 home(), 다른 머신은 그 머신의 $HOME).
    if (!c.text.startsWith("~")) return send(c.text);
    if (!this.on) return send(expandHome(c.text, home()));
    cx.spawn(async () => {
      const r = await exec("sh", ["-c", 'printf %s "$HOME"'], { on: this.on }).catch(() => null);
      send(expandHome(c.text, r?.code === 0 ? r.stdout.trim() : null));
    });
  }

  render(cx) {
    const t = theme(), list = this.list();
    const where = `${this.on ? this.on + " · " : ""}${this.cwd ?? ""}`;
    const status = this.err ?? (this.all == null ? "화면을 읽는 중…" : list.length ? `${list.length}개 · ${where}` : `경로를 찾지 못했습니다 · ${where}`);
    return v_flex().id("path-picker").size_full().bg(t.popover).text_color(t.foreground).text_size(13)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.sel = Math.min(list.length - 1, this.sel + 1);
        else if (e.key === "up") this.sel = Math.max(0, this.sel - 1);
        if (e.key === "down" || e.key === "up") this.scroll.scroll_to_item(this.sel);
        else if (e.key === "escape") { closeOverlay(props().overlay); return; }
        else return;
        cx.notify();
      })
      .child(div().p(10).border_b(1).border_color(t.border).child(Input.new(this.input)))
      .child(div().px(14).py(6).text_size(11.5).text_color(this.err ? t.ansi1 : t.dim).truncate().child(status))
      .child(v_flex().id("picker-list").flex_1().min_h(0).px(6).pb(6).overflow_y_scrollbar().track_scroll(this.scroll)
        .children(list.map((c, i) => h_flex().id(`p-${i}`).px(8).py(5).gap(10).rounded(6).cursor_pointer()
          .when(i === this.sel, el => el.bg(t.selected)).hover(s => s.bg(t.hover))
          .on_click((_e, cx) => this.choose(i, cx))
          .child(div().flex_none().w(34).text_size(11).text_color(t.dim).child(ABSOLUTE.test(c.text) ? "절대" : "상대"))
          .child(div().flex_1().min_w(0).truncate().font_family("monospace").child(c.text)))));
  }
}
