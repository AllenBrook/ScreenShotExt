@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

REM Windows sideload packer for GitHub Release (v2.5.2.3+).
REM Same payload as `pnpm package`: dist/ contents, manifest.json at zip root.
REM Version is always read from package.json (do not hardcode).

echo === OpenScreenShot Build-Release ===
echo CWD: %cd%

echo === [1/5] Update to latest ===
git pull --ff-only
if errorlevel 1 (
  echo ERROR: git pull failed.
  exit /b 1
)

echo === [2/5] Install deps ===
call pnpm install --frozen-lockfile
if errorlevel 1 (
  echo ERROR: pnpm install failed. Need pnpm@10.33.0 matching packageManager.
  exit /b 1
)

echo === [3/5] Generate icons ===
call pnpm run icons
if errorlevel 1 (
  echo ERROR: icons failed.
  exit /b 1
)

echo === [4/5] Build ===
call pnpm run build
if errorlevel 1 (
  echo ERROR: build failed.
  exit /b 1
)

if not exist "dist\manifest.json" (
  echo ERROR: dist\manifest.json missing after build.
  exit /b 1
)

for /f "usebackq delims=" %%V in (`node -p "require('./package.json').version"`) do set "APP_VER=%%V"
if not defined APP_VER (
  echo ERROR: could not read version from package.json
  exit /b 1
)

for /f "usebackq delims=" %%M in (`node -p "require('./dist/manifest.json').version"`) do set "DIST_VER=%%M"
if not "%APP_VER%"=="%DIST_VER%" (
  echo ERROR: package.json version %APP_VER% != dist\manifest.json %DIST_VER%
  exit /b 1
)

if not exist "release" mkdir "release"
set "OUT_ZIP=%cd%\release\openscreenshot-v%APP_VER%.zip"
if exist "%OUT_ZIP%" del /f /q "%OUT_ZIP%"

echo === [5/5] Pack dist\ to release\openscreenshot-v%APP_VER%.zip ===
REM Compress from inside dist so the zip root is the extension (manifest.json).
powershell -NoProfile -Command "Set-Location -LiteralPath (Join-Path '%cd%' 'dist'); Compress-Archive -Path * -DestinationPath '%OUT_ZIP%' -Force"
if errorlevel 1 (
  echo ERROR: zip failed.
  exit /b 1
)

echo.
echo DONE: %OUT_ZIP%
echo Version: %APP_VER%
echo.
echo Edge install:
echo   1. Unzip. Zip root must contain manifest.json.
echo   2. edge://extensions/ - Developer mode - Load unpacked.
echo   3. Confirm version %APP_VER%. Turn off the store copy.
echo.
echo 安装: 解压后根目录有 manifest.json；开发人员模式 - 加载解压的扩展；确认版本 %APP_VER%。
exit /b 0
