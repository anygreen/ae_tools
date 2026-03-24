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
     * On Windows, adds Schannel-specific workarounds:
     *   --ssl-no-revoke   bypass CRL check failures
     *   --tls-max 1.2     pin to TLS 1.2 for reliable Schannel negotiation
     * @returns {string} TLS flags for curl
     */
    function getTLSFlags() {
        var flags = "--ssl-reqd -k";
        if (!IS_MAC) {
            flags += " --ssl-no-revoke --tls-max 1.2";
        }
        return flags;
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
        var command = "curl -s -l " + getTLSFlags() + " --user " + ftpConfig.username + ":" + ftpConfig.password + " \"" + url + "\"";

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
        var command = "curl -s -l " + getTLSFlags() + " --user " + ftpConfig.username + ":" + ftpConfig.password + " \"" + url + "\"";

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
                var testCommand = "curl -s -l " + getTLSFlags() + " --user " + ftpConfig.username + ":" + ftpConfig.password + " \"" + testUrl + "\"";

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

        var command = "curl -s -R " + getTLSFlags() + " --user " + ftpConfig.username + ":" + ftpConfig.password +
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

        var command = "curl -s " + getTLSFlags() + " --user " + ftpConfig.username + ":" + ftpConfig.password +
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
