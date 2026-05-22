# Aldi Project Helper

ScriptUI panel for After Effects that manages Aldi video projects: project list, sub-project switching, version-up workflows, render-queue setup, and FTP sync.

## Files in this folder

| File | Role |
|---|---|
| `Aldi_Project_Helper_V2.jsx` | Main panel. Builds the UI, manages state, and handles all button clicks. |
| `_ftp.jsx` | Included by the main script. Holds all FTP helpers (curl wrappers, listing, upload, download, sync compare) and the external-launcher helpers. |
| `_render_upload.sh` | macOS background helper. Reads a temp config file and runs `aerender` → optional FTP upload in Terminal. |
| `_render_upload.ps1` | Windows equivalent of `_render_upload.sh`. Runs via PowerShell from a one-shot VBScript launcher. |
| `_ftp_sync.sh` / `_ftp_sync.ps1` | Background FTP sync helpers, launched when the "Sync" button is set to **CLI** mode. |
| `AldiProjectHelper_FTP.txt` | Template installed (via anyUpdater, with `skipIfExists`) to `~/Documents/AldiProjectHelper_FTP.txt`. Stores per-project FTP credentials. |

## Folder conventions the script assumes

For a project rooted at `<projectPath>`:

| Path | Purpose |
|---|---|
| `<projectPath>/06_vfx/02_ae/` | Where AEP files live. Sub-projects = subfolders here that themselves contain KW folders or AEPs. Flat or KW-only layouts (AEPs/KW folders directly under `02_ae`) are also supported — in that case there are no sub-projects. |
| `<projectPath>/06_vfx/03_out/` | Where renders go. Render output paths are `03_out/[<subProject>/]<YYMMDD>/<HHhMM>/<filename>`. |
| `<projectPath>/01_inbox/` | FTP "Input" sync target. |

KW folders are named `KW##` (e.g. `KW17`). Sub-project detection ignores `Adobe After Effects Auto-Save`.

## UI structure

```
TabbedPanel
├── Project tab
│   ├── Initials (2 lowercase letters, persisted)
│   ├── Active Project dropdown + add/remove buttons
│   ├── Sub-project dropdown (disabled when none detected)
│   ├── Most-recent .aep name + mod date
│   └── Refresh / Open File / Open Folder
└── Export & Sync tab
    ├── Project context label (mirrors current selection)
    ├── Version Up:  [AEP] [Comp] [New KW]
    ├── Render:      [Create Folders and Render]
    │                [Create Folders, Render and Upload]
    ├── FTP Sync:    Input/Output · Latest/Latest 5 · FTPS/FTP · Ae/CLI
    │                [x] Restrict to sub-project  [Sync]
    └── Progress bar + status text (used by Ae-mode sync and FTP test)
```

## Settings persistence

All settings live under the `AldiProjectHelper` section of AE prefs via `app.settings`. Saved keys: `initials`, `lastProject`, `projectList` (encoded as `name|path;name|path;...`), `ftpProtocol`, `ftpVia`, `ftpRestrictToSubProject`.

## Key flows

### Project / sub-project detection
- `loadProjectList()` reads the encoded project list from prefs.
- `detectSubProjects(aeFolder)` returns subfolders of `02_ae` that themselves contain a KW folder or `.aep`. Empty list = flat or KW-only project.
- `findMostRecentAEP(projectPath, subProject)` recursively scans for `.aep` files (excluding auto-save folders) and returns the newest by mtime.
- `findSubProjectWithMostRecent(...)` picks the sub-project containing the newest AEP — used to auto-select the right sub-project on refresh.

### Filename processing
`processFileName(originalName, options)` is the workhorse for all three Version Up buttons. It parses an underscore-separated filename and updates:
- **Date**: 6-digit `2YYMMDD` segment → today. Prompts to prepend if missing.
- **Version**: rightmost numeric segment (≥2 digits, not the date) → incremented, or reset to 1 if `options.resetVersion`.
- **Initials**: 2-letter lowercase segment → replaced. Prompts to append if missing.
- **KW**: `KW##` segment → replaced with `options.newKW`.

