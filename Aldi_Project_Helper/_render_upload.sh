#!/bin/bash
# _render_upload.sh — Background render & upload helper for Aldi Project Helper
# Launched by Aldi_Project_Helper_V2.jsx via Terminal on macOS
# Usage: _render_upload.sh <config_file_path>

# ============================================================
# CONFIG PARSING
# ============================================================

CONFIG_FILE="$1"
if [ -z "$CONFIG_FILE" ] || [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: Config file not found: $CONFIG_FILE"
    read -p "Press Enter to close..."
    exit 1
fi

AERENDER=""
PROJECT=""
OUTPUT_FOLDER=""
DO_UPLOAD="0"
FTP_HOST=""
FTP_PORT="21"
FTP_USER=""
FTP_PASS=""
USE_FTPS="0"
TLS_FLAGS=""
REMOTE_BASE=""
COMP_COUNT="0"
TOTAL_FRAMES="0"

COMP_NAMES=()
COMP_FRAMES=()
COMP_STATUS=()

# Ensure credentials are cleaned up on exit, interrupt, or terminal close
cleanup() {
    rm -f "$CONFIG_FILE" "$RENDER_LOG" "$FILE_LIST" "$NETRC_FILE" 2>/dev/null
}
trap cleanup EXIT INT TERM HUP

while IFS='=' read -r key value; do
    [ -z "$key" ] && continue
    case "$key" in
        AERENDER)       AERENDER="$value" ;;
        PROJECT)        PROJECT="$value" ;;
        OUTPUT_FOLDER)  OUTPUT_FOLDER="$value" ;;
        DO_UPLOAD)      DO_UPLOAD="$value" ;;
        FTP_HOST)       FTP_HOST="$value" ;;
        FTP_PORT)       FTP_PORT="$value" ;;
        FTP_USER)       FTP_USER="$value" ;;
        FTP_PASS)       FTP_PASS="$value" ;;
        USE_FTPS)       USE_FTPS="$value" ;;
        TLS_FLAGS)      TLS_FLAGS="$value" ;;
        REMOTE_BASE)    REMOTE_BASE="$value" ;;
        COMP_COUNT)     COMP_COUNT="$value" ;;
        TOTAL_FRAMES)   TOTAL_FRAMES="$value" ;;
        COMP_*)
            idx="${key#COMP_}"
            cframes="${value##*::}"
            cname="${value%::*}"
            COMP_NAMES[$((idx-1))]="$cname"
            COMP_FRAMES[$((idx-1))]="$cframes"
            COMP_STATUS[$((idx-1))]="waiting"
            ;;
    esac
done < "$CONFIG_FILE"

# ============================================================
# ANSI COLORS & DRAWING
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
    local pct=0
    if [ "$max" -gt 0 ]; then
        pct=$((current * 100 / max))
    fi
    [ "$pct" -gt 100 ] && pct=100
    local filled=$((pct * BAR_WIDTH / 100))
    local empty=$((BAR_WIDTH - filled))
    local bar=""
    local j
    for ((j=0; j<filled; j++)); do bar="${bar}█"; done
    for ((j=0; j<empty; j++)); do bar="${bar}░"; done
    printf "[%s] %3d%%" "$bar" "$pct"
}

format_time() {
    local secs=$1
    if [ "$secs" -ge 60 ]; then
        printf "%dm %ds" $((secs / 60)) $((secs % 60))
    else
        printf "%ds" "$secs"
    fi
}

format_mb() {
    local bytes=$1
    # Use awk for floating point since bc may not be available
    awk -v b="$bytes" 'BEGIN { printf "%.1f", b / 1048576 }'
}

# ============================================================
# HEADER
# ============================================================

clear
printf "${BOLD}"
echo "╔══════════════════════════════════════════════════════╗"
if [ "$DO_UPLOAD" = "1" ]; then
    echo "║          AE Background Render & Upload              ║"
else
    echo "║          AE Background Render                       ║"
