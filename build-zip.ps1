# Chrome Extension zip 빌드 — docs/chrome-extension.zip 생성
# 동료가 Vercel 페이지에서 받을 zip 파일.
# 매번 코드 변경 후 deploy 전에 실행.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $root "docs\chrome-extension.zip"
$work = Join-Path $env:TEMP "chrome-extension-build"

# Extension에 포함할 파일 (docs/, .git/, README, build script 등 제외)
$include = @(
    "manifest.json",
    "popup.html",
    "popup.js",
    "background.js",
    "icons"
)

Write-Host "[1/3] Cleaning work dir..."
if (Test-Path $work) { Remove-Item -Recurse -Force $work }
New-Item -ItemType Directory -Path $work | Out-Null

Write-Host "[2/3] Copying extension files..."
foreach ($item in $include) {
    $src = Join-Path $root $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $work -Recurse
    } else {
        Write-Warning "Not found: $item (skipped)"
    }
}

Write-Host "[3/3] Creating zip..."
if (Test-Path $dest) { Remove-Item $dest }
Compress-Archive -Path "$work\*" -DestinationPath $dest -Force

$size = (Get-Item $dest).Length
Write-Host ""
Write-Host "============================================================"
Write-Host "  Built: $dest"
Write-Host "  Size:  $([math]::Round($size/1KB, 1)) KB"
Write-Host ""
Write-Host "  Next: vercel --prod (or git add docs/chrome-extension.zip; git push)"
Write-Host "============================================================"

Remove-Item -Recurse -Force $work
