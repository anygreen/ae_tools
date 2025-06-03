(function () {
    // Create the main UI panel or window
    var mainWindow = (this instanceof Panel) ? this : new Window('palette', 'Search and Replace Renamer', undefined);
    mainWindow.spacing = 10;
    mainWindow.orientation = "column";

    // Create UI elements
    var searchGroup = mainWindow.add("group");
    searchGroup.add("statictext", undefined, "Search (split by ';'):");
    var searchText = searchGroup.add("edittext", undefined, "");
    searchText.characters = 30;

    var replaceGroup = mainWindow.add("group");
    replaceGroup.add("statictext", undefined, "Replace (split by ';'):");
    var replaceText = replaceGroup.add("edittext", undefined, "");
    replaceText.characters = 30;

    var duplicateCheckbox = mainWindow.add("checkbox", undefined, "Duplicate");
    
    var runButton = mainWindow.add("button", undefined, "Run");

    runButton.onClick = function () {
        var searchQueries = searchText.text.split(";");
        var replaceQueries = replaceText.text.split(";");
        
        if (searchQueries.length !== replaceQueries.length) {
            alert("Mismatch in number of search and replace queries.");
            return;
        }

        var shouldDuplicate = duplicateCheckbox.value;
        
        // Main renaming function
        renameItems(searchQueries, replaceQueries, shouldDuplicate);
    }

    mainWindow.center();
    mainWindow.show();

    function renameItems(searches, replaces, duplicate) {
        var items = app.project.selection;

        if (items.length === 0) {
            alert("No items selected in the Project Panel.");
            return;
        }

        app.beginUndoGroup("Search and Replace Renaming");

        for (var i = 0; i < items.length; i++) {
            var item = items[i];

            if (duplicate) {
                var originalName = item.name;
                item = item.duplicate();
                item.name = originalName; // Ensure it doesn't have " 2" appended or incremented number
            }

            for (var j = 0; j < searches.length; j++) {
                item.name = item.name.split(searches[j]).join(replaces[j]);
            }
        }

        app.endUndoGroup();
    }

})();
