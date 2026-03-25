# _render_upload.ps1 — Background render & upload helper for Aldi Project Helper
# Launched by Aldi_Project_Helper_V2.jsx via PowerShell on Windows
# Usage: powershell -ExecutionPolicy Bypass -NoProfile -File _render_upload.ps1 <config_file_path>

param(
    [Parameter(Mandatory=$true)]
    [string]$ConfigPath
)

# ============================================================
# SETUP
# ============================================================

# Ensure credentials and temp files are cleaned up on exit or interruption
$renderLogGlobal = $null
$netrcFileGlobal = $null
$curlProgressGlobal = $null
$curlExitFileGlobal = $null
Register-EngineEvent PowerShell.Exiting -Action {
    Write-Host "$([char]27)[?7h" -NoNewline 2>$null   # re-enable line wrapping
    foreach ($f in @($ConfigPath, $renderLogGlobal, "$renderLogGlobal.err",
                     $netrcFileGlobal, $curlProgressGlobal, $curlExitFileGlobal)) {
        if ($f -and (Test-Path $f -ErrorAction SilentlyContinue)) {
            Remove-Item $f -ErrorAction SilentlyContinue
        }
    }
} | Out-Null

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Enable VT100 / ANSI escape sequences
$ESC = [char]27

$GREEN  = "$ESC[32m"
$YELLOW = "$ESC[33m"
$RED    = "$ESC[31m"
$GRAY   = "$ESC[90m"
$BOLD   = "$ESC[1m"
$RESET  = "$ESC[0m"
$CLR    = "$ESC[K"

$BAR_WIDTH = 40

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

$aerender    = $cfg['AERENDER']
$project     = $cfg['PROJECT']
$outputFolder = $cfg['OUTPUT_FOLDER']
$doUpload    = $cfg['DO_UPLOAD'] -eq '1'
$ftpHost     = $cfg['FTP_HOST']
$ftpPort     = '21'
if ($cfg['FTP_PORT']) { $ftpPort = $cfg['FTP_PORT'] }
$ftpUser     = $cfg['FTP_USER']
$ftpPass     = $cfg['FTP_PASS']
$useFtps     = $cfg['USE_FTPS'] -eq '1'
$tlsFlags    = $cfg['TLS_FLAGS']
$remoteBase  = $cfg['REMOTE_BASE']
$compCount      = [int]$cfg['COMP_COUNT']
$totalFrames    = [int]$cfg['TOTAL_FRAMES']
$simplifiedPath = $cfg['SIMPLIFIED_PATH']

$compNames  = @()
$compFrames = @()
$compStatus = @()

for ($i = 1; $i -le $compCount; $i++) {
    $parts = $cfg["COMP_$i"] -split '::'
    $compNames  += $parts[0]
    $compFrames += [int]$parts[1]
    $compStatus += 'waiting'
}

# ============================================================
# DRAWING FUNCTIONS
# ============================================================

function Draw-Bar {
    param([int64]$Current, [int64]$Max, [int]$Width = $BAR_WIDTH)
    $pct = if ($Max -gt 0) { [Math]::Min(100, [Math]::Floor($Current * 100 / $Max)) } else { 0 }
    $filled = [Math]::Floor($pct * $Width / 100)
    $empty = $Width - $filled
    $filledStr = [string]([char]0x2588) * $filled
    $emptyStr  = [string]([char]0x2591) * $empty
    return "[$filledStr$emptyStr] $($pct.ToString().PadLeft(3))%"
}

function Format-Time {
    param([int]$Seconds)
    if ($Seconds -ge 60) {
        return "$([Math]::Floor($Seconds / 60))m $($Seconds % 60)s"
    }
    return "${Seconds}s"
}

function Format-MB {
    param([int64]$Bytes)
    return ([Math]::Round($Bytes / 1MB, 1)).ToString("0.0")
}

# ============================================================
# HEADER
# ============================================================

Clear-Host
$title = if ($doUpload) { "AE Background Render & Upload" } else { "AE Background Render" }
Write-Host "${BOLD}" -NoNewline
Write-Host ([char]0x2554 + ([string]([char]0x2550) * 54) + [char]0x2557)
Write-Host ([char]0x2551 + $title.PadLeft(42).PadRight(54) + [char]0x2551)
Write-Host ([char]0x255A + ([string]([char]0x2550) * 54) + [char]0x255D)
Write-Host "${RESET}"
Write-Host "  Project: $(Split-Path $project -Leaf)"
Write-Host "  Output:  $outputFolder"
if ($doUpload) { Write-Host "  FTP:     $ftpHost" }
Write-Host ""

