# 다운로드 박스 아이콘을 PowerShell + System.Drawing으로 직접 그려 PNG 생성
# icons/icon{16,48,128}.png 출력

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$iconsDir = Join-Path $root "icons"
if (-not (Test-Path $iconsDir)) { New-Item -ItemType Directory -Path $iconsDir | Out-Null }

function New-DownloadIcon {
    param([int]$Size)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $sc = $Size / 128.0  # 128 기준 좌표를 실제 크기로 스케일

    $red       = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 57, 70))
    $skyBlue   = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(122, 199, 232))
    $deepBlue  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(25, 118, 210))
    $blackPen  = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, [Math]::Max(1, $Size / 64.0))

    # 빨간 화살표 자루 (rect)
    $g.FillRectangle($red, [int](56*$sc), [int](14*$sc), [int](16*$sc), [int](40*$sc))
    $g.DrawRectangle($blackPen, [int](56*$sc), [int](14*$sc), [int](16*$sc), [int](40*$sc))

    # 빨간 화살표 머리 (triangle)
    $arrowPts = @(
        (New-Object System.Drawing.Point([int](44*$sc), [int](52*$sc))),
        (New-Object System.Drawing.Point([int](84*$sc), [int](52*$sc))),
        (New-Object System.Drawing.Point([int](64*$sc), [int](76*$sc)))
    )
    $g.FillPolygon($red, [System.Drawing.Point[]]$arrowPts)
    $g.DrawPolygon($blackPen, [System.Drawing.Point[]]$arrowPts)

    # 파란 트레이 (trapezoid)
    $trayPts = @(
        (New-Object System.Drawing.Point([int](14*$sc),  [int](78*$sc))),
        (New-Object System.Drawing.Point([int](114*$sc), [int](78*$sc))),
        (New-Object System.Drawing.Point([int](102*$sc), [int](116*$sc))),
        (New-Object System.Drawing.Point([int](26*$sc),  [int](116*$sc)))
    )
    $g.FillPolygon($skyBlue, [System.Drawing.Point[]]$trayPts)
    $g.DrawPolygon($blackPen, [System.Drawing.Point[]]$trayPts)

    # 트레이 위 파란 점
    $g.FillEllipse($deepBlue, [int](57*$sc), [int](89*$sc), [int](14*$sc), [int](14*$sc))
    $g.DrawEllipse($blackPen, [int](57*$sc), [int](89*$sc), [int](14*$sc), [int](14*$sc))

    $g.Dispose()
    return $bmp
}

foreach ($size in 16, 48, 128) {
    $out = Join-Path $iconsDir "icon$size.png"
    $bmp = New-DownloadIcon -Size $size
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "  Built: icons/icon$size.png ($size x $size)"
}

Write-Host ""
Write-Host "Done."
