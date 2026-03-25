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
$curlProgressGlobal = $null
$curlExitFileGlobal = $null
Register-EngineEvent PowerShell.Exiting -Action {
    Write-Host "$([char]27)[?7h" -NoNewline 2>$null   # re-enable line wrapping
    foreach ($f in @($ConfigPath, $netrcFileGlobal, $curlProgressGlobal, $curlExitFileGlobal)) {
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

$BAR_WIDTH = 40

function Draw-Bar {
    param([int64]$Current, [int64]$Max, [int]$Width = $BAR_WIDTH)
    $pct = if ($Max -gt 0) { [Math]::Min(100, [Math]::Floor($Current * 100 / $Max)) } else { 0 }
    $filled = [Math]::Floor($pct * $Width / 100)
    $empty = $Width - $filled
    $filledStr = [string]([char]0x2588) * $filled
    $emptyStr  = [string]([char]0x2591) * $empty
    return "[$filledStr$emptyStr] $($pct.ToString().PadLeft(3))%"
}

function Format-MB {
    param([int64]$Bytes)
    return ([Math]::Round($Bytes / 1MB, 1)).ToString("0.0")
}

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

function Get-CurlArgs {
    $args_ = @('-sS', '--user', "${ftpUser}:${ftpPass}", '--max-time', '30')
    if ($useFtps -and $tlsFlags) {
        $args_ += ($tlsFlags -split '\s+')
    }
    return $args_
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
    $curlArgs = Get-CurlArgs
    $curlArgs += @('-l', $url)
    try {
        $result = & curl.exe @curlArgs 2>$null
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
# Build argument list for direct curl invocation (avoids Invoke-Expression issues)
$testArgs = @('-sS', '--user', "${ftpUser}:${ftpPass}", '--max-time', '30', '--connect-timeout', '10')
if ($useFtps -and $tlsFlags) {
    $testArgs += ($tlsFlags -split '\s+')
}
$testArgs += @('-l', $testUrl)

$testStderr = [System.IO.Path]::GetTempFileName()
try {
    $testResult = & curl.exe @testArgs 2>$testStderr
    if ($LASTEXITCODE -ne 0) {
        $errText = Get-Content $testStderr -Raw -ErrorAction SilentlyContinue
        throw "curl exit $LASTEXITCODE : $errText"
    }
    Write-Host "${GREEN}OK${RESET}"
} catch {
    Write-Host "${RED}FAILED${RESET}"
    Write-Host ""
    $errDetail = $_.Exception.Message
    if (-not $errDetail) {
        $errDetail = Get-Content $testStderr -Raw -ErrorAction SilentlyContinue
    }
    Write-Host "  Error: $errDetail"
    Write-Host ""
    Remove-Item $testStderr -ErrorAction SilentlyContinue
    Read-Host "  Press Enter to close"
    exit 1
} finally {
    Remove-Item $testStderr -ErrorAction SilentlyContinue
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
# TRANSFER — with live progress display
# ============================================================

# Build unified file list: uploads first, then downloads
$sfDisp    = @()   # display name
$sfSize    = @()   # file size (0 for downloads)
$sfDir     = @()   # "up" or "down"
$sfStatus  = @()   # waiting/active/done/error
$sfSpeed   = @()   # result speed string
$sfTime    = @()   # result time string

foreach ($entry in $allUploads) {
    if ($scanRootCount -gt 1) {
        $dname = "$($entry.label)/$($entry.dateFolder)/$($entry.relPath)"
    } else {
        $dname = "$($entry.dateFolder)/$($entry.relPath)"
    }
    if ($dname.Length -gt 30) { $dname = "..." + $dname.Substring($dname.Length - 27) }
    $sfDisp   += $dname
    $sfSize   += [int64]$entry.size
    $sfDir    += "up"
    $sfStatus += "waiting"
    $sfSpeed  += ""
    $sfTime   += ""
}

foreach ($entry in $allDownloads) {
    if ($scanRootCount -gt 1) {
        $dname = "$($entry.label)/$($entry.dateFolder)/$($entry.relPath)"
    } else {
        $dname = "$($entry.dateFolder)/$($entry.relPath)"
    }
    if ($dname.Length -gt 30) { $dname = "..." + $dname.Substring($dname.Length - 27) }
    $sfDisp   += $dname
    $sfSize   += [int64]0
    $sfDir    += "down"
    $sfStatus += "waiting"
    $sfSpeed  += ""
    $sfTime   += ""
}

$totalBytes = [int64]0
foreach ($entry in $allUploads) { $totalBytes += [int64]$entry.size }
$totalMB = Format-MB $totalBytes

$uploadedBytes = [int64]0
$uploadErrors = 0
$downloadErrors = 0
$transferStart = Get-Date

$curFileSize  = [int64]0
$curFileStart = Get-Date
$curFileIdx   = 0
$curFileShort = ""

# Display height: header(1) + blank(1) + files(N) + blank(1) + overall(1) + current(1) + blank(1)
$syncDisplayLines = $totalCount + 6
$firstSyncDraw = $true

# Netrc file for curl credentials (needed by Start-Process transfers)
$netrcFile = [System.IO.Path]::GetTempFileName()
$netrcFileGlobal = $netrcFile
Set-Content -Path $netrcFile -Value "machine $ftpHost login $ftpUser password $ftpPass" -NoNewline

# Temp files for curl progress capture
$curlProgress = [System.IO.Path]::GetTempFileName()
$curlExitFile = [System.IO.Path]::GetTempFileName()
$curlProgressGlobal = $curlProgress
$curlExitFileGlobal = $curlExitFile

function Parse-SyncPct {
    if (-not (Test-Path $script:curlProgress) -or (Get-Item $script:curlProgress).Length -eq 0) {
        return 0
    }
    $raw = Get-Content $script:curlProgress -Raw -ErrorAction SilentlyContinue
    if (-not $raw) { return 0 }
    $lines = $raw -split "`r"
    for ($li = $lines.Count - 1; $li -ge 0; $li--) {
        if ($lines[$li] -match '(\d+\.?\d*)\s*%') {
            return [Math]::Min(100, [int][Math]::Floor([double]$matches[1]))
        }
    }
    return 0
}

function Draw-SyncProgress {
    Write-Host "$ESC[?7l" -NoNewline   # disable line wrapping
    if (-not $script:firstSyncDraw) {
        Write-Host "$ESC[$($script:syncDisplayLines)A" -NoNewline
    }
    $script:firstSyncDraw = $false

    $curPct = Parse-SyncPct
    $curBytes = [int64]($script:curFileSize * $curPct / 100)
    $totalNow = $script:uploadedBytes + $curBytes

    Write-Host "$CLR  ${BOLD}SYNC PROGRESS${RESET}"
    Write-Host "$CLR"

    # File list
    for ($i = 0; $i -lt $script:totalCount; $i++) {
        $name   = $script:sfDisp[$i]
        $dir    = $script:sfDir[$i]
        $status = $script:sfStatus[$i]

        if ($dir -eq 'up') {
            $smb = Format-MB $script:sfSize[$i]
            $sizeStr = "$($smb.PadLeft(7)) MB"
        } else {
            $sizeStr = "$(' '.PadLeft(5))$([char]0x2193)   "
        }

        $padName = $name.PadRight(30)

        if ($status -eq 'done') {
            Write-Host "$CLR  ${GREEN}$([char]0x2713)${RESET} $padName $sizeStr  $($script:sfSpeed[$i].PadLeft(5)) MB/s  $($script:sfTime[$i])"
        }
        elseif ($status -eq 'error') {
            Write-Host "$CLR  ${RED}$([char]0x2717)${RESET} $padName $sizeStr  error"
        }
        elseif ($status -eq 'active') {
            $action = if ($dir -eq 'up') { "uploading..." } else { "downloading..." }
            Write-Host "$CLR  ${YELLOW}$([char]0x25B6)${RESET} $padName $sizeStr  $action"
        }
        else {
            Write-Host "$CLR  ${GRAY}$([char]0x00B7)${RESET} $padName $sizeStr  waiting"
        }
    }

    Write-Host "$CLR"

    # Overall progress bar (by file count)
    $completed = 0
    for ($i = 0; $i -lt $script:totalCount; $i++) {
        if ($script:sfStatus[$i] -eq 'done' -or $script:sfStatus[$i] -eq 'error') { $completed++ }
    }
    $elapsed = [int]((Get-Date) - $script:transferStart).TotalSeconds
    $elapsedStr = ""
    if ($elapsed -gt 0) { $elapsedStr = "  $(Format-Time $elapsed)" }
    $bar = Draw-Bar -Current $completed -Max $script:totalCount -Width 30
    Write-Host "$CLR  Overall  $bar  $completed/$($script:totalCount) files$elapsedStr"

    # Current file progress bar
    $fileElapsed = [int]((Get-Date) - $script:curFileStart).TotalSeconds
    $fileSpeed = ""
    if ($fileElapsed -gt 0 -and $curBytes -gt 0) {
        $fileSpeed = "$([Math]::Round($curBytes / $fileElapsed / 1MB, 1).ToString('0.0')) MB/s"
    }
    if ($script:curFileSize -gt 0) {
        $fileBar = Draw-Bar -Current $curBytes -Max $script:curFileSize -Width 30
    } else {
        $fileBar = Draw-Bar -Current $curPct -Max 100 -Width 30
    }
    $fileIdx = "$($script:curFileIdx + 1)/$($script:totalCount)"
    Write-Host "$CLR  [$fileIdx]   $fileBar  $($script:curFileShort.PadRight(16)) $fileSpeed"

    Write-Host "$CLR"
    Write-Host "$ESC[?7h" -NoNewline   # re-enable line wrapping
}

Write-Host ""

# --- Uploads ---
for ($ui = 0; $ui -lt $uploadCount; $ui++) {
    $entry = $allUploads[$ui]

    $sfStatus[$ui] = 'active'
    $curFileIdx   = $ui
    $curFileSize  = [int64]$entry.size
    $curFileStart = Get-Date
    $curFileShort = Split-Path $entry.relPath -Leaf
    if ($curFileShort.Length -gt 16) {
        $curFileShort = "..." + $curFileShort.Substring($curFileShort.Length - 13)
    }

    $modTime = ""
    if (Test-Path $entry.localPath) {
        $modTime = (Get-Item $entry.localPath).LastWriteTimeUtc.ToString("yyyyMMddHHmmss")
    }

    $remotePath = $entry.remotePath
    $filename = Split-Path $remotePath -Leaf
    $url = Get-EncodedFtpUrl $remotePath

    $argString = '--progress-bar'
    if ($useFtps -and $tlsFlags) { $argString += " $tlsFlags" }
    $argString += " --netrc-file `"$netrcFile`""
    $argString += ' --ftp-create-dirs'
    if ($modTime) {
        $argString += " -Q `"-*MFMT $modTime /$remotePath`""
        $argString += " -Q `"-*MFMT $modTime $filename`""
        $argString += " -Q `"-*SITE UTIME $filename $modTime $modTime $modTime UTC`""
    }
    $argString += " -T `"$($entry.localPath)`""
    $argString += " `"$url`""

    "" | Set-Content $curlProgress

    $curlProcess = Start-Process -FilePath 'curl.exe' `
        -ArgumentList $argString `
        -RedirectStandardError $curlProgress `
        -NoNewWindow -PassThru

    while (-not $curlProcess.HasExited) {
        Draw-SyncProgress
        Start-Sleep -Milliseconds 400
    }

    $curlProcess.WaitForExit()
    $curlExit = $curlProcess.ExitCode
    if ($null -eq $curlExit) { $curlExit = 0 }

    $ufElapsed = [int]((Get-Date) - $curFileStart).TotalSeconds
    if ($curlExit -eq 0) {
        $uploadedBytes += [int64]$entry.size
        $sfStatus[$ui] = 'done'
        if ($ufElapsed -gt 0) {
            $sfSpeed[$ui] = [Math]::Round([int64]$entry.size / $ufElapsed / 1MB, 1).ToString('0.0')
        } else {
            $sfSpeed[$ui] = '--'
        }
        $sfTime[$ui] = Format-Time $ufElapsed
    } else {
        $uploadErrors++
        $sfStatus[$ui] = 'error'
    }
}

# --- Downloads ---
for ($di = 0; $di -lt $downloadCount; $di++) {
    $entry = $allDownloads[$di]
    $fileIdx = $uploadCount + $di

    $sfStatus[$fileIdx] = 'active'
    $curFileIdx   = $fileIdx
    $curFileSize  = [int64]0
    $curFileStart = Get-Date
    $curFileShort = Split-Path $entry.relPath -Leaf
    if ($curFileShort.Length -gt 16) {
        $curFileShort = "..." + $curFileShort.Substring($curFileShort.Length - 13)
    }

    # Create local directory
    $localDir = Split-Path $entry.localPath -Parent
    if (-not (Test-Path $localDir)) { New-Item -ItemType Directory -Path $localDir -Force | Out-Null }

    $url = Get-EncodedFtpUrl $entry.remotePath

    $argString = '--progress-bar'
    if ($useFtps -and $tlsFlags) { $argString += " $tlsFlags" }
    $argString += " --netrc-file `"$netrcFile`""
    $argString += " -R"
    $argString += " -o `"$($entry.localPath)`""
    $argString += " `"$url`""

    "" | Set-Content $curlProgress

    $curlProcess = Start-Process -FilePath 'curl.exe' `
        -ArgumentList $argString `
        -RedirectStandardError $curlProgress `
        -NoNewWindow -PassThru

    while (-not $curlProcess.HasExited) {
        Draw-SyncProgress
        Start-Sleep -Milliseconds 400
    }

    $curlProcess.WaitForExit()
    $curlExit = $curlProcess.ExitCode
    if ($null -eq $curlExit) { $curlExit = 0 }

    $dfElapsed = [int]((Get-Date) - $curFileStart).TotalSeconds
    if ($curlExit -eq 0) {
        $sfStatus[$fileIdx] = 'done'
        $dlSize = 0
        if (Test-Path $entry.localPath) { $dlSize = (Get-Item $entry.localPath).Length }
        if ($dfElapsed -gt 0 -and $dlSize -gt 0) {
            $sfSpeed[$fileIdx] = [Math]::Round($dlSize / $dfElapsed / 1MB, 1).ToString('0.0')
        } else {
            $sfSpeed[$fileIdx] = '--'
        }
        $sfTime[$fileIdx] = Format-Time $dfElapsed
    } else {
        $downloadErrors++
        $sfStatus[$fileIdx] = 'error'
    }
}

# Final redraw
Draw-SyncProgress

$transferEnd  = Get-Date
$transferTime = [int]($transferEnd - $transferStart).TotalSeconds
$totalTime    = [int]($transferEnd - $syncStart).TotalSeconds

Remove-Item $curlProgress -ErrorAction SilentlyContinue
Remove-Item $curlExitFile -ErrorAction SilentlyContinue

# ============================================================
# SUMMARY
# ============================================================

Write-Host ""
$sep = ([string]([char]0x2550)) * 52
Write-Host "  $sep"
Write-Host "  ${BOLD}${GREEN}SYNC COMPLETE${RESET}"
if ($uploadCount -gt 0) {
    Write-Host -NoNewline "  Uploaded:   $uploadCount file(s) ($(Format-MB $uploadedBytes) MB) in $(Format-Time $transferTime)"
    if ($uploadErrors -gt 0) { Write-Host -NoNewline "  ${RED}($uploadErrors failed)${RESET}" }
    Write-Host ""
}
if ($downloadCount -gt 0) {
    Write-Host -NoNewline "  Downloaded: $downloadCount file(s) in $(Format-Time $transferTime)"
    if ($downloadErrors -gt 0) { Write-Host -NoNewline "  ${RED}($downloadErrors failed)${RESET}" }
    Write-Host ""
}
Write-Host "  Total time: $(Format-Time $totalTime)"
Write-Host "  $sep"
Write-Host ""

# Cleanup
Remove-Item $ConfigPath -ErrorAction SilentlyContinue

Read-Host "  Press Enter to close"
