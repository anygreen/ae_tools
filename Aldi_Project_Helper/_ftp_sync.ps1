# _ftp_sync.ps1 — Background FTP sync helper for Aldi Project Helper
# Launched by Aldi_Project_Helper_V2.jsx via PowerShell on Windows
# Usage: powershell -ExecutionPolicy Bypass -NoProfile -File _ftp_sync.ps1 <config_file_path>

param(
    [Parameter(Mandatory=$true)]
    [string]$ConfigPath
)

# ============================================================
# SETUP
# ============================================================

$netrcFileGlobal = $null
Register-EngineEvent PowerShell.Exiting -Action {
    foreach ($f in @($ConfigPath, $netrcFileGlobal)) {
        if ($f -and (Test-Path $f -ErrorAction SilentlyContinue)) {
            Remove-Item $f -ErrorAction SilentlyContinue
        }
    }
} | Out-Null

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ESC = [char]27
$GREEN  = "$ESC[32m"
$YELLOW = "$ESC[33m"
$RED    = "$ESC[31m"
$GRAY   = "$ESC[90m"
$BOLD   = "$ESC[1m"
$RESET  = "$ESC[0m"
$CLR    = "$ESC[K"

# ============================================================
# CONFIG PARSING
# ============================================================

if (-not (Test-Path $ConfigPath)) {
    Write-Host "ERROR: Config file not found: $ConfigPath"
    Read-Host "Press Enter to close"
    exit 1
}

$cfg = @{}
Get-Content $ConfigPath | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $cfg[$matches[1]] = $matches[2]
    }
}

$ftpHost     = $cfg['FTP_HOST']
$ftpPort     = '21'
if ($cfg['FTP_PORT']) { $ftpPort = $cfg['FTP_PORT'] }
$ftpUser     = $cfg['FTP_USER']
$ftpPass     = $cfg['FTP_PASS']
$useFtps     = $cfg['USE_FTPS'] -eq '1'
$tlsFlags    = $cfg['TLS_FLAGS']
$folderCount = [int]$cfg['FOLDER_COUNT']
$scanRootCount = [int]$cfg['SCAN_ROOT_COUNT']

$scanLocal  = @()
$scanRemote = @()
$scanLabel  = @()
for ($i = 1; $i -le $scanRootCount; $i++) {
    $scanLocal  += $cfg["SCAN_LOCAL_$i"]
    $scanRemote += $cfg["SCAN_REMOTE_$i"]
    $scanLabel  += $cfg["SCAN_LABEL_$i"]
}

# ============================================================
# HELPERS
# ============================================================

$netrcFile = [System.IO.Path]::GetTempFileName()
$netrcFileGlobal = $netrcFile
Set-Content -Path $netrcFile -Value "machine $ftpHost login $ftpUser password $ftpPass" -NoNewline

function Get-CurlBase {
    $base = "curl -sS --netrc-file `"$netrcFile`" --max-time 30"
    if ($useFtps -and $tlsFlags) {
        $base = "$base $tlsFlags"
    }
    return $base
}

function Get-FtpUrl([string]$path) {
    return "ftp://${ftpHost}:${ftpPort}/$path"
}

function Test-DateFolder([string]$name) {
    return $name -match '^\d{6}$'
}

function Test-SkipFile([string]$name) {
    return ($name -eq '.DS_Store' -or $name -eq 'Thumbs.db' -or $name -eq 'desktop.ini' -or $name.StartsWith('.'))
}

function Get-FtpList([string]$remotePath) {
    $url = Get-FtpUrl "$remotePath/"
    $cmd = "$(Get-CurlBase) -l `"$url`""
    try {
        $result = Invoke-Expression $cmd 2>$null
        if ($result) {
            return ($result -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_.Length -gt 0 })
        }
    } catch {}
    return @()
}

function Get-FtpListRecursive([string]$basePath, [string]$currentPath) {
    $fullPath = $basePath
    if ($currentPath) { $fullPath = "$basePath/$currentPath" }

    $items = Get-FtpList $fullPath
    if (-not $items) { return }

    foreach ($item in $items) {
        if (-not $item -or (Test-SkipFile $item)) { continue }

        $itemPath = $item
        if ($currentPath) { $itemPath = "$currentPath/$item" }

        # Test if directory
        $testItems = Get-FtpList "$basePath/$itemPath"
        if ($testItems -and $testItems.Count -gt 0) {
            Get-FtpListRecursive $basePath $itemPath
        } else {
            $itemPath
        }
    }
}

