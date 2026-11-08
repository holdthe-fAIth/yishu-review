# 一键打 Android APK（使用项目内 .tools 工具链，不需要系统级安装 JDK/SDK）
# 用法：powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$jdk = Join-Path $root '.tools\jdk\jdk-17.0.13+11'
$sdk = Join-Path $root '.tools\android-sdk'

if (-not (Test-Path $jdk)) { throw "缺少 JDK：$jdk（见 README「方案 D」）" }
if (-not (Test-Path $sdk)) { throw "缺少 Android SDK：$sdk（见 README「方案 D」）" }

$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path = "$jdk\bin;" + $env:Path

Push-Location $root
try {
    Write-Host '== 1/3 构建 Web 产物 (vite build) =='
    if (Get-Command pnpm -ErrorAction SilentlyContinue) { pnpm build } else { npm run build }
    if ($LASTEXITCODE -ne 0) { throw 'vite build 失败' }

    Write-Host '== 2/3 同步到 Android 工程 (cap sync) =='
    & node_modules\.bin\cap.cmd sync android
    if ($LASTEXITCODE -ne 0) { throw 'cap sync 失败' }

    Write-Host '== 3/3 Gradle 打包 debug APK =='
    Push-Location (Join-Path $root 'android')
    try {
        & .\gradlew.bat assembleDebug --no-daemon --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'gradle assembleDebug 失败' }
    }
    finally { Pop-Location }

    $apk = Join-Path $root 'android\app\build\outputs\apk\debug\app-debug.apk'
    if (-not (Test-Path $apk)) { throw "未找到 APK：$apk" }
    $out = Join-Path $root 'yishu-review-1.0.0-debug.apk'
    Copy-Item $apk $out -Force
    Write-Host ''
    Write-Host "APK 已生成：$out"
    Write-Host "大小：$([math]::Round((Get-Item $out).Length / 1MB, 1)) MB"
    Write-Host '安装：微信/QQ 传到手机 → 点开 → 允许「未知来源」安装'
}
finally { Pop-Location }
