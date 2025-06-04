(function createUI(thisObj) {
    // Version of the script
    var scriptVersion = "v0.2";

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
        return /^\d{6}$/.test(dateStr);
    }

    function getCurrentDate() {
        var date = new Date();
        return padNumber(date.getFullYear() % 100, 2) + 
               padNumber(date.getMonth() + 1, 2) + 
               padNumber(date.getDate(), 2);
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

    function processFinalName(nameParts, newDate, newVersion, oldVersion) {
        var newParts = [];
        for (var i = 0; i < nameParts.length; i++) {
            if (i === 0 && newDate) {
                newParts.push(newDate);
            } else if (nameParts[i] === oldVersion.fullVersion) {
                newParts.push(newVersion.fullVersion);
            } else {
                newParts.push(nameParts[i]);
            }
        }
        return newParts.join('_');
    }

    // Name processing function
    function processName(originalName) {
        var parts = originalName.split('_');
        var hasDate = isDateValid(parts[0]);
        var currentDate = hasDate ? getCurrentDate() : null;

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
            newName: processFinalName(parts, currentDate, newVersion, versionPart),
            oldVersion: versionPart,
            newVersion: newVersion,
            hasDateChange: hasDate && (parts[0] !== currentDate)
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

    function createNameDisplay(container, label, name) {
        var group = container.add("group");
        group.orientation = "column";
        group.alignChildren = ["left", "top"];
        group.add("statictext", undefined, label + ":");
        var nameText = group.add("statictext", undefined, name);
        nameText.characters = 40;  // Make text field wider
        return group;
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

            createNameDisplay(modal, "Current", result.oldName);
            createNameDisplay(modal, "New", result.newName);

            var buttonGroup = modal.add("group");
            buttonGroup.orientation = "row";
            buttonGroup.alignment = ["center", "top"];
            buttonGroup.spacing = 10;

            var saveBtn = buttonGroup.add("button", undefined, "Save", {name: "ok"});
            var cancelBtn = buttonGroup.add("button", undefined, "Cancel", {name: "cancel"});

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

            var results = [];
            for (var i = 0; i < selectedComps.length; i++) {
                results.push(processName(selectedComps[i].name));
            }

            // Create Modal Dialog
            var modal = new Window("dialog", "Version Up Compositions");
            modal.orientation = "column";
            modal.alignChildren = ["left", "top"];
            modal.spacing = 10;
            modal.margins = 16;

            for (var i = 0; i < results.length; i++) {
                createNameDisplay(modal, "Current", results[i].oldName);
                createNameDisplay(modal, "New", results[i].newName);
                if (i < results.length - 1) modal.add("panel", undefined, undefined, {height: 2});
            }

            var buttonGroup = modal.add("group");
            buttonGroup.orientation = "row";
            buttonGroup.alignment = ["center", "top"];
            buttonGroup.spacing = 10;

            var duplicateBtn = buttonGroup.add("button", undefined, "Duplicate", {name: "ok"});
            var cancelBtn = buttonGroup.add("button", undefined, "Cancel", {name: "cancel"});

            if (modal.show() === 1) {
                app.beginUndoGroup("Version Up Compositions");
                for (var i = 0; i < selectedComps.length; i++) {
                    var newComp = selectedComps[i].duplicate();
                    newComp.name = results[i].newName;
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