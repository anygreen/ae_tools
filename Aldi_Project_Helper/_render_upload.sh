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
    [ -n "$CURL_PID" ] && kill "$CURL_PID" 2>/dev/null
    rm -f "$CONFIG_FILE" "$RENDER_LOG" "$FILE_LIST" "$NETRC_FILE" "$CURL_STDOUT" 2>/dev/null
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

    # Build file info arrays
    UF_PATHS=()
    UF_RELS=()
    UF_SIZES=()
    UF_STATUS=()     # waiting | uploading | done | error
    UF_SPEED_MB=()   # "12.3" after completion
    UF_TIME_STR=()   # "1.2s" after completion

    TOTAL_BYTES=0
    uf_idx=0
    while IFS= read -r uf_line; do
        uf_sz=$(stat -f%z "$uf_line" 2>/dev/null || echo 0)
        UF_PATHS[$uf_idx]="$uf_line"
        UF_RELS[$uf_idx]="${uf_line#$OUTPUT_FOLDER/}"
        UF_SIZES[$uf_idx]=$uf_sz
        UF_STATUS[$uf_idx]="waiting"
        UF_SPEED_MB[$uf_idx]=""
        UF_TIME_STR[$uf_idx]=""
        TOTAL_BYTES=$((TOTAL_BYTES + uf_sz))
        uf_idx=$((uf_idx + 1))
    done < "$FILE_LIST"
    TOTAL_MB=$(format_mb $TOTAL_BYTES)

    UPLOADED_BYTES=0
    UPLOADED_COUNT=0
    UPLOAD_ERRORS=0
    UPLOAD_START=$(date +%s)
    FIRST_UPLOAD_DRAW=1
    CURRENT_UF_START=0

    # Display height: header(1) + overall(1) + blank(1) + files(N) + blank(1)
    UPLOAD_DISPLAY_LINES=$((4 + FILE_COUNT))

    format_curl_time() {
        # Format float seconds from curl -w into human-readable string
        awk -v t="${1:-0}" 'BEGIN { t+=0; if (t<60) printf "%.1fs", t; else printf "%dm %ds", int(t/60), int(t)%60 }'
    }

    draw_upload_progress() {
        if [ "$FIRST_UPLOAD_DRAW" = "0" ]; then
            printf "\033[${UPLOAD_DISPLAY_LINES}A"
        fi
        FIRST_UPLOAD_DRAW=0

        local uploaded_mb
        uploaded_mb=$(format_mb $UPLOADED_BYTES)
        local elapsed=$(($(date +%s) - UPLOAD_START))
        local speed_str=""
        if [ "$elapsed" -gt 0 ] && [ "$UPLOADED_BYTES" -gt 0 ]; then
            speed_str="  •  $(awk -v b="$UPLOADED_BYTES" -v t="$elapsed" 'BEGIN { printf "%.1f", b / t / 1048576 }') MB/s"
        fi

        printf "${CLR}  ${BOLD}UPLOAD PROGRESS${RESET}\n"
        printf "${CLR}  Overall: "
        draw_bar "$UPLOADED_BYTES" "$TOTAL_BYTES"
        printf "  %s / %s MB%s\n" "$uploaded_mb" "$TOTAL_MB" "$speed_str"
        printf "${CLR}\n"

        local i
        for ((i=0; i<FILE_COUNT; i++)); do
            local st="${UF_STATUS[$i]}"
            local name
            name=$(basename "${UF_RELS[$i]}")
            local smb
            smb=$(format_mb ${UF_SIZES[$i]})

            if [ "$st" = "done" ]; then
                printf "${CLR}  ${GREEN}✓${RESET} %-45s %7s MB  %6s MB/s  %s\n" \
                    "$name" "$smb" "${UF_SPEED_MB[$i]}" "${UF_TIME_STR[$i]}"
            elif [ "$st" = "uploading" ]; then
                local uf_elapsed=$(($(date +%s) - CURRENT_UF_START))
                printf "${CLR}  ${YELLOW}▶${RESET} %-45s %7s MB  uploading... %s\n" \
                    "$name" "$smb" "$(format_time $uf_elapsed)"
            elif [ "$st" = "error" ]; then
                printf "${CLR}  ${RED}✗${RESET} %-45s %7s MB  error\n" "$name" "$smb"
            else
                printf "${CLR}  ${GRAY}·${RESET} %-45s %7s MB\n" "$name" "$smb"
            fi
        done

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

    CURL_STDOUT=$(mktemp /tmp/ae_curl_out_XXXXXX)

    # Initial draw
    draw_upload_progress

    # Upload each file
    for ((fi=0; fi<FILE_COUNT; fi++)); do
        uf_file="${UF_PATHS[$fi]}"
        uf_rel="${UF_RELS[$fi]}"
        uf_remote="$REMOTE_BASE/$uf_rel"
        uf_fname=$(basename "$uf_remote")
        uf_fsize=${UF_SIZES[$fi]}
        uf_mtime=$(get_ftp_timestamp "$uf_file")

        UF_STATUS[$fi]="uploading"
        CURRENT_UF_START=$(date +%s)
        draw_upload_progress

        uf_url="ftp://${FTP_HOST}:${FTP_PORT}/${uf_remote}"

        # Upload in background with -w for post-transfer stats
        : > "$CURL_STDOUT"
        # shellcheck disable=SC2086
        curl -sS $TLS_FLAGS \
            --netrc-file "$NETRC_FILE" \
            --ftp-create-dirs \
            -Q "-*MFMT ${uf_mtime} /${uf_remote}" \
            -Q "-*MFMT ${uf_mtime} ${uf_fname}" \
            -Q "-*SITE UTIME ${uf_fname} ${uf_mtime} ${uf_mtime} ${uf_mtime} UTC" \
            -T "$uf_file" \
            -w '\n%{speed_upload} %{time_total}' \
            "$uf_url" > "$CURL_STDOUT" 2>&1 &
        CURL_PID=$!

        # Monitor while uploading
        while kill -0 "$CURL_PID" 2>/dev/null; do
            draw_upload_progress
            sleep 0.4
        done

        wait "$CURL_PID"
        curl_exit=$?
        CURL_PID=""

        if [ "$curl_exit" -eq 0 ]; then
            UPLOADED_BYTES=$((UPLOADED_BYTES + uf_fsize))
            UPLOADED_COUNT=$((UPLOADED_COUNT + 1))
            UF_STATUS[$fi]="done"
            # Parse -w output (last line): "speed_bytes time_secs"
            uf_stats=$(tail -1 "$CURL_STDOUT")
            uf_speed_bytes=$(echo "$uf_stats" | awk '{print $1}')
            UF_SPEED_MB[$fi]=$(awk -v s="${uf_speed_bytes:-0}" 'BEGIN { printf "%.1f", s / 1048576 }')
            uf_time_secs=$(echo "$uf_stats" | awk '{print $2}')
            UF_TIME_STR[$fi]=$(format_curl_time "$uf_time_secs")
        else
            UPLOAD_ERRORS=$((UPLOAD_ERRORS + 1))
            UF_STATUS[$fi]="error"
        fi

        draw_upload_progress
    done

    UPLOAD_END=$(date +%s)
    UPLOAD_TIME=$((UPLOAD_END - UPLOAD_START))

    rm -f "$FILE_LIST" "$CURL_STDOUT"
    CURL_STDOUT=""
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
