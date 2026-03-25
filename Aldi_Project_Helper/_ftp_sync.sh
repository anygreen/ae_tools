#!/bin/bash
# _ftp_sync.sh — Background FTP sync helper for Aldi Project Helper
# Launched by Aldi_Project_Helper_V2.jsx via Terminal on macOS
# Usage: _ftp_sync.sh <config_file_path>

# ============================================================
# CONFIG PARSING
# ============================================================

CONFIG_FILE="$1"
if [ -z "$CONFIG_FILE" ] || [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: Config file not found: $CONFIG_FILE"
    read -p "Press Enter to close..."
    exit 1
fi

# Fix bare CR line endings from ExtendScript
tr '\015' '\012' < "$CONFIG_FILE" > "${CONFIG_FILE}.fixed"
mv "${CONFIG_FILE}.fixed" "$CONFIG_FILE"

FTP_HOST=""
FTP_PORT="21"
FTP_USER=""
FTP_PASS=""
USE_FTPS="0"
TLS_FLAGS=""
FOLDER_COUNT="1"
SCAN_ROOT_COUNT="0"

SCAN_LOCAL=()
SCAN_REMOTE=()
SCAN_LABEL=()

NETRC_FILE=""
CURL_PID=""
CURL_PROGRESS=""
CURL_EXIT_FILE=""
CURL_CMD=""

cleanup() {
    printf "\033[?7h" 2>/dev/null   # re-enable line wrapping
    [ -n "$CURL_PID" ] && kill "$CURL_PID" 2>/dev/null
    rm -f "$CONFIG_FILE" "$NETRC_FILE" "$CURL_PROGRESS" "$CURL_EXIT_FILE" "$CURL_CMD" 2>/dev/null
}
trap cleanup EXIT INT TERM HUP

while IFS='=' read -r key value; do
    [ -z "$key" ] && continue
    case "$key" in
        FTP_HOST)        FTP_HOST="$value" ;;
        FTP_PORT)        FTP_PORT="$value" ;;
        FTP_USER)        FTP_USER="$value" ;;
        FTP_PASS)        FTP_PASS="$value" ;;
        USE_FTPS)        USE_FTPS="$value" ;;
        TLS_FLAGS)       TLS_FLAGS="$value" ;;
        FOLDER_COUNT)    FOLDER_COUNT="$value" ;;
        SCAN_ROOT_COUNT) SCAN_ROOT_COUNT="$value" ;;
        SCAN_LOCAL_*)
            idx="${key#SCAN_LOCAL_}"
            SCAN_LOCAL[$((idx-1))]="$value"
            ;;
        SCAN_REMOTE_*)
            idx="${key#SCAN_REMOTE_}"
            SCAN_REMOTE[$((idx-1))]="$value"
            ;;
        SCAN_LABEL_*)
            idx="${key#SCAN_LABEL_}"
            SCAN_LABEL[$((idx-1))]="$value"
            ;;
    esac
done < "$CONFIG_FILE"

# ============================================================
# ANSI COLORS
# ============================================================

GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
GRAY="\033[90m"
BOLD="\033[1m"
RESET="\033[0m"
CLR="\033[K"

BAR_WIDTH=40

draw_bar() {
    local current=$1
    local max=$2
    local width=${3:-$BAR_WIDTH}
    local pct=0
    if [ "$max" -gt 0 ]; then
        pct=$((current * 100 / max))
    fi
    [ "$pct" -gt 100 ] && pct=100
    local filled=$((pct * width / 100))
    local empty=$((width - filled))
    local bar=""
    local j
    for ((j=0; j<filled; j++)); do bar="${bar}█"; done
    for ((j=0; j<empty; j++)); do bar="${bar}░"; done
    printf "[%s] %3d%%" "$bar" "$pct"
}

format_mb() {
    local bytes=$1
    awk -v b="$bytes" 'BEGIN { printf "%.1f", b / 1048576 }'
}

