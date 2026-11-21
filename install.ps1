#Requires -Version 5.1
<#
  BIM-AZIM installer.

  Per-user install (no admin rights needed, except the one noted exception below). Downloads the
  BIM-AZIM source, builds the MCP server, and then for each engine it detects on this machine:

  - Revit (2020-2027, detected via C:\Program Files\Autodesk\Revit <year>): builds the plugin for
    every detected year and writes its .addin manifest to the PER-USER addin folder
    (%APPDATA%\Autodesk\Revit\Addins\<year>) - no admin rights needed.
  - Navisworks Manage (2020-2027): builds the plugin for every detected year and copies the DLL
    into that Navisworks install's own Plugins folder under Program Files - this DOES need admin
    rights (Navisworks has no per-user plugin folder); if that copy fails, the built DLL's path is
    printed so you can copy it yourself, or re-run this installer as Administrator.
  - Tekla Structures: builds the bridge IF Tekla Structures is detected (its Open API DLLs are
    proprietary and only exist inside a real Tekla install - this installer cannot bundle them).

  Finally it registers the MCP server with any supported AI clients found on this machine.

  Usage:
    irm https://raw.githubusercontent.com/mostafamabdelazem99/BIM-AZIM/main/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"

$RepoZipUrl  = "https://github.com/mostafamabdelazem99/BIM-AZIM/archive/refs/heads/main.zip"
$InstallRoot = Join-Path $env:LOCALAPPDATA "BimAzim"
$AppDir      = Join-Path $InstallRoot "app"
$ServerEntry = Join-Path $AppDir "server\build\index.js"

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "    [ok] $text" -ForegroundColor Green }
function Write-Warn2($text) { Write-Host "    [skip] $text" -ForegroundColor Yellow }

function Test-CommandExists($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Ensure-Node {
    Write-Step "Checking for Node.js"
    if (Test-CommandExists "node") {
        Write-Ok "Node.js found: $(node --version)"
        return
    }
    Write-Host "    Node.js not found - installing via winget (this may take a minute)..."
    winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements --silent
    $env:PATH = "$env:ProgramFiles\nodejs;$env:PATH"
    if (-not (Test-CommandExists "node")) {
        throw "Node.js install did not complete. Install it manually from https://nodejs.org and re-run this installer."
    }
    Write-Ok "Node.js installed: $(node --version)"
}

function Get-DotnetPath {
    $candidates = @(
        "$env:ProgramFiles\dotnet\dotnet.exe",
        "${env:ProgramFiles(x86)}\dotnet\dotnet.exe"
    )
    foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
    if (Test-CommandExists "dotnet") { return (Get-Command dotnet).Source }
    return $null
}

function Get-RevitYears {
    # 2025+ installers no longer write a registry key for Revit, so this probes the filesystem —
    # same reasoning BIM-Bot's own installer uses (see plugins/Revit/BimAzimPlugin's porting notes).
    $years = @()
    foreach ($year in 2020..2027) {
        if (Test-Path "C:\Program Files\Autodesk\Revit $year") { $years += $year }
    }
    return $years
}

function Get-NavisworksYears {
    $years = @()
    foreach ($year in 2020..2027) {
        if (Test-Path "C:\Program Files\Autodesk\Navisworks Manage $year") { $years += $year }
    }
    return $years
}

function Get-TeklaStructuresBin {
    # Tekla Structures installs as C:\Program Files\Tekla Structures\<version>\nt\bin on 64-bit builds.
    $root = "C:\Program Files\Tekla Structures"
    if (-not (Test-Path $root)) { return $null }
    $hit = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName "nt\bin" } |
        Where-Object { Test-Path (Join-Path $_ "Tekla.Structures.Model.dll") } |
        Select-Object -First 1
    return $hit
}