# ============================================================
# RENDER PHASE
# ============================================================

$currentCompIndex = -1
$currentFrame     = 0
$completedFrames  = 0
$renderStart      = Get-Date
$firstRenderDraw  = $true
$renderLog        = [System.IO.Path]::GetTempFileName()
$renderLogGlobal  = $renderLog
$lastProcessedLine = 0

$renderDisplayLines = 4 + $compCount

function Draw-RenderProgress {
    Write-Host "$ESC[?7l" -NoNewline   # disable line wrapping
    if (-not $script:firstRenderDraw) {
        Write-Host "$ESC[$($renderDisplayLines)A" -NoNewline
    }
    $script:firstRenderDraw = $false

    $totalDone = $script:completedFrames + $script:currentFrame
    $bar = Draw-Bar -Current $totalDone -Max $totalFrames

    Write-Host "$CLR  ${BOLD}RENDER PROGRESS${RESET}"
    Write-Host "$CLR  Overall: $bar  $totalDone/$totalFrames frames"
    Write-Host "$CLR"

    for ($i = 0; $i -lt $compCount; $i++) {
        $status = $compStatus[$i]
        $name   = $compNames[$i]
        $frames = $compFrames[$i]
        $padName = $name.PadRight(35)

        if ($status -eq 'done') {
            $doneFrames = $frames.ToString().PadLeft(5)
            $totalF     = $frames.ToString().PadRight(5)
            Write-Host "$CLR  ${GREEN}$([char]0x2713)${RESET} $padName $doneFrames/$totalF  done"
        }
        elseif ($status -eq 'rendering') {
            $curF   = $script:currentFrame.ToString().PadLeft(5)
            $totalF = $frames.ToString().PadRight(5)
            Write-Host "$CLR  ${YELLOW}$([char]0x25B6)${RESET} $padName $curF/$totalF  rendering..."
        }
        else {
            $totalF = $frames.ToString().PadRight(5)
            Write-Host "$CLR  ${GRAY}$([char]0x00B7)${RESET} $padName     0/$totalF  waiting"
        }
    }

    Write-Host "$CLR"
    Write-Host "$ESC[?7h" -NoNewline   # re-enable line wrapping
}

function Parse-NewLines {
    # Check both stdout and stderr logs — aerender may write progress to either
    $allLines = @()
    if (Test-Path $renderLog) {
        $stdoutLines = Get-Content $renderLog -ErrorAction SilentlyContinue
        if ($stdoutLines) { $allLines += $stdoutLines }
    }
    if (Test-Path "$renderLog.err") {
        $stderrLines = Get-Content "$renderLog.err" -ErrorAction SilentlyContinue
        if ($stderrLines) { $allLines += $stderrLines }
    }
    if ($allLines.Count -eq 0) { return }
    $lineCount = $allLines.Count

    if ($lineCount -le $script:lastProcessedLine) { return }

    for ($li = $script:lastProcessedLine; $li -lt $lineCount; $li++) {
        $line = $allLines[$li]

        # Detect comp name in PROGRESS lines
        if ($line -match 'PROGRESS') {
            for ($ci = 0; $ci -lt $compCount; $ci++) {
                if ($line -match [regex]::Escape($compNames[$ci]) -and $ci -gt $script:currentCompIndex) {
                    # Mark previous comp as done
                    if ($script:currentCompIndex -ge 0) {
                        $compStatus[$script:currentCompIndex] = 'done'
                        $script:completedFrames += $compFrames[$script:currentCompIndex]
                    }
                    $script:currentCompIndex = $ci
                    $compStatus[$ci] = 'rendering'
                    $script:currentFrame = 0
                    break
                }
            }
        }

        # Extract frame number from (NNN) pattern
        if ($line -match '\((\d+)\)') {
            $script:currentFrame = [int]$matches[1]
            if ($script:currentCompIndex -lt 0) {
                $script:currentCompIndex = 0
                $compStatus[0] = 'rendering'
            }
        }
    }

    $script:lastProcessedLine = $lineCount
}

# Initial draw
Draw-RenderProgress

# Start aerender in background
$aerenderProcess = Start-Process -FilePath $aerender `
    -ArgumentList "-project", "`"$project`"" `
    -RedirectStandardOutput $renderLog `
    -RedirectStandardError "$renderLog.err" `
    -NoNewWindow -PassThru

# Poll for progress
while (-not $aerenderProcess.HasExited) {
    Start-Sleep -Milliseconds 400
    Parse-NewLines
    Draw-RenderProgress
}