parse_sync_pct() {
    [ ! -f "$CURL_PROGRESS" ] && echo 0 && return
    [ ! -s "$CURL_PROGRESS" ] && echo 0 && return
    local last_pct
    last_pct=$(grep -oE '[0-9]+\.[0-9]' "$CURL_PROGRESS" 2>/dev/null | tail -1)
    [ -z "$last_pct" ] && echo 0 && return
    echo "${last_pct%%.*}"
}

# ============================================================
# HELPERS
# ============================================================

# Create netrc file for curl authentication
NETRC_FILE=$(mktemp /tmp/ae_sync_netrc_XXXXXX)
chmod 600 "$NETRC_FILE"
echo "machine $FTP_HOST login $FTP_USER password $FTP_PASS" > "$NETRC_FILE"

# Build base curl flags
CURL_BASE="curl -sS --netrc-file \"$NETRC_FILE\" --max-time 30"
if [ "$USE_FTPS" = "1" ] && [ -n "$TLS_FLAGS" ]; then
    CURL_BASE="$CURL_BASE $TLS_FLAGS"
fi

ftp_url() {
    echo "ftp://$FTP_HOST:$FTP_PORT/$1"
}

# URL-encode a path component (preserve slashes)
url_encode_path() {
    local path="$1"
    # Use python for reliable encoding, fall back to raw path
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import sys, urllib.parse; print('/'.join(urllib.parse.quote(p, safe='') for p in sys.argv[1].split('/')))" "$path"
    else
        echo "$path"
    fi
}

# Check if a name is a date folder (YYMMDD)
is_date_folder() {
    [[ "$1" =~ ^[0-9]{6}$ ]]
}

# Should skip file
should_skip() {
    case "$1" in
        .DS_Store|Thumbs.db|desktop.ini) return 0 ;;
        .*) return 0 ;;
    esac
    return 1
}

# List FTP directory (flat, one name per line)
ftp_list() {
    local remote_path="$1"
    local url
    url=$(ftp_url "$remote_path/")
    eval $CURL_BASE "\"$url\"" -l 2>/dev/null | tr -d '\r' | grep -v '^$'
}

# Recursively list all files on FTP under a path
# Output: relative paths (one per line)
ftp_list_recursive() {
    local base_path="$1"
    local current_path="$2"
    local full_path="$base_path"
    [ -n "$current_path" ] && full_path="$base_path/$current_path"

    local items
    items=$(ftp_list "$full_path" 2>/dev/null)
    [ -z "$items" ] && return

    while IFS= read -r item; do
        [ -z "$item" ] && continue
        should_skip "$item" && continue

        local item_path="$item"
        [ -n "$current_path" ] && item_path="$current_path/$item"

        # Test if it's a directory by trying to list it
        local test_items
        test_items=$(ftp_list "$base_path/$item_path" 2>/dev/null)
        if [ -n "$test_items" ]; then
            ftp_list_recursive "$base_path" "$item_path"
        else
            echo "$item_path"
        fi
    done <<< "$items"
}

# Recursively list all local files under a path
# Output: relative paths (one per line)
local_list_recursive() {
    local base_path="$1"
    [ ! -d "$base_path" ] && return

    find "$base_path" -type d -name '.*' -prune -o -type f -not -name '.DS_Store' -not -name 'Thumbs.db' -not -name 'desktop.ini' -print 2>/dev/null | while IFS= read -r file; do
        # Get relative path
        echo "${file#$base_path/}"
    done
}

format_size() {
    local bytes=$1
    if [ "$bytes" -ge 1073741824 ]; then
        awk -v b="$bytes" 'BEGIN { printf "%.1f GB", b / 1073741824 }'
    elif [ "$bytes" -ge 1048576 ]; then
        awk -v b="$bytes" 'BEGIN { printf "%.1f MB", b / 1048576 }'
    elif [ "$bytes" -ge 1024 ]; then
        awk -v b="$bytes" 'BEGIN { printf "%.1f KB", b / 1024 }'
    else
        echo "${bytes} B"
    fi
}

