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

# Ensure credentials are cleaned up on exit or interruption
$renderLogGlobal = $null
Register-EngineEvent PowerShell.Exiting -Action {
    if ($ConfigPath -and (Test-Path $ConfigPath -ErrorAction SilentlyContinue)) {
        Remove-Item $ConfigPath -ErrorAction SilentlyContinue
    }
    if ($renderLogGlobal -and (Test-Path $renderLogGlobal -ErrorAction SilentlyContinue)) {
        Remove-Item $renderLogGlobal -ErrorAction SilentlyContinue
    }
    if (Test-Path "$renderLogGlobal.err" -ErrorAction SilentlyContinue) {
        Remove-Item "$renderLogGlobal.err" -ErrorAction SilentlyContinue
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
$compCount   = [int]$cfg['COMP_COUNT']
$totalFrames = [int]$cfg['TOTAL_FRAMES']

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

$renderExit = $aerenderProcess.ExitCode

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

    $totalBytes   = ($files | Measure-Object -Property Length -Sum).Sum
    $totalMB      = Format-MB $totalBytes
    $uploadedBytes = [int64]0
    $uploadedCount = 0
    $uploadErrors  = 0
    $uploadStart   = Get-Date
    $firstUploadDraw = $true
    $uploadDisplayLines = 5

    function Draw-UploadProgress {
        param([string]$CurrentFile)

        if (-not $script:firstUploadDraw) {
            Write-Host "$ESC[$($uploadDisplayLines)A" -NoNewline
        }
        $script:firstUploadDraw = $false

        $uploadedMB = Format-MB $script:uploadedBytes
        $bar = Draw-Bar -Current $script:uploadedBytes -Max $totalBytes

        $fileIdx = $script:uploadedCount + $script:uploadErrors + 1

        Write-Host "$CLR  ${BOLD}UPLOAD PROGRESS${RESET}"
        Write-Host "$CLR  Overall: $bar  $uploadedMB / $totalMB MB"
        Write-Host "$CLR"
        Write-Host "$CLR  Uploading [$fileIdx/$fileCount]: $CurrentFile"
        Write-Host "$CLR"
    }

    function Get-FTPTimestamp {
        param([string]$FilePath)
        $file = Get-Item $FilePath
        return $file.LastWriteTimeUtc.ToString("yyyyMMddHHmmss")
    }

    foreach ($file in $files) {
        $relPath    = $file.FullName.Substring($outputFolder.Length + 1).Replace('\', '/')
        $remotePath = "$remoteBase/$relPath"
        $fileName   = $file.Name
        $fileSize   = $file.Length
        $modTime    = Get-FTPTimestamp $file.FullName

        Draw-UploadProgress $relPath

        $url = "ftp://${ftpHost}:${ftpPort}/${remotePath}"

        # Build curl arguments
        # Use -sS (silent + show errors) to keep the ANSI progress display clean
        $curlArgs = @('-sS')
        if ($tlsFlags) {
            $curlArgs += $tlsFlags.Split(' ')
        }
        $curlArgs += '--user', "${ftpUser}:${ftpPass}"
        $curlArgs += '--ftp-create-dirs'
        $curlArgs += '-Q', "-*MFMT $modTime /$remotePath"
        $curlArgs += '-Q', "-*MFMT $modTime $fileName"
        $curlArgs += '-Q', "-*SITE UTIME $fileName $modTime $modTime $modTime UTC"
        $curlArgs += '-T', $file.FullName
        $curlArgs += $url

        & curl @curlArgs 2>&1 | Out-Host

        if ($LASTEXITCODE -eq 0) {
            $uploadedBytes += $fileSize
            $uploadedCount++
        } else {
            $uploadErrors++
        }
    }

    # Final upload draw
    $firstUploadDraw = $false
    Write-Host "$ESC[$($uploadDisplayLines)A" -NoNewline

    $uploadedMB = Format-MB $uploadedBytes
    $bar = Draw-Bar -Current $uploadedBytes -Max $totalBytes

    Write-Host "$CLR  ${BOLD}UPLOAD PROGRESS${RESET}"
    Write-Host "$CLR  Overall: $bar  $uploadedMB / $totalMB MB"
    Write-Host "$CLR"
    if ($uploadErrors -gt 0) {
        Write-Host "$CLR  ${RED}$uploadErrors file(s) failed to upload${RESET}"
    } else {
        Write-Host "$CLR  ${GREEN}All files uploaded successfully${RESET}"
    }
    Write-Host "$CLR"

    $uploadEnd  = Get-Date
    $uploadTime = [int]($uploadEnd - $uploadStart).TotalSeconds
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
    Write-Host "  Uploaded: $uploadedCount/$fileCount files ($(Format-MB $uploadedBytes) MB) in $(Format-Time $uploadTime)"
    if ($uploadErrors -gt 0) {
        Write-Host "  ${RED}Errors:  $uploadErrors file(s) failed${RESET}"
    }
}
Write-Host "  Total time: $(Format-Time $totalTime)"
Write-Host "  $sep"
Write-Host ""

# Cleanup
Remove-Item $ConfigPath -ErrorAction SilentlyContinue

Read-Host "  Press Enter to close"