function Get-LocalFilesRecursive([string]$basePath) {
    if (-not (Test-Path $basePath -PathType Container)) { return }
    Get-ChildItem -Path $basePath -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { -not (Test-SkipFile $_.Name) } |
        ForEach-Object { $_.FullName.Substring($basePath.Length + 1).Replace('\', '/') }
}

function Get-EncodedFtpUrl([string]$remotePath) {
    $parts = $remotePath -split '/'
    $encoded = ($parts | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
    return "ftp://${ftpHost}:${ftpPort}/$encoded"
}

function Format-FileSize([long]$bytes) {
    if ($bytes -ge 1GB) { return "{0:N1} GB" -f ($bytes / 1GB) }
    if ($bytes -ge 1MB) { return "{0:N1} MB" -f ($bytes / 1MB) }
    if ($bytes -ge 1KB) { return "{0:N1} KB" -f ($bytes / 1KB) }
    return "$bytes B"
}

function Format-Time([int]$seconds) {
    if ($seconds -ge 3600) {
        return "{0}h {1:D2}m {2:D2}s" -f [Math]::Floor($seconds/3600), [Math]::Floor(($seconds%3600)/60), ($seconds%60)
    } elseif ($seconds -ge 60) {
        return "{0}m {1:D2}s" -f [Math]::Floor($seconds/60), ($seconds%60)
    }
    return "${seconds}s"
}

# ============================================================
# CONNECTION TEST
# ============================================================

Write-Host "  ${BOLD}FTP Sync${RESET}"
$sep = ([string]([char]0x2550)) * 52
Write-Host "  $sep"
$proto = if ($useFtps) { "FTPS" } else { "FTP" }
Write-Host "  Host: $ftpHost  Protocol: $proto"
Write-Host ""
Write-Host -NoNewline "  Testing connection... "

$testUrl = Get-FtpUrl ""
$testCmd = "$(Get-CurlBase) -l `"$testUrl`""
try {
    $testResult = Invoke-Expression $testCmd 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Connection failed" }
    Write-Host "${GREEN}OK${RESET}"
} catch {
    Write-Host "${RED}FAILED${RESET}"
    Write-Host ""
    Write-Host "  Error: $testResult"
    Write-Host ""
    Read-Host "  Press Enter to close"
    exit 1
}
Write-Host ""

# ============================================================
# SCANNING
# ============================================================

$syncStart = Get-Date

$allUploads = [System.Collections.ArrayList]::new()
$allDownloads = [System.Collections.ArrayList]::new()
$totalUploadBytes = [long]0

for ($r = 0; $r -lt $scanRootCount; $r++) {
    $localBase  = $scanLocal[$r]
    $remoteBase = $scanRemote[$r]
    $label      = $scanLabel[$r]

    Write-Host -NoNewline "  Scanning $label...$CLR`r"

    # Local date folders
    $localDates = @()
    if (Test-Path $localBase -PathType Container) {
        $localDates = Get-ChildItem -Path $localBase -Directory -ErrorAction SilentlyContinue |
            Where-Object { Test-DateFolder $_.Name } |
            ForEach-Object { $_.Name } |
            Sort-Object -Descending
    }

    # Remote date folders
    $remoteDates = @()
    $remoteItems = Get-FtpList $remoteBase
    if ($remoteItems) {
        $remoteDates = $remoteItems | Where-Object { Test-DateFolder $_ } | Sort-Object -Descending
    }

    # Combine and deduplicate
    $dateSet = @{}
    $combinedDates = @()
    foreach ($d in @($localDates) + @($remoteDates)) {
        if (-not $dateSet.ContainsKey($d)) {
            $dateSet[$d] = $true
            $combinedDates += $d
        }
    }
    $combinedDates = $combinedDates | Sort-Object -Descending | Select-Object -First $folderCount

    foreach ($dateFolder in $combinedDates) {
        Write-Host -NoNewline "  Scanning $label/$dateFolder...$CLR`r"

        $localDatePath  = "$localBase/$dateFolder"
        $remoteDatePath = "$remoteBase/$dateFolder"

        # Scan local files
        $localMap = @{}
        $localFiles = Get-LocalFilesRecursive $localDatePath
        foreach ($f in $localFiles) {
            if ($f) { $localMap[$f] = $true }
        }

        # Scan remote files
        $remoteMap = @{}
        $remoteFiles = Get-FtpListRecursive $remoteDatePath ""
        foreach ($f in $remoteFiles) {
            if ($f) { $remoteMap[$f] = $true }
        }

        # Compare
        foreach ($relpath in $localMap.Keys) {
            if (-not $remoteMap.ContainsKey($relpath)) {
                $fullLocal  = "$localDatePath/$relpath"
                $fullRemote = "$remoteDatePath/$relpath"
                $fsize = 0
                if (Test-Path $fullLocal) { $fsize = (Get-Item $fullLocal).Length }
                [void]$allUploads.Add(@{
                    label = $label; dateFolder = $dateFolder; relPath = $relpath
                    localPath = $fullLocal; remotePath = $fullRemote; size = $fsize
                })
                $totalUploadBytes += $fsize
            }
        }

        foreach ($relpath in $remoteMap.Keys) {
            if (-not $localMap.ContainsKey($relpath)) {
                $fullLocal  = "$localDatePath/$relpath"
                $fullRemote = "$remoteDatePath/$relpath"
                [void]$allDownloads.Add(@{
                    label = $label; dateFolder = $dateFolder; relPath = $relpath
                    localPath = $fullLocal; remotePath = $fullRemote
                })
            }
        }
    }
}

Write-Host "$CLR"

$uploadCount   = $allUploads.Count
$downloadCount = $allDownloads.Count
$totalCount    = $uploadCount + $downloadCount

# ============================================================
# SUMMARY & CONFIRMATION
# ============================================================

if ($totalCount -eq 0) {
    Write-Host "  ${GREEN}Everything is already in sync!${RESET}"
    Write-Host ""
    Read-Host "  Press Enter to close"
    exit 0
}

Write-Host ""
if ($uploadCount -gt 0) {
    Write-Host "  ${BOLD}Files to upload ($uploadCount):${RESET}"
    $count = 0
    foreach ($entry in $allUploads) {
        if ($scanRootCount -gt 1) {
            $display = "$($entry.label)/$($entry.dateFolder)/$($entry.relPath)"
        } else {
            $display = "$($entry.dateFolder)/$($entry.relPath)"
        }
        $sizeStr = ""
        if ($entry.size -gt 0) { $sizeStr = "  ${GRAY}($(Format-FileSize $entry.size))${RESET}" }
        Write-Host "    + $display$sizeStr"
        $count++
        if ($count -ge 20 -and $count -lt $uploadCount) {
            Write-Host "    ... and $($uploadCount - $count) more"
            break
        }
    }
    Write-Host ""
}

if ($downloadCount -gt 0) {
    Write-Host "  ${BOLD}Files to download ($downloadCount):${RESET}"
    $count = 0
    foreach ($entry in $allDownloads) {
        if ($scanRootCount -gt 1) {
            $display = "$($entry.label)/$($entry.dateFolder)/$($entry.relPath)"
        } else {
            $display = "$($entry.dateFolder)/$($entry.relPath)"
        }
        Write-Host "    - $display"
        $count++
        if ($count -ge 20 -and $count -lt $downloadCount) {
            Write-Host "    ... and $($downloadCount - $count) more"
            break
        }
    }
    Write-Host ""
}

Write-Host -NoNewline "  Total: $uploadCount upload(s), $downloadCount download(s)"
if ($totalUploadBytes -gt 0) {
    Write-Host -NoNewline "  Upload size: $(Format-FileSize $totalUploadBytes)"
}
Write-Host ""
Write-Host ""

$confirm = Read-Host "  Proceed? [Y/n]"
if ($confirm -match '^[nN]') {
    Write-Host "  Cancelled."
    Read-Host "  Press Enter to close"
    exit 0
}

# ============================================================
# TRANSFER
# ============================================================

Write-Host ""
$processed = 0
$uploadErrors = 0
$downloadErrors = 0
$transferStart = Get-Date

# Uploads
foreach ($entry in $allUploads) {
    $processed++
    if ($scanRootCount -gt 1) {
        $display = "$($entry.label)/$($entry.dateFolder)/$($entry.relPath)"
    } else {
        $display = "$($entry.dateFolder)/$($entry.relPath)"
    }

    Write-Host -NoNewline "  [$processed/$totalCount] Uploading $display...$CLR`r"

    # Get mod time for MFMT
    $modTime = ""
    if (Test-Path $entry.localPath) {
        $modTime = (Get-Item $entry.localPath).LastWriteTimeUtc.ToString("yyyyMMddHHmmss")
    }

    $remotePath = $entry.remotePath
    $filename = Split-Path $remotePath -Leaf
    $url = Get-EncodedFtpUrl $remotePath

    $cmd = "$(Get-CurlBase) --ftp-create-dirs"
    if ($modTime) {
        $cmd += " -Q `"-*MFMT $modTime /$remotePath`" -Q `"-*MFMT $modTime $filename`" -Q `"-*SITE UTIME $filename $modTime $modTime $modTime UTC`""
    }
    $cmd += " -T `"$($entry.localPath)`" `"$url`""

    try {
        $output = Invoke-Expression $cmd 2>&1
        if ($LASTEXITCODE -ne 0 -or ($output -and "$output" -match "^curl:")) {
            $uploadErrors++
            Write-Host ""
            Write-Host "  ${RED}Error uploading: $display${RESET}"
        }
    } catch {
        $uploadErrors++
        Write-Host ""
        Write-Host "  ${RED}Error uploading: $display${RESET}"
    }
}

# Downloads
foreach ($entry in $allDownloads) {
    $processed++
    if ($scanRootCount -gt 1) {
        $display = "$($entry.label)/$($entry.dateFolder)/$($entry.relPath)"
    } else {
        $display = "$($entry.dateFolder)/$($entry.relPath)"
    }

    Write-Host -NoNewline "  [$processed/$totalCount] Downloading $display...$CLR`r"

    # Create local directory
    $localDir = Split-Path $entry.localPath -Parent
    if (-not (Test-Path $localDir)) { New-Item -ItemType Directory -Path $localDir -Force | Out-Null }

    $url = Get-EncodedFtpUrl $entry.remotePath

    $cmd = "$(Get-CurlBase) -R -o `"$($entry.localPath)`" `"$url`""
    try {
        $output = Invoke-Expression $cmd 2>&1
        if ($LASTEXITCODE -ne 0 -or ($output -and "$output" -match "^curl:")) {
            $downloadErrors++
            Write-Host ""
            Write-Host "  ${RED}Error downloading: $display${RESET}"
        }
    } catch {
        $downloadErrors++
        Write-Host ""
        Write-Host "  ${RED}Error downloading: $display${RESET}"
    }
}

Write-Host "$CLR"

# ============================================================
# SUMMARY
# ============================================================

$transferEnd = Get-Date
$transferTime = [int]($transferEnd - $transferStart).TotalSeconds
$totalTime    = [int]($transferEnd - $syncStart).TotalSeconds

Write-Host ""
Write-Host "  $sep"
Write-Host "  ${BOLD}${GREEN}SYNC COMPLETE${RESET}"
Write-Host -NoNewline "  Uploaded:   $uploadCount file(s)"
if ($uploadErrors -gt 0) { Write-Host -NoNewline "  ${RED}($uploadErrors failed)${RESET}" }
Write-Host ""
Write-Host -NoNewline "  Downloaded: $downloadCount file(s)"
if ($downloadErrors -gt 0) { Write-Host -NoNewline "  ${RED}($downloadErrors failed)${RESET}" }
Write-Host ""
Write-Host "  Total time: $(Format-Time $totalTime)"
Write-Host "  $sep"
Write-Host ""

# Cleanup
Remove-Item $ConfigPath -ErrorAction SilentlyContinue

Read-Host "  Press Enter to close"
