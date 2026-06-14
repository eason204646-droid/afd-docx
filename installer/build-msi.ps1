<#
.SYNOPSIS
  Builds the AFD CLI MSI installer using WiX Toolset.
  Prerequisites: WiX Toolset in PATH (candle.exe, heat.exe, light.exe)
#>

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$cli = Join-Path $root "..\cli"
$files = Join-Path $root "files"

# Verify WiX
foreach ($exe in @("candle.exe", "heat.exe", "light.exe")) {
  if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) {
    throw "$exe not found in PATH. Install WiX Toolset first."
  }
}
Write-Host "WiX Toolset found" -ForegroundColor Green

# Step 1: Build TypeScript
Write-Host "Building TypeScript..." -ForegroundColor Cyan
Push-Location $cli
npm run build
if (-not $?) { throw "TypeScript build failed" }

# Step 2: Production install
Write-Host "Installing production dependencies..." -ForegroundColor Cyan
Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
npm install --production
if (-not $?) { throw "npm install failed" }
Pop-Location

# Step 3: Copy files to installer
Write-Host "Copying files..." -ForegroundColor Cyan
Remove-Item -Recurse -Force "$files\dist" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$files\node_modules" -ErrorAction SilentlyContinue
Copy-Item -Recurse "$cli\dist" $files -Force
Copy-Item -Recurse "$cli\node_modules" $files -Force

# Step 4: Harvest with Heat
Write-Host "Harvesting files..." -ForegroundColor Cyan
Push-Location $root
heat dir "$files\dist" -cg DistFiles -dr DISTDIR -srd -sfrag -template:fragment -out "dist-files.wxs" -var "var.SourceDir"
if (-not $?) { throw "Heat dist harvest failed" }
heat dir "$files\node_modules" -cg NodeModulesFiles -dr NODEMODULESDIR -srd -sfrag -template:fragment -out "node_modules-files.wxs" -var "var.SourceDir" -ag
if (-not $?) { throw "Heat node_modules harvest failed" }

# Step 5: Compile with Candle
Write-Host "Compiling..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "obj" | Out-Null
candle -arch x64 -dSourceDir="$files" "afd.wxs" "dist-files.wxs" "node_modules-files.wxs" -out "obj\"
if (-not $?) { throw "Candle compilation failed" }

# Step 6: Link with Light
Write-Host "Linking..." -ForegroundColor Cyan
light "obj\*.wixobj" -out "AFD.msi"
if (-not $?) { throw "Light linking failed" }

Pop-Location

Write-Host "`nDone: $root\AFD.msi" -ForegroundColor Green