# WaitForExit() is required to populate ExitCode reliably in PowerShell
$aerenderProcess.WaitForExit()
$renderExit = $aerenderProcess.ExitCode
if ($null -eq $renderExit) { $renderExit = 0 }

# Final parse
Parse-NewLines

# Mark all comps as done
for ($i = 0; $i -lt $compCount; $i++) {
    if ($compStatus[$i] -ne 'done') {
        if ($compStatus[$i] -eq 'rendering') {
            $completedFrames += $compFrames[$i]
        }
        $compStatus[$i] = 'done'
    }
}
$currentFrame = 0
Draw-RenderProgress

$renderEnd  = Get-Date
$renderTime = [int]($renderEnd - $renderStart).TotalSeconds

if ($renderExit -ne 0) {
    Write-Host "  ${RED}ERROR: Render failed (exit code $renderExit)${RESET}"
    Write-Host ""
    Write-Host "  aerender output:"
    Write-Host "  $(([string]([char]0x2500)) * 40)"
    if (Test-Path $renderLog) {
        Get-Content $renderLog -Tail 20 | ForEach-Object { Write-Host "  $_" }
    }
    if (Test-Path "$renderLog.err") {
        Get-Content "$renderLog.err" -Tail 10 | ForEach-Object { Write-Host "  $_" }
    }
    Write-Host "  $(([string]([char]0x2500)) * 40)"
    Write-Host ""
    Remove-Item $renderLog -ErrorAction SilentlyContinue
    Remove-Item "$renderLog.err" -ErrorAction SilentlyContinue
    Remove-Item $ConfigPath -ErrorAction SilentlyContinue
    Read-Host "  Press Enter to close"
    exit 1
}

Write-Host "  ${GREEN}Render complete!${RESET} ($(Format-Time $renderTime))"
Write-Host ""
Remove-Item $renderLog -ErrorAction SilentlyContinue
Remove-Item "$renderLog.err" -ErrorAction SilentlyContinue

# ============================================================
# UPLOAD PHASE
# ============================================================

