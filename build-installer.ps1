# Build self-extracting HTML installer for internal-network deployment.
#
# Output: docs/extension-installer.html (single file, ~50KB)
#
# How it works:
#   - Reads each extension file as bytes -> base64 encode -> embeds in HTML template
#   - User transfers the single HTML to internal network (no .js/.json transfer needed)
#   - Opens in Edge -> click button -> File System Access API writes files locally
#
# Korean content lives in templates/installer.html (UTF-8) to avoid PS 5.1 encoding issues.
# This .ps1 stays ASCII-only.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

$extensionFiles = @(
    "manifest.json",
    "popup.html",
    "popup.js",
    "options.html",
    "options.js",
    "background.js",
    "icons/icon16.png",
    "icons/icon48.png",
    "icons/icon128.png"
)

Write-Host "[installer 1/3] Reading files & encoding base64..."
$entries = @()
foreach ($rel in $extensionFiles) {
    $path = Join-Path $root ($rel -replace "/", "\")
    if (-not (Test-Path $path)) {
        Write-Warning "  Not found: $rel (skipped)"
        continue
    }
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $b64 = [Convert]::ToBase64String($bytes)
    $entries += [ordered]@{
        path = $rel
        b64  = $b64
        size = $bytes.Length
    }
}
$filesJson = ConvertTo-Json $entries -Compress -Depth 5

Write-Host "[installer 2/3] Reading manifest metadata (UTF-8)..."
$manifestText = [System.IO.File]::ReadAllText((Join-Path $root "manifest.json"), $utf8NoBom)
$manifest = $manifestText | ConvertFrom-Json
$name    = $manifest.name
$version = $manifest.version

Write-Host "[installer 3/3] Rendering HTML template..."
$tplPath = Join-Path $root "templates\installer.html"
$tpl = [System.IO.File]::ReadAllText($tplPath, $utf8NoBom)

$html = $tpl
$html = $html.Replace("{{NAME}}", $name)
$html = $html.Replace("{{VERSION}}", $version)
$html = $html.Replace("{{FILE_COUNT}}", $entries.Count.ToString())
$html = $html.Replace("{{FILES_JSON}}", $filesJson)

$dest = Join-Path $root "docs\extension-installer.html"
[System.IO.File]::WriteAllText($dest, $html, $utf8NoBom)

$size = (Get-Item $dest).Length
Write-Host ""
Write-Host "  installer: $dest ($([math]::Round($size/1KB, 1)) KB)"