format_time() {
    local s=$1
    if [ "$s" -ge 3600 ]; then
        printf "%dh %02dm %02ds" $((s/3600)) $(((s%3600)/60)) $((s%60))
    elif [ "$s" -ge 60 ]; then
        printf "%dm %02ds" $((s/60)) $((s%60))
    else
        printf "%ds" "$s"
    fi
}

# ============================================================
# CONNECTION TEST
# ============================================================

printf "  ${BOLD}FTP Sync${RESET}\n"
echo "  ════════════════════════════════════════════════════"
printf "  Host: %s  Protocol: %s\n" "$FTP_HOST" "$([ "$USE_FTPS" = "1" ] && echo "FTPS" || echo "FTP")"
echo ""
printf "  Testing connection... "

TEST_URL=$(ftp_url "")
TEST_RESULT=$(eval $CURL_BASE "\"$TEST_URL\"" -l 2>&1)
TEST_EXIT=$?
if [ $TEST_EXIT -ne 0 ]; then
    printf "${RED}FAILED${RESET}\n"
    echo ""
    echo "  Error: $TEST_RESULT"
    echo ""
    read -p "  Press Enter to close..."
    exit 1
fi
printf "${GREEN}OK${RESET}\n"
echo ""

# ============================================================
# SCANNING
# ============================================================

SYNC_START=$(date +%s)

# Arrays to store all files to sync
ALL_UPLOADS=()       # "label|dateFolder|relativePath|localFullPath|remoteFullPath"
ALL_DOWNLOADS=()     # "label|dateFolder|relativePath|localFullPath|remoteFullPath"

TOTAL_UPLOAD_BYTES=0

for (( r=0; r<SCAN_ROOT_COUNT; r++ )); do
    local_base="${SCAN_LOCAL[$r]}"
    remote_base="${SCAN_REMOTE[$r]}"
    label="${SCAN_LABEL[$r]}"

    printf "  Scanning %s...\r" "$label"

    # Get local date folders
    local_dates=()
    if [ -d "$local_base" ]; then
        while IFS= read -r d; do
            [ -n "$d" ] && local_dates+=("$d")
        done < <(ls -1 "$local_base" 2>/dev/null | while read -r name; do
            is_date_folder "$name" && echo "$name"
        done | sort -r)
    fi

    # Get remote date folders
    remote_dates=()
    remote_items=$(ftp_list "$remote_base" 2>/dev/null)
    if [ -n "$remote_items" ]; then
        while IFS= read -r name; do
            is_date_folder "$name" && remote_dates+=("$name")
        done <<< "$remote_items"
        IFS=$'\n' remote_dates=($(sort -r <<< "${remote_dates[*]}")); unset IFS
    fi

    # Combine and deduplicate date folders, take latest N
    combined_dates_str=""
    for d in "${local_dates[@]}" "${remote_dates[@]}"; do
        # Check if already in combined list
        if [ -z "$combined_dates_str" ] || ! echo "$combined_dates_str" | grep -qxF "$d"; then
            combined_dates_str="${combined_dates_str}${combined_dates_str:+$'\n'}$d"
        fi
    done
    combined_dates=()
    if [ -n "$combined_dates_str" ]; then
        while IFS= read -r d; do
            [ -n "$d" ] && combined_dates+=("$d")
        done <<< "$(echo "$combined_dates_str" | sort -r | head -n "$FOLDER_COUNT")"
    fi

    for date_folder in "${combined_dates[@]}"; do
        printf "  Scanning %s/%s...${CLR}\r" "$label" "$date_folder"

        local_date_path="$local_base/$date_folder"
        remote_date_path="$remote_base/$date_folder"

        # Scan local files (newline-delimited set)
        local_set=""
        if [ -d "$local_date_path" ]; then
            local_set=$(local_list_recursive "$local_date_path")
        fi

        # Scan remote files (newline-delimited set)
        remote_set=$(ftp_list_recursive "$remote_date_path" "")

        # Compare: local only → upload
        if [ -n "$local_set" ]; then
            while IFS= read -r relpath; do
                [ -z "$relpath" ] && continue
                if [ -z "$remote_set" ] || ! echo "$remote_set" | grep -qxF "$relpath"; then
                    full_local="$local_date_path/$relpath"
                    full_remote="$remote_date_path/$relpath"
                    fsize=0
                    [ -f "$full_local" ] && fsize=$(stat -f%z "$full_local" 2>/dev/null || echo 0)
                    ALL_UPLOADS+=("$label|$date_folder|$relpath|$full_local|$full_remote|$fsize")
                    TOTAL_UPLOAD_BYTES=$((TOTAL_UPLOAD_BYTES + fsize))
                fi
            done <<< "$local_set"
        fi

        # Compare: remote only → download
        if [ -n "$remote_set" ]; then
            while IFS= read -r relpath; do
                [ -z "$relpath" ] && continue
                if [ -z "$local_set" ] || ! echo "$local_set" | grep -qxF "$relpath"; then
                    full_local="$local_date_path/$relpath"
                    full_remote="$remote_date_path/$relpath"
                    ALL_DOWNLOADS+=("$label|$date_folder|$relpath|$full_local|$full_remote|0")
                fi
            done <<< "$remote_set"
        fi
    done