fi
echo "╚══════════════════════════════════════════════════════╝"
printf "${RESET}\n"
echo "  Project: $(basename "$PROJECT")"
echo "  Output:  $OUTPUT_FOLDER"
if [ "$DO_UPLOAD" = "1" ]; then
    echo "  FTP:     $FTP_HOST"
fi
echo ""

# ============================================================
# RENDER PHASE
# ============================================================

CURRENT_COMP_INDEX=-1
CURRENT_FRAME=0
COMPLETED_FRAMES=0
RENDER_START=$(date +%s)
FIRST_RENDER_DRAW=1
RENDER_LOG=$(mktemp /tmp/ae_render_log_XXXXXX)
LAST_PROCESSED_LINE=0

# Display height: header(1) + overall(1) + blank(1) + comps(N) + blank(1)
RENDER_DISPLAY_LINES=$((4 + COMP_COUNT))

draw_render_progress() {
    if [ "$FIRST_RENDER_DRAW" = "0" ]; then
        printf "\033[${RENDER_DISPLAY_LINES}A"
    fi
    FIRST_RENDER_DRAW=0

    local total_done=$((COMPLETED_FRAMES + CURRENT_FRAME))

    printf "${CLR}  ${BOLD}RENDER PROGRESS${RESET}\n"
    printf "${CLR}  Overall: "
    draw_bar "$total_done" "$TOTAL_FRAMES"
    printf "  %d/%d frames\n" "$total_done" "$TOTAL_FRAMES"
    printf "${CLR}\n"

    local i
    for ((i=0; i<COMP_COUNT; i++)); do
        local status="${COMP_STATUS[$i]}"
        local name="${COMP_NAMES[$i]}"
        local frames="${COMP_FRAMES[$i]}"

        if [ "$status" = "done" ]; then
            printf "${CLR}  ${GREEN}✓${RESET} %-35s %5d/%-5d  done\n" "$name" "$frames" "$frames"
        elif [ "$status" = "rendering" ]; then
            printf "${CLR}  ${YELLOW}▶${RESET} %-35s %5d/%-5d  rendering...\n" "$name" "$CURRENT_FRAME" "$frames"
        else
            printf "${CLR}  ${GRAY}·${RESET} %-35s %5d/%-5d  waiting\n" "$name" 0 "$frames"
        fi
    done

    printf "${CLR}\n"
}

parse_new_lines() {
    [ ! -f "$RENDER_LOG" ] && return

    local current_lines
    current_lines=$(wc -l < "$RENDER_LOG" | tr -d ' ')
    [ "$current_lines" -le "$LAST_PROCESSED_LINE" ] && return

    local new_lines
    new_lines=$(tail -n +$((LAST_PROCESSED_LINE + 1)) "$RENDER_LOG")
    LAST_PROCESSED_LINE=$current_lines

    local line
    while IFS= read -r line; do
        # Detect comp name in PROGRESS lines
        if [[ "$line" == *"PROGRESS"* ]]; then
            local i
            for ((i=0; i<COMP_COUNT; i++)); do
                if [[ "$line" == *"${COMP_NAMES[$i]}"* && "$i" -gt "$CURRENT_COMP_INDEX" ]]; then
                    # Mark previous comp as done
                    if [ "$CURRENT_COMP_INDEX" -ge 0 ]; then
                        COMP_STATUS[$CURRENT_COMP_INDEX]="done"
                        COMPLETED_FRAMES=$((COMPLETED_FRAMES + ${COMP_FRAMES[$CURRENT_COMP_INDEX]}))
                    fi
                    CURRENT_COMP_INDEX=$i
                    COMP_STATUS[$i]="rendering"
                    CURRENT_FRAME=0
                    break
                fi
            done
        fi

        # Extract frame number from (NNN) pattern
        if [[ "$line" =~ \(([0-9]+)\) ]]; then
            CURRENT_FRAME=${BASH_REMATCH[1]}
            # Auto-start first comp if none detected yet
            if [ "$CURRENT_COMP_INDEX" -lt 0 ]; then
                CURRENT_COMP_INDEX=0
                COMP_STATUS[0]="rendering"
            fi
        fi
    done <<< "$new_lines"
}

# Initial draw
draw_render_progress