function Download-Source {
    Write-Step "Downloading BIM-AZIM source"
    New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
    $zipPath = Join-Path $InstallRoot "source.zip"
    Invoke-WebRequest -Uri $RepoZipUrl -OutFile $zipPath -UseBasicParsing

    $extractDir = Join-Path $InstallRoot "source-extract"
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
    Remove-Item $zipPath -Force

    $extractedRepoDir = Get-ChildItem $extractDir -Directory | Select-Object -First 1
    if (-not $extractedRepoDir) { throw "Downloaded archive did not contain the expected folder." }

    # Move CONTENTS into $AppDir rather than moving the extracted folder itself: if $AppDir
    # already exists (a previous install, or a partial cleanup), Move-Item onto an existing
    # directory nests the source inside it instead of replacing it - this avoids that entirely,
    # regardless of why $AppDir might still be there.
    New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
    Get-ChildItem $AppDir -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem $extractedRepoDir.FullName -Force | Move-Item -Destination $AppDir -Force

    Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path (Join-Path $AppDir "server\package.json"))) {
        throw "Source did not land correctly at $AppDir (missing server/package.json) - installer bug, please report this."
    }
    Write-Ok "Source placed at $AppDir"
}

function Build-Server {
    Write-Step "Building the MCP server"
    Push-Location (Join-Path $AppDir "server")
    try {
        & npm install --no-fund --no-audit | Out-Null
        & npm run build | Out-Null
    } finally {
        Pop-Location
    }
    if (-not (Test-Path $ServerEntry)) { throw "Server build did not produce $ServerEntry" }
    Write-Ok "Server built at $ServerEntry"
}

function Build-TeklaBridge {
    Write-Step "Checking for Tekla Structures"
    $teklaBin = Get-TeklaStructuresBin
    if (-not $teklaBin) {
        Write-Warn2 "Tekla Structures not detected - skipping the Tekla bridge. Install Tekla Structures and re-run this installer to enable it."
        return $false
    }
    Write-Ok "Found Tekla Structures bin folder: $teklaBin"

    $dotnetExe = Get-DotnetPath
    if (-not $dotnetExe) {
        Write-Warn2 ".NET SDK not found - skipping the Tekla bridge build. Install the .NET 8 SDK (https://dotnet.microsoft.com/download) and re-run this installer."
        return $false
    }

    Write-Step "Building the Tekla bridge against your local Tekla Open API"
    $proj = Join-Path $AppDir "plugins\Tekla\BimAzim.TeklaBridge\BimAzim.TeklaBridge.csproj"
    $buildOutput = & $dotnetExe build $proj -c Release -p:TeklaStructuresBin="$teklaBin" 2>&1
    $builtExe = Get-ChildItem (Join-Path $AppDir "plugins\Tekla\BimAzim.TeklaBridge\bin\Release") -Recurse -Filter "BimAzim.TeklaBridge.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($LASTEXITCODE -ne 0 -or -not $builtExe) {
        Write-Warn2 "Tekla bridge build did not produce an .exe - see plugins/Tekla/README.md 'Known gaps'; the Open API surface may differ for your Tekla version and need a code fix."
        Write-Host "      Last lines of dotnet build output:" -ForegroundColor DarkGray
        $buildOutput | Select-Object -Last 15 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
        return $false
    }
    Write-Ok "Tekla bridge built: $($builtExe.FullName)"
    return $true
}

$RevitTfmByYear = @{
    2020 = 'net47'; 2021 = 'net48'; 2022 = 'net48'; 2023 = 'net48'; 2024 = 'net48'
    2025 = 'net8.0-windows'; 2026 = 'net8.0-windows'; 2027 = 'net10.0-windows'
}

