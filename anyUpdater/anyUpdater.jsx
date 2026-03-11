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
 * @version 1.0.1
 */
(function createUI(thisObj) {

    // ============================================================
    // CONFIGURATION
    // ============================================================

    var SCRIPT_NAME   = "anyUpdater";
    var SCRIPT_VERSION = "v1.0.1";
    var SETTINGS_KEY  = "anyUpdater";
    var PAT_SETTING   = "github_pat";

    var GITHUB_OWNER  = "anygreen";
    var GITHUB_REPO   = "ae_tools";
    var GITHUB_BRANCH = "master";
    var MANIFEST_PATH = "anyUpdater/manifest.json";

    var IS_MAC = ($.os.indexOf("Mac") !== -1);

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
     * Path: .../Scripts/ScriptUI Panels/anyUpdater/anyUpdater.jsx
     */
    function getScriptsPanelsFolder() {
        var thisFile = new File($.fileName);
        return thisFile.parent.parent;
    }

    function getHomeFolder() {
        if (IS_MAC) {
            return system.callSystem("echo $HOME").replace(/[\r\n]+$/, "");
        } else {
            return system.callSystem("echo %USERPROFILE%").replace(/[\r\n]+$/, "");
        }
    }

    function resolveLocalPath(localPath, panelsFolder) {
        if (localPath.charAt(0) === "~" && (localPath.charAt(1) === "/" || localPath.charAt(1) === "\\")) {
            return new File(getHomeFolder() + localPath.substring(1));
        }
        return new File(panelsFolder.fsName + "/" + localPath);
    }

    function normaliseFileEntry(entry) {
        if (typeof entry === "string") { return { repo: entry, local: entry }; }
        return { repo: entry.repo, local: entry.local };
    }

    function githubApiUrl(repoPath) {
        var encoded = repoPath.replace(/ /g, "%20");
        return "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO +
               "/contents/" + encoded + "?ref=" + GITHUB_BRANCH;
    }

    function curlGet(url, pat) {
        var cmd = 'curl -s' +
                  ' -H "Authorization: token ' + pat + '"' +
                  ' -H "Accept: application/vnd.github.v3.raw"' +
                  ' "' + url + '"';
        return system.callSystem(cmd);
    }

    function parseJSON(str) {
        try { return eval("(" + str + ")"); } catch (e) { return null; }
    }

    function ensureFolderExists(folder) {
        if (folder.exists) return;
        ensureFolderExists(new Folder(folder.parent.fsName));
        folder.create();
    }

    function writeFile(file, content) {
        ensureFolderExists(new Folder(file.parent.fsName));
        file.encoding = "UTF-8";
        if (!file.open("w")) { throw new Error("Cannot write to: " + file.fsName); }
        file.write(content);
        file.close();
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

    // ============================================================
    // VERSION PERSISTENCE  (stored in AE preferences)
    // ============================================================

    function getInstalledVersion(toolId) {
        try {
            if (app.settings.haveSetting(SETTINGS_KEY, toolId)) {
                return app.settings.getSetting(SETTINGS_KEY, toolId);
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
        var raw = curlGet(githubApiUrl(MANIFEST_PATH), pat);

        if (!raw || raw === "") {
            return { success: false, error: "No response from server. Check your connection." };
        }
        if (raw.charAt(0) === "{") {
            var obj = parseJSON(raw);
            if (obj && obj.message) {
                return { success: false, error: "GitHub: " + obj.message };
            }
        }
        var manifest = parseJSON(raw);
        if (!manifest || !manifest.tools) {
            return { success: false, error: "Could not parse manifest." };
        }
        return { success: true, manifest: manifest };
    }

    function getComparison(manifest) {
        var updates  = [];
        var newTools = [];
        var upToDate = [];

        for (var i = 0; i < manifest.tools.length; i++) {
            var tool      = manifest.tools[i];
            var installed = getInstalledVersion(tool.id);
            if (installed === null) {
                newTools.push(tool);
            } else if (installed !== tool.version) {
                updates.push({ tool: tool, fromVersion: installed });
            } else {
                upToDate.push(tool);
            }
        }

        return { updates: updates, newTools: newTools, upToDate: upToDate };
    }

    function installTool(tool, panelsFolder, pat) {
        var i;

        if (tool.remove) {
            for (i = 0; i < tool.remove.length; i++) {
                deleteItem(resolveLocalPath(tool.remove[i], panelsFolder).fsName);
            }
        }

        for (i = 0; i < tool.files.length; i++) {
            var entry   = normaliseFileEntry(tool.files[i]);
            var url     = githubApiUrl(entry.repo);
            var content = curlGet(url, pat);

            if (!content) { throw new Error("Empty response for: " + entry.repo); }

            if (content.charAt(0) === "{") {
                var errObj = parseJSON(content);
                if (errObj && errObj.message) {
                    throw new Error("GitHub: " + errObj.message + " (" + entry.repo + ")");
                }
            }

            var destFile = resolveLocalPath(entry.local, panelsFolder);
            writeFile(destFile, content);
        }

        saveInstalledVersion(tool.id, tool.version);
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

        headerGrp.add("statictext", undefined, SCRIPT_NAME);
        var verLabel = headerGrp.add("statictext", undefined, SCRIPT_VERSION);
        verLabel.alignment = ["right", "center"];
        try {
            verLabel.graphics.foregroundColor =
                verLabel.graphics.newPen(verLabel.graphics.PenType.SOLID_COLOR, [0.45, 0.45, 0.45], 1);
        } catch (e) {}

        // Separator
        var sep1 = panel.add("panel");
        sep1.alignment   = ["fill", "top"];
        sep1.maximumSize = [9999, 2];

        // Tool list
        var listBox = panel.add("listbox", [0, 0, 240, 130], []);
        listBox.alignment = ["fill", "fill"];

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

            var errors = [];
            for (i = 0; i < toolsToInstall.length; i++) {
                var tool = toolsToInstall[i];
                setStatus("Installing " + tool.name + "\u2026");
                try {
                    installTool(tool, panelsFolder, pat);
                } catch (e) {
                    errors.push(tool.name + ": " + e.message);
                }
            }

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
                setStatus("Done! Restart After Effects to apply.");
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

        // Auto-check on load only if a PAT is already stored
        if (getStoredPAT()) {
            checkBtn.onClick();
        } else {
            listBox.add("item", "No access token configured.");
            setStatus("Click 'Configure access token\u2026' to set up.");
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
