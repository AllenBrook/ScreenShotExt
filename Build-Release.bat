@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

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
call pnpm build
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

if not exist "release" mkdir "release"
set "OUT_ZIP=%cd%\release\openscreenshot-v%APP_VER%.zip"
if exist "%OUT_ZIP%" del /f /q "%OUT_ZIP%"

echo === [5/5] Pack to release\openscreenshot-v%APP_VER%.zip ===
powershell -NoProfile -Command "Compress-Archive -Path (Join-Path '%cd%' 'dist\*') -DestinationPath '%OUT_ZIP%' -Force"
if errorlevel 1 (
  echo ERROR: zip failed.
  exit /b 1
)

echo.
echo DONE: %OUT_ZIP%
exit /b 0
