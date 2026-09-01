<#
  audio-control.ps1
  Controls / reads the default Windows audio endpoint (system volume + mute)
  using the Core Audio API via a small inline C# helper class.

  Usage:
    audio-control.ps1 -Action get
    audio-control.ps1 -Action set   -Value 50
    audio-control.ps1 -Action up    -Value 5
    audio-control.ps1 -Action down  -Value 5
    audio-control.ps1 -Action mute
    audio-control.ps1 -Action unmute

  Always prints a single-line JSON object to stdout:
    { "volume": 42, "muted": false }
  On failure, writes an error message to stderr and exits with code 1.
#>

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('get', 'set', 'up', 'down', 'mute', 'unmute')]
  [string]$Action,

  [int]$Value = 5
)

$ErrorActionPreference = 'Stop'

try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolume {
  int NotImpl1();
  int NotImpl2();
  int GetChannelCount(out int count);
  int SetMasterVolumeLevel(float level, Guid ctx);
  int SetMasterVolumeLevelScalar(float level, Guid ctx);
  int GetMasterVolumeLevel(out float level);
  int GetMasterVolumeLevelScalar(out float level);
  int SetChannelVolumeLevel(uint channel, float level, Guid ctx);
  int SetChannelVolumeLevelScalar(uint channel, float level, Guid ctx);
  int GetChannelVolumeLevel(uint channel, out float level);
  int GetChannelVolumeLevelScalar(uint channel, out float level);
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, Guid ctx);
  int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
  int GetVolumeStepInfo(out uint step, out uint stepCount);
  int VolumeStepUp(Guid ctx);
  int VolumeStepDown(Guid ctx);
  int QueryHardwareSupport(out uint mask);
  int GetVolumeRange(out float min, out float max, out float increment);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
  int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, out IAudioEndpointVolume endpointVolume);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
  int NotImpl1();
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorComObject { }

public static class AudioControl {
  private static IAudioEndpointVolume GetEndpointVolume() {
    var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
    IMMDevice device;
    // eRender = 0, eMultimedia = 1
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));

    IAudioEndpointVolume epv;
    Guid iid = typeof(IAudioEndpointVolume).GUID;
    // CLSCTX_ALL = 23
    Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23, IntPtr.Zero, out epv));
    return epv;
  }

  public static float GetVolume() {
    float level;
    Marshal.ThrowExceptionForHR(GetEndpointVolume().GetMasterVolumeLevelScalar(out level));
    return level * 100f;
  }

  public static void SetVolume(float percent) {
    if (percent < 0f) percent = 0f;
    if (percent > 100f) percent = 100f;
    Marshal.ThrowExceptionForHR(GetEndpointVolume().SetMasterVolumeLevelScalar(percent / 100f, Guid.Empty));
  }

  public static bool GetMute() {
    bool muted;
    Marshal.ThrowExceptionForHR(GetEndpointVolume().GetMute(out muted));
    return muted;
  }

  public static void SetMute(bool mute) {
    Marshal.ThrowExceptionForHR(GetEndpointVolume().SetMute(mute, Guid.Empty));
  }
}
"@

  switch ($Action) {
    'get' {
      # no-op, just report current state below
    }
    'set' {
      [AudioControl]::SetVolume([float]$Value)
    }
    'up' {
      $current = [AudioControl]::GetVolume()
      [AudioControl]::SetVolume($current + $Value)
    }
    'down' {
      $current = [AudioControl]::GetVolume()
      [AudioControl]::SetVolume($current - $Value)
    }
    'mute' {
      [AudioControl]::SetMute($true)
    }
    'unmute' {
      [AudioControl]::SetMute($false)
    }
  }

  $volume = [Math]::Round([AudioControl]::GetVolume())
  $muted = [AudioControl]::GetMute()

  $result = [PSCustomObject]@{
    volume = [int]$volume
    muted  = [bool]$muted
  }

  $result | ConvertTo-Json -Compress
  exit 0
}
catch {
  [Console]::Error.WriteLine("audio-control failed: $($_.Exception.Message)")
  exit 1
}
