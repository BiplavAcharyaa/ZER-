<#
  media-keys.ps1
  Sends a virtual media-key press (play/pause, next, previous, stop)
  using the Win32 keybd_event API. This works system-wide regardless
  of which application currently has focus, the same way a physical
  keyboard's media keys behave.

  Usage:
    media-keys.ps1 -Action playpause
    media-keys.ps1 -Action next
    media-keys.ps1 -Action previous
    media-keys.ps1 -Action stop

  Prints { "ok": true, "action": "<action>" } to stdout on success.
#>

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('playpause', 'next', 'previous', 'stop')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'

try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class MediaKeySender {
  [DllImport("user32.dll")]
  private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

  private const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
  private const uint KEYEVENTF_KEYUP = 0x0002;

  public static void Press(byte virtualKeyCode) {
    keybd_event(virtualKeyCode, 0, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
    keybd_event(virtualKeyCode, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
  }
}
"@

  # Virtual key codes for media keys.
  $vkPlayPause = 0xB3
  $vkNextTrack = 0xB0
  $vkPrevTrack = 0xB1
  $vkStop      = 0xB2

  switch ($Action) {
    'playpause' { [MediaKeySender]::Press($vkPlayPause) }
    'next'      { [MediaKeySender]::Press($vkNextTrack) }
    'previous'  { [MediaKeySender]::Press($vkPrevTrack) }
    'stop'      { [MediaKeySender]::Press($vkStop) }
  }

  $result = [PSCustomObject]@{
    ok     = $true
    action = $Action
  }

  $result | ConvertTo-Json -Compress
  exit 0
}
catch {
  [Console]::Error.WriteLine("media-keys failed: $($_.Exception.Message)")
  exit 1
}