function Build-RevitPlugin {
    Write-Step "Checking for Autodesk Revit"
    $years = Get-RevitYears
    if ($years.Count -eq 0) {
        Write-Warn2 "No Revit install detected (checked C:\Program Files\Autodesk\Revit <year> for 2020-2027)"
        return @()
    }
    Write-Ok "Found Revit: $($years -join ', ')"

    $dotnetExe = Get-DotnetPath
    if (-not $dotnetExe) {
        Write-Warn2 ".NET SDK not found - skipping the Revit plugin build. Install the .NET 8 SDK (https://dotnet.microsoft.com/download) and re-run this installer."
        return @()
    }

    $proj = Join-Path $AppDir "plugins\Revit\BimAzimPlugin\BimAzimPlugin.csproj"
    $templatePath = Join-Path $AppDir "plugins\Revit\BimAzimPlugin\Deploy\BimAzim.addin.template"
    $installed = @()

    foreach ($year in $years) {
        Write-Step "Building the Revit plugin for $year ($($RevitTfmByYear[$year]))"
        $buildOutput = & $dotnetExe build $proj -c Release -p:RevitVersion=$year 2>&1
        $buildFailed = ($LASTEXITCODE -ne 0)

        $dllPath = Join-Path $AppDir "plugins\Revit\BimAzimPlugin\bin\R$year\Release\$($RevitTfmByYear[$year])\BimAzimPlugin.dll"
        if ($buildFailed -or -not (Test-Path $dllPath)) {
            Write-Warn2 "Revit $year build did not produce $dllPath - see plugins/Revit/README.md"
            Write-Host "      Last lines of dotnet build output:" -ForegroundColor DarkGray
            $buildOutput | Select-Object -Last 15 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
            continue
        }

        # Per-user addin folder (not %ProgramData%) so this installer never needs admin rights.
        $addinDir = Join-Path $env:APPDATA "Autodesk\Revit\Addins\$year"
        New-Item -ItemType Directory -Force -Path $addinDir | Out-Null
        # -Encoding UTF8 is required here: Windows PowerShell 5.1's default Get-Content encoding
        # mis-decodes non-ASCII bytes in a no-BOM UTF-8 file, corrupting any em-dash etc. in the
        # template into mojibake in the written .addin file.
        $content = (Get-Content -Raw -Encoding UTF8 $templatePath) -replace '(?s)<!--.*?-->\s*', ''
        $content = $content -replace [regex]::Escape('{{ASSEMBLY_PATH}}'), $dllPath
        $content | Out-File -Encoding utf8 -Force (Join-Path $addinDir "BimAzim.addin")

        Write-Ok "Revit $year plugin installed ($addinDir\BimAzim.addin -> $dllPath)"
        $installed += $year
    }
    return $installed
}

$NavisTfm = 'net48'

function Build-NavisworksPlugin {
    Write-Step "Checking for Navisworks Manage"
    $years = Get-NavisworksYears
    if ($years.Count -eq 0) {
        Write-Warn2 "No Navisworks Manage install detected (checked C:\Program Files\Autodesk\Navisworks Manage <year> for 2020-2027)"
        return @()
    }
    Write-Ok "Found Navisworks Manage: $($years -join ', ')"

    $dotnetExe = Get-DotnetPath
    if (-not $dotnetExe) {
        Write-Warn2 ".NET SDK not found - skipping the Navisworks plugin build. Install the .NET 8 SDK (https://dotnet.microsoft.com/download) and re-run this installer."
        return @()
    }

    $proj = Join-Path $AppDir "plugins\Navisworks\BimAzimNavisPlugin\BimAzimNavisPlugin.csproj"
    $installed = @()

    foreach ($year in $years) {
        Write-Step "Building the Navisworks plugin for $year"
        $buildOutput = & $dotnetExe build $proj -c Release -p:NavisYear=$year 2>&1
        $buildFailed = ($LASTEXITCODE -ne 0)

        $dllPath = Join-Path $AppDir "plugins\Navisworks\BimAzimNavisPlugin\bin\N$year\Release\$NavisTfm\BimAzimNavisPlugin.dll"
        if ($buildFailed -or -not (Test-Path $dllPath)) {
            Write-Warn2 "Navisworks $year build did not produce $dllPath - see plugins/Navisworks/README.md"
            Write-Host "      Last lines of dotnet build output:" -ForegroundColor DarkGray
            $buildOutput | Select-Object -Last 15 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
            continue
        }

        # Navisworks loads AddInPlugins from its own install's Plugins folder, which normally
        # needs admin rights to write to (unlike Revit's per-user addin folder). Try it; if it
        # fails, tell the user exactly what to do instead of silently skipping.
        $pluginDir = "C:\Program Files\Autodesk\Navisworks Manage $year\Plugins\BimAzimNavisPlugin"
        try {
            # Copy the WHOLE output folder, not just the main DLL - BimAzimNavisPlugin.dll
            # references dependencies (e.g. Newtonsoft.Json.dll) that live alongside it and must
            # ship with it, or Navisworks fails to load the plugin with a missing-assembly error.
            New-Item -ItemType Directory -Force -Path $pluginDir -ErrorAction Stop | Out-Null
            $outputDir = Split-Path $dllPath -Parent
            Copy-Item (Join-Path $outputDir "*") $pluginDir -Force -Exclude "*.pdb" -ErrorAction Stop
            Write-Ok "Navisworks $year plugin installed ($pluginDir)"
            $installed += $year
        } catch {
            Write-Warn2 "Could not write to $pluginDir (needs admin rights). Built files are at: $(Split-Path $dllPath -Parent)"
            Write-Host "      Run this installer as Administrator, or manually copy that whole folder's contents (all .dll files, not just BimAzimNavisPlugin.dll) into the folder above." -ForegroundColor DarkGray
        }
    }
    return $installed
}

