(function createUI(thisObj) {
    // Version of the script
    var scriptVersion = "v0.4";

    // Helper Functions
    function padNumber(num, minLength) {
        var str = num.toString();
        var currentLength = str.length;
        var targetLength = Math.max(minLength, currentLength);
        while (str.length < targetLength) {
            str = "0" + str;
        }
        return str;
    }

    function isDateValid(dateStr) {
        return /^2\d{5}$/.test(dateStr); // Must start with 2 and have 5 more digits
    }

    function getCurrentDate() {
        var date = new Date();
        return padNumber(date.getFullYear() % 100, 2) +
               padNumber(date.getMonth() + 1, 2) +
               padNumber(date.getDate(), 2);
    }

    function findDateInParts(parts) {
        for (var i = 0; i < parts.length; i++) {
            if (isDateValid(parts[i])) {
                return {
                    index: i,
                    value: parts[i]
                };
            }
        }
        return null;
    }

    function parseVersion(parts) {
        // Look for the last part that consists of at least 2 numbers, numbers only
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

    function parseInitials(parts) {
        // Look for the last part that has exactly 2 lowercase letters, no numbers
        for (var i = parts.length - 1; i >= 0; i--) {
            if (/^[a-z]{2}$/.test(parts[i])) {
                return {
                    index: i,
                    value: parts[i]
                };
            }
        }
        return null;
    }

    function incrementVersion(version) {
        if (!version) return null;
        var num = parseInt(version.number);
        return {
            number: padNumber(num + 1, version.number.length),
            fullVersion: padNumber(num + 1, version.number.length)
        };
    }

    function processFinalName(nameParts, dateInfo, newVersion, oldVersion, initialsInfo, newInitials) {
        var newParts = nameParts.slice(); // Create a copy of the array

        // Update date if found and changed
        if (dateInfo && dateInfo.value !== getCurrentDate()) {
            newParts[dateInfo.index] = getCurrentDate();
        }

        // Update version
        if (oldVersion && newVersion) {
            newParts[oldVersion.index] = newVersion.fullVersion;
        }

        // Update or add initials if provided
        if (newInitials) {
            if (initialsInfo) {
                // Replace existing initials
                newParts[initialsInfo.index] = newInitials;
            } else {
                // Add initials at the end
                newParts.push(newInitials);
            }
        }

        return newParts.join('_');
    }

    // Name processing function
    function processName(originalName, includeInitials, newInitials) {
        var parts = originalName.split('_');

        // Find date anywhere in the name
        var dateInfo = findDateInParts(parts);
        var hasDateChange = dateInfo && (dateInfo.value !== getCurrentDate());

        // Find version (last part with at least 2 numbers, numbers only)
        var versionPart = parseVersion(parts);

        if (!versionPart) {
            throw new Error("Could not find version number in name");
        }

        var newVersion = incrementVersion(versionPart);

        // Find initials if includeInitials is true
        var initialsInfo = null;
        var hasInitialsChange = false;
        if (includeInitials) {
            initialsInfo = parseInitials(parts);
            hasInitialsChange = (initialsInfo && initialsInfo.value !== newInitials) || (!initialsInfo && newInitials);
        }

        return {
            oldName: originalName,
            newName: processFinalName(parts, dateInfo, newVersion, versionPart, initialsInfo, includeInitials ? newInitials : null),
            oldVersion: versionPart,
            newVersion: newVersion,
            hasDateChange: hasDateChange,
            dateInfo: dateInfo,
            initialsInfo: initialsInfo,
            hasInitialsChange: hasInitialsChange,
            newInitials: includeInitials ? newInitials : null
        };
    }

    // Create UI
    var panel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "anyVersionUp " + scriptVersion, undefined, {resizeable: true});

    // Create main group wrapper
    var mainGroup = panel.add("group", undefined);
    mainGroup.orientation = "column";
    mainGroup.alignment = ["fill", "fill"];
    mainGroup.alignChildren = ["center", "top"];
    mainGroup.spacing = 10;
    mainGroup.margins = 16;

    var titleText = mainGroup.add("statictext", undefined, "anyVersionUp " + scriptVersion);
    var buttonGroup = mainGroup.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.spacing = 10;

    var aepButton = buttonGroup.add("button", undefined, "AEP");
    var compButton = buttonGroup.add("button", undefined, "Comp");

    // Add initials input
    var initialsGroup = mainGroup.add("group");
    initialsGroup.orientation = "row";
    initialsGroup.spacing = 10;
    initialsGroup.alignChildren = ["left", "center"];

    var initialsLabel = initialsGroup.add("statictext", undefined, "Initials:");
    var initialsInput = initialsGroup.add("edittext", undefined, "");
    initialsInput.characters = 2;
    initialsInput.preferredSize.width = 45;

    // Load saved initials
    if (app.settings.haveSetting("anyVersionUp", "initials")) {
        initialsInput.text = app.settings.getSetting("anyVersionUp", "initials");
    }

    // Save initials when changed
    initialsInput.onChange = function() {
        var value = this.text.toLowerCase();
        // Only accept exactly 2 lowercase letters
        if (/^[a-z]{2}$/.test(value)) {
            this.text = value;
            app.settings.saveSetting("anyVersionUp", "initials", value);
        } else if (value === "") {
            // Allow empty
            app.settings.saveSetting("anyVersionUp", "initials", "");
        } else {
            // Reset to previous valid value
            if (app.settings.haveSetting("anyVersionUp", "initials")) {
                this.text = app.settings.getSetting("anyVersionUp", "initials");
            } else {
                this.text = "";
            }
        }
    };

    function createHighlightedText(container, isOld, name, result) {
        var group = container.add("group");
        group.orientation = "row";
        group.alignChildren = ["left", "center"];
        group.spacing = 0; // Remove spacing between elements
        group.margins = 0; // Remove margins

        // Split the name into parts for highlighting
        var parts = name.split('_');

        for (var i = 0; i < parts.length; i++) {
            if (i > 0) {
                var separator = group.add("statictext", undefined, "_");
                separator.margins = 0;
            }

            var part = parts[i];
            var textGroup = group.add("group");
            textGroup.orientation = "row";
            textGroup.spacing = 0;
            textGroup.margins = 0;

            var text = textGroup.add("statictext", undefined, part);
            text.margins = 0;

            // Only highlight changed parts in the new version
            var shouldHighlight = false;
            if (!isOld) {
                // Highlight date only if it changed
                if (result.hasDateChange && result.dateInfo && i === result.dateInfo.index) {
                    shouldHighlight = true;
                }
                // Highlight version if it's the new version
                if (part === result.newVersion.fullVersion) {
                    shouldHighlight = true;
                }
                // Highlight initials if they changed or were added
                if (result.hasInitialsChange && result.newInitials && part === result.newInitials) {
                    shouldHighlight = true;
                }
            }

            if (shouldHighlight) {
                text.graphics.foregroundColor = text.graphics.newPen(text.graphics.PenType.SOLID_COLOR, [1, 0, 0], 1);
                text.graphics.font = ScriptUI.newFont(text.graphics.font.name, "Bold", text.graphics.font.size);
            }
        }
    }

    function createComparisonGroup(container, label, names, results) {
        var group = container.add("group");
        group.orientation = "column";
        group.alignChildren = ["left", "top"];
        group.spacing = 4; // Minimal spacing between lines
        group.margins = 0;
        group.maximumSize.width = 800; // Make it wide enough for long names

        var titleText = group.add("statictext", undefined, label + ":");
        titleText.graphics.font = ScriptUI.newFont(titleText.graphics.font.name, "Bold", titleText.graphics.font.size);
        titleText.margins = 0;

        for (var i = 0; i < names.length; i++) {
            createHighlightedText(group, true, names[i], results[i]);
        }

        if (names.length > 0) {
            var separator = group.add("panel", undefined, undefined, {height: 2}); // Separator
            separator.margins = 0;

            for (var i = 0; i < names.length; i++) {
                createHighlightedText(group, false, results[i].newName, results[i]);
            }
        }
    }

    // AEP Button Handler
    aepButton.onClick = function() {
        try {
            if (!app.project.file) {
                alert("Please save the project first.");
                return;
            }

            var currentInitials = initialsInput.text.toLowerCase();
            // Validate initials format
            if (currentInitials !== "" && !/^[a-z]{2}$/.test(currentInitials)) {
                alert("Initials must be exactly 2 lowercase letters or empty.");
                return;
            }

            var currentName = app.project.file.name.replace(/\.aep$/, '');
            var result = processName(currentName, true, currentInitials);

            // Create Modal Dialog
            var modal = new Window("dialog", "Version Up AEP");
            modal.orientation = "column";
            modal.alignChildren = ["left", "top"];
            modal.spacing = 10;
            modal.margins = 16;
            modal.preferredSize.width = 400;

            createComparisonGroup(modal, "Project File", [result.oldName], [result]);

            var buttonGroup = modal.add("group");
            buttonGroup.orientation = "row";
            buttonGroup.alignment = ["center", "top"];
            buttonGroup.spacing = 10;

            var saveBtn = buttonGroup.add("button", undefined, "Save", {name: "ok"});
            var cancelBtn = buttonGroup.add("button", undefined, "Cancel", {name: "cancel"});

            // Make the dialog resizable
            modal.onResizing = modal.onResize = function() {
                this.layout.resize();
            };

            if (modal.show() === 1) {
                var newFile = new File(app.project.file.parent.fsName + "/" + result.newName + ".aep");
                app.project.save(newFile);
            }

        } catch (error) {
            alert("Error: " + error.message);
        }
    };

    // Comp Button Handler
    compButton.onClick = function() {
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

            var oldNames = [];
            var results = [];
            for (var i = 0; i < selectedComps.length; i++) {
                oldNames.push(selectedComps[i].name);
                // Don't include initials for comp names
                results.push(processName(selectedComps[i].name, false, null));
            }

            // Create Modal Dialog
            var modal = new Window("dialog", "Version Up Compositions");
            modal.orientation = "column";
            modal.alignChildren = ["left", "top"];
            modal.spacing = 10;
            modal.margins = 16;
            modal.preferredSize.width = 400;

            createComparisonGroup(modal, "Compositions", oldNames, results);

            // Add move to _old checkbox
            var moveGroup = modal.add("group");
            moveGroup.orientation = "row";
            moveGroup.alignment = ["left", "top"];
            moveGroup.spacing = 10;
            moveGroup.margins = 0;

            var moveToOldCheckbox = moveGroup.add("checkbox", undefined, "Move to _old");
            moveToOldCheckbox.value = true; // Enabled by default

            var buttonGroup = modal.add("group");
            buttonGroup.orientation = "row";
            buttonGroup.alignment = ["center", "top"];
            buttonGroup.spacing = 10;

            var duplicateBtn = buttonGroup.add("button", undefined, "Duplicate", {name: "ok"});
            var cancelBtn = buttonGroup.add("button", undefined, "Cancel", {name: "cancel"});

            // Make the dialog resizable
            modal.onResizing = modal.onResize = function() {
                this.layout.resize();
            };

            if (modal.show() === 1) {
                app.beginUndoGroup("Version Up Compositions");

                // Process each composition
                for (var i = 0; i < selectedComps.length; i++) {
                    var comp = selectedComps[i];
                    var newComp = comp.duplicate();
                    newComp.name = results[i].newName;

                    // Handle moving to _old folder if checkbox is checked
                    if (moveToOldCheckbox.value) {
                        // Get current parent folder of the comp
                        var parentFolder = comp.parentFolder;
                        var oldFolder = null;

                        // Search for _old folder in the same level as the comp
                        for (var j = 1; j <= app.project.numItems; j++) {
                            var item = app.project.item(j);
                            if (item instanceof FolderItem &&
                                item.name === "_old" &&
                                item.parentFolder === parentFolder) {
                                oldFolder = item;
                                break;
                            }
                        }

                        // Create _old folder if it doesn't exist
                        if (!oldFolder) {
                            oldFolder = app.project.items.addFolder("_old");
                            // If comp is in a folder, put _old folder in the same parent
                            if (parentFolder) {
                                oldFolder.parentFolder = parentFolder;
                            }
                        }

                        // Move the old comp to _old folder
                        comp.parentFolder = oldFolder;
                    }
                }
                app.endUndoGroup();
            }

        } catch (error) {
            alert("Error: " + error.message);
        }
    };

    // Setup Panel Sizing
    panel.layout.layout(true);
    mainGroup.minimumSize = mainGroup.size;

    // Make the panel resizeable
    panel.layout.resize();
    panel.onResizing = panel.onResize = function() {
        this.layout.resize();
    };

    // Layout and show the panel
    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
