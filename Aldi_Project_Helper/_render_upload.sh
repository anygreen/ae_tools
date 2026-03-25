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

# Fix bare CR line endings from ExtendScript (macOS defaults to Classic Mac \r).
# Use octal escapes (\015=CR, \012=LF) for maximum compatibility with BSD tr.
tr '\015' '\012' < "$CONFIG_FILE" > "${CONFIG_FILE}.fixed"
mv "${CONFIG_FILE}.fixed" "$CONFIG_FILE"

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
    printf "\033[?7h" 2>/dev/null   # re-enable line wrapping
    [ -n "$CURL_PID" ] && kill "$CURL_PID" 2>/dev/null
    rm -f "$CONFIG_FILE" "$RENDER_LOG" "$FILE_LIST" "$NETRC_FILE" \
          "$CURL_PROGRESS" "$CURL_EXIT_FILE" "$CURL_CMD" 2>/dev/null
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
    printf "\033[?7l"   # disable line wrapping to prevent cursor-up miscounts
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
    printf "\033[?7h"   # re-enable line wrapping
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

    # Build file info arrays
    UF_PATHS=()
    UF_RELS=()
    UF_SIZES=()
    UF_DISP=()        # truncated display names (max 30 chars)
    UF_RESULT_OK=()    # "1" or "0" after upload
    UF_RESULT_SPEED=() # "2.3" after upload
    UF_RESULT_TIME=()  # "35s" after upload

    TOTAL_BYTES=0
    uf_idx=0
    while IFS= read -r uf_line; do
        uf_sz=$(stat -f%z "$uf_line" 2>/dev/null || echo 0)
        uf_bn=$(basename "$uf_line")
        UF_PATHS[$uf_idx]="$uf_line"
        UF_RELS[$uf_idx]="${uf_line#$OUTPUT_FOLDER/}"
        UF_SIZES[$uf_idx]=$uf_sz
        if [ ${#uf_bn} -gt 30 ]; then
            UF_DISP[$uf_idx]="...${uf_bn: -27}"
        else
            UF_DISP[$uf_idx]="$uf_bn"
        fi
        TOTAL_BYTES=$((TOTAL_BYTES + uf_sz))
        uf_idx=$((uf_idx + 1))
    done < "$FILE_LIST"
    TOTAL_MB=$(format_mb $TOTAL_BYTES)

    UPLOADED_BYTES=0
    UPLOADED_COUNT=0
    UPLOAD_ERRORS=0
    UPLOAD_START=$(date +%s)

    get_ftp_timestamp() {
        local file="$1"
        local mtime
        mtime=$(stat -f%m "$file")
        date -u -r "$mtime" "+%Y%m%d%H%M%S"
    }

    parse_upload_pct() {
        # Parse percentage from curl --progress-bar output captured by script.
        # curl writes: "###...  XX.X%" with \r between updates.
        [ ! -s "$CURL_PROGRESS" ] && echo "0" && return
        local pct
        pct=$(tail -c 500 "$CURL_PROGRESS" 2>/dev/null | \
            tr '\r' '\n' | \
            grep -oE '[0-9]+\.[0-9]' | \
            tail -1)
        if [ -n "$pct" ]; then
            printf "%.0f" "$pct" 2>/dev/null || echo "0"
        else
            echo "0"
        fi
    }

    # Create temp files
    NETRC_FILE=$(mktemp /tmp/ae_netrc_XXXXXX)
    chmod 600 "$NETRC_FILE"
    printf "machine %s login %s password %s\n" "$FTP_HOST" "$FTP_USER" "$FTP_PASS" > "$NETRC_FILE"

    CURL_PROGRESS=$(mktemp /tmp/ae_curl_prog_XXXXXX)
    CURL_EXIT_FILE=$(mktemp /tmp/ae_curl_exit_XXXXXX)
    CURL_CMD=$(mktemp /tmp/ae_curl_cmd_XXXXXX.sh)
    chmod +x "$CURL_CMD"

    # Per-file upload status for display (mirrors render phase approach)
    UF_STATUS=()
    for ((uf_i=0; uf_i<FILE_COUNT; uf_i++)); do
        UF_STATUS[$uf_i]="waiting"
    done

    # Display height: header(1) + blank(1) + files(N) + blank(1) + overall(1) + current(1) + blank(1)
    UPLOAD_DISPLAY_LINES=$((FILE_COUNT + 6))
    FIRST_UPLOAD_DRAW=1
    CUR_FILE_SIZE=0
    CUR_FILE_START=0
    CUR_FILE_IDX=0
    CUR_FILE_SHORT=""

    draw_upload_progress() {
        printf "\033[?7l"   # disable line wrapping — prevents cursor-up miscounts
        if [ "$FIRST_UPLOAD_DRAW" = "0" ]; then
            printf "\033[${UPLOAD_DISPLAY_LINES}A"
        fi
        FIRST_UPLOAD_DRAW=0

        # Estimate bytes sent for current file from progress percentage
        local cur_pct
        cur_pct=$(parse_upload_pct)
        local cur_bytes=$((CUR_FILE_SIZE * cur_pct / 100))
        local total_now=$((UPLOADED_BYTES + cur_bytes))

        printf "${CLR}  ${BOLD}UPLOAD PROGRESS${RESET}\n"
        printf "${CLR}\n"

        # File list
        local i
        for ((i=0; i<FILE_COUNT; i++)); do
            local name="${UF_DISP[$i]}"
            local smb
            smb=$(format_mb ${UF_SIZES[$i]})
            local status="${UF_STATUS[$i]}"

            if [ "$status" = "done" ]; then
                printf "${CLR}  ${GREEN}✓${RESET} %-30s %7s MB  %5s MB/s  %s\n" \
                    "$name" "$smb" "${UF_RESULT_SPEED[$i]}" "${UF_RESULT_TIME[$i]}"
            elif [ "$status" = "error" ]; then
                printf "${CLR}  ${RED}✗${RESET} %-30s %7s MB  error\n" "$name" "$smb"
            elif [ "$status" = "uploading" ]; then
                printf "${CLR}  ${YELLOW}▶${RESET} %-30s %7s MB  uploading...\n" "$name" "$smb"
            else
                printf "${CLR}  ${GRAY}·${RESET} %-30s %7s MB  waiting\n" "$name" "$smb"
            fi
        done

        printf "${CLR}\n"

        # Overall progress bar
        local up_mb
        up_mb=$(format_mb $total_now)
        local elapsed=$(($(date +%s) - UPLOAD_START))
        local speed_str=""
        if [ "$elapsed" -gt 0 ] && [ "$total_now" -gt 0 ]; then
            speed_str="  $(awk -v b="$total_now" -v t="$elapsed" \
                'BEGIN { printf "%.1f", b / t / 1048576 }') MB/s"
        fi
        printf "${CLR}  Overall  "
        draw_bar "$total_now" "$TOTAL_BYTES" 30
        printf "  %s/%s MB%s\n" "$up_mb" "$TOTAL_MB" "$speed_str"

        # Current file progress bar
        local file_elapsed=$(($(date +%s) - CUR_FILE_START))
        local file_speed=""
        if [ "$file_elapsed" -gt 0 ] && [ "$cur_bytes" -gt 0 ]; then
            file_speed="$(awk -v b="$cur_bytes" -v t="$file_elapsed" \
                'BEGIN { printf "%.1f", b / t / 1048576 }') MB/s"
        fi
        printf "${CLR}  [%d/%d]   " "$((CUR_FILE_IDX + 1))" "$FILE_COUNT"
        draw_bar "$cur_bytes" "$CUR_FILE_SIZE" 30
        printf "  %-16s %s\n" "$CUR_FILE_SHORT" "$file_speed"

        printf "${CLR}\n"
        printf "\033[?7h"   # re-enable line wrapping
    }

    printf "\n"

    # Upload each file
    for ((fi=0; fi<FILE_COUNT; fi++)); do
        uf_file="${UF_PATHS[$fi]}"
        uf_rel="${UF_RELS[$fi]}"
        uf_remote="$REMOTE_BASE/$uf_rel"
        uf_fname=$(basename "$uf_remote")
        uf_fsize=${UF_SIZES[$fi]}
        uf_mtime=$(get_ftp_timestamp "$uf_file")

        # Update status
        UF_STATUS[$fi]="uploading"

        # Set current file info for draw_upload_progress
        CUR_FILE_IDX=$fi
        CUR_FILE_SIZE=$uf_fsize
        CUR_FILE_START=$(date +%s)
        CUR_FILE_SHORT=$(basename "$uf_rel")
        if [ ${#CUR_FILE_SHORT} -gt 16 ]; then
            CUR_FILE_SHORT="...${CUR_FILE_SHORT: -13}"
        fi

        # Generate curl command script (heredoc expands vars at write time)
        uf_url="ftp://${FTP_HOST}:${FTP_PORT}/${uf_remote}"
        echo "255" > "$CURL_EXIT_FILE"
        cat > "$CURL_CMD" << CURLEOF
#!/bin/bash
curl --progress-bar $TLS_FLAGS \
    --netrc-file "$NETRC_FILE" \
    --ftp-create-dirs \
    -Q "-*MFMT ${uf_mtime} /${uf_remote}" \
    -Q "-*MFMT ${uf_mtime} ${uf_fname}" \
    -Q "-*SITE UTIME ${uf_fname} ${uf_mtime} ${uf_mtime} ${uf_mtime} UTC" \
    -T "$uf_file" \
    "$uf_url"
echo \$? > "$CURL_EXIT_FILE"
CURLEOF

        # Run curl via script to capture progress from pseudo-TTY
        : > "$CURL_PROGRESS"
        script -q "$CURL_PROGRESS" "$CURL_CMD" > /dev/null 2>&1 &
        CURL_PID=$!

        # Monitor with live progress
        while kill -0 "$CURL_PID" 2>/dev/null; do
            draw_upload_progress
            sleep 0.4
        done
        wait "$CURL_PID" 2>/dev/null
        CURL_PID=""

        # Get exit code from file (script doesn't propagate reliably)
        curl_exit=$(cat "$CURL_EXIT_FILE" 2>/dev/null)
        curl_exit=${curl_exit:-255}

        uf_elapsed=$(( $(date +%s) - CUR_FILE_START ))
        if [ "$curl_exit" = "0" ]; then
            UPLOADED_BYTES=$((UPLOADED_BYTES + uf_fsize))
            UPLOADED_COUNT=$((UPLOADED_COUNT + 1))
            UF_STATUS[$fi]="done"
            UF_RESULT_OK[$fi]="1"
            if [ "$uf_elapsed" -gt 0 ]; then
                UF_RESULT_SPEED[$fi]=$(awk -v s="$uf_fsize" -v t="$uf_elapsed" \
                    'BEGIN { printf "%.1f", s / t / 1048576 }')
            else
                UF_RESULT_SPEED[$fi]="--"
            fi
            UF_RESULT_TIME[$fi]=$(format_time $uf_elapsed)
        else
            UPLOAD_ERRORS=$((UPLOAD_ERRORS + 1))
            UF_STATUS[$fi]="error"
            UF_RESULT_OK[$fi]="0"
            UF_RESULT_SPEED[$fi]=""
            UF_RESULT_TIME[$fi]=""
        fi
    done

    # Final redraw with all files complete
    draw_upload_progress

    UPLOAD_END=$(date +%s)
    UPLOAD_TIME=$((UPLOAD_END - UPLOAD_START))

    rm -f "$FILE_LIST" "$CURL_PROGRESS" "$CURL_EXIT_FILE" "$CURL_CMD"
    CURL_PROGRESS=""
    CURL_EXIT_FILE=""
    CURL_CMD=""
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
    avg_speed=""
    if [ "$UPLOAD_TIME" -gt 0 ]; then
        avg_speed=" ($(awk -v b="$UPLOADED_BYTES" -v t="$UPLOAD_TIME" 'BEGIN { printf "%.1f", b / t / 1048576 }') MB/s)"
    fi
    printf "  Uploaded: %d/%d files (%s MB) in %s%s\n" "$UPLOADED_COUNT" "$FILE_COUNT" "$(format_mb $UPLOADED_BYTES)" "$(format_time $UPLOAD_TIME)" "$avg_speed"
    if [ "$UPLOAD_ERRORS" -gt 0 ]; then
        printf "  ${RED}Errors:  %d file(s) failed${RESET}\n" "$UPLOAD_ERRORS"
    fi
fi
printf "  Total time: %s\n" "$(format_time $TOTAL_TIME)"
echo "  ════════════════════════════════════════════════════"
echo ""

# Cleanup handled by EXIT trap

read -p "  Press Enter to close..."