done

printf "${CLR}"

UPLOAD_COUNT=${#ALL_UPLOADS[@]}
DOWNLOAD_COUNT=${#ALL_DOWNLOADS[@]}
TOTAL_COUNT=$((UPLOAD_COUNT + DOWNLOAD_COUNT))

# ============================================================
# SUMMARY & CONFIRMATION
# ============================================================

if [ "$TOTAL_COUNT" -eq 0 ]; then
    printf "  ${GREEN}Everything is already in sync!${RESET}\n"
    echo ""
    read -p "  Press Enter to close..."
    exit 0
fi

echo ""
if [ "$UPLOAD_COUNT" -gt 0 ]; then
    printf "  ${BOLD}Files to upload (%d):${RESET}\n" "$UPLOAD_COUNT"
    count=0
    for entry in "${ALL_UPLOADS[@]}"; do
        IFS='|' read -r lbl df rp _ _ fs <<< "$entry"
        if [ $((SCAN_ROOT_COUNT)) -gt 1 ]; then
            printf "    + %s/%s/%s" "$lbl" "$df" "$rp"
        else
            printf "    + %s/%s" "$df" "$rp"
        fi
        if [ "$fs" -gt 0 ]; then
            printf "  ${GRAY}(%s)${RESET}" "$(format_size $fs)"
        fi
        echo ""
        count=$((count + 1))
        if [ $count -ge 20 ] && [ $count -lt $UPLOAD_COUNT ]; then
            printf "    ... and %d more\n" $((UPLOAD_COUNT - count))
            break
        fi
    done
    echo ""
fi

if [ "$DOWNLOAD_COUNT" -gt 0 ]; then
    printf "  ${BOLD}Files to download (%d):${RESET}\n" "$DOWNLOAD_COUNT"
    count=0
    for entry in "${ALL_DOWNLOADS[@]}"; do
        IFS='|' read -r lbl df rp _ _ _ <<< "$entry"
        if [ $((SCAN_ROOT_COUNT)) -gt 1 ]; then
            printf "    - %s/%s/%s\n" "$lbl" "$df" "$rp"
        else
            printf "    - %s/%s\n" "$df" "$rp"
        fi
        count=$((count + 1))
        if [ $count -ge 20 ] && [ $count -lt $DOWNLOAD_COUNT ]; then
            printf "    ... and %d more\n" $((DOWNLOAD_COUNT - count))
            break
        fi
    done
    echo ""
fi

printf "  Total: %d upload(s), %d download(s)" "$UPLOAD_COUNT" "$DOWNLOAD_COUNT"
if [ "$TOTAL_UPLOAD_BYTES" -gt 0 ]; then
    printf "  Upload size: %s" "$(format_size $TOTAL_UPLOAD_BYTES)"
fi
echo ""
echo ""

read -p "  Proceed? [Y/n] " CONFIRM
case "$CONFIRM" in
    [nN]*) echo "  Cancelled."; read -p "  Press Enter to close..."; exit 0 ;;
esac

# ============================================================
# TRANSFER — with live progress display
# ============================================================

# Build unified file list: uploads first, then downloads
# SF_DISP[i]  — display name (truncated)
# SF_SIZE[i]  — file size (0 for downloads)
# SF_DIR[i]   — "up" or "down"
# SF_STATUS[i] — waiting/active/done/error
# SF_SPEED[i] — result speed string
# SF_TIME[i]  — result time string
SF_DISP=()
SF_SIZE=()
SF_DIR=()
SF_STATUS=()
SF_SPEED=()
SF_TIME=()

for entry in "${ALL_UPLOADS[@]}"; do
    IFS='|' read -r lbl df rp _ _ fs <<< "$entry"
    if [ $((SCAN_ROOT_COUNT)) -gt 1 ]; then
        dname="$lbl/$df/$rp"
    else
        dname="$df/$rp"
    fi
    # Truncate display name
    if [ ${#dname} -gt 30 ]; then
        dname="...${dname: -27}"
    fi
    idx=${#SF_DISP[@]}
    SF_DISP[$idx]="$dname"
    SF_SIZE[$idx]="$fs"
    SF_DIR[$idx]="up"
    SF_STATUS[$idx]="waiting"
    SF_SPEED[$idx]=""
    SF_TIME[$idx]=""
done

for entry in "${ALL_DOWNLOADS[@]}"; do
    IFS='|' read -r lbl df rp _ _ _ <<< "$entry"
    if [ $((SCAN_ROOT_COUNT)) -gt 1 ]; then
        dname="$lbl/$df/$rp"
    else
        dname="$df/$rp"
    fi
    if [ ${#dname} -gt 30 ]; then
        dname="...${dname: -27}"
    fi
    idx=${#SF_DISP[@]}
    SF_DISP[$idx]="$dname"
    SF_SIZE[$idx]="0"
    SF_DIR[$idx]="down"
    SF_STATUS[$idx]="waiting"
    SF_SPEED[$idx]=""
    SF_TIME[$idx]=""
done

TOTAL_BYTES=0
for entry in "${ALL_UPLOADS[@]}"; do
    IFS='|' read -r _ _ _ _ _ fs <<< "$entry"
    TOTAL_BYTES=$((TOTAL_BYTES + fs))
done
TOTAL_MB=$(format_mb $TOTAL_BYTES)

UPLOADED_BYTES=0
DOWNLOADED_COUNT_DONE=0
UPLOAD_ERRORS=0
DOWNLOAD_ERRORS=0
TRANSFER_START=$(date +%s)

CUR_FILE_SIZE=0
CUR_FILE_START=0
CUR_FILE_IDX=0
CUR_FILE_SHORT=""

# Display height: header(1) + blank(1) + files(N) + blank(1) + overall(1) + current(1) + blank(1)
SYNC_DISPLAY_LINES=$((TOTAL_COUNT + 6))
FIRST_SYNC_DRAW=1

# Temp files for curl progress capture
CURL_PROGRESS=$(mktemp /tmp/ae_sync_progress_XXXXXX)
CURL_EXIT_FILE=$(mktemp /tmp/ae_sync_exit_XXXXXX)
CURL_CMD=$(mktemp /tmp/ae_sync_cmd_XXXXXX)

draw_sync_progress() {
    printf "\033[?7l"   # disable line wrapping
    if [ "$FIRST_SYNC_DRAW" = "0" ]; then
        printf "\033[${SYNC_DISPLAY_LINES}A"
    fi
    FIRST_SYNC_DRAW=0

    # Estimate bytes for current file
    cur_pct=$(parse_sync_pct)
    cur_bytes=$((CUR_FILE_SIZE * cur_pct / 100))
    total_now=$((UPLOADED_BYTES + cur_bytes))

    printf "${CLR}  ${BOLD}SYNC PROGRESS${RESET}\n"
    printf "${CLR}\n"

    # File list
    for ((i=0; i<TOTAL_COUNT; i++)); do
        name="${SF_DISP[$i]}"
        dir="${SF_DIR[$i]}"
        status="${SF_STATUS[$i]}"

        if [ "$dir" = "up" ]; then
            smb=$(format_mb ${SF_SIZE[$i]})
            size_str=$(printf "%7s MB" "$smb")
        else
            size_str=$(printf "%7s   " "↓")
        fi

        if [ "$status" = "done" ]; then
            printf "${CLR}  ${GREEN}✓${RESET} %-30s %s  %5s MB/s  %s\n" \
                "$name" "$size_str" "${SF_SPEED[$i]}" "${SF_TIME[$i]}"
        elif [ "$status" = "error" ]; then
            printf "${CLR}  ${RED}✗${RESET} %-30s %s  error\n" "$name" "$size_str"
        elif [ "$status" = "active" ]; then
            action="uploading..."
            [ "$dir" = "down" ] && action="downloading..."
            printf "${CLR}  ${YELLOW}▶${RESET} %-30s %s  %s\n" "$name" "$size_str" "$action"
        else
            printf "${CLR}  ${GRAY}·${RESET} %-30s %s  waiting\n" "$name" "$size_str"
        fi
    done

    printf "${CLR}\n"

    # Overall progress bar (by file count)
    completed=0
    for ((i=0; i<TOTAL_COUNT; i++)); do
        [ "${SF_STATUS[$i]}" = "done" ] || [ "${SF_STATUS[$i]}" = "error" ] && completed=$((completed + 1))
    done
    elapsed=$(($(date +%s) - TRANSFER_START))
    elapsed_str=""
    [ "$elapsed" -gt 0 ] && elapsed_str="  $(format_time $elapsed)"
    printf "${CLR}  Overall  "
    draw_bar "$completed" "$TOTAL_COUNT" 30
    printf "  %d/%d files%s\n" "$completed" "$TOTAL_COUNT" "$elapsed_str"

    # Current file progress bar
    file_elapsed=$(($(date +%s) - CUR_FILE_START))
    file_speed=""
    if [ "$file_elapsed" -gt 0 ] && [ "$cur_bytes" -gt 0 ]; then
        file_speed="$(awk -v b="$cur_bytes" -v t="$file_elapsed" \
            'BEGIN { printf "%.1f", b / t / 1048576 }') MB/s"
    fi
    printf "${CLR}  [%d/%d]   " "$((CUR_FILE_IDX + 1))" "$TOTAL_COUNT"
    if [ "$CUR_FILE_SIZE" -gt 0 ]; then
        draw_bar "$cur_bytes" "$CUR_FILE_SIZE" 30
    else
        draw_bar "$cur_pct" "100" 30
    fi
    printf "  %-16s %s\n" "$CUR_FILE_SHORT" "$file_speed"

    printf "${CLR}\n"
    printf "\033[?7h"   # re-enable line wrapping
}

printf "\n"

# TLS flags for curl (without -sS, with --progress-bar)
CURL_TRANSFER_FLAGS="--netrc-file \"$NETRC_FILE\""
if [ "$USE_FTPS" = "1" ] && [ -n "$TLS_FLAGS" ]; then
    CURL_TRANSFER_FLAGS="$CURL_TRANSFER_FLAGS $TLS_FLAGS"
fi

# --- Uploads ---
ui=0
for entry in "${ALL_UPLOADS[@]}"; do
    IFS='|' read -r lbl df rp full_local full_remote fsize <<< "$entry"

    SF_STATUS[$ui]="active"
    CUR_FILE_IDX=$ui
    CUR_FILE_SIZE=$fsize
    CUR_FILE_START=$(date +%s)
    CUR_FILE_SHORT=$(basename "$rp")
    if [ ${#CUR_FILE_SHORT} -gt 16 ]; then
        CUR_FILE_SHORT="...${CUR_FILE_SHORT: -13}"
    fi

    # Get mod time for MFMT
    mod_time=""
    if [ -f "$full_local" ]; then
        mod_time=$(date -u -r "$full_local" +%Y%m%d%H%M%S 2>/dev/null)
    fi

    encoded_remote=$(url_encode_path "$full_remote")
    upload_url=$(ftp_url "$encoded_remote")
    filename=$(basename "$full_remote")

    echo "255" > "$CURL_EXIT_FILE"
    cat > "$CURL_CMD" << CURLEOF
#!/bin/bash
curl --progress-bar $CURL_TRANSFER_FLAGS \
    --ftp-create-dirs \
    -Q "-*MFMT ${mod_time} /${full_remote}" \
    -Q "-*MFMT ${mod_time} ${filename}" \
    -Q "-*SITE UTIME ${filename} ${mod_time} ${mod_time} ${mod_time} UTC" \
    -T "$full_local" \
    "$upload_url"
echo \$? > "$CURL_EXIT_FILE"
CURLEOF

    : > "$CURL_PROGRESS"
    expect > /dev/null 2>&1 << EXPECTEOF &
log_user 0
set timeout -1
spawn -noecho bash "$CURL_CMD"
set fp [open "$CURL_PROGRESS" w]
expect {
    -re ".+" {
        puts -nonewline \$fp \$expect_out(buffer)
        flush \$fp
        exp_continue
    }
    eof
}
close \$fp
EXPECTEOF
    CURL_PID=$!

    while kill -0 "$CURL_PID" 2>/dev/null; do
        draw_sync_progress
        sleep 0.4
    done
    wait "$CURL_PID" 2>/dev/null
    CURL_PID=""

    curl_exit=$(cat "$CURL_EXIT_FILE" 2>/dev/null)
    curl_exit=${curl_exit:-255}

    uf_elapsed=$(( $(date +%s) - CUR_FILE_START ))
    if [ "$curl_exit" = "0" ]; then
        UPLOADED_BYTES=$((UPLOADED_BYTES + fsize))
        SF_STATUS[$ui]="done"
        if [ "$uf_elapsed" -gt 0 ]; then
            SF_SPEED[$ui]=$(awk -v s="$fsize" -v t="$uf_elapsed" \
                'BEGIN { printf "%.1f", s / t / 1048576 }')
        else
            SF_SPEED[$ui]="--"
        fi
        SF_TIME[$ui]=$(format_time $uf_elapsed)
    else
        UPLOAD_ERRORS=$((UPLOAD_ERRORS + 1))
        SF_STATUS[$ui]="error"
    fi

    ui=$((ui + 1))
done

# --- Downloads ---
di=0
for entry in "${ALL_DOWNLOADS[@]}"; do
    IFS='|' read -r lbl df rp full_local full_remote _ <<< "$entry"

    file_idx=$((UPLOAD_COUNT + di))
    SF_STATUS[$file_idx]="active"
    CUR_FILE_IDX=$file_idx
    CUR_FILE_SIZE=0
    CUR_FILE_START=$(date +%s)
    CUR_FILE_SHORT=$(basename "$rp")
    if [ ${#CUR_FILE_SHORT} -gt 16 ]; then
        CUR_FILE_SHORT="...${CUR_FILE_SHORT: -13}"
    fi

    # Create local directory if needed
    local_dir=$(dirname "$full_local")
    [ ! -d "$local_dir" ] && mkdir -p "$local_dir"

    encoded_remote=$(url_encode_path "$full_remote")
    download_url=$(ftp_url "$encoded_remote")

    echo "255" > "$CURL_EXIT_FILE"
    cat > "$CURL_CMD" << CURLEOF
#!/bin/bash
curl --progress-bar $CURL_TRANSFER_FLAGS \
    -R \
    -o "$full_local" \
    "$download_url"
echo \$? > "$CURL_EXIT_FILE"
CURLEOF

    : > "$CURL_PROGRESS"
    expect > /dev/null 2>&1 << EXPECTEOF &
log_user 0
set timeout -1
spawn -noecho bash "$CURL_CMD"
set fp [open "$CURL_PROGRESS" w]
expect {
    -re ".+" {
        puts -nonewline \$fp \$expect_out(buffer)
        flush \$fp
        exp_continue
    }
    eof
}
close \$fp
EXPECTEOF
    CURL_PID=$!

    while kill -0 "$CURL_PID" 2>/dev/null; do
        draw_sync_progress
        sleep 0.4
    done
    wait "$CURL_PID" 2>/dev/null
    CURL_PID=""

    curl_exit=$(cat "$CURL_EXIT_FILE" 2>/dev/null)
    curl_exit=${curl_exit:-255}

    df_elapsed=$(( $(date +%s) - CUR_FILE_START ))
    if [ "$curl_exit" = "0" ]; then
        DOWNLOADED_COUNT_DONE=$((DOWNLOADED_COUNT_DONE + 1))
        SF_STATUS[$file_idx]="done"
        # Get downloaded file size for speed calc
        dl_size=0
        [ -f "$full_local" ] && dl_size=$(stat -f%z "$full_local" 2>/dev/null || echo 0)
        if [ "$df_elapsed" -gt 0 ] && [ "$dl_size" -gt 0 ]; then
            SF_SPEED[$file_idx]=$(awk -v s="$dl_size" -v t="$df_elapsed" \
                'BEGIN { printf "%.1f", s / t / 1048576 }')
        else
            SF_SPEED[$file_idx]="--"
        fi
        SF_TIME[$file_idx]=$(format_time $df_elapsed)
    else
        DOWNLOAD_ERRORS=$((DOWNLOAD_ERRORS + 1))
        SF_STATUS[$file_idx]="error"
    fi

    di=$((di + 1))
done

# Final redraw
draw_sync_progress

TRANSFER_END=$(date +%s)
TRANSFER_TIME=$((TRANSFER_END - TRANSFER_START))
TOTAL_TIME=$((TRANSFER_END - SYNC_START))

rm -f "$CURL_PROGRESS" "$CURL_EXIT_FILE" "$CURL_CMD"
CURL_PROGRESS=""
CURL_EXIT_FILE=""
CURL_CMD=""

# ============================================================
# SUMMARY
# ============================================================

echo ""
echo "  ════════════════════════════════════════════════════"
printf "  ${BOLD}${GREEN}SYNC COMPLETE${RESET}\n"
if [ "$UPLOAD_COUNT" -gt 0 ]; then
    printf "  Uploaded:   %d file(s) (%s MB) in %s" "$UPLOAD_COUNT" "$(format_mb $UPLOADED_BYTES)" "$(format_time $TRANSFER_TIME)"
    if [ "$UPLOAD_ERRORS" -gt 0 ]; then
        printf "  ${RED}(%d failed)${RESET}" "$UPLOAD_ERRORS"
    fi
    echo ""
fi
if [ "$DOWNLOAD_COUNT" -gt 0 ]; then
    printf "  Downloaded: %d file(s) in %s" "$DOWNLOAD_COUNT" "$(format_time $TRANSFER_TIME)"
    if [ "$DOWNLOAD_ERRORS" -gt 0 ]; then
        printf "  ${RED}(%d failed)${RESET}" "$DOWNLOAD_ERRORS"
    fi
    echo ""
fi
printf "  Total time: %s\n" "$(format_time $TOTAL_TIME)"
echo "  ════════════════════════════════════════════════════"
echo ""

read -p "  Press Enter to close..."
