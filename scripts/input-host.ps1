$ErrorActionPreference = 'SilentlyContinue'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class InputHost {
  [DllImport("user32.dll")]
  private static extern bool SetCursorPos(int x, int y);

  [StructLayout(LayoutKind.Sequential)]
  private struct POINT {
    public int X;
    public int Y;
  }

  [DllImport("user32.dll")]
  private static extern bool GetCursorPos(out POINT lpPoint);

  [DllImport("user32.dll")]
  private static extern int GetSystemMetrics(int nIndex);

  [DllImport("user32.dll")]
  private static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, UIntPtr dwExtraInfo);

  [DllImport("user32.dll")]
  private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

  [StructLayout(LayoutKind.Sequential)]
  private struct KEYBDINPUT {
    public ushort wVk;
    public ushort wScan;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct INPUT {
    public uint type;
    public KEYBDINPUT ki;
  }

  [DllImport("user32.dll", SetLastError = true)]
  private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

  private const uint INPUT_KEYBOARD = 1;
  private const uint KEYEVENTF_UNICODE = 0x0004;
  private const uint KEYEVENTF_KEYUP = 0x0002;

  private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  private const uint MOUSEEVENTF_LEFTUP = 0x0004;
  private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
  private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
  private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
  private const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
  private const uint MOUSEEVENTF_WHEEL = 0x0800;
  private const uint MOUSEEVENTF_HWHEEL = 0x1000;

  private const int SM_CXVIRTUALSCREEN = 78;
  private const int SM_CYVIRTUALSCREEN = 79;
  private const int SM_XVIRTUALSCREEN = 76;
  private const int SM_YVIRTUALSCREEN = 77;

  public static void MoveTo(int x, int y) {
    SetCursorPos(x, y);
  }

  // Trackpad-style relative move: adds (dx, dy) to the current cursor
  // position instead of jumping to an absolute point, and clamps to the
  // virtual screen bounds (covers multi-monitor setups too) so the cursor
  // can't be pushed off-screen.
  public static void MoveBy(int dx, int dy) {
    POINT p;
    if (!GetCursorPos(out p)) return;

    int minX = GetSystemMetrics(SM_XVIRTUALSCREEN);
    int minY = GetSystemMetrics(SM_YVIRTUALSCREEN);
    int maxX = minX + GetSystemMetrics(SM_CXVIRTUALSCREEN) - 1;
    int maxY = minY + GetSystemMetrics(SM_CYVIRTUALSCREEN) - 1;

    int newX = p.X + dx;
    int newY = p.Y + dy;
    if (newX < minX) newX = minX;
    if (newX > maxX) newX = maxX;
    if (newY < minY) newY = minY;
    if (newY > maxY) newY = maxY;

    SetCursorPos(newX, newY);
  }

  public static void MouseDown(string button) {
    if (button == "right") mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
    else if (button == "middle") mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, UIntPtr.Zero);
    else mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
  }

  public static void MouseUp(string button) {
    if (button == "right") mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
    else if (button == "middle") mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, UIntPtr.Zero);
    else mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
  }

  public static void Click(string button) {
    MouseDown(button);
    Thread.Sleep(15);
    MouseUp(button);
  }

  public static void DoubleClick(string button) {
    Click(button);
    Thread.Sleep(60);
    Click(button);
  }

  public static void Scroll(int deltaY, int deltaX) {
    if (deltaY != 0) mouse_event(MOUSEEVENTF_WHEEL, 0, 0, deltaY, UIntPtr.Zero);
    if (deltaX != 0) mouse_event(MOUSEEVENTF_HWHEEL, 0, 0, deltaX, UIntPtr.Zero);
  }

  public static void TypeChar(char c) {
    INPUT[] inputs = new INPUT[2];

    inputs[0].type = INPUT_KEYBOARD;
    inputs[0].ki.wVk = 0;
    inputs[0].ki.wScan = (ushort)c;
    inputs[0].ki.dwFlags = KEYEVENTF_UNICODE;
    inputs[0].ki.time = 0;
    inputs[0].ki.dwExtraInfo = IntPtr.Zero;

    inputs[1].type = INPUT_KEYBOARD;
    inputs[1].ki.wVk = 0;
    inputs[1].ki.wScan = (ushort)c;
    inputs[1].ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
    inputs[1].ki.time = 0;
    inputs[1].ki.dwExtraInfo = IntPtr.Zero;

    SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
  }

  public static void TypeText(string text) {
    foreach (char c in text) {
      TypeChar(c);
    }
  }

  public static void PressKey(byte vk) {
    keybd_event(vk, 0, 0, UIntPtr.Zero);
    Thread.Sleep(10);
    keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
  }
}
"@

$keyMap = @{
  'Enter'      = 0x0D
  'Backspace'  = 0x08
  'Tab'        = 0x09
  'Escape'     = 0x1B
  'ArrowLeft'  = 0x25
  'ArrowUp'    = 0x26
  'ArrowRight' = 0x27
  'ArrowDown'  = 0x28
  'Delete'     = 0x2E
  'Home'       = 0x24
  'End'        = 0x23
  'Space'      = 0x20
  'PageUp'     = 0x21
  'PageDown'   = 0x22
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ($line.Trim().Length -eq 0) { continue }

  try {
    $cmd = $line | ConvertFrom-Json

    switch ($cmd.type) {
      'move' {
        [InputHost]::MoveTo([int]$cmd.x, [int]$cmd.y)
      }
      'moveRelative' {
        [InputHost]::MoveBy([int]$cmd.dx, [int]$cmd.dy)
      }
      'down' {
        [InputHost]::MouseDown([string]$cmd.button)
      }
      'up' {
        [InputHost]::MouseUp([string]$cmd.button)
      }
      'click' {
        [InputHost]::Click([string]$cmd.button)
      }
      'doubleclick' {
        [InputHost]::DoubleClick([string]$cmd.button)
      }
      'scroll' {
        [InputHost]::Scroll([int]$cmd.deltaY, [int]$cmd.deltaX)
      }
      'text' {
        [InputHost]::TypeText([string]$cmd.text)
      }
      'key' {
        if ($keyMap.ContainsKey([string]$cmd.key)) {
          [InputHost]::PressKey([byte]$keyMap[[string]$cmd.key])
        }
      }
    }
  }
  catch {
  }
}
