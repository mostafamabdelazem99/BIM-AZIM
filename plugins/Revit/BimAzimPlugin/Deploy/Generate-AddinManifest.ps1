# Writes a per-Revit-year .addin manifest for the BIM-AZIM plugin into
# %ProgramData%\Autodesk\Revit\Addins\<year>, pointing at that year's build band.
#
# Ported/rebranded equivalent of the addin-writing step in BIM-Bot's
# deploy.ps1 / Install-NonAdmin.ps1 / installer\setup.iss /
# installer\RevitMCPInstaller\InstallerLogic.cs. Full installer/uninstaller
# porting (Inno Setup script, non-admin installer, GUI installer project) is
# out of scope for this pass; this script only reproduces the manifest-writing
# step itself, using BimAzim.addin.template in this folder as the source of
# truth for VendorId/VendorDescription/ClientId.
#
# Usage:  .\Generate-AddinManifest.ps1 -Year 2024 -Configuration Release
# Build first:  dotnet build -p:RevitVersion=2024 ..\BimAzimPlugin.csproj

param(
    [Parameter(Mandatory = $true)][int]$Year,
    [string]$Configuration = "Release"
)

$bandTfm = @{
    2020 = 'net47'; 2021 = 'net48'; 2022 = 'net48'; 2023 = 'net48'
    2024 = 'net48'; 2025 = 'net8.0-windows'; 2026 = 'net8.0-windows'; 2027 = 'net10.0-windows'
}
if (-not $bandTfm.ContainsKey($Year)) {
    throw "No build band defined for Revit $Year. Valid years: $($bandTfm.Keys -join ', ')"
}

$projectDir = Split-Path -Parent $PSScriptRoot
$dllPath = Join-Path $projectDir "bin\R$Year\$Configuration\$($bandTfm[$Year])\BimAzimPlugin.dll"

if (-not (Test-Path $dllPath)) {
    Write-Warning "Not built yet: $dllPath"
    Write-Warning "Run: dotnet build -c $Configuration -p:RevitVersion=$Year `"$projectDir\BimAzimPlugin.csproj`""
}

$templatePath = Join-Path $PSScriptRoot "BimAzim.addin.template"
$content = Get-Content -Raw $templatePath
# Strip the leading XML-comment block (documentation only, not part of the manifest Revit reads).
$content = $content -replace '(?s)<!--.*?-->\s*', ''
$content = $content -replace [regex]::Escape('{{ASSEMBLY_PATH}}'), $dllPath

$addinDir = "C:\ProgramData\Autodesk\Revit\Addins\$Year"
New-Item -ItemType Directory -Path $addinDir -Force | Out-Null
$addinFile = Join-Path $addinDir "BimAzim.addin"
$content | Out-File -Encoding utf8 $addinFile -Force

Write-Host "Wrote $addinFile -> $dllPath"
