$ErrorActionPreference = 'Stop'

try {
  Add-Type -AssemblyName System.Windows.Forms

  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds

  $result = [PSCustomObject]@{
    width  = [int]$bounds.Width
    height = [int]$bounds.Height
  }

  $result | ConvertTo-Json -Compress
  exit 0
}
catch {
  [Console]::Error.WriteLine("screen-info failed: $($_.Exception.Message)")
  exit 1
}
