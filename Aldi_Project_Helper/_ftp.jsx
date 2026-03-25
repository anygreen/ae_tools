/**
 * Aldi Project Helper — FTP helpers
 *
 * Included by Aldi_Project_Helper_V2.jsx via //@include
 * Do NOT run this file directly.
 *
 * Functions defined here live inside the main IIFE scope and can
 * reference constants (IS_MAC, FTP_CONFIG_FILE, …) declared there.
 */

    // ============================================================
    // HELPER FUNCTIONS - FTP Operations
    // ============================================================

    /**
     * Returns curl TLS flags for explicit FTPS (AUTH TLS on port 21).
     *
     * Mac: --ssl-reqd encrypts both control and data channels (OpenSSL
     *      handles FTP data-channel TLS correctly).
     *
     * Windows (Schannel): uses --ftp-ssl-control instead of --ssl-reqd.
     *      This encrypts only the control channel (login / credentials)
     *      and leaves data transfers unencrypted. Works around a known
     *      Schannel bug where the TLS close_notify on the data channel
     *      causes curl to lose buffered data (curl issues #5284, #9161).
     *      Additional Schannel workarounds:
     *        --ssl-no-revoke   bypass CRL check failures
     *        --tls-max 1.2     pin TLS 1.2 for reliable negotiation
     *
     * @returns {string} TLS flags for curl
     */
    function getTLSFlags() {
        if (!USE_FTPS) return "";
        if (!IS_MAC) {
            return "--ftp-ssl-control -k --ssl-no-revoke --tls-max 1.2";
        }
        return "--ssl-reqd -k";
    }

    /**
     * Checks if curl output contains an error message.
     * Extracts only the error lines (starting with "curl:") to avoid
     * showing progress meter noise in error dialogs.
     * @param {string} output - curl output
     * @returns {string|null} Error message if found, null otherwise
     */
    function getCurlError(output) {
        if (!output || output.length === 0) return "No response from server";

        var lines = output.split("\n");
        var errorLines = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].replace(/^\s+|\s+$/g, "");
            if (line.indexOf("curl:") === 0 || line.indexOf("curl_easy") !== -1) {
                // Windows Schannel reports missing close_notify on TLS teardown
                // but data transfer completes successfully — ignore this error
                if (!IS_MAC && line.indexOf("close_notify") !== -1) continue;
                errorLines.push(line);
            }
        }

        if (errorLines.length > 0) return errorLines.join("\n");
        return null;
    }

    /**
     * Tests FTP connection and returns detailed result
     * @param {Object} ftpConfig - FTP connection config
     * @returns {Object} {success: boolean, error: string|null}
     */
    function testFTPConnection(ftpConfig) {
        var port = ftpConfig.port || "21";
        var url = "ftp://" + ftpConfig.hostname + ":" + port + "/";
        var command = "curl -sS -l " + getTLSFlags() + " --connect-timeout 10 --max-time 30 --user " +
                      ftpConfig.username + ":" + ftpConfig.password + " \"" + url + "\"";
        if (IS_MAC) command += " 2>&1";

        try {
            var output = executeCommand(command);
            var error = getCurlError(output);
            if (error) return { success: false, error: error };
            return { success: true, error: null };
        } catch (e) {
            return { success: false, error: e.message || "Unknown connection error" };
        }
    }

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
     * Checks if a filename should be skipped (system/hidden files)
     * @param {string} name - Filename to check
     * @returns {boolean} True if should be skipped
     */
    function shouldSkipFile(name) {
        if (name === "." || name === "..") return true;
        if (name === ".DS_Store") return true;
        if (name.indexOf("._") === 0) return true;
        if (name.indexOf(".") === 0) return true;
        return false;
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

            if (shouldSkipFile(item.name)) continue;

            if (item instanceof Folder) {
                scanFolderForFiles(item, basePath, results);
            } else if (item instanceof File) {
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
     * Executes a shell command and returns the output.
     * On Mac: calls directly via system.callSystem.
     * On Windows: uses a hidden VBScript wrapper to suppress the cmd window.
     * @param {string} command - Command to execute
     * @returns {string} Command output
     */
    function executeCommand(command) {
        var result = "";

        try {
            if (IS_MAC) {
                result = system.callSystem(command);
            } else {
                var tempFolder = Folder.temp.fsName;
                var outputFile = tempFolder + "\\ae_cmd_output.txt";
                var batFile    = tempFolder + "\\ae_cmd_runner.bat";
                var vbsFile    = tempFolder + "\\ae_cmd_launcher.vbs";

                var oldOutput = new File(outputFile);
                if (oldOutput.exists) oldOutput.remove();

                var bat = new File(batFile);
                bat.open('w');
                bat.writeln('@echo off');
                bat.writeln(command + ' > "' + outputFile + '" 2>&1');
                bat.close();

                var vbs = new File(vbsFile);
                vbs.open('w');
                vbs.writeln('Set objShell = CreateObject("WScript.Shell")');
                vbs.writeln('objShell.Run """' + batFile + '""", 0, True');
                vbs.close();

                system.callSystem('wscript //B "' + vbsFile + '"');

                var outFile = new File(outputFile);
                if (outFile.exists) {
                    outFile.open('r');
                    result = outFile.read();
                    outFile.close();
                }

                // Clean up temp files (contain credentials in plaintext)
                try { bat.remove(); } catch(ex) {}
                try { vbs.remove(); } catch(ex) {}
                try { if (outFile.exists) outFile.remove(); } catch(ex) {}
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
     * @returns {Array} Array of file/folder names
     */
    function listFTPFiles(ftpConfig, remotePath) {
        var port = ftpConfig.port || "21";
        var url = "ftp://" + ftpConfig.hostname + ":" + port + "/" + remotePath + "/";
        var command = "curl -sS -l " + getTLSFlags() + " --max-time 30 --user " + ftpConfig.username + ":" + ftpConfig.password + " \"" + url + "\"";

        try {
            var output = executeCommand(command);
            if (getCurlError(output)) return [];

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
        var command = "curl -sS -l " + getTLSFlags() + " --max-time 30 --user " + ftpConfig.username + ":" + ftpConfig.password + " \"" + url + "\"";

        try {
            var output = executeCommand(command);
            if (getCurlError(output)) return;

            var items = output.split("\n");

            for (var i = 0; i < items.length; i++) {
                var item = items[i].replace(/^\s+|\s+$/g, "");
                if (item.length === 0) continue;
                if (shouldSkipFile(item)) continue;

                var itemPath = currentPath ? currentPath + "/" + item : item;

                var testUrl = "ftp://" + ftpConfig.hostname + ":" + port + "/" + remotePath + "/" + itemPath + "/";
                var testCommand = "curl -sS -l " + getTLSFlags() + " --max-time 30 --user " + ftpConfig.username + ":" + ftpConfig.password + " \"" + testUrl + "\"";

                try {
                    var testOutput = executeCommand(testCommand);
                    if (testOutput && testOutput.length > 0 && !getCurlError(testOutput)) {
                        listFTPFilesRecursive(ftpConfig, remotePath, itemPath, results);
                    } else {
                        results.push({ relativePath: itemPath, name: item });
                    }
                } catch (e) {
                    results.push({ relativePath: itemPath, name: item });
                }
            }
        } catch (e) {
            // Directory doesn't exist or connection error
        }
    }

    /**
     * Encodes a path for use in FTP URLs, preserving slash separators
     * @param {string} path - Path to encode
     * @returns {string} URL-encoded path
     */
    function encodeURIPathForFTP(path) {
        var parts = path.split("/");
        var encodedParts = [];
        for (var i = 0; i < parts.length; i++) {
            encodedParts.push(encodeURIComponentSimple(parts[i]));
        }
        return encodedParts.join("/");
    }

    /**
     * Simple URI component encoder for ExtendScript
     * @param {string} str - String to encode
     * @returns {string} Encoded string
     */
    function encodeURIComponentSimple(str) {
        var result = "";
        for (var i = 0; i < str.length; i++) {
            var ch = str.charAt(i);
            var code = str.charCodeAt(i);

            if ((code >= 65 && code <= 90) ||
                (code >= 97 && code <= 122) ||
                (code >= 48 && code <= 57) ||
                ch === "-" || ch === "_" || ch === "." || ch === "~") {
                result += ch;
            } else {
                var hex = code.toString(16).toUpperCase();
                if (hex.length === 1) hex = "0" + hex;
                result += "%" + hex;
            }
        }
        return result;
    }

    /**
     * Formats a Date object for FTP MFMT command (YYYYMMDDHHMMSS) in UTC
     * @param {Date} date
     * @returns {string}
     */
    function formatFTPTimestampUTC(date) {
        var year    = date.getUTCFullYear().toString();
        var month   = padNumber(date.getUTCMonth() + 1, 2);
        var day     = padNumber(date.getUTCDate(), 2);
        var hours   = padNumber(date.getUTCHours(), 2);
        var minutes = padNumber(date.getUTCMinutes(), 2);
        var seconds = padNumber(date.getUTCSeconds(), 2);
        return year + month + day + hours + minutes + seconds;
    }

    /**
     * Extracts just the filename from a path
     * @param {string} path
     * @returns {string}
     */
    function getFilenameFromPath(path) {
        var parts = path.replace(/\\/g, "/").split("/");
        return parts[parts.length - 1];
    }

    /**
     * Downloads a file from FTP
     * @param {Object} ftpConfig
     * @param {string} remotePath - Path on FTP server
     * @param {string} localPath - Local destination path
     * @returns {boolean} Success status
     */
    function downloadFTPFile(ftpConfig, remotePath, localPath) {
        var port = ftpConfig.port || "21";
        var encodedRemotePath = encodeURIPathForFTP(remotePath);
        var url = "ftp://" + ftpConfig.hostname + ":" + port + "/" + encodedRemotePath;

        var localFile = new File(localPath);
        var localDir  = localFile.parent;
        if (!localDir.exists) {
            localDir.create();
        }

        var command = "curl -sS -R " + getTLSFlags() + " --user " + ftpConfig.username + ":" + ftpConfig.password +
                      " -o \"" + localPath + "\" \"" + url + "\"";

        try {
            executeCommand(command);
            var downloadedFile = new File(localPath);
            return downloadedFile.exists && downloadedFile.length > 0;
        } catch (e) {
            return false;
        }
    }

    /**
     * Uploads a file to FTP and attempts to preserve its modification time.
     * Tries MFMT first, then SITE UTIME as fallback.
     * @param {Object} ftpConfig
     * @param {string} localPath
     * @param {string} remotePath
     * @returns {boolean} Success status
     */
    function uploadFTPFile(ftpConfig, localPath, remotePath) {
        var port = ftpConfig.port || "21";
        var encodedRemotePath = encodeURIPathForFTP(remotePath);
        var url = "ftp://" + ftpConfig.hostname + ":" + port + "/" + encodedRemotePath;

        var localFile  = new File(localPath);
        var modTimeUTC = "";
        if (localFile.exists) {
            modTimeUTC = formatFTPTimestampUTC(new Date(localFile.modified));
        }

        var filename = getFilenameFromPath(remotePath);

        var command = "curl -sS " + getTLSFlags() + " --user " + ftpConfig.username + ":" + ftpConfig.password +
                      " --ftp-create-dirs";

        if (modTimeUTC) {
            command += " -Q \"-*MFMT " + modTimeUTC + " /" + remotePath + "\"";
            command += " -Q \"-*MFMT " + modTimeUTC + " " + filename + "\"";
            command += " -Q \"-*SITE UTIME " + filename + " " + modTimeUTC + " " + modTimeUTC + " " + modTimeUTC + " UTC\"";
        }

        command += " -T \"" + localPath + "\" \"" + url + "\"";

        try {
            var output = executeCommand(command);
            // curl -T produces no output on success; only check for errors if there IS output
            if (output && output.length > 0 && getCurlError(output)) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Compares local and remote file lists to determine sync actions.
     * Uses syncKey as the unique map key so files from different sub-projects
     * never collide.
     * @param {Array} localFiles
     * @param {Array} remoteFiles
     * @returns {Object} {toUpload: [], toDownload: []}
     */
    function compareSyncFiles(localFiles, remoteFiles) {
        var toUpload   = [];
        var toDownload = [];
        var localMap   = {};
        var remoteMap  = {};

        for (var i = 0; i < localFiles.length; i++) {
            var lKey = localFiles[i].syncKey || localFiles[i].relativePath;
            localMap[lKey] = localFiles[i];
        }

        for (var i = 0; i < remoteFiles.length; i++) {
            var rKey = remoteFiles[i].syncKey || remoteFiles[i].relativePath;
            remoteMap[rKey] = remoteFiles[i];
        }

        for (var path in localMap) {
            if (!remoteMap.hasOwnProperty(path)) {
                toUpload.push(localMap[path]);
            }
        }

        for (var path in remoteMap) {
            if (!localMap.hasOwnProperty(path)) {
                toDownload.push(remoteMap[path]);
            }
        }

        return { toUpload: toUpload, toDownload: toDownload };
    }

    // ============================================================
    // EXTERNAL RENDER & UPLOAD — background terminal launch
    // ============================================================

    /**
     * Returns the path to the aerender executable for the current platform.
     * @returns {string|null} Path to aerender, or null if not found
     */
    function getAerenderPath() {
        // Folder.appPackage gives:
        //   Mac: /Applications/Adobe After Effects 2025/Adobe After Effects 2025.app
        //   Win: C:\Program Files\Adobe\Adobe After Effects 2025\Support Files
        var pkgPath = Folder.appPackage ? Folder.appPackage.fsName : "";
        var aerenderPath;

        if (IS_MAC) {
            // aerender sits beside the .app bundle (its parent directory)
            var appPkg = new Folder(pkgPath);
            if (appPkg.parent) {
                aerenderPath = appPkg.parent.fsName + "/aerender";
                if (new File(aerenderPath).exists) return aerenderPath;
            }
            // Fallback: walk up until we find a .app folder
            var cur = appPkg;
            while (cur && cur.name !== "" && cur.fsName !== "/") {
                if (cur.name.indexOf(".app") !== -1) {
                    aerenderPath = cur.parent.fsName + "/aerender";
                    if (new File(aerenderPath).exists) return aerenderPath;
                    break;
                }
                cur = cur.parent;
            }
        } else {
            // Windows: aerender.exe is in the Support Files folder
            aerenderPath = pkgPath + "\\aerender.exe";
            if (new File(aerenderPath).exists) return aerenderPath;
        }
        return null;
    }

    /**
     * Returns the path to the platform-specific render/upload helper script.
     * Checks both flat-install and subfolder-install locations.
     * @returns {string|null} Path to helper script, or null if not found
     */
    function getHelperScriptPath() {
        var mainScript = new File($.fileName);
        var parentFolder = mainScript.parent;
        var scriptName = IS_MAC ? "_render_upload.sh" : "_render_upload.ps1";

        // Flat install: ScriptUI Panels/Aldi_Project_Helper_V2.jsx
        //   helper at: ScriptUI Panels/Aldi_Project_Helper/_render_upload.sh
        var path1 = parentFolder.fsName + (IS_MAC ? "/" : "\\") +
                     "Aldi_Project_Helper" + (IS_MAC ? "/" : "\\") + scriptName;
        if (new File(path1).exists) return path1;

        // Subfolder install: ScriptUI Panels/Aldi_Project_Helper/...V2.jsx
        //   helper at: ScriptUI Panels/Aldi_Project_Helper/_render_upload.sh
        var path2 = parentFolder.fsName + (IS_MAC ? "/" : "\\") + scriptName;
        if (new File(path2).exists) return path2;

        return null;
    }

    /**
     * Generates a temp config file for the external render/upload script.
     * @param {Object} setup - Result from setupRenderOutput()
     * @param {Object|null} ftpConfig - FTP connection config, or null for render-only
     * @returns {string} Path to the generated config file
     */
    function generateRenderConfig(setup, ftpConfig) {
        var timestamp = new Date().getTime();
        var tempDir = Folder.temp.fsName;
        var sep = IS_MAC ? "/" : "\\";
        var configPath = tempDir + sep + "ae_render_config_" + timestamp + ".txt";

        var aerenderPath = getAerenderPath();
        var projectPath = app.project.file.fsName;

        var lines = [];
        lines.push("AERENDER=" + aerenderPath);
        lines.push("PROJECT=" + projectPath);
        lines.push("OUTPUT_FOLDER=" + setup.timeFolderPath);

        if (ftpConfig) {
            lines.push("DO_UPLOAD=1");
            lines.push("FTP_HOST=" + ftpConfig.hostname);
            lines.push("FTP_PORT=" + (ftpConfig.port || "21"));
            lines.push("FTP_USER=" + ftpConfig.username);
            lines.push("FTP_PASS=" + ftpConfig.password);
            lines.push("USE_FTPS=" + (USE_FTPS ? "1" : "0"));
            lines.push("TLS_FLAGS=" + getTLSFlags());

            var remoteTimePath = FTP_OUTPUT_PATH +
                (setup.renderSubProject ? "/" + setup.renderSubProject : "") +
                "/" + setup.dateFolder + "/" + setup.timeFolder;
            lines.push("REMOTE_BASE=" + remoteTimePath);
        } else {
            lines.push("DO_UPLOAD=0");
        }

        // Gather comp info from render queue
        var compCount = 0;
        var totalFrames = 0;
        for (var i = 0; i < setup.activeItems.length; i++) {
            var rqItem = setup.activeItems[i];
            var comp = rqItem.comp;
            var frames = Math.ceil(comp.duration * comp.frameRate);
            compCount++;
            totalFrames += frames;
            lines.push("COMP_" + compCount + "=" + comp.name + "::" + frames);
        }
        lines.push("COMP_COUNT=" + compCount);
        lines.push("TOTAL_FRAMES=" + totalFrames);

        // Write config file with Unix line endings (LF).
        // ExtendScript on macOS defaults to "Macintosh" (bare CR) which bash cannot parse.
        var configFile = new File(configPath);
        configFile.encoding = "UTF-8";
        configFile.lineFeed = "Unix";
        configFile.open("w");
        for (var i = 0; i < lines.length; i++) {
            configFile.writeln(lines[i]);
        }
        configFile.close();

        return configPath;
    }

    /**
     * Launches the external render (and optionally upload) script in a visible
     * terminal window. Returns immediately — AE stays responsive.
     *
     * @param {Object} setup - Result from setupRenderOutput()
     * @param {Object|null} ftpConfig - FTP config, or null for render-only
     * @returns {boolean} True if launched successfully
     */
    function launchExternalRender(setup, ftpConfig) {
        // Validate aerender
        var aerenderPath = getAerenderPath();
        if (!aerenderPath) {
            var pkgInfo = Folder.appPackage ? Folder.appPackage.fsName : "(unknown)";
            alert("aerender not found.\n\n" +
                  "Searched near:\n" + pkgInfo +
                  "\n\nPlease verify your After Effects installation.");
            return false;
        }

        // Validate helper script
        var helperPath = getHelperScriptPath();
        if (!helperPath) {
            alert("Render helper script not found.\n\n" +
                  "Expected: _render_upload." + (IS_MAC ? "sh" : "ps1") +
                  "\nin the Aldi_Project_Helper folder.\n\n" +
                  "Please run anyUpdater to install the latest version.");
            return false;
        }

        // Save the project so aerender can open the saved state
        if (!app.project.file) {
            alert("Please save the project first.\n\n" +
                  "The background renderer needs a saved .aep file to work with.");
            return false;
        }
        app.project.save();

        // Generate config file
        var configPath = generateRenderConfig(setup, ftpConfig);

        // Launch in visible terminal
        try {
            if (IS_MAC) {
                // Fix line endings: anyUpdater's ExtendScript File.write() uses the
                // "Macintosh" lineFeed default on macOS, producing bare CR (\r) instead
                // of Unix LF (\n).  The tr command converts any \r to \n, handling both
                // bare CR and CRLF (the latter becomes double \n, which is harmless).
                // Use octal escapes (\015=CR, \012=LF) for BSD tr compatibility
                system.callSystem("tr '\\015' '\\012' < \"" + helperPath + "\" > \"" + helperPath + ".tmp\" && mv \"" + helperPath + ".tmp\" \"" + helperPath + "\"");
                // Make script executable
                system.callSystem('chmod +x "' + helperPath + '"');
                // Also fix config file line endings (written by ExtendScript writeln)
                system.callSystem("tr '\\015' '\\012' < \"" + configPath + "\" > \"" + configPath + ".tmp\" && mv \"" + configPath + ".tmp\" \"" + configPath + "\"");
                // Launch via osascript → Terminal.app
                // Use "bash" explicitly to avoid shebang parsing issues as a safety net
                var osaCmd = 'osascript -e \'tell application "Terminal"' +
                             ' to do script "bash \\"' + helperPath + '\\" \\"' + configPath + '\\""\'';
                system.callSystem(osaCmd);
            } else {
                // Windows: use VBScript to launch PowerShell non-blocking
                var tempDir = Folder.temp.fsName;
                var vbsPath = tempDir + "\\ae_launch_render.vbs";
                var vbs = new File(vbsPath);
                vbs.open("w");
                vbs.writeln('Set objShell = CreateObject("WScript.Shell")');
                vbs.writeln('objShell.Run "powershell -ExecutionPolicy Bypass -NoProfile -File ""' +
                            helperPath + '"" ""' + configPath + '""", 1, False');
                vbs.close();
                system.callSystem('wscript //B "' + vbsPath + '"');
                // Clean up VBS launcher (PowerShell is already running)
                try { new File(vbsPath).remove(); } catch(ex) {}
            }
            return true;
        } catch (e) {
            alert("Failed to launch background render:\n" + e.message);
            // Clean up config file on failure
            try { new File(configPath).remove(); } catch(ex) {}
            return false;
        }
    }
