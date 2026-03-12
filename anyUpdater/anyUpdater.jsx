/**
 * anyUpdater
 *
 * Manages installation and updates of shared After Effects tools
 * from a private GitHub repository. Install this panel once;
 * it handles all other tool installs and updates automatically.
 *
 * The GitHub Personal Access Token is stored in AE preferences
 * and never written to any file or committed to the repository.
 *
 * @version 1.0.9
 */
(function createUI(thisObj) {

    // ============================================================
    // CONFIGURATION
    // ============================================================

    var SCRIPT_NAME   = "anyUpdater";
    var SCRIPT_VERSION = "v1.0.9";
    var SETTINGS_KEY  = "anyUpdater";
    var PAT_SETTING   = "github_pat";

    var GITHUB_OWNER  = "anygreen";
    var GITHUB_REPO   = "ae_tools";
    var GITHUB_BRANCH = "master";
    var MANIFEST_PATH = "anyUpdater/manifest.json";

    var IS_MAC = ($.os.indexOf("Mac") !== -1);

    // ============================================================
    // LOGGING  (~/Documents/anyUpdater_log.txt, appended each run)
    // ============================================================

    var LOG_FILE = null;

    function initLog() {
        try {
            var home = IS_MAC
                ? system.callSystem("echo $HOME").replace(/[\r\n]+$/, "")
                : new Folder("~").fsName;
            LOG_FILE = new File(home + "/Documents/anyUpdater_log.txt");
            LOG_FILE.encoding = "UTF-8";
            LOG_FILE.open("a");
            var d = new Date();
            LOG_FILE.writeln("\n========== anyUpdater " + SCRIPT_VERSION +
                             " — " + d.toString() + " ==========");
            LOG_FILE.close();
        } catch (e) { LOG_FILE = null; }
    }

    function log(msg) {
        if (!LOG_FILE) return;
        try {
            var d = new Date();
            var ts = d.getHours() + ":" +
                     (d.getMinutes()  < 10 ? "0" : "") + d.getMinutes()  + ":" +
                     (d.getSeconds()  < 10 ? "0" : "") + d.getSeconds()  + "." +
                     (d.getMilliseconds() < 100 ? (d.getMilliseconds() < 10 ? "00" : "0") : "") + d.getMilliseconds();
            LOG_FILE.encoding = "UTF-8";
            LOG_FILE.open("a");
            LOG_FILE.writeln("[" + ts + "] " + msg);
            LOG_FILE.close();
        } catch (e) {}
    }

    initLog();
    log("Script loaded. $.fileName = " + $.fileName);

    // ============================================================
    // PAT MANAGEMENT  (stored in AE preferences, never on disk)
    // ============================================================

    function getStoredPAT() {
        try {
            if (app.settings.haveSetting(SETTINGS_KEY, PAT_SETTING)) {
                return app.settings.getSetting(SETTINGS_KEY, PAT_SETTING);
            }
        } catch (e) {}
        return null;
    }

    function savePAT(pat) {
        try {
            app.settings.saveSetting(SETTINGS_KEY, PAT_SETTING, pat);
            return true;
        } catch (e) { return false; }
    }

    /**
     * Shows a dialog prompting the user to enter their GitHub PAT.
     * Pre-fills with the currently stored token if one exists.
     * @returns {string|null} The entered token, or null if cancelled.
     */
    function showPATDialog() {
        var dlg = new Window("dialog", "GitHub Access Token");
        dlg.orientation   = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.margins       = 16;
        dlg.spacing       = 10;
        dlg.preferredSize.width = 360;

        var instructions = dlg.add("statictext", undefined,
            "Enter a GitHub Personal Access Token with\nContents: Read access on the ae_tools repository.",
            {multiline: true});
        instructions.preferredSize = [328, 36];

        var inputField = dlg.add("edittext", undefined, getStoredPAT() || "");
        inputField.preferredSize = [328, 22];

        var btnGroup = dlg.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignment   = ["center", "top"];
        btnGroup.spacing     = 8;

        var saveBtn   = btnGroup.add("button", undefined, "Save",   {name: "ok"});
        var cancelBtn = btnGroup.add("button", undefined, "Cancel", {name: "cancel"});

        saveBtn.onClick = function () {
            if (inputField.text.replace(/^\s+|\s+$/g, "") === "") {
                alert("Please enter a token.");
                return;
            }
            dlg.close(1);
        };
        cancelBtn.onClick = function () { dlg.close(0); };

        if (dlg.show() === 1) {
            var val = inputField.text.replace(/^\s+|\s+$/g, "");
            savePAT(val);
            return val;
        }
        return null;
    }

    // ============================================================
    // UTILITY
    // ============================================================

    /**
     * Returns the ScriptUI Panels folder this script lives in.
     * Handles both install layouts:
     *   flat:      .../ScriptUI Panels/anyUpdater.jsx  (via "Install ScriptUI Panel")
     *   subfolder: .../ScriptUI Panels/anyUpdater/anyUpdater.jsx
     */
    function getScriptsPanelsFolder() {
        var thisFile = new File($.fileName);
        var parent   = thisFile.parent;
        // If running from a named subfolder, go up one extra level
        if (parent.name === SCRIPT_NAME) {
            log("getScriptsPanelsFolder: in subfolder, going up. folder = " + parent.parent.fsName);
            return parent.parent;
        }
        log("getScriptsPanelsFolder: flat install. folder = " + parent.fsName);
        return parent;
    }

    function getHomeFolder() {
        if (IS_MAC) {
            return system.callSystem("echo $HOME").replace(/[\r\n]+$/, "");
        } else {
            // Folder("~") resolves reliably on Windows without a shell round-trip
            return new Folder("~").fsName;
        }
    }

    function resolveLocalPath(localPath, panelsFolder) {
        if (localPath.charAt(0) === "~" && (localPath.charAt(1) === "/" || localPath.charAt(1) === "\\")) {
            return new File(getHomeFolder() + localPath.substring(1));
        }
        return new File(panelsFolder.fsName + "/" + localPath);
    }

    function normaliseFileEntry(entry) {
        if (typeof entry === "string") { return { repo: entry, local: entry, skipIfExists: false }; }
        return { repo: entry.repo, local: entry.local, skipIfExists: !!entry.skipIfExists };
    }

    function githubApiUrl(repoPath) {
        var encoded = repoPath.replace(/ /g, "%20");
        return "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO +
               "/contents/" + encoded + "?ref=" + GITHUB_BRANCH;
    }

    function curlGet(url, pat) {
        log("curlGet: START " + url);

        // Write to a temp file instead of capturing stdout.
        // system.callSystem() has a small output buffer (~32 KB); large files
        // cause curl to block forever waiting for the buffer to drain.
        var tmpPath = (IS_MAC ? "/tmp" : system.callSystem("echo %TEMP%").replace(/[\r\n]+$/, "")) +
                      "/anyUpdater_dl.tmp";
        var cmd = 'curl -s --connect-timeout 15 --max-time 120' +
                  ' -H "Authorization: token ' + pat + '"' +
                  ' -H "Accept: application/vnd.github.v3.raw"' +
                  ' -o "' + tmpPath + '"' +
                  ' "' + url + '"';
        system.callSystem(cmd);

        var tmpFile = new File(tmpPath);
        if (!tmpFile.exists) {
            log("curlGet: ERROR temp file not created: " + tmpPath);
            return null;
        }
        tmpFile.encoding = "UTF-8";
        tmpFile.open("r");
        var result = tmpFile.read();
        tmpFile.close();
        tmpFile.remove();

        var preview = result ? result.substring(0, 120).replace(/\n/g, "\\n") : "(empty)";
        log("curlGet: DONE  length=" + (result ? result.length : 0) + "  preview=" + preview);
        return result;
    }

    function parseJSON(str) {
        try { return eval("(" + str + ")"); } catch (e) { return null; }
    }

    function ensureFolderExists(folder) {
        if (folder.exists) return;
        var parent = new Folder(folder.parent.fsName);
        if (parent.fsName === folder.fsName) return; // reached filesystem root
        ensureFolderExists(parent);
        folder.create();
    }

    function writeFile(file, content) {
        log("writeFile: writing " + content.length + " bytes to " + file.fsName);
        ensureFolderExists(new Folder(file.parent.fsName));
        file.encoding = "UTF-8";
        if (!file.open("w")) { throw new Error("Cannot write to: " + file.fsName); }
        file.write(content);
        file.close();
        log("writeFile: done " + file.fsName);

        // Delete the companion .jsc bytecode cache if present.
        // AE compiles .jsx panels to .jsc on first load; if the .jsc exists it
        // takes priority over the .jsx, so the old version would keep loading
        // even after the .jsx is updated.
        if (file.fsName.slice(-4).toLowerCase() === ".jsx") {
            var jsc = new File(file.fsName.slice(0, -4) + ".jsc");
            if (jsc.exists) { jsc.remove(); }
        }
    }

    function deleteItem(fsPath) {
        var f = new File(fsPath);
        if (f.exists) { f.remove(); return; }
        var d = new Folder(fsPath);
        if (d.exists) {
            if (IS_MAC) {
                system.callSystem('rm -rf "' + fsPath + '"');
            } else {
                system.callSystem('rmdir /s /q "' + fsPath + '"');
            }
        }
    }

    /**
     * Deletes fsPath only if it is within the ScriptUI Panels folder,
     * preventing manifest remove entries from escaping the install root.
     */
    function safeDeleteItem(fsPath, panelsFolder) {
        var normalised = fsPath.replace(/\\/g, "/");
        var panelBase  = panelsFolder.fsName.replace(/\\/g, "/");
        if (normalised.indexOf(panelBase) !== 0) { return; }
        deleteItem(fsPath);
    }

    // ============================================================
    // VERSION PERSISTENCE  (stored in AE preferences)
    // ============================================================

    function getInstalledVersion(toolId) {
        try {
            if (app.settings.haveSetting(SETTINGS_KEY, toolId)) {
                var val = app.settings.getSetting(SETTINGS_KEY, toolId);
                if (val && val !== "") return val;
            }
        } catch (e) {}
        return null;
    }

    function saveInstalledVersion(toolId, version) {
        try { app.settings.saveSetting(SETTINGS_KEY, toolId, version); } catch (e) {}
    }

    // ============================================================
    // UPDATE LOGIC
    // ============================================================

    function fetchManifest(pat) {
        log("fetchManifest: fetching " + MANIFEST_PATH);
        var raw = curlGet(githubApiUrl(MANIFEST_PATH), pat);

        if (!raw || raw === "") {
            log("fetchManifest: ERROR empty response");
            return { success: false, error: "No response from server. Check your connection." };
        }
        if (raw.charAt(0) === "{") {
            var obj = parseJSON(raw);
            if (obj && obj.message) {
                log("fetchManifest: ERROR GitHub message: " + obj.message);
                return { success: false, error: "GitHub: " + obj.message };
            }
        }
        var manifest = parseJSON(raw);
        if (!manifest || !manifest.tools) {
            log("fetchManifest: ERROR could not parse manifest. raw=" + raw.substring(0, 200));
            return { success: false, error: "Could not parse manifest." };
        }
        log("fetchManifest: OK — " + manifest.tools.length + " tool(s) in manifest");
        return { success: true, manifest: manifest };
    }

    function getComparison(manifest) {
        var updates  = [];
        var newTools = [];
        var upToDate = [];
        var panelsFolder = getScriptsPanelsFolder();

        for (var i = 0; i < manifest.tools.length; i++) {
            var tool = manifest.tools[i];
            var installed;

            // anyUpdater always knows its own running version — no need
            // to rely on the preference which can go stale after a manual
            // file replacement.  Strip the leading "v" so it matches the
            // manifest format (e.g. "1.0.6", not "v1.0.6").
            if (tool.id === "any_updater") {
                installed = SCRIPT_VERSION.replace(/^v/, "");
                saveInstalledVersion(tool.id, installed);
            } else {
                installed = getInstalledVersion(tool.id);
            }

            var firstEntry  = normaliseFileEntry(tool.files[0]);
            var primaryFile = resolveLocalPath(firstEntry.local, panelsFolder);

            log("getComparison: tool=" + tool.id +
                "  installed=" + (installed === null ? "null" : installed) +
                "  manifest=" + tool.version +
                "  primaryFile=" + primaryFile.fsName +
                "  exists=" + primaryFile.exists);

            if (installed === null) {
                // No preference yet — check whether the primary file exists on
                // disk (manually installed before anyUpdater existed). If so,
                // adopt silently at the manifest version; otherwise mark as new.
                if (primaryFile.exists) {
                    log("getComparison: auto-adopting " + tool.id + " at v" + tool.version);
                    saveInstalledVersion(tool.id, tool.version);
                    upToDate.push(tool);
                } else {
                    log("getComparison: " + tool.id + " → NEW");
                    newTools.push(tool);
                }
            } else if (installed !== tool.version) {
                // Version mismatch — show as update regardless of file state.
                // (Primary file may be absent because it changed name in V2, etc.)
                log("getComparison: " + tool.id + " → UPDATE " + installed + " -> " + tool.version);
                updates.push({ tool: tool, fromVersion: installed });
            } else if (!primaryFile.exists && tool.id !== "any_updater") {
                // Pref says up-to-date but primary file is missing — stale pref.
                // Reset and treat as new so the user can reinstall.
                log("getComparison: " + tool.id + " → STALE PREF (file missing), treating as new");
                saveInstalledVersion(tool.id, "");
                newTools.push(tool);
            } else {
                log("getComparison: " + tool.id + " → UP TO DATE");
                upToDate.push(tool);
            }
        }

        return { updates: updates, newTools: newTools, upToDate: upToDate };
    }

    function installTool(tool, panelsFolder, pat) {
        var i, entry, url, content, destFile;

        log("installTool: START " + tool.name + " v" + tool.version +
            " (" + tool.files.length + " file(s))");

        // --- Phase 1: download everything before touching the filesystem ---
        // This prevents partial installs: if any download fails, nothing is written.
        var downloads = []; // parallel array to tool.files; null = skip
        for (i = 0; i < tool.files.length; i++) {
            entry = normaliseFileEntry(tool.files[i]);

            log("installTool: file[" + i + "] repo=" + entry.repo +
                "  local=" + entry.local + "  skipIfExists=" + entry.skipIfExists);

            if (entry.skipIfExists) {
                destFile = resolveLocalPath(entry.local, panelsFolder);
                log("installTool: skipIfExists check — exists=" + destFile.exists +
                    "  path=" + destFile.fsName);
                if (destFile.exists) {
                    log("installTool: skipping (already on disk)");
                    downloads.push(null); // already present — leave it alone
                    continue;
                }
            }

            url = githubApiUrl(entry.repo);
            log("installTool: downloading file[" + i + "] from " + url);
            content = curlGet(url, pat);

            if (!content) {
                log("installTool: ERROR empty response for " + entry.repo);
                throw new Error("Empty response for: " + entry.repo);
            }

            // Detect GitHub API error objects (have "message" but not "tools")
            if (content.charAt(0) === "{") {
                var errObj = parseJSON(content);
                if (errObj && errObj.message && !errObj.tools) {
                    log("installTool: ERROR GitHub API: " + errObj.message + " (" + entry.repo + ")");
                    throw new Error("GitHub: " + errObj.message + " (" + entry.repo + ")");
                }
            }

            log("installTool: file[" + i + "] downloaded OK (" + content.length + " bytes)");
            downloads.push(content);
        }

        log("installTool: all downloads complete, writing files");

        // --- Phase 2: remove old files, then write new ones ---
        if (tool.remove) {
            for (i = 0; i < tool.remove.length; i++) {
                var removePath = resolveLocalPath(tool.remove[i], panelsFolder).fsName;
                log("installTool: removing " + removePath);
                safeDeleteItem(removePath, panelsFolder);
            }
        }

        for (i = 0; i < tool.files.length; i++) {
            if (downloads[i] === null) {
                log("installTool: skipping write for file[" + i + "] (skipIfExists)");
                continue;
            }
            entry    = normaliseFileEntry(tool.files[i]);
            destFile = resolveLocalPath(entry.local, panelsFolder);
            writeFile(destFile, downloads[i]);
        }

        saveInstalledVersion(tool.id, tool.version);
        log("installTool: DONE " + tool.name + " — version pref saved as " + tool.version);
    }

    // ============================================================
    // UI
    // ============================================================

    function buildUI(thisObject) {
        var panel = (thisObject instanceof Panel)
            ? thisObject
            : new Window("palette", SCRIPT_NAME + " " + SCRIPT_VERSION);

        panel.orientation   = "column";
        panel.alignChildren = ["fill", "top"];
        panel.margins       = [16, 16, 16, 16];
        panel.spacing       = 10;

        // Header
        var headerGrp = panel.add("group");
        headerGrp.orientation   = "row";
        headerGrp.alignChildren = ["left", "center"];
        headerGrp.alignment     = ["fill", "top"];
        headerGrp.spacing       = 4;

        var nameLabel = headerGrp.add("statictext", undefined, SCRIPT_NAME);
        nameLabel.alignment = ["left", "center"];

        // Trailing space prevents ScriptUI auto-size from clipping the last character
        var verLabel = headerGrp.add("statictext", undefined, SCRIPT_VERSION + " ");
        verLabel.alignment = ["left", "center"];
        try {
            verLabel.graphics.foregroundColor =
                verLabel.graphics.newPen(verLabel.graphics.PenType.SOLID_COLOR, [0.45, 0.45, 0.45], 1);
        } catch (e) {}

        // Separator
        var sep1 = panel.add("panel");
        sep1.alignment   = ["fill", "top"];
        sep1.maximumSize = [9999, 2];

        // Tool list
        var listBox = panel.add("listbox", [0, 0, 240, 110], []);
        listBox.alignment = ["fill", "top"];

        // Separator
        var sep2 = panel.add("panel");
        sep2.alignment   = ["fill", "top"];
        sep2.maximumSize = [9999, 2];

        // Button row
        var btnRow = panel.add("group");
        btnRow.orientation   = "row";
        btnRow.alignChildren = ["fill", "center"];
        btnRow.alignment     = ["fill", "top"];
        btnRow.spacing       = 6;

        var checkBtn  = btnRow.add("button", undefined, "Check");
        var updateBtn = btnRow.add("button", undefined, "Update All");
        updateBtn.enabled = false;

        // Configure PAT — small secondary button
        var configBtn = panel.add("button", undefined, "Configure access token\u2026");
        configBtn.alignment = ["fill", "top"];
        try {
            configBtn.graphics.foregroundColor =
                configBtn.graphics.newPen(configBtn.graphics.PenType.SOLID_COLOR, [0.45, 0.45, 0.45], 1);
        } catch (e) {}

        // Status
        var statusText = panel.add("statictext", undefined, "\u2014");
        statusText.alignment = ["fill", "top"];
        statusText.justify   = "left";

        // ---- Internal state ----
        var currentResult = null;

        function setStatus(msg) { statusText.text = msg; }

        function populateList(comparison) {
            listBox.removeAll();
            var i;
            for (i = 0; i < comparison.newTools.length; i++) {
                var t = comparison.newTools[i];
                listBox.add("item", "+  " + t.name + "  [new  v" + t.version + "]");
            }
            for (i = 0; i < comparison.updates.length; i++) {
                var u = comparison.updates[i];
                listBox.add("item", "^  " + u.tool.name + "  [v" + u.fromVersion + " -> v" + u.tool.version + "]");
            }
            for (i = 0; i < comparison.upToDate.length; i++) {
                var ud = comparison.upToDate[i];
                listBox.add("item", "=  " + ud.name + "  [v" + ud.version + "]");
            }
            var numPending = comparison.newTools.length + comparison.updates.length;
            updateBtn.enabled = (numPending > 0);
            setStatus(numPending > 0 ? numPending + " update(s) available" : "All tools are up to date.");
        }

        // ---- Check button ----
        checkBtn.onClick = function () {
            var pat = getStoredPAT();
            if (!pat) {
                pat = showPATDialog();
                if (!pat) { setStatus("No access token \u2014 check skipped."); return; }
            }

            checkBtn.enabled  = false;
            updateBtn.enabled = false;
            listBox.removeAll();
            listBox.add("item", "Fetching manifest\u2026");
            setStatus("Checking GitHub\u2026");

            try {
                var fetchResult = fetchManifest(pat);

                if (!fetchResult.success) {
                    var isAuthError = (fetchResult.error.indexOf("Not Found")       !== -1 ||
                                       fetchResult.error.indexOf("Bad credentials") !== -1);
                    listBox.removeAll();
                    listBox.add("item", "Error: " + fetchResult.error);
                    setStatus(isAuthError ? "Token may be invalid \u2014 click Configure." : "Check failed.");
                    checkBtn.enabled = true;
                    return;
                }

                var comparison = getComparison(fetchResult.manifest);
                currentResult  = { manifest: fetchResult.manifest, comparison: comparison };
                populateList(comparison);

            } catch (e) {
                listBox.removeAll();
                listBox.add("item", "Unexpected error.");
                setStatus("Error: " + e.message);
            }

            checkBtn.enabled = true;
        };

        // ---- Update All button ----
        updateBtn.onClick = function () {
            if (!currentResult) return;

            var pat = getStoredPAT();
            if (!pat) { setStatus("No access token set."); return; }

            var comparison   = currentResult.comparison;
            var panelsFolder = getScriptsPanelsFolder();
            var toolsToInstall = [];
            var i;

            for (i = 0; i < comparison.newTools.length; i++) { toolsToInstall.push(comparison.newTools[i]); }
            for (i = 0; i < comparison.updates.length; i++)  { toolsToInstall.push(comparison.updates[i].tool); }
            if (toolsToInstall.length === 0) return;

            checkBtn.enabled  = false;
            updateBtn.enabled = false;

            log("updateBtn: installing " + toolsToInstall.length + " tool(s): " +
                (function() { var n = []; for (var j = 0; j < toolsToInstall.length; j++) n.push(toolsToInstall[j].name); return n.join(", "); })());

            var errors = [];
            for (i = 0; i < toolsToInstall.length; i++) {
                var tool = toolsToInstall[i];
                log("updateBtn: starting install of " + tool.name);
                setStatus("Installing " + tool.name + "\u2026 (this may take a moment)");
                // Force a repaint so the status text is visible before the
                // blocking curl calls freeze the UI.
                try { panel.update(); } catch (e) {}
                try {
                    installTool(tool, panelsFolder, pat);
                    log("updateBtn: install SUCCESS " + tool.name);
                } catch (e) {
                    log("updateBtn: install ERROR " + tool.name + " — " + e.message);
                    errors.push(tool.name + ": " + e.message);
                }
            }
            log("updateBtn: all installs done. errors=" + errors.length);

            // Refresh list after all installs
            try {
                var refreshResult = fetchManifest(pat);
                if (refreshResult.success) {
                    var newComparison = getComparison(refreshResult.manifest);
                    currentResult     = { manifest: refreshResult.manifest, comparison: newComparison };
                    populateList(newComparison);
                }
            } catch (e) {}

            if (errors.length > 0) {
                setStatus("Finished with errors.");
                alert("Some installs failed:\n\n" + errors.join("\n"));
            } else {
                setStatus("Done \u2014 restart After Effects to apply.");
                alert("Update complete!\n\nPlease restart After Effects to apply the new scripts.");
            }

            checkBtn.enabled = true;
        };

        // ---- Configure PAT button ----
        configBtn.onClick = function () {
            var newPAT = showPATDialog();
            if (newPAT) {
                setStatus("Token saved. Click Check to verify.");
                currentResult = null;
                updateBtn.enabled = false;
                listBox.removeAll();
            }
        };

        // Setup Panel Sizing (required for docked ScriptUI Panels)
        panel.layout.layout(true);

        // Make the panel resizeable
        panel.layout.resize();
        panel.onResizing = panel.onResize = function() {
            this.layout.resize();
        };

        // Auto-check if PAT already stored; otherwise prompt immediately on first launch
        if (getStoredPAT()) {
            checkBtn.onClick();
        } else {
            var firstRunPAT = showPATDialog();
            if (firstRunPAT) {
                checkBtn.onClick();
            } else {
                listBox.add("item", "No access token configured.");
                setStatus("Click 'Configure access token\u2026' to set up.");
            }
        }

        return panel;
    }

    // ---- Entry point ----
    var scriptPal = buildUI(thisObj);
    if (scriptPal && scriptPal instanceof Window) {
        scriptPal.center();
        scriptPal.show();
    }

})(this);
