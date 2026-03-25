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

cleanup() {
    rm -f "$CONFIG_FILE" "$NETRC_FILE" 2>/dev/null
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
# TRANSFER
# ============================================================

echo ""
PROCESSED=0
UPLOAD_ERRORS=0
DOWNLOAD_ERRORS=0
TRANSFER_START=$(date +%s)

# Uploads
for entry in "${ALL_UPLOADS[@]}"; do
    IFS='|' read -r lbl df rp full_local full_remote fsize <<< "$entry"
    PROCESSED=$((PROCESSED + 1))

    if [ $((SCAN_ROOT_COUNT)) -gt 1 ]; then
        display="$lbl/$df/$rp"
    else
        display="$df/$rp"
    fi

    printf "  [%d/%d] Uploading %s...${CLR}\r" "$PROCESSED" "$TOTAL_COUNT" "$display"

    # Get mod time for MFMT
    mod_time=""
    if [ -f "$full_local" ]; then
        mod_time=$(date -u -r "$full_local" +%Y%m%d%H%M%S 2>/dev/null)
    fi

    encoded_remote=$(url_encode_path "$full_remote")
    upload_url=$(ftp_url "$encoded_remote")
    filename=$(basename "$full_remote")

    UPLOAD_CMD="$CURL_BASE --ftp-create-dirs"
    if [ -n "$mod_time" ]; then
        UPLOAD_CMD="$UPLOAD_CMD -Q \"-*MFMT $mod_time /$full_remote\" -Q \"-*MFMT $mod_time $filename\" -Q \"-*SITE UTIME $filename $mod_time $mod_time $mod_time UTC\""
    fi
    UPLOAD_CMD="$UPLOAD_CMD -T \"$full_local\" \"$upload_url\""

    output=$(eval $UPLOAD_CMD 2>&1)
    exit_code=$?
    if [ $exit_code -ne 0 ] || echo "$output" | grep -q "^curl:"; then
        UPLOAD_ERRORS=$((UPLOAD_ERRORS + 1))
        printf "\n  ${RED}Error uploading: %s${RESET}\n" "$display"
    fi
done

# Downloads
for entry in "${ALL_DOWNLOADS[@]}"; do
    IFS='|' read -r lbl df rp full_local full_remote _ <<< "$entry"
    PROCESSED=$((PROCESSED + 1))

    if [ $((SCAN_ROOT_COUNT)) -gt 1 ]; then
        display="$lbl/$df/$rp"
    else
        display="$df/$rp"
    fi

    printf "  [%d/%d] Downloading %s...${CLR}\r" "$PROCESSED" "$TOTAL_COUNT" "$display"

    # Create local directory if needed
    local_dir=$(dirname "$full_local")
    [ ! -d "$local_dir" ] && mkdir -p "$local_dir"

    encoded_remote=$(url_encode_path "$full_remote")
    download_url=$(ftp_url "$encoded_remote")

    output=$(eval $CURL_BASE -R -o "\"$full_local\"" "\"$download_url\"" 2>&1)
    exit_code=$?
    if [ $exit_code -ne 0 ] || echo "$output" | grep -q "^curl:"; then
        DOWNLOAD_ERRORS=$((DOWNLOAD_ERRORS + 1))
        printf "\n  ${RED}Error downloading: %s${RESET}\n" "$display"
    fi
done

printf "${CLR}"

# ============================================================
# SUMMARY
# ============================================================

TRANSFER_END=$(date +%s)
TRANSFER_TIME=$((TRANSFER_END - TRANSFER_START))
TOTAL_TIME=$((TRANSFER_END - SYNC_START))

echo ""
echo "  ════════════════════════════════════════════════════"
printf "  ${BOLD}${GREEN}SYNC COMPLETE${RESET}\n"
printf "  Uploaded:   %d file(s)" "$UPLOAD_COUNT"
if [ "$UPLOAD_ERRORS" -gt 0 ]; then
    printf "  ${RED}(%d failed)${RESET}" "$UPLOAD_ERRORS"
fi
echo ""
printf "  Downloaded: %d file(s)" "$DOWNLOAD_COUNT"
if [ "$DOWNLOAD_ERRORS" -gt 0 ]; then
    printf "  ${RED}(%d failed)${RESET}" "$DOWNLOAD_ERRORS"
fi
echo ""
printf "  Total time: %s\n" "$(format_time $TOTAL_TIME)"
echo "  ════════════════════════════════════════════════════"
echo ""

read -p "  Press Enter to close..."
