#Requires -Version 5.1
<#
  BIM-AZIM installer.

  Per-user install (no admin rights needed). Downloads the BIM-AZIM source, builds the MCP
  server, builds the Tekla Structures bridge IF Tekla Structures is detected on this machine
  (its Open API DLLs are proprietary and only exist inside a real Tekla install - this installer
  cannot and does not bundle them), and registers the MCP server with any supported AI clients
  found on this machine.

  Revit and Navisworks Manage support is not built yet (see plugins/Revit, plugins/Navisworks in
  the repo) - this installer does not claim to configure them.

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

    if (Test-Path $AppDir) { Remove-Item $AppDir -Recurse -Force }
    Move-Item $extractedRepoDir.FullName $AppDir
    Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
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
    & $dotnetExe build $proj -c Release -p:TeklaStructuresBin="$teklaBin" | Out-Null
    $builtExe = Get-ChildItem (Join-Path $AppDir "plugins\Tekla\BimAzim.TeklaBridge\bin\Release") -Recurse -Filter "BimAzim.TeklaBridge.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $builtExe) {
        Write-Warn2 "Tekla bridge build did not produce an .exe - see plugins/Tekla/README.md 'Known gaps'; the Open API surface may differ for your Tekla version and need a code fix."
        return $false
    }
    Write-Ok "Tekla bridge built: $($builtExe.FullName)"
    return $true
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
$teklaReady = Build-TeklaBridge
$clientsConfigured = Configure-AiClients

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " BIM-AZIM is installed at: $InstallRoot" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " MCP server:            ready ($ServerEntry)"
Write-Host " Tekla bridge:           $(if ($teklaReady) { 'built - see plugins/Tekla/README.md to start it' } else { 'not built (see message above)' })"
Write-Host " Revit / Navisworks:     not available yet (no plugin code built for these engines)"
Write-Host " AI clients configured: $clientsConfigured"
Write-Host ""
Write-Host " Restart your AI client(s), then ask them to call 'bimazim_engine_status' to confirm the connection."
Write-Host ""