if ($doUpload) {
    $files = Get-ChildItem -Path $outputFolder -Recurse -File | Sort-Object FullName
    $fileCount = $files.Count

    if ($fileCount -eq 0) {
        Write-Host "  ${YELLOW}No rendered files found in output folder.${RESET}"
        Write-Host "  Upload skipped."
        Write-Host ""
        Remove-Item $ConfigPath -ErrorAction SilentlyContinue
        Read-Host "  Press Enter to close"
        exit 0
    }

    # Build per-file info arrays
    $ufPaths  = @()
    $ufRels   = @()
    $ufSizes  = @()
    $ufDisp   = @()   # truncated display names (max 30 chars)
    $ufStatus = @()
    $ufResultOk    = @()
    $ufResultSpeed = @()
    $ufResultTime  = @()

    $totalBytes = [int64]0
    foreach ($f in $files) {
        $ufPaths  += $f.FullName
        $rel = $f.FullName.Substring($outputFolder.Length + 1).Replace('\', '/')
        $ufRels   += $rel
        $ufSizes  += $f.Length
        $bn = $f.Name
        if ($bn.Length -gt 30) {
            $ufDisp += "..." + $bn.Substring($bn.Length - 27)
        } else {
            $ufDisp += $bn
        }
        $ufStatus += 'waiting'
        $ufResultOk    += ''
        $ufResultSpeed += ''
        $ufResultTime  += ''
        $totalBytes += $f.Length
    }

    $totalMB       = Format-MB $totalBytes
    $uploadedBytes = [int64]0
    $uploadedCount = 0
    $uploadErrors  = 0
    $uploadStart   = Get-Date
    $firstUploadDraw = $true

    # Display height: header(1) + blank(1) + files(N) + blank(1) + overall(1) + current(1) + blank(1)
    $uploadDisplayLines = $fileCount + 6

    $curFileSize  = [int64]0
    $curFileStart = Get-Date
    $curFileIdx   = 0
    $curFileShort = ""

    # Netrc file for credentials
    $netrcFile = [System.IO.Path]::GetTempFileName()
    $netrcFileGlobal = $netrcFile
    Set-Content -Path $netrcFile -Value "machine $ftpHost login $ftpUser password $ftpPass" -NoNewline

    # Temp files for curl progress
    $curlProgress = [System.IO.Path]::GetTempFileName()
    $curlExitFile = [System.IO.Path]::GetTempFileName()
    $curlProgressGlobal = $curlProgress
    $curlExitFileGlobal = $curlExitFile

    function Get-FTPTimestamp {
        param([string]$FilePath)
        $file = Get-Item $FilePath
        return $file.LastWriteTimeUtc.ToString("yyyyMMddHHmmss")
    }

    function Parse-UploadPct {
        if (-not (Test-Path $script:curlProgress) -or (Get-Item $script:curlProgress).Length -eq 0) {
            return 0
        }
        $raw = Get-Content $script:curlProgress -Raw -ErrorAction SilentlyContinue
        if (-not $raw) { return 0 }
        # curl --progress-bar writes "###...  XX.X%" with \r between updates
        $lines = $raw -split "`r"
        for ($li = $lines.Count - 1; $li -ge 0; $li--) {
            if ($lines[$li] -match '(\d+\.?\d*)\s*%') {
                return [Math]::Min(100, [int][Math]::Floor([double]$matches[1]))
            }
        }
        return 0
    }

    function Draw-UploadProgress {
        Write-Host "$ESC[?7l" -NoNewline   # disable line wrapping
        if (-not $script:firstUploadDraw) {
            Write-Host "$ESC[$($script:uploadDisplayLines)A" -NoNewline
        }
        $script:firstUploadDraw = $false

        # Estimate bytes sent for current file from progress percentage
        $curPct = Parse-UploadPct
        $curBytes = [int64]($script:curFileSize * $curPct / 100)
        $totalNow = $script:uploadedBytes + $curBytes

        Write-Host "$CLR  ${BOLD}UPLOAD PROGRESS${RESET}"
        Write-Host "$CLR"

        # File list
        for ($i = 0; $i -lt $script:fileCount; $i++) {
            $name   = $ufDisp[$i]
            $smb    = Format-MB $ufSizes[$i]
            $status = $ufStatus[$i]

            if ($status -eq 'done') {
                $padName = $name.PadRight(30)
                Write-Host "$CLR  ${GREEN}$([char]0x2713)${RESET} $padName $($smb.PadLeft(7)) MB  $($ufResultSpeed[$i].PadLeft(5)) MB/s  $($ufResultTime[$i])"
            }
            elseif ($status -eq 'error') {
                $padName = $name.PadRight(30)
                Write-Host "$CLR  ${RED}$([char]0x2717)${RESET} $padName $($smb.PadLeft(7)) MB  error"
            }
            elseif ($status -eq 'uploading') {
                $padName = $name.PadRight(30)
                Write-Host "$CLR  ${YELLOW}$([char]0x25B6)${RESET} $padName $($smb.PadLeft(7)) MB  uploading..."
            }
            else {
                $padName = $name.PadRight(30)
                Write-Host "$CLR  ${GRAY}$([char]0x00B7)${RESET} $padName $($smb.PadLeft(7)) MB  waiting"
            }
        }

        Write-Host "$CLR"

        # Overall progress bar
        $upMB = Format-MB $totalNow
        $elapsed = [int]((Get-Date) - $script:uploadStart).TotalSeconds
        $speedStr = ""
        if ($elapsed -gt 0 -and $totalNow -gt 0) {
            $speedStr = "  $([Math]::Round($totalNow / $elapsed / 1MB, 1).ToString('0.0')) MB/s"
        }
        $bar = Draw-Bar -Current $totalNow -Max $script:totalBytes -Width 30
        Write-Host "$CLR  Overall  $bar  $upMB / $($script:totalMB) MB$speedStr"

        # Current file progress bar
        $fileElapsed = [int]((Get-Date) - $script:curFileStart).TotalSeconds
        $fileSpeed = ""
        if ($fileElapsed -gt 0 -and $curBytes -gt 0) {
            $fileSpeed = "$([Math]::Round($curBytes / $fileElapsed / 1MB, 1).ToString('0.0')) MB/s"
        }
        $fileBar = Draw-Bar -Current $curBytes -Max $script:curFileSize -Width 30
        $fileIdx = "$($script:curFileIdx + 1)/$($script:fileCount)"
        Write-Host "$CLR  [$fileIdx]   $fileBar  $($script:curFileShort.PadRight(16)) $fileSpeed"

        Write-Host "$CLR"
        Write-Host "$ESC[?7h" -NoNewline   # re-enable line wrapping
    }

    Write-Host ""

    # Upload each file
    for ($fi = 0; $fi -lt $fileCount; $fi++) {
        $ufFile    = $ufPaths[$fi]
        $ufRel     = $ufRels[$fi]
        $ufRemote  = "$remoteBase/$ufRel"
        $ufFname   = Split-Path $ufRemote -Leaf
        $ufFsize   = $ufSizes[$fi]
        $ufMtime   = Get-FTPTimestamp $ufFile

        # Update status
        $ufStatus[$fi] = 'uploading'

        # Set current file info for draw_upload_progress
        $curFileIdx   = $fi
        $curFileSize  = $ufFsize
        $curFileStart = Get-Date
        $curFileShort = Split-Path $ufRel -Leaf
        if ($curFileShort.Length -gt 16) {
            $curFileShort = "..." + $curFileShort.Substring($curFileShort.Length - 13)
        }

        $url = "ftp://${ftpHost}:${ftpPort}/${ufRemote}"

        # Build curl argument string with proper quoting.
        # Start-Process -ArgumentList joins arrays with spaces, which breaks
        # -Q values that contain spaces. Use a single pre-quoted string instead.
        $argString = '--progress-bar'
        if ($tlsFlags) { $argString += " $tlsFlags" }
        $argString += " --netrc-file `"$netrcFile`""
        $argString += ' --ftp-create-dirs'
        $argString += " -Q `"-*MFMT $ufMtime /$ufRemote`""
        $argString += " -Q `"-*MFMT $ufMtime $ufFname`""
        $argString += " -Q `"-*SITE UTIME $ufFname $ufMtime $ufMtime $ufMtime UTC`""
        $argString += " -T `"$ufFile`""
        $argString += " `"$url`""

        # Run curl in background, capturing progress (stderr) to file
        "" | Set-Content $curlProgress

        $curlProcess = Start-Process -FilePath 'curl.exe' `
            -ArgumentList $argString `
            -RedirectStandardError $curlProgress `
            -NoNewWindow -PassThru

        # Monitor with live progress
        while (-not $curlProcess.HasExited) {
            Draw-UploadProgress
            Start-Sleep -Milliseconds 400
        }

        $curlProcess.WaitForExit()
        $curlExit = $curlProcess.ExitCode
        if ($null -eq $curlExit) { $curlExit = 0 }

        $ufElapsed = [int]((Get-Date) - $curFileStart).TotalSeconds
        if ($curlExit -eq 0) {
            $uploadedBytes += $ufFsize
            $uploadedCount++
            $ufStatus[$fi] = 'done'
            $ufResultOk[$fi] = '1'
            if ($ufElapsed -gt 0) {
                $ufResultSpeed[$fi] = [Math]::Round($ufFsize / $ufElapsed / 1MB, 1).ToString('0.0')
            } else {
                $ufResultSpeed[$fi] = '--'
            }
            $ufResultTime[$fi] = Format-Time $ufElapsed
        } else {
            $uploadErrors++
            $ufStatus[$fi] = 'error'
            $ufResultOk[$fi] = '0'
            $ufResultSpeed[$fi] = ''
            $ufResultTime[$fi] = ''
        }
    }

    # Final redraw with all files complete
    Draw-UploadProgress

    $uploadEnd  = Get-Date
    $uploadTime = [int]($uploadEnd - $uploadStart).TotalSeconds

    # Cleanup temp files
    Remove-Item $netrcFile -ErrorAction SilentlyContinue
    Remove-Item $curlProgress -ErrorAction SilentlyContinue
    Remove-Item $curlExitFile -ErrorAction SilentlyContinue
}

# ============================================================
# SUMMARY
# ============================================================

$totalEnd  = Get-Date
$totalTime = [int]($totalEnd - $renderStart).TotalSeconds

Write-Host ""
$sep = ([string]([char]0x2550)) * 52
Write-Host "  $sep"
Write-Host "  ${BOLD}${GREEN}COMPLETE${RESET}"
Write-Host "  Rendered: $compCount composition(s) ($totalFrames frames) in $(Format-Time $renderTime)"
if ($doUpload) {
    $avgSpeed = ""
    if ($uploadTime -gt 0) {
        $avgSpeed = " ($([Math]::Round($uploadedBytes / $uploadTime / 1MB, 1).ToString('0.0')) MB/s)"
    }
    Write-Host "  Uploaded: $uploadedCount/$fileCount files ($(Format-MB $uploadedBytes) MB) in $(Format-Time $uploadTime)$avgSpeed"
    if ($uploadErrors -gt 0) {
        Write-Host "  ${RED}Errors:  $uploadErrors file(s) failed${RESET}"
    }
}
Write-Host "  Total time: $(Format-Time $totalTime)"
if ($simplifiedPath) {
    Write-Host "  Output: $simplifiedPath"
}
Write-Host "  $sep"
Write-Host ""

# Cleanup
Remove-Item $ConfigPath -ErrorAction SilentlyContinue

Read-Host "  Press Enter to close"
