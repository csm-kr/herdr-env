# 미리보기 장면 자리에 mpv 창을 붙여 두는 도우미. file-viewer 모드가 mpv를 띄운 직후 숨은 창으로 실행한다.
#   mpv-dock.ps1 -MpvPid 123 -DockFile <dock.txt> -Ipc \\.\pipe\herdr-mpv-...  [-Owner <창 핸들>: 시험용, 빼면 Herdr 창]
# 하는 일
#   1. mpv 창을 Herdr 창에 딸리게(owned) 한다. Herdr 위에만 뜨고, Herdr를 최소화하거나 다른 프로그램이 덮으면 같이 가려진다.
#      작업 표시줄에는 따로 나오지 않는다.
#   2. dock.txt("x y w h 보임", Herdr 창 안 논리 px)를 15ms마다 보고, Herdr 창 위치·DPI에 맞춰 mpv 창을 옮긴다.
#      Herdr 창을 끌어 옮겨도 따라간다.
#   3. "보임"이 0이 되면(다른 탭으로 감) 창을 숨기고 영상을 멈춘다.
#   4. mpv가 끝나면 같이 끝나고, Herdr가 닫히면 mpv도 닫는다.
# Herdr 창(GPUI)은 DirectComposition으로 그려서, 자식 창(SetParent)으로 넣으면 화면 아래에 깔릴 수 있다. 그래서 딸린 창으로 붙인다.
param([int]$MpvPid, [string]$DockFile, [string]$Ipc, [long]$Owner = 0)
$ErrorActionPreference = 'Stop'

if ($Owner) { $ownerHwnd = [IntPtr]$Owner }
else {
  $herdr = Get-Process herdr-app -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if (-not $herdr) { exit 1 }
  $ownerHwnd = $herdr.MainWindowHandle
}

Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class HerdrMpvDock {
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hh, uint flags);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] static extern IntPtr SetLong(IntPtr h, int i, IntPtr v);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetLong(IntPtr h, int i);

  static IntPtr WindowOf(int pid) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid && IsWindowVisible(h)) { found = h; return false; } return true; }, IntPtr.Zero);
    return found;
  }

  static void Pause(string ipc) {
    try {
      using (var pipe = new NamedPipeClientStream(".", ipc.Replace(@"\\.\pipe\", ""), PipeDirection.Out)) {
        pipe.Connect(300);
        var b = Encoding.UTF8.GetBytes("{\"command\":[\"set_property\",\"pause\",true]}\n");
        pipe.Write(b, 0, b.Length);
      }
    } catch { }
  }

  public static void Run(int mpvPid, IntPtr herdr, string dockFile, string ipc) {
    SetThreadDpiAwarenessContext(new IntPtr(-4)); // 모니터별 DPI: 좌표를 실제 픽셀로 다룬다
    Process mpvProc;
    try { mpvProc = Process.GetProcessById(mpvPid); } catch { return; }
    IntPtr mpv = IntPtr.Zero;
    for (int i = 0; i < 400 && mpv == IntPtr.Zero; i++) { if (mpvProc.HasExited) return; mpv = WindowOf(mpvPid); if (mpv == IntPtr.Zero) Thread.Sleep(25); }
    if (mpv == IntPtr.Zero) return;
    SetLong(mpv, -8, herdr); // GWLP_HWNDPARENT: Herdr에 딸린 창
    long ex = GetLong(mpv, -20).ToInt64();
    SetLong(mpv, -20, new IntPtr((ex & ~0x40000L) | 0x80L)); // WS_EX_APPWINDOW 빼고 WS_EX_TOOLWINDOW: 작업 표시줄에 안 나옴

    DateTime stamp = DateTime.MinValue;
    int x = 0, y = 0, w = 0, h = 0; bool want = false, wasWant = true;
    while (!mpvProc.HasExited) {
      if (!IsWindow(herdr)) { try { mpvProc.Kill(); } catch { } return; }
      try {
        var t = File.GetLastWriteTimeUtc(dockFile);
        if (t != stamp) {
          stamp = t;
          var p = File.ReadAllText(dockFile).Trim().Split(' ');
          if (p.Length == 5) { x = int.Parse(p[0]); y = int.Parse(p[1]); w = int.Parse(p[2]); h = int.Parse(p[3]); want = p[4] == "1"; }
        }
      } catch { }
      if (wasWant && !want) Pause(ipc);
      wasWant = want;
      bool show = want && w > 0 && h > 0 && !IsIconic(herdr);
      if (show) {
        double s = GetDpiForWindow(herdr) / 96.0;
        var o = new POINT(); ClientToScreen(herdr, ref o);
        int X = o.X + (int)Math.Round(x * s), Y = o.Y + (int)Math.Round(y * s), W = (int)Math.Round(w * s), H = (int)Math.Round(h * s);
        RECT r; GetWindowRect(mpv, out r);
        if (!IsWindowVisible(mpv) || r.L != X || r.T != Y || r.R - r.L != W || r.B - r.T != H)
          SetWindowPos(mpv, IntPtr.Zero, X, Y, W, H, 0x0004 | 0x0010 | 0x0040); // NOZORDER | NOACTIVATE | SHOWWINDOW
      } else if (IsWindowVisible(mpv) && !IsIconic(herdr)) {
        ShowWindow(mpv, 0); // 숨김(Herdr 최소화 때는 Windows가 알아서 숨긴다)
      }
      Thread.Sleep(15);
    }
  }
}
'@

[HerdrMpvDock]::Run($MpvPid, $ownerHwnd, $DockFile, $Ipc)