function Merge-McpConfig($configPath) {
    # Windows PowerShell 5.1 has no -AsHashtable on ConvertFrom-Json, so this merges via
    # PSCustomObject property manipulation instead.
    $dir = Split-Path $configPath -Parent
    if (-not (Test-Path $dir)) { return $false }

    $config = $null
    if (Test-Path $configPath) {
        try { $config = Get-Content $configPath -Raw | ConvertFrom-Json } catch { $config = $null }
    }
    if (-not $config) { $config = [PSCustomObject]@{} }

    if (-not ($config.PSObject.Properties.Name -contains "mcpServers")) {
        $config | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value ([PSCustomObject]@{})
    }

    $entry = [PSCustomObject]@{
        command = "node"
        args    = @($ServerEntry)
        env     = [PSCustomObject]@{}
    }

    if ($config.mcpServers.PSObject.Properties.Name -contains "BIM-AZIM") {
        $config.mcpServers.PSObject.Properties.Remove("BIM-AZIM")
    }
    $config.mcpServers | Add-Member -MemberType NoteProperty -Name "BIM-AZIM" -Value $entry

    $config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding utf8
    return $true
}

function Configure-AiClients {
    Write-Step "Registering BIM-AZIM with installed AI clients"

    $targets = @(
        @{ Name = "Claude Desktop"; Path = Join-Path $env:APPDATA "Claude\claude_desktop_config.json" }
        @{ Name = "Cursor";         Path = Join-Path $env:USERPROFILE ".cursor\mcp.json" }
        @{ Name = "VS Code (user)"; Path = Join-Path $env:APPDATA "Code\User\mcp.json" }
    )

    $configured = 0
    foreach ($t in $targets) {
        $clientDir = Split-Path $t.Path -Parent
        if (-not (Test-Path $clientDir)) {
            Write-Warn2 "$($t.Name) not found on this machine"
            continue
        }
        if (Merge-McpConfig $t.Path) {
            Write-Ok "Configured $($t.Name) ($($t.Path))"
            $configured++
        }
    }

    Write-Host ""
    Write-Host "    Claude Code: run this once to register the server there too:" -ForegroundColor DarkGray
    Write-Host "      claude mcp add bim-azim -- node `"$ServerEntry`"" -ForegroundColor DarkGray

    return $configured
}

# ---- main ----

Write-Host ""
Write-Host "  BIM-AZIM installer" -ForegroundColor Magenta
Write-Host "  AI automation for Revit, Navisworks Manage and Tekla Structures" -ForegroundColor DarkGray
Write-Host ""

Ensure-Node
Download-Source
Build-Server
$revitYears = Build-RevitPlugin
$navisYears = Build-NavisworksPlugin
$teklaReady = Build-TeklaBridge
$clientsConfigured = Configure-AiClients

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " BIM-AZIM is installed at: $InstallRoot" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " MCP server:            ready ($ServerEntry)"
Write-Host " Revit plugin:           $(if ($revitYears.Count -gt 0) { "installed for $($revitYears -join ', ')" } else { 'not installed (no Revit detected or build failed - see messages above)' })"
Write-Host " Navisworks plugin:      $(if ($navisYears.Count -gt 0) { "installed for $($navisYears -join ', ')" } else { 'not installed (no Navisworks detected or build failed - see messages above)' })"
Write-Host " Tekla bridge:           $(if ($teklaReady) { 'built - see plugins/Tekla/README.md to start it' } else { 'not built (see message above)' })"
Write-Host " AI clients configured: $clientsConfigured"
Write-Host ""
if ($revitYears.Count -gt 0) {
    Write-Host " Restart Revit so it picks up the new add-in (look for the 'BIM-AZIM' ribbon tab)." -ForegroundColor DarkGray
}
if ($navisYears.Count -gt 0) {
    Write-Host " Restart Navisworks Manage so it picks up the new add-in (Add-ins tab -> BIM-AZIM)." -ForegroundColor DarkGray
}
Write-Host " Restart your AI client(s), then ask them to call 'bimazim_engine_status' to confirm the connection."
Write-Host ""