Returns `{oldName, newName, has*Change, …}` or `null` if nothing changed. The modal dialogs use `createHighlightedText()` / `createComparisonGroup()` to show old → new with the changed segments highlighted red+bold.

### AEP / Comp / New KW buttons
- **AEP**: increments the open project's filename version and `app.project.save()`s under the new name in the same folder.
- **Comp**: duplicates each selected `CompItem` with the incremented name. If "Move original to _old" is checked, the originals are moved into a sibling `_old` folder (created on demand).
- **New KW**: derives the next KW number from the open file's path, creates `<KW++>` next to the current KW folder, resets version to 1, and saves the project there. Removes the new KW folder on cancel if it's empty.

### Project match check (`checkProjectMatch()`)
Before any render / sync operation, the script verifies that the open AE project file lives under the tool's selected project (and sub-project, if any). On mismatch it shows a dialog with Cancel / Continue / Switch (if a matching project is detected). Without this, a render would write to the wrong project's output folder.

### Render queue setup (`setupRenderOutput()`)
Shared by both render buttons:
1. Validates queued items exist.
2. Determines the render sub-project (selected → open-file path → modal prompt).
3. Creates `03_out/[subProject/]<YYMMDD>/<HHhMM>/` if missing.
4. Rewrites every queued output module's `file` to point inside the new time folder (preserving the filename).
5. Returns `{timeFolderPath, simplifiedPath, renderSubProject, dateFolder, timeFolder, activeItems, outputCount, projectPath, projectName, renderQueue}`.

### Background render flow — the `_renderTMP` copy

**Problem (pre-v2.3.1):** the script saved the open AEP with active queue items, launched `aerender` against it, then deactivated the queue items in memory. If the user switched to another project, AE would prompt-save the deactivated state over the file `aerender` was about to open → `aerender` opens a file with nothing in the queue and exits.

**Solution (v2.3.1+):** the open AEP is never the one `aerender` consumes. `prepareRenderTMPFile(setup)` does:

1. `app.project.save(originalFile)` — write active-queue state to the original `.aep`.
2. `originalFile.copy("<name>_renderTMP.aep")` — duplicate that file on disk.
3. Deactivate every queued item (`item.render = false`).
4. `app.project.save(originalFile)` — overwrite the original with the deactivated state.

The user is left with their original file open at its original path, holding deactivated queue items — safe to keep editing. The `_renderTMP.aep` copy sits on disk, untouched by AE.

`launchExternalRender(setup, ftpConfig, renderProjectPath)` is then called with the `_renderTMP` path. It writes a config file that the helper script reads, including `DELETE_PROJECT_AFTER=1`. The helper script (`_render_upload.sh` / `.ps1`) deletes the `_renderTMP.aep` in its exit cleanup, so the temp copy is always removed — on success, render-failure, or interrupt.

If launching fails after `prepareRenderTMPFile()` ran, the caller calls `restoreActiveItemsOnError(setup)` to re-activate the items so the user isn't left with a silently-disabled queue.

### Background render — config file format
`generateRenderConfig()` in `_ftp.jsx` writes a temp `ae_render_config_<ts>.txt` (Unix LF) with `KEY=value` lines. Both helper scripts parse it the same way.

