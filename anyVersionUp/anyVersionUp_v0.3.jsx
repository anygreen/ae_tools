(function createUI(thisObj) {
    // Version of the script
    var scriptVersion = "v0.3";

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

    function parseVersion(part) {
        var numberMatch = part.match(/\d+$/);
        if (!numberMatch) return null;

        var number = numberMatch[0];
        var prefix = part.substring(0, part.length - number.length);
        return {
            prefix: prefix,
            number: number,
            fullVersion: part
        };
    }

    function incrementVersion(version) {
        if (!version) return null;
        var num = parseInt(version.number);
        return {
            prefix: version.prefix,
            number: padNumber(num + 1, version.number.length),
            fullVersion: version.prefix + padNumber(num + 1, version.number.length)
        };
    }

    function processFinalName(nameParts, dateInfo, newVersion, oldVersion) {
        var newParts = nameParts.slice(); // Create a copy of the array
        
        // Update date if found
        if (dateInfo) {
            newParts[dateInfo.index] = getCurrentDate();
        }

        // Update version
        for (var i = 0; i < newParts.length; i++) {
            if (newParts[i] === oldVersion.fullVersion) {
                newParts[i] = newVersion.fullVersion;
                break;
            }
        }

        return newParts.join('_');
    }

    // Name processing function
    function processName(originalName) {
        var parts = originalName.split('_');
        
        // Find date anywhere in the name
        var dateInfo = findDateInParts(parts);
        var hasDateChange = dateInfo && (dateInfo.value !== getCurrentDate());

        // Check last part first for version number
        var versionPart = parseVersion(parts[parts.length - 1]);
        var versionIndex = parts.length - 1;

        // If not found, check second to last part
        if (!versionPart && parts.length > 1) {
            versionPart = parseVersion(parts[parts.length - 2]);
            versionIndex = parts.length - 2;
        }

        if (!versionPart) {
            throw new Error("Could not find version number in name");
        }

        var newVersion = incrementVersion(versionPart);

        return {
            oldName: originalName,
            newName: processFinalName(parts, dateInfo, newVersion, versionPart),
            oldVersion: versionPart,
            newVersion: newVersion,
            hasDateChange: hasDateChange,
            dateInfo: dateInfo
        };
    }

    // Create UI
    var panel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "anyVersionUp " + scriptVersion);
    panel.orientation = "column";
    panel.alignChildren = ["center", "top"];
    panel.spacing = 10;
    panel.margins = 16;

    var titleText = panel.add("statictext", undefined, "anyVersionUp " + scriptVersion);
    var buttonGroup = panel.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.spacing = 10;

    var aepButton = buttonGroup.add("button", undefined, "AEP");
    var compButton = buttonGroup.add("button", undefined, "Comp");

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
            if (!isOld && ((result.dateInfo && i === result.dateInfo.index) || 
                (part === result.newVersion.fullVersion))) {
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

            var currentName = app.project.file.name.replace(/\.aep$/, '');
            var result = processName(currentName);

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
                results.push(processName(selectedComps[i].name));
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

    // Layout and show the panel
    if (panel instanceof Window) {
        panel.center();
        panel.show();
    } else {
        panel.layout.layout(true);
    }

})(this);