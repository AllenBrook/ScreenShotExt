@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

REM Windows sideload packer for GitHub Release (v2.5.2.4+).
REM Same payload as `pnpm package`: Chromium-safe zip (forward-slash entries,
REM manifest.json at the zip root). Version is always read from package.json.
REM
REM Do NOT use PowerShell Compress-Archive. It stores backslash paths, and
REM Chromium/Edge then treat `_locales\ar\messages.json` as the illegal
REM filename `_localesarmessages.json` ("Filenames starting with '_' are
REM reserved for use by the system").
REM
REM Edge install: Load unpacked on the EXTRACTED folder. Never drag the zip
REM onto edge://extensions/ if that flattens paths. After unzip, this nested
REM file must exist as folders:  _locales\ar\messages.json
REM (NOT a single file named _localesarmessages.json).

echo === openscreenshotExt Build-Release ===
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

echo === [4/5] Package (build + Chromium-safe zip) ===
call pnpm package
if errorlevel 1 (
  echo ERROR: pnpm package failed.
  exit /b 1
)

if not exist "dist\manifest.json" (
  echo ERROR: dist\manifest.json missing after package.
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

set "ROOT_ZIP=%cd%\openscreenshotExt-v%APP_VER%.zip"
if not exist "%ROOT_ZIP%" (
  echo ERROR: expected %ROOT_ZIP% after pnpm package.
  exit /b 1
)

if not exist "release" mkdir "release"
set "OUT_ZIP=%cd%\release\openscreenshotExt-v%APP_VER%.zip"
copy /y "%ROOT_ZIP%" "%OUT_ZIP%" >nul
if errorlevel 1 (
  echo ERROR: could not copy zip to release\
  exit /b 1
)

echo === [5/5] Verify zip paths are Chromium-safe ===
call node scripts\write-extension-zip.mjs --verify "%OUT_ZIP%"
if errorlevel 1 (
  echo ERROR: zip failed Chromium path check. Do not ship this archive.
  exit /b 1
)

where tar >nul 2>&1
if not errorlevel 1 (
  tar -tf "%OUT_ZIP%" | findstr /C:"_locales/ar/messages.json" >nul
  if errorlevel 1 (
    echo ERROR: tar listing is missing _locales/ar/messages.json
    exit /b 1
  )
  tar -tf "%OUT_ZIP%" | findstr /C:"_localesarmessages.json" >nul
  if not errorlevel 1 (
    echo ERROR: tar listing has flattened _localesarmessages.json
    exit /b 1
  )
)

echo.
echo DONE: %OUT_ZIP%
echo Also: %ROOT_ZIP%
echo Version: %APP_VER%
echo.
echo Edge install:
echo   1. Unzip. Zip root must contain manifest.json.
echo   2. Confirm nested file: _locales\ar\messages.json
echo   3. edge://extensions/ - Developer mode - Load unpacked - choose the folder.
echo   4. Confirm version %APP_VER% and name openscreenshotExt. Turn off the store copy.
echo.
echo 安装: 解压后根目录有 manifest.json，且存在 _locales\ar\messages.json 嵌套路径；
echo 开发人员模式 - 加载解压的扩展（不要把 zip 拖到扩展页）；确认版本 %APP_VER%。
exit /b 0
