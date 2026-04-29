# Chrome/Edge Extension 빌드
#
# 산출물 두 가지:
#   1) extension/                  — 사내망 반입용 (압축해제된 확장 로드 대상, .gitignore)
#   2) docs/chrome-extension.zip   — Vercel 페이지에서 동료가 받을 zip
#
# 매번 코드 변경 후 실행. 둘 다 항상 최신 동기화 유지.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $root "docs\chrome-extension.zip"
$ext  = Join-Path $root "extension"

# Extension에 포함할 파일 (docs/, .git/, README, build script 등 제외)
$include = @(
    "manifest.json",
    "popup.html",
    "popup.js",
    "options.html",
    "options.js",
    "background.js",
    "icons"
)

Write-Host "[1/3] Resetting extension/ folder (사내망 반입용)..."
if (Test-Path $ext) { Remove-Item -Recurse -Force $ext }
New-Item -ItemType Directory -Path $ext | Out-Null

Write-Host "[2/3] Copying extension files..."
foreach ($item in $include) {
    $src = Join-Path $root $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $ext -Recurse
    } else {
        Write-Warning "Not found: $item (skipped)"
    }
}

Write-Host "[3/3] Creating zip (Vercel 배포용)..."
if (Test-Path $dest) { Remove-Item $dest }
Compress-Archive -Path "$ext\*" -DestinationPath $dest -Force

$size = (Get-Item $dest).Length

# 사내망 반입용 HTML 자가설치 파일도 함께 생성
& (Join-Path $root "build-installer.ps1")

Write-Host ""
Write-Host "============================================================"
Write-Host "  로컬 테스트     : $ext (압축해제된 확장으로 로드)"
Write-Host "  외부망 zip     : $dest ($([math]::Round($size/1KB, 1)) KB)"
Write-Host "  사내망 installer: docs\extension-installer.html"
Write-Host ""
Write-Host "  Next: vercel --prod (or git add docs/; git push)"
Write-Host "============================================================"
