/**
 * Aldi Project Helper
 *
 * A dockable After Effects panel for managing Aldi video projects.
 * Features:
 * - Project management with persistent storage
 * - Automatic scanning for most recent .aep files
 * - Sub-project detection and switching
 * - Version increment for AEP files and compositions
 * - KW (Kalenderwoche) management
 * - FTP sync (input / output folders)
 * - Render queue output folder setup
 *
 * @version 2.0.3
 * @author Lennert
 */
(function createUI(thisObj) {

    // ============================================================
    // CONFIGURATION
    // ============================================================

    var SCRIPT_NAME    = "Aldi Project Helper";
    var SCRIPT_VERSION = "v2.0.3";
    var SETTINGS_SECTION = "AldiProjectHelper";

    var AE_PATH_SEGMENT  = "06_vfx/02_ae";
    var EXCLUDED_FOLDERS = ["Adobe After Effects Auto-Save"];
    var FTP_INPUT_PATH   = "01_inbox";
    var FTP_OUTPUT_PATH  = "06_vfx/03_out";
    var FTP_CONFIG_FILE  = "~/Documents/AldiProjectHelper_FTP.txt";

    var IS_MAC = ($.os.indexOf("Mac") !== -1);

    // ============================================================
    // HELPER FUNCTIONS - General Utilities
    // ============================================================

    function padNumber(num, minLength) {
        var str = num.toString();
        while (str.length < minLength) { str = "0" + str; }
        return str;
    }

    function getCurrentDate() {
        var date = new Date();
        return padNumber(date.getFullYear() % 100, 2) +
               padNumber(date.getMonth() + 1, 2) +
               padNumber(date.getDate(), 2);
    }

    function formatDateReadable(date) {
        return padNumber(date.getDate(), 2) + "." +
               padNumber(date.getMonth() + 1, 2) + "." +
               date.getFullYear() + " " +
               padNumber(date.getHours(), 2) + ":" +
               padNumber(date.getMinutes(), 2);
    }

    function getFileModificationDate(filePath) {
        try {
            var result = "";
            if (IS_MAC) {
                result = system.callSystem('stat -f "%Sm" -t "%d.%m.%Y %H:%M" "' + filePath + '"');
                return result.replace(/^\s+|\s+$/g, "");
            } else {
                var file = new File(filePath);
                if (file.exists) {
                    var modDate = new Date(file.modified);
                    return formatDateReadable(modDate);
                }
                return "";
            }
        } catch (e) {
            return "";
        }
    }

    function isDateValid(str) {
        return /^2\d{5}$/.test(str);
    }

    function isValidKW(str) {
        return /^KW\d{2}$/i.test(str);
    }

    function extractKWNumber(kwStr) {
        var match = kwStr.match(/^KW(\d{2})$/i);
        return match ? parseInt(match[1], 10) : null;
    }

    function createKWString(num) {
        return "KW" + padNumber(num, 2);
    }

    // ============================================================
    // HELPER FUNCTIONS - Settings Persistence
    // ============================================================

    function saveSetting(key, value) {
        app.settings.saveSetting(SETTINGS_SECTION, key, value);
    }

    function loadSetting(key, defaultValue) {
        if (app.settings.haveSetting(SETTINGS_SECTION, key)) {
            return app.settings.getSetting(SETTINGS_SECTION, key);
        }
        return defaultValue;
    }

    function saveProjectList(projects) {
        var parts = [];
        for (var i = 0; i < projects.length; i++) {
            parts.push(projects[i].name + "|" + projects[i].path);
        }
        saveSetting("projectList", parts.join(";"));
    }

    function loadProjectList() {
        var data = loadSetting("projectList", "");
        if (data === "") return [];

        var projects = [];
        var parts = data.split(";");
        for (var i = 0; i < parts.length; i++) {
            var pair = parts[i].split("|");
            if (pair.length === 2) {
                projects.push({ name: pair[0], path: pair[1] });
            }
        }
        return projects;
    }

    // ============================================================
    // HELPER FUNCTIONS - File System Operations
    // ============================================================

    function scanForAEPFiles(folder, results, relativePath) {
        if (!folder.exists) return;

        var items = folder.getFiles();
        for (var i = 0; i < items.length; i++) {
            var item = items[i];

            if (item instanceof Folder) {
                var shouldExclude = false;
                for (var j = 0; j < EXCLUDED_FOLDERS.length; j++) {
                    if (item.name === EXCLUDED_FOLDERS[j]) { shouldExclude = true; break; }
                }
                if (!shouldExclude) {
                    var newRelativePath = relativePath ? relativePath + "/" + item.name : item.name;
                    scanForAEPFiles(item, results, newRelativePath);
                }
            } else if (item instanceof File) {
                if (item.name.toLowerCase().match(/\.aep$/)) {
                    var fullPath = item.fsName;
                    var isInExcludedFolder = false;
                    for (var k = 0; k < EXCLUDED_FOLDERS.length; k++) {
                        if (fullPath.indexOf(EXCLUDED_FOLDERS[k]) !== -1) { isInExcludedFolder = true; break; }
                    }
                    if (!isInExcludedFolder) {
                        results.push({ file: item, relativePath: relativePath || "", modDate: new Date(item.modified) });
                    }
                }
            }
        }
    }

    function detectSubProjects(aeFolder) {
        if (!aeFolder.exists) return [];

        var subProjects = [];
        var items = aeFolder.getFiles();

        var hasDirectKW = false;
        for (var i = 0; i < items.length; i++) {
            if (items[i] instanceof Folder && isValidKW(items[i].name)) { hasDirectKW = true; break; }
        }
        if (hasDirectKW) return [];

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item instanceof Folder) {
                var shouldExclude = false;
                for (var j = 0; j < EXCLUDED_FOLDERS.length; j++) {
                    if (item.name === EXCLUDED_FOLDERS[j]) { shouldExclude = true; break; }
                }
                if (!shouldExclude) {
                    var subItems = item.getFiles();
                    var containsKWOrAEP = false;
                    for (var k = 0; k < subItems.length; k++) {
                        if (subItems[k] instanceof Folder && isValidKW(subItems[k].name)) { containsKWOrAEP = true; break; }
                        if (subItems[k] instanceof File && subItems[k].name.toLowerCase().match(/\.aep$/)) { containsKWOrAEP = true; break; }
                    }
                    if (containsKWOrAEP) { subProjects.push(item.name); }
                }
            }
        }

        return subProjects;
    }

    function findMostRecentAEP(projectPath, subProject) {
        var basePath = projectPath + "/" + AE_PATH_SEGMENT;
        if (subProject) { basePath += "/" + subProject; }

        var folder = new Folder(basePath);
        if (!folder.exists) return null;

        var results = [];
        scanForAEPFiles(folder, results, "");
        if (results.length === 0) return null;

        var mostRecent = results[0];
        for (var i = 1; i < results.length; i++) {
            if (results[i].modDate > mostRecent.modDate) { mostRecent = results[i]; }
        }

        mostRecent.basePath = basePath;
        return mostRecent;
    }

    function findSubProjectWithMostRecent(projectPath, subProjects) {
        if (subProjects.length === 0) return null;

        var mostRecentSubProject = null;
        var mostRecentDate = null;

        for (var i = 0; i < subProjects.length; i++) {
            var result = findMostRecentAEP(projectPath, subProjects[i]);
            if (result && (!mostRecentDate || result.modDate > mostRecentDate)) {
                mostRecentDate = result.modDate;
                mostRecentSubProject = subProjects[i];
            }
        }

        return mostRecentSubProject;
    }

    function extractKWFromPath(filePath) {
        var normalizedPath = filePath.replace(/\\/g, "/");
        var parts = normalizedPath.split("/");
        for (var i = parts.length - 1; i >= 0; i--) {
            if (isValidKW(parts[i])) { return parts[i].toUpperCase(); }
        }
        return null;
    }

    function getKWParentPath(filePath) {
        var normalizedPath = filePath.replace(/\\/g, "/");
        var parts = normalizedPath.split("/");
        for (var i = parts.length - 1; i >= 0; i--) {
            if (isValidKW(parts[i])) { return parts.slice(0, i).join("/"); }
        }
        return null;
    }

    function openInFileBrowser(folderPath) {
        var folder = new Folder(folderPath);
        if (folder.exists) {
            folder.execute();
        } else {
            alert("Folder does not exist:\n" + folderPath);
        }
    }

    function getRenderDateFolder() {
        var date = new Date();
        var year = (date.getFullYear() % 100).toString();
        if (year.length < 2) year = "0" + year;
        var month = (date.getMonth() + 1).toString();
        if (month.length < 2) month = "0" + month;
        var day = date.getDate().toString();
        if (day.length < 2) day = "0" + day;
        return year + month + day;
    }

    function getRenderTimeFolder() {
        var date = new Date();
        var hours = date.getHours();
        var minutes = date.getMinutes();

        minutes = Math.round(minutes / 5) * 5;
        if (minutes === 60) { minutes = 0; hours++; if (hours === 24) hours = 0; }

        var hoursStr = hours.toString();
        if (hoursStr.length < 2) hoursStr = "0" + hoursStr;
        var minutesStr = minutes.toString();
        if (minutesStr.length < 2) minutesStr = "0" + minutesStr;

        return hoursStr + "h" + minutesStr;
    }

    function copyToClipboard(text) {
        try {
            if (IS_MAC) {
                system.callSystem('echo "' + text.replace(/"/g, '\\"') + '" | pbcopy');
            } else {
                var tempFolder = Folder.temp.fsName;
                var clipTxtFile = new File(tempFolder + "/ClipBoard.txt");
                clipTxtFile.open('w');
                clipTxtFile.write(text);
                clipTxtFile.close();
                var clipBatFile = new File(tempFolder + "/ClipBoard.bat");
                clipBatFile.open('w');
                clipBatFile.writeln('clip < "' + tempFolder + '/ClipBoard.txt"');
                clipBatFile.close();
                clipBatFile.execute();
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function showPathDialog(title, message, path) {
        var dialog = new Window("dialog", title);
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.preferredSize.width = 500;

        var msgText = dialog.add("statictext", undefined, message, {multiline: true});
        msgText.preferredSize = [480, 40];
        var pathField = dialog.add("edittext", undefined, path, {readonly: true});
        pathField.preferredSize = [480, 25];
        var okBtn = dialog.add("button", undefined, "OK", {name: "ok"});
        okBtn.onClick = function() { dialog.close(); };
        dialog.show();
    }

    function showWideConfirmDialog(title, message, width) {
        width = width || 500;
        var dialog = new Window("dialog", title);
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.preferredSize.width = width;

        var textGroup = dialog.add("group");
        textGroup.orientation = "column";
        textGroup.alignChildren = ["fill", "fill"];
        textGroup.preferredSize = [width - 40, 300];
        var textArea = textGroup.add("edittext", undefined, message, {multiline: true, readonly: true, scrolling: true});
        textArea.preferredSize = [width - 40, 280];

        var buttonGroup = dialog.add("group");
        buttonGroup.orientation = "row";
        buttonGroup.alignment = ["center", "top"];
        var okBtn     = buttonGroup.add("button", undefined, "Sync",   {name: "ok"});
        var cancelBtn = buttonGroup.add("button", undefined, "Cancel", {name: "cancel"});
        okBtn.onClick     = function() { dialog.close(1); };
        cancelBtn.onClick = function() { dialog.close(0); };
        return dialog.show() === 1;
    }

    // ============================================================
    // HELPER FUNCTIONS - FTP Operations (from _ftp.jsx)
    // ============================================================

    //@include "Aldi_Project_Helper/_ftp.jsx"

    // ============================================================
    // HELPER FUNCTIONS - Name Processing
    // ============================================================

    function findDateInParts(parts) {
        for (var i = 0; i < parts.length; i++) {
            if (isDateValid(parts[i])) { return { index: i, value: parts[i] }; }
        }
        return null;
    }

    function parseVersion(parts, excludeIndex) {
        for (var i = parts.length - 1; i >= 0; i--) {
            if (i === excludeIndex) continue;
            if (/^\d{2,}$/.test(parts[i])) {
                return { index: i, number: parts[i], fullVersion: parts[i] };
            }
        }
        return null;
    }

    function parseInitials(parts) {
        for (var i = parts.length - 1; i >= 0; i--) {
            if (/^[a-z]{2}$/.test(parts[i])) { return { index: i, value: parts[i] }; }
        }
        return null;
    }

    function parseKWInName(parts) {
        for (var i = 0; i < parts.length; i++) {
            if (isValidKW(parts[i])) {
                return { index: i, value: parts[i], number: extractKWNumber(parts[i]) };
            }
        }
        return null;
    }

    function incrementVersion(version) {
        if (!version) return null;
        var num = parseInt(version.number, 10);
        var newNum = padNumber(num + 1, version.number.length);
        return { number: newNum, fullVersion: newNum };
    }

    function processFileName(originalName, options) {
        var parts    = originalName.split('_');
        var newParts = parts.slice();

        var dateInfo     = findDateInParts(parts);
        var versionPart  = parseVersion(parts, dateInfo ? dateInfo.index : -1);
        var initialsInfo = parseInitials(parts);
        var kwInfo       = parseKWInName(parts);

        var hasDateChange     = false;
        var hasVersionChange  = false;
        var hasInitialsChange = false;
        var hasKWChange       = false;

        if (dateInfo) {
            if (dateInfo.value !== getCurrentDate()) {
                newParts[dateInfo.index] = getCurrentDate();
                hasDateChange = true;
            }
        } else {
            if (confirm("No date was found in the filename.\nWould you like to add today's date at the beginning?")) {
                newParts.unshift(getCurrentDate());
                if (versionPart)  versionPart.index++;
                if (initialsInfo) initialsInfo.index++;
                if (kwInfo)       kwInfo.index++;
                hasDateChange = true;
            }
        }

        if (options.newKW && kwInfo) {
            if (kwInfo.value.toUpperCase() !== options.newKW.toUpperCase()) {
                newParts[kwInfo.index] = options.newKW;
                hasKWChange = true;
            }
        }

        if (versionPart) {
            if (options.resetVersion) {
                newParts[versionPart.index] = padNumber(1, versionPart.number.length);
                hasVersionChange = true;
            } else {
                var newVersion = incrementVersion(versionPart);
                newParts[versionPart.index] = newVersion.fullVersion;
                hasVersionChange = true;
            }
        }

        if (options.includeInitials && options.newInitials) {
            if (initialsInfo) {
                if (initialsInfo.value !== options.newInitials) {
                    newParts[initialsInfo.index] = options.newInitials;
                    hasInitialsChange = true;
                }
            } else {
                if (confirm("No initials were found in the filename.\nWould you like to add your initials (" + options.newInitials + ")?")) {
                    newParts.push(options.newInitials);
                    hasInitialsChange = true;
                }
            }
        }

        if (!hasDateChange && !hasVersionChange && !hasInitialsChange && !hasKWChange) {
            alert("Nothing to update in filename:\n" + originalName);
            return null;
        }

        return {
            oldName: originalName,
            newName: newParts.join('_'),
            hasDateChange: hasDateChange,
            hasVersionChange: hasVersionChange,
            hasInitialsChange: hasInitialsChange,
            hasKWChange: hasKWChange,
            versionPart: versionPart,
            initialsInfo: initialsInfo,
            kwInfo: kwInfo,
            newInitials: options.newInitials
        };
    }

    // ============================================================
    // DIALOG HELPER FUNCTIONS - Highlighted Text Display
    // ============================================================

    function createHighlightedText(container, isOld, name, result) {
        var group = container.add("group");
        group.orientation = "row";
        group.alignChildren = ["left", "center"];
        group.spacing = 0;
        group.margins = 0;

        var parts    = name.split('_');
        var oldParts = result.oldName.split('_');
        var newParts = result.newName.split('_');

        for (var i = 0; i < parts.length; i++) {
            if (i > 0) {
                var separator = group.add("statictext", undefined, "_");
                separator.margins = 0;
            }

            var part      = parts[i];
            var textGroup = group.add("group");
            textGroup.orientation = "row";
            textGroup.spacing = 0;
            textGroup.margins = 0;

            var text = textGroup.add("statictext", undefined, part);
            text.margins = 0;

            if (!isOld) {
                var shouldHighlight = false;
                if (i < oldParts.length && i < newParts.length) {
                    if (oldParts[i] !== newParts[i]) { shouldHighlight = true; }
                } else if (i >= oldParts.length) {
                    shouldHighlight = true;
                }
                if (shouldHighlight) {
                    text.graphics.foregroundColor = text.graphics.newPen(text.graphics.PenType.SOLID_COLOR, [1, 0, 0], 1);
                    text.graphics.font = ScriptUI.newFont(text.graphics.font.name, "Bold", text.graphics.font.size);
                }
            }
        }
    }

    function createComparisonGroup(container, label, oldNames, results) {
        var group = container.add("group");
        group.orientation = "column";
        group.alignChildren = ["left", "top"];
        group.spacing = 4;
        group.margins = 0;
        group.maximumSize.width = 800;

        var titleText = group.add("statictext", undefined, label + ":");
        titleText.graphics.font = ScriptUI.newFont(titleText.graphics.font.name, "Bold", titleText.graphics.font.size);
        titleText.margins = 0;

        for (var i = 0; i < oldNames.length; i++) {
            createHighlightedText(group, true, oldNames[i], results[i]);
        }

        if (oldNames.length > 0) {
            var arrowGroup = group.add("group");
            arrowGroup.margins = [0, 4, 0, 4];
            var arrowText = arrowGroup.add("statictext", undefined, "\u2193");
            arrowText.graphics.foregroundColor = arrowText.graphics.newPen(arrowText.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1);

            for (var i = 0; i < results.length; i++) {
                createHighlightedText(group, false, results[i].newName, results[i]);
            }
        }
    }

    // ============================================================
    // UI CREATION
    // ============================================================

    var panel = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", SCRIPT_NAME + " " + SCRIPT_VERSION, undefined, {resizeable: true});

    var mainGroup = panel.add("group");
    mainGroup.orientation   = "column";
    mainGroup.alignment     = ["fill", "fill"];
    mainGroup.alignChildren = ["fill", "top"];
    mainGroup.spacing       = 8;
    mainGroup.margins       = [10, 8, 10, 10];

    // Title
    var titleText = mainGroup.add("statictext", undefined, SCRIPT_NAME + " " + SCRIPT_VERSION);
    titleText.alignment = ["center", "top"];

    // TabbedPanel
    var tabs = mainGroup.add("tabbedpanel");
    tabs.alignment = ["fill", "fill"];

    // ---- PROJECT TAB ----
    var projectTab = tabs.add("tab", undefined, "Project");

    // Inner content group — margins on Tab elements are unreliable
    var pc = projectTab.add("group");
    pc.orientation   = "column";
    pc.alignment     = ["fill", "fill"];
    pc.alignChildren = ["fill", "top"];
    pc.margins       = [10, 12, 10, 10];
    pc.spacing       = 8;

    // Initials
    var initialsGroup = pc.add("group");
    initialsGroup.orientation   = "row";
    initialsGroup.alignment     = ["fill", "top"];
    initialsGroup.alignChildren = ["left", "center"];

    var initialsLabel = initialsGroup.add("statictext", undefined, "Initials:");
    var initialsInput = initialsGroup.add("edittext", undefined, "");
    initialsInput.preferredSize.width = 50;
    initialsInput.characters = 4;
    initialsInput.text = loadSetting("initials", "");

    initialsInput.onChange = function() {
        var value = this.text.toLowerCase();
        if (/^[a-z]{2}$/.test(value)) {
            this.text = value;
            saveSetting("initials", value);
        } else if (value === "") {
            saveSetting("initials", "");
        } else {
            this.text = loadSetting("initials", "");
            alert("Initials must be exactly 2 lowercase letters.");
        }
    };

    pc.add("panel", undefined, undefined, {borderStyle: "sunken"}).alignment = ["fill", "top"];

    // Active Project
    var projectLabel = pc.add("statictext", undefined, "Active Project:");
    projectLabel.alignment = ["left", "top"];

    var projectDropdownGroup = pc.add("group");
    projectDropdownGroup.orientation   = "row";
    projectDropdownGroup.alignment     = ["fill", "top"];
    projectDropdownGroup.alignChildren = ["fill", "center"];

    var projectDropdown = projectDropdownGroup.add("dropdownlist", undefined, []);
    projectDropdown.alignment     = ["fill", "center"];
    projectDropdown.preferredSize.width = 200;

    var projectButtonGroup = projectDropdownGroup.add("group");
    projectButtonGroup.orientation = "row";
    projectButtonGroup.spacing     = 5;

    var addProjectBtn = projectButtonGroup.add("button", undefined, "+");
    addProjectBtn.preferredSize = [30, 25];
    addProjectBtn.helpTip = "Add a new project";

    var removeProjectBtn = projectButtonGroup.add("button", undefined, "-");
    removeProjectBtn.preferredSize = [30, 25];
    removeProjectBtn.helpTip = "Remove current project";

    // Sub-project
    var subProjectGroup = pc.add("group");
    subProjectGroup.orientation   = "column";
    subProjectGroup.alignment     = ["fill", "top"];
    subProjectGroup.alignChildren = ["fill", "top"];

    var subProjectLabel   = subProjectGroup.add("statictext", undefined, "Sub-project:");
    var subProjectDropdown = subProjectGroup.add("dropdownlist", undefined, ["(No sub-projects)"]);
    subProjectDropdown.alignment = ["fill", "center"];
    subProjectDropdown.selection = 0;
    subProjectDropdown.enabled   = false;

    pc.add("panel", undefined, undefined, {borderStyle: "sunken"}).alignment = ["fill", "top"];

    // Most Recent File
    var recentFileLabel = pc.add("statictext", undefined, "Most Recent File:");
    recentFileLabel.alignment = ["left", "top"];

    var recentFileNameText = pc.add("statictext", undefined, "No project selected");
    recentFileNameText.alignment = ["fill", "top"];
    recentFileNameText.graphics.font = ScriptUI.newFont(recentFileNameText.graphics.font.name, "Bold", recentFileNameText.graphics.font.size);

    var recentFileDateText = pc.add("statictext", undefined, "");
    recentFileDateText.alignment     = ["fill", "top"];
    recentFileDateText.preferredSize = [-1, 20];

    // File action buttons
    var fileActionGroup = pc.add("group");
    fileActionGroup.orientation   = "row";
    fileActionGroup.alignment     = ["fill", "top"];
    fileActionGroup.alignChildren = ["fill", "center"];

    var refreshBtn = fileActionGroup.add("button", undefined, "Refresh");
    refreshBtn.alignment = ["fill", "center"];
    refreshBtn.helpTip   = "Refresh file list and sub-project detection";

    var openFileBtn = fileActionGroup.add("button", undefined, "Open File");
    openFileBtn.alignment = ["fill", "center"];
    openFileBtn.enabled   = false;

    var openFolderBtn = fileActionGroup.add("button", undefined, "Open Folder");
    openFolderBtn.alignment = ["fill", "center"];
    openFolderBtn.enabled   = false;

    // ---- EXPORT & SYNC TAB ----
    var exportTab = tabs.add("tab", undefined, "Export & Sync");

    var ec = exportTab.add("group");
    ec.orientation   = "column";
    ec.alignment     = ["fill", "fill"];
    ec.alignChildren = ["fill", "top"];
    ec.margins       = [10, 12, 10, 10];
    ec.spacing       = 8;

    // Project context (visible when on second tab)
    var exportProjectInfo = ec.add("statictext", undefined, "No project selected");
    exportProjectInfo.alignment = ["fill", "top"];
    exportProjectInfo.graphics.foregroundColor = exportProjectInfo.graphics.newPen(
        exportProjectInfo.graphics.PenType.SOLID_COLOR, [0.6, 0.6, 0.6], 1
    );

    ec.add("panel", undefined, undefined, {borderStyle: "sunken"}).alignment = ["fill", "top"];

    // Version Up
    var versionLabel = ec.add("statictext", undefined, "Version Up:");
    versionLabel.alignment = ["left", "top"];

    var versionButtonGroup = ec.add("group");
    versionButtonGroup.orientation   = "row";
    versionButtonGroup.alignment     = ["fill", "top"];
    versionButtonGroup.alignChildren = ["fill", "center"];

    var aepBtn = versionButtonGroup.add("button", undefined, "AEP");
    aepBtn.alignment = ["fill", "center"];
    aepBtn.helpTip   = "Save project with incremented version";

    var compBtn = versionButtonGroup.add("button", undefined, "Comp");
    compBtn.alignment = ["fill", "center"];
    compBtn.helpTip   = "Duplicate selected compositions with incremented version";

    var newKWBtn = versionButtonGroup.add("button", undefined, "New KW");
    newKWBtn.alignment = ["fill", "center"];
    newKWBtn.helpTip   = "Create new KW folder and save project there";

    ec.add("panel", undefined, undefined, {borderStyle: "sunken"}).alignment = ["fill", "top"];

    // Render
    var renderLabel = ec.add("statictext", undefined, "Render:");
    renderLabel.alignment = ["left", "top"];

    var renderBtn = ec.add("button", undefined, "Create Folders and Render");
    renderBtn.alignment = ["fill", "top"];
    renderBtn.helpTip   = "Create date/time folders in 03_out and render queue items there";

    var renderAndUploadBtn = ec.add("button", undefined, "Create Folders, Render and Upload");
    renderAndUploadBtn.alignment = ["fill", "top"];
    renderAndUploadBtn.helpTip   = "Create date/time folders, render queue items, then upload rendered files to FTP";

    ec.add("panel", undefined, undefined, {borderStyle: "sunken"}).alignment = ["fill", "top"];

    // FTP Sync
    var ftpSyncLabel = ec.add("statictext", undefined, "FTP Sync:");
    ftpSyncLabel.alignment = ["left", "top"];

    var ftpDropdownGroup = ec.add("group");
    ftpDropdownGroup.orientation   = "row";
    ftpDropdownGroup.alignment     = ["fill", "top"];
    ftpDropdownGroup.alignChildren = ["fill", "center"];

    var ftpLocationDropdown = ftpDropdownGroup.add("dropdownlist", undefined, ["Input", "Output"]);
    ftpLocationDropdown.selection = 0;
    ftpLocationDropdown.alignment = ["fill", "center"];
    ftpLocationDropdown.helpTip   = "Input: 01_inbox folder\nOutput: 06_vfx/03_out folder";

    var ftpCountDropdown = ftpDropdownGroup.add("dropdownlist", undefined, ["Latest", "Latest 5"]);
    ftpCountDropdown.selection = 0;
    ftpCountDropdown.alignment = ["fill", "center"];
    ftpCountDropdown.helpTip   = "How many date folders to sync";

    var ftpRestrictGroup = ec.add("group");
    ftpRestrictGroup.orientation   = "row";
    ftpRestrictGroup.alignment     = ["fill", "top"];
    ftpRestrictGroup.alignChildren = ["left", "center"];

    var ftpRestrictCheckbox = ftpRestrictGroup.add("checkbox", undefined, "Restrict to sub-project");
    ftpRestrictCheckbox.value   = (loadSetting("ftpRestrictToSubProject", "true") === "true");
    ftpRestrictCheckbox.helpTip = "When enabled and a specific sub-project is selected, only sync that sub-project's folders";
    ftpRestrictCheckbox.onClick = function() {
        saveSetting("ftpRestrictToSubProject", this.value ? "true" : "false");
    };

    var syncBtn = ec.add("button", undefined, "Sync");
    syncBtn.alignment = ["fill", "top"];
    syncBtn.helpTip   = "Start FTP synchronization";

    ec.add("panel", undefined, undefined, {borderStyle: "sunken"}).alignment = ["fill", "top"];

    // Progress
    var progressGroup = ec.add("group");
    progressGroup.orientation   = "column";
    progressGroup.alignment     = ["fill", "top"];
    progressGroup.alignChildren = ["fill", "top"];
    progressGroup.spacing       = 5;

    var progressOverallLabel = progressGroup.add("statictext", undefined, "");
    progressOverallLabel.alignment = ["fill", "top"];

    var progressOverallBar = progressGroup.add("progressbar", undefined, 0, 100);
    progressOverallBar.alignment     = ["fill", "top"];
    progressOverallBar.preferredSize.height = 10;

    var progressStatusText = progressGroup.add("statictext", undefined, "");
    progressStatusText.alignment = ["fill", "top"];

    // ============================================================
    // STATE MANAGEMENT
    // ============================================================

    var currentProjects      = [];
    var currentSubProjects   = [];
    var currentMostRecentFile = null;

    function populateProjectDropdown() {
        projectDropdown.removeAll();
        currentProjects = loadProjectList();

        for (var i = 0; i < currentProjects.length; i++) {
            projectDropdown.add("item", currentProjects[i].name);
        }

        var lastProject = loadSetting("lastProject", "");
        if (lastProject) {
            for (var i = 0; i < projectDropdown.items.length; i++) {
                if (projectDropdown.items[i].text === lastProject) { projectDropdown.selection = i; break; }
            }
        }

        if (!projectDropdown.selection && projectDropdown.items.length > 0) {
            projectDropdown.selection = 0;
        }

        updateUIState();
    }

    function enableSubProjectSection() {
        subProjectDropdown.enabled = true;
    }

    function disableSubProjectSection() {
        subProjectDropdown.removeAll();
        subProjectDropdown.add("item", "(No sub-projects)");
        subProjectDropdown.selection = 0;
        subProjectDropdown.enabled   = false;
    }

    function updateSubProjects(projectPath) {
        subProjectDropdown.removeAll();
        currentSubProjects = [];

        if (!projectPath) { disableSubProjectSection(); return; }

        var aeFolder = new Folder(projectPath + "/" + AE_PATH_SEGMENT);
        currentSubProjects = detectSubProjects(aeFolder);

        if (currentSubProjects.length === 0) { disableSubProjectSection(); return; }

        subProjectDropdown.add("item", "(All)");
        for (var i = 0; i < currentSubProjects.length; i++) {
            subProjectDropdown.add("item", currentSubProjects[i]);
        }

        var mostRecentSubProject = findSubProjectWithMostRecent(projectPath, currentSubProjects);
        if (mostRecentSubProject) {
            for (var i = 0; i < subProjectDropdown.items.length; i++) {
                if (subProjectDropdown.items[i].text === mostRecentSubProject) { subProjectDropdown.selection = i; break; }
            }
        } else {
            subProjectDropdown.selection = 0;
        }

        enableSubProjectSection();
    }

    function updateMostRecentFile() {
        if (!projectDropdown.selection) {
            recentFileNameText.text = "No project selected";
            recentFileDateText.text = "";
            currentMostRecentFile   = null;
            openFileBtn.enabled     = false;
            openFolderBtn.enabled   = false;
            return;
        }

        var projectIndex = projectDropdown.selection.index;
        var projectPath  = currentProjects[projectIndex].path;

        var subProject = null;
        if (subProjectDropdown.enabled && subProjectDropdown.selection) {
            var subProjectIndex = subProjectDropdown.selection.index;
            if (subProjectIndex > 0) { subProject = currentSubProjects[subProjectIndex - 1]; }
        }

        currentMostRecentFile = findMostRecentAEP(projectPath, subProject);

        if (currentMostRecentFile) {
            recentFileNameText.text = currentMostRecentFile.file.name;
            var modDateStr = getFileModificationDate(currentMostRecentFile.file.fsName);
            recentFileDateText.text = modDateStr ? "Modified: " + modDateStr : "";
            openFileBtn.enabled   = true;
            openFolderBtn.enabled = true;
        } else {
            recentFileNameText.text = "No .aep files found";
            recentFileDateText.text = "";
            openFileBtn.enabled   = false;
            openFolderBtn.enabled = true;
        }
    }

    function updateExportTabInfo() {
        if (projectDropdown.selection) {
            var text = currentProjects[projectDropdown.selection.index].name;
            if (subProjectDropdown.enabled && subProjectDropdown.selection && subProjectDropdown.selection.index > 0) {
                text += "  /  " + currentSubProjects[subProjectDropdown.selection.index - 1];
            }
            exportProjectInfo.text = text;
        } else {
            exportProjectInfo.text = "No project selected";
        }
    }

    function updateUIState() {
        if (!projectDropdown.selection) {
            disableSubProjectSection();
            recentFileNameText.text = "No project selected";
            recentFileDateText.text = "";
            currentMostRecentFile   = null;
            openFileBtn.enabled     = false;
            openFolderBtn.enabled   = false;
            updateExportTabInfo();
            return;
        }

        var projectIndex = projectDropdown.selection.index;
        var projectPath  = currentProjects[projectIndex].path;

        var projectFolder = new Folder(projectPath);
        if (!projectFolder.exists) {
            recentFileNameText.text = "Project folder not found!";
            recentFileDateText.text = projectPath;
            disableSubProjectSection();
            openFileBtn.enabled   = false;
            openFolderBtn.enabled = false;
            updateExportTabInfo();
            return;
        }

        updateSubProjects(projectPath);
        updateMostRecentFile();
        saveSetting("lastProject", currentProjects[projectIndex].name);
        updateExportTabInfo();
    }

    // ============================================================
    // EVENT HANDLERS
    // ============================================================

    projectDropdown.onChange = function() { updateUIState(); };

    subProjectDropdown.onChange = function() { updateMostRecentFile(); updateExportTabInfo(); };

    addProjectBtn.onClick = function() {
        var folder = Folder.selectDialog("Select Project Folder");
        if (folder) {
            var projectName = folder.name;
            var projectPath = folder.fsName;

            for (var i = 0; i < currentProjects.length; i++) {
                if (currentProjects[i].path === projectPath) {
                    alert("This project is already in the list.");
                    return;
                }
            }

            currentProjects.push({ name: projectName, path: projectPath });
            saveProjectList(currentProjects);
            populateProjectDropdown();

            for (var i = 0; i < projectDropdown.items.length; i++) {
                if (projectDropdown.items[i].text === projectName) { projectDropdown.selection = i; break; }
            }
        }
    };

    removeProjectBtn.onClick = function() {
        if (!projectDropdown.selection) { alert("Please select a project to remove."); return; }

        var projectName = projectDropdown.selection.text;
        if (confirm("Are you sure you want to remove \"" + projectName + "\" from the list?\n\n(This only removes it from the list, it does not delete any files.)")) {
            var projectIndex = projectDropdown.selection.index;
            currentProjects.splice(projectIndex, 1);
            saveProjectList(currentProjects);
            populateProjectDropdown();
        }
    };

    openFileBtn.onClick = function() {
        if (currentMostRecentFile && currentMostRecentFile.file.exists) {
            app.open(currentMostRecentFile.file);
        } else {
            alert("No file to open.");
        }
    };

    openFolderBtn.onClick = function() {
        if (!projectDropdown.selection) { alert("Please select a project first."); return; }
        var projectIndex = projectDropdown.selection.index;
        var projectPath  = currentProjects[projectIndex].path;
        openInFileBrowser(projectPath + "/" + AE_PATH_SEGMENT);
    };

    refreshBtn.onClick = function() { updateUIState(); };

    // AEP version up
    aepBtn.onClick = function() {
        try {
            if (!app.project.file) { alert("Please save the project first."); return; }

            var currentInitials = initialsInput.text.toLowerCase();
            if (currentInitials !== "" && !/^[a-z]{2}$/.test(currentInitials)) {
                alert("Initials must be exactly 2 lowercase letters or empty.");
                return;
            }

            var currentName = app.project.file.name.replace(/\.aep$/i, '');
            var result = processFileName(currentName, {
                includeInitials: true,
                newInitials: currentInitials,
                resetVersion: false
            });
            if (!result) return;

            var modal = new Window("dialog", "Version Up AEP");
            modal.orientation   = "column";
            modal.alignChildren = ["left", "top"];
            modal.spacing       = 10;
            modal.margins       = 16;
            modal.preferredSize.width = 400;

            createComparisonGroup(modal, "Project File", [result.oldName], [result]);

            var buttonGroup = modal.add("group");
            buttonGroup.orientation = "row";
            buttonGroup.alignment   = ["center", "top"];
            buttonGroup.spacing     = 10;
            var saveBtn   = buttonGroup.add("button", undefined, "Save",   {name: "ok"});
            var cancelBtn = buttonGroup.add("button", undefined, "Cancel", {name: "cancel"});

            modal.onResizing = modal.onResize = function() { this.layout.resize(); };

            if (modal.show() === 1) {
                var newFile = new File(app.project.file.parent.fsName + "/" + result.newName + ".aep");
                if (newFile.exists) {
                    if (!confirm("A file with this name already exists.\nDo you want to overwrite it?")) return;
                }
                app.project.save(newFile);
                updateMostRecentFile();
            }
        } catch (error) {
            alert("Error in AEP version up:\n" + error.message + "\nLine: " + error.line);
        }
    };

    // Comp version up
    compBtn.onClick = function() {
        try {
            var selectedComps = [];
            for (var i = 1; i <= app.project.numItems; i++) {
                if (app.project.item(i).selected && app.project.item(i) instanceof CompItem) {
                    selectedComps.push(app.project.item(i));
                }
            }

            if (selectedComps.length === 0) { alert("Please select at least one composition."); return; }

            var currentInitials = initialsInput.text.toLowerCase();
            if (currentInitials !== "" && !/^[a-z]{2}$/.test(currentInitials)) {
                alert("Initials must be exactly 2 lowercase letters or empty.");
                return;
            }

            var oldNames = [];
            var results  = [];
            var hasError = false;

            for (var i = 0; i < selectedComps.length; i++) {
                var result = processFileName(selectedComps[i].name, {
                    includeInitials: true,
                    newInitials: currentInitials,
                    resetVersion: false
                });
                if (!result) { hasError = true; break; }
                oldNames.push(selectedComps[i].name);
                results.push(result);
            }
            if (hasError) return;

            var modal = new Window("dialog", "Version Up Compositions");
            modal.orientation   = "column";
            modal.alignChildren = ["left", "top"];
            modal.spacing       = 10;
            modal.margins       = 16;
            modal.preferredSize.width = 400;

            createComparisonGroup(modal, "Compositions", oldNames, results);

            var moveGroup = modal.add("group");
            moveGroup.orientation = "row";
            moveGroup.alignment   = ["left", "top"];
            moveGroup.spacing     = 10;
            moveGroup.margins     = [0, 10, 0, 0];
            var moveToOldCheckbox = moveGroup.add("checkbox", undefined, "Move original to _old");
            moveToOldCheckbox.value = true;

            var buttonGroup = modal.add("group");
            buttonGroup.orientation = "row";
            buttonGroup.alignment   = ["center", "top"];
            buttonGroup.spacing     = 10;
            var duplicateBtn = buttonGroup.add("button", undefined, "Duplicate", {name: "ok"});
            var cancelBtn    = buttonGroup.add("button", undefined, "Cancel",    {name: "cancel"});

            modal.onResizing = modal.onResize = function() { this.layout.resize(); };
            if (modal.show() !== 1) return;

            var moveToOld = moveToOldCheckbox.value;
            app.beginUndoGroup("Version Up Compositions");

            var newComps   = [];
            var oldFolders = [];

            for (var i = 0; i < selectedComps.length; i++) {
                var comp    = selectedComps[i];
                var newComp = comp.duplicate();
                newComp.name = results[i].newName;
                newComps.push(newComp);

                if (moveToOld) {
                    var parentFolder = comp.parentFolder;
                    var oldFolder    = null;

                    for (var j = 1; j <= app.project.numItems; j++) {
                        var item = app.project.item(j);
                        if (item instanceof FolderItem && item.name === "_old" && item.parentFolder === parentFolder) {
                            oldFolder = item;
                            break;
                        }
                    }

                    if (!oldFolder) {
                        oldFolder = app.project.items.addFolder("_old");
                        if (parentFolder) { oldFolder.parentFolder = parentFolder; }
                    }

                    comp.parentFolder = oldFolder;

                    var alreadyTracked = false;
                    for (var k = 0; k < oldFolders.length; k++) {
                        if (oldFolders[k] === oldFolder) { alreadyTracked = true; break; }
                    }
                    if (!alreadyTracked) { oldFolders.push(oldFolder); }
                }
            }

            for (var i = 0; i < selectedComps.length; i++) { selectedComps[i].selected = false; }
            for (var i = 0; i < oldFolders.length; i++)    { oldFolders[i].selected    = false; }
            for (var i = 0; i < newComps.length; i++)      { newComps[i].selected      = true;  }

            app.endUndoGroup();

        } catch (error) {
            alert("Error in Comp version up:\n" + error.message + "\nLine: " + error.line);
        }
    };

    // New KW
    newKWBtn.onClick = function() {
        try {
            var sourceFile     = null;
            var sourceFilePath = null;

            if (app.project.file) {
                sourceFile     = app.project.file;
                sourceFilePath = sourceFile.fsName;
            } else if (currentMostRecentFile && currentMostRecentFile.file) {
                sourceFile     = currentMostRecentFile.file;
                sourceFilePath = sourceFile.fsName;
            } else {
                alert("No project is open and no recent file was found.\nPlease open a project or select a project from the list.");
                return;
            }

            var currentKW = extractKWFromPath(sourceFilePath);
            if (!currentKW) { alert("Could not find KW folder in path:\n" + sourceFilePath); return; }

            var currentKWNum = extractKWNumber(currentKW);
            var newKWNum     = currentKWNum + 1;
            var newKW        = createKWString(newKWNum);

            var kwParentPath = getKWParentPath(sourceFilePath);
            if (!kwParentPath) { alert("Could not determine KW parent folder."); return; }

            var newKWFolder = new Folder(kwParentPath + "/" + newKW);
            if (!newKWFolder.exists) {
                if (!newKWFolder.create()) { alert("Could not create new KW folder:\n" + newKWFolder.fsName); return; }
            }

            var currentInitials = initialsInput.text.toLowerCase();
            if (currentInitials !== "" && !/^[a-z]{2}$/.test(currentInitials)) {
                alert("Initials must be exactly 2 lowercase letters or empty.");
                return;
            }

            var currentName = sourceFile.name.replace(/\.aep$/i, '');
            var result = processFileName(currentName, {
                includeInitials: true,
                newInitials: currentInitials,
                resetVersion: true,
                newKW: newKW
            });
            if (!result) return;

            var newFilePath = newKWFolder.fsName + "/" + result.newName + ".aep";
            var newFile     = new File(newFilePath);

            var confirmMsg = "Create new KW:\n\n";
            confirmMsg += "From: " + currentKW + "\n";
            confirmMsg += "To: "   + newKW     + "\n\n";
            confirmMsg += "New file:\n" + result.newName + ".aep\n\n";
            confirmMsg += "Location:\n" + newKWFolder.fsName;

            if (!confirm(confirmMsg)) {
                if (newKWFolder.getFiles().length === 0) { newKWFolder.remove(); }
                return;
            }

            if (!app.project.file) { app.open(sourceFile); }
            app.project.save(newFile);
            updateUIState();

        } catch (error) {
            alert("Error in New KW:\n" + error.message + "\nLine: " + error.line);
        }
    };

    // ============================================================
    // PROJECT MATCH CHECK
    // ============================================================

    /**
     * Attempts to find a project (and sub-project) in the tool's list
     * that matches the currently open AE project file.
     * @returns {Object|null} { projectIndex, subProject } or null
     */
    function findMatchingProject() {
        if (!app.project.file) return null;
        var openPath = app.project.file.fsName.replace(/\\/g, "/");

        for (var i = 0; i < currentProjects.length; i++) {
            var pPath = currentProjects[i].path.replace(/\\/g, "/");
            if (openPath.indexOf(pPath + "/") !== -1) {
                var subProject = null;
                var aeFolder = new Folder(currentProjects[i].path + "/" + AE_PATH_SEGMENT);
                var subs = detectSubProjects(aeFolder);
                var aeSegPos = openPath.indexOf(AE_PATH_SEGMENT);
                for (var j = 0; j < subs.length; j++) {
                    if (aeSegPos !== -1 && openPath.indexOf("/" + subs[j] + "/", aeSegPos) !== -1) {
                        subProject = subs[j];
                        break;
                    }
                }
                return { projectIndex: i, subProject: subProject };
            }
        }
        return null;
    }

    /**
     * Switches the tool's dropdowns to match a detected project.
     */
    function switchToDetectedProject(detected) {
        projectDropdown.selection = detected.projectIndex;
        updateUIState();
        if (detected.subProject) {
            for (var i = 0; i < subProjectDropdown.items.length; i++) {
                if (subProjectDropdown.items[i].text === detected.subProject) {
                    subProjectDropdown.selection = i;
                    break;
                }
            }
            updateMostRecentFile();
            updateExportTabInfo();
        }
    }

    /**
     * Checks whether the open AE project matches the tool's selected project.
     * Shows a dialog on mismatch with Cancel / Continue / Switch options.
     * @returns {boolean} true to proceed, false to cancel
     */
    function checkProjectMatch() {
        // No selection — let the caller handle validation
        if (!projectDropdown.selection) return true;

        var projectIndex = projectDropdown.selection.index;
        var projectName  = currentProjects[projectIndex].name;
        var projectPath  = currentProjects[projectIndex].path.replace(/\\/g, "/");

        var selectedSubProject = null;
        if (subProjectDropdown.enabled && subProjectDropdown.selection && subProjectDropdown.selection.index > 0) {
            selectedSubProject = currentSubProjects[subProjectDropdown.selection.index - 1];
        }

        var toolLabel = projectName;
        if (selectedSubProject) toolLabel += " / " + selectedSubProject;

        // Case 1: no AE project file open
        if (!app.project.file) {
            var d1 = new Window("dialog", "No Project Open");
            d1.orientation = "column";
            d1.alignChildren = ["fill", "top"];
            d1.spacing = 10;
            d1.margins = 16;
            d1.preferredSize.width = 400;

            var m1 = d1.add("statictext", undefined,
                "No AE project is currently open.\n\nTool selection:  " + toolLabel +
                "\n\nContinue anyway?", {multiline: true});
            m1.preferredSize = [380, 90];

            var bg1 = d1.add("group");
            bg1.orientation = "row";
            bg1.alignment = ["center", "top"];
            bg1.spacing = 10;
            bg1.add("button", undefined, "Continue", {name: "ok"}).onClick  = function() { d1.close(1); };
            bg1.add("button", undefined, "Cancel", {name: "cancel"}).onClick = function() { d1.close(0); };

            return d1.show() === 1;
        }

        // Case 2: project is open — check for match
        var openPath = app.project.file.fsName.replace(/\\/g, "/");
        var pathMatch = (openPath.indexOf(projectPath + "/") !== -1);

        var subProjectMatch = true;
        if (pathMatch && selectedSubProject) {
            var aeSegCheck = openPath.indexOf(AE_PATH_SEGMENT);
            subProjectMatch = (aeSegCheck !== -1 && openPath.indexOf("/" + selectedSubProject + "/", aeSegCheck) !== -1);
        }

        if (pathMatch && subProjectMatch) return true;

        // Mismatch — detect what the open file actually belongs to
        var detected = findMatchingProject();

        var msg = "The open AE project does not match the tool selection.\n\n";
        msg += "Open project:  " + app.project.file.name + "\n";
        msg += "Tool selection:  " + toolLabel + "\n";

        if (detected) {
            var detLabel = currentProjects[detected.projectIndex].name;
            if (detected.subProject) detLabel += " / " + detected.subProject;
            msg += "\nDetected match:  " + detLabel + "\n";
        }

        var d2 = new Window("dialog", "Project Mismatch");
        d2.orientation = "column";
        d2.alignChildren = ["fill", "top"];
        d2.spacing = 10;
        d2.margins = 16;
        d2.preferredSize.width = 440;

        var m2 = d2.add("statictext", undefined, msg, {multiline: true});
        m2.preferredSize = [420, detected ? 120 : 100];

        var bg2 = d2.add("group");
        bg2.orientation = "row";
        bg2.alignment = ["center", "top"];
        bg2.spacing = 10;

        if (detected) {
            var switchBtn = bg2.add("button", undefined, "Switch Tool");
            switchBtn.helpTip = "Switch the tool to match the open project";
            switchBtn.onClick = function() { d2.close(2); };
        }

        bg2.add("button", undefined, "Continue").onClick = function() { d2.close(1); };
        bg2.add("button", undefined, "Cancel", {name: "cancel"}).onClick = function() { d2.close(0); };

        var result = d2.show();

        if (result === 2 && detected) {
            switchToDetectedProject(detected);
            return true;
        }

        return result === 1;
    }

    /**
     * Validates the render queue, creates date/time output folders, and updates
     * all queued output modules to point to the new folder.
     * @returns {Object|null} Setup result, or null if cancelled/failed
     */
    function setupRenderOutput() {
        if (!checkProjectMatch()) return null;

        var renderQueue  = app.project.renderQueue;
        var activeItems  = [];

        for (var i = 1; i <= renderQueue.numItems; i++) {
            var item = renderQueue.item(i);
            if (item.status === RQItemStatus.QUEUED) { activeItems.push(item); }
        }

        if (activeItems.length === 0) {
            alert("No active items in the render queue.\n\nPlease add compositions to the render queue and set them to 'Queued' status.");
            return null;
        }

        if (!projectDropdown.selection) {
            alert("Please select a project first to determine the output folder.");
            return null;
        }

        var projectIndex = projectDropdown.selection.index;
        var projectPath  = currentProjects[projectIndex].path;
        var projectName  = currentProjects[projectIndex].name;

        var outBasePath = projectPath + "/06_vfx/03_out";
        var dateFolder  = getRenderDateFolder();
        var timeFolder  = getRenderTimeFolder();

        var renderSubProject = null;
        if (currentSubProjects.length > 0) {
            if (subProjectDropdown.enabled && subProjectDropdown.selection && subProjectDropdown.selection.index > 0) {
                renderSubProject = currentSubProjects[subProjectDropdown.selection.index - 1];
            } else {
                if (app.project.file) {
                    var openFilePath = app.project.file.fsName.replace(/\\/g, "/");
                    for (var sp = 0; sp < currentSubProjects.length; sp++) {
                        if (openFilePath.indexOf("/" + currentSubProjects[sp] + "/") !== -1) {
                            renderSubProject = currentSubProjects[sp];
                            break;
                        }
                    }
                }
                if (!renderSubProject) {
                    var spDialog = new Window("dialog", "Select Sub-project for Output");
                    spDialog.orientation   = "column";
                    spDialog.alignChildren = ["fill", "top"];
                    spDialog.spacing       = 10;
                    spDialog.margins       = 16;
                    spDialog.add("statictext", undefined, "Sub-projects detected. Select output sub-project:");
                    var spDropdown = spDialog.add("dropdownlist", undefined, currentSubProjects);
                    spDropdown.selection = 0;
                    var spBtnGroup = spDialog.add("group");
                    spBtnGroup.orientation = "row";
                    spBtnGroup.alignment   = ["center", "top"];
                    spBtnGroup.add("button", undefined, "OK",     {name: "ok"});
                    spBtnGroup.add("button", undefined, "Cancel", {name: "cancel"});
                    if (spDialog.show() !== 1) return null;
                    renderSubProject = currentSubProjects[spDropdown.selection.index];
                }
            }
        }

        var outRenderPath   = outBasePath + (renderSubProject ? "/" + renderSubProject : "");
        var dateFolderPath  = outRenderPath + "/" + dateFolder;
        var timeFolderPath  = dateFolderPath + "/" + timeFolder;

        var outBaseFolder = new Folder(outBasePath);
        if (!outBaseFolder.exists) {
            alert("Output folder does not exist:\n" + outBasePath + "\n\nPlease create the folder structure first.");
            return null;
        }

        if (renderSubProject) {
            var subProjectFolderObj = new Folder(outRenderPath);
            if (!subProjectFolderObj.exists && !subProjectFolderObj.create()) {
                alert("Failed to create sub-project folder:\n" + outRenderPath);
                return null;
            }
        }

        var dateFolderObj = new Folder(dateFolderPath);
        if (!dateFolderObj.exists && !dateFolderObj.create()) {
            alert("Failed to create date folder:\n" + dateFolderPath);
            return null;
        }

        var timeFolderObj = new Folder(timeFolderPath);
        if (!timeFolderObj.exists && !timeFolderObj.create()) {
            alert("Failed to create time folder:\n" + timeFolderPath);
            return null;
        }

        var outputCount = 0;
        for (var i = 0; i < activeItems.length; i++) {
            var item = activeItems[i];
            for (var j = 1; j <= item.numOutputModules; j++) {
                var outputModule = item.outputModule(j);
                var currentFile  = outputModule.file;
                if (currentFile) {
                    outputModule.file = new File(timeFolderPath + "/" + currentFile.name);
                    outputCount++;
                }
            }
        }

        var simplifiedPath = "/06_vfx/03_out/" +
            (renderSubProject ? renderSubProject + "/" : "") +
            dateFolder + "/" + timeFolder;

        return {
            timeFolderPath:  timeFolderPath,
            simplifiedPath:  simplifiedPath,
            renderSubProject: renderSubProject,
            dateFolder:      dateFolder,
            timeFolder:      timeFolder,
            activeItems:     activeItems,
            outputCount:     outputCount,
            projectPath:     projectPath,
            projectName:     projectName,
            renderQueue:     renderQueue
        };
    }

    // Render button
    renderBtn.onClick = function() {
        try {
            var setup = setupRenderOutput();
            if (!setup) return;

            var clipboardSuccess = copyToClipboard(setup.simplifiedPath);

            var confirmMsg = "Render Setup Complete\n\n";
            confirmMsg += "Output folder:\n" + setup.simplifiedPath + "\n\n";
            confirmMsg += "Active items: " + setup.activeItems.length + "\n";
            confirmMsg += "Output modules updated: " + setup.outputCount + "\n\n";
            if (clipboardSuccess) { confirmMsg += "Path copied to clipboard!\n\n"; }
            confirmMsg += "Start rendering now?";

            if (confirm(confirmMsg)) {
                setup.renderQueue.render();
                ftpLocationDropdown.selection = 1;
            } else if (!clipboardSuccess) {
                showPathDialog("Output Path", "Copy the output path:", setup.simplifiedPath);
            }
        } catch (error) {
            alert("Error in Render:\n" + error.message + "\nLine: " + error.line);
        }
    };

    // Render and Upload button
    renderAndUploadBtn.onClick = function() {
        try {
            var setup = setupRenderOutput();
            if (!setup) return;

            var ftpConfig = getFTPConnectionForProject(setup.projectName);
            if (!ftpConfig) {
                alert("No FTP connection configured for project:\n" + setup.projectName +
                      "\n\nPlease add a connection in:\n" + FTP_CONFIG_FILE +
                      "\n\nAborting. Use 'Create Folders and Render' to render without upload.");
                return;
            }

            var clipboardSuccess = copyToClipboard(setup.simplifiedPath);

            var confirmMsg = "Create Folders, Render and Upload\n\n";
            confirmMsg += "Output folder:\n" + setup.simplifiedPath + "\n\n";
            confirmMsg += "Active items: " + setup.activeItems.length + "\n";
            confirmMsg += "Output modules updated: " + setup.outputCount + "\n\n";
            confirmMsg += "FTP: " + ftpConfig.hostname + "\n\n";
            if (clipboardSuccess) { confirmMsg += "Path copied to clipboard!\n\n"; }
            confirmMsg += "Start rendering and upload to FTP now?";

            if (!confirm(confirmMsg)) {
                if (!clipboardSuccess) { showPathDialog("Output Path", "Copy the output path:", setup.simplifiedPath); }
                return;
            }

            setup.renderQueue.render();
            ftpLocationDropdown.selection = 1;

            progressOverallBar.value    = 0;
            progressOverallLabel.text   = "Scanning rendered files...";
            progressStatusText.text     = "";
            panel.layout.layout(true);

            var timeFolderObj  = new Folder(setup.timeFolderPath);
            var renderedFiles  = [];
            scanFolderForFiles(timeFolderObj, setup.timeFolderPath, renderedFiles);

            if (renderedFiles.length === 0) {
                alert("Render complete, but no files found in output folder:\n" + setup.timeFolderPath + "\n\nFTP upload skipped.");
                progressOverallLabel.text = "";
                progressStatusText.text   = "";
                return;
            }

            var remoteTimePath = FTP_OUTPUT_PATH +
                (setup.renderSubProject ? "/" + setup.renderSubProject : "") +
                "/" + setup.dateFolder + "/" + setup.timeFolder;

            var totalFiles = renderedFiles.length;
            var uploaded   = 0;
            var errors     = 0;

            for (var i = 0; i < renderedFiles.length; i++) {
                var fileInfo       = renderedFiles[i];
                var remoteFilePath = remoteTimePath + "/" + fileInfo.relativePath;

                progressOverallBar.value  = (i / totalFiles) * 100;
                progressOverallLabel.text = "Uploading " + (i + 1) + " / " + totalFiles;
                progressStatusText.text   = fileInfo.relativePath;
                panel.layout.layout(true);

                var success = uploadFTPFile(ftpConfig, fileInfo.file.fsName, remoteFilePath);
                if (success) { uploaded++; } else { errors++; }
            }

            progressOverallBar.value  = 100;
            progressOverallLabel.text = "Complete: " + uploaded + " uploaded";
            progressStatusText.text   = errors > 0 ? errors + " error(s)" : "All files uploaded";
            panel.layout.layout(true);

            alert("Render and Upload complete!\n\n" +
                  "Uploaded: " + uploaded + " / " + totalFiles + " files\n" +
                  (errors > 0 ? "Errors: " + errors + "\n" : "") +
                  "\nRemote path:\n" + remoteTimePath);

        } catch (error) {
            alert("Error in Render and Upload:\n" + error.message + "\nLine: " + error.line);
            progressStatusText.text = "Error: " + error.message;
        }
    };

    // Sync button
    syncBtn.onClick = function() {
        try {
            progressOverallBar.value  = 0;
            progressOverallLabel.text = "";
            progressStatusText.text   = "";
            panel.layout.layout(true);

            if (!projectDropdown.selection) { alert("Please select a project first."); return; }
            if (!checkProjectMatch()) return;

            var projectIndex = projectDropdown.selection.index;
            var projectName  = currentProjects[projectIndex].name;
            var projectPath  = currentProjects[projectIndex].path;

            var ftpConfig = getFTPConnectionForProject(projectName);
            if (!ftpConfig) {
                alert("No FTP connection configured for project:\n" + projectName +
                      "\n\nPlease add a connection in:\n" + FTP_CONFIG_FILE);
                return;
            }

            progressStatusText.text = "Connecting to FTP...";
            panel.layout.layout(true);

            var testPort    = ftpConfig.port || "21";
            var testUrl     = "ftps://" + ftpConfig.hostname + ":" + testPort + "/";
            var testCommand = "curl -s -l --ssl-reqd -k --connect-timeout 10 --user " + ftpConfig.username + ":" + ftpConfig.password + " \"" + testUrl + "\"";
            var testResult  = executeCommand(testCommand);

            if (!testResult || testResult.length === 0) {
                if (!confirm("FTP connection test returned no data.\nThis might indicate a connection issue.\n\nContinue anyway?")) {
                    progressStatusText.text = "";
                    return;
                }
            }

            var isInput       = ftpLocationDropdown.selection.index === 0;
            var syncPath      = isInput ? FTP_INPUT_PATH : FTP_OUTPUT_PATH;
            var localBasePath = projectPath + "/" + syncPath;

            var localBaseFolder = new Folder(localBasePath);
            if (!localBaseFolder.exists) {
                alert("Local folder does not exist:\n" + localBasePath);
                return;
            }

            var folderCount = ftpCountDropdown.selection.index === 0 ? 1 : 5;

            var restrictSubProject = null;
            if (ftpRestrictCheckbox.value &&
                currentSubProjects.length > 0 &&
                subProjectDropdown.enabled &&
                subProjectDropdown.selection &&
                subProjectDropdown.selection.index > 0) {
                restrictSubProject = currentSubProjects[subProjectDropdown.selection.index - 1];
            }

            var scanRoots = [];

            if (isInput) {
                if (restrictSubProject) {
                    scanRoots.push({
                        localBase:  localBasePath + "/" + restrictSubProject,
                        remoteBase: syncPath + "/" + restrictSubProject,
                        label:      restrictSubProject
                    });
                } else {
                    scanRoots.push({ localBase: localBasePath, remoteBase: syncPath, label: "inbox" });
                    for (var sp = 0; sp < currentSubProjects.length; sp++) {
                        scanRoots.push({
                            localBase:  localBasePath + "/" + currentSubProjects[sp],
                            remoteBase: syncPath + "/" + currentSubProjects[sp],
                            label:      currentSubProjects[sp]
                        });
                    }
                }
            } else {
                if (currentSubProjects.length > 0) {
                    if (restrictSubProject) {
                        scanRoots.push({
                            localBase:  localBasePath + "/" + restrictSubProject,
                            remoteBase: syncPath + "/" + restrictSubProject,
                            label:      restrictSubProject
                        });
                    } else {
                        for (var sp = 0; sp < currentSubProjects.length; sp++) {
                            scanRoots.push({
                                localBase:  localBasePath + "/" + currentSubProjects[sp],
                                remoteBase: syncPath + "/" + currentSubProjects[sp],
                                label:      currentSubProjects[sp]
                            });
                        }
                    }
                } else {
                    scanRoots.push({ localBase: localBasePath, remoteBase: syncPath, label: "output" });
                }
            }

            progressStatusText.text = "Scanning folders...";
            panel.layout.layout(true);

            var allLocalFiles    = [];
            var allRemoteFiles   = [];
            var allSyncedFolders = [];
            var rootLabelsInOrder = [];
            var hasMultipleRoots  = scanRoots.length > 1;

            for (var r = 0; r < scanRoots.length; r++) {
                var root = scanRoots[r];

                var labelAlreadyTracked = false;
                for (var ri = 0; ri < rootLabelsInOrder.length; ri++) {
                    if (rootLabelsInOrder[ri] === root.label) { labelAlreadyTracked = true; break; }
                }
                if (!labelAlreadyTracked) rootLabelsInOrder.push(root.label);

                progressStatusText.text = "Scanning " + root.label + "...";
                panel.layout.layout(true);

                var rootLocalFolder  = new Folder(root.localBase);
                var localDateFolders = rootLocalFolder.exists ? getDateFolders(root.localBase) : [];

                var remoteItems       = listFTPFiles(ftpConfig, root.remoteBase);
                var remoteDateFolders = [];
                for (var i = 0; i < remoteItems.length; i++) {
                    if (isDateFolder(remoteItems[i])) { remoteDateFolders.push(remoteItems[i]); }
                }
                remoteDateFolders.sort(function(a, b) { return b.localeCompare(a); });

                var combinedDateFolders = localDateFolders.slice();
                for (var i = 0; i < remoteDateFolders.length; i++) {
                    var found = false;
                    for (var j = 0; j < combinedDateFolders.length; j++) {
                        if (combinedDateFolders[j] === remoteDateFolders[i]) { found = true; break; }
                    }
                    if (!found) combinedDateFolders.push(remoteDateFolders[i]);
                }
                combinedDateFolders.sort(function(a, b) { return b.localeCompare(a); });
                combinedDateFolders = combinedDateFolders.slice(0, folderCount);

                for (var i = 0; i < combinedDateFolders.length; i++) {
                    allSyncedFolders.push({ rootLabel: root.label, dateFolder: combinedDateFolders[i] });
                }

                progressStatusText.text = "Scanning files in " + root.label + "...";
                panel.layout.layout(true);

                for (var f = 0; f < combinedDateFolders.length; f++) {
                    var dateFolder    = combinedDateFolders[f];
                    var localDatePath  = root.localBase  + "/" + dateFolder;
                    var remoteDatePath = root.remoteBase + "/" + dateFolder;

                    var localFolder = new Folder(localDatePath);
                    if (localFolder.exists) {
                        var localFiles = [];
                        scanFolderForFiles(localFolder, localDatePath, localFiles);
                        for (var i = 0; i < localFiles.length; i++) {
                            localFiles[i].rootLabel    = root.label;
                            localFiles[i].dateFolder   = dateFolder;
                            localFiles[i].syncKey      = root.label + "/" + dateFolder + "/" + localFiles[i].relativePath;
                            localFiles[i].displayPath  = (hasMultipleRoots ? root.label + "/" : "") + dateFolder + "/" + localFiles[i].relativePath;
                            localFiles[i].fullLocalPath  = localDatePath  + "/" + localFiles[i].relativePath;
                            localFiles[i].fullRemotePath = remoteDatePath + "/" + localFiles[i].relativePath;
                            allLocalFiles.push(localFiles[i]);
                        }
                    }

                    var remoteFiles = [];
                    listFTPFilesRecursive(ftpConfig, remoteDatePath, "", remoteFiles);
                    for (var i = 0; i < remoteFiles.length; i++) {
                        remoteFiles[i].rootLabel    = root.label;
                        remoteFiles[i].dateFolder   = dateFolder;
                        remoteFiles[i].syncKey      = root.label + "/" + dateFolder + "/" + remoteFiles[i].relativePath;
                        remoteFiles[i].displayPath  = (hasMultipleRoots ? root.label + "/" : "") + dateFolder + "/" + remoteFiles[i].relativePath;
                        remoteFiles[i].fullLocalPath  = localDatePath  + "/" + remoteFiles[i].relativePath;
                        remoteFiles[i].fullRemotePath = remoteDatePath + "/" + remoteFiles[i].relativePath;
                        allRemoteFiles.push(remoteFiles[i]);
                    }
                }
            }

            var foldersMsg;
            if (!hasMultipleRoots) {
                var dateFolderList = [];
                for (var i = 0; i < allSyncedFolders.length; i++) { dateFolderList.push(allSyncedFolders[i].dateFolder); }
                foldersMsg = dateFolderList.join(", ");
            } else {
                var rootDateMap = {};
                for (var i = 0; i < allSyncedFolders.length; i++) {
                    var sf = allSyncedFolders[i];
                    if (!rootDateMap[sf.rootLabel]) rootDateMap[sf.rootLabel] = [];
                    rootDateMap[sf.rootLabel].push(sf.dateFolder);
                }
                var foldersLines = [];
                for (var ri = 0; ri < rootLabelsInOrder.length; ri++) {
                    var lbl = rootLabelsInOrder[ri];
                    if (rootDateMap[lbl]) { foldersLines.push("  " + lbl + ": " + rootDateMap[lbl].join(", ")); }
                }
                foldersMsg = "\n" + foldersLines.join("\n");
            }

            progressStatusText.text = "";
            panel.layout.layout(true);

            var syncActions = compareSyncFiles(allLocalFiles, allRemoteFiles);

            if (syncActions.toUpload.length === 0 && syncActions.toDownload.length === 0) {
                alert("Everything is already in sync!\n\nFolders checked: " + foldersMsg);
                progressStatusText.text   = "";
                progressOverallLabel.text = "";
                return;
            }

            var confirmMsg = "Folders: " + foldersMsg + "\n\n";

            if (syncActions.toUpload.length > 0) {
                confirmMsg += "FILES TO UPLOAD (" + syncActions.toUpload.length + "):\n";
                for (var i = 0; i < Math.min(syncActions.toUpload.length, 15); i++) {
                    confirmMsg += "  + " + syncActions.toUpload[i].displayPath + "\n";
                }
                if (syncActions.toUpload.length > 15) {
                    confirmMsg += "  ... and " + (syncActions.toUpload.length - 15) + " more\n";
                }
                confirmMsg += "\n";
            }

            if (syncActions.toDownload.length > 0) {
                confirmMsg += "FILES TO DOWNLOAD (" + syncActions.toDownload.length + "):\n";
                for (var i = 0; i < Math.min(syncActions.toDownload.length, 15); i++) {
                    confirmMsg += "  - " + syncActions.toDownload[i].displayPath + "\n";
                }
                if (syncActions.toDownload.length > 15) {
                    confirmMsg += "  ... and " + (syncActions.toDownload.length - 15) + " more\n";
                }
            }

            if (!showWideConfirmDialog("FTP Sync Summary", confirmMsg, 600)) {
                progressStatusText.text   = "";
                progressOverallLabel.text = "";
                return;
            }

            var totalFiles     = syncActions.toUpload.length + syncActions.toDownload.length;
            var processedFiles = 0;

            for (var i = 0; i < syncActions.toUpload.length; i++) {
                var fileInfo = syncActions.toUpload[i];
                progressOverallBar.value  = (processedFiles / totalFiles) * 100;
                progressOverallLabel.text = "Uploading " + (processedFiles + 1) + " / " + totalFiles;
                progressStatusText.text   = fileInfo.displayPath;
                panel.layout.layout(true);

                var success = uploadFTPFile(ftpConfig, fileInfo.fullLocalPath, fileInfo.fullRemotePath);
                processedFiles++;
                if (!success) { progressStatusText.text = "Error: " + fileInfo.displayPath; }
            }

            for (var i = 0; i < syncActions.toDownload.length; i++) {
                var fileInfo = syncActions.toDownload[i];
                progressOverallBar.value  = (processedFiles / totalFiles) * 100;
                progressOverallLabel.text = "Downloading " + (processedFiles + 1) + " / " + totalFiles;
                progressStatusText.text   = fileInfo.displayPath;
                panel.layout.layout(true);

                var success = downloadFTPFile(ftpConfig, fileInfo.fullRemotePath, fileInfo.fullLocalPath);
                processedFiles++;
                if (!success) { progressStatusText.text = "Error: " + fileInfo.displayPath; }
            }

            progressOverallLabel.text = "Complete: " + totalFiles + " files";
            progressOverallBar.value  = 100;
            progressStatusText.text   = syncActions.toUpload.length + " uploaded, " + syncActions.toDownload.length + " downloaded";
            panel.layout.layout(true);

            alert("Sync complete!\n\n" +
                  "Uploaded: "   + syncActions.toUpload.length   + " files\n" +
                  "Downloaded: " + syncActions.toDownload.length + " files");

        } catch (error) {
            alert("Error during sync:\n" + error.message + "\nLine: " + error.line);
            progressStatusText.text = "Error: " + error.message;
        }
    };

    // ============================================================
    // PANEL SETUP
    // ============================================================

    panel.layout.layout(true);
    tabs.minimumSize     = [240, 310];
    mainGroup.minimumSize = mainGroup.size;

    panel.layout.resize();
    panel.onResizing = panel.onResize = function() { this.layout.resize(); };

    populateProjectDropdown();

    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
