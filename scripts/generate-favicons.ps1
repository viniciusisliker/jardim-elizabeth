Add-Type -AssemblyName System.Drawing

function Export-ResizedIcon([string]$sourcePath, [int]$size, [string]$destPath) {
  $src = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $g.DrawImage($src, 0, 0, $size, $size)
    $g.Dispose()
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  } finally {
    $src.Dispose()
  }
}

$root = Split-Path -Parent $PSScriptRoot
$imgDir = Join-Path $root 'img'
$source = Join-Path $imgDir 'icon.png'

if (-not (Test-Path $source)) {
  Write-Error "Source icon not found: $source"
  exit 1
}

$exports = @(
  @{ Size = 32; Name = 'favicon-32.png' },
  @{ Size = 180; Name = 'favicon-180.png' },
  @{ Size = 512; Name = 'favicon.png' }
)

foreach ($item in $exports) {
  $out = Join-Path $imgDir $item.Name
  Export-ResizedIcon $source $item.Size $out
  if ($item.Name -eq 'favicon.png') {
    Copy-Item $out (Join-Path $root 'favicon.png') -Force
  }
}

Write-Host 'Favicons generated from img/icon.png.'