# Start aerender in background, output to log
"$AERENDER" -project "$PROJECT" > "$RENDER_LOG" 2>&1 &
AE_PID=$!

# Poll for progress
while kill -0 "$AE_PID" 2>/dev/null; do
    parse_new_lines
    draw_render_progress
    sleep 0.4
done

wait "$AE_PID"
RENDER_EXIT=$?

# Final parse
parse_new_lines

# Mark all comps as done
for ((i=0; i<COMP_COUNT; i++)); do
    if [ "${COMP_STATUS[$i]}" != "done" ]; then
        if [ "${COMP_STATUS[$i]}" = "rendering" ]; then
            COMPLETED_FRAMES=$((COMPLETED_FRAMES + ${COMP_FRAMES[$i]}))
        fi
        COMP_STATUS[$i]="done"
    fi
done
CURRENT_FRAME=0
draw_render_progress

RENDER_END=$(date +%s)
RENDER_TIME=$((RENDER_END - RENDER_START))

if [ "$RENDER_EXIT" -ne 0 ]; then
    printf "  ${RED}ERROR: Render failed (exit code $RENDER_EXIT)${RESET}\n"
    echo ""
    echo "  aerender output:"
    echo "  ────────────────────────────────────────"
    tail -20 "$RENDER_LOG" | sed 's/^/  /'
    echo "  ────────────────────────────────────────"
    echo ""
    read -p "  Press Enter to close..."
    exit 1
fi

printf "  ${GREEN}Render complete!${RESET} (%s)\n\n" "$(format_time $RENDER_TIME)"
rm -f "$RENDER_LOG"

# ============================================================
# UPLOAD PHASE
# ============================================================

