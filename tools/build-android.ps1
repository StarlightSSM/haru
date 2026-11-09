# Builds the Android APK (works for phones and Samsung tablets).
# Usage: powershell -ExecutionPolicy Bypass -File tools\build-android.ps1 [-Release]
param([switch]$Release)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$jdk = Get-ChildItem "$env:LOCALAPPDATA\haru-build" -Directory -Filter 'jdk-21*' | Select-Object -First 1
if (-not $jdk) { throw 'JDK 21 not found in %LOCALAPPDATA%\haru-build' }
$env:JAVA_HOME = $jdk.FullName
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$($jdk.FullName)\bin;$env:Path"
# use Windows certificate store (works behind TLS-inspecting proxies)
$env:GRADLE_OPTS = '-Djavax.net.ssl.trustStoreType=Windows-ROOT'
$env:JAVA_TOOL_OPTIONS = '-Djavax.net.ssl.trustStoreType=Windows-ROOT'
Set-Location $root
node tools/build-web.js
npx cap sync android
"sdk.dir=$($env:ANDROID_HOME -replace '\\','\\')" | Set-Content -Encoding ascii android\local.properties
Set-Location android
if ($Release) { .\gradlew.bat assembleRelease --no-daemon } else { .\gradlew.bat assembleDebug --no-daemon }
