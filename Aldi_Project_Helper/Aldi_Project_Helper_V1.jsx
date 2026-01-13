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
    var SCRIPT_VERSION = "v1.4.3";
    var SETTINGS_SECTION = "AldiProjectHelper";

    // Fixed path segment for all projects
    var AE_PATH_SEGMENT = "06_vfx/02_ae";

    // Folders to exclude when scanning for .aep files
    var EXCLUDED_FOLDERS = ["Adobe After Effects Auto-Save"];

    // FTP sync paths relative to project root
    var FTP_INPUT_PATH = "01_inbox";
    var FTP_OUTPUT_PATH = "06_vfx/03_out";

    // FTP config file location
    var FTP_CONFIG_FILE = "~/Documents/AldiProjectHelper_FTP.txt";

    // Detect operating system
    var IS_MAC = ($.os.indexOf("Mac") !== -1);

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
     * Gets the modification date of a file using system commands
     * More reliable than ExtendScript's File.modified property
     * @param {string} filePath - Full path to the file
     * @returns {string} Formatted date string (DD.MM.YYYY HH:MM) or empty string on error
     */
    function getFileModificationDate(filePath) {
        try {
            var result = "";
            if (IS_MAC) {
                // Use stat on Mac to get formatted modification date
                // -f "%Sm" = modification time, -t = format string
                result = system.callSystem('stat -f "%Sm" -t "%d.%m.%Y %H:%M" "' + filePath + '"');
                // Trim whitespace/newlines from result
                return result.replace(/^\s+|\s+$/g, "");
            } else {
                // Windows: use ExtendScript's native File.modified property
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
                    // Double-check: skip files in excluded folders (by checking full path)
                    var fullPath = item.fsName;
                    var isInExcludedFolder = false;
                    for (var k = 0; k < EXCLUDED_FOLDERS.length; k++) {
                        if (fullPath.indexOf(EXCLUDED_FOLDERS[k]) !== -1) {
                            isInExcludedFolder = true;
                            break;
                        }
                    }
                    if (!isInExcludedFolder) {
                        results.push({
                            file: item,
                            relativePath: relativePath || "",
                            modDate: new Date(item.modified)
                        });
                    }
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

    /**
     * Gets the current date as YYMMDD string
     * @returns {string} Date string in YYMMDD format
     */
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

    /**
     * Gets the current time rounded to nearest 5 minutes as HHhMM string
     * @returns {string} Time string in HHhMM format (e.g., "14h45")
     */
    function getRenderTimeFolder() {
        var date = new Date();
        var hours = date.getHours();
        var minutes = date.getMinutes();

        // Round to nearest 5 minutes
        minutes = Math.round(minutes / 5) * 5;

        // Handle overflow (e.g., 57 minutes rounds to 60)
        if (minutes === 60) {
            minutes = 0;
            hours++;
            if (hours === 24) {
                hours = 0;
            }
        }

        var hoursStr = hours.toString();
        if (hoursStr.length < 2) hoursStr = "0" + hoursStr;
        var minutesStr = minutes.toString();
        if (minutesStr.length < 2) minutesStr = "0" + minutesStr;

        return hoursStr + "h" + minutesStr;
    }

    /**
     * Copies text to clipboard using system commands
     * @param {string} text - Text to copy
     * @returns {boolean} True if successful
     */
    function copyToClipboard(text) {
        try {
            if (IS_MAC) {
                // On Mac, use pbcopy
                system.callSystem('echo "' + text.replace(/"/g, '\\"') + '" | pbcopy');
            } else {
                // On Windows, use temp file + batch file approach (more reliable)
                var tempFolder = Folder.temp.fsName;

                // Write text to temp file
                var clipTxtFile = new File(tempFolder + "/ClipBoard.txt");
                clipTxtFile.open('w');
                clipTxtFile.write(text);
                clipTxtFile.close();

                // Create and execute batch file to copy to clipboard
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

    /**
     * Shows a dialog with a copyable path
     * @param {string} title - Dialog title
     * @param {string} message - Message to display
     * @param {string} path - Path to show in copyable field
     */
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

    /**
     * Shows a confirmation dialog with custom width for better display of long text
     * @param {string} title - Dialog title
     * @param {string} message - Message to display
     * @param {number} width - Dialog width in pixels (default 500)
     * @returns {boolean} True if user clicked OK/Yes, false if Cancel/No
     */
    function showWideConfirmDialog(title, message, width) {
        width = width || 500;

        var dialog = new Window("dialog", title);
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.preferredSize.width = width;

        // Add scrollable text area for long messages
        var textGroup = dialog.add("group");
        textGroup.orientation = "column";
        textGroup.alignChildren = ["fill", "fill"];
        textGroup.preferredSize = [width - 40, 300];

        var textArea = textGroup.add("edittext", undefined, message, {multiline: true, readonly: true, scrolling: true});
        textArea.preferredSize = [width - 40, 280];

        // Button group
        var buttonGroup = dialog.add("group");
        buttonGroup.orientation = "row";
        buttonGroup.alignment = ["center", "top"];

        var okBtn = buttonGroup.add("button", undefined, "Sync", {name: "ok"});
        var cancelBtn = buttonGroup.add("button", undefined, "Cancel", {name: "cancel"});

        okBtn.onClick = function() { dialog.close(1); };
        cancelBtn.onClick = function() { dialog.close(0); };

        return dialog.show() === 1;
    }

    // ============================================================
    // HELPER FUNCTIONS - FTP Operations
    // ============================================================

    /**
     * Loads FTP connections from the config file
     * @returns {Array} Array of FTP connection objects
     */
    function loadFTPConfig() {
        var configFile = new File(FTP_CONFIG_FILE);
        var connections = [];

        if (!configFile.exists) {
            return connections;
        }

        configFile.open("r");
        var content = configFile.read();
        configFile.close();

        // Parse the config file
        var blocks = content.split("[CONNECTION]");
        for (var i = 1; i < blocks.length; i++) {
            var block = blocks[i];
            var endIndex = block.indexOf("[/CONNECTION]");
            if (endIndex !== -1) {
                block = block.substring(0, endIndex);
            }

            var connection = {};
            var lines = block.split("\n");
            for (var j = 0; j < lines.length; j++) {
                var line = lines[j].replace(/^\s+|\s+$/g, ""); // trim
                if (line.indexOf("=") !== -1 && line.indexOf("#") !== 0) {
                    var parts = line.split("=");
                    var key = parts[0].replace(/^\s+|\s+$/g, "");
                    var value = parts.slice(1).join("=").replace(/^\s+|\s+$/g, "");
                    connection[key] = value;
                }
            }

            if (connection.project_folder && connection.hostname) {
                connections.push(connection);
            }
        }

        return connections;
    }

    /**
     * Finds FTP connection for a given project
     * @param {string} projectName - Name of the project folder
     * @returns {Object|null} FTP connection object or null
     */
    function getFTPConnectionForProject(projectName) {
        var connections = loadFTPConfig();
        for (var i = 0; i < connections.length; i++) {
            if (connections[i].project_folder === projectName) {
                return connections[i];
            }
        }
        return null;
    }

    /**
     * Checks if a folder name is a valid date format (YYMMDD - 6 digits)
     * @param {string} name - Folder name to check
     * @returns {boolean} True if valid date folder
     */
    function isDateFolder(name) {
        return /^\d{6}$/.test(name);
    }

    /**
     * Gets date folders from a directory, sorted by name descending (most recent first)
     * @param {string} folderPath - Path to scan
     * @returns {Array} Array of folder names that match date format
     */
    function getDateFolders(folderPath) {
        var folder = new Folder(folderPath);
        if (!folder.exists) return [];

        var dateFolders = [];
        var items = folder.getFiles();

        for (var i = 0; i < items.length; i++) {
            if (items[i] instanceof Folder && isDateFolder(items[i].name)) {
                dateFolders.push(items[i].name);
            }
        }

        // Sort descending (most recent first)
        dateFolders.sort(function(a, b) {
            return b.localeCompare(a);
        });

        return dateFolders;
    }

    /**
     * Gets the N most recent date folders
     * @param {string} folderPath - Path to scan
     * @param {number} count - Number of folders to return
     * @returns {Array} Array of folder names
     */
    function getLatestDateFolders(folderPath, count) {
        var dateFolders = getDateFolders(folderPath);
        return dateFolders.slice(0, count);
    }

    /**
     * Recursively scans a folder and returns all files with relative paths
     * @param {Folder} folder - Folder to scan
     * @param {string} basePath - Base path for relative path calculation
     * @param {Array} results - Array to store results
     */
    function scanFolderForFiles(folder, basePath, results) {
        if (!folder.exists) return;

        var items = folder.getFiles();
        for (var i = 0; i < items.length; i++) {
            var item = items[i];

            // Skip hidden/system files
            if (shouldSkipFile(item.name)) continue;

            if (item instanceof Folder) {
                scanFolderForFiles(item, basePath, results);
            } else if (item instanceof File) {
                // Normalize both paths to forward slashes before comparison (Windows uses backslashes)
                var normalizedFsName = item.fsName.replace(/\\/g, "/");
                var normalizedBasePath = basePath.replace(/\\/g, "/");
                var relativePath = normalizedFsName.replace(normalizedBasePath, "").replace(/^\//, "");
                results.push({
                    file: item,
                    relativePath: relativePath,
                    size: item.length,
                    modified: new Date(item.modified)
                });
            }
        }
    }

    /**
     * Executes a shell command and returns the output
     * Uses system.callSystem which works directly in After Effects
     * On Mac: Call command directly (like Terminal)
     * On Windows: Use cmd /c prefix
     * @param {string} command - Command to execute
     * @returns {string} Command output
     */
    function executeCommand(command) {
        var result = "";

        try {
            if (IS_MAC) {
                // On Mac, system.callSystem works like Terminal - call directly
                result = system.callSystem(command);
            } else {
                // On Windows, use VBScript to run command silently (hidden window)
                var tempFolder = Folder.temp.fsName;
                var outputFile = tempFolder + "\\ae_cmd_output.txt";
                var batFile = tempFolder + "\\ae_cmd_runner.bat";
                var vbsFile = tempFolder + "\\ae_cmd_launcher.vbs";

                // Delete old output file if exists
                var oldOutput = new File(outputFile);
                if (oldOutput.exists) oldOutput.remove();

                // Create batch file with the command
                var bat = new File(batFile);
                bat.open('w');
                bat.writeln('@echo off');
                bat.writeln(command + ' > "' + outputFile + '" 2>&1');
                bat.close();

                // Create VBScript that runs batch file with hidden window
                // The "0" parameter hides the window, "True" waits for completion
                var vbs = new File(vbsFile);
                vbs.open('w');
                vbs.writeln('Set objShell = CreateObject("WScript.Shell")');
                vbs.writeln('objShell.Run """' + batFile + '""", 0, True');
                vbs.close();

                // Execute the VBScript using system.callSystem to properly wait for completion
                // wscript //B runs in batch mode (no script errors/popups)
                // wscript itself doesn't show a window, only the batch file would (but that's hidden via 0 parameter)
                system.callSystem('wscript //B "' + vbsFile + '"');

                // Read output file
                var outFile = new File(outputFile);
                if (outFile.exists) {
                    outFile.open('r');
                    result = outFile.read();
                    outFile.close();
                }
            }
        } catch (e) {
            result = "";
        }

        return result || "";
    }

    /**
     * Lists files on FTP server using curl
     * @param {Object} ftpConfig - FTP connection config
     * @param {string} remotePath - Path on FTP server
     * @returns {Array} Array of file info objects
     */
    function listFTPFiles(ftpConfig, remotePath) {
        var port = ftpConfig.port || "21";
        var url = "ftp://" + ftpConfig.hostname + ":" + port + "/" + remotePath + "/";

        // Use curl to list directory recursively
        var command = "curl -s -l --user " + ftpConfig.username + ":" + ftpConfig.password + " \"" + url + "\"";

        try {
            var output = executeCommand(command);
            var files = [];
            var lines = output.split("\n");

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].replace(/^\s+|\s+$/g, "");
                if (line.length > 0) {
                    files.push(line);
                }
            }

            return files;
        } catch (e) {
            return [];
        }
    }

    /**
     * Checks if a filename should be skipped (system/hidden files)
     * @param {string} name - Filename to check
     * @returns {boolean} True if should be skipped
     */
    function shouldSkipFile(name) {
        // Skip . and .. directory entries
        if (name === "." || name === "..") return true;
        // Skip macOS .DS_Store files
        if (name === ".DS_Store") return true;
        // Skip macOS resource fork files (._filename)
        if (name.indexOf("._") === 0) return true;
        // Skip other hidden files starting with .
        if (name.indexOf(".") === 0) return true;
        return false;
    }

    /**
     * Recursively lists all files on FTP server
     * @param {Object} ftpConfig - FTP connection config
     * @param {string} remotePath - Base path on FTP server
     * @param {string} currentPath - Current relative path
     * @param {Array} results - Array to store results
     */
    function listFTPFilesRecursive(ftpConfig, remotePath, currentPath, results) {
        var fullPath = remotePath + (currentPath ? "/" + currentPath : "");
        var port = ftpConfig.port || "21";
        var url = "ftp://" + ftpConfig.hostname + ":" + port + "/" + fullPath + "/";

        // Use curl with -l for names only
        var command = "curl -s -l --user " + ftpConfig.username + ":" + ftpConfig.password + " \"" + url + "\"";

        try {
            var output = executeCommand(command);
            var items = output.split("\n");

            for (var i = 0; i < items.length; i++) {
                var item = items[i].replace(/^\s+|\s+$/g, "");
                if (item.length === 0) continue;

                // Skip system and hidden files
                if (shouldSkipFile(item)) continue;

                var itemPath = currentPath ? currentPath + "/" + item : item;

                // Try to list as directory - if it works, it's a directory
                var testUrl = "ftp://" + ftpConfig.hostname + ":" + port + "/" + remotePath + "/" + itemPath + "/";
                var testCommand = "curl -s -l --user " + ftpConfig.username + ":" + ftpConfig.password + " \"" + testUrl + "\"";

                try {
                    var testOutput = executeCommand(testCommand);
                    if (testOutput && testOutput.length > 0 && testOutput.indexOf("curl:") === -1) {
                        // It's a directory, recurse
                        listFTPFilesRecursive(ftpConfig, remotePath, itemPath, results);
                    } else {
                        // It's a file
                        results.push({
                            relativePath: itemPath,
                            name: item
                        });
                    }
                } catch (e) {
                    // Assume it's a file
                    results.push({
                        relativePath: itemPath,
                        name: item
                    });
                }
            }
        } catch (e) {
            // Directory doesn't exist or error
        }
    }

    /**
     * Downloads a file from FTP
     * @param {Object} ftpConfig - FTP connection config
     * @param {string} remotePath - Path on FTP server
     * @param {string} localPath - Local destination path
     * @returns {boolean} Success status
     */
    function downloadFTPFile(ftpConfig, remotePath, localPath) {
        var port = ftpConfig.port || "21";
        // URL-encode the remote path for special characters (spaces, parentheses, etc.)
        var encodedRemotePath = encodeURIPathForFTP(remotePath);
        var url = "ftp://" + ftpConfig.hostname + ":" + port + "/" + encodedRemotePath;

        // Ensure local directory exists
        var localFile = new File(localPath);
        var localDir = localFile.parent;
        if (!localDir.exists) {
            localDir.create();
        }

        // Use -R to preserve remote file's modification time
        // Use --fail-early to detect errors
        var command = "curl -s -R --user " + ftpConfig.username + ":" + ftpConfig.password +
                      " -o \"" + localPath + "\" \"" + url + "\"";

        try {
            executeCommand(command);
            // Check if file was actually created and has content
            var downloadedFile = new File(localPath);
            return downloadedFile.exists && downloadedFile.length > 0;
        } catch (e) {
            return false;
        }
    }

    /**
     * Encodes a path for use in FTP URLs
     * Encodes special characters like spaces, parentheses, etc.
     * Preserves forward slashes as path separators
     * @param {string} path - Path to encode
     * @returns {string} URL-encoded path
     */
    function encodeURIPathForFTP(path) {
        // Split by slashes, encode each part, rejoin
        var parts = path.split("/");
        var encodedParts = [];
        for (var i = 0; i < parts.length; i++) {
            encodedParts.push(encodeURIComponentSimple(parts[i]));
        }
        return encodedParts.join("/");
    }

    /**
     * Simple URI component encoder for ExtendScript
     * Encodes characters that are problematic in URLs
     * @param {string} str - String to encode
     * @returns {string} Encoded string
     */
    function encodeURIComponentSimple(str) {
        var result = "";
        for (var i = 0; i < str.length; i++) {
            var ch = str.charAt(i);
            var code = str.charCodeAt(i);

            // Safe characters: A-Z, a-z, 0-9, - _ . ~
            if ((code >= 65 && code <= 90) ||   // A-Z
                (code >= 97 && code <= 122) ||  // a-z
                (code >= 48 && code <= 57) ||   // 0-9
                ch === "-" || ch === "_" || ch === "." || ch === "~") {
                result += ch;
            } else {
                // Encode as %XX
                var hex = code.toString(16).toUpperCase();
                if (hex.length === 1) hex = "0" + hex;
                result += "%" + hex;
            }
        }
        return result;
    }

    /**
     * Formats a Date object for FTP MFMT command (YYYYMMDDHHMMSS) in UTC
     * @param {Date} date - Date object to format
     * @returns {string} Formatted timestamp string in UTC
     */
    function formatFTPTimestampUTC(date) {
        var year = date.getUTCFullYear().toString();
        var month = padNumber(date.getUTCMonth() + 1, 2);
        var day = padNumber(date.getUTCDate(), 2);
        var hours = padNumber(date.getUTCHours(), 2);
        var minutes = padNumber(date.getUTCMinutes(), 2);
        var seconds = padNumber(date.getUTCSeconds(), 2);
        return year + month + day + hours + minutes + seconds;
    }

    /**
     * Extracts just the filename from a path
     * @param {string} path - Full path
     * @returns {string} Just the filename
     */
    function getFilenameFromPath(path) {
        var parts = path.replace(/\\/g, "/").split("/");
        return parts[parts.length - 1];
    }

    /**
     * Uploads a file to FTP and attempts to preserve its modification time
     * Tries MFMT command first, then SITE UTIME as fallback
     * @param {Object} ftpConfig - FTP connection config
     * @param {string} localPath - Local file path
     * @param {string} remotePath - Destination path on FTP server
     * @returns {boolean} Success status
     */
    function uploadFTPFile(ftpConfig, localPath, remotePath) {
        var port = ftpConfig.port || "21";
        // URL-encode the remote path for special characters (spaces, parentheses, etc.)
        var encodedRemotePath = encodeURIPathForFTP(remotePath);
        var url = "ftp://" + ftpConfig.hostname + ":" + port + "/" + encodedRemotePath;

        // Get local file's modification time
        var localFile = new File(localPath);
        var modTimeUTC = "";
        if (localFile.exists) {
            modTimeUTC = formatFTPTimestampUTC(new Date(localFile.modified));
        }

        // Get just the filename for the MFMT command (some servers need this)
        var filename = getFilenameFromPath(remotePath);

        // Create remote directory structure using --ftp-create-dirs
        // Use -Q with "-" prefix to send commands after upload
        // Use "*" prefix to allow command to fail silently (server may not support it)
        var command = "curl -s --user " + ftpConfig.username + ":" + ftpConfig.password +
                      " --ftp-create-dirs";

        // Try multiple methods to set modification time:
        // 1. MFMT with full path (standard)
        // 2. MFMT with just filename (some servers need this after upload)
        // 3. SITE UTIME (alternative command some servers support)
        // The "*" prefix allows the command to fail without stopping the operation
        if (modTimeUTC) {
            // Try MFMT with full path first
            command += " -Q \"-*MFMT " + modTimeUTC + " /" + remotePath + "\"";
            // Also try MFMT with just filename
            command += " -Q \"-*MFMT " + modTimeUTC + " " + filename + "\"";
            // Try SITE UTIME as fallback (format: SITE UTIME filename accesstime modtime createtime UTC)
            command += " -Q \"-*SITE UTIME " + filename + " " + modTimeUTC + " " + modTimeUTC + " " + modTimeUTC + " UTC\"";
        }

        command += " -T \"" + localPath + "\" \"" + url + "\"";

        try {
            executeCommand(command);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Compares local and remote file lists to determine sync actions
     * @param {Array} localFiles - Array of local file info
     * @param {Array} remoteFiles - Array of remote file info
     * @returns {Object} {toUpload: [], toDownload: []}
     */
    function compareSyncFiles(localFiles, remoteFiles) {
        var toUpload = [];
        var toDownload = [];

        // Create lookup maps
        var localMap = {};
        var remoteMap = {};

        for (var i = 0; i < localFiles.length; i++) {
            localMap[localFiles[i].relativePath] = localFiles[i];
        }

        for (var i = 0; i < remoteFiles.length; i++) {
            remoteMap[remoteFiles[i].relativePath] = remoteFiles[i];
        }

        // Find files to upload (local files not on remote)
        for (var path in localMap) {
            if (!remoteMap.hasOwnProperty(path)) {
                toUpload.push(localMap[path]);
            }
        }

        // Find files to download (remote files not on local)
        for (var path in remoteMap) {
            if (!localMap.hasOwnProperty(path)) {
                toDownload.push(remoteMap[path]);
            }
        }

        return {
            toUpload: toUpload,
            toDownload: toDownload
        };
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

    // ---- Sub-project Section (always visible, disabled when not applicable) ----
    var subProjectGroup = mainGroup.add("group");
    subProjectGroup.orientation = "column";
    subProjectGroup.alignment = ["fill", "top"];
    subProjectGroup.alignChildren = ["fill", "top"];

    var subProjectLabel = subProjectGroup.add("statictext", undefined, "Sub-project:");
    var subProjectDropdown = subProjectGroup.add("dropdownlist", undefined, ["(No sub-projects)"]);
    subProjectDropdown.alignment = ["fill", "center"];
    subProjectDropdown.selection = 0;
    subProjectDropdown.enabled = false; // Start disabled

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
    recentFileDateText.alignment = ["fill", "top"];
    recentFileDateText.preferredSize = [-1, 20]; // Ensure height for text display

    // ---- File Action Buttons ----
    var fileActionGroup = mainGroup.add("group");
    fileActionGroup.orientation = "row";
    fileActionGroup.alignment = ["fill", "top"];
    fileActionGroup.alignChildren = ["fill", "center"];

    var refreshBtn = fileActionGroup.add("button", undefined, "Refresh");
    refreshBtn.alignment = ["fill", "center"];
    refreshBtn.helpTip = "Refresh file list and sub-project detection";

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

    // ---- Separator ----
    var sep5 = mainGroup.add("panel", undefined, undefined, {borderStyle: "sunken"});
    sep5.alignment = ["fill", "top"];

    // ---- Render Section ----
    var renderLabel = mainGroup.add("statictext", undefined, "Render:");
    renderLabel.alignment = ["left", "top"];

    var renderBtn = mainGroup.add("button", undefined, "Create Folders and Render");
    renderBtn.alignment = ["fill", "top"];
    renderBtn.helpTip = "Create date/time folders in 03_out and render queue items there";

    // ---- Separator ----
    var sep6 = mainGroup.add("panel", undefined, undefined, {borderStyle: "sunken"});
    sep6.alignment = ["fill", "top"];

    // ---- FTP Sync Section ----
    var ftpSyncLabel = mainGroup.add("statictext", undefined, "FTP Sync:");
    ftpSyncLabel.alignment = ["left", "top"];

    var ftpDropdownGroup = mainGroup.add("group");
    ftpDropdownGroup.orientation = "row";
    ftpDropdownGroup.alignment = ["fill", "top"];
    ftpDropdownGroup.alignChildren = ["fill", "center"];

    var ftpLocationDropdown = ftpDropdownGroup.add("dropdownlist", undefined, ["Input", "Output"]);
    ftpLocationDropdown.selection = 0;
    ftpLocationDropdown.alignment = ["fill", "center"];
    ftpLocationDropdown.helpTip = "Input: 01_inbox folder\nOutput: 06_vfx/03_out folder";

    var ftpCountDropdown = ftpDropdownGroup.add("dropdownlist", undefined, ["Latest", "Latest 5"]);
    ftpCountDropdown.selection = 0;
    ftpCountDropdown.alignment = ["fill", "center"];
    ftpCountDropdown.helpTip = "How many date folders to sync";

    var syncBtn = mainGroup.add("button", undefined, "Sync");
    syncBtn.alignment = ["fill", "top"];
    syncBtn.helpTip = "Start FTP synchronization";

    // ---- Progress Section ----
    var progressGroup = mainGroup.add("group");
    progressGroup.orientation = "column";
    progressGroup.alignment = ["fill", "top"];
    progressGroup.alignChildren = ["fill", "top"];
    progressGroup.spacing = 5;

    var progressOverallLabel = progressGroup.add("statictext", undefined, "");
    progressOverallLabel.alignment = ["fill", "top"];

    var progressOverallBar = progressGroup.add("progressbar", undefined, 0, 100);
    progressOverallBar.alignment = ["fill", "top"];
    progressOverallBar.preferredSize.height = 10;

    var progressStatusText = progressGroup.add("statictext", undefined, "");
    progressStatusText.alignment = ["fill", "top"];

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
     * Enables the sub-project dropdown (when sub-projects exist)
     */
    function enableSubProjectSection() {
        subProjectDropdown.enabled = true;
    }

    /**
     * Disables the sub-project dropdown and shows placeholder text
     */
    function disableSubProjectSection() {
        subProjectDropdown.removeAll();
        subProjectDropdown.add("item", "(No sub-projects)");
        subProjectDropdown.selection = 0;
        subProjectDropdown.enabled = false;
    }

    /**
     * Updates the sub-project dropdown
     * @param {string} projectPath - Path to the project
     */
    function updateSubProjects(projectPath) {
        subProjectDropdown.removeAll();
        currentSubProjects = [];

        if (!projectPath) {
            disableSubProjectSection();
            return;
        }

        var aeFolder = new Folder(projectPath + "/" + AE_PATH_SEGMENT);
        currentSubProjects = detectSubProjects(aeFolder);

        if (currentSubProjects.length === 0) {
            disableSubProjectSection();
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

        enableSubProjectSection();
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
        if (subProjectDropdown.enabled && subProjectDropdown.selection) {
            var subProjectIndex = subProjectDropdown.selection.index;
            if (subProjectIndex > 0) { // Not "(All)"
                subProject = currentSubProjects[subProjectIndex - 1];
            }
        }

        currentMostRecentFile = findMostRecentAEP(projectPath, subProject);

        if (currentMostRecentFile) {
            recentFileNameText.text = currentMostRecentFile.file.name;
            // Get modification date using system command (more reliable than ExtendScript)
            var modDateStr = getFileModificationDate(currentMostRecentFile.file.fsName);
            if (modDateStr) {
                recentFileDateText.text = "Modified: " + modDateStr;
            } else {
                recentFileDateText.text = "";
            }
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
            disableSubProjectSection();
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
            disableSubProjectSection();
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

    // Render button
    renderBtn.onClick = function() {
        try {
            // Check if there are active items in the render queue
            var renderQueue = app.project.renderQueue;
            var activeItems = [];

            for (var i = 1; i <= renderQueue.numItems; i++) {
                var item = renderQueue.item(i);
                if (item.status === RQItemStatus.QUEUED) {
                    activeItems.push(item);
                }
            }

            if (activeItems.length === 0) {
                alert("No active items in the render queue.\n\nPlease add compositions to the render queue and set them to 'Queued' status.");
                return;
            }

            // Validate project selection for output path
            if (!projectDropdown.selection) {
                alert("Please select a project first to determine the output folder.");
                return;
            }

            var projectIndex = projectDropdown.selection.index;
            var projectPath = currentProjects[projectIndex].path;

            // Build output folder path: [project]/06_vfx/03_out/YYMMDD/HHmm
            var outBasePath = projectPath + "/06_vfx/03_out";
            var dateFolder = getRenderDateFolder();
            var timeFolder = getRenderTimeFolder();

            var dateFolderPath = outBasePath + "/" + dateFolder;
            var timeFolderPath = dateFolderPath + "/" + timeFolder;

            // Check if base output folder exists
            var outBaseFolder = new Folder(outBasePath);
            if (!outBaseFolder.exists) {
                alert("Output folder does not exist:\n" + outBasePath + "\n\nPlease create the folder structure first.");
                return;
            }

            // Create date folder if needed
            var dateFolderObj = new Folder(dateFolderPath);
            if (!dateFolderObj.exists) {
                if (!dateFolderObj.create()) {
                    alert("Failed to create date folder:\n" + dateFolderPath);
                    return;
                }
            }

            // Create time folder if needed
            var timeFolderObj = new Folder(timeFolderPath);
            if (!timeFolderObj.exists) {
                if (!timeFolderObj.create()) {
                    alert("Failed to create time folder:\n" + timeFolderPath);
                    return;
                }
            }

            // Update output paths for all active render items
            var outputCount = 0;
            for (var i = 0; i < activeItems.length; i++) {
                var item = activeItems[i];

                // Each render item can have multiple output modules
                for (var j = 1; j <= item.numOutputModules; j++) {
                    var outputModule = item.outputModule(j);
                    var currentFile = outputModule.file;

                    if (currentFile) {
                        // Get just the filename from the current path
                        var fileName = currentFile.name;
                        var newFilePath = timeFolderPath + "/" + fileName;
                        outputModule.file = new File(newFilePath);
                        outputCount++;
                    }
                }
            }

            // Try to copy simplified path to clipboard (relative from project root)
            var simplifiedPath = "/06_vfx/03_out/" + dateFolder + "/" + timeFolder;
            var clipboardSuccess = copyToClipboard(simplifiedPath);

            // Show confirmation
            var confirmMsg = "Render Setup Complete\n\n";
            confirmMsg += "Output folder:\n" + simplifiedPath + "\n\n";
            confirmMsg += "Active items: " + activeItems.length + "\n";
            confirmMsg += "Output modules updated: " + outputCount + "\n\n";

            if (clipboardSuccess) {
                confirmMsg += "Path copied to clipboard!\n\n";
            }

            confirmMsg += "Start rendering now?";

            if (confirm(confirmMsg)) {
                // Start rendering
                renderQueue.render();

                // Switch FTP dropdown to Output for easy syncing after render
                ftpLocationDropdown.selection = 1;
            } else if (!clipboardSuccess) {
                // Show path dialog if clipboard failed and user cancelled render
                showPathDialog("Output Path", "Copy the output path:", simplifiedPath);
            }

        } catch (error) {
            alert("Error in Render:\n" + error.message + "\nLine: " + error.line);
        }
    };

    // Sync button
    syncBtn.onClick = function() {
        try {
            // Reset progress display
            progressOverallBar.value = 0;
            progressOverallLabel.text = "";
            progressStatusText.text = "";
            panel.layout.layout(true);

            // Validate project selection
            if (!projectDropdown.selection) {
                alert("Please select a project first.");
                return;
            }

            var projectIndex = projectDropdown.selection.index;
            var projectName = currentProjects[projectIndex].name;
            var projectPath = currentProjects[projectIndex].path;

            // Get FTP connection for this project
            var ftpConfig = getFTPConnectionForProject(projectName);
            if (!ftpConfig) {
                alert("No FTP connection configured for project:\n" + projectName +
                      "\n\nPlease add a connection in:\n" + FTP_CONFIG_FILE);
                return;
            }

            // Test FTP connection with a simple command
            progressStatusText.text = "Connecting to FTP...";
            panel.layout.layout(true);

            var testPort = ftpConfig.port || "21";
            var testUrl = "ftp://" + ftpConfig.hostname + ":" + testPort + "/";
            var testCommand = "curl -s -l --connect-timeout 10 --user " + ftpConfig.username + ":" + ftpConfig.password + " \"" + testUrl + "\"";

            var testResult = executeCommand(testCommand);

            if (!testResult || testResult.length === 0) {
                if (!confirm("FTP connection test returned no data.\nThis might indicate a connection issue.\n\nContinue anyway?")) {
                    progressStatusText.text = "";
                    return;
                }
            }

            // Determine sync location
            var isInput = ftpLocationDropdown.selection.index === 0;
            var syncPath = isInput ? FTP_INPUT_PATH : FTP_OUTPUT_PATH;
            var localBasePath = projectPath + "/" + syncPath;

            // Check if local folder exists
            var localFolder = new Folder(localBasePath);
            if (!localFolder.exists) {
                alert("Local folder does not exist:\n" + localBasePath);
                return;
            }

            // Determine how many folders to sync
            var folderCount = ftpCountDropdown.selection.index === 0 ? 1 : 5;

            // Get date folders to sync
            var dateFolders = getLatestDateFolders(localBasePath, folderCount);

            // Also check remote for date folders we might not have locally
            progressStatusText.text = "Scanning remote folders...";
            panel.layout.layout(true);

            var remoteItems = listFTPFiles(ftpConfig, syncPath);
            var remoteDateFolders = [];
            for (var i = 0; i < remoteItems.length; i++) {
                if (isDateFolder(remoteItems[i])) {
                    remoteDateFolders.push(remoteItems[i]);
                }
            }
            remoteDateFolders.sort(function(a, b) { return b.localeCompare(a); });

            // Combine local and remote date folders
            var allDateFolders = dateFolders.slice();
            for (var i = 0; i < remoteDateFolders.length; i++) {
                var found = false;
                for (var j = 0; j < allDateFolders.length; j++) {
                    if (allDateFolders[j] === remoteDateFolders[i]) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    allDateFolders.push(remoteDateFolders[i]);
                }
            }
            allDateFolders.sort(function(a, b) { return b.localeCompare(a); });
            allDateFolders = allDateFolders.slice(0, folderCount);

            if (allDateFolders.length === 0) {
                alert("No date folders found to sync.");
                progressStatusText.text = "";
                return;
            }

            // Collect all files to sync
            progressStatusText.text = "Scanning files...";
            panel.layout.layout(true);

            var allLocalFiles = [];
            var allRemoteFiles = [];

            for (var f = 0; f < allDateFolders.length; f++) {
                var dateFolder = allDateFolders[f];
                var localDatePath = localBasePath + "/" + dateFolder;
                var remoteDatePath = syncPath + "/" + dateFolder;

                // Scan local files
                var localFolder = new Folder(localDatePath);
                if (localFolder.exists) {
                    var localFiles = [];
                    scanFolderForFiles(localFolder, localDatePath, localFiles);
                    for (var i = 0; i < localFiles.length; i++) {
                        localFiles[i].dateFolder = dateFolder;
                        localFiles[i].fullLocalPath = localDatePath + "/" + localFiles[i].relativePath;
                        localFiles[i].fullRemotePath = remoteDatePath + "/" + localFiles[i].relativePath;
                        allLocalFiles.push(localFiles[i]);
                    }
                }

                // Scan remote files
                var remoteFiles = [];
                listFTPFilesRecursive(ftpConfig, remoteDatePath, "", remoteFiles);
                for (var i = 0; i < remoteFiles.length; i++) {
                    remoteFiles[i].dateFolder = dateFolder;
                    remoteFiles[i].fullLocalPath = localDatePath + "/" + remoteFiles[i].relativePath;
                    remoteFiles[i].fullRemotePath = remoteDatePath + "/" + remoteFiles[i].relativePath;
                    allRemoteFiles.push(remoteFiles[i]);
                }
            }

            // Compare files
            progressStatusText.text = "";
            panel.layout.layout(true);
            var syncActions = compareSyncFiles(allLocalFiles, allRemoteFiles);

            if (syncActions.toUpload.length === 0 && syncActions.toDownload.length === 0) {
                alert("Everything is already in sync!\n\nFolders checked: " + allDateFolders.join(", "));
                progressStatusText.text = "";
                progressOverallLabel.text = "";
                return;
            }

            // Build confirmation message
            var confirmMsg = "Folders: " + allDateFolders.join(", ") + "\n\n";

            if (syncActions.toUpload.length > 0) {
                confirmMsg += "FILES TO UPLOAD (" + syncActions.toUpload.length + "):\n";
                for (var i = 0; i < Math.min(syncActions.toUpload.length, 15); i++) {
                    confirmMsg += "  + " + syncActions.toUpload[i].relativePath + "\n";
                }
                if (syncActions.toUpload.length > 15) {
                    confirmMsg += "  ... and " + (syncActions.toUpload.length - 15) + " more\n";
                }
                confirmMsg += "\n";
            }

            if (syncActions.toDownload.length > 0) {
                confirmMsg += "FILES TO DOWNLOAD (" + syncActions.toDownload.length + "):\n";
                for (var i = 0; i < Math.min(syncActions.toDownload.length, 15); i++) {
                    confirmMsg += "  - " + syncActions.toDownload[i].relativePath + "\n";
                }
                if (syncActions.toDownload.length > 15) {
                    confirmMsg += "  ... and " + (syncActions.toDownload.length - 15) + " more\n";
                }
            }

            if (!showWideConfirmDialog("FTP Sync Summary", confirmMsg, 600)) {
                progressStatusText.text = "";
                progressOverallLabel.text = "";
                return;
            }

            var totalFiles = syncActions.toUpload.length + syncActions.toDownload.length;
            var processedFiles = 0;

            // Perform uploads
            for (var i = 0; i < syncActions.toUpload.length; i++) {
                var fileInfo = syncActions.toUpload[i];

                // Update progress at START of each file (show we're working on this file)
                progressOverallBar.value = (processedFiles / totalFiles) * 100;
                progressOverallLabel.text = "Uploading " + (processedFiles + 1) + " / " + totalFiles;
                progressStatusText.text = fileInfo.relativePath;
                panel.layout.layout(true);

                var success = uploadFTPFile(ftpConfig, fileInfo.fullLocalPath, fileInfo.fullRemotePath);
                processedFiles++;

                if (!success) {
                    progressStatusText.text = "Error: " + fileInfo.relativePath;
                }
            }

            // Perform downloads
            for (var i = 0; i < syncActions.toDownload.length; i++) {
                var fileInfo = syncActions.toDownload[i];

                // Update progress at START of each file
                progressOverallBar.value = (processedFiles / totalFiles) * 100;
                progressOverallLabel.text = "Downloading " + (processedFiles + 1) + " / " + totalFiles;
                progressStatusText.text = fileInfo.relativePath;
                panel.layout.layout(true);

                var success = downloadFTPFile(ftpConfig, fileInfo.fullRemotePath, fileInfo.fullLocalPath);
                processedFiles++;

                if (!success) {
                    progressStatusText.text = "Error: " + fileInfo.relativePath;
                }
            }

            // Done
            progressOverallLabel.text = "Complete: " + totalFiles + " files";
            progressOverallBar.value = 100;
            progressStatusText.text = syncActions.toUpload.length + " uploaded, " + syncActions.toDownload.length + " downloaded";
            panel.layout.layout(true);

            alert("Sync complete!\n\n" +
                  "Uploaded: " + syncActions.toUpload.length + " files\n" +
                  "Downloaded: " + syncActions.toDownload.length + " files");

        } catch (error) {
            alert("Error during sync:\n" + error.message + "\nLine: " + error.line);
            progressStatusText.text = "Error: " + error.message;
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