| Key | Notes |
|---|---|
| `AERENDER` | Absolute path to `aerender` binary. |
| `PROJECT` | The `_renderTMP.aep` path. |
| `DELETE_PROJECT_AFTER` | `1` → helper deletes `PROJECT` on exit. |
| `OUTPUT_FOLDER` | Full path to the time folder created by `setupRenderOutput()`. |
| `DO_UPLOAD` | `1` to upload after rendering, `0` for render-only. |
| `FTP_HOST`, `FTP_PORT`, `FTP_USER`, `FTP_PASS` | FTP creds (only when `DO_UPLOAD=1`). |
| `USE_FTPS` | `1` for explicit FTPS (AUTH TLS), `0` for plain FTP. |
| `TLS_FLAGS` | curl flags from `getTLSFlags()` (`--ssl-reqd -k` etc.). |
| `REMOTE_BASE` | FTP target dir `06_vfx/03_out[/<subProject>]/<date>/<time>`. |
| `COMP_<n>` | `<compName>::<frames>` — one per active item, used to render the progress bar. |
| `COMP_COUNT`, `TOTAL_FRAMES`, `SIMPLIFIED_PATH` | UI/summary fields. |

The helper scripts run `aerender -project "$PROJECT"`, parse `PROGRESS` lines + `(NNN)` frame numbers from the log, draw a live in-terminal progress bar, then (if `DO_UPLOAD=1`) iterate the output folder and `curl -T` each file to `REMOTE_BASE/<rel>`, setting the FTP mtime via `MFMT`/`SITE UTIME`. The bash helper URL-encodes the upload path via `python3`; the PowerShell version does its own encoding.

### FTP sync flow (Sync button)
- **Ae mode** (blocks UI): tests connection (`testFTPConnection`), scans local + remote date folders for each "scan root" (input has one or many; output is per-subproject when sub-projects exist), shows a confirm dialog listing files to upload/download, then iterates with progress bar.
- **CLI mode** (non-blocking): `launchExternalSync()` writes a sync config file and launches `_ftp_sync.{sh,ps1}` in a visible Terminal/PowerShell window.

`compareSyncFiles(localFiles, remoteFiles)` decides upload vs download by comparing mtimes — a remote file ≥ local wins (download), otherwise upload. Files matching `shouldSkipFile()` (`.DS_Store`, `Thumbs.db`, etc.) are ignored. Date folders are matched by `isDateFolder(name)` — `YYMMDD` six-digit names.

`getFTPConnectionForProject(projectName)` reads `~/Documents/AldiProjectHelper_FTP.txt` and finds the connection block whose `[project]` line matches. The file is template-installed on first install via the manifest's `skipIfExists` flag, so user edits survive updates.

## Versioning & releases

`SCRIPT_VERSION` at the top of `Aldi_Project_Helper_V2.jsx` must match the `version` for `aldi_project_helper` in `anyUpdater/manifest.json` (without the `v` prefix). The version list in the repo root `CLAUDE.md` must also match. anyUpdater compares the manifest version to the version stored in AE prefs to decide whether to update; the running script displays its own `SCRIPT_VERSION` in the title bar.

When changes touch any of the files listed in the manifest (`Aldi_Project_Helper_V2.jsx`, `_ftp.jsx`, `_render_upload.{sh,ps1}`, `_ftp_sync.{sh,ps1}`, `AldiProjectHelper_FTP.txt`), bump all three places together in one commit.

## Platform notes

- **macOS**: Terminal launched via `osascript`. Helper scripts are run through `bash` and `chmod +x`'d before launch. ExtendScript's `File.lineFeed = "Unix"` is set when writing configs, and the helpers additionally `tr '\015' '\012'` as a safety net (anyUpdater's writes use Classic Mac CRs).
- **Windows**: A one-shot `.vbs` is written to `%TEMP%` and run via `wscript //B`, which then launches PowerShell with `-ExecutionPolicy Bypass -NoProfile -File`. The VBS is deleted immediately after spawning.

## FTP TLS specifics

Explicit FTPS over port 21 (AUTH TLS). `getTLSFlags()` returns the curl flags:
- `--ssl-reqd` — require TLS for all operations
- `-k` — accept self-signed certs
- `--ssl-no-revoke` (Windows only) — skip Schannel CRL check
- `--tls-max 1.2` (Windows only) — pin TLS 1.2 for reliable Schannel handshake

Connection failures are detected via `getCurlError()` (greps `curl:` lines from stderr) and reported upfront by `testFTPConnection()` before any sync or upload starts.
