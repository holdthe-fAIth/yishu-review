# Build Android APK with the portable toolchain in .tools (no system-wide JDK/SDK needed).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$jdk = Join-Path $root '.tools\jdk\jdk-17.0.13+11'
$sdk = Join-Path $root '.tools\android-sdk'
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version

if (-not (Test-Path $jdk)) { throw "Missing JDK: $jdk (see README 'APK' section)" }
if (-not (Test-Path $sdk)) { throw "Missing Android SDK: $sdk (see README 'APK' section)" }

$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path = "$jdk\bin;" + $env:Path

Push-Location $root
try {
    Write-Host '== 1/3 Build web assets (vite build) =='
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm build
    } elseif (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
        & npm.cmd run build
    } else {
        & node scripts/copy-data.mjs
        & node node_modules\typescript\bin\tsc --noEmit
        & node node_modules\vite\bin\vite.js build
    }
    if ($LASTEXITCODE -ne 0) { throw 'vite build failed' }

    Write-Host '== 2/3 Sync to Android project (cap sync) =='
    & node_modules\.bin\cap.cmd sync android
    if ($LASTEXITCODE -ne 0) { throw 'cap sync failed' }

    Write-Host '== 3/3 Build debug APK (gradle assembleDebug) =='
    Push-Location (Join-Path $root 'android')
    try {
        & .\gradlew.bat assembleDebug --no-daemon --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'gradle assembleDebug failed' }
    }
    finally { Pop-Location }

    $apk = Join-Path $root 'android\app\build\outputs\apk\debug\app-debug.apk'
    if (-not (Test-Path $apk)) { throw "APK not found: $apk" }
    $out = Join-Path $root "yishu-review-$version-debug.apk"
    Copy-Item $apk $out -Force
    Write-Host ''
    Write-Host "APK generated: $out"
    Write-Host "Size: $([math]::Round((Get-Item $out).Length / 1MB, 1)) MB"
    Write-Host 'Install: send the APK to your phone via WeChat/QQ, tap it, allow "unknown sources".'
}
finally { Pop-Location }
