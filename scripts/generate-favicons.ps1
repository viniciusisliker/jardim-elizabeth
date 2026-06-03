Add-Type -AssemblyName System.Drawing

function New-JeIconBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

  $pad = [Math]::Max(2, [int]($size * 0.06))
  $rect = New-Object System.Drawing.RectangleF ($pad), ($pad), ($size - 2 * $pad), ($size - 2 * $pad)
  $radius = [Math]::Max(4, [int]($size * 0.22))

  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, `
    ([System.Drawing.Color]::FromArgb(255, 10, 40, 71)), `
    ([System.Drawing.Color]::FromArgb(255, 26, 74, 122)), `
    135
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
  $path.AddArc($rect.Right - $radius, $rect.Y, $radius, $radius, 270, 90)
  $path.AddArc($rect.Right - $radius, $rect.Bottom - $radius, $radius, $radius, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $radius, $radius, $radius, 90, 90)
  $path.CloseFigure()
  $g.FillPath($bgBrush, $path)

  $ringPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(96, 200, 169, 110)), ([Math]::Max(1, $size / 64.0))
  $g.DrawPath($ringPen, $path)

  $goldBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, `
    ([System.Drawing.Color]::FromArgb(255, 242, 230, 204)), `
    ([System.Drawing.Color]::FromArgb(255, 200, 169, 110)), `
    45
  $fontSize = [Math]::Max(8, $size * 0.34)
  $font = New-Object System.Drawing.Font('Georgia', $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel))
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textRect = New-Object System.Drawing.RectangleF 0, ($size * 0.04), $size, ($size * 0.92)
  $g.DrawString('JE', $font, $goldBrush, $textRect, $format)

  $font.Dispose()
  $goldBrush.Dispose()
  $ringPen.Dispose()
  $bgBrush.Dispose()
  $path.Dispose()
  $g.Dispose()
  return $bmp
}

$root = Split-Path -Parent $PSScriptRoot
$imgDir = Join-Path $root 'img'
$exports = @(
  @{ Size = 32; Name = 'favicon-32.png' },
  @{ Size = 180; Name = 'favicon-180.png' },
  @{ Size = 512; Name = 'favicon.png' }
)

foreach ($item in $exports) {
  $bmp = New-JeIconBitmap $item.Size
  $out = Join-Path $imgDir $item.Name
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Copy-Item $out (Join-Path $root 'favicon.png') -Force
}

Write-Host 'Favicons generated.'
