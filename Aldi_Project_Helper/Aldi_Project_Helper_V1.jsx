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
 *
 * @version 1.0.0
 * @author Lennert
 */
(function createUI(thisObj) {
    // ============================================================
    // CONFIGURATION
    // ============================================================

    var SCRIPT_NAME = "Aldi Project Helper";
    var SCRIPT_VERSION = "v1.0.0";
    var SETTINGS_SECTION = "AldiProjectHelper";

    // Fixed path segment for all projects
    var AE_PATH_SEGMENT = "06_vfx/02_ae";

    // Folders to exclude when scanning for .aep files
    var EXCLUDED_FOLDERS = ["Adobe After Effects Auto-Save"];

    // ============================================================
    // HELPER FUNCTIONS - General Utilities
    // ============================================================

    /**
     * Pads a number with leading zeros to reach minimum length
     * @param {number} num - The number to pad
     * @param {number} minLength - Minimum length of resulting string
     * @returns {string} Padded number string
     */
    function padNumber(num, minLength) {
        var str = num.toString();
        while (str.length < minLength) {
            str = "0" + str;
        }
        return str;
    }

    /**
     * Gets current date in YYMMDD format
     * @returns {string} Date string
     */
    function getCurrentDate() {
        var date = new Date();
        return padNumber(date.getFullYear() % 100, 2) +
               padNumber(date.getMonth() + 1, 2) +
               padNumber(date.getDate(), 2);
    }

    /**
     * Formats a Date object to a readable string
     * @param {Date} date - The date to format
     * @returns {string} Formatted date string (DD.MM.YYYY HH:MM)
     */
    function formatDateReadable(date) {
        return padNumber(date.getDate(), 2) + "." +
               padNumber(date.getMonth() + 1, 2) + "." +
               date.getFullYear() + " " +
               padNumber(date.getHours(), 2) + ":" +
               padNumber(date.getMinutes(), 2);
    }

    /**
     * Checks if a string is a valid date in YYMMDD format (starting with 2)
     * @param {string} str - String to check
     * @returns {boolean} True if valid date format
     */
    function isDateValid(str) {
        return /^2\d{5}$/.test(str);
    }

    /**
     * Checks if a string is a valid KW format (KW followed by 2 digits)
     * @param {string} str - String to check
     * @returns {boolean} True if valid KW format
     */
    function isValidKW(str) {
        return /^KW\d{2}$/i.test(str);
    }

    /**
     * Extracts KW number from a KW string
     * @param {string} kwStr - KW string (e.g., "KW04")
     * @returns {number} KW number (e.g., 4)
     */
    function extractKWNumber(kwStr) {
        var match = kwStr.match(/^KW(\d{2})$/i);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Creates a KW string from a number
     * @param {number} num - KW number
     * @returns {string} KW string (e.g., "KW05")
     */
    function createKWString(num) {
        return "KW" + padNumber(num, 2);
    }

    // ============================================================
    // HELPER FUNCTIONS - Settings Persistence
    // ============================================================

    /**
     * Saves a setting to After Effects preferences
     * @param {string} key - Setting key
     * @param {string} value - Setting value
     */
    function saveSetting(key, value) {
        app.settings.saveSetting(SETTINGS_SECTION, key, value);
    }

    /**
     * Loads a setting from After Effects preferences
     * @param {string} key - Setting key
     * @param {string} defaultValue - Default value if setting doesn't exist
     * @returns {string} Setting value
     */
    function loadSetting(key, defaultValue) {
        if (app.settings.haveSetting(SETTINGS_SECTION, key)) {
            return app.settings.getSetting(SETTINGS_SECTION, key);
        }
        return defaultValue;
    }

    /**
     * Saves the project list to settings as JSON string
     * @param {Array} projects - Array of project objects {name, path}
     */
    function saveProjectList(projects) {
        // Convert to simple string format: name|path;name|path;...
        var parts = [];
        for (var i = 0; i < projects.length; i++) {
            parts.push(projects[i].name + "|" + projects[i].path);
        }
        saveSetting("projectList", parts.join(";"));
    }

    /**
     * Loads the project list from settings
     * @returns {Array} Array of project objects {name, path}
     */
    function loadProjectList() {
        var data = loadSetting("projectList", "");
        if (data === "") return [];

        var projects = [];
        var parts = data.split(";");
        for (var i = 0; i < parts.length; i++) {
            var pair = parts[i].split("|");
            if (pair.length === 2) {
                projects.push({
                    name: pair[0],
                    path: pair[1]
                });
            }
        }
        return projects;
    }

    // ============================================================
    // HELPER FUNCTIONS - File System Operations
    // ============================================================

    /**
     * Recursively scans a folder for .aep files
     * @param {Folder} folder - Folder to scan
     * @param {Array} results - Array to store results
     * @param {string} relativePath - Current relative path from base
     */
    function scanForAEPFiles(folder, results, relativePath) {
        if (!folder.exists) return;

        var items = folder.getFiles();
        for (var i = 0; i < items.length; i++) {
            var item = items[i];

            if (item instanceof Folder) {
                // Check if folder should be excluded
                var shouldExclude = false;
                for (var j = 0; j < EXCLUDED_FOLDERS.length; j++) {
                    if (item.name === EXCLUDED_FOLDERS[j]) {
                        shouldExclude = true;
                        break;
                    }
                }

                if (!shouldExclude) {
                    var newRelativePath = relativePath ? relativePath + "/" + item.name : item.name;
                    scanForAEPFiles(item, results, newRelativePath);
                }
            } else if (item instanceof File) {
                // Check if it's an .aep file
                if (item.name.toLowerCase().match(/\.aep$/)) {
                    results.push({
                        file: item,
                        relativePath: relativePath || "",
                        modDate: new Date(item.modified)
                    });
                }
            }
        }
    }

    /**
     * Detects sub-projects within the 02_ae folder
     * A sub-project is a folder that contains KW folders (or .aep files)
     * @param {Folder} aeFolder - The 02_ae folder
     * @returns {Array} Array of sub-project names, empty if none
     */
    function detectSubProjects(aeFolder) {
        if (!aeFolder.exists) return [];

        var subProjects = [];
        var items = aeFolder.getFiles();

        // First, check if there are direct KW folders at this level
        var hasDirectKW = false;
        for (var i = 0; i < items.length; i++) {
            if (items[i] instanceof Folder && isValidKW(items[i].name)) {
                hasDirectKW = true;
                break;
            }
        }

        // If there are direct KW folders, no sub-projects
        if (hasDirectKW) return [];

        // Otherwise, look for folders that contain KW folders or .aep files
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item instanceof Folder) {
                // Check if folder should be excluded
                var shouldExclude = false;
                for (var j = 0; j < EXCLUDED_FOLDERS.length; j++) {
                    if (item.name === EXCLUDED_FOLDERS[j]) {
                        shouldExclude = true;
                        break;
                    }
                }

                if (!shouldExclude) {
                    // Check if this folder contains KW folders or .aep files
                    var subItems = item.getFiles();
                    var containsKWOrAEP = false;
                    for (var k = 0; k < subItems.length; k++) {
                        if (subItems[k] instanceof Folder && isValidKW(subItems[k].name)) {
                            containsKWOrAEP = true;
                            break;
                        }
                        if (subItems[k] instanceof File && subItems[k].name.toLowerCase().match(/\.aep$/)) {
                            containsKWOrAEP = true;
                            break;
                        }
                    }

                    if (containsKWOrAEP) {
                        subProjects.push(item.name);
                    }
                }
            }
        }

        return subProjects;
    }

    /**
     * Finds the most recent .aep file in a folder (or sub-project)
     * @param {string} projectPath - Base project path
     * @param {string} subProject - Sub-project name (optional)
     * @returns {Object|null} Most recent file info {file, relativePath, modDate}
     */
    function findMostRecentAEP(projectPath, subProject) {
        var basePath = projectPath + "/" + AE_PATH_SEGMENT;
        if (subProject) {
            basePath += "/" + subProject;
        }

        var folder = new Folder(basePath);
        if (!folder.exists) return null;

        var results = [];
        scanForAEPFiles(folder, results, "");

        if (results.length === 0) return null;

        // Find the most recent file
        var mostRecent = results[0];
        for (var i = 1; i < results.length; i++) {
            if (results[i].modDate > mostRecent.modDate) {
                mostRecent = results[i];
            }
        }

        // Store the base path for reference
        mostRecent.basePath = basePath;

        return mostRecent;
    }

    /**
     * Detects which sub-project contains the most recent .aep file
     * @param {string} projectPath - Base project path
     * @param {Array} subProjects - Array of sub-project names
     * @returns {string|null} Name of sub-project with most recent file
     */
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

    /**
     * Extracts KW from a file path
     * @param {string} filePath - Full file path
     * @returns {string|null} KW string (e.g., "KW04") or null
     */
    function extractKWFromPath(filePath) {
        // Normalize path separators
        var normalizedPath = filePath.replace(/\\/g, "/");
        var parts = normalizedPath.split("/");

        // Search from end to beginning for a KW folder
        for (var i = parts.length - 1; i >= 0; i--) {
            if (isValidKW(parts[i])) {
                return parts[i].toUpperCase();
            }
        }

        return null;
    }

    /**
     * Gets the parent folder path of a KW folder from a file path
     * @param {string} filePath - Full file path
     * @returns {string|null} Path to the folder containing KW folders
     */
    function getKWParentPath(filePath) {
        var normalizedPath = filePath.replace(/\\/g, "/");
        var parts = normalizedPath.split("/");

        // Find the KW folder and return everything before it
        for (var i = parts.length - 1; i >= 0; i--) {
            if (isValidKW(parts[i])) {
                return parts.slice(0, i).join("/");
            }
        }

        return null;
    }

    /**
     * Opens a folder in the system file browser (Finder on Mac, Explorer on Windows)
     * @param {string} folderPath - Path to open
     */
    function openInFileBrowser(folderPath) {
        var folder = new Folder(folderPath);
        if (folder.exists) {
            // Folder.execute() opens the folder in the default file browser
            folder.execute();
        } else {
            alert("Folder does not exist:\n" + folderPath);
        }
    }

    // ============================================================
    // HELPER FUNCTIONS - Name Processing
    // ============================================================

    /**
     * Finds date in name parts
     * @param {Array} parts - Name split by underscore
     * @returns {Object|null} {index, value} or null
     */
    function findDateInParts(parts) {
        for (var i = 0; i < parts.length; i++) {
            if (isDateValid(parts[i])) {
                return { index: i, value: parts[i] };
            }
        }
        return null;
    }

    /**
     * Finds version number in name parts (last part with 2+ digits only)
     * @param {Array} parts - Name split by underscore
     * @returns {Object|null} {index, number, fullVersion} or null
     */
    function parseVersion(parts) {
        for (var i = parts.length - 1; i >= 0; i--) {
            if (/^\d{2,}$/.test(parts[i])) {
                return {
                    index: i,
                    number: parts[i],
                    fullVersion: parts[i]
                };
            }
        }
        return null;
    }

    /**
     * Finds initials in name parts (last part with exactly 2 lowercase letters)
     * @param {Array} parts - Name split by underscore
     * @returns {Object|null} {index, value} or null
     */
    function parseInitials(parts) {
        for (var i = parts.length - 1; i >= 0; i--) {
            if (/^[a-z]{2}$/.test(parts[i])) {
                return { index: i, value: parts[i] };
            }
        }
        return null;
    }

    /**
     * Finds KW in name parts
     * @param {Array} parts - Name split by underscore
     * @returns {Object|null} {index, value, number} or null
     */
    function parseKWInName(parts) {
        for (var i = 0; i < parts.length; i++) {
            if (isValidKW(parts[i])) {
                return {
                    index: i,
                    value: parts[i],
                    number: extractKWNumber(parts[i])
                };
            }
        }
        return null;
    }

    /**
     * Increments a version number while preserving leading zeros
     * @param {Object} version - Version object from parseVersion
     * @returns {Object} New version object with incremented number
     */
    function incrementVersion(version) {
        if (!version) return null;
        var num = parseInt(version.number, 10);
        var newNum = padNumber(num + 1, version.number.length);
        return {
            number: newNum,
            fullVersion: newNum
        };
    }

    /**
     * Processes a filename and creates a new versioned name
     * @param {string} originalName - Original filename (without extension)
     * @param {Object} options - Processing options
     * @param {boolean} options.includeInitials - Whether to update initials
     * @param {string} options.newInitials - New initials to use
     * @param {boolean} options.resetVersion - Whether to reset version to 01
     * @param {string} options.newKW - New KW value (optional)
     * @returns {Object} Processing result
     */
    function processFileName(originalName, options) {
        var parts = originalName.split('_');
        var newParts = parts.slice(); // Create a copy

        // Find components
        var dateInfo = findDateInParts(parts);
        var versionPart = parseVersion(parts);
        var initialsInfo = parseInitials(parts);
        var kwInfo = parseKWInName(parts);

        var hasDateChange = false;
        var hasVersionChange = false;
        var hasInitialsChange = false;
        var hasKWChange = false;

        // Update date
        if (dateInfo) {
            if (dateInfo.value !== getCurrentDate()) {
                newParts[dateInfo.index] = getCurrentDate();
                hasDateChange = true;
            }
        } else {
            // No date found - ask user if they want to add it
            if (confirm("No date was found in the filename.\nWould you like to add today's date at the beginning?")) {
                newParts.unshift(getCurrentDate());
                // Recalculate indices since we added at beginning
                if (versionPart) versionPart.index++;
                if (initialsInfo) initialsInfo.index++;
                if (kwInfo) kwInfo.index++;
                hasDateChange = true;
            }
        }

        // Update KW if specified
        if (options.newKW && kwInfo) {
            if (kwInfo.value.toUpperCase() !== options.newKW.toUpperCase()) {
                newParts[kwInfo.index] = options.newKW;
                hasKWChange = true;
            }
        }

        // Update version
        if (versionPart) {
            if (options.resetVersion) {
                newParts[versionPart.index] = padNumber(1, versionPart.number.length);
                hasVersionChange = true;
            } else {
                var newVersion = incrementVersion(versionPart);
                newParts[versionPart.index] = newVersion.fullVersion;
                hasVersionChange = true;
            }
        } else {
            // No version found
            alert("Could not find version number in filename:\n" + originalName);
            return null;
        }

        // Update initials
        if (options.includeInitials && options.newInitials) {
            if (initialsInfo) {
                if (initialsInfo.value !== options.newInitials) {
                    newParts[initialsInfo.index] = options.newInitials;
                    hasInitialsChange = true;
                }
            } else {
                // No initials found - ask user if they want to add them
                if (confirm("No initials were found in the filename.\nWould you like to add your initials (" + options.newInitials + ")?")) {
                    newParts.push(options.newInitials);
                    hasInitialsChange = true;
                }
            }
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
    // UI CREATION
    // ============================================================

    // Create panel (dockable) or window (standalone)
    var panel = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", SCRIPT_NAME + " " + SCRIPT_VERSION, undefined, {resizeable: true});

    // Main container
    var mainGroup = panel.add("group");
    mainGroup.orientation = "column";
    mainGroup.alignment = ["fill", "fill"];
    mainGroup.alignChildren = ["fill", "top"];
    mainGroup.spacing = 10;
    mainGroup.margins = 16;

    // ---- Title ----
    var titleText = mainGroup.add("statictext", undefined, SCRIPT_NAME + " " + SCRIPT_VERSION);
    titleText.alignment = ["center", "top"];

    // ---- Separator ----
    var sep1 = mainGroup.add("panel", undefined, undefined, {borderStyle: "sunken"});
    sep1.alignment = ["fill", "top"];

    // ---- Initials Section ----
    var initialsGroup = mainGroup.add("group");
    initialsGroup.orientation = "row";
    initialsGroup.alignment = ["fill", "top"];
    initialsGroup.alignChildren = ["left", "center"];

    var initialsLabel = initialsGroup.add("statictext", undefined, "Initials:");
    var initialsInput = initialsGroup.add("edittext", undefined, "");
    initialsInput.preferredSize.width = 50;
    initialsInput.characters = 4;

    // Load saved initials
    initialsInput.text = loadSetting("initials", "");

    // Save initials when changed
    initialsInput.onChange = function() {
        var value = this.text.toLowerCase();
        if (/^[a-z]{2}$/.test(value)) {
            this.text = value;
            saveSetting("initials", value);
        } else if (value === "") {
            saveSetting("initials", "");
        } else {
            // Reset to previous valid value
            this.text = loadSetting("initials", "");
            alert("Initials must be exactly 2 lowercase letters.");
        }
    };

    // ---- Separator ----
    var sep2 = mainGroup.add("panel", undefined, undefined, {borderStyle: "sunken"});
    sep2.alignment = ["fill", "top"];

    // ---- Project Section ----
    var projectLabel = mainGroup.add("statictext", undefined, "Active Project:");
    projectLabel.alignment = ["left", "top"];

    var projectDropdownGroup = mainGroup.add("group");
    projectDropdownGroup.orientation = "row";
    projectDropdownGroup.alignment = ["fill", "top"];
    projectDropdownGroup.alignChildren = ["fill", "center"];

    var projectDropdown = projectDropdownGroup.add("dropdownlist", undefined, []);
    projectDropdown.alignment = ["fill", "center"];
    projectDropdown.preferredSize.width = 200;

    var projectButtonGroup = projectDropdownGroup.add("group");
    projectButtonGroup.orientation = "row";
    projectButtonGroup.spacing = 5;

    var addProjectBtn = projectButtonGroup.add("button", undefined, "+");
    addProjectBtn.preferredSize = [30, 25];
    addProjectBtn.helpTip = "Add a new project";

    var removeProjectBtn = projectButtonGroup.add("button", undefined, "-");
    removeProjectBtn.preferredSize = [30, 25];
    removeProjectBtn.helpTip = "Remove current project";

    // ---- Sub-project Section (initially hidden) ----
    var subProjectGroup = mainGroup.add("group");
    subProjectGroup.orientation = "column";
    subProjectGroup.alignment = ["fill", "top"];
    subProjectGroup.alignChildren = ["fill", "top"];
    subProjectGroup.visible = false;

    var subProjectLabel = subProjectGroup.add("statictext", undefined, "Sub-project:");
    var subProjectDropdown = subProjectGroup.add("dropdownlist", undefined, []);
    subProjectDropdown.alignment = ["fill", "center"];

    // ---- Separator ----
    var sep3 = mainGroup.add("panel", undefined, undefined, {borderStyle: "sunken"});
    sep3.alignment = ["fill", "top"];

    // ---- Recent File Section ----
    var recentFileLabel = mainGroup.add("statictext", undefined, "Most Recent File:");
    recentFileLabel.alignment = ["left", "top"];

    var recentFileNameText = mainGroup.add("statictext", undefined, "No project selected");
    recentFileNameText.alignment = ["fill", "top"];
    recentFileNameText.graphics.font = ScriptUI.newFont(recentFileNameText.graphics.font.name, "Bold", recentFileNameText.graphics.font.size);

    var recentFileDateText = mainGroup.add("statictext", undefined, "");
    recentFileDateText.alignment = ["left", "top"];

    // ---- File Action Buttons ----
    var fileActionGroup = mainGroup.add("group");
    fileActionGroup.orientation = "row";
    fileActionGroup.alignment = ["fill", "top"];
    fileActionGroup.alignChildren = ["fill", "center"];

    var openFileBtn = fileActionGroup.add("button", undefined, "Open File");
    openFileBtn.alignment = ["fill", "center"];
    openFileBtn.enabled = false;

    var openFolderBtn = fileActionGroup.add("button", undefined, "Open Folder");
    openFolderBtn.alignment = ["fill", "center"];
    openFolderBtn.enabled = false;

    // ---- Separator ----
    var sep4 = mainGroup.add("panel", undefined, undefined, {borderStyle: "sunken"});
    sep4.alignment = ["fill", "top"];

    // ---- Version Buttons ----
    var versionLabel = mainGroup.add("statictext", undefined, "Version Up:");
    versionLabel.alignment = ["left", "top"];

    var versionButtonGroup = mainGroup.add("group");
    versionButtonGroup.orientation = "row";
    versionButtonGroup.alignment = ["fill", "top"];
    versionButtonGroup.alignChildren = ["fill", "center"];

    var aepBtn = versionButtonGroup.add("button", undefined, "AEP");
    aepBtn.alignment = ["fill", "center"];
    aepBtn.helpTip = "Save project with incremented version";

    var compBtn = versionButtonGroup.add("button", undefined, "Comp");
    compBtn.alignment = ["fill", "center"];
    compBtn.helpTip = "Duplicate selected compositions with incremented version";

    var newKWBtn = versionButtonGroup.add("button", undefined, "New KW");
    newKWBtn.alignment = ["fill", "center"];
    newKWBtn.helpTip = "Create new KW folder and save project there";

    // ---- Refresh Button ----
    var refreshBtn = mainGroup.add("button", undefined, "Refresh");
    refreshBtn.alignment = ["fill", "top"];
    refreshBtn.helpTip = "Refresh file list and sub-project detection";

    // ============================================================
    // STATE MANAGEMENT
    // ============================================================

    var currentProjects = [];
    var currentSubProjects = [];
    var currentMostRecentFile = null;

    /**
     * Populates the project dropdown from saved settings
     */
    function populateProjectDropdown() {
        projectDropdown.removeAll();
        currentProjects = loadProjectList();

        for (var i = 0; i < currentProjects.length; i++) {
            projectDropdown.add("item", currentProjects[i].name);
        }

        // Restore last selected project
        var lastProject = loadSetting("lastProject", "");
        if (lastProject) {
            for (var i = 0; i < projectDropdown.items.length; i++) {
                if (projectDropdown.items[i].text === lastProject) {
                    projectDropdown.selection = i;
                    break;
                }
            }
        }

        // If nothing selected but items exist, select first
        if (!projectDropdown.selection && projectDropdown.items.length > 0) {
            projectDropdown.selection = 0;
        }

        updateUIState();
    }

    /**
     * Updates the sub-project dropdown
     * @param {string} projectPath - Path to the project
     */
    function updateSubProjects(projectPath) {
        subProjectDropdown.removeAll();
        currentSubProjects = [];

        if (!projectPath) {
            subProjectGroup.visible = false;
            return;
        }

        var aeFolder = new Folder(projectPath + "/" + AE_PATH_SEGMENT);
        currentSubProjects = detectSubProjects(aeFolder);

        if (currentSubProjects.length === 0) {
            subProjectGroup.visible = false;
            return;
        }

        // Add "All" option
        subProjectDropdown.add("item", "(All)");

        // Add sub-projects
        for (var i = 0; i < currentSubProjects.length; i++) {
            subProjectDropdown.add("item", currentSubProjects[i]);
        }

        // Find which sub-project has the most recent file
        var mostRecentSubProject = findSubProjectWithMostRecent(projectPath, currentSubProjects);

        // Select the sub-project with most recent file, or "(All)" if none found
        if (mostRecentSubProject) {
            for (var i = 0; i < subProjectDropdown.items.length; i++) {
                if (subProjectDropdown.items[i].text === mostRecentSubProject) {
                    subProjectDropdown.selection = i;
                    break;
                }
            }
        } else {
            subProjectDropdown.selection = 0; // "(All)"
        }

        subProjectGroup.visible = true;
    }

    /**
     * Updates the most recent file display
     */
    function updateMostRecentFile() {
        if (!projectDropdown.selection) {
            recentFileNameText.text = "No project selected";
            recentFileDateText.text = "";
            currentMostRecentFile = null;
            openFileBtn.enabled = false;
            openFolderBtn.enabled = false;
            return;
        }

        var projectIndex = projectDropdown.selection.index;
        var projectPath = currentProjects[projectIndex].path;

        var subProject = null;
        if (subProjectGroup.visible && subProjectDropdown.selection) {
            var subProjectIndex = subProjectDropdown.selection.index;
            if (subProjectIndex > 0) { // Not "(All)"
                subProject = currentSubProjects[subProjectIndex - 1];
            }
        }

        currentMostRecentFile = findMostRecentAEP(projectPath, subProject);

        if (currentMostRecentFile) {
            recentFileNameText.text = currentMostRecentFile.file.name;
            recentFileDateText.text = "Modified: " + formatDateReadable(currentMostRecentFile.modDate);
            openFileBtn.enabled = true;
            openFolderBtn.enabled = true;
        } else {
            recentFileNameText.text = "No .aep files found";
            recentFileDateText.text = "";
            openFileBtn.enabled = false;
            openFolderBtn.enabled = true; // Still allow opening folder
        }
    }

    /**
     * Updates the entire UI state based on current selection
     */
    function updateUIState() {
        if (!projectDropdown.selection) {
            subProjectGroup.visible = false;
            recentFileNameText.text = "No project selected";
            recentFileDateText.text = "";
            currentMostRecentFile = null;
            openFileBtn.enabled = false;
            openFolderBtn.enabled = false;
            return;
        }

        var projectIndex = projectDropdown.selection.index;
        var projectPath = currentProjects[projectIndex].path;

        // Check if project path exists
        var projectFolder = new Folder(projectPath);
        if (!projectFolder.exists) {
            recentFileNameText.text = "Project folder not found!";
            recentFileDateText.text = projectPath;
            subProjectGroup.visible = false;
            openFileBtn.enabled = false;
            openFolderBtn.enabled = false;
            return;
        }

        updateSubProjects(projectPath);
        updateMostRecentFile();

        // Save last selected project
        saveSetting("lastProject", currentProjects[projectIndex].name);
    }

    // ============================================================
    // EVENT HANDLERS
    // ============================================================

    // Project dropdown change
    projectDropdown.onChange = function() {
        updateUIState();
    };

    // Sub-project dropdown change
    subProjectDropdown.onChange = function() {
        updateMostRecentFile();
    };

    // Add project button
    addProjectBtn.onClick = function() {
        var folder = Folder.selectDialog("Select Project Folder");
        if (folder) {
            var projectName = folder.name;
            var projectPath = folder.fsName;

            // Check if project already exists
            for (var i = 0; i < currentProjects.length; i++) {
                if (currentProjects[i].path === projectPath) {
                    alert("This project is already in the list.");
                    return;
                }
            }

            // Add to list
            currentProjects.push({
                name: projectName,
                path: projectPath
            });

            // Save and refresh
            saveProjectList(currentProjects);
            populateProjectDropdown();

            // Select the newly added project
            for (var i = 0; i < projectDropdown.items.length; i++) {
                if (projectDropdown.items[i].text === projectName) {
                    projectDropdown.selection = i;
                    break;
                }
            }
        }
    };

    // Remove project button
    removeProjectBtn.onClick = function() {
        if (!projectDropdown.selection) {
            alert("Please select a project to remove.");
            return;
        }

        var projectName = projectDropdown.selection.text;
        if (confirm("Are you sure you want to remove \"" + projectName + "\" from the list?\n\n(This only removes it from the list, it does not delete any files.)")) {
            var projectIndex = projectDropdown.selection.index;
            currentProjects.splice(projectIndex, 1);
            saveProjectList(currentProjects);
            populateProjectDropdown();
        }
    };

    // Open file button
    openFileBtn.onClick = function() {
        if (currentMostRecentFile && currentMostRecentFile.file.exists) {
            app.open(currentMostRecentFile.file);
        } else {
            alert("No file to open.");
        }
    };

    // Open folder button
    openFolderBtn.onClick = function() {
        if (!projectDropdown.selection) {
            alert("Please select a project first.");
            return;
        }

        var projectIndex = projectDropdown.selection.index;
        var projectPath = currentProjects[projectIndex].path;
        var folderPath = projectPath + "/" + AE_PATH_SEGMENT;

        openInFileBrowser(folderPath);
    };

    // Refresh button
    refreshBtn.onClick = function() {
        updateUIState();
    };

    // AEP version up button
    aepBtn.onClick = function() {
        try {
            if (!app.project.file) {
                alert("Please save the project first.");
                return;
            }

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

            // Show confirmation dialog
            if (confirm("Save project as:\n\n" + result.newName + ".aep\n\n(in same folder)")) {
                var newFile = new File(app.project.file.parent.fsName + "/" + result.newName + ".aep");

                // Check if file already exists
                if (newFile.exists) {
                    if (!confirm("A file with this name already exists.\nDo you want to overwrite it?")) {
                        return;
                    }
                }

                app.project.save(newFile);

                // Refresh the file list
                updateMostRecentFile();
            }
        } catch (error) {
            alert("Error in AEP version up:\n" + error.message + "\nLine: " + error.line);
        }
    };

    // Comp version up button
    compBtn.onClick = function() {
        try {
            var selectedComps = [];
            for (var i = 1; i <= app.project.numItems; i++) {
                if (app.project.item(i).selected && app.project.item(i) instanceof CompItem) {
                    selectedComps.push(app.project.item(i));
                }
            }

            if (selectedComps.length === 0) {
                alert("Please select at least one composition.");
                return;
            }

            var currentInitials = initialsInput.text.toLowerCase();
            if (currentInitials !== "" && !/^[a-z]{2}$/.test(currentInitials)) {
                alert("Initials must be exactly 2 lowercase letters or empty.");
                return;
            }

            // Process all selected comps
            var newNames = [];
            var hasError = false;

            for (var i = 0; i < selectedComps.length; i++) {
                var result = processFileName(selectedComps[i].name, {
                    includeInitials: true,
                    newInitials: currentInitials,
                    resetVersion: false
                });

                if (!result) {
                    hasError = true;
                    break;
                }

                newNames.push(result.newName);
            }

            if (hasError) return;

            // Build confirmation message
            var confirmMsg = "Duplicate compositions:\n\n";
            for (var i = 0; i < selectedComps.length; i++) {
                confirmMsg += selectedComps[i].name + "\n  -> " + newNames[i] + "\n";
            }
            confirmMsg += "\nMove original compositions to _old folder?";

            // Use a dialog to ask about moving to _old
            var moveToOld = confirm(confirmMsg);

            app.beginUndoGroup("Version Up Compositions");

            var newComps = [];

            for (var i = 0; i < selectedComps.length; i++) {
                var comp = selectedComps[i];
                var newComp = comp.duplicate();
                newComp.name = newNames[i];
                newComps.push(newComp);

                if (moveToOld) {
                    // Find or create _old folder
                    var parentFolder = comp.parentFolder;
                    var oldFolder = null;

                    for (var j = 1; j <= app.project.numItems; j++) {
                        var item = app.project.item(j);
                        if (item instanceof FolderItem &&
                            item.name === "_old" &&
                            item.parentFolder === parentFolder) {
                            oldFolder = item;
                            break;
                        }
                    }

                    if (!oldFolder) {
                        oldFolder = app.project.items.addFolder("_old");
                        if (parentFolder) {
                            oldFolder.parentFolder = parentFolder;
                        }
                    }

                    comp.parentFolder = oldFolder;
                }
            }

            // Deselect old comps, select new ones
            for (var i = 0; i < selectedComps.length; i++) {
                selectedComps[i].selected = false;
            }
            for (var i = 0; i < newComps.length; i++) {
                newComps[i].selected = true;
            }

            app.endUndoGroup();

        } catch (error) {
            alert("Error in Comp version up:\n" + error.message + "\nLine: " + error.line);
        }
    };

    // New KW button
    newKWBtn.onClick = function() {
        try {
            // Determine which file to use
            var sourceFile = null;
            var sourceFilePath = null;

            if (app.project.file) {
                // Use currently open project
                sourceFile = app.project.file;
                sourceFilePath = sourceFile.fsName;
            } else if (currentMostRecentFile && currentMostRecentFile.file) {
                // Use most recent file from list
                sourceFile = currentMostRecentFile.file;
                sourceFilePath = sourceFile.fsName;
            } else {
                alert("No project is open and no recent file was found.\nPlease open a project or select a project from the list.");
                return;
            }

            // Extract KW from path
            var currentKW = extractKWFromPath(sourceFilePath);
            if (!currentKW) {
                alert("Could not find KW folder in path:\n" + sourceFilePath);
                return;
            }

            var currentKWNum = extractKWNumber(currentKW);
            var newKWNum = currentKWNum + 1;
            var newKW = createKWString(newKWNum);

            // Get the parent path where KW folders live
            var kwParentPath = getKWParentPath(sourceFilePath);
            if (!kwParentPath) {
                alert("Could not determine KW parent folder.");
                return;
            }

            // Create new KW folder
            var newKWFolder = new Folder(kwParentPath + "/" + newKW);
            if (!newKWFolder.exists) {
                var created = newKWFolder.create();
                if (!created) {
                    alert("Could not create new KW folder:\n" + newKWFolder.fsName);
                    return;
                }
            }

            // Process filename
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

            // Build new file path
            var newFilePath = newKWFolder.fsName + "/" + result.newName + ".aep";
            var newFile = new File(newFilePath);

            // Show confirmation
            var confirmMsg = "Create new KW:\n\n";
            confirmMsg += "From: " + currentKW + "\n";
            confirmMsg += "To: " + newKW + "\n\n";
            confirmMsg += "New file:\n" + result.newName + ".aep\n\n";
            confirmMsg += "Location:\n" + newKWFolder.fsName;

            if (!confirm(confirmMsg)) {
                // Remove the folder if we just created it and it's empty
                if (newKWFolder.getFiles().length === 0) {
                    newKWFolder.remove();
                }
                return;
            }

            // If no project is open, open the source file first
            if (!app.project.file) {
                app.open(sourceFile);
            }

            // Save to new location
            app.project.save(newFile);

            // Refresh the file list
            updateUIState();

        } catch (error) {
            alert("Error in New KW:\n" + error.message + "\nLine: " + error.line);
        }
    };

    // ============================================================
    // PANEL SETUP
    // ============================================================

    // Setup panel sizing
    panel.layout.layout(true);
    mainGroup.minimumSize = mainGroup.size;

    // Make panel resizable
    panel.layout.resize();
    panel.onResizing = panel.onResize = function() {
        this.layout.resize();
    };

    // Initial population
    populateProjectDropdown();

    // Show panel if standalone window
    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