if [ "$DO_UPLOAD" = "1" ]; then

    # Scan output folder
    FILE_LIST=$(mktemp /tmp/ae_upload_list_XXXXXX)
    find "$OUTPUT_FOLDER" -type f | sort > "$FILE_LIST"
    FILE_COUNT=$(wc -l < "$FILE_LIST" | tr -d ' ')

    if [ "$FILE_COUNT" -eq 0 ]; then
        printf "  ${YELLOW}No rendered files found in output folder.${RESET}\n"
        printf "  Upload skipped.\n\n"
        read -p "  Press Enter to close..."
        exit 0
    fi

    # Calculate total size
    TOTAL_BYTES=0
    while IFS= read -r file; do
        fsize=$(stat -f%z "$file" 2>/dev/null || echo 0)
        TOTAL_BYTES=$((TOTAL_BYTES + fsize))
    done < "$FILE_LIST"
    TOTAL_MB=$(format_mb $TOTAL_BYTES)

    UPLOADED_BYTES=0
    UPLOADED_COUNT=0
    UPLOAD_ERRORS=0
    UPLOAD_START=$(date +%s)
    FIRST_UPLOAD_DRAW=1

    # Upload display: header(1) + overall(1) + blank(1) + filename(1) + blank(1) = 5
    UPLOAD_DISPLAY_LINES=5

    draw_upload_progress() {
        local current_file="$1"

        if [ "$FIRST_UPLOAD_DRAW" = "0" ]; then
            printf "\033[${UPLOAD_DISPLAY_LINES}A"
        fi
        FIRST_UPLOAD_DRAW=0

        local uploaded_mb
        uploaded_mb=$(format_mb $UPLOADED_BYTES)

        printf "${CLR}  ${BOLD}UPLOAD PROGRESS${RESET}\n"
        printf "${CLR}  Overall: "
        draw_bar "$UPLOADED_BYTES" "$TOTAL_BYTES"
        printf "  %s / %s MB\n" "$uploaded_mb" "$TOTAL_MB"
        printf "${CLR}\n"
        printf "${CLR}  Uploading [%d/%d]: %s\n" "$((UPLOADED_COUNT + UPLOAD_ERRORS + 1))" "$FILE_COUNT" "$current_file"
        printf "${CLR}\n"
    }

    get_ftp_timestamp() {
        local file="$1"
        local mtime
        mtime=$(stat -f%m "$file")
        date -u -r "$mtime" "+%Y%m%d%H%M%S"
    }

    # Create netrc file for secure credential passing (avoids shell escaping issues)
    NETRC_FILE=$(mktemp /tmp/ae_netrc_XXXXXX)
    chmod 600 "$NETRC_FILE"
    printf "machine %s login %s password %s\n" "$FTP_HOST" "$FTP_USER" "$FTP_PASS" > "$NETRC_FILE"

    # Upload each file
    while IFS= read -r file; do
        rel_path="${file#$OUTPUT_FOLDER/}"
        remote_path="$REMOTE_BASE/$rel_path"
        filename=$(basename "$remote_path")
        fsize=$(stat -f%z "$file" 2>/dev/null || echo 0)
        mod_time=$(get_ftp_timestamp "$file")

        draw_upload_progress "$rel_path"

        # Build curl command
        url="ftp://${FTP_HOST}:${FTP_PORT}/${remote_path}"
        # Use -sS (silent + show errors) to keep the ANSI progress display clean
        # shellcheck disable=SC2086
        curl -sS $TLS_FLAGS \
            --netrc-file "$NETRC_FILE" \
            --ftp-create-dirs \
            -Q "-*MFMT ${mod_time} /${remote_path}" \
            -Q "-*MFMT ${mod_time} ${filename}" \
            -Q "-*SITE UTIME ${filename} ${mod_time} ${mod_time} ${mod_time} UTC" \
            -T "$file" \
            "$url" 2>&1

        if [ $? -eq 0 ]; then
            UPLOADED_BYTES=$((UPLOADED_BYTES + fsize))
            UPLOADED_COUNT=$((UPLOADED_COUNT + 1))
        else
            UPLOAD_ERRORS=$((UPLOAD_ERRORS + 1))
        fi
    done < "$FILE_LIST"

    # Final upload draw
    FIRST_UPLOAD_DRAW=0
    printf "\033[${UPLOAD_DISPLAY_LINES}A"
    uploaded_mb=$(format_mb $UPLOADED_BYTES)

    printf "${CLR}  ${BOLD}UPLOAD PROGRESS${RESET}\n"
    printf "${CLR}  Overall: "
    draw_bar "$UPLOADED_BYTES" "$TOTAL_BYTES"
    printf "  %s / %s MB\n" "$uploaded_mb" "$TOTAL_MB"
    printf "${CLR}\n"
    if [ "$UPLOAD_ERRORS" -gt 0 ]; then
        printf "${CLR}  ${RED}%d file(s) failed to upload${RESET}\n" "$UPLOAD_ERRORS"
    else
        printf "${CLR}  ${GREEN}All files uploaded successfully${RESET}\n"
    fi
    printf "${CLR}\n"

    UPLOAD_END=$(date +%s)
    UPLOAD_TIME=$((UPLOAD_END - UPLOAD_START))

    rm -f "$FILE_LIST"
fi

# ============================================================
# SUMMARY
# ============================================================

TOTAL_END=$(date +%s)
TOTAL_TIME=$((TOTAL_END - RENDER_START))

echo ""
echo "  ════════════════════════════════════════════════════"
printf "  ${BOLD}${GREEN}COMPLETE${RESET}\n"
printf "  Rendered: %d composition(s) (%d frames) in %s\n" "$COMP_COUNT" "$TOTAL_FRAMES" "$(format_time $RENDER_TIME)"
if [ "$DO_UPLOAD" = "1" ]; then
    printf "  Uploaded: %d/%d files (%s MB) in %s\n" "$UPLOADED_COUNT" "$FILE_COUNT" "$(format_mb $UPLOADED_BYTES)" "$(format_time $UPLOAD_TIME)"
    if [ "$UPLOAD_ERRORS" -gt 0 ]; then
        printf "  ${RED}Errors:  %d file(s) failed${RESET}\n" "$UPLOAD_ERRORS"
    fi
fi
printf "  Total time: %s\n" "$(format_time $TOTAL_TIME)"
echo "  ════════════════════════════════════════════════════"
echo ""

# Cleanup handled by EXIT trap

read -p "  Press Enter to close..."
